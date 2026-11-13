# 测试策略与质量门 —《战术突击》v4.3

- **文档状态**：草案 v1.0（待主理人与用户批准）
- **作者**：严守真（质量负责人 / QA Lead）
- **日期**：2026-11-13
- **适用代码基线**：`ddf204a`（game.js 10,837 行 / 23,058 行 JS 总量）
- **配套文件**：`tests/smoke-cases.md`（可复跑用例集）

---

## 0. 一句话策略

把「感觉能玩」变成「逐条可判定通过」。本文件定义**测什么、怎么判、留什么证据、什么时候拦人**；没有证据的验证一律视为未测。

**当前现实前提**：项目内零测试，历史验证全靠项目外临时脚本（`C:/Users/15142/.cache/wbtest/`，不随仓库走）。因此本策略的第一优先级不是「补齐覆盖率」，而是**把已经踩过的三个坑固化成会持续报警的探针**——因为这三类失效的共同特征是：**界面完全正常，没有任何报错**。

---

## 1. 质量对象：6 条不变量（Invariants）

所有门槛最终折算到这 6 条。用例不是随便写的，每条用例都是为了守住其中一条。

| ID | 不变量 | 违反后果 | 检测手段 |
|---|---|---|---|
| **INV-01** | 场景内容必须真实生成：道具、容器、敌人、撤离点数量落在合法区间 | 事故 1：所有程序化道具一件都没生成，玩家看到空场景 | 读 `mapEnvironmentGroup.userData.worldPropsPlaced` 长度 + 各实体数组长度 |
| **INV-02** | 材质按世界尺寸平铺，UV 跨度与几何尺寸成比例 | 事故 2：整条路面纹理被拉成条纹 / 300m 地面只采样一张贴图 | 直接遍历几何体 `attributes.uv` 求 min/max 跨度 |
| **INV-03** | 帧预算与场景规模解耦：单帧 JS ≤ 8ms，不随敌人数/障碍物数线性爆炸 | 事故 3：单帧 399ms、FPS 3，降画质完全无效 | 读 `window.__perfFrame.js`（需 `?perfdebug=1`） |
| **INV-04** | 失败必须可见：任何被 `catch` 吞掉的异常都要留下可查痕迹（warn / 计数 / 探针字段） | 静默降级——功能没了但没人知道，本项目的头号风险 | 控制台全量收集（**error + warning**）+ 模块就位断言 |
| **INV-05** | 三段循环状态机闭合：`lobby → playing → (backpack\|searching) → playing → gameover → lobby`，`S.phase` 不滞留 | 卡在背包/搜索里出不来，或关界面后鼠标锁回不来 | 断言 `S.phase` 每次界面开关前后取值 |
| **INV-06** | 控制台干净：启动到撤离 0 error、0 未预期 warning，404 必须点名 | 错误被噪声掩盖，真问题漏掉 | Playwright 捕获 `pageerror` + `console(type=error\|warning)` + `requestfailed` |

---

## 2. 测试分级（四层）

| 层级 | 代号 | 触发时机 | 覆盖面 | 时间预算 | 门控作用 | 自动化要求 |
|---|---|---|---|---|---|---|
| **冒烟** | L1 SMOKE | 每次改动（提交前自查、每次合并主干） | `smoke-cases.md` 全部 15 条（SMK-01…12 + REG-01…03） | ≤ 6 分钟（其中 headless 全自动部分 ≤ 90 秒） | **FAIL 即不得合并** | 15 条中 ≥ 12 条可全自动 |
| **回归** | L2 REGRESSION | 每冲刺末 / 每次拉发版分支 / 已关闭缺陷复验 | 冒烟全集 + 已关闭缺陷的回归用例 + 3 地图 × 2 模式（普通/硬核）组合 | ≤ 40 分钟 | P0/P1 未关闭 = FAIL | 逻辑层全自动，视觉层半自动 |
| **性能** | L3 PERF | 每周一次 + 发版前必跑 | 3 地图 × 默认/低画质 × 60s 采样；压力场景（14 敌人交战、空投、BOSS、满背包开界面） | ≤ 30 分钟 | 超预算 20% = CONCERNS，超 50% = FAIL | 全自动采集 + 人工判读（headless GPU 数字不作真机结论） |
| **平衡/体验** | L4 BALANCE / PLAYTEST | 里程碑 / 数值改动后 | 3 名新玩家 × 1 小时：TTK、经济曲线、撤离成功率、掉落价值分布、前 10 分钟体验 | 半天 | 仅 advisory，不阻塞合并 | 人工（结构化报告落 `production/playtests/`） |

