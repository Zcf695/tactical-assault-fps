# 美术数据表（可直接粘贴）

> S1-5 缺陷包 / 合批整改的前置输入。三张表，不含论述。
> 表 A 前置、表 B 前置、表 C 前置 三条必须同时满足，否则数值不生效。

---

## 表 A｜三张地图 theme 覆盖值

**前置（唯一阻塞项）**：`render_pipeline.js:717-718` 的 `Math.max(c.fogNear||50, 65)` / `Math.max(c.fogFar||160, 235)` 必须放宽为 `Math.max(..., 30)` / `Math.max(..., 200)`，否则密林禁区配置的 40/175 会被抬成 65/235 且与港口重合。**表内 `fogNear/fogFar` 已按放宽后的 clamp 取值。**

| 参数 | 军事禁区（现值） | 军事禁区 | 密林禁区（现值） | 密林禁区 | 港口城市（现值） | 港口城市 |
|---|---|---|---|---|---|---|
| `skyColor` | `0x87ceeb` | **`0x4a86c8`** | `0x87ceeb` | **`0x8fd0c0`** | `0x87ceeb` | **`0xbcae9a`** |
| `fogColor` | `0xa8d0e0` | **`0xa8aca8`** | `0xa8d8e8` | **`0x9ec0b4`** | `0xa8d4e8` | **`0xdccdb4`** |
| `fogNear` | `55` | **`80`** | `45` | **`40`** | `65` | **`95`** |
| `fogFar` | `205` | **`260`** | `195` | **`175`** | `235` | **`290`** |
| `groundColor` | `0x4a5f4f` | `0x4a5f4f` | `0x3a6a38` | **`0x2f5c30`** | `0x5a5850` | `0x55534c` |
| `groundSurface` | *(未定义→`grass`)* | **`gravel`** | *(未定义→`grass`)* | **`grass`** | *(未定义→`grass`)* | **`asphalt`** |
| `roofColor` | *(未定义→`0x333333`)* | **`0x555a52`** | *(未定义→`0x333333`)* | **`0x36402f`** | *(未定义→`0x333333`)* | **`0x424a55`** |

**改后派生值（`render_pipeline.js:199-236` 自动算出，用于验收，不需要写进代码）**

| 派生量 | 军事禁区 | 密林禁区 | 港口城市 |
|---|---|---|---|
| `uZenith` 天顶 | `#2a5b90` H211 S55 L37 | `#45778d` H198 S35 L41 | `#566a7f` H210 S19 L42 |
| `uHorizon` 地平线 | `#b6ac9b` H36 S16 L66 | `#b0b9a3` H84 S13 L68 | `#d9c1a3` H34 S41 L74 |
| 半球光地面色 | `#344237` | `#214022` | `#3b3a35` |

**一眼可辨的依据**：天顶饱和度 **55 / 35 / 19**（深蓝 → 青蓝 → 淡钢灰），地平线色相 **36° / 84° / 34°**（灰暖 → 偏绿 → 亮暖），雾距 **80-260 / 40-175 / 95-290**（中 → 最闷 → 最通透），地表 **砾石 / 草地 / 沥青**。

**粘贴块**

```js
// military_base.js
theme: {
    groundColor: 0x4a5f4f, skyColor: 0x4a86c8, fogColor: 0xa8aca8,
    fogNear: 80, fogFar: 260,
    groundSurface: 'gravel', roofColor: 0x555a52,
    roadColor: 0x555545, wallColor: 0x5a5a52,
    coverColors: [0x6a5a4a, 0x5a5a5a, 0x7a6a5a, 0x4a5a4a],
},

// forest_outpost.js
theme: {
    groundColor: 0x2f5c30, skyColor: 0x8fd0c0, fogColor: 0x9ec0b4,
    fogNear: 40, fogFar: 175,
    groundSurface: 'grass', roofColor: 0x36402f,
    roadColor: 0x4a4538, waterColor: 0x2a7a9a, treeColor: 0x1a5a1a,
    wallColor: 0x4a5a4a,
    coverColors: [0x6a5a3a, 0x4a5a4a, 0x5a6a45, 0x3a4a3a],
},

// industrial_port.js
theme: {
    groundColor: 0x55534c, skyColor: 0xbcae9a, fogColor: 0xdccdb4,
    fogNear: 95, fogFar: 290,
    groundSurface: 'asphalt', roofColor: 0x424a55,
    roadColor: 0x4a4a42, waterColor: 0x2a6080, wallColor: 0x555555,
    coverColors: [0x6a5a4a, 0x5a5a5a, 0x7a6a5a, 0x4a5a6a],
},
```

