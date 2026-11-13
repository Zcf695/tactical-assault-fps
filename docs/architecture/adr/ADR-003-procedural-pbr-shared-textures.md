# ADR-003：程序化 PBR 材质库 + 全局共享贴图 + 静态合批

- **状态**：已采纳（Accepted），且已作为材质红线固化
- **日期**：追溯记录（决策发生于「把画质从廉价感拉到 3A 感」的阶段，事后归档）
- **决策者**：项目作者
- **影响范围**：`pbr_textures.js`、`graphics_enhancement.js`、`world_polish.js`、`world_props.js`、`item_models.js`、`render_pipeline.js`（PMREM 环境反射）、`performance_guard.js`（降级时修改材质）

---

## 1. 背景

项目要解决的核心视觉问题是：**低多边形盒体场景的廉价感**。所有建筑、集装箱、掩体都是 `BoxGeometry` + 纯色 `MeshStandardMaterial`，在斜视角下表现为「一堆颜色不同的塑料块」——没有表面细节、没有接地感、没有材质区分。

在 ADR-001 的「零构建、零外部资源、`file://` 可用」约束下，可用的手段被严格限制：

| 手段 | 是否可用 | 原因 |
|---|---|---|
| 下载 PBR 贴图（Poly Haven 等） | ❌ | 体积（每套 4 张 2K 图约 10–20 MB）、许可、必须网络请求、`file://` 下受 CORS 限制 |
| 打包 base64 内嵌贴图 | ❌ | 会让 JS 文件膨胀到几十 MB，解析变慢，编辑器卡死 |
| Canvas 运行时生成 | ✅ | 零请求、零 CORS、体积为零 |
| 程序化几何体细节（加倒角、加分割线） | ✅ | 但会增加三角形数与 draw call |

同时还有一个必须解决的性能约束：地图有 120+ 建筑 + 190+ 容器 + 数百个道具，如果每个网格都持有独立材质/贴图，draw call 会直接爆掉（每材质一个 draw call），且显存会因贴图克隆而爆炸。

**这两个约束（零外部资源 + 数百网格）指向同一个答案：程序化生成少量贴图，全局共享，靠 UV 缩放而非贴图复制来表达世界尺度差异。**

---

## 2. 决策

**采用三层策略：① 用 Canvas 程序化生成 11 套可无缝平铺的 PBR 贴图并全局缓存；② 所有网格通过缩放 UV 共享同一份贴图，绝不克隆；③ 材质升级完成后再按材质签名合并静态几何为单一 BufferGeometry（合批）。**

### 2.1 第一层：程序化生成 11 套 PBR 贴图

`pbr_textures.js` 定义 `SPECS`（`pbr_textures.js:198`），每套描述一个「高度场 + albedo + roughness」三元组：

```
concrete  asphalt  gravel  grass  dirt  metal  corrugated  wood  sandbag  roof  brick
```

生成流程（`build(spec)`）：

```
高度场 h(u,v)      ← fbm（分形布朗运动），在整数周期上取模
    ├─ albedo     ← 由 h + 噪声色调 + 污渍层合成
    ├─ normal     ← 由 h 做 Sobel 梯度 → 法线贴图
    ├─ roughness  ← 由 h + 独立噪声合成
    └─ （部分种类）metalness
```

关键设计点：

- **尺寸 256×256**。这是一个刻意的取舍：256² 在近中景够用（游戏视角 78° FOV，玩家很少贴脸看墙），但显存只有 512² 的 1/4、1024² 的 1/16。11 套 × 4 张 × 256² × 4 B ≈ **11 MB**，完全可接受。
- **无缝平铺**：噪声的格点哈希用 `((i % period) + period) % period` 取模（`pbr_textures.js:49`），保证 `(x + period)` 与 `x` 哈希值相同 → 平铺边界连续。这是「可平铺」的实现本质，不是靠镜像或渐变遮罩。
- **惰性生成 + 分帧预热**：`get(kind)` 首次调用才生成（`pbr_textures.js:492`），`warmup(kinds)` 用 `setTimeout(step, 0)` 分帧生成，避免开局一次性卡住（`pbr_textures.js:508`）。生成时打 `console.debug('[PBRTextures] concrete 生成完成 12ms')`。
- **各向异性过滤**：`init(renderer)` 读取 `renderer.capabilities.getMaxAnisotropy()`（上限 8），斜视角地面不糊。

### 2.2 第二层：全局共享，靠 UV 缩放表达尺度

`get(kind)` 返回的 `set` 被缓存在 `_sets[kind]`，**所有使用者在拿到同一个对象引用**。世界尺度差异全部通过修改几何体的 UV 属性实现：