**分级原则**

1. **越底层越便宜、越要全自动**：L1 必须是「一条命令、90 秒、零人工」，否则没人会跑。
2. **L1 覆盖三起历史事故**：事故对应的回归用例（REG-01…03）成本极低（一次 evaluate 断言），必须放进每次改动都跑的那一层，而不是躺在每冲刺的回归里。
3. **L3 不追求自动化判定**：headless + SwiftShader（软渲染）下的 fps 数字没有真机意义，只作为**相对基线**与 JS 耗时监测；真机 60fps/30fps 结论必须人工核显笔记实测一次。

---

## 3. 质量门与放行规则

### 3.1 判定定义

| 判定 | 含义 | 处置 |
|---|---|---|
| **PASS** | 该层全部必跑用例通过，无新增 P0/P1 缺陷 | 可以进入下一阶段 |
| **CONCERNS** | 有用例边缘失败 / 指标在预算内但趋势变差 / 存在已知但已记录的 P2 | 允许继续，但必须由用户书面确认「带着这些已知问题走」 |
| **FAIL** | 存在 P0/P1 未关闭，或任一必跑用例失败，或 INV-01…06 被违反 | 不放行；修复后重跑该层 |

### 3.2 各层具体阈值

| 层级 | PASS | CONCERNS | FAIL |
|---|---|---|---|
| L1 冒烟 | 15/15 通过，控制台 0 error / 0 warning（favicon 404 白名单） | ≥ 13 通过且失败项均为 P2/P3 | ≤ 12 通过，或任何 P0/P1，或 INV-01/02/03 破 |
| L2 回归 | 全部通过 + P0/P1 = 0 | P0/P1 = 0 但有 ≥1 个 P2 复现 | 存在 P0/P1，或同类缺陷二次复现 |
| L3 性能 | JS ≤ 8ms、render ≤ 16ms、draw call 不超基准 15% | 指标超基准 15–20%，或长帧数超预算但可玩 | 超基准 50%，或跌到 <30fps，或单帧 JS > 33ms |
| L4 平衡 | 结构化报告完成，主要指标有结论 | 指标达标但体验反馈差 | 核心循环不可理解 / 新玩家 10 分钟内无法撤离成功 |

### 3.3 门控性质（重要）

**分层门控性质（2026-11-13 主理人已拍板）：**

| 层级 | 性质 | 说明 |
|---|---|---|
| **L1 冒烟（15 条）** | **阻塞门** | `node tests/harness/smoke.mjs` 退出码 1 即不得合并；成本约 56s，已落地可跑 |
| L2 回归 / L4 平衡 | advisory | 给判定与证据，不阻塞合并 |
| L3 性能 | advisory（阈值超 50% 时转阻塞建议） | headless 数字不作真机结论 |

**除 L1 外，其余质量门为 advisory（建议性）。** 我的职责是给出判定、证据与风险清单；**最终放行由用户决定**。唯一例外是流程纪律：`FAIL` 的判定必须写进当日报告，不允许「口头放行、不记录」。

**发版签字 = 高影响动作，必须人工审批。** 我不会签署发版放行，只提交证据包 + 判定建议。

---

## 4. 缺陷分级 P0–P3

| 等级 | 定义 | 本项目真实例子 | 响应时限 | 修复时限 | 回归要求 |
|---|---|---|---|---|---|
| **P0 阻断** | 核心循环不可用 / 白屏 / 存档损坏 / 静默失败导致整块内容缺失 | 事故 1（全部程序化道具未生成）；事故 3（单帧 399ms，FPS 3 不可玩） | 15 分钟内响应 | 当日 | 必须补回归用例，并纳入 L1 |
| **P1 严重** | 主路径功能错误但可绕过；明显视觉错误影响可读性 | 事故 2（路面纹理拉成条纹）；换弹后弹药不扣、界面关不掉锁鼠标 | 4 小时 | 1 个工作日内 | 必须补回归用例 |
| **P2 一般** | 次要功能/视觉缺陷，不影响完成一局 | 图标异步加载使个别格子短暂空图标；道具与容器位置重叠（`propsRejects.overlap` 实测 20） | 1 个工作日 | 当前冲刺内 | 建议补 |
| **P3 轻微** | 文案、对齐、边缘情况、性能微退化 | 提示语错别字；偶发一次长帧 | 进待办池 | 按排期 | 不需要 |

