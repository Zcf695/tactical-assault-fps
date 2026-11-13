# 冒烟与回归用例集 —《战术突击》v4.3

- **文档状态**：草案 v1.0（与 `tests/strategy.md` 配套）
- **作者**：严守真（质量负责人 / QA Lead）· 2026-11-13
- **基线 commit**：`ddf204a`
- **用例总数**：14 条冒烟（SMK-01…12 + SMK-13/14）+ 3 条事故回归（REG-01…03）= **17 条**
- **独立工具**：`tools/file-protocol-check.mjs`（file:// 路径，见 strategy.md §8.5）
- **执行层级**：全部属于 L1 冒烟，**每次改动都跑**；预算 ≤ 6 分钟（全自动部分 ≤ 90 秒）

## 执行方式（已落地）

```bash
cd tests/harness && npm install     # 首次
node smoke.mjs                      # 全量 15 条，约 55–60s
node smoke.mjs --only=SMK-03        # 单条
node smoke.mjs --headful            # 有头观察
```

退出码：`0` 无 FAIL / `1` 有 FAIL / `2` 环境起不来。证据落 `tests/evidence/<YYYYMMDD-HHmmss>/`。
**最近一次全量运行（2026-11-13 17 条版）**：`PASS 14 / CONCERNS 1 / FAIL 1`，**退出码 1（预期内的红）**。
- FAIL：SMK-14 —— 降级置空 424 个材质的 normalMap，违反 2026-11-13 裁定（§7.4.5）；修法在 `performance_guard.js:91`，测试不等代码。
- CONCERNS：SMK-11 draw call（军事禁区 1088 > 900 阶段一阈值）。

## 使用约定

1. 每条用例的「预期结果」必须是**数字 / 状态字符串 / 布尔**。出现「正常」「流畅」即为不合格用例，会被打回。
2. 判定列中的 `[全自动]`、`[半自动]`、`[人工]` 是自动化程度；半自动 = 脚本采集 + 人判截图；人工 = 只能人做。
3. 所有 `evaluate` 片段基于浏览器全局可直接访问（classic script 顶层变量），已在 2026-11-13 实测可用。
4. 期望值来自实测基线，`±` 为容差；超出容差按 CONCERNS 处理，跌破下限按 FAIL。

---

## 汇总表

