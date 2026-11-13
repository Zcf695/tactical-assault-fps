# tests/harness — L1 冒烟测试执行器

自包含的冒烟测试 harness：**不依赖** `C:/Users/15142/.cache/wbtest` 之类项目外临时目录。
静态服务、浏览器启动、控制台捕获、证据落盘、退出码门控全部内置。

## 一行命令

```bash
cd tests/harness
npm install            # 首次：装 playwright-core（浏览器请见下方「浏览器」）
node smoke.mjs         # 跑全部 15 条
```

或从项目根目录：

```bash
node tests/harness/smoke.mjs
```

## 退出码（可直接用于 CI / 合并门控）

| 码 | 含义 | 处置 |
|---|---|---|
| `0` | 没有 FAIL（可能带 CONCERNS） | 允许合并 |
| `1` | 有用例 FAIL | 阻止合并，查看失败明细 |
| `2` | 环境起不来（服务/浏览器/游戏未 boot） | 修环境，**不要**当成功能缺陷 |

`CONCERNS` 不计入失败（advisory），但会在汇总里单独列出——按 `tests/strategy.md` 的定义，它需要记录而非阻塞。

## 参数

```bash
node smoke.mjs --headful              # 有头运行，观察用
node smoke.mjs --only=SMK-03          # 只跑一条
node smoke.mjs --only=SMK-02,SMK-11   # 跑多条第
node smoke.mjs --only=SMK-05 --fault-inject=SMK-05   # 门控自检：强制失败，验证退出码变 1
```

> `--fault-inject` 是给「测试的测试」用的：改完 harness 或 CI 接线后，用它确认**失败真的会让流水线红**，而不是只有打印。

## 浏览器

优先使用已下载的 ms-playwright 缓存（`chromium-1228`）。也可显式指定：

```bash
QA_CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" node smoke.mjs
```

解析顺序：`QA_CHROME` → `%LOCALAPPDATA%/ms-playwright/chromium-*` → 系统 Chrome / Edge。
启动参数固定带 `--use-angle=swiftshader --enable-unsafe-swiftshader`（软渲染，保证 CI 里可跑）。

## 证据

每次运行写到 `tests/evidence/<YYYYMMDD-HHmmss>/`：

| 文件 | 内容 |
|---|---|
| `run.json` | 本次汇总（环境、逐条判定、耗时、缺失资源、perf 快照） |
| `<ID>.json` | 单条用例的全部断言：**期望值 / 实际值 / 判定** |
| `<ID>_<名称>.png` | 截图（开局、开镜、背包、搜索、检视、结算等） |
| `console.log` | 控制台 error + warning 全量（含时间戳、页面 alert、请求失败） |
| `qa-snapshot.json` | `window.__qa` 快照；契约未实现时给出 `composedFallback` 合成快照 |

`tests/evidence/` 已进 `.gitignore`（运行产物不入库，发版证据按需归档到 `production/qa/evidence/`）。

## 文件结构

```
tests/harness/
  package.json     依赖与脚本入口
  server.mjs       静态服务（MIME 表 + 缺失资源点名，不再静默 404）
  browser.mjs      Chromium 解析/启动 + console|pageerror|requestfailed|dialog 捕获
  probes.mjs       所有 page.evaluate 片段的单一真相源（页面侧的「仪表」）
  cases.mjs        15 条用例（SMK-01…12 + REG-01…03），与 tests/smoke-cases.md 对齐
  smoke.mjs        运行器：顺序、超时、证据、汇总、退出码
  tools/
    map-baseline.mjs     三张地图内容量基线采集（维护用例阈值用）
    perf-trace.mjs       逐帧 JS 耗时追踪（定位单帧尖峰归因，事故③ 的排查方法）
    file-protocol-check.mjs  file:// 双击直开路径实测（P0，见 strategy.md §8.5）
```

## 两条环境纪律（不写下来，三个月后一定有人拿 SwiftShader 的数字当验收依据）

1. **性能用例要求独占机器。** 有别的进程抢 CPU 时，采样帧数会掉到预期的 20%（实测 12/70），
   此时 `run.json` 的 `perf.starved` 会标出来，相关断言自动降级为 CONCERNS。**换空闲机器重跑。**
2. **headless 的 render 数字不代表核显。** 60fps/30fps 只能人工采样：记录 GPU 型号 + 分辨率 + dpr + 三图各 30 秒均值。
   而且同一台机器上 `js` 会抖 5–10 倍（军事 12→7.2 / 森林 24.9→44.4 / 港口 5.1→56.7），**帧耗时只做同次运行内的相对比较**。

## 维护约定

1. **断言只写数字/状态/布尔**，不写「正常」。新增用例先想清楚「什么数字算通过」。
2. **页面侧取值一律走 `probes.mjs`**，不要在 `cases.mjs` 里散落 `page.evaluate`。
3. **阈值调整必须留来源**：`MAP_FLOOR` 的数字来自 `tools/map-baseline.mjs` 实测 ×0.8。
4. **用例 ID 不复用**；废弃标 `deprecated` 保留正文。
5. **flaky 不靠重跑掩盖**：同一用例同环境 3 次结果不一致 → 标 FLAKY 并记进 `smoke-cases.md` 的「已知易 flaky 点」。

## 已知 flaky

- `SMK-08 3D 检视器`：**不是产品缺陷**。`animation_enhancement.js:329` 的 `onPlayerHit()` 会在玩家受伤时按设计关闭检视器，测试地图里 14 个敌人随机开火，导致约 1/4 概率被打断。用例已先 `parkEnemiesAway()` 把敌人挪到 240m 外，并断言「观察期间血量未变」。若这道隔离失效（例如后续把敌人改成瞬移追人），「是否需要重试」那条断言会先变成 CONCERNS 报警。
- 性能类用例（SMK-11 / REG-03）在软渲染下出现 render 侧长帧（300–750ms）时会连带抬高 JS 采样，判定已按「js/render 归因」拆分，避免误报成 JS 退化。

## 最近一次运行

```
总计 18 条：PASS 15 / CONCERNS 2 / FAIL 1   耗时 144.0s   退出码 1（预期内的红）
FAIL    ：SMK-14 降级置空 424 个材质的 normalMap（已裁定禁止，见 strategy.md §7.4.5）
          —— 修法在 performance_guard.js:91（改 normalScale 折半），测试不等代码
CONCERNS：SMK-11 draw call 1043（阶段一阈值 >900）
          FILE-01 file:// 下 enemyModels 0 个 / 14 个占位体（designPending：内联模型修法中）
```

> **`FILE-01` 与 `SMK-14` 都需要第二个浏览器页面/会话，合计约 65s**。日常提交建议只跑快线：
> `node smoke.mjs --only=SMK-01,SMK-02,REG-01,REG-02,SMK-03`（约 25s，覆盖启动 + 三起事故 + 核心战斗）。

> **门是红的，而且应该红。** 不要为了变绿把 SMK-14 改回 CONCERNS——那是把「已知缺陷」改成「已知但不报」。
> 如果只想验证别的东西：`node smoke.mjs --only=SMK-01,SMK-02,REG-01` 或临时 `--only` 跳过 SMK-14。

> 性能用例内置**采样饥饿检测**：若采样帧数不足预期的 40%（机器被别的进程占满时可以复现），
> 相关断言降级为 CONCERNS 而不是 FAIL —— 环境噪声不能当成产品退化报出去。
> 此时请换一台空闲机器重跑，`run.json` 里的 `perf.starved` 会标出来。