**缺陷报告必含 5 段**：环境（浏览器/分辨率/是否 headless/URL 参数）→ 前置条件（地图/模式/装备）→ 复现步骤（可照做）→ 预期 / 实际 → 证据（截图 + 探针 JSON + 控制台）。缺任一段的缺陷单我直接打回。

**静默失败类缺陷一律加一级**：因为它跳过了所有既有防线，实际影响等于上一级。

---

## 5. 性能基线

### 5.1 预算表

| 指标 | 采集方式 | 目标（60fps） | 底线（30fps，可玩） | 备注 |
|---|---|---|---|---|
| 单帧总耗时 | `window.__perfFrame.total` | ≤ 16.6 ms | ≤ 33.3 ms | 需 `?perfdebug=1` |
| **单帧 JS 耗时** | `window.__perfFrame.js` | **≤ 8 ms** | ≤ 16 ms | 事故 3 时为 399 ms；这是**与画质无关**的部分，降画质救不了 → 硬指标 |
| 渲染耗时 | `window.__perfFrame.render` | ≤ 16 ms | ≤ 30 ms | 真机 GPU 才有意义；headless 为软渲染 |
| draw calls | `renderer.info.render.calls`（p50） | ≤ 600（整改目标） | ≤ 900（**>900 CONCERNS / >1200 FAIL**） | 实测 p50 1112，已超 900 线（见 §5.3） |
| program 数 | `renderer.info.programs.length` | 记录趋势 | 记录趋势 | 着色器编译是长帧常见来源，必须随 count 一起进证据 |
| 三角面 | `renderer.info.render.triangles` | ≤ 500k | ≤ 900k | 当前实测 370k（军事禁区） |
| 长帧 | 采样期内 `total > 100ms` 的次数 | ≤ 1 次 / 5 分钟 | ≤ 3 次 | 加载/切图期排除 |
| 堆内存 | `performance.memory.usedJSHeapSize` | ≤ 400 MB | ≤ 700 MB | 连开 3 局后测，观察泄漏 |
| 加载到可交互 | `loadingScreen` 消失到 `startGame` 可点 | ≤ 6 s | ≤ 12 s | 含 5 个加载阶段 |
| 单次场景重建 | `rebuildMapEnvironment` 耗时 | ≤ 400 ms | ≤ 800 ms | 切图/重开局时 |

### 5.2 测量纪律

1. **必须区分 js 与 render**。事故 3 的教训是：JS 399ms vs render 33ms，此时降分辨率/关后期**完全无效**。任何性能缺陷单必须附这两个数字，否则不可定位。
2. **必须声明是否触发降级**。同时记录 `PerformanceGuard.getLevel()`、`renderer.getPixelRatio()`、`GameSettings.getSettings().graphics.quality`。在 level≥3 且 resolutionScale 0.55 下测出的「可玩」，不代表默认画质可玩。
3. **`?perf=off` 下测得的性能数字一律作废**（该参数直接关闭性能守卫）。
4. **headless 数字只作相对基线**：SwiftShader 软渲染的 render 耗时不代表核显。

### 5.3 实测基线（2026-11-13，供后续对比）

环境：headless Chromium 1228 + `--use-angle=swiftshader`，1440×810，军事禁区，普通模式，进图静置 1.5s 后采样 8s（丢弃前 2s）。

| 指标 | 实测值 | 判定 |
|---|---|---|
| `__perfFrame.js` **p50** | **4.6 ms** | PASS（预算 8ms） |
| `__perfFrame.js` p90 / p99 | 10.5 / 42.1 ms | p90 PASS |
| 最大单帧 | js 156ms / render 304ms | 归因 render（软渲染），非 JS 退化 |
| draw calls p50 | **1112**（区间 1050–1150） | **CONCERNS（>900）** |
| triangles | 370,233 | PASS |
| 采样期降级 | level 2 → 3（dpr 0.55） | 结论仅作参考 |
| 控制台 | 0 error / 0 warning（仅 favicon 404） | PASS |