| ID | 场景 | 前置条件 | 步骤 | 预期结果（判据） | 判定方式 / 自动化 | 证据 |
|---|---|---|---|---|---|---|
| **SMK-01** | 启动与模块就位 | 空缓存；URL `?perfdebug=1` | 1. 打开 `index.html` 2. 等 `loadingScreen` 隐藏 3. 读模块状态 | 12 个模块全部定义**且已初始化**：`RenderPipeline.isEnabled()===true`、`GraphicsEnhancement.isEnabled()===true`、`GameSettings.getSettings()` 返回对象、`EnemyAI` 定义、`PBRTextures` 就绪 ≥8、水量网格 ≥1 | [全自动] 断言 6 项 | `SMK-01_*.probe.json` |
| **SMK-02** | 开局进入行动阶段 | SMK-01 通过 | 1. `enterLobby('qa')` 2. `startGame()` 3. 等 3 秒 | `S.phase==='playing'`；`#lobbyScreen` display=none、`#gameHUD`=block；实体数达下限（见明细）；`S.weaponSlots[3]==='knife'`；`S.health===S.maxHealth` | [全自动] 断言 9 项 | 截图 + probe |
| **SMK-03** | 射击与换弹 | SMK-02；配 rifle + 2 组步枪弹 | 1. 设 `weaponSlots[0]='rifle'`、`magAmmo[0]=30` 2. 连打 6 发 3. 打空弹匣 4. `reload()` 5. 等换弹结束再打 1 发 | 连打 6 发后 `magAmmo[0]===24`；空仓射击触发自动换弹（`isReloading===true`）且弹匣补满 30、备弹 2→1；显式 `reload()` 后 `magAmmo[0]===30`、`isReloading===true`、备弹 1→0；换弹结束后 `isReloading===false` 且可再开火（30→29） | [全自动] 断言 11 项 | 截图 + probe |
| **SMK-04** | 开镜 ADS | SMK-02；持 rifle | 1. `WeaponADS.startAim()` 2. 等 400ms 3. 读 `getAimProgress()` 4. `stopAim()` 5. 等 400ms 再读 | 瞄准中 `progress≥0.9`（0→1，**必须等 300ms 以上再读，t=0 时为 0**）；`camera.fov` 小于腰射 FOV；`stopAim()` 后 `progress≤0.1` 且 `camera.fov` 回到原值 ±0.5 | [全自动] 断言 4 项 | 开镜前后截图各 1 张 |
| **SMK-05** | 拾取地面掉落 | SMK-02；场上有 `groundLootItems` | 1. 取首个未拾取掉落 `gl`，记录 `id` 与 `def.value` 2. `pickupGroundLoot(gl)` | `gl.taken===true`；`S.lootValue` 增加量 === `ITEMS[gl.itemId].value`（误差 0）；`S._lootItems` 末尾含该 id；物品出现在背包或安全箱网格内（`findFreeSlot` 已放置）；拾取特效无异常 | [全自动] 断言 5 项 | 拾取瞬间截图 |
| **SMK-06** | 背包与仓库 | SMK-02 | 1. `openBackpack()` 2. 等 300ms 3. 读 DOM 4. `closeBackpack()` | `S.phase==='backpack'`；`#backpackScreen` display=flex 且 `#backpackGrid` 子节点 ≥1；`#bpWeight` 文本匹配 `/^\d/`；关闭后 `S.phase==='playing'` 且 `#backpackScreen` display=none | [全自动] 断言 6 项 | 背包截图（含网格与装备栏） |
| **SMK-07** | 搜索容器 | SMK-02；`containers[0]` 存在 | 1. `openSearch(containers[0])` 2. 等内容揭示完成 3. 读 `#containerGrid` 子节点数 4. `closeSearch()` | `S.phase==='searching'`；`S.containersSearched` +1；`#searchScreen` display=flex；揭示完成后 `#containerGrid` 子节点数 === 该容器未拾取物品数；关闭后 `S.phase==='playing'`、`#searchScreen` display=none | [半自动] 数量断言自动，揭示动画结束需等待（用 `waitForFunction` 而非死等） | 搜索界面截图 |
| **SMK-08** | 3D 检视器 | SMK-02；背包内有物品 | 1. `InspectViewer.open('gpu')` 2. 等 900ms 3. 截检视面板 4. `InspectViewer.close()` | `InspectViewer.isOpen()===true`；检视面板 canvas 区域**非纯色**（取样像素方差 > 阈值，证明有模型渲染）；关闭后 `isOpen()===false`；关闭后 `S.phase` 不变 | [半自动] `isOpen()` 自动，非纯色需像素抽样自动判定 | 检视面板截图 |
| **SMK-09** | 地图切换 | SMK-02（军事禁区） | 1. 记录当前 `MAP_DATA.name` 2. `selectMap('forest_outpost')` 3. `startGame()` 4. 等 3.5 秒 | `MAP_DATA.name==='密林禁区'`；三张地图往返后实体数均达下限（见明细）；`#gameHUD` 正常；旧场景已清理（`scene.children` 不随切换持续增长，±10%）；水量网格 ≥1 | [全自动] 断言 7 项 | 每图截图各 1 张 |
| **SMK-10** | 撤离结算 | SMK-02；`S.lootValue>0` | 1. 记录 `P.money` 与 `S.lootValue` 2. `endGame(true)` 3. 读结果界面 | `S.phase==='gameover'`；`#gameHUD` display=none；`#resultScreen` 可见；`#resultTitle` 文本含「撤离成功」；`#resultValue` 数字 === 结算前 `S.lootValue`；`P.money` 增加 === `S.lootValue`；`P.stats.extracts` +1 | [全自动] 断言 8 项 | 结算界面截图 |
| **SMK-11** | 确定性性能指标 | SMK-02；`?perfdebug=1` | 三图各 `selectMap`+`startGame`，静置 3.2s 后采样 1.5s，取多帧最大值 | draw call 三图最大值 ≤900（阶段一）；program ≤40；js 只做三图**相对比较**、不判定 | [半自动] 采集自动，真机结论需人工 | `SMK-11.json` |
| **SMK-13** | 首局 draw call（初始化顺序） | SMK-02 开局 0–1.2s 已采样 | 读 `ctx.state.firstGameCalls` | ≤1500（正常 ≈1077；原缺陷 3523） | [全自动] | `SMK-13.json` |
| **SMK-14** | 低画质降级不拆材质 | **干净页面 `?perf=off`** 开局 | 1. 记录材质状态 2. `forceLevel(3)` 3. 再记录 | albedo 置空数 = 0；**normalMap 消失数 = 0（FAIL 级）**；program 数不增加 | [半自动] 数值自动 + 截图人工 | `SMK-14_level3_降级后.png` |
| **SMK-12** | 控制台零报错 | SMK-01→SMK-10 全程开启捕获 | 全程监听 `console`/`pageerror`/`requestfailed` | `errors===0`；`warnings===0`；`requestfailed` 仅允许 `favicon.ico`；不得出现关键词 `[WorldProps] 道具生成失败`、`Loading error`、`Cannot read`、`is not a function` | [全自动] 断言 4 项 | `SMK-12_console.log`（error+warn 全量） |
| **REG-01** | 事故① 道具生成数量 | SMK-02 | 1. 读 `mapEnvironmentGroup.userData.worldPropsPlaced` 与各实体数组 | `propsPlaced.length ≥ 100`（军事禁区实测 128、密林 127）；`worldPropsRejects` 存在且含 `bounds/building/water/spawn/overlap` 键；`containers ≥ 100`（实测 170）；`groundLootItems ≥ 10`（实测 17–26）；**任一为 0 直接 FAIL** | [全自动] 断言 6 项，**每次改动必跑** | `REG-01_*.probe.json` |
| **REG-02** | 事故② 材质 UV 平铺 | SMK-02 | 1. 取 `mapEnvironmentGroup.children[0]`（地面）2. 遍历 `geometry.attributes.uv` 求 X 跨度 3. 用 `MAP_DATA.mapSize / 5.5` 算期望（**mapSize 从 MAP_DATA 读，不写死**） | UV 跨度 === `mapSize / 5.5`（三图均为 300/5.5 = **54.55**，容差 ±2）；跨度 <5 视为「整块地面只采样一张贴图」FAIL；`_pbrUV===true`；`material.map !== null` | [全自动] 断言 6 项，**实测 54.55 === 期望，PASS** | `REG-02.json` + 地面截图 |
| **REG-03** | 事故③ 帧耗时无回归 | SMK-02；`?perfdebug=1` | 1. 采样空场 5 秒 2. 把敌人数量调到 14 并拉到视野内交战 3. 再采样 5 秒 | 空场与交战态 `js` 均 ≤ 8ms；交战态 `js` 相对空场增幅 ≤ 2 倍；任意单帧 `js` ≤ 33ms；`obstacles` 增加 50% 后 `js` 不出现线性增长（解析几何 LOS 未退化为射线递归） | [半自动] 采集自动，异常需人工确认场景 | `REG-03_*.perf.json` |