| 几何类型 | 函数 | UV 计算 |
|---|---|---|
| `BoxGeometry`（建筑、集装箱、路障） | `scaleBoxUVs(geo, tileU, tileV)`（`pbr_textures.js:541`） | **逐面按世界米数**计算 UV，保证纹理在每面都是 1:1 的真实尺度（不会被拉伸） |
| 平面/圆柱/其它 | `scaleUVs(meshOrGeo, tileU, tileV)`（`pbr_textures.js:520`） | 按几何尺寸算 |

对外唯一入口是 `applyToMesh(mesh, kind, opt)`（`pbr_textures.js:568`），`opt` 含 `{ tileU, tileV, normalScale, color, metalness, roughness, envMapIntensity }`。

**「逐面世界 UV」是这套方案能用的关键**。如果简单地对整个 BoxGeometry 做 `tex.repeat.set(2,2)`，一个 8m 长的集装箱和一个 2m 的箱子会显示不同大小的砖块/混凝土纹理，视觉尺度完全崩掉。逐面算 UV 让「1 米 = 固定数量的纹理周期」在所有盒体上一致。

### 2.3 第三层：按材质签名合批

`world_polish.js` 的 `batchStatic(env)`（`world_polish.js:219`）：

```
遍历 env.traverse()
  ├─ 跳过：非 Mesh / InstancedMesh / SkinnedMesh / 不可见 / userData.noBatch
  ├─ 跳过：无 position 属性 / 有 morphAttributes
  ├─ 跳过：material 为数组
  ├─ 跳过：material.transparent 或 depthWrite === false   ← 水面、区域提示保持独立
  └─ 按 _materialKey(mat) + 阴影标志 分组
       └─ 组内 ≥ 2 个 → _mergeMeshes(list) → 单个 Mesh
```

分组键是 `key + '|s' + (castShadow?1:0) + (receiveShadow?1:0)`。这样阴影配置不同的网格不会混进同一批（否则合批后无法单独控制投影）。

**合批必须在材质升级之后**（`game.js:2004-2011` 的显式守卫）：`_materialKey` 依赖材质当前的贴图引用与参数，材质升级前后的签名不同。顺序错了会导致「合并时的分组键与实际材质不符」，症状是纹理错位且只在下次切图时偶然修好（详见 `overview.md` §6.1）。

### 2.4 环境反射：与渲染管线共享 PMREM

`render_pipeline.js` 用天空穹顶实时烘焙 PMREM 环境贴图，供所有 `metalness > 0` 的材质使用。这意味着 `ItemModels` 里的共享材质（`item_models.js:16-33`，20+ 个 `MeshStandardMaterial`）都写了 `envMapIntensity`，靠这个环境反射获得金属质感。

**这是本 ADR 与 ADR-004 的耦合点**：`PerformanceGuard` 在 3 级降级时会把所有 `envMapIntensity` 压到 0.1（`performance_guard.js:88`），因为环境反射的像素着色器成本在低端 GPU 上很贵。副作用是所有金属物件立刻「变塑料」。

---

## 3. 后果

### 3.1 正面

- **零网络、零 CORS、零体积**。整个材质系统不产生任何外部请求，`file://` 双击直接跑。11 套 PBR 贴图的「体积」是 0 字节，因为它们只在运行时存在。
- **显存完全可控**。11 套 × 4 张 256² = 约 11 MB，与场景中有多少个网格**完全无关**。这是最关键的一条：地图从 120 建筑扩到 300 建筑，显存不变。
- **视觉尺度真实**。逐面世界 UV 让同一个「混凝土」贴图在 8m 集装箱和 2m 木箱上呈现一致的颗粒尺度，这是低模场景看起来「不像贴图拼贴」的根本原因。
- **可无缝平铺**（数学上保证，不是靠视觉调节），意味着可以任意缩放 `tileU/tileV` 而不露接缝。
- **加载可分帧**，`warmup()` 让首次生成不阻塞首帧。
- **合批把 draw call 压到个位数量级**。实测入口：`?perfdebug=1` → `window.__perfFrame.calls`。

### 3.2 负面

