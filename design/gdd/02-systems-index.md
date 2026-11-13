# 《战术突击》系统清单与依赖索引

| 项目 | 内容 |
|------|------|
| 文档版本 | v1.0（Phase 2 补课产物） |
| 用途 | 系统全览 + 依赖拓扑 + 实现状态逐项裁定 + 缺口登记 |
| 配套文档 | `01-pillars.md`（为什么）、`03-core-loop.md`（节奏）、`systems/GDD-0X-*.md`（怎么做） |
| 状态图例 | ✅ 已实现（可验收） · 🟡 部分实现（有代码但不满足设计意图） · ❌ 未实现 |

> **⚠️ 行号引用约定（锚点制）**：本文所有 `game.js:NNNN` 行号写于 **10,837 行版本**，此后代码已迭代（当前 10,998 行）**行号已漂移，不可依赖**。
> 检索代码时请优先用**函数名**（如 `createEnemy()`）或**特征串**（如 `CONTAINER_TYPES.safe.items`），行号仅作辅助。
> 本文不做全量行号返工，改为**下次因具体工单碰到该处时顺手修正**。最新且经过核对的行号以 `04-balance-fixes.md` 为准。

> **本表的核心价值**：项目历史上出过「所有程序化道具一件都没生成」这类事故，根因是**没有一张「什么算做完」的清单**。本表的最后一列「一句话验收标准」就是那张清单，每条都必须能被人在浏览器里点出来判定。

---

## 1. 系统总览表

优先级定义：**P0** = 缺失则核心循环断裂 · **P1** = 缺失则体验塌陷 · **P2** = 打磨项 · **P3** = 明确不做

| # | 系统 | 状态 | 依赖 | 优先级 | 一句话验收标准 |
|---|------|------|------|--------|----------------|
| S01 | 账号与存档 | ✅ | — | P0 | 登录两个不同用户名，各自仓库内容互不污染；刷新浏览器后仓库与资金不变 |
| S02 | 地图与场景构建 | ✅ | S01 | P0 | 在大厅切换 3 张地图各进一局，每局的主题色、建筑布局、撤离点坐标均不同 |
| S03 | 玩家控制与移动 | ✅ | S02 | P0 | WASD/跳/蹲/冲刺/体力条全部生效；体力耗尽后冲刺无效并进入 1.5s 恢复惩罚 |
| S04 | 战斗（枪械） | ✅ | S03 | P0 | 38 把武器均可开火；同口径后坐力一致；爆头伤害 = 基础 ×2.5 |
| S05 | 护甲与受伤 | 🟡 | S04 | P0 | 穿 VI 级甲与裸装受同一次攻击，掉血量差 ≥50%；护甲耐久归零后自动卸下 |
| S06 | 敌人 AI | 🟡 | S02/S04 | P0 | 单局 AI 数量 = 14（常规）/24（高危）；AI 能巡逻、发现、追击、开枪 |
| S07 | 搜刮 | ✅ | S02/S13 | P0 | 打开保险箱，物品逐件揭示；史诗件揭示耗时 2.0s，传说 3.0s，终极 4.0s |
| S08 | 背包与仓储 | 🟡 | S01/S07 | P0 | 6×4 以下物品可拖拽旋转放置；格满时拾取弹提示且物品不消失；仓库升级后格数增加 |
| S09 | 负重 | 🟡 | S08 | P1 | 超重时拾取被拦截并提示当前重量/上限；负重等级升级后上限提升 |
| S10 | 经济（商店/买卖） | 🟡 | S01/S08 | P0 | 买入扣款、卖出回收 85%；钱不足买入被拦截；仓库满时买入被拦截 |
| S11 | 撤离 | ✅ | S02/S03 | P0 | 站进绿圈按 F，进度条 8 秒后结算为「撤离成功」；中途走出圈进度归零 |
| S12 | 死亡与结算 | ✅ | S05/S11 | P0 | 阵亡后安全箱内物品出现在仓库，背包内物品消失 |
| S13 | 物品与掉落数据 | ✅ | — | P0 | 随机开 10 个保险箱，每箱 1–3 件，件件可在 `ITEMS` 中查到 |
| S14 | 收集品与 3D 检视 | 🟡 | S13 | P1 | 库存单击任意收集品弹出 3D 检视器，可拖拽旋转、滚轮缩放 |
| S15 | BOSS | 🟡 | S06 | P1 | 在 3 张图各接一次 BOSS 任务点，分别触发 3 个不同 BOSS，每个 BOSS 血量到 65%/35% 时换阶段 |
| S16 | 技能树 | ✅ | S01 | P1 | 花 15 点可点出终极技能；点之前终极技能按钮禁用 |
| S17 | 任务（日常/周常） | 🟡 | S01 | P1 | 搜索容器后，日常「搜索容器」任务进度 +1 |
| S18 | 成就 | ✅ | S01 | P2 | 首次击杀后「首次击杀」成就弹窗；大厅可领取奖励 |
| S19 | 等级与经验 | ✅ | S01 | P1 | 撤离成功获得 `50 + 物资价值×0.1` XP；每 1000 XP 升 1 级并 +₵5000 +1 技能点 |
| S20 | UI / HUD | ✅ | S03/S04 | P0 | 血量/护甲/体力/弹药/倒计时/小地图/全图/指南针 全部实时刷新且不互相覆盖 |
| S21 | 设置与按键 | ✅ | — | P1 | 可改键、可调 FOV 65–100、X/Y 灵敏度独立倍率，改动立即生效 |
| S22 | 音频 | ✅ | S04/S07 | P1 | 枪声/换弹/脚步/命中/揭示音效按事件触发；稀有度揭示音按白蓝/紫/金/红分档 |
| S23 | 性能治理 | 🟡 | 全局 | P1 | 帧率持续偏低时自动依次降级；`?perf=low` 强制最低档；`?perfdebug=1` 可读帧耗时 |
| S24 | 空投事件 | ✅ | S02/S13 | P2 | 开局 60–120s 后首次空投，之后周期触发，空投可搜索 |
| S25 | 钥匙房 | 🟡 | S07 | P2 | 持蓝色钥匙卡可开蓝色钥匙房，开一次消耗 1 次使用次数（共 10 次） |
| S26 | 天气系统 | ❌ | S02 | P3 | — |
| S27 | 社交（组队/交易/公会） | ❌ | 需后端 | P3 | — |
| S28 | 剧情叙事 | ❌ | — | P3 | — |
| S29 | 载具 | ❌ | — | P3 | — |