---

## 明细与断言片段

### SMK-01 启动与模块就位

**为什么单独一条**：本项目所有模块都用 `typeof X !== 'undefined'` 守卫做软依赖，而 `index.html` 里 `game.js`（1415 行附近）**先于** `enemy_ai.js` / `settings.js` / `graphics_enhancement.js`（1448–1451 行）加载，`init()` 又走 `ResourceLoader` 异步回调。一旦时序变化，守卫会把「尚未加载」静默当成「未启用」——**画面降级、零报错**。

```js
// 全部必须为 true；GraphicsEnhancement/RenderPipeline 默认 false，init 成功才 true
({
  renderPipeline: RenderPipeline.isEnabled(),
  graphicsEnhancement: GraphicsEnhancement.isEnabled(),
  gameSettings: typeof GameSettings.getSettings() === 'object',
  enemyAI: typeof EnemyAI !== 'undefined',
  performanceGuard: PerformanceGuard.getLevel() >= 0,
  waterMeshes: GraphicsEnhancement.getWaterMeshes().length,      // ≥1（实测 6）
  pbrReady: PBRTextures.kinds.filter(k => PBRTextures.ready(k)).length, // ≥8（实测 9）
  bootModules: ['WorldProps','ItemIcons','InspectViewer','AudioEngine','WeaponFX','ItemModels']
    .every(m => eval('typeof ' + m) !== 'undefined')
})
```