**三条结论**
1. **JS 侧健康**：p50 4.6ms 远低于 8ms 预算，事故③ 的解析几何 LOS 修复确实生效（当年单帧 399ms）。
2. **最大性能风险是 draw call 而非 JS**：1112 次绘制在核显上会比 JS 先崩，且体感仍是「降画质也没用」——与事故③ 给人的错觉同形。
3. **单点采样会骗人**：同一环境里 `__perfFrame` 单次读数可以是 3.9ms，也可以是 156ms。所以判定必须用 p50/p90，并对长帧做 js/render 归因。

## 6. 证据留存规范

### 6.1 目录与命名

```
tests/evidence/<YYYYMMDD-HHmmss>/          # 冒烟每次运行自动创建（harness 生成）
    run.json                               # 本批汇总（机器可读）
    <ID>.json                              # 单条用例：期望 / 实际 / 判定
    <ID>_<名称>.png                        # 截图
    console.log                            # error + warning 全量
    qa-snapshot.json                       # window.__qa 快照（未实现时给合成快照）

production/qa/evidence/<YYYY-MM-DD>-<批次>/  # 回归 / 发版证据包（人工归档）
```

命名规则：`<用例ID>_<PASS|FAIL|BLOCKED>_<浏览器>-<headless|desktop>_<宽x高>.<ext>`
- 截图：`.png`，必含 1 张全景 + 必要时 1 张局部
- 探针数据：`.probe.json`，**所有断言的实测值都要在里面对（不是只存 true/false）**
- 控制台：`.log`，**error 与 warning 全量**，不做过滤（404 单独归类）

### 6.2 `smoke-run.json` 最小字段

```json
{
  "runId": "2026-11-13-smoke-01",
  "commit": "ddf204a",
  "env": { "browser": "chromium-1228", "headless": true, "viewport": "1440x810",
           "url": "/index.html?perfdebug=1", "gpu": "swiftshader" },
  "cases": [ { "id": "SMK-01", "verdict": "PASS", "durationMs": 812, "probe": { } } ],
  "console": { "errors": 0, "warnings": 0, "httpFailures": ["favicon.ico(white-listed)"] },
  "perf": { "js": 3.9, "render": 16.9, "calls": 1050, "guardLevel": 4, "dpr": 0.55 },
  "verdict": "CONCERNS"
}
```

### 6.3 保留期

| 类型 | 保留期 | 理由 |
|---|---|---|
| 冒烟批次 | 30 天 | 覆盖「上周还好的」这类排查 |
| 回归 / 发版 / 缺陷修复证据 | **永久** | 缺陷追溯与「什么时候坏的」定位 |
| 性能采样 | 6 个月 | 趋势对比 |
| Playtest 报告 | 永久 | 设计决策依据 |

### 6.4 单条证据必须能回答三个问题

1. 判据是什么（哪条 INV / 哪个数值）
2. 实测是多少（数字，不是「正常」）
3. 在什么环境下（浏览器、分辨率、画质档、是否降级）

---

## 7. 「静默失败」专项

> 这是本项目付出过最高代价的一类缺陷：三起事故有两起是静默的，第三起（399ms）也被玩家当成「卡」而不是缺陷上报。以下机制专门对付它。

### 7.1 三起事故的共性解剖

| 事故 | 直接原因 | 为什么没被发现 | 通用教训 |
|---|---|---|---|
| ① 道具全灭 | `WorldProps` 引用 `let` 声明的 `containers`，初始化前访问触发 TDZ 异常 | 异常被 `rebuildMapEnvironment` 的 `try/catch` 捕获，**只 `console.warn`**，界面无异常 | **`catch` 里必须有可查痕迹 + 必须有内容量断言** |
| ② 路面条纹 | 盒体 UV 按「最长边」统一缩放；另一处 `scaleUVs` 收到几何体而非网格 | 无报错，只是「看起来糊/有条纹」 | **视觉缺陷也要有数值判据**（UV 跨度），不能只靠眼睛 |
| ③ 单帧 399ms | 敌人视线每帧对 `obstacles` 递归 `intersectObjects`（建筑上百窗户子网格） | 表现为「卡」，且降画质无效，容易被当作机器性能问题 | **必须分离 js 与 render 耗时**；必须有单帧耗时上限 |

### 7.2 检测三件套（每次冒烟必跑）

**A. 控制台全量收集——不只收 error**

```js
// 关键：warning 必须收，事故 ① 就是 warn
page.on('console', m => {
  if (m.type() === 'error' || m.type() === 'warning') log(m.type(), m.text());
});
page.on('pageerror', e => log('PAGEERROR', e.message));
page.on('requestfailed', r => log('REQFAIL', r.url()));
```