> 港口 `groundSurface: 'asphalt'` 与路面同贴图，路/地靠**贴图平铺差**（地 5.5 m vs 路 3.2 m）+ `WorldProps.addRoadMarkings` 的标线区分，不再靠颜色对比。

---

## 表 B｜建筑立面 8 色 palette（合批用）

**前置（两条必须同时去掉，否则 palette 被漂白回 L65 灰）**
1. `game.js:2215` — `new THREE.Color(b.color).lerp(new THREE.Color(0xb5b0a4), 0.5)` → 改为 `new THREE.Color(getPaletteHex(b))`
2. `graphics_enhancement.js:782` — `mat.color.lerp(new THREE.Color(0xffffff), 0.30)` → **删除此行**

**8 个材质实例/图，`roughness` 统一 `0.78`、`metalness` `0.0`、`envMapIntensity` `0.22`** —— roughness 必须取同值，任一项不同即变成第 9 个材质、合批失效。

| 槽位 | 地图 | hex | HSL | 建筑用途 | roughness |
|---|---|---|---|---|---|
| s1 | 军事禁区 | `0x8398af` | H211 S22 L60 | 指挥要塞 · 地标（`landmark`） | 0.78 |
| s2 | 军事禁区 | `0xa6bbbf` | H190 S16 L70 | 兵营 · 宿舍 | 0.78 |
| s3 | 军事禁区 | `0xaa8c6e` | H30 S26 L55 | 弹药库 · 仓库 | 0.78 |
| s4 | 军事禁区 | `0xb8b399` | H50 S18 L66 | 工业区 · 车间 | 0.78 |
| s5 | 军事禁区 | `0xbec2c5` | H206 S6 L76 | 围墙 · 哨卡 · 门岗 | 0.78 |
| s6 | 军事禁区 | `0x95b2a3` | H149 S16 L64 | 医疗营地 · 后勤 | 0.78 |
| s7 | 军事禁区 | `0x697296` | H228 S18 L50 | 雷达站 · 哨塔（高层） | 0.78 |
| s8 | 军事禁区 | `0xada7b4` | H268 S8 L68 | 其余 / 默认 | 0.78 |
| s1 | 密林禁区 | `0x82aa74` | H104 S24 L56 | 主哨站 · 地标（`landmark`） | 0.78 |
| s2 | 密林禁区 | `0xb1bc9f` | H83 S18 L68 | 兵营 | 0.78 |
| s3 | 密林禁区 | `0xa7a681` | H58 S18 L58 | 弹药库 · 军械库 | 0.78 |
| s4 | 密林禁区 | `0x96b0af` | H178 S14 L64 | 研究站 · 矿井 · 洞穴口 | 0.78 |
| s5 | 密林禁区 | `0xa98060` | H26 S30 L52 | 伐木场 · 木构建筑 | 0.78 |
| s6 | 密林禁区 | `0x718477` | H139 S8 L48 | 地下设施 · 暗部建筑 | 0.78 |
| s7 | 密林禁区 | `0xc0c6a9` | H72 S20 L72 | 农舍 · 田地建筑 | 0.78 |
| s8 | 密林禁区 | `0xafa1af` | H300 S8 L66 | 其余 / 默认 | 0.78 |
| s1 | 港口城市 | `0x7c9aab` | H202 S22 L58 | 码头主楼 · 地标（`landmark`） | 0.78 |
| s2 | 港口城市 | `0xbfc2c5` | H210 S5 L76 | CBD · 写字楼（高层） | 0.78 |
| s3 | 港口城市 | `0xaea48f` | H41 S16 L62 | 仓储 · 物流 | 0.78 |
| s4 | 港口城市 | `0xa8806b` | H21 S26 L54 | 老城 · 住宅 | 0.78 |
| s5 | 港口城市 | `0x718084` | H193 S8 L48 | 炼油厂 · 发电厂 | 0.78 |
| s6 | 港口城市 | `0xb3a9bc` | H272 S12 L70 | 购物中心 · 大学城 | 0.78 |
| s7 | 港口城市 | `0x9cb4b0` | H170 S14 L66 | 医院 · 渔村 | 0.78 |
| s8 | 港口城市 | `0x777069` | H30 S6 L44 | 其余 / 默认 | 0.78 |

