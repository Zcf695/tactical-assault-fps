/**
 * weapon_fx.js
 * 武器世界空间特效
 *
 * 职责（不介入武器姿态，姿态由 animation_enhancement 负责）：
 * - 枪口火焰（Sprite + 单盏常驻点光，避免灯光数量变化触发材质重编译）
 * - 抛壳（带重力/弹跳的小铜壳）
 * - 枪口硝烟
 * - 弹着点：弹孔贴花 + 火花 + 尘烟
 * - 命中血雾（低饱和，克制表达）
 *
 * 所有对象走对象池，运行期不新建几何体/材质。
 */
const WeaponFX = (function () {
    'use strict';

    let _scene = null, _camera = null;
    let _ready = false;
    let _low = false;

    // ---- 纹理 ----
    let _texFlash = null, _texSmoke = null, _texHole = null, _texSpark = null;

    function _canvas(size) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        return c;
    }

    function _makeFlashTex() {
        const c = _canvas(128);
        const x = c.getContext('2d');
        const g = x.createRadialGradient(64, 64, 2, 64, 64, 62);
        g.addColorStop(0, 'rgba(255,255,240,1)');
        g.addColorStop(0.25, 'rgba(255,224,150,0.95)');
        g.addColorStop(0.55, 'rgba(255,160,60,0.45)');
        g.addColorStop(1, 'rgba(255,120,20,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, 128, 128);
        // 星芒
        x.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
            const a = i / 6 * Math.PI * 2;
            x.save();
            x.translate(64, 64);
            x.rotate(a);
            const lg = x.createLinearGradient(0, 0, 62, 0);
            lg.addColorStop(0, 'rgba(255,240,190,0.9)');
            lg.addColorStop(1, 'rgba(255,140,40,0)');
            x.fillStyle = lg;
            x.beginPath();
            x.moveTo(8, -4); x.lineTo(62, 0); x.lineTo(8, 4); x.closePath();
            x.fill();
            x.restore();
        }
        return new THREE.CanvasTexture(c);
    }

    function _makeSmokeTex() {
        const c = _canvas(128);
        const x = c.getContext('2d');
        for (let i = 0; i < 26; i++) {
            const px = 40 + Math.random() * 48, py = 40 + Math.random() * 48;
            const r = 10 + Math.random() * 22;
            const g = x.createRadialGradient(px, py, 1, px, py, r);
            g.addColorStop(0, 'rgba(210,210,205,0.20)');
            g.addColorStop(1, 'rgba(180,180,175,0)');
            x.fillStyle = g;
            x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
        }
        return new THREE.CanvasTexture(c);
    }

    function _makeHoleTex() {
        const c = _canvas(64);
        const x = c.getContext('2d');
        x.clearRect(0, 0, 64, 64);
        const g = x.createRadialGradient(32, 32, 1, 32, 32, 13);
        g.addColorStop(0, 'rgba(8,8,8,0.98)');
        g.addColorStop(0.55, 'rgba(24,22,20,0.9)');
        g.addColorStop(1, 'rgba(40,38,34,0)');
        x.fillStyle = g;
        x.beginPath(); x.arc(32, 32, 13, 0, Math.PI * 2); x.fill();
        // 裂纹
        x.strokeStyle = 'rgba(20,18,16,0.55)';
        x.lineWidth = 1.2;
        for (let i = 0; i < 7; i++) {
            const a = Math.random() * Math.PI * 2;
            const len = 8 + Math.random() * 14;
            x.beginPath();
            x.moveTo(32, 32);
            x.lineTo(32 + Math.cos(a) * len, 32 + Math.sin(a) * len);
            x.stroke();
        }
        // 粉尘环
        const dust = x.createRadialGradient(32, 32, 12, 32, 32, 30);
        dust.addColorStop(0, 'rgba(160,155,145,0.22)');
        dust.addColorStop(1, 'rgba(160,155,145,0)');
        x.fillStyle = dust;
        x.beginPath(); x.arc(32, 32, 30, 0, Math.PI * 2); x.fill();
        return new THREE.CanvasTexture(c);
    }

    function _makeSparkTex() {
        const c = _canvas(32);
        const x = c.getContext('2d');
        const g = x.createRadialGradient(16, 16, 1, 16, 16, 15);
        g.addColorStop(0, 'rgba(255,240,200,1)');
        g.addColorStop(0.4, 'rgba(255,180,80,0.8)');
        g.addColorStop(1, 'rgba(255,120,20,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(c);
    }

    // ---- 池 ----
    let _flashSprite = null, _flashLight = null, _flashTime = 0;
    let _smokePool = [], _smokeActive = [];
    let _shellPool = [], _shellActive = [];
    let _decalPool = [], _decalIdx = 0;
    let _sparkPool = [], _sparkActive = [];
    let _pointLight = null;

    function _initPools() {
        _texFlash = _makeFlashTex();
        _texSmoke = _makeSmokeTex();
        _texHole = _makeHoleTex();
        _texSpark = _makeSparkTex();

        // 枪口火焰（Sprite）
        _flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: _texFlash, color: 0xffffff, transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
        }));
        _flashSprite.scale.set(0.5, 0.5, 1);
        _flashSprite.visible = false;
        _flashSprite.renderOrder = 30;
        _scene.add(_flashSprite);

        // 一枪一闪的照明：单盏常驻灯，避免灯光数量变化导致重编译
        _pointLight = new THREE.PointLight(0xffc070, 0, 14, 2);
        _pointLight.castShadow = false;
        _scene.add(_pointLight);

        // 硝烟
        for (let i = 0; i < 14; i++) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({
                map: _texSmoke, color: 0xcfcfc8, transparent: true, opacity: 0,
                depthWrite: false, blending: THREE.NormalBlending,
            }));
            s.visible = false;
            _scene.add(s);
            _smokePool.push({ sprite: s, life: 0, maxLife: 1, vy: 0, vx: 0, vz: 0, grow: 1 });
        }

        // 弹壳
        const shellGeo = new THREE.CylinderGeometry(0.009, 0.011, 0.032, 6);
        const shellMat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.95, roughness: 0.28 });
        for (let i = 0; i < 24; i++) {
            const m = new THREE.Mesh(shellGeo, shellMat);
            m.visible = false;
            m.castShadow = false;
            _scene.add(m);
            _shellPool.push({ mesh: m, active: false, vx: 0, vy: 0, vz: 0, life: 0, spin: 0 });
        }

        // 弹孔贴花
        const decalGeo = new THREE.PlaneGeometry(0.16, 0.16);
        for (let i = 0; i < 72; i++) {
            const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({
                map: _texHole, transparent: true, opacity: 0.92, depthWrite: false,
                polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
            }));
            m.visible = false;
            m.renderOrder = 5;
            _scene.add(m);
            _decalPool.push(m);
        }

        // 火花
        for (let i = 0; i < 10; i++) {
            const geo = new THREE.BufferGeometry();
            const n = 16;
            const pos = new Float32Array(n * 3);
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            const p = new THREE.Points(geo, new THREE.PointsMaterial({
                map: _texSpark, color: 0xffb060, size: 0.055, transparent: true, opacity: 1,
                blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
            }));
            p.visible = false;
            p.frustumCulled = false;
            _scene.add(p);
            _sparkPool.push({
                points: p, vel: new Float32Array(n * 3), life: 0, maxLife: 0.3,
                origin: new THREE.Vector3(), active: false,
            });
        }
        _ready = true;
    }

    function init(scene, camera) {
        if (_ready) return;
        _scene = scene;
        _camera = camera;
        try {
            _initPools();
        } catch (e) {
            console.warn('[WeaponFX] 初始化失败', e);
            _ready = false;
        }
    }

    const _worldMuzzle = new THREE.Vector3();
    const _tmpDir = new THREE.Vector3();

    /** 玩家开火特效 */
    function onShoot(opt) {
        if (!_ready) return;
        opt = opt || {};
        const cam = _camera;
        if (!cam) return;
        // 枪口位置：相机局部坐标 → 世界坐标（近似 m4 枪口）
        _worldMuzzle.set(0.20, -0.16, -0.82);
        cam.localToWorld(_worldMuzzle);

        // 火焰
        _flashSprite.position.copy(_worldMuzzle);
        _flashSprite.material.rotation = Math.random() * Math.PI * 2;
        const big = opt.kind === 'shotgun' || opt.kind === 'sniper' || opt.kind === 'heavy' ? 1.5 : 1.0;
        _flashSprite.scale.set(0.42 * big, 0.42 * big, 1);
        _flashSprite.material.opacity = 1;
        _flashSprite.visible = true;
        _flashTime = 0.055;

        // 照明
        _pointLight.position.copy(_worldMuzzle);
        _pointLight.intensity = 6.5 * big;
        _pointLight.distance = 12;

        if (_low) return;
        // 硝烟：2~3 团缓慢飘散
        const n = 2 + (big > 1 ? 1 : 0);
        for (let i = 0; i < n; i++) spawnSmoke(_worldMuzzle, 0.16 + Math.random() * 0.12, 0.9);

        // 抛壳
        if (opt.kind !== 'shotgun') spawnShell(cam);
        else spawnShell(cam, 0.9);
    }

    function spawnSmoke(pos, scale, life) {
        for (let i = 0; i < _smokePool.length; i++) {
            const s = _smokePool[i];
            if (s.sprite.visible && s.life > 0) continue;
            s.sprite.position.copy(pos);
            s.sprite.position.x += (Math.random() - 0.5) * 0.08;
            s.sprite.position.y += (Math.random() - 0.5) * 0.08;
            s.sprite.position.z += (Math.random() - 0.5) * 0.08;
            s.sprite.scale.set(scale, scale, 1);
            s.sprite.material.opacity = 0.0;
            s.sprite.visible = true;
            s.life = life || 0.9;
            s.maxLife = s.life;
            s.grow = 1.8 + Math.random();
            s.vx = (Math.random() - 0.5) * 0.12;
            s.vy = 0.22 + Math.random() * 0.15;
            s.vz = (Math.random() - 0.5) * 0.12;
            s.baseScale = scale;
            return;
        }
    }

    const _right = new THREE.Vector3(), _up = new THREE.Vector3();
    const _camQuat = new THREE.Quaternion();
    const _camWorld = new THREE.Vector3();
    function spawnShell(cam, sizeMul) {
        for (let i = 0; i < _shellPool.length; i++) {
            const sh = _shellPool[i];
            if (sh.active) continue;
            sh.active = true;
            sh.life = 3.2;
            sh.mesh.visible = true;
            sh.mesh.scale.setScalar(sizeMul || 1);
            // 从枪身右侧抛出（全部换算到世界空间，camera 是 playerGroup 的子节点）
            cam.getWorldQuaternion(_camQuat);
            cam.getWorldPosition(_camWorld);
            _right.set(1, 0, 0).applyQuaternion(_camQuat);
            _up.set(0, 1, 0).applyQuaternion(_camQuat);
            cam.getWorldDirection(_tmpDir);
            sh.mesh.position.copy(_camWorld)
                .addScaledVector(_right, 0.16)
                .addScaledVector(_up, -0.10)
                .addScaledVector(_tmpDir, 0.42);
            // 方向：向右上方抛出，带随机
            const v = new THREE.Vector3(
                1.6 + Math.random() * 0.9,
                1.5 + Math.random() * 1.1,
                (Math.random() - 0.5) * 0.8
            ).applyQuaternion(_camQuat);
            sh.vx = v.x; sh.vy = v.y; sh.vz = v.z;
            sh.spin = 8 + Math.random() * 14;
            sh.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
            return;
        }
    }

    const _sparkOrigin = new THREE.Vector3();
    function spawnSparks(point, normal, count, color) {
        for (let i = 0; i < _sparkPool.length; i++) {
            const sp = _sparkPool[i];
            if (sp.active) continue;
            sp.active = true;
            sp.life = 0.22 + Math.random() * 0.16;
            sp.maxLife = sp.life;
            sp.origin.copy(point);
            sp.points.position.copy(point);
            sp.points.visible = true;
            sp.points.material.opacity = 1;
            if (color) sp.points.material.color.setHex(color);
            const arr = sp.points.geometry.attributes.position.array;
            const n = arr.length / 3;
            for (let j = 0; j < n; j++) {
                arr[j * 3] = 0; arr[j * 3 + 1] = 0; arr[j * 3 + 2] = 0;
                const rx = (Math.random() - 0.5);
                const ry = (Math.random() - 0.5);
                const rz = (Math.random() - 0.5);
                const len = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
                const speed = 1.6 + Math.random() * 2.6;
                sp.vel[j * 3] = (rx / len + normal.x * 0.7) * speed;
                sp.vel[j * 3 + 1] = (ry / len + normal.y * 0.7) * speed + 0.8;
                sp.vel[j * 3 + 2] = (rz / len + normal.z * 0.7) * speed;
            }
            sp.points.geometry.attributes.position.needsUpdate = true;
            return;
        }
    }

    /** 弹着点 */
    function impact(point, normal, surface) {
        if (!_ready) return;
        const mesh = _decalPool[_decalIdx % _decalPool.length];
        _decalIdx++;
        mesh.position.copy(point).addScaledVector(normal, 0.012);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        mesh.quaternion.copy(q);
        mesh.rotateZ(Math.random() * Math.PI * 2);
        const s = 0.7 + Math.random() * 0.6;
        mesh.scale.set(s, s, s);
        mesh.visible = true;

        if (_low) return;
        const metal = surface === 'container' || surface === 'metal';
        spawnSparks(point, normal, metal ? 18 : 10, metal ? 0xffc070 : 0xd8c9a8);
        spawnSmoke(point, 0.1, 0.5);
    }

    /** 击中敌人的血雾（低饱和，避免过度表现） */
    function bloodHit(point) {
        if (!_ready) return;
        spawnSmoke(point, 0.1, 0.35);
        spawnSparks(point, new THREE.Vector3(0, 0.2, 0), 8, 0x8a2a26);
    }

    function update(dt) {
        if (!_ready) return;
        // 火焰衰减
        if (_flashTime > 0) {
            _flashTime -= dt;
            const k = Math.max(0, _flashTime / 0.055);
            _flashSprite.material.opacity = k;
            _pointLight.intensity = 6.5 * k * k;
            if (_flashTime <= 0) {
                _flashSprite.visible = false;
                _pointLight.intensity = 0;
            }
        }

        // 硝烟
        for (let i = 0; i < _smokePool.length; i++) {
            const s = _smokePool[i];
            if (!s.sprite.visible) continue;
            s.life -= dt;
            if (s.life <= 0) { s.sprite.visible = false; continue; }
            const t = 1 - s.life / s.maxLife;
            s.sprite.position.x += s.vx * dt;
            s.sprite.position.y += s.vy * dt;
            s.sprite.position.z += s.vz * dt;
            s.sprite.material.opacity = Math.sin(Math.min(1, t * 1.6) * Math.PI) * 0.24;
            const sc = (s.baseScale || 0.15) * (1 + t * s.grow);
            s.sprite.scale.set(sc, sc, 1);
            s.vy *= 0.985;
        }

        // 弹壳
        for (let i = 0; i < _shellPool.length; i++) {
            const sh = _shellPool[i];
            if (!sh.active) continue;
            sh.life -= dt;
            sh.vy -= 9.8 * dt;
            sh.mesh.position.x += sh.vx * dt;
            sh.mesh.position.y += sh.vy * dt;
            sh.mesh.position.z += sh.vz * dt;
            if (sh.mesh.position.y < 0.02) {
                sh.mesh.position.y = 0.02;
                sh.vy = Math.abs(sh.vy) * 0.32;
                sh.vx *= 0.62; sh.vz *= 0.62;
                sh.spin *= 0.5;
            }
            sh.mesh.rotation.x += sh.spin * dt;
            sh.mesh.rotation.z += sh.spin * 0.6 * dt;
            if (sh.life <= 0) { sh.active = false; sh.mesh.visible = false; }
        }

        // 火花
        for (let i = 0; i < _sparkPool.length; i++) {
            const sp = _sparkPool[i];
            if (!sp.active) continue;
            sp.life -= dt;
            if (sp.life <= 0) { sp.active = false; sp.points.visible = false; continue; }
            const arr = sp.points.geometry.attributes.position.array;
            const n = arr.length / 3;
            for (let j = 0; j < n; j++) {
                sp.vel[j * 3 + 1] -= 7.5 * dt;
                arr[j * 3] += sp.vel[j * 3] * dt;
                arr[j * 3 + 1] += sp.vel[j * 3 + 1] * dt;
                arr[j * 3 + 2] += sp.vel[j * 3 + 2] * dt;
            }
            sp.points.geometry.attributes.position.needsUpdate = true;
            sp.points.material.opacity = Math.max(0, sp.life / sp.maxLife);
        }
    }

    function setLowMode(v) {
        _low = v !== false;
        if (_low) reset();
    }

    function reset() {
        if (!_ready) return;
        for (const sh of _shellPool) { sh.active = false; sh.mesh.visible = false; }
        for (const s of _smokePool) { s.life = 0; s.sprite.visible = false; }
        for (const sp of _sparkPool) { sp.active = false; sp.points.visible = false; }
        for (const d of _decalPool) d.visible = false;
        _decalIdx = 0;
        _flashTime = 0;
        if (_flashSprite) _flashSprite.visible = false;
        if (_pointLight) _pointLight.intensity = 0;
    }

    return {
        init: init,
        onShoot: onShoot,
        impact: impact,
        bloodHit: bloodHit,
        update: update,
        reset: reset,
        setLowMode: setLowMode,
        isReady: function () { return _ready; },
    };
})();