---

## 2. 依赖拓扑排序

### 2.1 依赖关系图

```
Tier 0（无依赖）
  ├── S01 账号与存档
  ├── S13 物品与掉落数据
  └── S21 设置与按键

Tier 1（仅依赖 Tier 0）
  ├── S02 地图与场景构建   ← S01
  ├── S08 背包与仓储       ← S01, S07*
  └── S10 经济             ← S01, S08

Tier 2（依赖 Tier 1）
  ├── S03 玩家控制与移动   ← S02
  ├── S07 搜刮             ← S02, S13
  ├── S16 技能树           ← S01
  ├── S17 任务             ← S01
  ├── S18 成就             ← S01
  └── S19 等级与经验       ← S01

Tier 3（依赖 Tier 2）
  ├── S04 战斗（枪械）     ← S03
  ├── S09 负重             ← S08
  ├── S14 收集品与检视     ← S13
  ├── S11 撤离             ← S02, S03
  ├── S24 空投             ← S02, S13
  └── S25 钥匙房           ← S07

Tier 4（依赖 Tier 3）
  ├── S05 护甲与受伤       ← S04
  ├── S06 敌人 AI          ← S02, S04
  └── S12 死亡与结算       ← S05, S11

Tier 5（依赖 Tier 4）
  ├── S15 BOSS             ← S06
  ├── S20 UI / HUD         ← S03, S04（横切，实际贯穿 Tier 2–5）
  ├── S22 音频             ← S04, S07（横切）
  └── S23 性能治理         ← 全局（横切）

Tier 6（明确不做）
  └── S26 天气 / S27 社交 / S28 叙事 / S29 载具
```

\* S08 与 S07 存在**循环依赖**：搜刮需要容器网格（S08 的 `initGrid`/`placeInGrid`），背包需要容纳搜刮产物。实际代码中网格算法（`game.js:849-1047`）是纯工具层，被两者共用。**裁定：将网格算法抽为 S08 的底层子模块 `grid-core`，置于 Tier 0，解除循环。**

### 2.2 拓扑排序结果（可执行顺序）

| 序 | 系统 | 说明 |
|----|------|------|
| 1 | grid-core（网格算法，S08 子模块） | `game.js:849-1047`，已稳定 |
| 2 | S13 物品与掉落数据 | 全项目数据基座 |
| 3 | S01 账号与存档 | 持久化基座 |
| 4 | S21 设置与按键 | 无依赖 |
| 5 | S02 地图与场景构建 | |
| 6 | S08 背包与仓储 | |
| 7 | S10 经济 | 依赖仓储做空间校验 |
| 8 | S03 玩家控制与移动 | |
| 9 | S07 搜刮 | |
| 10 | S16 技能树 / S17 任务 / S18 成就 / S19 等级 | 四条并列，均只依赖存档 |
| 11 | S04 战斗 | |
| 12 | S09 负重 / S11 撤离 / S14 检视 / S24 空投 / S25 钥匙房 | 五条并列 |
| 13 | S05 护甲与受伤 | |
| 14 | S06 敌人 AI | |
| 15 | S12 死亡与结算 | |
| 16 | S15 BOSS | |
| 17 | S20 HUD / S22 音频 / S23 性能 | 横切层，随时可插 |

> **排序含义**：任一系统的缺口，**修复顺序必须遵循此表**。例如不能先修 S15 BOSS 的触发问题（第 16 位）而不修 S06 AI 的密度问题（第 14 位）——BOSS 是在 AI 框架上跑的。

---

## 3. 逐系统状态裁定

> 每条给出：实现证据（文件:行）· 缺什么 · 状态变更条件。
> 「未在代码中确认」= 我读过相关模块但没找到对应实现，不应假定存在。

### S01 账号与存档 — ✅

- **证据**：`game.js:1459-1560` 登录/注册；`game.js:1564-1613` 存档读写；存档键 `tactical_assault_<username>`（`game.js:1457`）
- **已覆盖字段**：money / stashItems / mailItems / stats / missions / xp / keychain / keyUses / weightLevel / stashLevel / upgradeProgress / weaponDurability / loadouts / achievements / skillPoints / skills（`game.js:1592-1610`）
- **缺口**
  - 🟡 用户名即密码，无校验、无加密。单人本地场景可接受，但**同名覆盖**风险存在。
  - 🟡 存档版本号 `_version: 6` 已写但**无迁移逻辑**——只有 `clearLegacy()` 清除 v2/v3 键（`game.js:1619-1627`）。版本升级时字段缺失靠 `|| default` 兜底，无结构性迁移。
  - ❌ 无导出/导入存档，玩家换机器即丢档。
- **验收判定**：见 §1 表格。

### S02 地图与场景构建 — ✅

- **证据**：`map/military_base.js`（550 行）、`forest_outpost.js`（380）、`industrial_port.js`（354）；`loadMapData`（`game.js:1058`）；`rebuildMapEnvironment`（`game.js:1989`）
- **实测规模**

| 地图 | 建筑 | 容器 | 高危容器 | 地面物资点 | 高危物资点 | 撤离点 | 水域 |
|------|------|------|----------|-----------|-----------|--------|------|
| 军事禁区 | 145 | 170 | 26 | 52 | 20 | 8 | 3 |
| 密林前哨 | 113 | 86 | 26 | 34 | 26 | 8 | 未在代码中确认 |
| 工业港 | 113 | 78 | 20 | 30 | 20 | 8 | 未在代码中确认 |