**同 palette 内最小 RGB 距离**：军事 `23.9`、密林 `20.6`、港口 `28.2`（阈值 ≥20，达标）。

**粘贴块**

```js
// 新增：建筑立面调色板（放 game.js 顶部或新建 art_palette.js）
const WALL_PALETTE = {
    military:   [0x8398af, 0xa6bbbf, 0xaa8c6e, 0xb8b399, 0xbec2c5, 0x95b2a3, 0x697296, 0xada7b4],
    forest:     [0x82aa74, 0xb1bc9f, 0xa7a681, 0x96b0af, 0xa98060, 0x718477, 0xc0c6a9, 0xafa1af],
    industrial: [0x7c9aab, 0xbfc2c5, 0xaea48f, 0xa8806b, 0x718084, 0xb3a9bc, 0x9cb4b0, 0x777069],
};

// 共用材质缓存：同色共用同一个实例 → _materialKey 才能合并
const _wallMatCache = new Map();
function getWallMat(hex) {
    let m = _wallMatCache.get(hex);
    if (!m) {
        m = new THREE.MeshStandardMaterial({
            color: hex, roughness: 0.78, metalness: 0.0, envMapIntensity: 0.22,
        });
        _wallMatCache.set(hex, m);
    }
    return m;
}

// game.js:2215 替换
const wallMat = getWallMat(paletteHexFor(b));
```

**槽位分配规则**：`b.landmark === true` → s1；`b.name` 含「兵营/宿舍/营房」→ s2；含「弹药/仓库/军械」→ s3；含「厂/车间/铸造/仓储/物流」→ s4；含「围墙/门/哨卡」→ s5；含「医疗/食堂/后勤/医院」→ s6；`b.h >= 9` 或含「塔/雷达」→ s7；其余 → s8。

---

## 表 C｜植被与道具材质规范

**前置**：`world_props.js:16-29` 的 `mat()` 未设 `envMapIntensity`，`MeshStandardMaterial` 默认值 **1.0**，而地面是 **0.18**、建筑 **0.22** —— 道具/植被的环境反射强度是地面的 **5.5 倍**，这是"道具像贴上去"的主因之一（仅在 IBL 生效的中/高画质可见，低配 `scene.environment = null` 时被掩盖）。