> `waterMeshes === 0` 或 `graphicsEnhancement === false` 是「init 被跳过」的确诊信号 → **P0**。

---

### SMK-02 开局进入行动阶段

```js
// 期望：全部成立
({
  phase: S.phase === 'playing',
  lobbyHidden: document.getElementById('lobbyScreen').style.display === 'none',
  hudShown: document.getElementById('gameHUD').style.display === 'block',
  knife: S.weaponSlots[3] === 'knife',
  fullHP: S.health === S.maxHealth,
  props:   (mapEnvironmentGroup.userData.worldPropsPlaced||[]).length,   // ≥100
  contains: containers.length,        // ≥100（实测 170）
  enemies:  enemies.length,           // ≥5（实测 14）
  loot:     groundLootItems.length,   // ≥10（实测 17–26）
  extracts: extractPoints.length,     // ≥2（实测 8）
  obstacles: obstacles.length         // ≥200（实测 373）
})
```

**看到什么算通过**：屏幕上出现第一人称手持武器、HUD 血量/弹药有数值、小地图有敌人点、场上能看见集装箱/路障等程序化道具。

---

### SMK-03 射击与换弹

关键事实（已实测）：`shoot()` 在 `game.js:2844` 递减弹匣；`reload()` 是**立即补满弹匣**、`isReloading` 只用于播放动画，因此「换弹中仍可读满弹匣」是**预期行为不是缺陷**——用例必须按此判定，否则会误报。

```js
S.weaponSlots=['rifle','pistol','shotgun','knife'];
S.magAmmo=[30,15,8,0]; S._rigItems=['rifleAmmo','rifleAmmo'];
S.currentWeapon=0; updateWeaponModel(); updateWeaponUI();

for (let i=0;i<6;i++) shoot();
const after6 = S.magAmmo[0];           // 期望 24（=30-6）

S.magAmmo[0] = 0; shoot();             // 空仓射击 → 触发自动换弹（reload 内部把弹匣补满并置位）
const autoReload = S.isReloading;      // 期望 true
const rigAfterAuto = S._rigItems.length; // 期望 1（消耗 1 组备弹）

reload();
({
  mag: S.magAmmo[0],                   // 期望 30（立即补满）
  reloading: S.isReloading,            // 期望 true（动画进行中）
  rigLeft: S._rigItems.filter(i=>i==='rifleAmmo').length  // 期望 0（再消耗 1 组）
})
// 等 reloadTime + 200ms 后
({ reloading: S.isReloading })         // 期望 false
```

**看到什么算通过**：连按左键 6 次，右下角弹药数从 30 变成 24；按 R 后弹药回到 30，枪身有换弹动画，结束后可继续射击。

> ⚠️ `shoot()` 有射速节流（`now - lastShot < fireRate/1000` 直接 return）。自动连打时若间隔不足会**少扣弹**，判定需 `await` 真实间隔或直接断言「扣弹数 ≤ 射击次数」并在明细中记录实际值。此为用例设计注意点，不是缺陷。

---

### SMK-04 开镜 ADS

```js
const fov0 = camera.fov;
WeaponADS.startAim();
// 等 400ms —— 关键：立即读 progress 一定是 0（实测），必须等动画推进
const p1 = WeaponADS.getAimProgress();   // 期望 ≥0.9
const fovAim = camera.fov;               // 期望 < fov0
WeaponADS.stopAim();
// 等 400ms
const p2 = WeaponADS.getAimProgress();   // 期望 ≤0.1
const fovBack = camera.fov;              // 期望 |fovBack - fov0| ≤ 0.5
```