- **缺口**
  - 🟡 **地图数据自带 `containerCount: {normal:200,hard:260}` 等字段但代码从不读取**——`spawnContainers()`（`game.js:4836`）只用 `FIXED_CONTAINERS` 数组。这些字段是死数据，会误导后续维护者以为容器数量可调。
  - 🟡 三张图容器数量差异巨大（170 / 86 / 78），但撤离点都是 8 个、局时长都是 20 分钟。**工业港的容器密度只有军事禁区的 46%**，同局时长下收益期望显著偏低，构成**地图间不平衡**。
  - 🟡 `map/*.js.bak` 三个旧版（mapSize 180）残留在仓库中，未被加载但存在误用风险。
- **状态维持条件**：上述容器数量差异需在 Phase 3 平衡阶段处理，否则不应视为「已平衡」。

### S03 玩家控制与移动 — ✅

- **证据**：`updatePlayer`（`game.js:2417-2608`）；`CONFIG.playerSpeed=8`、`sprintMultiplier=1.65`、`crouchSpeedMultiplier=0.45`、体力 100/耗 30 每秒/回 18 每秒/耗尽惩罚 1.5s（`game.js:24-35`）
- **缺口**：🟡 骨折状态声称「移动速度降低 40%」（`game.js:2738`），需在 `updatePlayer` 中确认该减速确实被施加（**未在代码中逐行确认乘算位置**）。

### S04 战斗（枪械）— ✅

- **证据**：`shoot()`（`game.js:2794-2921`）；`WEAPONS` 38 条（`game.js:68-114`）；后坐力分档（`game.js:117-123`）；`raycastObstacles`（`game.js:4681`）
- **关键数值**（详见 `systems/GDD-02-combat.md`）
  - 爆头 ×2.5（`game.js:2889`）
  - 武器耐久每发 -0.05%，耐久 <30 时卡壳概率 `(30-dur)×0.005`（`game.js:2846`、`2836`）
  - 开枪惊动 35m 内敌人（`game.js:2920`）
  - 近战射线 2.5m（`game.js:2806`），但武器表 `range` 字段写 2–3（`game.js:109-113`）——**两处不一致，实际以 2.5 为准**
- **缺口**
  - 🟡 投掷物（`fragGrenade`/`smokeGrenade`/`flashbang`/`molotov`，`game.js:255-258`）在 `ITEMS` 中有条目，但**玩家侧投掷逻辑未在代码中确认**——只有敌人手雷（`EnemyAI.updateGrenades`，`game.js:3365`）。玩家的 `G` 键被绑定为「用医疗包」（README:81），投掷物无绑定键。
  - 🟡 `stimInjector`（兴奋剂，`game.js:252`）类型为 `'stim'`，`useItem()` 中无 `case 'stim'` 分支（`game.js:2768-2789`）——**该物品拾取后无法使用**。

### S05 护甲与受伤 — 🟡

- **证据**：`damagePlayer`（`game.js:2635-2699`）；`getArmorMitigation`（`game.js:2624`）；流血/骨折（`game.js:2688-2697`、`2702-2716`）
- **缺口**
  - 🟡 **头盔与护甲减伤逻辑存在双重计算疑点**：`maxTier` 取护甲/头盔较高者做整体 DR + 固定减伤（`game.js:2638-2647`），随后头盔再按自身 tier 做百分比吸收（`game.js:2649-2659`），护甲再按自身 tier 吸收（`game.js:2661-2671`）。即 **T6 头盔 + T6 甲时，固定减伤 10 点会先扣一次，然后头盔吸收 60%、护甲吸收 80%**。叠加后实际减伤可能超过设计意图，需数值验证。
  - 🟡 流血触发：`amt>8 && random < min(0.6, amt*0.03)`。当 `amt=300` 时必定触发（`min(0.6, 9)=0.6`）。**高伤害必定流血**，是否为本意未在代码中确认。
  - 🟡 `amount` 字段语义混淆：护甲/头盔的 `amount` 同时被当作「护甲 HP」（`game.js:9939-9941`）和「医疗品的治疗量」（`useItem` 中 `def.amount`，`game.js:2770`）。两个语义共用一个字段名，新增物品时极易出错。

### S06 敌人 AI — 🟡

- **证据**：`createEnemy`（`game.js:3259-3334`）；`enemy_ai.js`（588 行）；`updateEnemies`（`game.js:3336-3404`）
- **关键数值**
  - HP = `45 + level×15` → L1=60 / L2=75 / L3=90
  - 伤害 L1=7 / L2=10 / L3=14；高危模式 ×1.5（`game.js:3301-3311`）
  - 速度 L1=4 / L2=4.5 / L3=5；高危 ×1.25
  - 等级分布 常规：12% L2 / 88% L1。高危：40% L3 / 25% L2 / 35% L1
- **缺口（本系统问题最多）**
  - 🔴 **D-01 敌人生成上限与地图声明严重脱节**：地图声明 `enemyCount: {normal:50, hard:75}`（`military_base.js:11`），`spawnEnemies` 按此循环 50 次（`game.js:3257`），但 `createEnemy` 在 `enemies.length >= CONFIG.maxEnemies`（14）时直接 return（`game.js:3261-3262`）。**结果：常规模式实际只有 14 个 AI，高危 24 个。**
  - 🔴 **D-02 高危模式增援永远不触发**：增援条件 `remaining = S.enemiesTotal - S.enemiesSpawned`（`game.js:7112`）。`S.enemiesTotal=50`，`S.enemiesSpawned` 在循环中被 14 次成功创建后停在 14 → `remaining=36 > 0`，但 `enemies.length < maxE` 仅在被击杀后成立，此时 `toSpawn = min(min(4,36), 24-len)` 可以触发。**结论：增援在「杀了人之后」才会来，但永远等不到 50 只的规模。** 需实测确认行为是否符合预期。
  - 🟡 敌人等级分布中 `elv = Math.random() < 0.12 ? 2 : 1`（`game.js:3280`）——**常规模式最高只有 L2**，L3 敌人（RobotExpressive 模型、HP 90、伤害 14）仅在高危模式出现。
  - 🟡 `S.currentMapType` 在 `selectMap` 中赋值（`game.js:7698-7701`），但 `startGame` **不重新调用 `loadMapData()`**。若玩家在大厅切图后再切回，`MAP_DATA` 与 `CONFIG` 可能不同步（**需实测**）。