必查关键词（命中即 FAIL，按 P0/P1 处理）：

| 关键词 | 来源 | 含义 |
|---|---|---|
| `[WorldProps] 道具生成失败` | `game.js:1997` | 事故 ① 复发，道具整批静默丢失 |
| `Loading error` | `resource_loader.js:189` | 加载阶段失败，init 可能未跑全 |
| `PAGEERROR`（任何） | 浏览器 | 顶层异常 |
| `THREE.` + `Warning` | three.js | 材质/纹理/几何体用法错误 |
| `not a function` / `undefined is not` / `Cannot read` | 任何 | 模块未就位或接口变更 |

**B. 内容量不变量探针（防事故 ①）**

```js
// 任一为 0 或跌破下限即 FAIL —— 因为「能用但没内容」是本项目的标志性失效
{
  propsPlaced: (mapEnvironmentGroup.userData.worldPropsPlaced || []).length,  // 军事禁区实测 128，下限 100
  propsRejects: mapEnvironmentGroup.userData.worldPropsRejects,               // 必须存在且键齐全
  containers: containers.length,        // 实测 170，下限 100
  groundLoot: groundLootItems.length,   // 实测 17–26，下限 10
  enemies: enemies.length,              // 实测 14，下限 5
  extractPoints: extractPoints.length,  // 实测 8，下限 2
  obstacles: obstacles.length,          // 实测 373，下限 200
  pbrKinds: PBRTextures.kinds.filter(k => PBRTextures.ready(k)).length  // 实测 9，下限 8
}
```

**C. 模块就位断言（防「守卫把未加载当未启用」）**

本项目大量使用 `typeof X !== 'undefined'` 守卫做软依赖。**当脚本加载顺序变化时，这些守卫会把「模块还没加载」静默当成「功能未启用」** —— 表现是画面降级但零报错。

已确认的时序风险：`index.html` 中 `game.js` 在 **1415 行之前**被加载，而 `enemy_ai.js`、`animation_enhancement.js`、`settings.js`、`graphics_enhancement.js` 在其**之后**（1448–1451 行）；`game.js` 末尾通过 `ResourceLoader.startLoading()`（async + 微任务）回调 `init()`。若 `init()` 在后续脚本解析完成前执行，所有 `typeof` 守卫都会静默跳过。

因此必须断言「已初始化」，而不是「已定义」：

```js
{
  RenderPipeline:      RenderPipeline.isEnabled(),            // 默认 false，init 成功才 true
  GraphicsEnhancement: GraphicsEnhancement.isEnabled(),       // 默认 false，init 成功才 true
  GameSettings:        typeof GameSettings.getSettings() === 'object',
  EnemyAI:             typeof EnemyAI !== 'undefined',
  PerformanceGuard:    PerformanceGuard.getLevel() >= 0,
  waterMeshes:         GraphicsEnhancement.getWaterMeshes().length   // 实测 6，为 0 说明 init 被跳过
}
```

`GraphicsEnhancement.isEnabled()` 与 `RenderPipeline.isEnabled()` 默认都是 `false`，**是现成的「静默失败指示灯」**，成本一次调用，价值极高。

### 7.3 已知高危静默点清单（需长期盯）

| 位置 | 风险 | 探针 |
|---|---|---|
| `game.js:1994-1998` `try { WorldProps.apply(...) } catch { console.warn }` | 事故 ① 现场：内容整批丢失只留一条 warn | `propsPlaced` 长度 + warn 关键词 |
| `world_props.js:630` 注释：游戏 `containers` 是 `let`，初始化前访问会 TDZ；现改为读 `FIXED_CONTAINERS` 并**遮蔽同名变量** | TDZ 已绕开，但道具避让使用的是「固定容器表」而非真实生成的 170 个容器 → 可能出现道具与容器重叠 | `propsRejects.overlap`（实测 20）；视觉抽检 |
| `pbr_textures.js:526` `if (geo.userData._pbrUV) return;` 一次性锁 | 顺序依赖：先到者固化 UV 参数，后到的参数被**静默丢弃**（与事故② 同源）。**当前实测结果正确**（地面 UV 跨度 54.55 === 300/5.5），属**观察项**而非缺陷 | 直接读几何体 UV 跨度（REG-02），改 tile 参数后尤其要看 |
| `animation_enhancement.js:329` `onPlayerHit()` 里 `InspectViewer.close()`；`inspect_viewer.js` 另有 ESC / 关闭按钮 / 点遮罩三条关闭路径 | **不是缺陷，是设计**：受伤时自动收检视器（避免看模型被打死）。但它会让「检视器用例」在交火地图里约 1/4 概率被打断——这是**测试隔离问题**，不是产品问题 | SMK-08 先 `parkEnemiesAway()` 把敌人挪到 240m 外，并断言「观察期间血量未变」，再判检视器 |
| `game.js` 中 21 处 `catch`，其中 8 处为空 `catch(e){}` | 静默降级 | 控制台 + 行为断言 |
| `performance_guard.js` 各 `_apply` 内 `catch (e) {}` | 降级失败无声 | 读 `getLevel()` 与 dpr 是否真的变化 |
| `ResourceLoader` 的 `setTimeout(resolve, 1000/1500)` 超时兜底 | 资源没加载完也继续，界面看似正常 | 资源计数断言 + `requestfailed` |

