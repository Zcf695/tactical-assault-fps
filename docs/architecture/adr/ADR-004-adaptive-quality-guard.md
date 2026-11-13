# ADR-004：画质自适应采用「连续分辨率回退 + 离散分级降级」双轨，且降级不可逆

- **状态**：已采纳（Accepted），但**内部存在两套互相拉扯的控制器，需收敛**（见 §3.3）
- **日期**：追溯记录（事故驱动，事后归档）
- **决策者**：项目作者
- **影响范围**：`performance_guard.js`、`render_pipeline.js`（`_adaptResolution` / `_applyQuality` / `setLowMode` / `setResolutionScale`）、`settings.js`（`GameSettings.applySettings`）、`perf_manager.js`（HUD 分频，间接相关）

---

## 1. 背景

浏览器端的运行环境分布是**极端长尾**的：

| 环境 | 特征 | 典型表现 |
|---|---|---|
| 独显 PC + Chrome | 目标环境 | 144 FPS 无压力 |
| 核显笔记本（Intel Iris / Vega 8） | 像素填充是瓶颈 | 1080p 下 30–45 FPS |
| **软件渲染**（SwiftShader / llvmpipe / Microsoft Basic Render） | 无 GPU，CPU 软件光栅化 | **个位数 FPS，甚至 1–2 FPS** |
| 移动端浏览器 | 散热/降频/TBDR 架构 | 前 30 秒正常，之后因过热降到 20 FPS |
| 高 DPI 屏幕（`devicePixelRatio = 2~3`） | 像素数是 1080p 的 4–9 倍 | 未做 cap 时直接跪 |
| 后台标签页恢复 | 累积长帧 | 追帧死亡螺旋 |

关键洞察：**固定的画质档位无法覆盖这个分布**。一个「中等」档在独显上浪费性能，在核显上仍然卡，在软件渲染上等于没设。而且**玩家不会去设置面板改画质**——他只会说「这游戏很卡」然后关掉。

软件渲染的情况尤其糟糕：它不是一个「慢一点」的梯度，而是**数量级差异**。任何渐进式自适应算法（每 1 秒降一档）在 1 FPS 的环境里需要 4–5 秒才能降到最低，这 4–5 秒里玩家已经关掉了页面。

因此需要两个互补的机制：
1. **一个「一次性到位」的粗判**：启动时识别软件渲染，直接跳到低档，不浪费玩家的前 5 秒。
2. **一个「细粒度、可恢复」的微调**：在正常环境里根据实时帧率微调分辨率，不掉档也能跑顺。

---

## 2. 决策

**采用双轨自适应：**

- **轨道 A（离散、单向、不可逆）**：`performance_guard.js` 的 **5 级降级**（0–4），启动时识别软件渲染预降两级，之后每 1.2 s 采样，只降不升。
- **轨道 B（连续、双向、可恢复）**：`render_pipeline.js` 的 `_adaptResolution()`，按 0.1 步长下降 / 0.05 步长上升地调 `devicePixelRatio`，双向可恢复。

两轨通过 `RenderPipeline` 的公开接口解耦（`setLowMode` / `applyQuality` / `setResolutionScale`），`PerformanceGuard` 不直接碰 `renderer`。

### 2.1 轨道 A：5 级离散降级（`performance_guard.js`）

**分级定义**（`_apply(n)`，`performance_guard.js:54`）：

| 级别 | 触发条件（采样帧率） | 动作 |
|---:|---|---|
| **0** | 默认 | 全开 |
| **1** | < 30 FPS | `quality='low'`、`postFX=false`、`dynamicResolution=true`；分辨率比例 **0.85** |
| **2** | < 20 FPS | 上述 + `shadowQuality='off'`；分辨率 **0.75**；关接地阴影（`WorldPolish.setContactShadowsVisible(false)`）；`WeaponFX.setLowMode(true)` |
| **3** | < 12 FPS | 上述 + `RenderPipeline.setLowMode(true)`（天空切 `LOW_SKY_FRAG`、去 IBL）；分辨率 **0.65**；**遍历场景把所有材质的 `normalMap = null`、`envMapIntensity → 0.1`**；`ItemIcons.setLowMode(true)` |
| **4** | < 6 FPS | 上述 + 分辨率 **0.55**；隐藏 `dustParticles`；`fog.far = min(far, 120)` |

**采样逻辑**（`update()`，`performance_guard.js:133`）：