### S07 搜刮 — ✅

- **证据**：`startSearchAnimation`/`updateSearchAnimation`（`game.js:5188-5234`）；`startItemReveal`（`game.js:5343`）；`openSearch`（`game.js:5321`）；`CONTAINER_TYPES`（`game.js:436-460`）
- **关键数值**：见 `systems/GDD-01-search.md` 完整数值表
- **缺口**
  - 🟡 `searchTime` 与逐件揭示时长是**两套独立计时**。开箱前有 `searchTime`（0.8–3.0s）的进度条，开箱后每件物品再各自揭示（0.5–5.0s）。一个保险箱（2.5s + 最多 3 件 × 4s）**最长可达 14.5 秒**。这是否符合设计意图需确认。
  - 🟡 `container.searched` 标记与 `_revealed` 数组分离。已搜过的容器再次打开，`searched` 已为 true 不再计 XP（`game.js:5325`），但 `_revealed` 状态会被保留并跳过揭示动画（`game.js:5334-5340`）——**行为正确，逻辑分散在两处**。

### S08 背包与仓储 — 🟡

- **证据**：网格核心 `canPlaceInGrid`/`placeInGrid`/`removeFromGrid`/`findFreeSlot`/`initGrid`（`game.js:849-923`）；拖拽 `onDragStart`/`onDropOnCell`（`game.js:997-1047`）；仓库渲染 `renderStashGrid`（`game.js:9628`）
- **缺口**
  - 🔴 **D-27 物品旋转未实现**：`canPlaceInGrid` 严格用 `def.w/h` 原值（`game.js:849-861`），条目结构 `{id,col,row}` 不存朝向，全库无旋转函数。README:43 的「tetris-style」表述不成立——只有矩形装箱，没有 Tetris。
  - 🔴 **D-28 撤离时口袋与胸挂物品消失**：`endGame(true)` 迁移了武器/装备/背包/安全箱（`game.js:10037-10040`），**未迁移 `S.pockets` 与 `S._rigItems`**，随后二者被清空（`game.js:10049`）。玩家放在口袋/胸挂里的战利品在成功撤离后凭空消失。
  - 🟡 **D-03 无背包时背包尺寸 0×0**：`S.backpack = initGrid(1)` 且 `backpackCols=0`（`game.js:1662-1664`）。`CONFIG.BACKPACK_COLS=6 / BACKPACK_ROWS=4`（`game.js:38`）是**死配置**，从不使用。玩家不带背包进图时**没有任何物资存放空间**，只能靠安全箱 9 格 + 口袋 5 格。这是设计意图还是缺陷需确认。
  - 🟡 **D-13（已修正定性）胸挂 `slots` 实际生效，但 `maxPockets` 有一行无效代码**：`takeSearchItem` 中胸挂容量被正确读取并使用（`var rigSlots = S.equipment.chestRig ? ITEMS[S.equipment.chestRig].slots : 0;`，`game.js:5978`，独立数组 `S._rigItems`）。问题在 `startGame` 的 `if(S.equipment.chestRig){const cd=ITEMS[S.equipment.chestRig];if(cd)S.maxPockets=5;}`（`game.js:9942`）——**读了 `cd` 却把 `maxPockets` 硬赋 5**，这行是死代码，会让维护者误以为胸挂扩展的是口袋数。建议删除或改为 `S.maxPockets = 5`（无条件）。
  - 🔴 **D-26 点击拾取完全绕过负重校验**：`takeSearchItem()`（`game.js:5916-6007`）全函数**无任何 `getTotalCarryWeight` 调用**。负重检查只存在于三条拖拽落点处理器（`game.js:8800`、`9099`、`9269`）。因此「单击物品自动入包」这条主路径可以无限超载，只有玩家手动拖拽时才受 70kg 限制。**S09 负重系统在主路径上形同虚设。**
  - 🟡 `S.maxWeight` 在 `applySkillEffects()` 中被设为 `70 + 技能加成`（`game.js:4567`），但拾取校验用的是 `getMaxWeight()`（负重等级查表 `WEIGHT_LEVELS`，`game.js:47`）。**两套负重上限并存，`S.maxWeight` 是死值。**

### S09 负重 — 🟡

- **证据**：`getItemWeight`（`game.js:49-58`）、`getMaxWeight`（`game.js:47`）、拾取校验（`game.js:8800`、`9099`、`9269`）
- **缺口**
  - 🔴 **D-26 主拾取路径完全绕过负重**：`takeSearchItem()`（`game.js:5916-6007`）无 `getTotalCarryWeight` 调用，负重只在拖拽落点校验（`game.js:8800/9099/9269`）。玩家单机「点击拾取」可无限超载。
  - 🟡 重量公式 `w*h*0.3`，武器 +0.8，弹药 `w*h*0.1`，护甲/头盔 +0.5。一个 3×3 红藏品（`red_painting`）= 9×0.3 = **2.7kg**，一把步枪 `rifle_item`（3×1）= 0.9+0.8 = **1.7kg**。**一幅蒙娜丽莎比一把步枪重，但只重 1kg**。数值合理性存疑。更严重的是**所有 1×1 物品恒为 0.3kg**，导致价值密度（₵/kg）极端分化：非洲之星 ₵51,550,000/kg，而 3×3 青铜巨像仅 ₵815,000/kg。**最优策略永远是只捡 1×1，背包的形状设计被重量公式短路。**
  - 🟡 只有「拾取时拦截」，**局内移动不受负重影响**（无超重减速）。负重系统实际是「背包容量 2.0」，不是「负重」。
  - 🟡 两套负重上限并存：`S.maxWeight`（`70 + 技能加成`，`game.js:4567`）与 `getMaxWeight()`（负重等级查表，`game.js:47`）。实际校验只用后者，前者是死值（D-14）。