### 7.4 「未初始化」与「未启用」的区分方法

对每个软依赖模块，冒烟断言必须落在**运行时状态**上：

- ✅ `GraphicsEnhancement.isEnabled() === true`
- ❌ `typeof GraphicsEnhancement !== 'undefined'`（只证明脚本被解析）

**建议（需工程侧配合，我不改产品代码）**：在 `init()` 末尾挂一个只读诊断对象 `window.__qa = { bootedAt, modules: {...}, content: {...}, exec: {...} }`，并让 8 处空 `catch` 至少写入 `window.__qa.swallowed.push({where, msg})`。这样「静默」这个物种就从系统里消失了。在未接入前，本策略用投影探针（§7.2 B/C）替代，已可覆盖三起事故。

### 7.5 `window.__qa` 诊断契约（已批准，由工程侧实现，QA 只定义与断言）

**目的**：把「静默」变成「有计数器」。三起事故里有两次是因为「事情没做成，但系统没有任何地方记录」。

**接口定义（只读，纯数据，不参与游戏逻辑）**

```js
window.__qa = {
  version: '1.0',
  bootedAt: 1730000000000,          // init() 完成时刻（performance.now()）
  build: { commit: 'ddf204a', url: location.search },

  // 1) 模块就位：区分「未加载」与「未启用」
  modules: {
    RenderPipeline:      { loaded: true, enabled: true },
    GraphicsEnhancement: { loaded: true, enabled: true, waterMeshes: 6 },
    GameSettings:        { loaded: true, ready: true },
    EnemyAI:             { loaded: true },
    PerformanceGuard:    { loaded: true, level: 2 },
    PBRTextures:         { loaded: true, ready: ['grass','asphalt',/* … */] },
    WorldProps:          { loaded: true, placed: 128, rejects: { bounds: 72, building: 64 } }
  },

  // 2) 内容量：INV-01 的直接来源（事故① 的报警器）
  content: {
    map: '军事禁区', mapSize: 300,
    containers: 170, enemies: 14, groundLoot: 26, extractPoints: 8, obstacles: 374,
    propsPlaced: 128, sceneChildren: 350
  },

  // 3) 被吞掉的异常：每一条空 catch 都要在这里留一行（事故① 的根因消除）
  swallowed: [
    // { where: 'game.js:1996 WorldProps.apply', msg: 'Cannot access containers before initialization', t: 1234.5 }
  ],

  // 4) 一次性工作耗时：加载/建图/材质升级的耗时，用于解释长帧
  exec: { rebuildMapEnvironmentMs: 412, upgradeMaterialsMs: 890, worldPropsApplyMs: 96 }
};
```

**写入时机（快照点）**

| 时机 | 更新字段 |
|---|---|
| `init()` 末尾（一次） | `bootedAt`、`modules.*.loaded`、`modules.*.enabled` |
| 每次 `startGame()` 完成后 | `content.*`、`exec.rebuildMapEnvironmentMs` |
| 每次进入 `catch` | `swallowed.push({where, msg, t})`（最多保留 50 条，防无限增长） |

**harness 读取方式**：`cases.mjs` 的 SMK-01 / REG-01 优先读 `window.__qa`；字段缺失时自动回退到现有全局投影（`composedFallback`），所以**接口没实现也不影响门控**，只是少了归因信息。每次运行的 `qa-snapshot.json` 会记录 `source: "window.__qa" | "composed-fallback"`。

