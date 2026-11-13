# ADR-001：Three.js r128 + 无构建、无模块系统

- **状态**：已采纳（Accepted），且已被当前代码库深度依赖
- **日期**：追溯记录（决策发生于项目初始；本文档为事后归档）
- **决策者**：项目作者
- **影响范围**：全部 27 个 JS 文件（24 个根目录模块 + 3 张地图数据）、`index.html` 脚本顺序、所有部署方式、所有工具链

---

## 1. 背景

《战术突击》是一个浏览器端搜打撤 FPS，目标是「双击 `index.html` 就能玩」。这个目标在项目最初的形态里是一条硬需求，而非偏好：游戏需要能在没有 Node.js、没有网络（首次加载后）、没有构建服务器的环境里跑起来——包括直接 `file://` 打开。

约束清单：

1. **零安装启动**：不能要求用户 `npm install` 或任何形式的构建步骤。
2. **`file://` 可用**：这意味着不能依赖 `fetch()` 加载本地 JSON/GLB（受同源策略限制），资源必须通过 `<script>`、`<img>`、`<audio>` 这些「不受 CORS 约束」的标签加载。
3. **单文件可交付**：整个游戏能以「一个文件夹，双击 index.html」的形式交付。
4. **作者是单人开发**：没有构建链维护预算，也没有多人协作的模块边界需求。

在 2021 年前后（项目起步时期）的选项里，Three.js 是浏览器 3D 的事实标准，且其 UMD 构建（`three.min.js`）可以直接用 `<script>` 引入并挂到全局 `THREE`。

**为什么钉在 r128 而不是「最新版」**：

- r128 是 Three.js 最后一个仍保留大量现成 `examples/js/` 形态后期处理脚本（`EffectComposer` / `UnrealBloomPass` / `ShaderPass` 等）以非 ES Module 形式分发的版本区间附近。项目直接从 `cdnjs` 引 `r128/three.min.js`，并把配套的 `vendor/postprocessing/*`、`vendor/shaders/*`、`vendor/GLTFLoader.js`、`vendor/SkeletonUtils.js` 一并复制进仓库。
- r129 之后 Three.js 逐步转向 `examples/jsm/`（ES Module），后期处理脚本不再提供可直接 `<script>` 引入的 UMD 版本。升级意味着必须引入打包器，与约束 1/2 直接冲突。
- r128 的线性→sRGB 色彩管理与后续 r152+ 的 `ColorManagement` 大改不兼容。项目里的 `tex.encoding = THREE.sRGBEncoding` 写法（`graphics_enhancement.js:41`）在 r152+ 会被废弃 API 警告甚至行为改变。

因此，**r128 与「无构建」是同一个决策的两面**：选 r128 是为了保住 `<script>` 加载方式；保住 `<script>` 加载方式就锁死了 r128。

---

## 2. 决策

**采用 Three.js r128（CDN `cdnjs` 提供 `three.min.js`）+ 仓库内 `vendor/` 固定副本 + 原生 JS IIFE 全局命名空间，不引入构建工具、包管理器、模块系统。**

具体形态：

1. `index.html` 用 39 个顺序化的 `<script>` 标签表达依赖关系。**加载顺序即架构契约**（详见 `overview.md` §3.1）。
2. 每个功能模块用一个 IIFE 返回一个对象，赋给一个 `const` 全局名：

   ```js
   const RenderPipeline = (function () { /* ... */ return { init, render, setTheme, ... }; })();
   ```

3. 模块间通信走 `window` 上的全局名。使用者一律先做存在性守卫：

   ```js
   if (typeof RenderPipeline !== 'undefined') { RenderPipeline.init(renderer, scene, camera); }
   ```

4. 数据文件（`map/*.js`）用 `var MAP_DATA_MILITARY = { ... }`，在 three.js **之前**加载。
5. 第三方库一律复制进 `vendor/`，不走 CDN（唯一例外是 three.js 本身）。
6. 无 tree-shaking、无 minify、无 transpile。源码即产物。

---

## 3. 后果

### 3.1 正面