**看到什么算通过**：按住右键，视野收窄、准星与枪械对齐到位；松开后视野恢复原状。

---

### SMK-06 背包与仓库

```js
openBackpack();
({
  phase: S.phase === 'backpack',                                  // 期望 true
  visible: getComputedStyle(document.getElementById('backpackScreen')).display === 'flex',
  gridCells: document.getElementById('backpackGrid').children.length, // ≥1
  weightText: /^\d/.test(document.getElementById('bpWeight').textContent),
  rigCells: document.getElementById('rigGrid').children.length,   // ≥1
  pockets: document.getElementById('pocketGrid').children.length  // ≥1
})
closeBackpack();
({ phase: S.phase === 'playing', hidden: ... })
```

> 注意 1：`openBackpack()` 在 `S.phase !== 'playing'` 时直接 return（无提示）。若用例失败于 phase 不变，先确认上一条用例已把 phase 还原。
>
> 注意 2：**局内背包的渲染目标是 `bpBackpackGrid` / `bpRigGrid` / `bpPocketGrid` / `bpCharSlots`**，而 `backpackGrid` / `rigGrid` / `pocketGrid` 属于**搜索界面**——首轮实现就因为搞混 id 误报过一次。
>
> 注意 3：未装备胸挂/背包时，`bpRigGrid` / `bpBackpackGrid` 本就不渲染子节点，**这是正确行为**。因此用例对这两项做条件判定（已装备→必须 ≥1；未装备→记 N/A 不判失败），「有装备」路径由 L2 用预置存档覆盖。

---

### SMK-07 搜索容器

揭示动画由 `setTimeout` 链驱动（`startItemReveal`），**不要用固定 sleep**，用等待条件：

```js
openSearch(containers[0]);
await page.waitForFunction(() => {
  const c = S.currentSearchContainer;
  return c && c._revealed && c._revealed.every(r => r === true);
}, { timeout: 15000 });
({
  phase: S.phase === 'searching',
  searched: S.containersSearched,   // 期望较开局 +1
  cells: document.getElementById('containerGrid').children.length,
  expected: containers[0].items.filter(i => !i.taken).length
})
```

**看到什么算通过**：容器界面逐格揭示物品，格数与该容器实际物品数一致；关闭后能立刻继续移动（锁鼠标恢复）。

---

### SMK-08 3D 检视器

**必须先隔离交火**：`animation_enhancement.js:329` 的 `onPlayerHit()` 会在玩家受伤时按设计关闭检视器，测试地图有 14 个敌人随机开火，不隔离的话约 1/4 概率被打断——首轮就是这样被误判成 flaky 缺陷的（花了两轮才定位，教训：**偶发失败先怀疑测试环境，再怀疑产品**）。

```js
// 0. 隔离：把所有敌人挪到玩家 240m 外，并记录血量
parkEnemiesAway();            // → { moved: 14, health: 100 }
// 1. 打开并观察
InspectViewer.open('gpu');
await wait(900);
// 2. 断言观察期间没挨打（挨打 → 关闭是设计行为，不能算缺陷）
S.health;                     // 期望与 parked.health 相等
```

`InspectViewer.open(id)` 后需要 ≥800ms 出图。判定「非纯色」用像素方差而不是肉眼看：

```js
InspectViewer.open('gpu');
// 等 900ms
const shot = await page.locator('#redInspectScene').screenshot(); // 或检视面板 canvas
// 断言：解码后唯一颜色数 > 50 且非单一背景色
({ open: InspectViewer.isOpen() === true })
```

**看到什么算通过**：面板中出现可拖拽旋转的 3D 模型（显卡/金条/急救包等），有稀有度轮廓光、名称、估值；关闭后回到原界面且不卡在遮罩层。

---

### SMK-09 地图切换

三张地图的实体基线（实测，`tests/harness/tools/map-baseline.mjs`；用例阈值为实测 ×0.8 取整）：