- **首次进入某地图有生成抖动**。`get()` 是惰性同步生成，单套约 10–20 ms × 4 张。若不在 `warmup()` 列表里的种类被中途用到（例如某个 `sandbag` 只在特定地图出现），会在地图加载中出现一次 40–80 ms 的卡顿。**当前 `warmup()` 默认只预生成 6 种**（`pbr_textures.js:509`），另外 5 种（gravel / dirt / sandbag / roof / brick）是惰性命中。
- **`_materialKey()` 是隐式契约**。任何新材质如果用了它不认识的特征（例如自定义 `onBeforeCompile`、`alphaTest`、`vertexColors`），会返回不稳定或 `null` 的 key → 要么误合并（导致视觉错误），要么不合并（draw call 翻倍）。**这是本条 ADR 最脆弱的地方**：约束存在但没有检查。
- **合批后无法单独控制几何**。合并成一个大 BufferGeometry 后，就无法再对一个「集装箱」做动画、单独隐藏、单独换材质。所以 `userData.noBatch` 是一个必须记住的逃生阀——任何需要运行时变化的物体都要打上它，否则合批后失效。
- **合批是一次性的、不可逆的**。`batchStatic` 之后 `mapEnvironmentGroup` 的子树结构被破坏（原始 Mesh 被移除、替换为合并 Mesh）。任何「遍历场景找某个具体建筑」的代码都会失效。这就是为什么 `obstacles` 必须保留对原始 `mesh` 的引用（合批后这些 mesh 已不在场景里，但 `position` 仍可读——**这依赖合批实现不修改原 mesh 的 position，是一个未文档化的假设，需核实**）。
- **`performance_guard` 的降级不可逆**。3 级降级把 `m.normalMap = null` 并置 `needsUpdate`（`performance_guard.js:87-89`），法线贴图引用被丢弃且没有备份。由于降级是「只降不升」的，只有「重开一局 / 切图重建材质」才可能恢复。若 `graphics_enhancement.upgradeEnvironmentMaterials()` 不做重新 `applyToMesh`，那么**玩久了之后画面会永久变平**（缺少法线细节）。**待核实**（`overview.md` §9-#2、#3）。
- **11 套贴图都是「近似的」**。程序化噪声生成的混凝土不等于真实混凝土。远看没问题，贴脸看会看出「分形噪声」的重复感。这是一个视觉上限，无法通过调参突破——要突破只能换真实扫描贴图，而那违反 ADR-001。

### 3.3 与 `graphics_enhancement.js` 的功能重叠

`graphics_enhancement.js`（997 行）内部有一套自己的程序化 Canvas 纹理（`makeConcreteTexture` / `makeGrassTexture` / `makeAsphaltTexture` / `makeNoiseTexture`），以及 `finalizeColorTexture()` 做 sRGB 编码兜底。这套与 `pbr_textures.js` 是**两套并行的程序化材质系统**：

| | `pbr_textures.js` | `graphics_enhancement.js` |
|---|---|---|
| 贴图种类 | 11 套，含法线/粗糙度/金属度 | 若干套，主要 albedo |
| UV 处理 | 逐面世界 UV | 简单 repeat |
| sRGB | 未显式设置 | `finalizeColorTexture` 里设 `tex.encoding = THREE.sRGBEncoding` |
| 谁在实际用 | `upgradeEnvironmentMaterials` 调用它（待核实调用深度） | 自身也直接生成 |

**这是 L1 层最该清理的债**：两套系统并存，只有部分生效，颜色管线可能被走两遍。已在 `overview.md` §9-#1、#3 标记为待核实。

---

## 4. 替代方案

### 方案 A：外置 PBR 贴图（Poly Haven / ambientCG）+ 本地文件（否决）

- **做法**：下载 4–6 套 CC0 PBR 贴图，压缩成 512² WebP，放 `textures/` 目录。
- **优点**：真实感远超程序化生成。视觉上限高一个量级。
- **为什么否决**：
  1. 体积：即使压到 512² WebP，每套 4 张约 300–600 KB，6 套约 3 MB。可接受，但违反「零资源依赖」的洁癖目标。
  2. **`file://` 下的 CORS**：`THREE.TextureLoader` 用 `Image` 或 `XHR` 加载。用 `Image` 加载本地文件到 Canvas 会被标记为 tainted，若需要读像素（如生成 mipmap 或做 roughness 重映射）就失败。当前项目所有贴图都经过 Canvas，换外置图会引入这个坑。
  3. 部署变复杂：不再是「一个文件夹双击」，需要考虑贴图路径大小写（Windows 不敏感、Linux 敏感）、相对路径。
- **保留价值**：如果放弃 `file://` 需求（见 ADR-001 复核条件 1），这是提升画质最快的手段。

### 方案 B：Shader 程序化（在片元着色器里算噪声），不生成贴图（否决）