- **零门槛**：双击 `index.html` 即玩。这是项目最大的可用性优势，也是所有后续决策的既成前提。
- **调试体验一流**：浏览器 DevTools 里看到的就是源码，行号一一对应，无需 sourcemap。`?perfdebug=1`、`window.__perfFrame`、`window._fpsData` 这类诊断能力全部零成本接入。
- **`file://` 兼容**：所有程序化资源（`pbr_textures.js` 的 11 套贴图、`audio_engine.js` 的合成音频、`item_models.js` 的 3D 模型、`world_polish.js` 的阴影贴图）都是**运行时用 Canvas/WebAudio/几何体生成**的，完全没有外部资源请求。这个「零资源依赖」策略正是无构建方案的必然产物，反过来也成了项目最优雅的部分（见 ADR-003）。
- **交付简单**：压缩成 zip 就是一个可运行的游戏，不需要「先跑 build 再传 dist」。
- **无依赖风险**：`vendor/` 里的文件永不改变，不存在「某天 npm 上的包被删了」这类事件。

### 3.2 负面（这些是必须偿还的代价）

- **没有静态检查能帮你**。没有 import/export，就没有「改了函数签名后 IDE 报错」这件事。所有跨模块约定都是口头契约。一个真实例子：`world_props.js` 引用了 `game.js:1690` 的 `let containers`，在正确的时序下能跑，时序一变就抛 `ReferenceError`（见 `overview.md` §6.4）。
- **加载顺序是隐式契约且不可验证**。`index.html` 的 41 行脚本顺序里，任何两行的对调都可能导致某个模块的顶层语句在依赖未就绪时执行。没有任何自动化手段能检测出「顺序错了」——只能靠运行。
- **单个 IIFE 无法 tree-shake，也无法懒加载**。所有模块无论用不用都在首屏加载（`boss_system_v2.js` + `_extensions.js` 共 2,507 行，进了大厅才会用到，但已经在首屏解析）。
- **`typeof` 守卫会吞掉硬崩溃**。这是最危险的一条：`if (typeof X !== 'undefined')` 让「模块没加载」从崩溃降级为静默跳过。而 `overview.md` §3.2 揭示了一个更隐蔽的版本：`settings.js` 和 `graphics_enhancement.js` 在 `game.js` **之后**加载，却能被 `init()` 引用——仅因为 `ResourceLoader.startLoading` 的 `async` 阶段把 `init()` 推迟到了所有 `<script>` 之后。这条时序没有写进任何契约，删掉 `resource_loader.js` 里的 `setTimeout(resolve, 1500)` 就会让整条美术增强链静默消失，**不报错**。
- **`typeof` 对 `let/const` 的 TDZ 无效**。这块守卫给了虚假的安全感（实测见 `overview.md` §6.4）。
- **升级路径几乎不存在**。想升 Three.js 版本 = 重写全部后期处理 + 适配色彩管理 + 可能引入打包器 = 等于重写渲染层。这是个单向门（one-way door）。
- **CDN 是单点**。`three.min.js` 来自 `cdnjs`，首次加载需要网络。断网/被墙环境下双击 `index.html` 会白屏（`THREE is not defined`，且所有 `typeof THREE` 守卫会让代码「继续执行」而非报错，症状是黑屏但控制台无红字）。

### 3.3 已观测到的实际损失

| 事故 | 与 ADR-001 的关系 |
|---|---|
| `WorldProps` TDZ 导致全部道具未生成，无报错 | 直接后果：无模块系统 → 靠全局名通信 → TDZ 窗口存在 |
| `render_pipeline.js` 与 `graphics_enhancement.js` 两套后期链并存 | 间接后果：无模块解析 → 无法静态发现功能重叠 |
| `game.js` 膨胀到 10,837 行 | 强相关：无 import 意味着「加到同一个文件」的成本最低 |
| 23 个模块未纳入版本管理 | 间接后果：无 `package.json`/无构建产物，也就没有「`npm run build` 是否通过」这个天然的提交前检查点 |

---

## 4. 替代方案

### 方案 A：Vite / esbuild + ES Module（否决）

- **做法**：`import * as THREE from 'three'`，用 Vite 做 dev server + 生产打包，`npm install` 管理依赖。
- **优点**：模块边界显式、可 tree-shake、可 HMR、可用 TypeScript、可用 ESLint/Prettier 统一风格、`code splitting` 让 Boss 系统按需加载。
- **为什么否决**：直接违反「双击 `index.html` 就能玩」。需要 `npm install && npm run build` 才能得到可玩产物，且 `file://` 打开 dist 里的 index.html 会因为模块的 CORS 限制（`type="module"` 在 `file://` 下被禁）而失败——必须起一个 HTTP server。这把「零门槛」变成了「有两步门槛」。
- **保留价值**：如果未来决定放弃 `file://`，这是最直接的升级路径。迁移成本主要集中在后期处理库的 ESM 化（要换成 `three/addons/`）与色彩管理适配。