```
用 performance.now() 取真实时间（不信任主循环传入的 frameDt）
  ├─ 理由：主循环的 frameDt 被 CONFIG.MAX_FRAME_DT = 0.1 截断过，
  │        低帧率时会被"看起来正常" → 保护机制会误判为帧率良好
  ├─ 预热 3.2 s（跳过加载期的长帧）
  ├─ 每 1.2 s 计算一次 fps = frames / acc
  ├─ 连续 2 次 fps < 30 才降级（避免切图/加载的单次长帧误判）
  └─ 满足下列首个条件即降一级：< 6 → 4；< 12 → 3；< 20 → 2；< 30 → 1
```

**几个刻意的设计**：

- **只降不升**（`if (n <= _level) return;`）：避免在临界点来回抖动。玩家宁可稳定在低画质，也不要画质每秒跳变。
- **启动即预判软件渲染**：`_detectSoftware()`（`performance_guard.js:42`）读 `WEBGL_debug_renderer_info` 的 `UNMASKED_RENDERER_WEBGL`，正则匹配 `swiftshader|software|llvmpipe|basic render|microsoft basic`。命中则 `_apply(2)` 并设 `_warm = 2.5`（缩短预热，让它更快有机会降到 3/4 级）。
- **采样会自动停止**：`if ((_level >= 3 && _checks >= 3) || _checks >= 10) _done = true;` —— 降到 3 级且采过 3 次、或总共采过 10 次后停止检测，避免持续开销。
- **URL 强制通道**：`?perf=low` → 直接 `_apply(3)` 并停止；`?perf=off` → 完全禁用（用于排查「是不是守卫自己在捣乱」）。
- **降级必须走管线接口**：`RenderPipeline.setResolutionScale(scale)` 而非 `_renderer.setPixelRatio()`。代码注释已写明原因：「必须走管线接口，否则下一次 `applyQuality` 会把分辨率改回去」（`performance_guard.js:73`）。

### 2.2 轨道 B：连续分辨率自适应（`render_pipeline.js:621`）

```
_fpsAvg 用 EMA 平滑：_fpsAvg += (min(1/dt, 240) - _fpsAvg) * 0.05
每 1.0 s 评估一次：
  ├─ _fpsAvg < 48 且 _dpr > _dprMin  → _dpr = max(_dprMin, _dpr - 0.1)   立即生效
  ├─ _fpsAvg > 57                    → _recoverTimer++；连续 4 秒后 _dpr = min(cap, _dpr + 0.05)
  └─ 其它                             → _recoverTimer = 0（保持）
```

**参数的意义**：

| 参数 | 值 | 为什么 |
|---|---|---|
| 下降步长 | **0.1** | 视觉上约一次「轻微变糊」，玩家能感觉到但不刺眼 |
| 上升步长 | **0.05** | 比下降慢一半：宁可慢一点恢复，也不要恢复后立刻又掉下去 |
| 下降阈值 | 48 FPS | 留出余量。60 FPS 目标下，48 意味着还有 12 帧的抖动空间 |
| 上升阈值 | 57 FPS | 接近满帧才尝试恢复 |
| 恢复等待 | 连续 4 秒 > 57 FPS | 防止在「49↔60」的振荡区间来回调 |
| `_dprCap` | high 1.5 / medium 1.25 / low 0.9 | **高 DPI 屏的关键防线**。没有 cap，`dpr = 3` 意味着 9 倍像素 |
| `_dprMin` | low 0.55 / 其它 0.7 | 下限。低于 0.55 时画面糊到不可接受，宁可让帧率继续低 |

**注意这条轨道的物理含义**：调 `devicePixelRatio` 改变的是**像素填充量**，不改几何、不改材质、不改 draw call。所以它对「像素填充瓶颈」（核显、高 DPI、全屏后处理）非常有效，对「CPU 逻辑瓶颈」（ADR-002 那个 399 ms 的问题）**完全无效**。这个区分是理解双轨设计的前提。

### 2.3 两轨的分工

```
                  启动
                   │
        ┌──────────┴──────────┐
        │                     │
   软件渲染检测           正常环境
        │                     │
   _apply(2) 立即      _dpr = min(dpr, cap)
   预热 2.5s             │
        │           ┌─────┴─────┐
        └──► 轨道A ◄─┤ 轨道B（持续）│
              │      └───────────┘
         每 1.2s 采样          每 1.0s 评估 fpsAvg
         只降不升              双向可恢复
         改「功能开关」         改「分辨率」
         （后期/阴影/法线/IBL） （dpr 0.55–1.5）
```