### S10 经济 — 🟡

- **证据**：`SHOP_PRICES`（`game.js:463-532`）；`buyItem`/`sellItem`（`game.js:6923-6949`）；`renderShopTab`（`game.js:9783`）
- **覆盖度实测（已核实，非缺陷）**：`SHOP_PRICES` 字面 139 条，但收集品在初始化时被动态补价（`game.js:606-609` 红藏品、`game.js:631-634` 白蓝紫金），运行时 **322 / 322 = 100% 覆盖**，无未定价物品。§早期版本的 D-04「商店品类覆盖不全」经复核**不成立，已撤销**。
- **缺口**
  - 🟡 回收率固定 85%，无任何动态定价。规划文档（`游戏机制与内容丰富计划.md:542-558`）描述的 6 种回收机制中，只有「商店购买」与「死亡损失」存在；维修存在（`repairWeapon`，`game.js:2943`，₵500/1% 耐久）。
  - 🟡 价格量级失衡（详见 `03-core-loop.md` §5.4）：全套顶级配装（VI甲+VI盔+伽马包+重胸挂+重机枪+反器材+步枪）合计 **₵6,400,000**，而单局期望收益 ₵3M–₵12M。**约 1–2 局即可买齐顶级装备。**
  - 🟡 价格分布极宽：最便宜 ₵1,000（腰包），中位 ₵350,000，最贵 ₵15,465,000（非洲之星）。中位数与单局收益（₵3M+）差一个数量级，意味着**任意单件物品都在玩家可支配范围内**。
  - 🟡 **无通胀来源也无回收压力**——单机环境下货币只增不减（死亡只损失物品不损失钱），长期必然通胀至无意义。这是单机化的必然结果，建议在文档中承认而非「修复」。

### S11 撤离 — ✅

- **证据**：`spawnExtractPoints`（`game.js:6791-6815`）；`updateExtractPointTimers`（`game.js:6837-6850`）；`checkExtractZone`（`game.js:6868`）；`updateExtract`（`game.js:6898-6918`）
- **缺口**
  - 🟡 撤离点的 `desc` 字段含条件描述（如「需要紫色钥匙卡」「需要船只」，`military_base.js:307-308`），但 **`checkExtractZone` 只检查 `isOpen`，不检查钥匙卡/船只**（`game.js:6872`）。即：描述是装饰，实际全部无条件可撤。
  - 🟡 撤离点初始 60% 概率开启（`game.js:6806`）。8 个点里期望 4.8 个开启（长期占空比约 67%，期望 5.4 个）。极端全关概率 0.4⁸ = 0.066%，且最长只需等 90 秒（`game.js:6810`）——**不构成死锁**，但存在「无事可做地干等」的体验低谷。
  - 🔴 **D-30 出生点即撤离点**：三张图的 `playerSpawn` 与某个 `extracts` 坐标几乎重合（军事 10m / 密林 5m / 工业港 5m）。玩家开局 1 秒内即可站进撤离圈，8 秒完成撤离。**撤离不构成任何空间成本**，搜打撤的核心张力消失。详见 `03-core-loop.md` §3.3 与 `systems/GDD-04-extraction.md` §4.3。

### S12 死亡与结算 — ✅

- **证据**：`endGame`（`game.js:9981-10074`）
- **缺口**
  - 🔴 **D-05 撤离成功时装备被复制而非移动**：`endGame(true)` 中先 `stashOrMail()` 存入装备与背包物品（`game.js:10037-10040`），再清空 `S.equipment`/`S.backpack`（`game.js:10046-10049`）。但因武器是**按 `weaponSlots` 里的 key 反查 `ITEMS`**（`game.js:10037`），若玩家携带的是同一武器的不同实例（如两把耐久不同的 AK），**耐久信息丢失**——`P.weaponDurability` 是全局按武器 key 存的（`game.js:2846`），所有同名武器共享耐久。
  - 🟡 阵亡分支不返还任何带入装备，但**不扣除资金**。高危模式的 20 万入场费在 `startGame` 已扣（`game.js:9893`），阵亡不退。逻辑正确。
  - 🔴 **D-28 撤离不迁移口袋与胸挂**：`endGame(true)` 只迁移武器/装备/背包/安全箱（`game.js:10037-10040`），未迁移 `S.pockets` / `S._rigItems`，随后清空（`game.js:10049`）。**成功撤离后口袋与胸挂里的物品消失。**
    受影响范围需精确：自动拾取时收藏品（`type:'valuable'`）会跳过口袋/胸挂（`game.js:5962-5992`），所以**大红藏品不会自动进这里**。但 (a) 医疗品、弹药、投掷物会；(b) 玩家**手动拖拽**时 `canItemFitZone` 允许任意非装备类物品进入 pocket/rig（`game.js:8746-8756`），收藏品也可以。因此这是「弹药药品必丢 + 玩家手动放的贵重品也会丢」。
  - 🔴 **D-32 超时等同阵亡**：`updateTimer` 中 `remain<=0 → endGame(false)`（`game.js:7098`），与 HP 归零走同一分支。**没有「弃包保命」的中间结局**，抹掉了「差一点就撤出去」的情绪。
  - 🟡 结算界面只显示收益（`renderResultLoot`，`game.js:10076-10090`），**阵亡时不显示损失清单**。这是搜打撤最重要的情绪反馈缺失。

### S13 物品与掉落数据 — ✅

- **证据**：`ITEMS`（`game.js:127-311`，139 条）；`CONTAINER_TYPES` 掉落池（`game.js:436-460`）；三套 config 合并（`game.js:592-667`）
- **缺口**
  - 🟡 **红色收集品 100% 注入 safe 与 premiumBox**（`game.js:613-614`）：`CONTAINER_TYPES.safe.items.concat(_rcIds)` 把全部 93 件红藏品追加进池。加上原有的 28 件，保险箱池约 **121 项，其中 93 项价值 ≥45 万**。配合 `safe` 的 `min:1,max:3`，**每个保险箱都有约 77% 概率掉出红藏品**。这是严重的经济失衡（见 D-06）。
  - 🟡 三套配置合并没有去重机制，若某 id 在 `collectibles_config` 与 `red_collectibles_config` 中重复，后者会静默覆盖前者。