| 地图 | `MAP_DATA.name` | propsPlaced（实测/下限） | containers（实测/下限） | enemies | groundLoot（实测/下限） | extractPoints |
|---|---|---|---|---|---|---|
| `military_base` | 军事禁区 | 128 / ≥100 | 170 / ≥130 | 14 | 26 / ≥20 | 8 |
| `forest_outpost` | 密林禁区 | 233 / ≥180 | 86 / ≥68 | 14 | 17 / ≥13 | 8 |
| `industrial_port` | 港口城市 | 163 / ≥130 | 78 / ≥62 | 14 | 15 / ≥12 | 8 |

> 容器数三图差异很大（170 / 86 / 78）——**不能用一个全局阈值**，初版用 ≥100 直接误报了密林禁区。阈值表在 `cases.mjs` 的 `MAP_FLOOR`，调整时必须注明来源。

额外断言：连续切换 3 次后 `scene.children.length` 不得单调增长（±10% 内），否则判定为场景未清理（内存泄漏 P1）。

---

### SMK-10 撤离结算

```js
const money0 = P.money, value = S.lootValue, ext0 = P.stats.extracts;
endGame(true);
({
  phase: S.phase === 'gameover',
  hudHidden: document.getElementById('gameHUD').style.display === 'none',
  resultShown: document.getElementById('resultScreen').style.display !== 'none',
  title: document.getElementById('resultTitle').textContent,      // 含「撤离成功」
  resultValue: Number(document.getElementById('resultValue').textContent.replace(/[^\d]/g,'')), // === value
  money: P.money - money0,        // === value
  extracts: P.stats.extracts - ext0  // === 1
})
```

> `endGame(true)` 会 `savePersistent()`。用例结束必须还原存档或使用独立 `localStorage` 命名空间（`currentUser='qa'`），避免 QA 数据污染玩家存档 —— **这条是硬要求，违反会导致存档相关 P0 误判**。

---

### SMK-11 / REG-03 性能基线

```js
// 页面 URL 必须带 ?perfdebug=1，且不得带 ?perf=off
({ frame: window.__perfFrame,
   guard: { level: PerformanceGuard.getLevel(), dpr: renderer.getPixelRatio(),
            quality: GameSettings.getSettings().graphics.quality } })
```

采样纪律（踩过的坑都在这三条里）：
1. **进图后先静置 1.5s 再采样**，并丢弃前 2s 样本 —— PBR 贴图与 3D 图标是渐进生成的，否则会把加载抖动算进稳态。
2. **看分位数，不看单点**。单次 `__perfFrame` 采样会骗人：实测同一环境 p50 = 4.6ms，但 max = 156ms。
3. **长帧要看 js / render 归因**。软渲染下 render 单帧可达 300–758ms，会把 JS 采样一起抬高；只有 **js 独占**（render 不慢）才是 JS 逻辑退化的证据。

实测基线（2026-11-13，headless SwiftShader，1440×810，军事禁区）：

```json
{ "js_p50": 4.6, "js_p90": 10.5, "js_p99": 42.1, "max": { "js": 156.1, "render": 304.1 },
  "calls_p50": 1112, "guardLevel": "2→3（采样期发生降级）" }
```

判定：

| 指标 | PASS | CONCERNS | FAIL |
|---|---|---|---|
| JS 单帧 p50 | ≤ 8ms | 8–16ms | > 16ms |
| JS 单帧 p90 | ≤ 16ms | 16–33ms | > 33ms |
| draw call p50 | ≤ 900 | 901–1200 | > 1200 |
| 最大单帧 | js 不独占 | — | js > 100ms 且 render ≤ js |
| 采样期降级 | 未发生 | 发生了（结论仅参考） | — |

**当前判定：draw call p50 1112 → CONCERNS**（目标值由工程侧合批整改后给出，届时收紧到 ≤600）。JS 侧 p50 4.6ms 远低于预算，事故③ 未复发。

REG-03 额外判定：交战态（把 3 个敌人挪到玩家 12m 内）JS p50 ≤ `max(12ms, 空场 p50 × 3)`，p90 ≤ 33ms，js 最大 ≤ 100ms。