---

## 3. 后果

### 3.1 正面

- **软件渲染环境能玩了**。`_detectSoftware()` 一次性预降两级，把「前 5 秒卡到关闭页面」变成「前 1 秒就进入能跑的状态」。这是本条 ADR 最有价值的产出。
- **高 DPI 屏不会自爆**。`_dprCap` 1.5（high）/1.25（medium）/0.9（low）把 `devicePixelRatio = 3` 的手机从「9 倍像素」压回「1.5 倍」。
- **不需要玩家理解画质设置**。全部自动，`?perf=low` / `?perf=off` 是给开发者排查用的，不是给玩家的。
- **降级顺序经过设计**，按「对观感影响小 → 大」排列：先关后期（很多人看不出少了 bloom）→ 关阴影（能看出，但可接受）→ 去法线/IBL（明显变平）→ 减粒子与远景（最后一步）。这比「一刀切低画质」的体验好得多。
- **有观测入口**：`?perfdebug=1` → `window.__perfFrame.level` 直接给出当前级别；`PerformanceGuard.getLevel()` 可在控制台随时查；降级时有一次性的 toast 提示。
- **`MAX_FRAME_DT` 截断 + `updates < 10` + `accumulator` 归零**这三道防线（`game.js:10685`、`10719`、`10720`）与守卫配合，防止「切后台回来」导致死亡螺旋。

### 3.2 负面

- **`_apply(3)` 的材质修改不可逆**。`performance_guard.js:82-92` 遍历整个场景把 `m.normalMap = null`、`m.envMapIntensity → 0.1`、`m.needsUpdate = true`。原引用被丢弃且**没有备份**。由于轨道 A「只降不升」，只有「重开一局 / 切图重建材质」才可能恢复。
  → **症状：玩到 3 级降级后，即使帧率恢复正常，画面也永久变平（法线细节消失），金属永久变塑料。**
  → 这是本条 ADR 最大的技术债。修法：备份引用（`m.userData._normalMapBak`），或在恢复路径上重新 `applyToMesh`。**待核实** `graphics_enhancement.upgradeEnvironmentMaterials()` 是否每次调用都重新赋 `normalMap`（若是，则切图能恢复；`overview.md` §9-#3）。
- **`setLowMode(false)` 不会恢复 IBL**。`render_pipeline.js:806-818` 的 `setLowMode(true)` 做了三件事：`_postEnabled = false`、`_bloomPass.enabled = false`、**`_scene.environment = null`**（关掉环境反射）。但 `setLowMode(false)` 只把 `_lowMode` 置 false、重建天空、再 `_applyQuality(true)`，**没有任何分支把 `_scene.environment` 设回去**。所以「低配模式恢复」只能拿回后期与阴影，金属物件仍然没有环境反射。这是同一类「不可逆降级」问题，和第下一条的 `normalMap` 是同一个根因（降级代码只写不读不做备份）。
- **降级是全局的、不可细粒度的**。无法「只降低远处敌人的精度」，只能「全部降低」。这是因为降级的实现是「遍历整个 scene 改材质」。
- **`_detectSoftware()` 依赖 `WEBGL_debug_renderer_info` 扩展**，该扩展在新版浏览器中可能被隐私策略限制（Firefox 有 `privacy.resistFingerprinting` 会返回通用字符串）。返回空字符串时正则不匹配 → 软件渲染环境不会被预降级，退化成纯采样路径（在 1 FPS 下需要 2.4 s 采两次才能降一级，共需约 10 s 才能到 4 级）。**这是当前的隐性失效路径。**
- **采样式降级有最小延迟**：预热 3.2 s + 2 次 × 1.2 s 采样 = **最短 5.6 s 后才会第一次降级**。在严重卡顿的环境里，玩家已经走了。
- **降级阈值用的是平均值，抓不住卡顿尖峰**。每 1.2 s 算一次 `frames / acc`，一次 300 ms 的长卡如果落在窗口内会被平均掉。真正伤体验的往往是尖峰而不是均值。
- **`PerformanceGuard.update()` 的签名是 `function update()`，但被调用时传了 `frameDt`**（`game.js:10802` 传 `PerformanceGuard.update(frameDt)`）。函数内部忽略参数、改用 `performance.now()` —— 这是**对的**（见 §2.1），但签名与调用不一致会让读者以为参数有效。属于代码卫生问题。