**验收（工程侧交付时我按这三条验）**
1. 断网/无存档冷启动后，`__qa.bootedAt` 有值且 `modules` 12 项齐全。
2. 故意在 `WorldProps.apply` 里 throw，`__qa.swallowed` 必须出现一条且含 `where`；同时 SMK-12 关键词仍能命中。
3. `__qa` 不得被游戏逻辑读取或修改（`rg '__qa' game.js` 只应出现在写入点与注释）。

---

## 8. 执行环境与测试工具链

### 8.1 基线环境（判定以此为准）

| 项 | 值 |
|---|---|
| 目标浏览器 | 桌面 Chrome / Edge 最新稳定版 |
| 主测分辨率 | 1440×810（另测 1920×1080 一次） |
| 目标硬件 | 核显笔记本（Intel Iris Xe 级）→ 60fps；低端/软件渲染 → 30fps 可玩 |
| 运行方式 | 双击 `index.html`（`file://`）或本地静态服务；**两路都要测**，因为 `file://` 下 fetch/XHR 行为不同 |
| 真机手测频率 | 每周 ≥ 1 次，必须人工（headless 数字不作结论） |

### 8.2 自动化执行方式（已落地）

harness 已在 `tests/harness/` 落地并跑通，**零项目外依赖**：

```
tests/
  strategy.md
  smoke-cases.md
  harness/
    package.json        # playwright-core（装在 tests/harness/node_modules，随仓库走）
    server.mjs          # 自包含静态服务（MIME 表 + 缺失资源点名，不再静默 404）
    browser.mjs         # Chromium 解析 / 启动 / console|pageerror|requestfailed|dialog 捕获
    probes.mjs          # 所有 page.evaluate 片段（单一真相源）
    cases.mjs           # 15 条用例（SMK-01…12 + REG-01…03）
    smoke.mjs           # 运行器：顺序、单例 45s 超时、证据、汇总、退出码
    README.md
    tools/
      map-baseline.mjs  # 三图内容量基线采集（维护阈值用）
      perf-trace.mjs    # 逐帧 JS 耗时追踪 + js/render 归因
  evidence/<YYYYMMDD-HHmmss>/   # 每次运行自动生成（gitignore）
```

```bash
cd tests/harness && npm install
node smoke.mjs                      # 全量，约 56s
node smoke.mjs --only=SMK-03        # 单条
node smoke.mjs --headful            # 有头观察
```

- **退出码即门控**：`0` 无 FAIL / `1` 有 FAIL / `2` 环境起不来（`2` 必须与 `1` 区分，否则环境问题会被误判成功能缺陷）
- 浏览器：`QA_CHROME` → `%LOCALAPPDATA%/ms-playwright/chromium-*` → 系统 Chrome/Edge；启动参数固定带 `--use-angle=swiftshader --enable-unsafe-swiftshader`
- 失败输出形如 `SMK-03 换弹结束 isReloading：期望 false，实际 true`，不做只有汇总的黑箱
- 页面里的 `alert()` 统一 `dialog.dismiss()` 并计入 `console.log`，否则自动化会挂死
- 单用例 45s 硬超时：一条卡住不拖死整轮

### 8.3 与历史临时脚本的关系（已完成迁移与归档）

| 历史脚本 | 处置 |
|---|---|
| `final_check.js` | 已固化：其核心循环（射击/换弹/切枪/拾取/检视/换图/背包）成为 SMK-03…10 的主干 |
| `perfdbg.js` | 已固化：`__perfFrame` + 降级档位 + dpr/分辨率的采样写法进入 SMK-11 / REG-03 |
| 我的三合一探针 | 已成为 `probes.mjs` 的 `probeBoot` / `probeContent` / `probeGroundUV` |
| `check2..check10.js`、`shadow1-6`、`texprobe`、`raycheck` 等 40+ 个 | **归档不迁移**；结论已并入用例（UV / 阴影 / 材质 / 射线部分），代码无复用价值 |

**迁移后仍然依赖项目外路径的只剩一件事**：Chromium 二进制缓存在 `%LOCALAPPDATA%/ms-playwright`。这是浏览器本体，不属于测试资产；换机时用 `QA_CHROME` 指向任意 Chrome 即可。

## 9. 追溯与流程纪律