- **做法**：不用 Canvas，直接在材质的 `onBeforeCompile` 里注入噪声函数，逐像素算 albedo/normal。
- **优点**：零显存、无限分辨率、无平铺重复（可以用 3D 噪声）。
- **为什么否决**：
  1. 成本全在 GPU 片元阶段。满屏 1080p × 每像素多次 fbm 采样 = 低端 GPU 直接跪。这与 ADR-004 的自适应降级精神冲突（降级时反而最贵的方案最需要）。
  2. `onBeforeCompile` 会破坏 `world_polish._materialKey()` 的材质签名归一化 → 合批全部失效。
  3. r128 的 `onBeforeCompile` API 与后续版本差异大，升级更困难。
- **备注**：可以局部使用（仅天空穹顶的云层就是 shader 算的，`render_pipeline.js` 的 `SKY_FRAG`）。**天空适合 shader（单次大面积、无合批需求），场景物件不适合（数百网格、需要合批）**。这个区分是合理的。

### 方案 C：每网格独立材质 + 独立贴图（否决）

- **做法**：最直觉的做法，`new Texture` per mesh，各自设 `repeat`。
- **为什么否决**：显存爆炸（数百网格 × 4 张 256² RGBA ≈ 数百 MB）+ draw call 爆炸（无法合批）。这是本条 ADR 要解决的核心问题。
- **症状**：详见 `overview.md` §6.2 — 中端机加载第 3 张地图时 `WEBGL_CONTEXT_LOST`，DevTools 里 `Texture` 数量随网格数线性增长。

### 方案 D：Vertex Color + 无贴图（否决）

- **做法**：把细节烘到顶点色里，材质只用 `vertexColors: true`。
- **优点**：极轻，draw call 与显存都最优。
- **为什么否决**：`BoxGeometry` 只有 8 个顶点（每面 4 个，共用 8 个），顶点色的分辨率等于「每个面一个颜色」→ 和纯色的区别只是每面可以不同色。无法表达颗粒、划痕、砖缝。**这是本项目「廉价感」的原始状态**，不是解决方案。

### 方案 E：贴图图集（Atlas）+ 单材质（部分可行，未采纳）

- **做法**：把 11 套贴图拼到一张 1024×1024 的图集里，所有网格共用一张贴图和一份材质，UV 指向图集的不同区域。
- **优点**：draw call 降到 1，且天然支持合批（甚至不需要 `MaterialKey` 分组）。
- **为什么未采纳**：
  1. 需要给每个几何体重写 UV 到图集坐标，与「逐面世界 UV」冲突（世界 UV 是无限延伸的，图集是有限的）。要支持平铺就必须用 `texture.repeat` + `offset`，但那只对单张贴图有效，图集里无法为不同区域设置不同的 repeat。
  2. 需要 `THREE.DataTexture` 或自定义 shader 做 UV wrap，复杂度陡增。
  3. 当前合批已经能把 draw call 压到可接受，没有强需求。
- **保留价值**：如果将来 draw call 成为瓶颈，且能接受「放弃无限平铺」，这是标准解法。

---

## 5. 复核触发条件

1. **`?perfdebug=1` 下 `calls > 300`** → 合批没生效或 `_materialKey` 失配，优先查 `GraphicsEnhancement.isEnabled()` 与材质签名。
2. **出现纹理错位/拉伸的报障** → 优先怀疑 §5.1 的顺序问题（材质升级 ↔ 合批），其次是某处误用了 `clone()`。
3. **`normalMap` 在长局后永久消失** → 说明 `performance_guard` 的不可逆降级被触发，需按 §3.2 修。
4. **`obstacles` 中某个 mesh 的 `position` 在合批后读不到/读错** → 说明合批实现修改了原 mesh，需在 `_mergeMeshes` 里改为不修改原 mesh 的 `matrix`。
5. **决定放弃 `file://`** → 立刻评估方案 A（外置贴图），画质提升立竿见影。
6. **新增材质类型**（例如玻璃、发光体、贴花）→ 必须同步更新 `world_polish._materialKey()`，并加一条断言。

---

## 6. 给接手者的三条纪律

1. **永远不要 `clone()` 贴图。** 要不同的平铺密度就调 `tileU/tileV`，要不同的颜色就调 `material.color`，要不同的粗糙度就调 `material.roughness`。贴图对象本身永不复制。
2. **新增可合批物体时必须让它能被 `_materialKey()` 归一化。** 如果做不到（如需 `onBeforeCompile`），给它的 `userData.noBatch = true` 并写注释说明原因。**宁可多几个 draw call，也不要误合并导致视觉错误。**
3. **材质升级 → 合批 → 接地阴影的顺序不可换。** 这是 `rebuildMapEnvironment()` 的 4→5→6 步，换了的症状是「随机出现的纹理错乱」（`overview.md` §6.1 有完整症状表）。