### 3.3 已发现的内部矛盾：两套控制器在互相拉扯

**这是本条 ADR 当前最需要决策的技术问题。**

轨道 A 在 1 级降级时把分辨率比例设为 0.85，2 级 0.75，3 级 0.65，4 级 0.55。这是通过 `RenderPipeline.setResolutionScale(scale)` 写入 `_dpr` 的。

但轨道 B（`_adaptResolution`）**仍然在运行**（`_dynamicRes` 未在降级时关闭），并且它的恢复逻辑是：

```js
} else if (_fpsAvg > 57) {
    _recoverTimer += 1;
    if (_recoverTimer >= 4 && _dpr < cap) {
        _dpr = Math.min(cap, _dpr + 0.05);   // ← 把守卫刚刚压下去的 _dpr 升回去
```

**冲突模式**：

1. 环境：核显，120 建筑的地图，`dpr` 起步 1.25。
2. 轨道 B 因 `fps < 48` 把 `_dpr` 一路降到 0.7（`_dprMin`）。
3. 轨道 A 因 `fps < 12` 触发 `_apply(3)` → `setResolutionScale(0.65)` → `_dpr = 0.65`，同时关掉 IBL/法线。→ 帧率回到 60。
4. 轨道 B 看到 `_fpsAvg > 57`，连续 4 秒后把 `_dpr` 从 0.65 升到 0.70、0.75… 一路升回 1.25（`cap`）。
5. 帧率再次掉到 12 → 但轨道 A 是**只降不升**的，已经 `_done = true`，不会再降。
6. 结果：**画面分辨率被升回到让帧率崩溃的水平，而守卫已经停止工作。** 玩家看到的是「先是低画质能玩，然后慢慢变清晰，然后卡死」。

这是一个**逻辑上真实存在的互相拉扯**，不是理论推测。判断依据：

- `_apply()` 里没有任何地方调用 `setDynamicResolution(false)` 或等价的「冻结轨道 B」操作。
- `update()` 里的停止条件只停自己的采样，不影响 `RenderPipeline._adaptResolution`（后者在 `render()` 内部被调用，`game.js:10808`）。
- 唯一会关掉轨道 B 的路径是 `GameSettings.getSettings().graphics.dynamicResolution === false`，而 `_apply` 在 `n >= 1` 时设的是 `g.dynamicResolution = true`（`performance_guard.js:61`）——**它主动打开了轨道 B**。

**建议的修法**（需拍板，见 §5）：

- **方案 i（最小改动）**：`_apply(n >= 1)` 时调用 `RenderPipeline.setDynamicResolution(false)`，由轨道 A 独占分辨率控制权。代价：失去「帧率恢复后自动变清晰」的体验。
- **方案 ii（推荐）**：在 `RenderPipeline` 里加一个「守卫写入的 dpr 下限」`_dprFloor`，`_adaptResolution` 的上升逻辑不能超过它；`setResolutionScale(v)` 同时设 `_dprFloor = v`。这样守卫压下去的分辨率不会被轨道 B 突破，但轨道 B 仍可在 `[floor, cap]` 内调整。
- **方案 iii（最彻底）**：合并成一个控制器，把「分辨率」和「功能开关」放在同一套分级里。代价：重构 `render_pipeline` 与 `performance_guard` 的边界，工作量最大。

---

## 4. 替代方案

### 方案 A：只做固定画质档位，让玩家自己在设置里选（否决）

- **做法**：三档（低/中/高），玩家手动选，默认中。
- **为什么否决**：玩家不会去改。软件渲染 1 FPS 的玩家在打开设置面板之前就已经关掉页面了。而且「中」档在核显和独显上的意义完全不同，玩家无从判断。

### 方案 B：只做连续分辨率自适应，不做离散降级（否决）

- **优点**：实现简单，单一控制器，不冲突。
- **为什么否决**：分辨率是**唯一能连续调的维度**，但它对「GPU 功能级瓶颈」无效。若玩家卡在「Bloom + 阴影 + 法线贴图 + IBL 同时开着」，把 dpr 从 1.25 压到 0.55 只能省掉约 80% 的像素填充，而后期处理的 pass 数量、阴影贴图的渲染、法线的采样开销都不变。**在低端机上分辨率降到 0.5 依然卡死**。
- **关键论据**：必须能**关掉功能**（后期/阴影/IBL/法线），而不只是降低精度。

### 方案 C：只做离散降级，不做连续分辨率（否决）