| 项 | 现状 | 目标值 | 位置 |
|---|---|---|---|
| `mat()` 的 `envMapIntensity` | 未设置 → 默认 `1.0` | **`0.12`**（并加入 `_matCache` 的 key） | `world_props.js:16-29` |
| `map.trees` 树干材质 | `color 0x4a3020, roughness 0.9`，无 `envMapIntensity` → `1.0` | 改用 `wood` PBR：`tile 0.6`、`normalScale 0.6`、`roughness 1.0`（乘子）、`metalness 0`、`envMapIntensity 0.12` | `game.js:2115` |
| `map.trees` 树冠材质 | `color 0x2a5a2a, roughness 0.85`，无 `envMapIntensity` → `1.0` | 3 组共享材质，见下三色；`roughness 0.94`、`metalness 0`、`envMapIntensity 0.12`、`flatShading: true` | `game.js:2116` |
| 树冠颜色组数 | 1 组（`theme.treeColor`，密林 `0x1a5a1a`） | **上限 3 组**（见下），按 `scaleSeed` 取模分配，不再读 `theme.treeColor` | `game.js:2116` |
| 树冠 / 树干 `receiveShadow` | **未设置 → false**（只在 `castShadow`） | **`true`**（树干与树冠都要） | `game.js:2122, 2126` |
| 灌木 | 复用 `_leafMats`，`castShadow` 被强制 `false`，`receiveShadow` 未设 → false | `castShadow: false` 保留（省阴影）；**`receiveShadow: true`**；复用树冠 3 色 | `world_props.js:514-530` |
| 岩石 | `mat(0x6a6a64, {roughness:0.95, metalness:0.02})`，`envMapIntensity` 默认 `1.0` | `roughness 0.95`、`metalness 0.02`、**`envMapIntensity 0.12`**；套 `concreteDark` PBR `tile 1.2`、`normalScale 0.8` | `world_props.js:535` |
| 材质实例数（军事禁区 145 栋 + 全图树） | 树冠 1 + 树干 1（`map.trees`）；树冠 4 + 树皮 1（`WorldProps`）→ **两套不通用** | **统一为 3 个树冠 + 1 个树皮**，两套树合并到同一组共享材质 | 两处 |
| 树冠「浮」的观感 | 无接触阴影、不受光遮蔽 | 由 `WorldPolish` 按树冠半径生成接地阴影（已有能力，`world_polish.js:13`），确认每棵树上限 1 个椭圆阴影 | `world_polish.js` |

**树冠 3 色（相对地面反照率 `#2c4622` H103 S35 L20 校验）**

| 槽位 | hex | HSL | 用途 |
|---|---|---|---|
| c1 | `0x35502e` | H108 S27 L25 | 主色（60% 树） |
| c2 | `0x2a4426` | H112 S28 L21 | 暗色（25% 树，背光侧） |
| c3 | `0x24382a` | H138 S22 L18 | 冷暗色（15% 树，针叶/远景） |

**粘贴块**

```js
// world_props.js:16  mat() 增加 envMapIntensity
function mat(color, opt) {
    opt = opt || {};
    const env = opt.envMapIntensity == null ? 0.12 : opt.envMapIntensity;
    const key = color + '|' + (opt.roughness || 0.8) + '|' + (opt.metalness || 0) + '|' + (opt.emissive || 0) + '|' + env;
    if (_matCache[key]) return _matCache[key];
    const m = new THREE.MeshStandardMaterial({
        color: color,
        roughness: opt.roughness == null ? 0.8 : opt.roughness,
        metalness: opt.metalness || 0,
        emissive: opt.emissive || 0x000000,
        emissiveIntensity: opt.emissiveIntensity || 0,
        envMapIntensity: env,
    });
    _matCache[key] = m;
    return m;
}

// 树冠 3 组共享材质（map.trees 与 WorldProps 共用同一组）
const CROWN_COLORS = [0x35502e, 0x2a4426, 0x24382a];
const _crownMats = CROWN_COLORS.map(function (c) {
    return new THREE.MeshStandardMaterial({
        color: c, roughness: 0.94, metalness: 0.0,
        envMapIntensity: 0.12, flatShading: true,
    });
});
const _barkMatShared = new THREE.MeshStandardMaterial({
    color: 0x4a3524, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.12,
});
```

**验收判据（3 条）**

1. 树冠 `envMapIntensity ≤ 0.12`（≤ 地面 0.18 的 2/3），否则树比地面亮。
2. 树冠 `color` 的 `L ≤ 27`（地面反照率 L20 之上不超过 7 点），否则绿上加绿糊成一片。
3. 全图树冠材质实例数 **= 3**，树皮 **= 1**；`renderer.info.memory.materials` 中不得随树的数量增长。