实测交火成本：空场 p50 **3.7ms** → 3 敌贴近 **8.8ms**（+5.1ms），p90 17.4ms，js 最大 39.6ms。**属可接受量级**，事故③ 是 399ms/帧，差一个数量级。
阈值口径说明：初版写的是「空场 × 2」，直接被 +5.1ms 的正常 AI 开销打到 FAIL ——**退化的判据是量级变化，不是 2 倍**。若真出现 LOS 退化为逐网格射线递归，会看到 100ms+ 量级，仍然会被这条抓住。

若敌人数翻倍导致 JS 近似线性上升（如 14 敌贴近 > 40ms），按 **P1** 处理并复查 `hasLineOfSight` 是否仍在走解析几何。

### SMK-13 首局 draw call（初始化顺序防回归）

```js
// 在 SMK-02 里采样（开局 0–1.2s，每 150ms 一次，取 max）：未合批窗口只出现在最初几帧
{ firstGameCalls }  // 期望 ≤1500；修复后 ≈1077；缺陷态 3523
```

**为什么单独一条**：`rebuildMapEnvironment()` 若跑在 `GraphicsEnhancement.init()` 之前，`isEnabled()` 为 false → `batchStatic` 被跳过 → **整局**以 1.1 万个未合批网格渲染。这类退化不会报错、不会黑屏，只会让所有机器一起变卡。实测已从 3,523 降到 1,077（工程侧已修）。

### SMK-14 低画质降级不得拆掉材质（美术底线）

必须在**干净页面 + `?perf=off`** 上测：主场景此时早已自动降到 level 4，`forceLevel(3)` 会因 `if (n <= _level) return` 变成空操作——首版就是这么「假通过」的。

```js
const p2 = await ctx.newGamePage('?perf=off');
startGame; wait 4s;                       // 等材质升级完成
before = probeMaterialState();
forceLevel(3); wait 1.5s;
after = probeMaterialState();
```

实测（level 0 → 3）：

| 观测 | 结果 | 判定 |
|---|---|---|
| `normalMap` 被置空的材质数 | **424** | **FAIL**（2026-11-13 已裁定：禁止置空 normalMap，理由见 strategy.md §7.4.5） |
| shader program 数 | **20 → 39（+95%）** | **shader 重编译确认**，art 的判断成立 |
| `material.map`（albedo）被置空 | 0 | 正常 |
| 降级后仍有 normalMap 的材质 | 0（单材质网格全被清） | — |

### REG-01 事故① 道具生成数量（每次改动必跑）

```js
const ud = mapEnvironmentGroup.userData;
({
  placed: (ud.worldPropsPlaced || []).length,        // ≥100；===0 即事故①复发
  rejects: ud.worldPropsRejects,                     // 必须存在，含 bounds/spawn/water/building/extract/container/ground/overlap
  containers: containers.length,                     // ≥100
  groundLoot: groundLootItems.length,                // ≥10
  enemies: enemies.length,                           // ≥5
  extractPoints: extractPoints.length                // ≥2
})
```

实测：`placed=128`，`rejects={bounds:72, building:64, overlap:20, water:5, container:1, spawn:0, center:0, extract:0, ground:0}`。
**额外价值**：`rejects.overlap>0` 说明有道具候选与容器位置重叠被拒——`world_props.js:630` 现在读的是 `FIXED_CONTAINERS` 而非真实生成的 `containers`（为绕开 TDZ），两者不一致时会出现「道具压住容器」的可视问题，视觉抽检时留意。

---

### REG-02 事故② 材质 UV 平铺（每次改动必跑）

```js
const g0 = mapEnvironmentGroup.children[0];       // 地面 PlaneGeometry(CONFIG.mapSize, CONFIG.mapSize)
const uv = g0.geometry.attributes.uv;
let lo = Infinity, hi = -Infinity;
for (let i = 0; i < uv.count; i++) { lo = Math.min(lo, uv.getX(i)); hi = Math.max(hi, uv.getX(i)); }
const mapSize = MAP_DATA.mapSize;                 // 三张地图均为 300（map/*.js 第 9 行）
({ span: hi - lo,                                 // 期望 mapSize / 5.5 = 54.55，容差 ±2
   expected: mapSize / 5.5,
   locked: !!g0.geometry.userData._pbrUV,         // 期望 true
   hasMap: !!g0.material.map })                   // 期望 true
```