- **优点**：单一控制器，无冲突。降级是显式的、可观测的。
- **为什么否决**：离散分级会「跳变」。从 1.25 直接跳到 0.85 是肉眼可见的一次变糊，玩家会觉得游戏出问题了。而且它无法利用「帧率有余量时变清晰」这个免费收益——很多玩家的设备在 0.9 和 1.5 之间都能跑 60 FPS，为什么要固定给 0.9？

### 方案 D：用 `requestAnimationFrame` 的实际间隔做即时降级（不做预热与平滑）（否决）

- **为什么否决**：加载期、切图、切后台恢复都会产生单次长帧。无预热的即时降级会在**第一帧**就误判为严重卡顿，直接把软件渲染环境之外的所有玩家也拉进最低画质。

### 方案 E：基于「目标帧时间预算」的自适应（`dt > budget` 就降）（部分可行，未采纳）

- **做法**：设一个 16.67 ms 的预算，每帧超过就降一档，连续 N 帧低于预算就升一档。
- **优点**：响应快，直接绑定体验目标（帧时间而非帧率）。
- **为什么未采纳**：与现有的 EMA + 1 秒采样窗口语义重叠，改造收益不明确。但**这是一个比当前实现更好的方向**——尤其对「卡顿尖峰」问题（§3.2 最后一条）。若将来要重做，应优先考虑。
- **注意**：若改用帧时间预算，必须保留 `MAX_FRAME_DT` 截断，否则切后台回来会瞬间降到最低档。

### 方案 F：预生成多个候选画质配置，让玩家做 A/B 选择（否决）

- **为什么否决**：增加玩家的认知负担，且选项本身无法解释。这个方案在「玩家愿意花 30 秒调设置」的前提下才成立，而本项目的定位是「双击就玩」。

---

## 5. 需要拍板的决策

1. **两轨冲突（§3.3）必须修。** 三个方案里推荐 **方案 ii（`_dprFloor`）**：改动最小、行为最符合直觉、且保留了双轨的价值。需确认是否采纳。
2. **`_apply(3)` 的材质不可逆修改（§3.2 第一条）是否本轮修。** 若不修，需要至少在 `docs/architecture/debt.md` 里登记，并在 `performance_guard.js` 的注释里写清「3 级降级后法线细节永久丢失，需要重开一局恢复」，否则接手者会把它当成 bug 追一周。
3. **是否把 `_detectSoftware()` 升级为「软件渲染直接跳 4 级」而不是 2 级。** 当前是 `_apply(2)` + 缩短预热，在一个 1 FPS 的环境里仍需约 2.4–3.6 s 才能到 4 级。如果软件渲染环境是明确不支持的目标，直接跳 4 更诚实；如果希望「软渲染也能看到一点画质」，则保持现状。

---

## 6. 复核触发条件

1. **修了 §3.3 的两轨冲突** → 本文档 §2.3、§3.3 需重写。
2. **引入新的画质维度**（例如新的后期 pass、新的阴影模式）→ 必须同时更新 `_apply()` 的分级表和 `render_pipeline._applyQuality()`。
3. **收到「玩久了变糊/变卡」的报障** → 优先怀疑轨道 B 的恢复逻辑（§3.3）与 §3.2 的不可逆降级。
4. **收到「一开始就卡、5 秒后才好」的报障** → 说明采样预热 3.2 s + 2×1.2 s 的延迟太长，评估方案 E 或直接跳级。
5. **要上移动端** → `_detectSoftware()` 需要加移动端 GPU 识别；`_dprCap` 需要按设备类型分档；散热降频需要「帧率恢复后重新允许降级」的机制（当前 `_done = true` 是永久的）。

---

## 7. 给接手者的三条纪律

1. **降级只降不升是有意的，不要改成双向。** 双向会在临界点抖动，体验更差。要恢复就通过「重开一局 / 进设置改画质」这些显式的用户动作。
2. **任何降级动作都必须走 `RenderPipeline` 的公开接口**（`setLowMode` / `applyQuality` / `setResolutionScale`），不要直接 `renderer.setPixelRatio()`。注释里写明了原因：直接改会被下一次 `applyQuality` 覆盖。
3. **`frameDt` 给不了真实的帧率，永远用 `performance.now()`。** `CONFIG.MAX_FRAME_DT = 0.1` 会把低帧率截断成「看起来正常」，用 `frameDt` 算帧率等于把守卫的眼睛蒙上。这是代码注释里明确写了的一条，`performance_guard.js:135`。