### S14 收集品与 3D 检视 — 🟡

- **证据**：`inspect_viewer.js`；`item_models.js`；`item_icons.js`；点击代理（`game.js:556-590`）
- **缺口**
  - 🔴 **D-07 收集品数量与 README 不符**：实际 183 件（`collectibles_config.js` 90 + `red_collectibles_config.js` 93），README:53 声称「254 件」。
  - 🔴 **D-08 检视器无「说明」文本**：README:50 称显示「估值与说明」，但 `ITEMS` 条目只有 `name/value/icon/rarity/w/h`，**无 description 字段**。检视器只能展示名称与估值。
  - 🟡 `itemIcon()` 的三级回退（`_id`+`ItemIcons` → `img` → emoji，`game.js:536-551`）逻辑正确，但 `ItemIcons.prewarm` 只预热前 45 个（`game.js:677`），其余首次打开背包时逐个离屏渲染，**大量新物品首次打开背包会掉帧**。

### S15 BOSS — 🟡

- **证据**：`boss_system_v2.js`（1,279 行）；`boss_system_v2_extensions.js`（1,228 行）；`spawnBossTaskPoints`/`acceptBossTask`（`game.js:3886-3991`）
- **缺口**
  - 🔴 **D-02b 5 个 BOSS 中有 2 个永不可达**：`acceptBossTask` 只映射 3 种（`forest`→forest_hunter、`industrial`→industrial_juggernaut、`military`→military_commander，`game.js:3967-3969`）。**`port_colossus`（港口巨像·深渊）与 `forest_shaman`（密林祭司·毒藤）配置完整但无任何触发路径。**
  - 🔴 **D-09 BOSS 任务点数量恒为 1**：`var count = S.isHardMode ? 2 : 1;`（`game.js:3888`），但 **`S.isHardMode` 在全代码库中从未被赋值**（只有 `S.mode` 存在）。因此恒为 1，且不会抛错。
  - 🟡 BOSS 需玩家主动走到红色光柱按 F 才生成（`checkNearbyBossTaskPoints`，`game.js:3931`），无小地图标记指引。发现成本高。
  - 🟡 旧 `BOSS_TYPES`（3 个：森林猎手 800HP / 工业铁卫 1200HP / 军事指挥官 1800HP，`game.js:3569-3585`）作为 `BossSystemV2` 未加载时的降级路径存在，但两套 BOSS 数值完全不同（V2 的 forest_hunter 是 1200HP，`boss_system_v2.js:41`）。**同一 BOSS 名字有两个 HP 值。**

### S16 技能树 — ✅

- **证据**：`SKILL_TREES`（`game.js:4433-4473`）；`getTotalSkillEffect`（`game.js:4516`）；`applySkillEffects`（`game.js:4558`）；`skill_tree_ui.js`
- **缺口**
  - 🟡 **D-10 负重技能无效**：`survival_5` 效果 `maxWeight: 10`（`game.js:4456`）写进 `S.maxWeight`（`game.js:4567`），但实际校验用 `getMaxWeight()`（读 `WEIGHT_LEVELS`）。**该技能点满 3 级共 30kg 加成，完全无效果。**
  - 🟡 同类问题：`backpackSlots` 通过 `getEffectiveBackpackCols()` 暴露（`game.js:4584`），但需确认该函数在背包渲染链路上被调用（**未在代码中确认调用点**）。
  - 🟡 技能点仅来自升级（`game.js:4318`），无重置功能。

### S17 任务 — 🟡

- **证据**：`MISSION_POOL`（`game.js:7950-7968`）；`trackMission`（`game.js:7983`）；`claimMissionReward`（`game.js:8025`）
- **缺口**
  - 🔴 **D-11 任务奖励领取跳过升级检查**：`claimMissionReward` 直接 `P.xp += reward.xp`（`game.js:8030`），**不走 `gainXP()`**。因此不会触发升级、不发技能点、不弹升级提示。日常 100XP / 周常 500XP / 阵营 2000XP 的经验**全部石沉大海**。
  - 🟡 `trackMission` 第一行有 `if (S.phase !== 'playing' || !P.missions) return;`（`game.js:7988`），但 `endGame` 里的 `trackMission('survive_time', survived)`（`game.js:10017`）在 `S.phase` 已变为 `'gameover'` 之后调用（`game.js:9985`）。**存活时间任务永远不推进。**
  - 🟡 任务刷新依赖 `Date.now()` 与 `P.dailyRefresh`，无时区处理，无「今日已刷新」提示。

### S18 成就 — ✅

- **证据**：`ACHIEVEMENTS`（`game.js:4351-4374`）；`trackAchievement`（`game.js:4391`）；`claimAchievement`（`game.js:4421`）
- **缺口**：🟡 与 S17 同类问题——`claimAchievement` 用 `gainXP()`（`game.js:4426`），**这条是对的**；但 `initAchievements` 的 `if (!P.achievements)` 分支（`game.js:4377`）与后续 for 循环重复，属冗余。

### S19 等级与经验 — ✅

- **证据**：`XP_PER_LEVEL=1000`（`game.js:4292`）；`gainXP`（`game.js:4307`）；`getPlayerLevel`（`game.js:4294`）
- **缺口**
  - 🔴 **D-31 等级曲线断裂**：`XP_PER_LEVEL = 1000`（`game.js:4292`），但撤离 XP = `50 + floor(lootValue × 0.1)`（`game.js:10031`）。单局 `lootValue` 量级为 ₵3M–₵12M，故撤离 XP ≈ 300,000–1,200,000。**一次成功撤离即可从 1 级跳到数百级。** 而 18 个技能满点只需 54 点，仓库/负重满级只需 7 级。等级系统、技能树、成就的等级分支在首局后全部失效。
  - 🟡 `gainXP` 的升级处理只执行一次（`if(newLevel > oldLevel)` 只 +₵5,000 +1 技能点，`game.js:4314-4322`），跳级不会补发中间等级的奖励。无论哪种解释，曲线都不成立。
  - 🟡 等级无上限，`getPlayerLevel` 永远递增。
  - 🟡 `gainXP` 每次调用都 `savePersistent()`（`game.js:4329`）。搜索每个容器都调一次（`game.js:5223`），**一局搜 50 个容器 = 50 次全量 localStorage 写入**。性能隐患。

