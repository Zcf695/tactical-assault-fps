/**
 * world_props.js
 * 关卡道具增强：集装箱堆场、路障、沙袋、托盘、路灯、铁丝网、水洼、路面标线、屋顶设备
 *
 * 设计原则：
 * - 纯程序化、按地图名固定种子，同一张图每次布局一致；
 * - 只做「视觉与掩体」增强，不改变地图原有建筑与撤离点；
 * - 所有可碰撞道具登记到 obstacles，沿用现有 AABB/半径碰撞；
 * - 材质按颜色/类型复用，配合后续静态合批降低 draw call。
 */
const WorldProps = (function () {
    'use strict';

    // 颜色材质缓存：避免每个道具一份材质导致合批失效
    const _matCache = {};
    /**
     * 道具共用材质工厂。
     *
     * envMapIntensity 默认 0.12 而不是 Three.js 的 1.0：
     * 地面在 graphics_enhancement 里被设成 0.18，道具若吃满 IBL，
     * 箱子/路障会比脚下的地亮 5 倍，看起来像塑料玩具而不是沾灰的金属。
     * 这个值同时必须进缓存 key —— 否则同一颜色但不同反射强度会互相串材质，
     * 而串材质是静默的（拿到的对象看着没毛病，只是反光不对）。
     */
    function mat(color, opt) {
        opt = opt || {};
        const envI = opt.envMapIntensity == null ? 0.12 : opt.envMapIntensity;
        const key = color + '|' + (opt.roughness || 0.8) + '|' + (opt.metalness || 0) +
            '|' + (opt.emissive || 0) + '|' + (opt.emissiveIntensity || 0) + '|' + envI;
        if (_matCache[key]) return _matCache[key];
        const m = new THREE.MeshStandardMaterial({
            color: color,
            roughness: opt.roughness == null ? 0.8 : opt.roughness,
            metalness: opt.metalness || 0,
            emissive: opt.emissive || 0x000000,
            emissiveIntensity: opt.emissiveIntensity || 0,
            envMapIntensity: envI,
        });
        _matCache[key] = m;
        return m;
    }

    function mesh(geo, material, x, y, z, surface) {
        const m = new THREE.Mesh(geo, material);
        m.position.set(x, y, z);
        m.castShadow = true;
        m.receiveShadow = true;
        if (surface) m.userData.surface = surface;
        return m;
    }

    // ========== 铁丝网纹理 ==========
    let _chainTex = null;
    function chainTexture() {
        if (_chainTex) return _chainTex;
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, 64, 64);
        ctx.strokeStyle = 'rgba(190,196,202,0.95)';
        ctx.lineWidth = 2;
        for (let i = -64; i < 128; i += 16) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 64, 64); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(i, 64); ctx.lineTo(i + 64, 0); ctx.stroke();
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
        _chainTex = tex;
        return tex;
    }

    // ========== 各类道具 ==========

    const CONTAINER_COLORS = [0x8a4a3a, 0x3a5a72, 0x4a6a4a, 0x9a6a32, 0x5a5a60, 0x2f4a52, 0x7a3a32, 0x6a6a58];

    function makeContainer(env, obstacles, x, z, horizontal, color, level) {
        const L = 6.0, W = 2.42, H = 2.4;
        const halfW = horizontal ? L / 2 : W / 2;
        const halfD = horizontal ? W / 2 : L / 2;
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        if (!horizontal) g.rotation.y = Math.PI / 2;

        const body = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), mat(color, { roughness: 0.62, metalness: 0.35 }));
        body.position.y = H / 2;
        body.castShadow = true; body.receiveShadow = true;
        body.userData.surface = 'container';
        g.add(body);

        // 角件
        const cornerMat = mat(0x3a3a3c, { roughness: 0.5, metalness: 0.7 });
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            const c = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.26), cornerMat);
            c.position.set(sx * (L / 2 - 0.08), 0.13, sz * (W / 2 - 0.1));
            g.add(c);
            const c2 = c.clone();
            c2.position.y = H - 0.13;
            g.add(c2);
        }
        // 门缝与锁杆（尾端）
        const doorMat = mat(0x2c2e30, { roughness: 0.6, metalness: 0.6 });
        const doorLine = new THREE.Mesh(new THREE.BoxGeometry(0.04, H - 0.3, 0.03), doorMat);
        doorLine.position.set(L / 2 + 0.01, H / 2, 0);
        g.add(doorLine);
        for (const dz of [-0.55, 0.55]) {
            const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, H - 0.34, 6), doorMat);
            rod.position.set(L / 2 + 0.04, H / 2, dz);
            g.add(rod);
        }
        // 顶部标识条
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.02), mat(0xd8d2c0, { roughness: 0.8 }));
        stripe.position.set(-L / 4, H - 0.55, W / 2 + 0.01);
        g.add(stripe);

        g.position.y = level * H;
        env.add(g);
        obstacles.push({
            mesh: g, isAABB: true, halfW: halfW, halfD: halfD,
            height: H * (level + 1), climbable: false,
        });
        return g;
    }

    function makeBarrier(env, obstacles, x, z, horizontal) {
        const g = new THREE.Group();
        const L = 2.6;
        const base = new THREE.Mesh(new THREE.BoxGeometry(L, 0.34, 0.72), mat(0xb9b4a6, { roughness: 0.9 }));
        base.position.y = 0.17; base.castShadow = true; base.receiveShadow = true;
        base.userData.surface = 'cover';
        g.add(base);
        const top = new THREE.Mesh(new THREE.BoxGeometry(L, 0.62, 0.36), mat(0xb9b4a6, { roughness: 0.9 }));
        top.position.y = 0.62; top.castShadow = true; top.receiveShadow = true;
        top.userData.surface = 'cover';
        g.add(top);
        // 反光条
        const stripeMat = mat(0xc4552e, { roughness: 0.7, emissive: 0x2a0a00, emissiveIntensity: 0.3 });
        for (const sx of [-0.7, 0.7]) {
            const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.02), stripeMat);
            s.position.set(sx, 0.55, 0.19);
            g.add(s);
        }
        g.position.set(x, 0, z);
        if (!horizontal) g.rotation.y = Math.PI / 2;
        g.traverse(function(o){if(o.isMesh)o.castShadow=false;});
        env.add(g);
        obstacles.push({
            mesh: g, isAABB: true,
            halfW: horizontal ? L / 2 : 0.38,
            halfD: horizontal ? 0.38 : L / 2,
            height: 0.95, climbable: true,
        });
    }

    function makeSandbagWall(env, obstacles, x, z, horizontal) {
        const g = new THREE.Group();
        const bagMat = mat(0x9a8a62, { roughness: 0.95 });
        const rows = 3, perRow = 5;
        for (let r = 0; r < rows; r++) {
            const count = perRow - r;
            for (let i = 0; i < count; i++) {
                const bx = (i - (count - 1) / 2) * 0.52 + (r % 2 ? 0.1 : 0);
                const bag = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), bagMat);
                bag.scale.set(0.86, 0.44, 0.62);
                bag.position.set(bx, 0.15 + r * 0.24, (r % 2 ? 0.05 : -0.05));
                bag.castShadow = true; bag.receiveShadow = true;
                bag.userData.surface = 'sandbag';
                g.add(bag);
            }
        }
        g.position.set(x, 0, z);
        if (!horizontal) g.rotation.y = Math.PI / 2;
        g.traverse(function(o){if(o.isMesh)o.castShadow=false;});
        env.add(g);
        obstacles.push({
            mesh: g, isAABB: true,
            halfW: horizontal ? 1.45 : 0.42,
            halfD: horizontal ? 0.42 : 1.45,
            height: 0.95, climbable: true,
        });
    }

    function makePalletStack(env, obstacles, x, z) {
        const g = new THREE.Group();
        const wood = mat(0x7a5a38, { roughness: 0.92 });
        const n = 1 + (Math.random() < 0.4 ? 1 : 0);
        for (let s = 0; s < n; s++) {
            for (let i = 0; i < 5; i++) {
                const slat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.045, 0.16), wood);
                slat.position.set(0, 0.06 + s * 0.16, -0.48 + i * 0.24);
                slat.castShadow = true; slat.receiveShadow = true;
                slat.userData.surface = 'wood';
                g.add(slat);
            }
            for (const bx of [-0.48, 0, 0.48]) {
                const block = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 1.1), wood);
                block.position.set(bx, 0.01 + s * 0.16, 0);
                g.add(block);
            }
        }
        g.position.set(x, 0, z);
        g.rotation.y = Math.random() * Math.PI;
        g.traverse(function(o){if(o.isMesh)o.castShadow=false;});
        env.add(g);
        obstacles.push({ mesh: g, radius: 0.62, height: 0.34, climbable: true });
    }

    function makeTires(env, obstacles, x, z) {
        const g = new THREE.Group();
        const rubber = mat(0x1c1c1e, { roughness: 0.96 });
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
            const t = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.14, 8, 14), rubber);
            t.rotation.x = Math.PI / 2;
            t.position.y = 0.14 + i * 0.26;
            t.castShadow = true; t.receiveShadow = true;
            g.add(t);
        }
        g.position.set(x, 0, z);
        g.traverse(function(o){if(o.isMesh)o.castShadow=false;});
        env.add(g);
        obstacles.push({ mesh: g, radius: 0.5, height: 0.3 + n * 0.26, climbable: true });
    }

    function makeStreetLamp(env, obstacles, x, z, angle) {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 5.4, 8), mat(0x4a4e52, { roughness: 0.55, metalness: 0.6 }));
        pole.position.y = 2.7;
        pole.castShadow = true;
        g.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.1), mat(0x4a4e52, { roughness: 0.55, metalness: 0.6 }));
        arm.position.set(0.5, 5.3, 0);
        g.add(arm);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.28),
            mat(0x33383c, { roughness: 0.5, metalness: 0.5, emissive: 0xffdba0, emissiveIntensity: 0.35 }));
        head.position.set(0.98, 5.22, 0);
        g.add(head);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.24, 8), mat(0x5a5e60, { roughness: 0.8 }));
        base.position.y = 0.12;
        g.add(base);
        g.position.set(x, 0, z);
        g.rotation.y = angle || 0;
        env.add(g);
        obstacles.push({ mesh: g, radius: 0.26, height: 5.4, climbable: false });
    }

    function makeFence(env, obstacles, x, z, len, horizontal) {
        const g = new THREE.Group();
        const postMat = mat(0x6a6e70, { roughness: 0.55, metalness: 0.6 });
        const panels = Math.max(1, Math.round(len / 2.4));
        for (let i = 0; i <= panels; i++) {
            const px = -len / 2 + i * (len / panels);
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 6), postMat);
            post.position.set(px, 0.95, 0);
            g.add(post);
        }
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(len, 1.8),
            new THREE.MeshStandardMaterial({
                map: chainTexture().clone(), color: 0xb8bec4, roughness: 0.55, metalness: 0.55,
                transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
            })
        );
        plane.material.map.wrapS = plane.material.map.wrapT = THREE.RepeatWrapping;
        plane.material.map.repeat.set(len / 1.2, 1.5);
        plane.material.map.needsUpdate = true;
        plane.position.set(0, 0.95, 0);
        g.add(plane);
        const topRail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 6), postMat);
        topRail.rotation.z = Math.PI / 2;
        topRail.position.y = 1.86;
        g.add(topRail);
        g.position.set(x, 0, z);
        if (!horizontal) g.rotation.y = Math.PI / 2;
        g.traverse(function(o){if(o.isMesh)o.castShadow=false;});
        env.add(g);
        obstacles.push({
            mesh: g, isAABB: true,
            halfW: horizontal ? len / 2 : 0.12,
            halfD: horizontal ? 0.12 : len / 2,
            height: 1.9, climbable: false,
        });
    }

    function makePuddle(env, x, z, r) {
        const p = new THREE.Mesh(
            new THREE.CircleGeometry(r, 20),
            new THREE.MeshStandardMaterial({
                color: 0x22323c, roughness: 0.06, metalness: 0.45,
                transparent: true, opacity: 0.72, envMapIntensity: 1.4,
            })
        );
        p.rotation.x = -Math.PI / 2;
        p.position.set(x, 0.032, z);
        p.scale.set(1, 0.65 + Math.random() * 0.5, 1);
        p.rotation.z = Math.random() * Math.PI;
        p.renderOrder = 2;
        env.add(p);
    }

    function makeWatchtower(env, obstacles, x, z) {
        const g = new THREE.Group();
        const steel = mat(0x55595c, { roughness: 0.6, metalness: 0.55 });
        const H = 6.4;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, H, 6), steel);
            leg.position.set(sx * 1.1, H / 2, sz * 1.1);
            leg.rotation.z = -sx * 0.045;
            leg.rotation.x = sz * 0.045;
            leg.castShadow = true;
            g.add(leg);
        }
        // 横撑
        for (let i = 1; i <= 3; i++) {
            const y = i * 1.6;
            const brace = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.05), steel);
            brace.position.set(0, y, 1.1); g.add(brace);
            const brace2 = brace.clone(); brace2.position.z = -1.1; g.add(brace2);
            const brace3 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 2.2), steel);
            brace3.position.set(1.1, y, 0); g.add(brace3);
            const brace4 = brace3.clone(); brace4.position.x = -1.1; g.add(brace4);
        }
        // 平台与护栏
        const deck = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 2.8), mat(0x6a5a42, { roughness: 0.9 }));
        deck.position.y = H; deck.castShadow = true; g.add(deck);
        for (const [px, pz, rw, rd] of [[0, 1.35, 2.8, 0.05], [0, -1.35, 2.8, 0.05], [1.35, 0, 0.05, 2.8], [-1.35, 0, 0.05, 2.8]]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.05, rd), steel);
            rail.position.set(px, H + 0.95, pz); g.add(rail);
        }
        // 顶棚
        const roof = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 3.0), mat(0x3e5a48, { roughness: 0.7, metalness: 0.3 }));
        roof.position.y = H + 2.3; roof.castShadow = true; g.add(roof);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), steel);
            p.position.set(sx * 1.2, H + 1.6, sz * 1.2);
            g.add(p);
        }
        // 沙袋堆在平台
        const bagMat = mat(0x9a8a62, { roughness: 0.95 });
        for (let i = 0; i < 3; i++) {
            const bag = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), bagMat);
            bag.scale.set(0.9, 0.4, 0.6);
            bag.position.set(-0.7 + i * 0.5, H + 0.2, 0.8);
            bag.userData.surface = 'sandbag';
            g.add(bag);
        }
        g.position.set(x, 0, z);
        g.rotation.y = Math.random() * Math.PI;
        env.add(g);
        // 塔身整体作为一根粗圆柱碰撞，避免玩家卡在四根细腿之间
        obstacles.push({ mesh: g, radius: 1.5, height: H, climbable: false });
    }

    function makeDebris(env, x, z) {
        const wood = mat(0x6e5236, { roughness: 0.95 });
        const g = new THREE.Group();
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
            const len = 0.5 + Math.random() * 0.8;
            const plank = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.12), wood);
            plank.position.set((Math.random() - 0.5) * 0.6, 0.02 + i * 0.03, (Math.random() - 0.5) * 0.6);
            plank.rotation.y = Math.random() * Math.PI;
            plank.userData.surface = 'wood';
            g.add(plank);
        }
        // 碎砖
        for (let i = 0; i < 3; i++) {
            const brick = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.09), mat(0x7a4a3a, { roughness: 0.95 }));
            brick.position.set((Math.random() - 0.5) * 0.8, 0.045, (Math.random() - 0.5) * 0.8);
            brick.rotation.set(Math.random(), Math.random() * 3, Math.random());
            g.add(brick);
        }
        g.position.set(x, 0, z);
        env.add(g);
    }


    // ---- 交通锥 ----
    function makeCone(env, obstacles, x, z) {
        const g = new THREE.Group();
        const orange = mat(0xd8541e, { roughness: 0.7, emissive: 0x2a0c00, emissiveIntensity: 0.25 });
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.20, 0.62, 8), orange);
        cone.position.y = 0.33; cone.castShadow = true; g.add(cone);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.155, 0.10, 8), mat(0xe8e4d8, { roughness: 0.6 }));
        band.position.y = 0.42; g.add(band);
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), mat(0x2a2a2a, { roughness: 0.9 }));
        base.position.y = 0.025; g.add(base);
        g.position.set(x, 0, z);
        env.add(g);
        obstacles.push({ mesh: g, radius: 0.24, height: 0.65, climbable: true });
    }

    // ---- 垃圾箱 ----
    function makeDumpster(env, obstacles, x, z) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.1, 1.2), mat(0x2f4a38, { roughness: 0.72, metalness: 0.35 }));
        body.position.y = 0.62; body.castShadow = true; body.receiveShadow = true;
        body.userData.surface = 'container';
        g.add(body);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.08, 1.24), mat(0x22352a, { roughness: 0.6, metalness: 0.4 }));
        lid.position.y = 1.2; lid.rotation.x = -0.04; g.add(lid);
        for (const sx of [-0.85, 0.85]) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8), mat(0x141414, { roughness: 0.95 }));
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(sx, 0.12, 0.45);
            g.add(wheel);
        }
        g.position.set(x, 0, z);
        g.rotation.y = Math.random() < 0.5 ? 0 : Math.PI / 2;
        g.traverse(function(o){if(o.isMesh)o.castShadow=false;});
        env.add(g);
        const horiz = Math.abs(g.rotation.y) < 0.1;
        obstacles.push({ mesh: g, isAABB: true, halfW: horiz ? 1.05 : 0.6, halfD: horiz ? 0.6 : 1.05, height: 1.25, climbable: false });
    }

    // ---- 电缆盘 ----
    function makeSpool(env, obstacles, x, z) {
        const g = new THREE.Group();
        const wood = mat(0x8a6a42, { roughness: 0.92 });
        for (const sz of [-0.28, 0.28]) {
            const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 16), wood);
            disc.rotation.z = Math.PI / 2;
            disc.position.x = sz; disc.castShadow = true; g.add(disc);
        }
        const core = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 16), mat(0x2a2a2a, { roughness: 0.8 }));
        core.rotation.z = Math.PI / 2; g.add(core);
        g.position.set(x, 0.62, z);
        g.rotation.y = Math.random() * Math.PI;
        g.traverse(function(o){if(o.isMesh)o.castShadow=false;});
        env.add(g);
        obstacles.push({ mesh: g, radius: 0.7, height: 1.2, climbable: true });
    }

    // ---- 警示牌 ----
    let _signTextures = null;
    function signTexture(text, bg, fg) {
        if (_signTextures && _signTextures[text]) return _signTextures[text];
        const c = document.createElement('canvas');
        c.width = 256; c.height = 128;
        const ctx = c.getContext('2d');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 128);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 8; ctx.strokeRect(6, 6, 244, 116);
        ctx.fillStyle = fg;
        ctx.font = 'bold 34px Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 64);
        const tex = new THREE.CanvasTexture(c);
        if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
        _signTextures = _signTextures || {};
        _signTextures[text] = tex;
        return tex;
    }

    function makeSign(env, obstacles, x, z, text, bg, fg) {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), mat(0x6a6a66, { roughness: 0.6, metalness: 0.5 }));
        pole.position.y = 1.1; g.add(pole);
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.05),
            new THREE.MeshStandardMaterial({ map: signTexture(text, bg || '#d8b400', fg || '#111'), roughness: 0.7, metalness: 0.1 }));
        panel.position.y = 1.9; g.add(panel);
        g.position.set(x, 0, z);
        g.rotation.y = Math.random() * Math.PI * 2;
        g.traverse(function(o){if(o.isMesh)o.castShadow=false;});
        env.add(g);
        obstacles.push({ mesh: g, radius: 0.15, height: 2.2, climbable: false });
    }

    // ---- 油渍 ----
    function makeOilStain(env, x, z) {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const ctx = c.getContext('2d');
        for (let i = 0; i < 10; i++) {
            const px = 40 + Math.random() * 48, py = 40 + Math.random() * 48;
            const r = 12 + Math.random() * 26;
            const gr = ctx.createRadialGradient(px, py, 1, px, py, r);
            gr.addColorStop(0, 'rgba(8,8,8,0.55)');
            gr.addColorStop(1, 'rgba(8,8,8,0)');
            ctx.fillStyle = gr;
            ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        }
        const tex = new THREE.CanvasTexture(c);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({
            map: tex, transparent: true, opacity: 0.75, depthWrite: false,
        }));
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = Math.random() * Math.PI;
        m.position.set(x, 0.038, z);
        m.renderOrder = 3;
        env.add(m);
    }


    // ---- 树木 / 灌木 / 岩石 ----
    const _barkMat = mat(0x4a3524, { roughness: 0.95 });
    const _leafMats = [
        mat(0x2f5230, { roughness: 0.9 }),
        mat(0x3d6035, { roughness: 0.9 }),
        mat(0x27452a, { roughness: 0.92 }),
        mat(0x4a5f34, { roughness: 0.9 }),
    ];
    function makeTree(env, obstacles, x, z, scaleSeed) {
        const g = new THREE.Group();
        const h = 4.2 + scaleSeed * 4.5;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, h * 0.55, 7), _barkMat);
        trunk.position.y = h * 0.275;
        trunk.castShadow = true; trunk.receiveShadow = true;
        g.add(trunk);
        const leaf = _leafMats[Math.floor(scaleSeed * 97) % _leafMats.length];
        // 三层锥形树冠，形成针叶林的层次
        for (let i = 0; i < 3; i++) {
            const r = (1.9 - i * 0.42) * (0.8 + scaleSeed * 0.5);
            const ch = (2.4 - i * 0.35) * (0.8 + scaleSeed * 0.3);
            const cone = new THREE.Mesh(new THREE.ConeGeometry(r, ch, 8), leaf);
            cone.position.y = h * 0.42 + i * ch * 0.42;
            cone.castShadow = true; cone.receiveShadow = true;
            g.add(cone);
        }
        g.position.set(x, 0, z);
        g.rotation.y = Math.random() * Math.PI * 2;
        g.userData.propType = 'tree';
        env.add(g);
        obstacles.push({ mesh: g, radius: 0.5, height: h * 0.8, climbable: false });
    }

    function makeBush(env, obstacles, x, z) {
        const g = new THREE.Group();
        const leaf = _leafMats[Math.floor(Math.random() * _leafMats.length)];
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
            const s = 0.24 + Math.random() * 0.26;
            const b = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 5), leaf);
            b.position.set((Math.random() - 0.5) * 0.8, s * 0.75, (Math.random() - 0.5) * 0.8);
            b.scale.y = 0.75;
            b.castShadow = true;
            g.add(b);
        }
        g.position.set(x, 0, z);
        g.userData.propType = 'bush';
        g.traverse(function(o){if(o.isMesh)o.castShadow=false;});
        env.add(g);
        obstacles.push({ mesh: g, radius: 0.45, height: 0.9, climbable: true });
    }

    function makeRock(env, obstacles, x, z) {
        const g = new THREE.Group();
        const rockMat = mat(0x6a6a64, { roughness: 0.95, metalness: 0.02 });
        const n = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
            const r = 0.4 + Math.random() * 0.7;
            const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), rockMat);
            rock.position.set((Math.random() - 0.5) * 0.9, r * 0.55, (Math.random() - 0.5) * 0.9);
            rock.rotation.set(Math.random(), Math.random() * 3, Math.random());
            rock.scale.y = 0.7;
            rock.castShadow = true; rock.receiveShadow = true;
            g.add(rock);
        }
        g.position.set(x, 0, z);
        g.userData.propType = 'rock';
        g.traverse(function(o){if(o.isMesh)o.castShadow=false;});
        env.add(g);
        obstacles.push({ mesh: g, radius: 0.7, height: 1.0, climbable: true });
    }

    // 路面标线：沿道路长边铺白色虚线
    function addRoadMarkings(env, roads) {
        const lineMat = mat(0xd8d4c4, { roughness: 0.85, emissive: 0x1a1a14, emissiveIntensity: 0.15 });
        for (const r of roads) {
            const horizontal = r.w >= r.d;
            const len = horizontal ? r.w : r.d;
            const step = 4.5;
            const count = Math.floor(len / step) - 1;
            for (let i = 0; i < count; i++) {
                const t = -len / 2 + step * (i + 1);
                const mark = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 2.2 : 0.14, 0.012, horizontal ? 0.14 : 2.2), lineMat);
                mark.position.set(
                    r.x + (horizontal ? t : 0),
                    0.046,
                    r.z + (horizontal ? 0 : t)
                );
                mark.receiveShadow = true;
                env.add(mark);
            }
        }
    }

    // 屋顶设备：空调外机、水箱、天线
    function addRoofProps(env, buildings) {
        for (const b of buildings) {
            if (!b || !b.w || !b.d) continue;
            const h = b.h || 4;
            // 空调外机
            if (b.w * b.d > 40) {
                const n = 1 + Math.floor(Math.random() * 2);
                for (let i = 0; i < n; i++) {
                    const ac = new THREE.Group();
                    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.8), mat(0x8a8d88, { roughness: 0.7, metalness: 0.3 }));
                    body.position.y = 0.35; body.castShadow = true; ac.add(body);
                    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12), mat(0x3a3d3f, { roughness: 0.6 }));
                    fan.rotation.x = Math.PI / 2; fan.position.set(0, 0.4, 0.41); ac.add(fan);
                    ac.position.set(
                        b.x + (i - (n - 1) / 2) * 1.8,
                        h + 0.42,
                        b.z + (Math.random() - 0.5) * (b.d * 0.35)
                    );
                    env.add(ac);
                }
            }
            // 天线
            if (h > 5 && Math.random() < 0.45) {
                const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 3.2, 6), mat(0x4a4e50, { roughness: 0.5, metalness: 0.7 }));
                mast.position.set(b.x + b.w * 0.28, h + 2.0, b.z - b.d * 0.28);
                env.add(mast);
                const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), mat(0xff3020, { emissive: 0xff2010, emissiveIntensity: 1.5 }));
                tip.position.set(mast.position.x, h + 3.62, mast.position.z);
                env.add(tip);
            }
            // 水箱
            if (b.w * b.d > 60 && Math.random() < 0.4) {
                const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.5, 12), mat(0x6a6a60, { roughness: 0.8, metalness: 0.2 }));
                tank.position.set(b.x - b.w * 0.25, h + 1.2, b.z + b.d * 0.25);
                tank.castShadow = true;
                env.add(tank);
                for (let i = 0; i < 4; i++) {
                    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), mat(0x4a4a46, { roughness: 0.8 }));
                    const a = i / 4 * Math.PI * 2;
                    leg.position.set(tank.position.x + Math.cos(a) * 0.6, h + 0.7, tank.position.z + Math.sin(a) * 0.6);
                    env.add(leg);
                }
            }
        }
    }

    // ========== 主入口 ==========

    function apply(env, obstacles) {
        if (!env) return null;
        const map = (typeof MAP_DATA !== 'undefined' && MAP_DATA) || {};
        const buildings = (typeof FIXED_BUILDINGS !== 'undefined' && FIXED_BUILDINGS) || [];
        const water = map.waterAreas || [];
        const extracts = (typeof FIXED_EXTRACTS !== 'undefined' && FIXED_EXTRACTS) || [];
        // 注意：游戏里的 search containers 是 let 声明，初始化前访问会触发 TDZ；
        // 这里用地图数据里的 FIXED_CONTAINERS 做避让即可。
        const containers = (typeof FIXED_CONTAINERS !== 'undefined' && FIXED_CONTAINERS) || [];
        const groundSpawns = (typeof FIXED_GROUND_SPAWNS !== 'undefined' && FIXED_GROUND_SPAWNS) || [];
        const roads = map.roads || [];
        const mapSize = (typeof CONFIG !== 'undefined' && CONFIG.mapSize) || 220;
        const half = mapSize / 2;

        // 固定种子
        let seed = 1337;
        const name = (map.name || 'map') + '';
        for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) | 0;
        function rand() {
            seed = (seed * 1664525 + 1013904223) | 0;
            return ((seed >>> 0) % 100000) / 100000;
        }
        function pick(arr) { return arr[Math.floor(rand() * arr.length) % arr.length]; }

        const placed = [];
        // ---- 地图类型判定 ----
        // 【主判据】地图数据里显式声明的 kind（military | industrial | forest）。
        //           game.js 会把整个 MAP_DATA 深拷贝，kind 随数据一起流动，无需额外传递。
        //
        // 【兜底：deprecated】下面两条正则只服务于「没有 kind 字段的旧地图数据」。
        //   不要再往里加地图名。历史上这里只靠 name 正则判定，而森林图叫「密林禁区」，
        //   /森林|Forest|outpost/i 全部匹配失败 → 被当成军事基地，
        //   导致树丛 9→3、零散树 26→8、灌木 34→10、岩石 20→8，森林图完全失去植被特征。
        //   根因不是正则写漏，而是「用中文显示名当语义标签」这个耦合本身：
        //   ① 它驱动本文件里 13 处密度三元表达式，改文案就等于改玩法密度；
        //   ② 道具布局的随机种子是 map.name 的哈希（见下方 seed 计算），
        //      为了修正则去改 name，会让全部道具重新洗牌。
        //   所以正则是 deprecated 兜底，新地图必须写 kind。tests/map-differences.mjs 锁定 kind 与 map.name。
        const kind = (map.kind || '').toLowerCase();
        const isPort = kind === 'industrial'
            || (!kind && /工业|港口|港|Port|industrial/i.test(name));
        const isForest = kind === 'forest'
            || (!kind && /森林|密林|林地|林|Forest|outpost/i.test(name));

        function blockedByBuilding(x, z, margin) {
            for (const b of buildings) {
                if (Math.abs(x - b.x) < b.w / 2 + margin && Math.abs(z - b.z) < b.d / 2 + margin) return true;
            }
            return false;
        }
        const rejects = { bounds: 0, spawn: 0, center: 0, water: 0, building: 0, extract: 0, container: 0, ground: 0, overlap: 0 };
        function canPlace(x, z, r) {
            if (Math.abs(x) > half - 8 || Math.abs(z) > half - 8) { rejects.bounds++; return false; }
            if (Math.abs(x - spawnPt.x) < 7 && Math.abs(z - spawnPt.z) < 7) { rejects.spawn++; return false; } // 出生点周围留空
            if (Math.abs(x) < 9 && Math.abs(z) < 9 && Math.abs(spawnPt.x) < 9 && Math.abs(spawnPt.z) < 9) { rejects.center++; return false; }
            for (const w of water) {
                if (Math.abs(x - w.x) < w.w / 2 + 2 && Math.abs(z - w.z) < w.d / 2 + 2) { rejects.water++; return false; }
            }
            if (blockedByBuilding(x, z, Math.max(2.5, r * 0.9))) { rejects.building++; return false; }
            for (const e of extracts) {
                if ((x - e.x) * (x - e.x) + (z - e.z) * (z - e.z) < 110) { rejects.extract++; return false; }
            }
            for (const c of containers) {
                if (Math.abs(x - c.x) < 4 && Math.abs(z - c.z) < 4) { rejects.container++; return false; }
            }
            for (const s of groundSpawns) {
                if ((x - s.x) * (x - s.x) + (z - s.z) * (z - s.z) < 6) { rejects.ground++; return false; }
            }
            for (const p of placed) {
                const d = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
                const rr = (r + p.r) * (r + p.r);
                if (d < rr) { rejects.overlap++; return false; }
            }
            return true;
        }
        // 出生点附近优先：玩家一进场看到的就是细节，而不是一片空地
        const spawnPt = (map.playerSpawn && typeof map.playerSpawn.x === 'number')
            ? { x: map.playerSpawn.x, z: map.playerSpawn.z }
            : { x: 0, z: 0 };
        function findSpot(r, tries, range) {
            range = range || half - 10;
            for (let i = 0; i < (tries || 26); i++) {
                let x, z;
                const roll = rand();
                if (roll < 0.55) {
                    const ang = rand() * Math.PI * 2;
                    const rad = 9 + Math.sqrt(rand()) * 38;
                    x = spawnPt.x + Math.cos(ang) * rad;
                    z = spawnPt.z + Math.sin(ang) * rad;
                } else if (roll < 0.8) {
                    const ang = rand() * Math.PI * 2;
                    const rad = 12 + Math.sqrt(rand()) * 55;
                    x = Math.cos(ang) * rad;
                    z = Math.sin(ang) * rad;
                } else {
                    x = (rand() * 2 - 1) * range;
                    z = (rand() * 2 - 1) * range;
                }
                if (canPlace(x, z, r)) {
                    placed.push({ x: x, z: z, r: r });
                    return { x: x, z: z };
                }
            }
            return null;
        }

        // ---- 集装箱堆场 ----
        const containerStacks = isPort ? 16 : (isForest ? 3 : 9);
        for (let i = 0; i < containerStacks; i++) {
            const spot = findSpot(4.0, 22);
            if (!spot) continue;
            const horizontal = rand() < 0.5;
            const levels = rand() < 0.35 ? 2 : 1;
            const color = pick(CONTAINER_COLORS);
            for (let l = 0; l < levels; l++) {
                makeContainer(env, obstacles, spot.x + (l ? 0.1 : 0), spot.z + (l ? -0.12 : 0), horizontal, color, l);
            }
        }

        // ---- 路障 ----
        const barrierCount = isPort ? 11 : 9;
        for (let i = 0; i < barrierCount; i++) {
            const spot = findSpot(1.6, 18);
            if (spot) makeBarrier(env, obstacles, spot.x, spot.z, rand() < 0.5);
        }

        // ---- 沙袋工事 ----
        const sandbagCount = isPort ? 5 : (isForest ? 8 : 10);
        for (let i = 0; i < sandbagCount; i++) {
            const spot = findSpot(2.0, 18);
            if (spot) makeSandbagWall(env, obstacles, spot.x, spot.z, rand() < 0.5);
        }

        // ---- 托盘 / 轮胎 / 杂物 ----
        const palletCount = isPort ? 12 : 7;
        for (let i = 0; i < palletCount; i++) {
            const spot = findSpot(1.0, 14);
            if (spot) makePalletStack(env, obstacles, spot.x, spot.z);
        }
        const tireCount = isPort ? 8 : 3;
        for (let i = 0; i < tireCount; i++) {
            const spot = findSpot(0.8, 14);
            if (spot) makeTires(env, obstacles, spot.x, spot.z);
        }
        for (let i = 0; i < (isForest ? 14 : 10); i++) {
            const spot = findSpot(0.6, 12);
            if (spot) makeDebris(env, spot.x, spot.z);
        }

        // ---- 路灯（沿道路两侧） ----
        let lampCount = 0;
        for (const r of roads) {
            if (lampCount >= 6) break;
            const horizontal = r.w >= r.d;
            const len = horizontal ? r.w : r.d;
            if (len < 14) continue;
            const n = Math.min(2, Math.floor(len / 18));
            for (let i = 0; i < n && lampCount < 6; i++) {
                const t = -len / 2 + len * (i + 0.5) / n;
                const side = (i % 2 ? 1 : -1);
                const lx = r.x + (horizontal ? t : (r.w / 2 + 1.6) * side);
                const lz = r.z + (horizontal ? (r.d / 2 + 1.6) * side : t);
                if (canPlace(lx, lz, 0.9)) {
                    placed.push({ x: lx, z: lz, r: 0.9 });
                    makeStreetLamp(env, obstacles, lx, lz, horizontal ? (side > 0 ? 0 : Math.PI) : (side > 0 ? -Math.PI / 2 : Math.PI / 2));
                    lampCount++;
                }
            }
        }

        // ---- 铁丝网围栏 ----
        const fenceCount = isPort ? 5 : (isForest ? 4 : 3);
        for (let i = 0; i < fenceCount; i++) {
            const spot = findSpot(3.2, 14);
            if (spot) makeFence(env, obstacles, spot.x, spot.z, 5 + Math.floor(rand() * 3) * 2.4, rand() < 0.5);
        }

        // ---- 水洼 ----
        const puddleCount = isPort ? 16 : 7;
        for (let i = 0; i < puddleCount; i++) {
            const spot = findSpot(1.2, 10);
            if (spot) makePuddle(env, spot.x, spot.z, 0.7 + rand() * 1.4);
        }

        // ---- 瞭望塔 ----
        const towers = isForest ? 3 : 2;
        for (let i = 0; i < towers; i++) {
            const spot = findSpot(3.4, 18);
            if (spot) makeWatchtower(env, obstacles, spot.x, spot.z);
        }

        // ---- 交通锥 / 垃圾箱 / 电缆盘 / 警示牌 / 油渍 ----
        const coneCount = isPort ? 14 : 7;
        for (let i = 0; i < coneCount; i++) {
            const spot = findSpot(0.5, 10);
            if (spot) makeCone(env, obstacles, spot.x, spot.z);
        }
        for (let i = 0; i < (isPort ? 6 : 3); i++) {
            const spot = findSpot(1.8, 12);
            if (spot) makeDumpster(env, obstacles, spot.x, spot.z);
        }
        for (let i = 0; i < (isPort ? 6 : 3); i++) {
            const spot = findSpot(1.2, 12);
            if (spot) makeSpool(env, obstacles, spot.x, spot.z);
        }
        const signTexts = isPort
            ? [['PORT 07', '#d8b400', '#111'], ['危险 高压', '#d8b400', '#111'], ['RESTRICTED', '#c0392b', '#f0e8d8']]
            : [['军事禁区', '#c0392b', '#f0e8d8'], ['DANGER', '#d8b400', '#111'], ['检查站', '#d8b400', '#111']];
        for (let i = 0; i < 6; i++) {
            const spot = findSpot(0.5, 12);
            if (spot) {
                const t = signTexts[i % signTexts.length];
                makeSign(env, obstacles, spot.x, spot.z, t[0], t[1], t[2]);
            }
        }
        for (let i = 0; i < (isPort ? 12 : 6); i++) {
            const spot = findSpot(1.1, 10);
            if (spot) makeOilStain(env, spot.x, spot.z);
        }

        // ---- 植被与岩石：森林地图密集，其它地图点缀 ----
        // 树木放宽建筑/道具间距（树可以贴着墙长），但仍在边界与水域内
        function canPlaceTree(x, z) {
            if (Math.abs(x) > half - 5 || Math.abs(z) > half - 5) return false;
            if (Math.abs(x - spawnPt.x) < 6 && Math.abs(z - spawnPt.z) < 6) return false;
            for (const w of water) {
                if (Math.abs(x - w.x) < w.w / 2 + 1 && Math.abs(z - w.z) < w.d / 2 + 1) return false;
            }
            if (blockedByBuilding(x, z, 1.6)) return false;
            for (const e of extracts) {
                if ((x - e.x) * (x - e.x) + (z - e.z) * (z - e.z) < 45) return false;
            }
            for (const p of placed) {
                const dx = x - p.x, dz = z - p.z;
                if (dx * dx + dz * dz < 2.25) return false;
            }
            return true;
        }
        function plantTree(x, z) {
            if (!canPlaceTree(x, z)) return false;
            placed.push({ x: x, z: z, r: 1.1 });
            makeTree(env, obstacles, x, z, rand());
            return true;
        }
        function plantGrove(cx, cz, count, spread) {
            let n = 0;
            for (let k = 0; k < count * 5 && n < count; k++) {
                const a = rand() * Math.PI * 2;
                const r = rand() * spread;
                if (plantTree(cx + Math.cos(a) * r, cz + Math.sin(a) * r)) n++;
            }
        }

        const groveCount = isForest ? 9 : (isPort ? 1 : 3);
        for (let gi = 0; gi < groveCount; gi++) {
            // 一半树丛落在出生点周围，保证一进场就有植被层次
            let cx, cz, tries = 0;
            do {
                const ang = rand() * Math.PI * 2;
                const rad = gi < groveCount * 0.6 ? (14 + rand() * 34) : (rand() * (half - 20));
                cx = gi < groveCount * 0.6 ? spawnPt.x + Math.cos(ang) * rad : Math.cos(ang) * rad;
                cz = gi < groveCount * 0.6 ? spawnPt.z + Math.sin(ang) * rad : Math.sin(ang) * rad;
                tries++;
            } while ((Math.abs(cx) > half - 12 || Math.abs(cz) > half - 12 || blockedByBuilding(cx, cz, 2)) && tries < 20);
            if (tries >= 20) continue;
            plantGrove(cx, cz, isForest ? 8 : 5, isForest ? 9 : 7);
        }
        // 零散树
        for (let i = 0; i < (isForest ? 26 : 8); i++) {
            const ang = rand() * Math.PI * 2;
            const rad = 10 + rand() * (half - 25);
            plantTree(spawnPt.x * 0.3 + Math.cos(ang) * rad, spawnPt.z * 0.3 + Math.sin(ang) * rad);
        }
        const bushCount = isForest ? 34 : 10;
        for (let i = 0; i < bushCount; i++) {
            const spot = findSpot(0.8, 10);
            if (spot) makeBush(env, obstacles, spot.x, spot.z);
        }
        const rockCount = isForest ? 20 : 8;
        for (let i = 0; i < rockCount; i++) {
            const spot = findSpot(1.0, 10);
            if (spot) makeRock(env, obstacles, spot.x, spot.z);
        }

        // ---- 路面标线 ----
        addRoadMarkings(env, roads);

        // ---- 屋顶设备 ----
        addRoofProps(env, buildings);

        // 调试/后续系统可读取的布点记录
        env.userData.worldPropsPlaced = placed.slice();
        env.userData.worldPropsRejects = rejects;

        return { placed: placed.length, lamps: lampCount };
    }

    return { apply: apply };
})();