**判定：`UV 跨度 ≈ MAP_DATA.mapSize / 5.5`（±2）。** 三张地图实测均为 **54.55**，与 300/5.5 完全一致 → **PASS**。

> ⚠️ 修正记录（2026-11-13）：该用例初版把期望算成 20，是因为误用了 `CONFIG.mapSize` 的兜底值 110（`game.js:1067` 是 `MAP_DATA.mapSize || 110`，而三图实际都是 300）。**教训：任何与地图尺寸相关的期望值，必须从 `MAP_DATA` 读，不能写死或依赖兜底常量。** 这条已写进用例实现（`probeGroundUV` 动态读 mapSize）。

仍是**观察项**（非缺陷）：`pbr_textures.js:526` 的 `if (geo.userData._pbrUV) return;` 是一次性锁——先到的参数会固化 UV、后到参数静默丢弃。目前实测结果正确，但这条「顺序依赖 + 静默跳过」的路径依然存在，属于事故② 的同源风险。若未来修改地面 tile 参数后实测跨度不变，第一时间看这里。

**看到什么算通过**：站在地面近景截图，纹理颗粒大小均匀、无沿某一方向拉长的条纹；模块化箱体六面纹理比例一致。

## 执行顺序与依赖

```
SMK-01 → SMK-02 ─┬→ SMK-03 → SMK-04
                 ├→ SMK-05 → SMK-06
                 ├→ SMK-07
                 ├→ SMK-08
                 ├→ SMK-09（会重开局，放最后一批界面用例之后）
                 ├→ REG-01 / REG-02 / REG-03（随时可跑，最便宜，建议前置）
                 └→ SMK-10（会结束本局并写存档，必须最后）
SMK-11（独立会话，需 ?perfdebug=1）
SMK-12（贯穿全流程的监听器，最后汇总判定）
```

**最小失败定位链**：`SMK-01` 失败 → 后面全部标记 BLOCKED（环境没起来，不是功能坏了）。这条要写进报告，不要报成 12 条失败。

## 已知易 flaky 点（必读）

| 点 | 现象 | 处置 |
|---|---|---|
| 图标异步就绪 | 实测 12 个图标请求只有 4 个在 1.2s 内就绪 | 用 `waitForFunction` 等目标图标；不要断言「全部就绪」 |
| 物品揭示动画 | `setTimeout` 链，长物品更慢 | 等 `_revealed` 全 true，超时 15s |
| ADS 进度 | t=0 时 `getAimProgress()` 恒为 0 | 至少等 300ms |
| 性能采样 | 首 2 秒含渐进加载长帧 | 丢弃前 2 秒 |
| 撤离点开关 | `updateExtractPointTimers` 随机开合 | 用例直接用 `endGame(true)`，不依赖撤离点开关状态 |
| 敌人随机巡逻 | 交战态性能采样波动大 | 采样 6s、丢弃前 2s，看 p50/p90 |
| **3D 检视器被战斗打断** | 约 1/4 概率「打开后 0.2s 内自行关闭」——真因：`animation_enhancement.js:329` 的 `onPlayerHit()` **按设计**在玩家受伤时关闭检视器，而测试地图里有 14 个敌人随机开火。**这不是产品缺陷** | 用例先 `parkEnemiesAway()` 把敌人挪到 240m 外，并断言「观察期间血量未变」，再判检视器；另保留「是否需要重试」作为断言，一旦需要重试说明隔离失效 |

## 需人工补充的用例（不在本集，进入 L2 回归）

1. 三张地图 × 两种模式（普通 15min / 硬核 10min）完整撤离流程各 1 次。
2. 低端核显笔记本真机 60fps / 30fps 判定（headless 不作数）。
3. `file://` 双击直开路径全流程（现有全部脚本走 HTTP，这是真实用户路径）。
4. 背包拖拽到丢弃区的鼠标交互（指针锁定 + 拖拽状态机，自动断言成本过高）。
5. 死亡结算（`endGame(false)`）与掉包逻辑。
