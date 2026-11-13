# 🎯 战术突击 - 搜打撤 (Tactical Assault: Search, Fight, Extract)

> A Delta Force-inspired browser-based tactical FPS with grid-based inventory system.
> 一款类似「三角洲行动」的浏览器端第一人称战术射击游戏。

[![Tech](https://img.shields.io/badge/tech-Three.js%20%7C%20Canvas%20%7C%20JS-blue)]()
[![Version](https://img.shields.io/badge/version-4.3-green)]()
[![License](https://img.shields.io/badge/license-MIT-yellow)]()

---

## 📸 Demo

Open `index.html` in Chrome/Edge to play instantly — no build, no server, zero dependencies.

直接双击 `index.html` 用浏览器打开即可游玩。

---

## 🎮 Core Loop: 搜 · 打 · 撤

| Phase | Description |
|-------|-------------|
| 🔍 **Search** | Scavenge weapons, ammo, meds, cash across the map |
| ⚔️ **Fight** | Engage AI enemies with tactical positioning |
| 🚁 **Extract** | Reach the extraction point before time runs out |

---

## ✨ Features / 特性

### Game Systems / 游戏系统
- 🗺️ **3 Maps** — Military Base, Forest Outpost, Industrial Port
- ⏱️ **2 Game Modes** — Normal (15min) & Hardcore (10min)
- 🧭 **Minimap** — Real-time enemy & extraction markers
- 💰 **Economy** — Cash rewards, hard mode entry fee
- 🏃 **Stamina** — Sprint & crouch mechanics
- 🎯 **ADS** — Aim-down-sights for precision
- ⚡ **Adaptive resolution** — 帧率不足时自动降采样，稳定后逐步恢复

### Combat / 战斗
- 🔫 **6 weapon tiers** — Common → Ultimate rarity system
- 🎒 **Grid inventory** — Drag-and-drop tetris-style backpack
- 🛡️ **Armor system** — Damage absorption with durability
- 💊 **Medical items** — Heal during combat
- 🤖 **AI enemies** — Patrol, chase, shoot, take cover, flank, throw grenades

### Loot & Inspection / 战利品与检视
- 🧊 **Every collectible has a 3D model** — 显卡、金条、急救包、弹药箱、怀表、钻戒…全部由基础几何体程序化搭建
- 🖱️ **Click-to-inspect** — 库存里单击任意物品打开 3D 检视器：拖拽旋转、滚轮缩放、稀有度轮廓光、估值与说明
- 🖼️ **3D inventory icons** — 库存图标由同一套模型实时渲染，不再是 emoji
- ✨ **Rarity presentation** — 地面掉落带光环、接触阴影、光柱与悬浮旋转，拾取时飞向镜头并弹出价值卡片
- 🧩 **Custom collectibles** — 自定义收集品（254 件）按名称关键词映射到 25+ 实体原型；图标仍使用原 PNG 不变

### Presentation / 表现
- 🌤️ **Atmospheric sky** — 程序化天空穹顶、太阳光晕、地平线雾霭与体积感云层
- 💡 **Unified lighting** — 方向光跟随玩家、PMREM 环境反射、双向补光、真实投影
- 🎞️ **Filmic pipeline** — ACES 色调映射 + Bloom + 分离色调 + 暗角/颗粒 + FXAA
- 🧱 **Procedural PBR** — 混凝土/沥青/草地/瓦楞板/木板/沙袋等 10 套 albedo+normal+roughness+metalness
- 🌲 **Level dressing** — 集装箱堆场、路障、沙袋、瞭望塔、路灯、铁丝网、警示牌、树木灌木岩石、路面标线
- 🔫 **Viewmodel rework** — 步枪/冲锋枪/霰弹枪/狙击枪/手枪/匕首独立视模，含手臂与手套
- 🎥 **Weapon feel** — 行走摆动、冲刺姿态、切枪抬枪、开镜对齐、相机后坐力、V 键分解检视
- 🔊 **Procedural audio** — WebAudio 合成的枪声、混响尾音、换弹金属声、脚步、命中反馈与环境风声
- 🛡️ **Performance guard** — 敌人视线改为解析几何检测（单帧 JS 从 ~400ms 降到 ~10ms）；低帧率自动分级降级，支持 `?perf=low` / `?perf=off` / `?perfdebug=1`

---

## 🕹️ Controls / 操作

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Aim / Look |
| Left Click | Shoot |
| Right Click | ADS (Aim Down Sights) |
| Space | Jump |
| Shift | Sprint |
| C | Crouch |
| R | Reload |
| F | Pickup / Extract |
| G | Use Medkit |
| 1 / 2 / 3 / 4 | Switch Weapons |
| V | Inspect Weapon / 检视武器 |
| Tab / B | Open Inventory |
| Click item | 3D Inspect / 3D 检视物品 |
| ESC | Pause |

---

## 🔫 Weapons / 武器

| Weapon | Damage | Fire Rate | Magazine | Rarity |
|--------|--------|-----------|----------|--------|
| Pistol | 20 | Slow | 12 | Common |
| SMG | 18 | Very Fast | 30 | Uncommon |
| Assault Rifle | 28 | Fast | 30 | Rare |
| Shotgun | 15×8 | Slow | 6 | Epic |
| DMR | 42 | Medium | 10 | Legendary |
| Sniper | 85 | Very Slow | 5 | Ultimate |

---

## 📁 Project Structure / 项目结构

```
FPS_Game_Project/
├── index.html          # Game entry point & UI
├── game.js             # Core engine (gameplay, inventory, HUD, flow)
├── render_pipeline.js  # Sky / lighting / IBL / post FX / adaptive resolution
├── pbr_textures.js     # Procedural albedo + normal + roughness + metalness sets
├── graphics_enhancement.js # Surface tagging, world-scale UVs, water ripples
├── world_polish.js     # Static batching & contact shadows
├── world_props.js      # Containers, barriers, sandbags, lamps, vegetation, signs
├── item_models.js      # 3D models for every collectible / weapon / gear
├── item_icons.js       # Offscreen-rendered 3D inventory thumbnails
├── inspect_viewer.js   # Draggable 3D inspect viewer
├── weapon_fx.js        # Muzzle flash, shells, bullet holes, sparks, smoke
├── audio_engine.js     # Procedural WebAudio gunfire / foley / ambience
├── performance_guard.js # Auto quality scaling / low-GPU detection
├── perf_manager.js     # HUD caching, update scheduling, minimap base layer
├── hud_feedback.js     # Compass objectives, damage arcs, hit feedback
├── animation_enhancement.js # Viewmodel bob / recoil / reload / inspect
├── settings.js         # Settings, key bindings, pause menu
├── map/
│   ├── military_base.js    # Military base map
│   ├── forest_outpost.js   # Forest outpost map
│   └── industrial_port.js  # Industrial port map
└── README.md
```

---

## 🛠️ Tech Stack / 技术栈

- **HTML5 Canvas** — 2D UI, HUD & procedural textures
- **Three.js (r128)** — 3D scene, PBR materials, raycasting, viewmodels
- **Vanilla JavaScript** — No framework, zero dependencies
- **Pointer Lock API** — FPS mouse control
- **Web Audio API** — Layered procedural gunfire, foley & ambience

---

## ⚡ Performance / 性能

- 默认画质为「中」，若帧率持续偏低会自动依次：关后期/降分辨率 → 关阴影 → 低配天空/去 IBL/去法线 → 再降分辨率。
- 设置 → 画面 → **性能模式** 可手动强制最低档；也可在地址后加 `?perf=low`。
- 排查卡顿：`?perfdebug=1`，控制台读取 `window.__perfFrame`（js / render / calls / level）。
- 对低端核显/软件渲染，建议直接使用性能模式。

---

## 🚀 Quick Start

```bash
# Just open in browser — no build step needed
open index.html
# Or serve locally:
npx serve .
```

---

## 📊 Code Stats

- `game.js`: ~10,500 lines of game logic
- 11 single-responsibility rendering / audio / UX modules
- 3 hand-crafted maps with procedural set dressing
- 30+ procedurally modelled collectibles with 3D inspect
- Complete inventory system with drag-and-drop and 3D thumbnails
- 6-rarity loot system with 50+ item types

---

## 👤 Author

**Zcf695** — [GitHub](https://github.com/Zcf695)

---

## 📄 License

MIT — free to use, modify, and distribute.

---

*Good luck, operator. Search, fight, extract! 🎯*