### 方案 B：无构建 + ES Module（`<script type="module">`）（否决）

- **做法**：保留 `npm install` 的自由（或直接用 CDN 的 ESM 版本 `three@0.128/build/three.module.js`），用原生 `import` 表达依赖，不需要打包器。
- **优点**：拿到了模块边界和显式 import，仍不需要构建步骤。浏览器原生支持。
- **为什么否决**：`<script type="module">` 在 `file://` 协议下会被 CORS 策略拒绝。这是决定性因素——`file://` 可用是项目的硬需求（约束 2）。
- **备注**：如果将来放弃 `file://` 但想保留「无构建」，这是最优选择。它比方案 A 轻，比现状安全。

### 方案 C：无构建 + 单一 IIFE + 显式依赖注入（部分采纳）

- **做法**：不引入模块系统，但**禁止模块读全局**，所有跨模块依赖通过 `init(ctx)` 参数注入，用一个手写的 `boot.js` 按注册顺序初始化各模块：

  ```js
  // 假设的 boot.js
  const ctx = { renderer, scene, camera, getState: () => S, getObstacles: () => obstacles };
  RenderPipeline.init(ctx);
  WeaponFX.init(ctx);
  EnemyAI.init(ctx);        // 替代「直接读全局 playerGroup」
  ```

- **优点**：保持零构建、零依赖，同时把「隐式全局耦合」变成「显式参数契约」。IDE 能补全、能跳转、重构能改名。`overview.md` §2 的耦合表里，每一行都能被这条规则消掉。
- **为什么部分采纳**：项目里已经有做对的先例（`WeaponFX.init(scene, camera)`、`RenderPipeline.init(renderer, scene, camera)`、`WeaponADS.init(camera, weaponGroup)`、`WorldProps.apply(env, obstacles)`），但没有制度化。这是**当前约束下的最优演进方向**，已写入 `production/epics/S1-backlog.md` 作为 S-14。
- **代价**：需要在 `index.html` 里多一个 `boot.js` 的 `<script>`，且要手工维护初始化顺序——但这份顺序本来就是隐式的，显式化只有收益。

### 方案 D：降级到 Unity WebGL / Godot HTML5 导出（否决）

- **优点**：真正的游戏引擎，有编辑器、有资源管线、有类型系统。
- **为什么否决**：完全放弃现有 24,342 行代码与全部渲染优化成果（ADR-002/003/004 的经验不可迁移）。且 WebGL 导出体积通常 10–30 MB 起，加载时间从「1 秒」变成「20 秒」，彻底违背项目定位。

---

## 5. 复核触发条件

出现以下任一情况时，应重新评估本 ADR：

1. **`file://` 不再是需求**（例如确定要上架 itch.io / 自建站点）→ 立刻评估方案 B。
2. **团队从 1 人扩展到 3 人以上** → 无模块系统的协作成本会指数上升，优先评估方案 B。
3. **Three.js r128 出现无法绕过的安全/兼容问题**（例如新版浏览器移除某个 WebGL 扩展）→ 强制评估升级路径。
4. **首屏加载时间成为用户投诉项** → 方案 B 的 `code splitting` 能解决按需加载。
5. **引入任何需要类型约束的新子系统**（网络同步、存档加密）→ 该子系统应独立评估是否允许例外。

---

## 6. 给接手者的三条操作建议

1. **不要试图升级 Three.js 版本。** 那是一次重写，不是一次升级。要做的话，先按方案 B 迁移到 ESM，再在 ESM 上逐版本升级。
2. **新增模块时必须做显式依赖注入，不要读写全局。** 参考 `weapon_fx.js` 的 `init(scene, camera)`，不要参考 `enemy_ai.js` 的直接读 `playerGroup`。这条成本极低，是当前约束下性价比最高的纪律。
3. **把 `vendor/three.min.js` 复制进仓库。** 当前 three.js 是 CDN 加载，`vendor/` 里没有它。这是一个可以立即消除的单点故障（约 600 KB），代价接近零。