### S20 UI / HUD — ✅

- **证据**：`index.html:1188-1400`；`updateHUD`（`game.js:6952`）；`PerfManager`（`perf_manager.js`）；全图 `drawFullMap`（`game.js:7477`）
- **已实现元素**：血量/护甲/体力三条 + 弹药/弹匣 + 倒计时 + 小地图 + 全图 + 指南针 + 击杀播报 + 连杀 + 战利品追踪 + 等级条 + 撤离提示 + 各类事件提示
- **缺口**
  - 🟡 `updateHUD` 每帧调用（在 `animate` 中），依赖 `PerfManager` 做去重。`damagePlayer` 里也直接调 `updateHUD()`（`game.js:2679`），存在重复调用。
  - 🟡 **无「失败后差距提示」**：结算界面只显示击杀/时长/搜索数/价值（`game.js:10067-10071`），不显示「你的背包里还有什么没带出去」。这是搜打撤品类的重要情绪点，本作缺失。

### S21 设置与按键 — ✅

- **证据**：`settings.js`（507 行）；键位绑定 `keyBindings`（`settings.js:10`）；FOV 65–100（`settings.js:199`）；灵敏度基础 + X/Y 独立倍率（`settings.js:249-257`）
- **缺口**
  - 🟡 **无障碍支持缺失**：无字幕、无色盲模式、无界面缩放、无音效/语音分离的响度标准化。规划文档 `design/accessibility-requirements.md` **不存在**（目录为空），本项目从未建立无障碍基线。
  - 🟡 无「恢复默认设置」的二次确认，误操作成本高。

### S22 音频 — ✅

- **证据**：`audio_engine.js`；`playTone`/`playNoise`/`sfxShoot`/`sfxHit`/`sfxHeadshot`/`sfxReload`/`sfxPickup`/`sfxSearchStart`/`sfxExtractTick`/`sfxExtractComplete`/`sfxFootstep`/`sfxKillEnemy`/`sfxPlayerDeath`（`game.js:745-830`）；稀有度音效四档（`game.js:696-703`）
- **缺口**：🟡 全部为程序化合成 + 4 个 MP3，无 BGM（BOSS 战音乐在 `boss_system_v2.js:20-26` 有 mp3 映射，但需确认文件存在）。

### S23 性能治理 — 🟡

- **证据**：`performance_guard.js`；`perf_manager.js`；`?perf=low` / `?perf=off` / `?perfdebug=1`（README:143-149）；`window.__perfFrame`（README:147）
- **缺口**
  - 🔴 **D-12 无性能基线数据**：README 声称「敌人视线改为解析几何检测（单帧 JS 从 ~400ms 降到 ~10ms）」，但**仓库中无任何性能测试记录、无 benchmark 脚本、无目标帧率断言**。`tests/` 目录需确认内容。
  - 🟡 自适应降级有 4 级，但**降级后不记录、不上报、不在 HUD 提示**。玩家不知道画面为什么变糊。
  - 🟡 `CONFIG.mapSize` 从 110 变成 300（9 倍面积）后，**敌人数量没变（14）**，但渲染对象数量随地图规模线性增长。性能假设需要重新验证。

### S24 空投事件 — ✅

- **证据**：`updateAirdrops`（`game.js:4035`）；`triggerAirdrop`（`game.js:4069`）；`searchAirdrop`（`game.js:4162`）；首投 `60+rand*60` 秒（`game.js:9958`）
- **缺口**：🟡 空投间隔 `airdropTimer` 的重置逻辑需确认是否有上限（避免一局内无限刷）。

### S25 钥匙房 — 🟡

- **证据**：`initKeyBuildings`（`game.js:5057`）；`tryUnlockKeyBuilding`（`game.js:5110`）；`spawnKeyBuildingContainers`（`game.js:5150`）；钥匙链 4 格 10 次使用（`game.js:1654-1655`）
- **缺口**：🟡 只有 `military_base.js` 的建筑带 `keyType` 字段（如 `military_base.js:87`）。另两张图的钥匙房**未在代码中确认**。

### S26–S29 明确不做

| 系统 | 判定依据 |
|------|----------|
| S26 天气 | 代码零实现；引入需重做光照/雾/粒子管线，与「零安装」目标冲突 |
| S27 社交 | 需后端，违反支柱四 |
| S28 叙事 | 代码零实现；建议以「收集品档案」最小替代（见 01-pillars §7 A-03） |
| S29 载具 | 零实现；需载具物理，与 `WORLD_POLISH` 静态合批架构冲突 |

---

## 4. 缺口清单（按严重度排序）

### 🔴 阻断级（必须修，否则核心体验不成立）

