/**
 * item_models.js
 * 战利品 3D 模型库
 *
 * 用途：
 * 1. 地面掉落物：真实模型替代发光球体（按稀有度加光环/光柱）；
 * 2. 库存检视：点击物品打开 3D 检视器，直接复用同一套模型。
 *
 * 设计：
 * - 全部由基础几何体程序化搭建，无外部资源依赖；
 * - 每个模型归一化到「最大边 = 1」，调用方按需缩放；
 * - 原型缓存 + clone(true)，clone 共享几何体与材质，开销极低；
 * - 地面掉落使用按材质合并后的低 draw call 版本（merge=true）。
 */
const ItemModels = (function () {
    'use strict';

    // ========== 共享材质 ==========
    const M = {
        steel: new THREE.MeshStandardMaterial({ color: 0x8b939a, metalness: 0.9, roughness: 0.34, envMapIntensity: 0.65 }),
        darkSteel: new THREE.MeshStandardMaterial({ color: 0x33383d, metalness: 0.85, roughness: 0.42, envMapIntensity: 0.8 }),
        gunmetal: new THREE.MeshStandardMaterial({ color: 0x1e2226, metalness: 0.7, roughness: 0.48, envMapIntensity: 0.7 }),
        polymer: new THREE.MeshStandardMaterial({ color: 0x24272b, metalness: 0.12, roughness: 0.82, envMapIntensity: 0.35 }),
        rubber: new THREE.MeshStandardMaterial({ color: 0x141619, metalness: 0.05, roughness: 0.96, envMapIntensity: 0.2 }),
        brass: new THREE.MeshStandardMaterial({ color: 0xa8803a, metalness: 0.95, roughness: 0.3, envMapIntensity: 0.85 }),
        gold: new THREE.MeshStandardMaterial({ color: 0xc99a2c, metalness: 1.0, roughness: 0.2, envMapIntensity: 0.95 }),
        copper: new THREE.MeshStandardMaterial({ color: 0xa9613a, metalness: 0.9, roughness: 0.35, envMapIntensity: 1.0 }),
        glass: new THREE.MeshStandardMaterial({ color: 0xa8d6ea, metalness: 0.15, roughness: 0.06, transparent: true, opacity: 0.42, envMapIntensity: 1.4 }),
        darkGlass: new THREE.MeshStandardMaterial({ color: 0x18242c, metalness: 0.35, roughness: 0.1, transparent: true, opacity: 0.7, envMapIntensity: 1.2 }),
        paper: new THREE.MeshStandardMaterial({ color: 0xd9d3c2, roughness: 0.92, metalness: 0 }),
        cash: new THREE.MeshStandardMaterial({ color: 0x9fae7a, roughness: 0.88, metalness: 0 }),
        cardboard: new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.94, metalness: 0 }),
        white: new THREE.MeshStandardMaterial({ color: 0xe7e9e6, roughness: 0.66, metalness: 0.02 }),
        red: new THREE.MeshStandardMaterial({ color: 0xb0342c, roughness: 0.6, metalness: 0.05 }),
        blue: new THREE.MeshStandardMaterial({ color: 0x2a4f80, roughness: 0.6, metalness: 0.05 }),
        green: new THREE.MeshStandardMaterial({ color: 0x3f6b46, roughness: 0.7, metalness: 0.05 }),
        olive: new THREE.MeshStandardMaterial({ color: 0x5c5f42, roughness: 0.85, metalness: 0.05 }),
        wood: new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.88, metalness: 0 }),
        screen: new THREE.MeshStandardMaterial({ color: 0x0d1b24, emissive: 0x2f7fb0, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.1 }),
        screenWarm: new THREE.MeshStandardMaterial({ color: 0x1a1410, emissive: 0xd08a3a, emissiveIntensity: 1.3, roughness: 0.25 }),
        pcb: new THREE.MeshStandardMaterial({ color: 0x1d3a2a, roughness: 0.72, metalness: 0.15 }),
        gem: new THREE.MeshStandardMaterial({ color: 0x8fd8ff, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.85, envMapIntensity: 2.0 }),
        redGem: new THREE.MeshStandardMaterial({ color: 0xd42030, metalness: 0.2, roughness: 0.06, transparent: true, opacity: 0.9, envMapIntensity: 2.2 }),
        leather: new THREE.MeshStandardMaterial({ color: 0x3a2b20, roughness: 0.9, metalness: 0.02 }),
    };

    // ========== 几何辅助 ==========
    function add(group, geo, mat, x, y, z, rx, ry, rz) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x || 0, y || 0, z || 0);
        if (rx) m.rotation.x = rx;
        if (ry) m.rotation.y = ry;
        if (rz) m.rotation.z = rz;
        m.castShadow = false;
        m.receiveShadow = false;
        group.add(m);
        return m;
    }
    function box(g, w, h, d, mat, x, y, z) { return add(g, new THREE.BoxGeometry(w, h, d), mat, x, y, z); }
    function cyl(g, rt, rb, h, seg, mat, x, y, z) { return add(g, new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat, x, y, z); }
    function sph(g, r, mat, x, y, z, seg) { return add(g, new THREE.SphereGeometry(r, seg || 12, (seg || 12) / 2), mat, x, y, z); }
    function torus(g, r, t, mat, x, y, z, arc) { return add(g, new THREE.TorusGeometry(r, t, 8, 20, arc || Math.PI * 2), mat, x, y, z); }

    // 文字标签贴图（弹药箱 / 医疗箱 / 金条）
    const _labelCache = {};
    function labelTexture(text, bg, fg, opts) {
        opts = opts || {};
        const key = text + '|' + bg + '|' + fg + '|' + (opts.w || 128) + '|' + (opts.h || 64);
        if (_labelCache[key]) return _labelCache[key];
        const c = document.createElement('canvas');
        c.width = opts.w || 128;
        c.height = opts.h || 64;
        const ctx = c.getContext('2d');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, c.width, c.height);
        if (opts.stripe) {
            ctx.fillStyle = opts.stripe;
            ctx.fillRect(0, c.height * 0.72, c.width, c.height * 0.1);
        }
        ctx.fillStyle = fg;
        ctx.font = 'bold ' + Math.floor(c.height * 0.42) + 'px "Arial Narrow", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, c.width / 2, c.height * 0.46);
        if (opts.sub) {
            ctx.font = 'bold ' + Math.floor(c.height * 0.16) + 'px Arial, sans-serif';
            ctx.fillText(opts.sub, c.width / 2, c.height * 0.85);
        }
        const tex = new THREE.CanvasTexture(c);
        if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = 4;
        _labelCache[key] = tex;
        return tex;
    }
    function labelMat(text, bg, fg, opts) {
        const m = new THREE.MeshStandardMaterial({ map: labelTexture(text, bg, fg, opts), roughness: 0.78, metalness: 0.05 });
        return m;
    }

    // ========== 模型构建器 ==========

    const B = {};

    // ---- 现金：捆扎钞票 ----
    B.cash = function () {
        const g = new THREE.Group();
        for (let i = 0; i < 3; i++) {
            box(g, 0.62, 0.055, 0.3, M.cash, 0, i * 0.06, 0);
        }
        box(g, 0.66, 0.02, 0.075, M.paper, 0, 0.09, 0);
        // 币捆纸条
        box(g, 0.07, 0.2, 0.31, M.paper, 0.1, 0.06, 0);
        return g;
    };

    // ---- 绷带：卷状 ----
    B.bandage = function () {
        const g = new THREE.Group();
        const roll = cyl(g, 0.24, 0.24, 0.24, 20, M.white, 0, 0.24, 0);
        roll.rotation.z = Math.PI / 2;
        const inner = cyl(g, 0.09, 0.09, 0.25, 16, M.cardboard, 0, 0.24, 0);
        inner.rotation.z = Math.PI / 2;
        // 松散布头
        box(g, 0.26, 0.14, 0.03, M.white, 0.16, 0.1, 0.12);
        return g;
    };

    // ---- 急救包：白色硬箱 + 红十字 ----
    B.medkit = function () {
        const g = new THREE.Group();
        box(g, 0.78, 0.42, 0.5, M.white, 0, 0.21, 0);
        box(g, 0.8, 0.06, 0.52, M.steel, 0, 0.44, 0);
        // 提手
        const h = torus(g, 0.1, 0.022, M.darkSteel, 0, 0.445, 0, Math.PI);
        // 红十字（两面）
        box(g, 0.3, 0.09, 0.015, M.red, 0, 0.24, 0.256);
        box(g, 0.09, 0.3, 0.015, M.red, 0, 0.24, 0.256);
        box(g, 0.3, 0.09, 0.015, M.red, 0, 0.24, -0.256);
        box(g, 0.09, 0.3, 0.015, M.red, 0, 0.24, -0.256);
        // 锁扣
        box(g, 0.09, 0.05, 0.03, M.steel, -0.24, 0.4, 0.26);
        box(g, 0.09, 0.05, 0.03, M.steel, 0.24, 0.4, 0.26);
        return g;
    };

    // ---- 止痛药：药瓶 + 散落药片 ----
    B.painkiller = function () {
        const g = new THREE.Group();
        cyl(g, 0.2, 0.2, 0.52, 18, M.white, 0, 0.26, 0);
        cyl(g, 0.16, 0.18, 0.12, 18, M.blue, 0, 0.56, 0);
        const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.202, 0.202, 0.26, 18, 1, true),
            labelMat('PAINKILLER', '#e8e8e8', '#1c3f6e', { w: 128, h: 64, stripe: '#2a6db0', sub: '30 CAPS' }));
        lb.position.y = 0.28;
        g.add(lb);
        for (let i = 0; i < 4; i++) {
            const p = sph(g, 0.055, M.white, 0.28 + Math.cos(i * 1.7) * 0.12, 0.055, 0.18 + Math.sin(i * 1.7) * 0.12, 8);
            p.scale.y = 0.5;
        }
        return g;
    };

    // ---- 弹药箱：按口径配色 + 标签 ----
    function ammoBox(color, label) {
        return function () {
            const g = new THREE.Group();
            const body = new THREE.MeshStandardMaterial({ color: color, roughness: 0.72, metalness: 0.25 });
            box(g, 0.72, 0.34, 0.4, body, 0, 0.17, 0);
            box(g, 0.76, 0.05, 0.44, M.darkSteel, 0, 0.36, 0);
            box(g, 0.3, 0.14, 0.012, labelMat(label, '#20241f', '#e8e2cf', { w: 128, h: 64 }), 0, 0.2, 0.206);
            // 卡扣
            box(g, 0.06, 0.08, 0.04, M.darkSteel, -0.26, 0.3, 0.22);
            box(g, 0.06, 0.08, 0.04, M.darkSteel, 0.26, 0.3, 0.22);
            // 露出的弹壳
            for (let i = 0; i < 3; i++) {
                cyl(g, 0.028, 0.028, 0.14, 8, M.brass, -0.16 + i * 0.16, 0.42, 0);
            }
            return g;
        };
    }
    B.pistolAmmo = ammoBox(0x4a4a3c, '9x19');
    B.rifleAmmo = ammoBox(0x4a5a3a, '5.56');
    B.shotgunAmmo = ammoBox(0x6a2f26, '12 GA');
    B.smgAmmo = ammoBox(0x3c4a5a, '.45 ACP');
    B.sniperAmmo = ammoBox(0x2f3a4a, '7.62');
    B.heavyAmmo = ammoBox(0x5a4a26, '12.7');

    // ---- 打火机 ----
    B.lighter = function () {
        const g = new THREE.Group();
        box(g, 0.24, 0.46, 0.12, M.darkSteel, 0, 0.23, 0);
        box(g, 0.25, 0.18, 0.13, M.steel, 0, 0.36, 0);
        box(g, 0.08, 0.06, 0.08, M.brass, 0, 0.49, 0);
        return g;
    };

    // ---- 螺丝钉 ----
    B.bolt = function () {
        const g = new THREE.Group();
        const shaft = cyl(g, 0.045, 0.045, 0.5, 8, M.steel, 0, 0.25, 0);
        shaft.rotation.z = Math.PI / 2;
        const head = cyl(g, 0.12, 0.12, 0.08, 6, M.steel, -0.29, 0.25, 0);
        head.rotation.z = Math.PI / 2;
        // 螺纹
        for (let i = 0; i < 5; i++) {
            const t = torus(g, 0.05, 0.012, M.darkSteel, -0.16 + i * 0.09, 0.25, 0);
            t.rotation.y = Math.PI / 2;
        }
        return g;
    };

    // ---- 胶带 ----
    B.tape = function () {
        const g = new THREE.Group();
        const roll = torus(g, 0.24, 0.09, M.paper, 0, 0.09, 0);
        roll.rotation.x = Math.PI / 2;
        const inner = cyl(g, 0.16, 0.16, 0.17, 18, M.cardboard, 0, 0.09, 0);
        return g;
    };

    // ---- 电池 ----
    B.battery = function () {
        const g = new THREE.Group();
        cyl(g, 0.14, 0.14, 0.46, 16, M.darkSteel, 0, 0.23, 0);
        cyl(g, 0.145, 0.145, 0.18, 16, labelMat('6T', '#20242a', '#e0b64a', { w: 128, h: 64 }), 0, 0.24, 0);
        cyl(g, 0.05, 0.05, 0.06, 10, M.brass, 0, 0.49, 0);
        return g;
    };

    // ---- 电线 / 线轴 ----
    B.wire = function () {
        const g = new THREE.Group();
        cyl(g, 0.3, 0.3, 0.34, 18, M.wood, 0, 0.17, 0);
        cyl(g, 0.31, 0.31, 0.1, 18, M.wood, 0, 0.05, 0);
        cyl(g, 0.31, 0.31, 0.1, 18, M.wood, 0, 0.3, 0);
        // 缠绕的线
        for (let i = 0; i < 7; i++) {
            const t = torus(g, 0.29, 0.04, M.copper, 0, 0.09 + i * 0.032, 0);
            t.rotation.x = Math.PI / 2;
        }
        return g;
    };

    // ---- 镜头 ----
    B.lens = function () {
        const g = new THREE.Group();
        cyl(g, 0.24, 0.26, 0.42, 20, M.darkSteel, 0, 0.21, 0);
        cyl(g, 0.21, 0.21, 0.06, 20, M.steel, 0, 0.44, 0);
        cyl(g, 0.17, 0.17, 0.02, 20, M.glass, 0, 0.47, 0);
        // 对焦环
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2;
            box(g, 0.02, 0.05, 0.02, M.steel, Math.cos(a) * 0.245, 0.28, Math.sin(a) * 0.245);
        }
        return g;
    };

    // ---- 头盔 ----
    B.helmet = function () {
        const g = new THREE.Group();
        const shell = add(g, new THREE.SphereGeometry(0.36, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), M.olive, 0, 0.36, 0);
        shell.scale.set(1, 0.95, 1.1);
        box(g, 0.5, 0.06, 0.18, M.darkSteel, 0, 0.3, 0.32); // 帽檐
        // 导轨 + NVG 座
        box(g, 0.12, 0.06, 0.1, M.darkSteel, 0, 0.52, 0.3);
        box(g, 0.36, 0.045, 0.05, M.darkSteel, 0, 0.5, 0.14);
        // 侧导轨
        box(g, 0.04, 0.05, 0.24, M.darkSteel, 0.34, 0.4, 0);
        box(g, 0.04, 0.05, 0.24, M.darkSteel, -0.34, 0.4, 0);
        // 悬挂带
        box(g, 0.03, 0.22, 0.03, M.leather, 0.26, 0.16, 0.16);
        box(g, 0.03, 0.22, 0.03, M.leather, -0.26, 0.16, 0.16);
        return g;
    };

    // ---- 防弹衣 ----
    B.armor = function () {
        const g = new THREE.Group();
        const plate = new THREE.MeshStandardMaterial({ color: 0x4b5240, roughness: 0.86, metalness: 0.05 });
        box(g, 0.6, 0.7, 0.26, plate, 0, 0.42, 0);
        // 前板 + MOLLE 织带
        for (let i = 0; i < 5; i++) {
            box(g, 0.5, 0.035, 0.02, M.leather, 0, 0.2 + i * 0.11, 0.135);
        }
        // 肩带
        box(g, 0.14, 0.28, 0.1, plate, -0.22, 0.78, 0);
        box(g, 0.14, 0.28, 0.1, plate, 0.22, 0.78, 0);
        // 侧板
        box(g, 0.1, 0.4, 0.22, M.darkSteel, -0.33, 0.42, 0);
        box(g, 0.1, 0.4, 0.22, M.darkSteel, 0.33, 0.42, 0);
        return g;
    };

    // ---- 手表 ----
    B.watch = function () {
        const g = new THREE.Group();
        const faceTex = labelTexture('12  3  6  9', '#11161c', '#d8e6ef', { w: 128, h: 128 });
        const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.25, metalness: 0.4, emissive: 0x0a1a24, emissiveIntensity: 0.4 });
        const bezel = torus(g, 0.26, 0.05, M.gold, 0, 0.3, 0);
        bezel.rotation.x = Math.PI / 2;
        const disc = cyl(g, 0.25, 0.25, 0.03, 28, faceMat, 0, 0.3, 0);
        cyl(g, 0.24, 0.24, 0.06, 28, M.steel, 0, 0.27, 0);
        // 表带
        box(g, 0.16, 0.05, 0.6, M.leather, 0, 0.3, -0.42);
        box(g, 0.16, 0.05, 0.6, M.leather, 0, 0.3, 0.42);
        // 表冠
        cyl(g, 0.04, 0.04, 0.07, 10, M.gold, 0.29, 0.3, 0).rotation.z = Math.PI / 2;
        return g;
    };

    // ---- 手机 ----
    B.phone = function () {
        const g = new THREE.Group();
        box(g, 0.34, 0.7, 0.06, M.darkSteel, 0, 0.35, 0);
        box(g, 0.3, 0.6, 0.008, M.screen, 0, 0.37, 0.035);
        box(g, 0.02, 0.06, 0.01, M.steel, 0.1, 0.62, 0.034);
        return g;
    };

    // ---- 威士忌 ----
    B.whiskey = function () {
        const g = new THREE.Group();
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x6a3a12, metalness: 0.15, roughness: 0.12, transparent: true, opacity: 0.88, envMapIntensity: 1.2 });
        cyl(g, 0.17, 0.18, 0.52, 16, glassMat, 0, 0.26, 0);
        cyl(g, 0.06, 0.16, 0.16, 16, glassMat, 0, 0.6, 0);
        cyl(g, 0.06, 0.06, 0.1, 12, glassMat, 0, 0.72, 0);
        cyl(g, 0.065, 0.065, 0.05, 12, M.brass, 0, 0.78, 0);
        const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.24, 16, 1, true),
            labelMat('WHISKY', '#2a1a0c', '#d8b16a', { w: 128, h: 96, sub: '12 YEARS' }));
        lb.position.y = 0.26;
        g.add(lb);
        return g;
    };

    // ---- 芯片 ----
    B.circuit = function () {
        const g = new THREE.Group();
        box(g, 0.5, 0.07, 0.5, M.pcb, 0, 0.06, 0);
        box(g, 0.24, 0.07, 0.24, M.darkSteel, 0, 0.12, 0);
        box(g, 0.16, 0.02, 0.16, M.screen, 0, 0.155, 0);
        // 引脚
        for (let i = 0; i < 6; i++) {
            box(g, 0.02, 0.03, 0.06, M.brass, -0.15 + i * 0.06, 0.075, 0.27);
            box(g, 0.02, 0.03, 0.06, M.brass, -0.15 + i * 0.06, 0.075, -0.27);
        }
        // 电容
        for (let i = 0; i < 3; i++) {
            cyl(g, 0.035, 0.035, 0.09, 8, M.steel, -0.18 + i * 0.18, 0.12, -0.18);
        }
        return g;
    };

    // ---- 香水 ----
    B.perfume = function () {
        const g = new THREE.Group();
        const bottleMat = new THREE.MeshStandardMaterial({ color: 0xc9a9d8, metalness: 0.2, roughness: 0.08, transparent: true, opacity: 0.75, envMapIntensity: 1.6 });
        const b = cyl(g, 0.2, 0.24, 0.46, 6, bottleMat, 0, 0.23, 0);
        b.rotation.y = Math.PI / 6;
        box(g, 0.14, 0.1, 0.14, M.gold, 0, 0.5, 0);
        box(g, 0.08, 0.06, 0.08, M.gold, 0, 0.58, 0);
        box(g, 0.2, 0.12, 0.008, labelMat('NOIR', '#ffffff', '#2a2230', { w: 128, h: 96 }), 0, 0.24, 0.235);
        return g;
    };

    // ---- 金条 ----
    B.gold = function () {
        const g = new THREE.Group();
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.24, 0.36), M.gold);
        bar.position.y = 0.12;
        g.add(bar);
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.28), M.gold);
        top.position.y = 0.26;
        g.add(top);
        // 印记
        box(g, 0.42, 0.008, 0.15, labelMat('999.9  FINE GOLD', '#c99a2c', '#5a3d05', { w: 256, h: 96 }), 0, 0.296, 0);
        // 倒角
        box(g, 0.82, 0.03, 0.38, M.gold, 0, 0.015, 0);
        return g;
    };

    // ---- 显卡：立起来的板卡，风扇朝 +Z（检视时正对镜头） ----
    B.gpu = function () {
        const g = new THREE.Group();
        // PCB 与背板
        box(g, 1.0, 0.42, 0.08, M.pcb, 0, 0, 0);
        box(g, 0.98, 0.40, 0.02, M.darkSteel, 0, 0, -0.055);
        // 导风罩
        box(g, 1.0, 0.42, 0.05, M.darkSteel, 0, 0, 0.065);
        // 三风扇（轴向 +Z）
        for (let i = 0; i < 3; i++) {
            const x = -0.32 + i * 0.32;
            add(g, new THREE.CylinderGeometry(0.145, 0.145, 0.028, 20), M.gunmetal, x, 0, 0.10, Math.PI / 2);
            add(g, new THREE.TorusGeometry(0.145, 0.016, 6, 22), M.steel, x, 0, 0.115);
            for (let b = 0; b < 7; b++) {
                const ang = b / 7 * Math.PI * 2;
                const blade = box(g, 0.115, 0.016, 0.012, M.steel,
                    x + Math.cos(ang) * 0.075, Math.sin(ang) * 0.075, 0.114);
                blade.rotation.z = ang;
            }
            // 风扇中心标
            add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.01, 10), M.brass, x, 0, 0.118, Math.PI / 2);
        }
        // 散热鳍片（侧面可见）
        for (let i = 0; i < 12; i++) {
            box(g, 0.94, 0.022, 0.012, M.steel, 0, -0.19 + i * 0.032, -0.02);
        }
        // 金手指与挡板
        box(g, 0.62, 0.05, 0.03, M.brass, 0, -0.23, 0.02);
        box(g, 0.03, 0.44, 0.10, M.steel, 0.505, 0, 0.03);
        // 供电接口
        box(g, 0.10, 0.045, 0.06, M.rubber, 0.30, 0.225, 0.06);
        box(g, 0.10, 0.045, 0.06, M.rubber, 0.42, 0.225, 0.06);
        // 侧面灯带
        box(g, 0.86, 0.012, 0.008, M.screen, 0, 0.20, 0.10);
        return g;
    };

    // ---- 军用电脑 ----
    B.laptop = function () {
        const g = new THREE.Group();
        box(g, 0.82, 0.06, 0.56, M.gunmetal, 0, 0.03, 0);
        // 键盘
        box(g, 0.7, 0.012, 0.3, M.darkSteel, 0, 0.065, -0.04);
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 12; c++) {
                box(g, 0.045, 0.01, 0.045, M.polymer, -0.3 + c * 0.055, 0.075, -0.14 + r * 0.062);
            }
        }
        // 屏幕
        const lid = new THREE.Group();
        box(lid, 0.82, 0.5, 0.04, M.gunmetal, 0, 0.25, 0);
        box(lid, 0.74, 0.42, 0.006, M.screenWarm, 0, 0.26, 0.024);
        lid.position.set(0, 0.06, -0.28);
        lid.rotation.x = -0.28;
        g.add(lid);
        // 触控板
        box(g, 0.2, 0.008, 0.12, M.darkSteel, 0, 0.068, 0.2);
        return g;
    };

    // ---- 象牙 ----
    B.ivory = function () {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0xe2d6bb, roughness: 0.42, metalness: 0.03 });
        for (let i = 0; i < 5; i++) {
            const t = i / 5;
            const seg = cyl(g, 0.12 - t * 0.05, 0.15 - t * 0.05, 0.26, 10, mat, t * 0.16, 0.24, t * t * 0.1);
            seg.rotation.z = -0.5 * t;
            seg.rotation.x = -0.18 * t;
        }
        cyl(g, 0.16, 0.18, 0.16, 10, M.wood, -0.02, 0.08, -0.02);
        return g;
    };

    // ---- 钻石 ----
    B.diamond = function () {
        const g = new THREE.Group();
        const geo = new THREE.OctahedronGeometry(0.42, 0);
        const m = new THREE.Mesh(geo, M.gem);
        m.position.y = 0.42;
        m.scale.set(1, 1.25, 1);
        m.rotation.y = Math.PI / 4;
        g.add(m);
        // 底部台面
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.16, 0.1, 8), M.gem);
        base.position.y = 0.12;
        g.add(base);
        return g;
    };

    // ---- 钻戒 ----
    B.red_ring = function () {
        const g = new THREE.Group();
        const ring = torus(g, 0.22, 0.045, M.gold, 0, 0.22, 0);
        ring.rotation.x = Math.PI / 2;
        // 爪镶
        for (let i = 0; i < 4; i++) {
            const a = i / 4 * Math.PI * 2 + Math.PI / 4;
            box(g, 0.03, 0.09, 0.03, M.gold, Math.cos(a) * 0.08, 0.31, Math.sin(a) * 0.08);
        }
        const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), M.redGem);
        d.position.y = 0.37;
        d.scale.y = 1.2;
        g.add(d);
        return g;
    };

    // ---- 古董怀表 ----
    B.red_watch = function () {
        const g = new THREE.Group();
        const body = cyl(g, 0.3, 0.3, 0.07, 24, M.gold, 0, 0.3, 0);
        const face = cyl(g, 0.26, 0.26, 0.075, 24,
            new THREE.MeshStandardMaterial({ color: 0xefe6cf, roughness: 0.35, metalness: 0.2 }), 0, 0.3, 0);
        // 指针
        box(g, 0.02, 0.2, 0.006, M.gunmetal, 0, 0.35, 0.037);
        box(g, 0.12, 0.018, 0.006, M.gunmetal, 0.06, 0.3, 0.037);
        // 表冠与链
        cyl(g, 0.05, 0.05, 0.08, 10, M.gold, 0, 0.62, 0);
        const chain = torus(g, 0.12, 0.018, M.gold, 0, 0.72, 0, Math.PI * 1.2);
        chain.rotation.z = Math.PI;
        for (let i = 0; i < 5; i++) {
            const c = torus(g, 0.05, 0.012, M.gold, -0.12 - i * 0.07, 0.62 - i * 0.05, 0);
            c.rotation.y = i % 2 ? 0 : Math.PI / 2;
        }
        return g;
    };

    // ---- 古代遗物：护符 ----
    B.relic = function () {
        const g = new THREE.Group();
        const stone = new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.82, metalness: 0.1 });
        box(g, 0.5, 0.6, 0.14, stone, 0, 0.38, 0);
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), M.redGem);
        gem.position.set(0, 0.42, 0.08);
        g.add(gem);
        // 金环
        const ring = torus(g, 0.16, 0.04, M.gold, 0, 0.7, 0);
        ring.rotation.x = Math.PI / 2;
        // 刻纹
        for (let i = 0; i < 3; i++) {
            box(g, 0.34, 0.02, 0.02, M.gold, 0, 0.16 + i * 0.14, 0.08);
        }
        return g;
    };

    // ---- 钥匙卡 ----
    B.keycard = function () {
        const g = new THREE.Group();
        box(g, 0.4, 0.02, 0.62, M.polymer, 0, 0.02, 0);
        box(g, 0.3, 0.008, 0.06, M.brass, 0, 0.032, -0.2);
        box(g, 0.16, 0.004, 0.16, M.screen, 0, 0.032, 0.14);
        return g;
    };

    // ---- 钥匙 ----
    B.key = function () {
        const g = new THREE.Group();
        const ring = torus(g, 0.12, 0.03, M.brass, 0, 0.12, 0);
        ring.rotation.x = Math.PI / 2;
        box(g, 0.04, 0.02, 0.5, M.brass, 0, 0.12, 0.34);
        box(g, 0.12, 0.02, 0.05, M.brass, 0.05, 0.12, 0.54);
        box(g, 0.09, 0.02, 0.04, M.brass, 0.04, 0.12, 0.44);
        return g;
    };

    // ---- 背包 / 胸挂 ----
    B.backpack = function () {
        const g = new THREE.Group();
        const fabric = new THREE.MeshStandardMaterial({ color: 0x4a4a38, roughness: 0.94, metalness: 0.02 });
        box(g, 0.6, 0.7, 0.36, fabric, 0, 0.38, 0);
        box(g, 0.5, 0.26, 0.14, fabric, 0, 0.3, 0.24); // 前袋
        box(g, 0.5, 0.14, 0.1, fabric, 0, 0.58, 0.2);
        // 肩带
        box(g, 0.1, 0.5, 0.06, M.leather, -0.2, 0.55, -0.2);
        box(g, 0.1, 0.5, 0.06, M.leather, 0.2, 0.55, -0.2);
        // 织带
        for (let i = 0; i < 3; i++) box(g, 0.44, 0.03, 0.02, M.leather, 0, 0.2 + i * 0.12, 0.185);
        return g;
    };

    B.rig = function () {
        const g = new THREE.Group();
        const fabric = new THREE.MeshStandardMaterial({ color: 0x4a4536, roughness: 0.92 });
        box(g, 0.66, 0.44, 0.2, fabric, 0, 0.3, 0);
        for (let i = 0; i < 3; i++) {
            box(g, 0.18, 0.24, 0.12, fabric, -0.22 + i * 0.22, 0.28, 0.13); // 弹匣袋
        }
        box(g, 0.34, 0.03, 0.02, M.leather, 0, 0.5, 0.11);
        return g;
    };

    // ---- 武器（简化但可辨识）----
    function gunBase(len, bodyColor) {
        const g = new THREE.Group();
        const bodyMat = bodyColor || M.gunmetal;
        box(g, len * 0.5, 0.1, 0.11, bodyMat, 0, 0.12, 0);       // 机匣
        box(g, len * 0.34, 0.06, 0.07, M.darkSteel, len * 0.28, 0.12, 0); // 护木
        cyl(g, 0.022, 0.022, len * 0.3, 8, M.steel, len * 0.62, 0.12, 0).rotation.z = Math.PI / 2;
        box(g, 0.07, 0.16, 0.08, M.polymer, -len * 0.14, 0.02, 0);   // 握把
        box(g, 0.1, 0.18, 0.07, M.darkSteel, -len * 0.24, 0.14, 0);   // 弹匣
        box(g, 0.16, 0.09, 0.07, M.polymer, -len * 0.42, 0.12, 0);    // 枪托
        return g;
    }
    B.pistol_w = function () {
        const g = new THREE.Group();
        box(g, 0.34, 0.11, 0.08, M.gunmetal, 0, 0.14, 0);
        box(g, 0.12, 0.05, 0.06, M.darkSteel, 0.2, 0.14, 0);
        box(g, 0.09, 0.18, 0.07, M.polymer, -0.1, 0.01, 0);
        box(g, 0.06, 0.1, 0.05, M.darkSteel, -0.1, 0.08, 0);
        return g;
    };
    B.rifle_w = function () { return gunBase(1.0, M.gunmetal); };
    B.shotgun_w = function () {
        const g = gunBase(0.95, M.darkSteel);
        // 泵动护木
        box(g, 0.2, 0.07, 0.09, M.wood, 0.28, 0.07, 0);
        return g;
    };
    B.smg_w = function () {
        const g = gunBase(0.66);
        box(g, 0.08, 0.26, 0.06, M.darkSteel, -0.03, -0.02, 0);
        return g;
    };
    B.sniper_w = function () {
        const g = gunBase(1.15, M.darkSteel);
        // 瞄准镜
        cyl(g, 0.05, 0.05, 0.4, 10, M.gunmetal, 0.05, 0.24, 0).rotation.z = Math.PI / 2;
        box(g, 0.03, 0.08, 0.03, M.darkSteel, 0.0, 0.18, 0);
        box(g, 0.03, 0.08, 0.03, M.darkSteel, 0.14, 0.18, 0);
        return g;
    };

    // ---- 通用高价藏品：宝石簇 + 金属底座 ----
    function treasureFallback(color) {
        return function () {
            const g = new THREE.Group();
            const base = cyl(g, 0.3, 0.36, 0.12, 8, M.darkSteel, 0, 0.06, 0);
            const gemMat = new THREE.MeshStandardMaterial({
                color: color, metalness: 0.3, roughness: 0.05,
                transparent: true, opacity: 0.9, envMapIntensity: 2.2,
            });
            for (let i = 0; i < 5; i++) {
                const a = i / 5 * Math.PI * 2;
                const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.1 + (i % 2) * 0.05, 0), gemMat);
                s.position.set(Math.cos(a) * 0.14, 0.2 + (i % 3) * 0.08, Math.sin(a) * 0.14);
                s.rotation.y = a;
                g.add(s);
            }
            const big = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), gemMat);
            big.position.y = 0.38;
            g.add(big);
            torus(g, 0.22, 0.03, M.gold, 0, 0.14, 0).rotation.x = Math.PI / 2;
            return g;
        };
    }
    B.treasure = treasureFallback(0x9fd8ff);

    // ========== 自定义收集品：按名称关键词映射到实体原型 ==========
    // 这些物品的图标来自 收藏品/*.png，保持原图不变；这里只负责 3D 实体。
    const _RARITY_HEX = {
        common: 0x9e9e9e, uncommon: 0x4caf50, rare: 0x2196f3,
        epic: 0x9c27b0, legendary: 0xff9800, ultimate: 0xf44336,
    };
    function _accentMat(rarity) {
        const c = _RARITY_HEX[rarity] || 0x9e9e9e;
        return new THREE.MeshStandardMaterial({ color: c, metalness: 0.55, roughness: 0.28, envMapIntensity: 0.9 });
    }
    function _gemMat(rarity) {
        const c = _RARITY_HEX[rarity] || 0x9fd8ff;
        return new THREE.MeshStandardMaterial({ color: c, metalness: 0.25, roughness: 0.06, transparent: true, opacity: 0.9, envMapIntensity: 1.8 });
    }

    function customJar(rarity) {
        const g = new THREE.Group();
        const a = _accentMat(rarity);
        cyl(g, 0.24, 0.24, 0.18, 18, M.gold, 0, 0.09, 0);
        cyl(g, 0.245, 0.245, 0.05, 18, a, 0, 0.20, 0);
        cyl(g, 0.20, 0.20, 0.02, 18, M.darkSteel, 0, 0.235, 0);
        box(g, 0.22, 0.09, 0.01, labelMat('CAVIAR', '#20242a', '#e2c164', { w: 128, h: 64 }), 0, 0.11, 0.242);
        return g;
    }

    function customBottle(rarity) {
        const g = new THREE.Group();
        const glassCol = rarity === 'ultimate' ? 0x3a1a22 : (rarity === 'legendary' ? 0x4a3212 : 0x1f3a2a);
        const glass = new THREE.MeshStandardMaterial({ color: glassCol, metalness: 0.15, roughness: 0.1, transparent: true, opacity: 0.94, envMapIntensity: 1.2 });
        cyl(g, 0.16, 0.18, 0.52, 16, glass, 0, 0.26, 0);
        cyl(g, 0.06, 0.16, 0.14, 16, glass, 0, 0.59, 0);
        cyl(g, 0.06, 0.06, 0.10, 12, glass, 0, 0.70, 0);
        cyl(g, 0.065, 0.065, 0.05, 12, _accentMat(rarity), 0, 0.77, 0);
        const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.22, 16, 1, true),
            labelMat('RESERVE', '#241a10', '#e0c184', { w: 128, h: 128, sub: 'VINTAGE' }));
        lb.position.y = 0.26;
        g.add(lb);
        return g;
    }

    function customCanister(rarity) {
        const g = new THREE.Group();
        const body = _accentMat(rarity);
        box(g, 0.48, 0.56, 0.24, body, 0, 0.28, 0);
        box(g, 0.50, 0.06, 0.26, M.darkSteel, 0, 0.57, 0);
        // 提手
        const h = torus(g, 0.11, 0.02, M.darkSteel, 0, 0.62, 0, Math.PI);
        // X 形加强筋
        box(g, 0.44, 0.05, 0.02, M.darkSteel, 0, 0.30, 0.13).rotation.z = 0.6;
        box(g, 0.44, 0.05, 0.02, M.darkSteel, 0, 0.30, 0.13).rotation.z = -0.6;
        cyl(g, 0.05, 0.05, 0.06, 10, M.brass, 0.14, 0.60, 0);
        return g;
    }

    function customClock(rarity) {
        const g = new THREE.Group();
        const wood = M.wood;
        box(g, 0.36, 0.62, 0.18, wood, 0, 0.31, 0);
        const face = cyl(g, 0.13, 0.13, 0.02, 20,
            new THREE.MeshStandardMaterial({ color: 0xece2c8, roughness: 0.5 }), 0, 0.45, 0.10);
        face.rotation.x = Math.PI / 2;
        box(g, 0.02, 0.10, 0.01, M.gunmetal, 0, 0.47, 0.115);
        box(g, 0.08, 0.015, 0.01, M.gunmetal, 0.03, 0.45, 0.115);
        // 摆锤
        box(g, 0.012, 0.22, 0.01, M.brass, 0, 0.17, 0.10);
        cyl(g, 0.045, 0.045, 0.02, 12, M.brass, 0, 0.08, 0.10).rotation.x = Math.PI / 2;
        return g;
    }

    function customMirror(rarity) {
        const g = new THREE.Group();
        const rim = torus(g, 0.26, 0.035, _accentMat(rarity), 0, 0.36, 0);
        rim.scale.set(1, 1.25, 1);
        const glass = cyl(g, 0.245, 0.245, 0.02, 24,
            new THREE.MeshStandardMaterial({ color: 0xb8d8e8, metalness: 0.9, roughness: 0.04, envMapIntensity: 2.0 }), 0, 0.36, 0);
        glass.rotation.x = Math.PI / 2;
        glass.scale.y = 1.0;
        box(g, 0.34, 0.05, 0.16, M.darkSteel, 0, 0.03, 0);
        box(g, 0.05, 0.10, 0.05, M.darkSteel, 0, 0.09, 0);
        return g;
    }

    function customDocument(rarity) {
        const g = new THREE.Group();
        for (let i = 0; i < 3; i++) box(g, 0.46, 0.008, 0.62, M.paper, 0.02 * i, 0.02 + i * 0.012, 0.01 * i);
        box(g, 0.10, 0.002, 0.52, M.gunmetal, 0.06, 0.045, 0);
        box(g, 0.30, 0.002, 0.006, M.gunmetal, 0, 0.045, -0.16);
        box(g, 0.30, 0.002, 0.006, M.gunmetal, 0, 0.045, -0.10);
        box(g, 0.30, 0.002, 0.006, M.gunmetal, 0, 0.045, -0.04);
        // 红色密级章
        const stamp = cyl(g, 0.055, 0.055, 0.002, 16,
            new THREE.MeshStandardMaterial({ color: 0xb02a22, roughness: 0.8 }), 0.14, 0.05, 0.18);
        // 文件夹
        box(g, 0.50, 0.006, 0.66, _accentMat(rarity), 0, 0.008, 0);
        return g;
    }

    function customCrystal(rarity, big) {
        const g = new THREE.Group();
        const mat = _gemMat(rarity);
        cyl(g, 0.26, 0.32, 0.07, 8, M.darkSteel, 0, 0.035, 0);
        const n = big ? 6 : 4;
        for (let i = 0; i < n; i++) {
            const a = i / n * Math.PI * 2;
            const s = 0.09 + (i % 2) * 0.05;
            const m = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), mat);
            m.position.set(Math.cos(a) * 0.13, 0.14 + (i % 3) * 0.07, Math.sin(a) * 0.13);
            m.rotation.y = a;
            m.scale.y = 1.5;
            g.add(m);
        }
        const main = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), mat);
        main.position.y = 0.33; main.scale.y = 1.7;
        g.add(main);
        return g;
    }

    function customDevice(rarity, withAntenna) {
        const g = new THREE.Group();
        box(g, 0.46, 0.30, 0.34, M.darkSteel, 0, 0.17, 0);
        box(g, 0.36, 0.18, 0.01, M.screen, 0, 0.20, 0.171);
        box(g, 0.44, 0.035, 0.36, M.gunmetal, 0, 0.335, 0);
        for (let i = 0; i < 3; i++) box(g, 0.22, 0.012, 0.01, M.brass, -0.08 + i * 0.08, 0.10, 0.172);
        box(g, 0.10, 0.05, 0.04, _accentMat(rarity), 0.16, 0.36, 0.10);
        if (withAntenna) {
            cyl(g, 0.008, 0.012, 0.36, 6, M.steel, 0.17, 0.52, -0.10);
            sph(g, 0.02, _accentMat(rarity), 0.17, 0.70, -0.10, 6);
        }
        return g;
    }

    function customServer(rarity) {
        const g = new THREE.Group();
        box(g, 0.34, 0.62, 0.36, M.gunmetal, 0, 0.31, 0);
        for (let i = 0; i < 5; i++) {
            box(g, 0.30, 0.075, 0.02, M.darkSteel, 0, 0.12 + i * 0.10, 0.185);
            box(g, 0.22, 0.010, 0.01, M.steel, -0.02, 0.12 + i * 0.10, 0.196);
            sph(g, 0.012, _accentMat(rarity), 0.115, 0.12 + i * 0.10, 0.198, 6);
        }
        box(g, 0.36, 0.03, 0.38, M.steel, 0, 0.62, 0);
        return g;
    }

    function customRadio(rarity, big) {
        const g = new THREE.Group();
        const s = big ? 1.45 : 1;
        g.scale.setScalar(s);
        box(g, 0.42, 0.30, 0.24, M.olive, 0, 0.15, 0);
        box(g, 0.22, 0.12, 0.02, M.darkGlass, -0.06, 0.18, 0.125);
        cyl(g, 0.045, 0.045, 0.02, 12, M.steel, 0.13, 0.17, 0.125).rotation.x = Math.PI / 2;
        cyl(g, 0.008, 0.012, 0.42, 6, M.steel, 0.15, 0.44, -0.06);
        box(g, 0.24, 0.03, 0.04, M.gunmetal, 0, 0.31, 0.02);
        return g;
    }

    function customCamera(rarity) {
        const g = new THREE.Group();
        box(g, 0.42, 0.28, 0.24, M.gunmetal, 0, 0.16, 0);
        cyl(g, 0.14, 0.16, 0.14, 18, M.darkSteel, 0, 0.16, 0.19).rotation.x = Math.PI / 2;
        cyl(g, 0.10, 0.10, 0.02, 18, M.glass, 0, 0.16, 0.265).rotation.x = Math.PI / 2;
        box(g, 0.16, 0.10, 0.10, M.gunmetal, 0, 0.35, 0);
        box(g, 0.18, 0.03, 0.06, M.steel, 0, 0.41, 0.02);
        sph(g, 0.05, _accentMat(rarity), 0.14, 0.34, 0.06, 8);
        return g;
    }

    function customEgg(rarity) {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
            color: _RARITY_HEX[rarity] || 0xd8c8a0, metalness: 0.45, roughness: 0.32, envMapIntensity: 1.0,
        });
        const egg = sph(g, 0.24, mat, 0, 0.30, 0, 16);
        egg.scale.set(1, 1.32, 1);
        cyl(g, 0.26, 0.26, 0.05, 16, M.darkSteel, 0, 0.03, 0);
        // 蛋壳斑点
        const dots = new THREE.MeshStandardMaterial({ color: 0x2a2a28, roughness: 0.7 });
        for (let i = 0; i < 9; i++) {
            const a = i * 2.4, y = 0.16 + (i % 4) * 0.10;
            sph(g, 0.022, dots, Math.cos(a) * 0.19, y, Math.sin(a) * 0.19, 6);
        }
        return g;
    }

    function customFigure(rarity, mech) {
        const g = new THREE.Group();
        const a = _accentMat(rarity);
        cyl(g, 0.24, 0.28, 0.06, 8, M.darkSteel, 0, 0.03, 0);
        if (mech) {
            box(g, 0.22, 0.28, 0.16, M.steel, 0, 0.26, 0);
            box(g, 0.12, 0.10, 0.12, a, 0, 0.46, 0);
            for (const sx of [-1, 1]) {
                box(g, 0.07, 0.22, 0.08, M.gunmetal, sx * 0.10, 0.13, 0);
                box(g, 0.08, 0.06, 0.10, M.gunmetal, sx * 0.14, 0.34, 0);
            }
        } else {
            // 简化人形手办：躯干 + 头 + 披风/裙摆
            const body = cyl(g, 0.10, 0.16, 0.28, 10, a, 0, 0.22, 0);
            sph(g, 0.075, M.paper, 0, 0.41, 0, 10);
            cyl(g, 0.17, 0.20, 0.16, 10, a, 0, 0.11, 0);
            for (const sx of [-1, 1]) box(g, 0.035, 0.16, 0.035, M.paper, sx * 0.13, 0.24, 0);
        }
        return g;
    }

    function customFossil(rarity) {
        const g = new THREE.Group();
        const bone = new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 0.62, metalness: 0.05 });
        const base = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), M.darkSteel);
        base.position.y = 0.05; base.scale.y = 0.4; g.add(base);
        for (let i = 0; i < 3; i++) {
            const claw = cyl(g, 0.01, 0.075, 0.34, 8, bone, (i - 1) * 0.07, 0.22, 0);
            claw.rotation.z = (i - 1) * 0.28;
            claw.rotation.x = 0.25;
        }
        cyl(g, 0.05, 0.08, 0.12, 8, bone, 0, 0.08, 0.05);
        return g;
    }

    function customAnimal(rarity) {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0xd8a838, metalness: 0.85, roughness: 0.25, envMapIntensity: 1.1 });
        const body = sph(g, 0.22, mat, 0, 0.20, 0, 12);
        body.scale.set(0.7, 0.55, 1.35);
        const head = sph(g, 0.13, mat, 0, 0.26, 0.28, 10);
        head.scale.set(0.9, 0.9, 1.2);
        const tail = cyl(g, 0.02, 0.07, 0.24, 8, mat, 0, 0.22, -0.30);
        tail.rotation.x = Math.PI / 2.4;
        for (const sx of [-1, 1]) box(g, 0.05, 0.16, 0.05, mat, sx * 0.10, 0.08, 0.10);
        box(g, 0.34, 0.04, 0.5, M.darkSteel, 0, 0.02, 0);
        return g;
    }

    function customGold(rarity, kind) {
        if (kind === 'coin') {
            const g = new THREE.Group();
            for (let i = 0; i < 4; i++) cyl(g, 0.20, 0.20, 0.025, 20, M.gold, 0, 0.02 + i * 0.026, 0);
            cyl(g, 0.06, 0.06, 0.01, 12, M.brass, 0, 0.13, 0);
            return g;
        }
        if (kind === 'medal') {
            const g = new THREE.Group();
            const disc = cyl(g, 0.18, 0.18, 0.03, 20, M.gold, 0, 0.20, 0);
            disc.rotation.x = Math.PI / 2;
            torus(g, 0.18, 0.018, M.brass, 0, 0.20, 0).rotation.x = Math.PI / 2;
            const ribbonMat = new THREE.MeshStandardMaterial({ color: _RARITY_HEX[rarity] || 0xb02a22, roughness: 0.75 });
            box(g, 0.13, 0.26, 0.01, ribbonMat, 0, 0.36, 0).rotation.z = 0.25;
            return g;
        }
        return B.gold();
    }

    function customCard(rarity) {
        const g = new THREE.Group();
        box(g, 0.44, 0.008, 0.64, _accentMat(rarity), 0, 0.02, 0);
        box(g, 0.38, 0.004, 0.58, M.gold, 0, 0.026, 0);
        box(g, 0.30, 0.003, 0.46, M.darkSteel, 0, 0.030, 0);
        cyl(g, 0.08, 0.08, 0.002, 16, M.gold, 0, 0.032, 0);
        return g;
    }

    function customChain(rarity) {
        const g = new THREE.Group();
        torus(g, 0.14, 0.035, M.steel, 0, 0.16, 0).rotation.x = Math.PI / 2;
        for (let i = 0; i < 5; i++) {
            const t = torus(g, 0.05, 0.016, M.steel, 0.12 + i * 0.07, 0.10 - i * 0.015, 0);
            t.rotation.y = i % 2 ? 0 : Math.PI / 2;
        }
        box(g, 0.10, 0.06, 0.06, _accentMat(rarity), 0.0, 0.26, 0);
        return g;
    }

    function customBlade(rarity) {
        const g = new THREE.Group();
        box(g, 0.34, 0.03, 0.12, M.darkSteel, 0, 0.02, 0);
        const blade = box(g, 0.26, 0.03, 0.05, M.steel, 0.02, 0.06, 0);
        blade.rotation.z = 0.05;
        box(g, 0.10, 0.035, 0.045, _accentMat(rarity), -0.14, 0.06, 0);
        box(g, 0.05, 0.02, 0.12, M.gunmetal, 0.18, 0.03, 0);
        return g;
    }

    function customGunDisplay(rarity) {
        const g = new THREE.Group();
        box(g, 0.9, 0.03, 0.26, M.wood, 0, 0.02, 0);
        const gun = gunBase(0.72, M.gunmetal);
        gun.position.set(0, 0.10, 0);
        gun.rotation.y = 0.0;
        g.add(gun);
        box(g, 0.06, 0.06, 0.06, _accentMat(rarity), -0.34, 0.07, 0);
        return g;
    }

    function customBarrel(rarity) {
        const g = new THREE.Group();
        cyl(g, 0.20, 0.24, 0.42, 14, _accentMat(rarity), 0, 0.21, 0);
        for (const y of [0.08, 0.21, 0.34]) cyl(g, 0.225, 0.225, 0.03, 14, M.darkSteel, 0, y, 0);
        cyl(g, 0.06, 0.06, 0.03, 10, M.brass, 0, 0.44, 0);
        return g;
    }

    function customMedDevice(rarity) {
        const g = new THREE.Group();
        box(g, 0.44, 0.40, 0.30, M.white, 0, 0.22, 0);
        box(g, 0.30, 0.18, 0.02, M.screen, 0, 0.28, 0.16);
        box(g, 0.12, 0.03, 0.01, new THREE.MeshStandardMaterial({ color: 0xb02a22, roughness: 0.7 }), 0, 0.15, 0.165);
        cyl(g, 0.02, 0.02, 0.26, 8, M.rubber, 0.16, 0.12, 0.16);
        cyl(g, 0.02, 0.02, 0.26, 8, M.rubber, -0.16, 0.12, 0.16);
        box(g, 0.36, 0.035, 0.26, M.steel, 0, 0.43, 0);
        return g;
    }

    function customBattery(rarity) {
        const g = new THREE.Group();
        box(g, 0.34, 0.24, 0.24, M.gunmetal, 0, 0.13, 0);
        for (let i = 0; i < 3; i++) {
            cyl(g, 0.055, 0.055, 0.22, 12, _accentMat(rarity), -0.09 + i * 0.09, 0.28, 0);
            cyl(g, 0.018, 0.018, 0.03, 8, M.brass, -0.09 + i * 0.09, 0.40, 0);
        }
        box(g, 0.10, 0.02, 0.02, M.brass, 0.0, 0.10, 0.13);
        return g;
    }

    function customTool(rarity, kind) {
        const g = new THREE.Group();
        const handle = new THREE.MeshStandardMaterial({ color: 0x3a3a36, roughness: 0.9 });
        if (kind === 'drill') {
            box(g, 0.10, 0.20, 0.12, _accentMat(rarity), 0, 0.14, 0);
            cyl(g, 0.04, 0.04, 0.16, 8, M.steel, 0, 0.14, 0.14).rotation.x = Math.PI / 2;
            box(g, 0.06, 0.14, 0.05, handle, 0, 0.02, 0.02);
        } else {
            box(g, 0.05, 0.32, 0.05, handle, 0, 0.17, 0);
            box(g, 0.18, 0.06, 0.06, M.steel, 0, 0.33, 0);
        }
        return g;
    }

    function customMaterial(rarity) {
        const g = new THREE.Group();
        const sack = sph(g, 0.24, new THREE.MeshStandardMaterial({ color: 0xb0a078, roughness: 0.95 }), 0, 0.22, 0, 12);
        sack.scale.set(0.9, 1.05, 0.9);
        cyl(g, 0.10, 0.06, 0.09, 10, M.cardboard, 0, 0.45, 0);
        box(g, 0.18, 0.10, 0.01, labelMat('MATERIAL', '#c8b890', '#3a3020', { w: 128, h: 64 }), 0, 0.24, 0.20);
        return g;
    }

    function customTrophy(rarity) {
        const g = new THREE.Group();
        cyl(g, 0.16, 0.20, 0.06, 12, M.darkSteel, 0, 0.03, 0);
        cyl(g, 0.05, 0.05, 0.12, 10, M.gold, 0, 0.12, 0);
        cyl(g, 0.16, 0.10, 0.20, 14, M.gold, 0, 0.28, 0);
        torus(g, 0.10, 0.015, M.gold, 0.16, 0.28, 0).rotation.y = Math.PI / 2;
        torus(g, 0.10, 0.015, M.gold, -0.16, 0.28, 0).rotation.y = Math.PI / 2;
        cyl(g, 0.17, 0.17, 0.02, 14, _accentMat(rarity), 0, 0.39, 0);
        return g;
    }

    function customMap(rarity) {
        const g = new THREE.Group();
        const roll = cyl(g, 0.07, 0.07, 0.52, 12, M.paper, 0, 0.10, 0);
        roll.rotation.z = Math.PI / 2;
        const roll2 = cyl(g, 0.07, 0.07, 0.52, 12, M.paper, 0, 0.10, 0.12);
        roll2.rotation.z = Math.PI / 2;
        box(g, 0.10, 0.02, 0.30, _accentMat(rarity), 0.10, 0.10, 0.06);
        return g;
    }

    function customPainting(rarity) {
        const g = new THREE.Group();
        box(g, 0.50, 0.64, 0.05, M.gold, 0, 0.34, 0);
        // 抽象画芯
        const c = document.createElement('canvas');
        c.width = 128; c.height = 160;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#2a3528'; ctx.fillRect(0, 0, 128, 160);
        ctx.fillStyle = '#b06a3a'; ctx.beginPath(); ctx.arc(48, 70, 32, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d8c890'; ctx.fillRect(70, 20, 40, 60);
        ctx.fillStyle = '#3a5a72'; ctx.fillRect(14, 110, 100, 34);
        const tex = new THREE.CanvasTexture(c);
        if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
        box(g, 0.44, 0.58, 0.006, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), 0, 0.34, 0.03);
        box(g, 0.10, 0.04, 0.12, M.darkSteel, 0, 0.02, 0);
        return g;
    }

    function customArtifact(rarity) {
        const g = new THREE.Group();
        const core = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), _gemMat(rarity));
        core.position.y = 0.30;
        core.rotation.set(0.4, 0.6, 0.2);
        g.add(core);
        const ring = torus(g, 0.28, 0.015, M.gold, 0, 0.30, 0);
        ring.rotation.x = Math.PI / 2.4;
        const ring2 = torus(g, 0.30, 0.012, M.gold, 0, 0.30, 0);
        ring2.rotation.y = Math.PI / 2.5;
        cyl(g, 0.22, 0.26, 0.06, 8, M.darkSteel, 0, 0.03, 0);
        return g;
    }

    function customVase(rarity) {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0xdfd8c4, roughness: 0.35, metalness: 0.1 });
        cyl(g, 0.10, 0.16, 0.20, 14, mat, 0, 0.10, 0);
        sph(g, 0.18, mat, 0, 0.28, 0, 14).scale.y = 1.1;
        cyl(g, 0.08, 0.13, 0.16, 14, mat, 0, 0.46, 0);
        cyl(g, 0.09, 0.09, 0.02, 14, _accentMat(rarity), 0, 0.545, 0);
        return g;
    }

    function customWristwatch(rarity) {
        const g = new THREE.Group();
        const faceTex = labelTexture('12  3  6  9', '#111820', '#dce8f2', { w: 128, h: 128 });
        const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.28, metalness: 0.3, emissive: 0x0a1620, emissiveIntensity: 0.25 });
        // 表壳（轴向 Z，正对镜头）
        add(g, new THREE.CylinderGeometry(0.24, 0.24, 0.07, 28), M.gold, 0, 0.36, 0, Math.PI / 2);
        add(g, new THREE.TorusGeometry(0.235, 0.028, 8, 26), M.gold, 0, 0.36, 0.038);
        add(g, new THREE.CylinderGeometry(0.205, 0.205, 0.012, 28), faceMat, 0, 0.36, 0.048, Math.PI / 2);
        // 指针
        box(g, 0.014, 0.13, 0.006, M.gunmetal, 0, 0.40, 0.056);
        box(g, 0.09, 0.012, 0.006, M.gunmetal, 0.04, 0.36, 0.056);
        box(g, 0.006, 0.006, 0.008, M.brass, 0, 0.36, 0.06);
        // 表冠
        add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), M.gold, 0.26, 0.36, 0, 0, 0, Math.PI / 2);
        // 展示支架
        box(g, 0.36, 0.03, 0.24, M.darkSteel, 0, 0.015, 0.02);
        box(g, 0.05, 0.20, 0.05, _accentMat(rarity), 0, 0.13, -0.02);
        return g;
    }

    function customBall(rarity) {
        const g = new THREE.Group();
        const ball = sph(g, 0.24, new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.62 }), 0, 0.26, 0, 18);
        ball.scale.set(1, 1, 1);
        const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI * 2 / 6;
            const p = sph(g, 0.055, dark, Math.cos(a) * 0.20, 0.26 + (i % 2) * 0.06, Math.sin(a) * 0.20, 6);
            p.scale.z = 0.4;
        }
        torus(g, 0.24, 0.012, _accentMat(rarity), 0, 0.26, 0).rotation.x = Math.PI / 2;
        cyl(g, 0.14, 0.18, 0.05, 12, M.darkSteel, 0, 0.025, 0);
        return g;
    }

    // 关键词 → 原型。顺序很重要：先匹配更具体的形态，避免“万用表→钟表”这类误判。
    const CUSTOM_RULES = [
        { k: ['鱼子酱'], b: function (r) { return customJar(r); } },
        { k: ['鸟蛋', '小蛋', '小圈', '小龙', '小娜', '小登', '小宅'], b: function (r) { return customEgg(r); } },
        { k: ['香槟', '龙舌兰', '酒', '咖啡豆', '威士忌'], b: function (r) { return customBottle(r); } },
        { k: ['手表', '怀表', '机械表', '表带'], b: function (r) { return customWristwatch(r); } },
        { k: ['座钟', '钟表'], b: function (r) { return customClock(r); } },
        { k: ['眼镜'], b: function (r) { return customDevice(r, false); } },
        { k: ['镜'], b: function (r) { return customMirror(r); } },
        { k: ['无人机'], b: function (r) { return customFigure(r, true); } },
        { k: ['手办', '半身像', '陶俑', '机甲', '机器人', '工蜂', '步战车', '坦克模型'], b: function (r) { return customFigure(r, true); } },
        { k: ['化石', '骨', '爪', '象牙'], b: function (r) { return customFossil(r); } },
        { k: ['鲤', '鳄鱼', '瞪羚', '玄武'], b: function (r) { return customAnimal(r); } },
        { k: ['服务器', '阵列', '超算', '磁盘', '云存储'], b: function (r) { return customServer(r); } },
        { k: ['显卡'], b: function (r) { return B.gpu(); } },
        { k: ['笔记本电脑', '军用电脑', '电脑'], b: function (r) { return B.laptop(); } },
        { k: ['主板', '内存', '硬盘', '声卡', '芯片', '终端', '显示屏', '雷达', '传感器', '敏感器', '接收器', '定位', '激光', '干扰', '万用表', '测距', '扫描', '电话', '手柄', '望远镜', '浮力', '打字机', '留声机'], b: function (r) { return customDevice(r, false); } },
        { k: ['足球'], b: function (r) { return customBall(r); } },
        { k: ['马'], b: function (r) { return customAnimal(r); } },
        { k: ['鸟窝'], b: function (r) { return customEgg(r); } },
        { k: ['电台', '收音机', '通信', '天线', '通讯'], b: function (r) { return customRadio(r, true); } },
        { k: ['摄影机', '相机', '摄像头'], b: function (r) { return customCamera(r); } },
        { k: ['呼吸机', '除颤', 'ECMO', '生命支持', '输液', '血氧', '额温', '听诊', '支架', '医疗'], b: function (r) { return customMedDevice(r); } },
        { k: ['燃料', '瓦斯', '电池', '电源', '反应堆', '聚变', '冷却', '供能'], b: function (r) { return customBattery(r); } },
        { k: ['金条', '金笔', '扳指', '头冠', '冠', '首饰'], b: function (r) { return customGold(r, 'bar'); } },
        { k: ['金币'], b: function (r) { return customGold(r, 'coin'); } },
        { k: ['奖杯', '奖章', '勋章', '饰章', '功绩', '勇者之证'], b: function (r) { return customTrophy(r); } },
        { k: ['卡牌', '通行证'], b: function (r) { return customCard(r); } },
        { k: ['脚镣', '链'], b: function (r) { return customChain(r); } },
        { k: ['滑膛枪', '手弩'], b: function (r) { return customGunDisplay(r); } },
        { k: ['切割刀', '破障锤', '粉碎钳', '手锯', '破门'], b: function (r) { return customBlade(r); } },
        { k: ['桶'], b: function (r) { return customBarrel(r); } },
        { k: ['胶带', '刷', '火柴', '工具', '胶布', '牙膏', '卡尺', '电钻', '吸尘', '扫拖'], b: function (r) { return customTool(r); } },
        { k: ['纤维', '钢', '火药', '水泥', '碳纤维', '零件', '子弹', '炮弹', '级弹', '铀', '聚乙烯', '芳纶'], b: function (r) { return customMaterial(r); } },
        { k: ['花瓶', '瓷'], b: function (r) { return customVase(r); } },
        { k: ['画', '乐谱'], b: function (r) { return customPainting(r); } },
        { k: ['天圆地方', '纵横', '魔方', '量子', '暗星'], b: function (r) { return customArtifact(r); } },
        { k: ['地图', '图纸', '档案', '数据', '记录', '音源', '磁带', '录像'], b: function (r) { return customDocument(r); } },
        { k: ['源石', '宝石', '泪', '钻', '水晶', '核心', '海洋之心', '非洲之心'], b: function (r) { return customCrystal(r, true); } },
    ];

    function buildCustom(def) {
        const name = (def && def.name) || '';
        const rarity = (def && def.rarity) || 'common';
        for (let i = 0; i < CUSTOM_RULES.length; i++) {
            const rule = CUSTOM_RULES[i];
            for (let j = 0; j < rule.k.length; j++) {
                if (name.indexOf(rule.k[j]) >= 0) return rule.b(rarity, name);
            }
        }
        // 未命中关键词：按稀有度给一个宝石簇，避免所有自定义收集品长同一个样子
        return customCrystal(rarity, rarity === 'ultimate' || rarity === 'legendary');
    }

    // ---- 稀有度兜底 ----
    const RARITY_FALLBACK = {
        common: function () { return B.cash(); },
        uncommon: function () { return B.battery(); },
        rare: function () { return B.circuit(); },
        epic: function () { return B.circuit(); },
        legendary: function () { return B.gold(); },
        ultimate: function () { return B.treasure(); },
    };

    // ========== 合并工具（地面掉落降 draw call） ==========
    function mergeGeometries(geos) {
        let total = 0;
        const list = [];
        for (const g of geos) {
            const ng = g.index ? g.toNonIndexed() : g;
            if (ng !== g) g.dispose();
            list.push(ng);
            total += ng.attributes.position.count;
        }
        const pos = new Float32Array(total * 3);
        const nor = new Float32Array(total * 3);
        const uv = new Float32Array(total * 2);
        let po = 0, uo = 0;
        for (const g of list) {
            pos.set(g.attributes.position.array, po);
            if (g.attributes.normal) nor.set(g.attributes.normal.array, po);
            if (g.attributes.uv) uv.set(g.attributes.uv.array, uo);
            po += g.attributes.position.count * 3;
            uo += g.attributes.position.count * 2;
        }
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        out.computeBoundingSphere();
        return out;
    }

    function mergeGroup(group) {
        group.updateMatrixWorld(true);
        const buckets = new Map();
        group.traverse(function (o) {
            if (!o.isMesh) return;
            const key = o.material.uuid;
            let b = buckets.get(key);
            if (!b) { b = { mat: o.material, geos: [] }; buckets.set(key, b); }
            const g = o.geometry.clone();
            g.applyMatrix4(o.matrixWorld);
            b.geos.push(g);
        });
        const out = new THREE.Group();
        buckets.forEach(function (b) {
            const merged = mergeGeometries(b.geos);
            const mesh = new THREE.Mesh(merged, b.mat);
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            out.add(mesh);
        });
        return out;
    }

    // ========== 归一化 / 缓存 ==========
    const _proto = {};

    function buildRaw(id) {
        let builder = B[id];
        const def = (typeof ITEMS !== 'undefined' && ITEMS[id]) || null;
        // 自定义收集品：图标保留原图，但地面/检视需要有实体模型
        const isCustom = !!(def && (def.img || /^(rc_|wc_|bc_|pc_|gc_)/.test(id)));
        if (!builder && isCustom) {
            try {
                return buildCustom(def);
            } catch (e) {
                console.warn('[ItemModels] 自定义模型生成失败', id, e);
            }
        }
        if (!builder) {
            const rarity = def ? def.rarity : 'common';
            builder = RARITY_FALLBACK[rarity] || B.treasure;
            // 武器/装备按类型再兜底
            if (def) {
                if (def.type === 'helmet') builder = B.helmet;
                else if (def.type === 'armor') builder = B.armor;
                else if (def.type === 'backpack') builder = B.backpack;
                else if (def.type === 'chestRig') builder = B.rig;
                else if (def.type === 'keycard') builder = B.keycard;
                else if (def.type === 'weapon') builder = B[def.weapon + '_w'] || B.rifle_w;
            }
        }
        return builder();
    }

    /**
     * @param {string} id 物品 id
     * @param {object} opt { merged:boolean, size:number, ground:boolean }
     */
    function create(id, opt) {
        opt = opt || {};
        const merged = !!opt.merged;
        const key = id + (merged ? '|m' : '|d');
        let proto = _proto[key];
        if (!proto) {
            let base = buildRaw(id);
            if (merged) base = mergeGroup(base);
            // 归一化：最大边 = 1，几何中心对齐原点
            const bbox = new THREE.Box3().setFromObject(base);
            const size = new THREE.Vector3();
            bbox.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            const s = 1 / maxDim;
            base.scale.setScalar(s);
            base.position.set(-center.x * s, -center.y * s, -center.z * s);
            const holder = new THREE.Group();
            holder.add(base);
            holder.userData.height = size.y * s;
            holder.userData.radius = Math.max(size.x, size.z) * s * 0.5;
            _proto[key] = holder;
            proto = holder;
        }
        const out = proto.clone(true);
        const scale = opt.size || 1;
        out.scale.setScalar(scale);
        const h = proto.userData.height * scale;
        out.userData.height = h;
        out.userData.radius = proto.userData.radius * scale;
        // ground=true 时把模型抬到地面之上（原型以中心为原点）
        if (opt.ground) out.position.y = h * 0.5;
        return out;
    }

    return {
        create: create,
        materials: M,
        labelTexture: labelTexture,
        hasModel: function (id) { return !!B[id]; },
    };
})();