1. **缺陷 ↔ 用例双向绑定**：每个 P0/P1 缺陷必须有唯一「回归用例 ID」；修复 PR 必须附 FAIL→PASS 的证据对（同一用例、同一环境、前后各一份）。
2. **用例 ID 不复用**：废弃用例标 `deprecated` 并保留正文（历史判据有价值）。
3. **判定以数字为准**：「运行正常」「看起来没问题」不是判定。每条用例的预期结果必须是可读出的数字、状态字符串或布尔。
4. **flaky 隔离**：同一用例在相同环境下 3 次运行结果不一致 → 标 `FLAKY`，从门控移入观察区，**不得**用重跑三次取多数来掩盖。已知易 flaky 点：图标异步就绪（实测 12 个里只有 4 个就绪）、素材揭示动画（`setTimeout` 链）、性能采样（首帧长帧）。
5. **每次冒烟必须记录 commit**，否则证据不可追溯。

---

## 10. 责任边界

| 事项 | 我（QA） | 说明 |
|---|---|---|
| 测试策略、用例、门控判定、证据评审、Playtest | ✅ 负责 | 本文件与 `smoke-cases.md` |
| 测试代码、探针脚本、harness | ✅ 负责 | 不改产品代码 |
| 产品代码修复 | ❌ | 交程基岩（工程负责人） |
| 数值平衡结论 | ⚠️ 只做数据分析 | 改动交文策渊（设计负责人） |
| 视觉质量判据 | ⚠️ 定可量化阈值 | 主观审美交 Art Director |
| 发版放行 | ❌ 只给建议 | 用户签字 |

---

## 附录 A：可直接读取的探针字段（免改代码）

> 均为全局作用域（classic script 顶层 `let`/`const`，可从 `page.evaluate` 直接按名访问），实测全部可用。

| 字段 / 接口 | 含义 | 用于 |
|---|---|---|
| `S.phase` | 当前阶段 `login/lobby/playing/backpack/searching/gameover` | INV-05 |
| `S.weaponSlots` / `S.magAmmo` / `S.currentWeapon` | 武器与弹匣 | SMK-03/04 |
| `S.lootValue` / `S._lootItems` | 本局物资价值与清单 | SMK-06/11 |
| `S.containersSearched` | 已搜容器数 | SMK-08 |
| `mapEnvironmentGroup.userData.worldPropsPlaced / worldPropsRejects` | 道具布点记录与拒绝原因 | INV-01 / REG-01 |
| `containers` / `enemies` / `groundLootItems` / `extractPoints` / `obstacles` | 各实体数组 | INV-01 |
| `renderer.info.render.calls / triangles` | 绘制统计 | INV-03 / L3 |
| `window.__perfFrame`（需 `?perfdebug=1`） | `{js, render, total, calls, level}` | INV-03 |
| `PerformanceGuard.getLevel()` / `renderer.getPixelRatio()` | 降级档位 / 分辨率缩放 | L3 判定前提 |
| `RenderPipeline.isEnabled()` / `GraphicsEnhancement.isEnabled()` | 后处理与增强是否真正启用 | INV-04 |
| `GraphicsEnhancement.getWaterMeshes()` | 水面网格 | INV-04 |
| `PBRTextures.kinds` / `PBRTextures.ready(kind)` | PBR 套件就绪 | SMK-01 |
| `ItemIcons.request(id)` / `InspectViewer.isOpen()` / `InspectViewer.open(id)` | 图标与 3D 检视器 | SMK-07/09 |
| `WeaponADS.startAim() / stopAim() / getAimProgress()` | 开镜进度 0→1 | SMK-05 |
| `WeaponFX.isReady()` | 武器特效 | SMK-03 |
| `GameSettings.getSettings().graphics` | 画质设置 | L3 |

## 附录 B：本策略暂未覆盖（已知盲区，逐步补）

1. **存档 / `localStorage` 迁移与损坏恢复**（`savePersistent` / `getSaveKey`）——数据丢失属 P0，但目前无用例。
2. **音频**：音效正确性无法自动判定，只能断言 `AudioEngine` 存在 + 无异常。
3. **7 种 BOSS 全流程**：仅覆盖「能生成、能交战」，未覆盖各 BOSS 阶段转换与掉落。
4. **254 件自定义收集品**：3D 模型/图标只做抽样（当前抽 12 个图标，实测 4 个及时就绪）。
5. **`file://` 直开路径**：现有脚本全部走 HTTP，双击打开这一真实用户路径未自动覆盖。
6. **多标签页 / 存档并发**。
7. **移动端与触屏**（不在当前平台基线内，明确排除）。