| ID | 系统 | 问题 | 定位 | 修复方向 |
|----|------|------|------|----------|
| D-01 | S06 | 地图声明 50/75 敌人，实际 14/24 上限；300×300 地图只有 14 个 AI，搜刮全程零压力 | `game.js:21-22` vs `military_base.js:11` | 二选一：提高 `maxEnemies`（需先测性能）或承认 14 为设计值并改地图数据 |
| D-02 | S15 | `port_colossus` / `forest_shaman` 两个 BOSS 配置完整但无触发路径 | `game.js:3967-3969` | 补映射，或新增 `port`/`shaman` 地图类型 |
| D-03 | S08 | 不带背包时背包尺寸 0×0，`CONFIG.BACKPACK_COLS/ROWS` 是死配置 | `game.js:1662-1664`、`game.js:38` | 明确「无背包 = 无空间」是设计，还是应给基础空间 |
| ~~D-04~~ | ~~S10~~ | ~~商店覆盖不全~~ **经复核不成立，已撤销**（运行时 322/322 全覆盖） | — |
| D-06 | S13 | 93 件红藏品全量注入保险箱池，单箱约 77% 概率掉红 | `game.js:613-614` | 改为按稀有度权重抽样，禁止全量 concat |
| D-11 | S17 | 任务奖励 XP 不走 `gainXP()`，经验全丢 | `game.js:8030` | 改用 `gainXP(reward.xp, '任务奖励')` |
| D-12 | S23 | 无任何性能基线与断言 | 全局 | 建立 `?perfdebug=1` 基线记录并写入验收标准 |
| D-30 | S11 | 出生点即撤离点（5–10m），撤离零空间成本 | `map/*.js` playerSpawn vs extracts |
| D-31 | S12/S19 | 撤离 XP = `50 + lootValue×0.1`，一次撤离跳级数百级，等级/技能树曲线断裂 | `game.js:10031` vs `game.js:4292` |

### 🟠 体验级（严重影响但可绕过）

| ID | 系统 | 问题 | 定位 |
|----|------|------|------|
| D-13 | S08 | `maxPockets` 硬赋 5 的死代码（胸挂实际经 `_rigItems` 生效，见 S08 修正定性） | `game.js:9942` |
| D-26 | S09 | 点击拾取绕过负重校验，只有拖拽受 70kg 限制 | `game.js:5916-6007` |
| D-27 | S08 | 物品旋转完全未实现，README 的「tetris-style」不成立 | `game.js:849-861` |
| D-28 | S08 | 撤离时口袋/胸挂物品不迁移到仓库，直接消失 | `game.js:10037-10049` |
| D-29 | S08 | 两件同名「战术胸挂」（4格₵30,000 / 7格₵150,000） | `game.js:182`、`game.js:285` |
| D-14 | S16 | 负重技能 `maxWeight` 无效（与 `getMaxWeight()` 脱钩） | `game.js:4567` vs `game.js:47` |
| D-15 | S17 | `endGame` 中的 `trackMission` 因 `S.phase='gameover'` 被拦截 | `game.js:7988` vs `10017` |
| D-16 | S04 | 投掷物无玩家侧使用路径；`stim` 类型物品无 `useItem` 分支 | `game.js:2768-2789` |
| D-17 | S11 | 撤离点 `desc` 的钥匙卡/船只条件未校验，纯装饰 | `game.js:6872` |
| D-18 | S07 | 开箱总时长可达 14.5s（`searchTime` + 逐件揭示叠加） | `game.js:5201` vs `5297` |
| D-19 | S14 | 检视器无说明文本（`ITEMS` 无 description 字段） | `game.js:127-311` |

### 🟡 一致性级（文档与实现不符，需修订文档或代码）

| ID | 内容 | 文档声称 | 代码实际 |
|----|------|----------|----------|
| D-07 | 收集品数量 | 254 件（README:53） | 183 件 |
| D-20 | 局时长 | 15min / 10min（README:34） | 20min / 15min（`map/*.js:10`） |
| D-21 | 武器档位 | 「6 weapon tiers」（README:42） | 38 把武器 / 7 个装备槽类别 |
| D-22 | BOSS 数量 | 7 种三阶段五技能 | 5 个有配置，7 个有模型，3 个可达 |
| D-23 | 物品类型 | 「50+ item types」（README:170） | 约 322 条 |
| D-24 | 地图数据死字段 | `containerCount: 200/260` | 从不被读取 |
| D-25 | 近战射程 | `range: 2~3`（`game.js:109-113`） | 实际硬编码 2.5（`game.js:2806`） |

---

## 5. 系统级依赖风险

| 风险 | 说明 | 缓解 |
|------|------|------|
| 巨文件耦合 | `game.js` 10,837 行包含 CONFIG/ITEMS/WEAPONS/SESSION/地图/玩家/战斗/背包/UI/经济全部逻辑。S01/S08/S10/S17/S19 的修改都在同一文件内，**任何改动都可能影响无关系统** | 短期：改动前必读对应 SECTION 注释（`game.js:6,67,682,1629,1681` 等锚点）。中期：不拆文件（违反零构建），但建立 SECTION 索引 |
| 双源数值 | `CONFIG` 与 `map/*.js` 各自定义同一批参数，`loadMapData` 单向覆盖 | 建立「唯一真源」原则：**地图级参数只写地图，全局参数只写 CONFIG**。当前重叠的 4 项（mapSize/gameTime/enemyCount/containerCount）必须消歧 |
| 死配置清单 | 已确认的死配置：`CONFIG.BACKPACK_COLS/ROWS`、`CONFIG.STASH_COLS/ROWS`（被 `STASH_LEVELS` 取代）、`CONFIG.enemyCount`（被地图覆盖）、地图 `containerCount`、`S.maxWeight`、胸挂 `slots` | 清理或标注 `@deprecated` |
| 降级路径分散 | `BossSystemV2`、`EnemyAI`、`PlayerAnimation`、`WeaponADS`、`ItemIcons`、`AudioEngine`、`WeaponFX`、`PerfManager`、`HudFeedback`、`SkillTreeUI` 全部用 `typeof X !== 'undefined'` 做降级 | 好处是模块缺失不崩；坏处是**模块加载失败静默降级，玩家看到的是「功能变少」而不是「报错」**。建议加启动自检并打日志 |

---

## 6. 下一步（Phase 2 收尾动作）

1. **主理人裁定** §1 的 P3 四项全部确认不做 → 收缩完整版范围（01-pillars §7 A-02）。
2. **D-01/D-06/D-11/D-23 优先修**——这四条分别对应「打不起来」「钱不值钱」「成长断了」「性能没底」，是支柱级的。
3. **建立验收清单执行机制**：本表最后一列即验收用例，每条需有人在浏览器里点一遍并留痕（`production/` 目录当前为空，建议在此建立验收记录）。
4. 补 `design/accessibility-requirements.md`（当前 `design/` 下仅本目录三份文档 + systems/）。
