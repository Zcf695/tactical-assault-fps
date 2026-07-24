# 🎯 战术突击 - 搜打撤 (Tactical Assault: Search, Fight, Extract)

> A Delta Force-inspired browser-based tactical FPS with grid-based inventory system.
> 一款类似「三角洲行动」的浏览器端第一人称战术射击游戏。

[![Tech](https://img.shields.io/badge/tech-Three.js%20%7C%20Canvas%20%7C%20JS-blue)]()
[![Version](https://img.shields.io/badge/version-4.0-green)]()
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

### Combat / 战斗
- 🔫 **6 weapon tiers** — Common → Ultimate rarity system
- 🎒 **Grid inventory** — Drag-and-drop tetris-style backpack
- 🛡️ **Armor system** — Damage absorption with durability
- 💊 **Medical items** — Heal during combat
- 🤖 **AI enemies** — Patrol, chase, shoot, take cover

### Game Systems / 游戏系统
- 🗺️ **3 Maps** — Military Base, Forest Outpost, Industrial Port
- ⏱️ **2 Game Modes** — Normal (15min) & Hardcore (10min)
- 🧭 **Minimap** — Real-time enemy & extraction markers
- 💰 **Economy** — Cash rewards, hard mode entry fee
- 🏃 **Stamina** — Sprint & crouch mechanics
- 🎯 **ADS** — Aim-down-sights for precision

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
| 1 / 2 | Switch Weapons |
| Tab / B | Open Inventory |
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
├── game.js             # Core engine (3900+ lines)
├── map/
│   ├── military_base.js    # Military base map
│   ├── forest_outpost.js   # Forest outpost map
│   └── industrial_port.js  # Industrial port map
└── README.md
```

---

## 🛠️ Tech Stack / 技术栈

- **HTML5 Canvas** — 2D UI & HUD rendering
- **Three.js** — 3D scene, raycasting, weapon models
- **Vanilla JavaScript** — No framework, zero dependencies
- **Pointer Lock API** — FPS mouse control
- **Web Audio API** — Sound effects

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

- `game.js`: ~3,900 lines of game logic
- 3 hand-crafted maps with unique layouts
- Complete inventory system with drag-and-drop
- 6-rarity loot system with 20+ item types

---

## 👤 Author

**Zcf695** — [GitHub](https://github.com/Zcf695)

---

## 📄 License

MIT — free to use, modify, and distribute.

---

*Good luck, operator. Search, fight, extract! 🎯*
