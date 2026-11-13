/**
 * inspect_viewer.js
 * 物品 3D 检视器
 *
 * - 独立的小型 WebGL 场景（480×480），只在打开时渲染；
 * - 模型来自 ItemModels，带金属环境反射、三点布光、稀有度轮廓光；
 * - 支持拖拽旋转 / 滚轮缩放 / 自动旋转 / Esc 关闭；
 * - DOM 与样式由模块自建，不需要在 index.html 里预埋结构。
 */
const InspectViewer = (function () {
    'use strict';

    let _root = null, _canvas = null, _renderer = null, _scene = null, _camera = null;
    let _modelGroup = null, _floor = null, _particles = null, _rim = null;
    let _envRT = null;
    let _open = false;
    let _raf = 0;
    let _last = 0;
    let _autoRotate = true;
    let _rotY = 0, _rotX = 0;
    let _velY = 0, _velX = 0;
    let _zoom = 2.35, _zoomTarget = 2.35;
    let _dragging = false, _lastPX = 0, _lastPY = 0;
    let _currentId = null;
    const _viewerMats = [];
    let _disposeTimer = 0;

    const TYPE_LABEL = {
        valuable: '贵重物品',
        heal: '医疗物资',
        ammo: '弹药',
        weapon: '武器',
        armor: '护甲',
        helmet: '头盔',
        chestRig: '胸挂',
        backpack: '背包',
        keycard: '钥匙卡',
        key: '钥匙',
        misc: '杂物',
    };

    const FLAVOR = {
        valuable: '可在撤离后出售给商人。品相越好，报价越高。',
        heal: '战地医疗物资，能在关键时刻把人从边缘拉回来。',
        ammo: '与武器口径匹配的弹药，压制火力的基础。',
        weapon: '经过战场检验的可靠武器，注意枪管温度与弹道下坠。',
        armor: '复合防弹插板，能吸收大部分躯干伤害。',
        helmet: '轻量化头盔，可抵挡破片与跳弹。',
        backpack: '大容量携行具，决定了你这一趟能带走多少。',
        chestRig: '模块化胸挂，让换弹与急救更快一步。',
        keycard: '权限卡，对应某扇上锁的门。',
        key: '一把磨损的钥匙，锁孔在等着它。',
    };

    const RARITY_COLOR = {
        common: '#9e9e9e', uncommon: '#4caf50', rare: '#2196f3',
        epic: '#9c27b0', legendary: '#ff9800', ultimate: '#f44336',
    };

    function _ensure() {
        if (_root) return;
        const style = document.createElement('style');
        style.textContent = `
        #ivRoot{position:fixed;inset:0;z-index:320;display:none;align-items:center;justify-content:center;
            background:radial-gradient(ellipse at 42% 45%,rgba(22,30,38,.86),rgba(4,6,9,.97) 62%);
            backdrop-filter:blur(6px);font-family:var(--font-body,'Segoe UI',sans-serif);}
        #ivRoot.show{display:flex;animation:ivFade .22s ease-out;}
        @keyframes ivFade{from{opacity:0}to{opacity:1}}
        #ivCard{position:relative;display:flex;gap:26px;padding:26px 30px 24px;border-radius:14px;
            background:linear-gradient(160deg,rgba(18,24,32,.94),rgba(8,11,16,.96));
            border:1px solid rgba(255,255,255,.10);
            box-shadow:0 30px 90px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.03) inset;
            max-width:min(92vw,900px);}
        #ivCard::before{content:'';position:absolute;inset:-1px;border-radius:14px;pointer-events:none;
            background:radial-gradient(circle at 25% 0%,var(--iv-glow,rgba(255,255,255,.10)),transparent 60%);
            opacity:.55;}
        #ivStage{position:relative;width:470px;height:470px;flex:0 0 auto;border-radius:10px;
            background:radial-gradient(circle at 50% 42%,rgba(120,150,180,.15),rgba(0,0,0,.35) 70%);
            overflow:hidden;border:1px solid rgba(255,255,255,.06);}
        #ivCanvas{width:470px;height:470px;display:block;cursor:grab;}
        #ivCanvas.grabbing{cursor:grabbing;}
        #ivStage .iv-hint{position:absolute;left:0;right:0;bottom:10px;text-align:center;
            font-size:11px;letter-spacing:.6px;color:rgba(200,214,228,.5);pointer-events:none;}
        #ivStage .iv-auto{position:absolute;top:10px;right:10px;font-size:10px;letter-spacing:1px;
            color:rgba(200,214,228,.55);border:1px solid rgba(255,255,255,.12);border-radius:20px;
            padding:4px 10px;cursor:pointer;background:rgba(0,0,0,.25);user-select:none;}
        #ivStage .iv-auto.on{color:#9fe0ff;border-color:rgba(120,200,255,.4);}
        #ivInfo{width:292px;display:flex;flex-direction:column;min-height:470px;padding-top:4px;}
        #ivRarity{display:inline-flex;align-items:center;gap:6px;font-size:10px;letter-spacing:2px;
            font-weight:700;text-transform:uppercase;color:var(--iv-color,#ccc);}
        #ivRarity::before{content:'';width:18px;height:2px;background:currentColor;display:block;}
        #ivName{font-family:var(--font-heading,'Segoe UI',sans-serif);font-size:29px;font-weight:700;
            color:#eef3f8;margin:8px 0 2px;letter-spacing:.5px;line-height:1.15;}
        #ivType{font-size:11px;color:#7d8b99;letter-spacing:1px;}
        #ivDivider{height:1px;background:linear-gradient(90deg,rgba(255,255,255,.16),transparent);
            margin:16px 0 14px;}
        #ivValueLabel{font-size:10px;letter-spacing:1.5px;color:#6f7d8b;}
        #ivValue{font-family:var(--font-heading);font-size:26px;font-weight:700;color:#f2d59a;margin-top:2px;}
        #ivValue span{font-size:13px;color:#8a7a5c;margin-left:4px;font-weight:400;}
        #ivStats{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-top:18px;}
        #ivStats div{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06);
            border-radius:6px;padding:8px 10px;}
        #ivStats b{display:block;font-size:9px;letter-spacing:1px;color:#74828f;font-weight:600;margin-bottom:3px;}
        #ivStats i{font-style:normal;font-size:14px;color:#dfe7ee;}
        #ivFlavor{margin-top:16px;font-size:12px;line-height:1.7;color:#8d9aa7;
            border-left:2px solid rgba(255,255,255,.12);padding-left:10px;flex:1;}
        #ivClose{margin-top:16px;align-self:flex-start;padding:9px 22px;border-radius:6px;cursor:pointer;
            font-size:12px;letter-spacing:2px;color:#cfdae5;background:rgba(255,255,255,.06);
            border:1px solid rgba(255,255,255,.14);transition:.15s;}
        #ivClose:hover{background:rgba(255,255,255,.12);color:#fff;}
        @media (max-width:900px){
            #ivCard{flex-direction:column;gap:14px;padding:16px;}
            #ivStage,#ivCanvas{width:min(86vw,420px);height:min(86vw,420px);}
            #ivInfo{width:min(86vw,420px);min-height:0;}
        }`;
        document.head.appendChild(style);

        _root = document.createElement('div');
        _root.id = 'ivRoot';
        _root.innerHTML = `
            <div id="ivCard">
                <div id="ivStage">
                    <canvas id="ivCanvas" width="470" height="470"></canvas>
                    <div class="iv-auto on" id="ivAuto">自动旋转</div>
                    <div class="iv-hint">拖拽旋转 · 滚轮缩放 · Esc 关闭</div>
                </div>
                <div id="ivInfo">
                    <div id="ivRarity">稀有</div>
                    <div id="ivName">物品</div>
                    <div id="ivType">贵重物品</div>
                    <div id="ivDivider"></div>
                    <div id="ivValueLabel">估值</div>
                    <div id="ivValue">₵0<span>出售价</span></div>
                    <div id="ivStats">
                        <div><b>占格</b><i id="ivSize">1×1</i></div>
                        <div><b>稀有度</b><i id="ivRarityText">稀有</i></div>
                        <div><b>类别</b><i id="ivTypeText">贵重</i></div>
                        <div><b>模型</b><i id="ivPoly">—</i></div>
                    </div>
                    <div id="ivFlavor"></div>
                    <button id="ivClose">关 闭</button>
                </div>
            </div>`;
        document.body.appendChild(_root);

        _canvas = _root.querySelector('#ivCanvas');
        _root.querySelector('#ivClose').addEventListener('click', close);
        _root.querySelector('#ivAuto').addEventListener('click', function () {
            _autoRotate = !_autoRotate;
            this.classList.toggle('on', _autoRotate);
        });
        _root.addEventListener('mousedown', function (e) {
            if (e.target === _root) close();
        });

        _canvas.addEventListener('mousedown', function (e) {
            _dragging = true;
            _lastPX = e.clientX; _lastPY = e.clientY;
            _canvas.classList.add('grabbing');
        });
        window.addEventListener('mousemove', function (e) {
            if (!_dragging) return;
            const dx = e.clientX - _lastPX, dy = e.clientY - _lastPY;
            _lastPX = e.clientX; _lastPY = e.clientY;
            _velY = dx * 0.008;
            _velX = dy * 0.006;
            _rotY += _velY;
            _rotX = Math.max(-1.2, Math.min(1.2, _rotX + _velX));
        });
        window.addEventListener('mouseup', function () {
            _dragging = false;
            if (_canvas) _canvas.classList.remove('grabbing');
        });
        _canvas.addEventListener('wheel', function (e) {
            e.preventDefault();
            _zoomTarget = Math.max(1.55, Math.min(3.8, _zoomTarget + e.deltaY * 0.0016));
        }, { passive: false });

        window.addEventListener('keydown', function (e) {
            if (_open && e.code === 'Escape') { e.stopPropagation(); close(); }
        });
        // 捕获阶段拦截，防止 Esc 同时关闭背包
        window.addEventListener('keydown', function (e) {
            if (_open && e.code === 'Escape') e.preventDefault();
        }, true);
    }

    function _disposeGL() {
        if (!_renderer) return;
        while (_viewerMats.length) {
            try { _viewerMats.pop().dispose(); } catch (e) { }
        }
        try { if (_envRT) _envRT.dispose(); } catch (e) { }
        try { _renderer.dispose(); } catch (e) { }
        try { _renderer.forceContextLoss(); } catch (e) { }
        _renderer = null; _scene = null; _camera = null;
        _modelGroup = null; _floor = null; _particles = null; _rim = null; _envRT = null;
    }

    function _scheduleDispose() {
        clearTimeout(_disposeTimer);
        // 关闭后 20s 释放独立 WebGL 上下文，避免与主渲染器长期争抢资源
        _disposeTimer = setTimeout(_disposeGL, 20000);
    }

    function _initGL() {
        if (_renderer) return true;
        try {
            _renderer = new THREE.WebGLRenderer({ canvas: _canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
        } catch (e) {
            console.warn('[InspectViewer] WebGL 初始化失败', e);
            return false;
        }
        _renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        _renderer.setSize(470, 470, false);
        _renderer.setClearAlpha(0);
        if ('outputEncoding' in _renderer) _renderer.outputEncoding = THREE.sRGBEncoding;
        _renderer.toneMapping = THREE.ACESFilmicToneMapping;
        _renderer.toneMappingExposure = 0.92;

        _scene = new THREE.Scene();
        _camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
        _camera.position.set(0, 0.12, _zoom);
        _camera.lookAt(0, 0.02, 0);

        // 环境反射：用一张渐变 equirect 烘焙 PMREM，金属才有层次
        try {
            const c = document.createElement('canvas');
            c.width = 256; c.height = 128;
            const ctx = c.getContext('2d');
            // 暗色摄影棚：暗环境 + 三块柔光箱，金属才有明暗对比而不是一片死白
            const grad = ctx.createLinearGradient(0, 0, 0, 128);
            grad.addColorStop(0, '#20262e');
            grad.addColorStop(0.46, '#141a20');
            grad.addColorStop(0.55, '#0a0c0f');
            grad.addColorStop(1, '#050607');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 128);
            const box = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
            // 主光（顶部偏左）
            box(28, 8, 74, 34, 'rgba(255,252,244,1)');
            box(24, 4, 82, 44, 'rgba(255,250,238,0.35)');
            // 暖侧光
            box(150, 26, 26, 44, 'rgba(255,206,150,0.9)');
            // 冷侧光
            box(212, 20, 20, 32, 'rgba(150,208,255,0.85)');
            // 地面反光
            box(60, 100, 130, 10, 'rgba(130,150,170,0.16)');
            const envTex = new THREE.CanvasTexture(c);
            envTex.mapping = THREE.EquirectangularReflectionMapping;
            const pmrem = new THREE.PMREMGenerator(_renderer);
            pmrem.compileEquirectangularShader();
            _envRT = pmrem.fromEquirectangular(envTex);
            _scene.environment = _envRT.texture;
            envTex.dispose();
            pmrem.dispose();
        } catch (e) { /* 环境反射失败不影响主体 */ }

        const key = new THREE.DirectionalLight(0xfff2df, 1.6);
        key.position.set(2.2, 3.0, 2.4);
        _scene.add(key);
        const fill = new THREE.DirectionalLight(0x9cc4e0, 0.75);
        fill.position.set(-3, 1.0, 1.2);
        _scene.add(fill);
        _rim = new THREE.PointLight(0xffffff, 2.2, 8, 2);
        _rim.position.set(-0.6, 1.1, -1.8);
        _scene.add(_rim);

        // 地面：径向渐变 + 轻微反射
        const fc = document.createElement('canvas');
        fc.width = fc.height = 256;
        const fctx = fc.getContext('2d');
        const rg = fctx.createRadialGradient(128, 128, 10, 128, 128, 126);
        rg.addColorStop(0, 'rgba(150,175,200,0.30)');
        rg.addColorStop(0.55, 'rgba(80,100,120,0.10)');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        fctx.fillStyle = rg; fctx.fillRect(0, 0, 256, 256);
        const floorTex = new THREE.CanvasTexture(fc);
        _floor = new THREE.Mesh(
            new THREE.CircleGeometry(1.5, 48),
            new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false })
        );
        _floor.rotation.x = -Math.PI / 2;
        _floor.position.y = -0.62;
        _scene.add(_floor);

        // 悬浮微粒
        const pGeo = new THREE.BufferGeometry();
        const n = 70;
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 3;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 2;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 2;
        }
        pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        _particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
            color: 0xbfd8ea, size: 0.012, transparent: true, opacity: 0.55, depthWrite: false,
        }));
        _scene.add(_particles);
        return true;
    }

    function _mountModel(id) {
        if (_modelGroup) {
            _scene.remove(_modelGroup);
            _modelGroup = null;
        }
        while (_viewerMats.length) {
            try { _viewerMats.pop().dispose(); } catch (e) { }
        }
        const def = (typeof ITEMS !== 'undefined' && ITEMS[id]) || null;
        const rarity = def ? def.rarity : 'common';
        _modelGroup = new THREE.Group();
        const model = ItemModels.create(id, { size: 1.42 });
        // 克隆材质并降低环境反射，避免共享材质导致模型在检视器里过曝
        const seen = {};
        model.traverse(function (o) {
            if (!o.isMesh || !o.material) return;
            const src = o.material;
            if (!seen[src.uuid]) {
                const m = src.clone();
                if (m.envMapIntensity !== undefined) m.envMapIntensity = Math.min(1.0, (m.envMapIntensity || 1) * 0.75);
                if (m.roughness !== undefined) m.roughness = Math.min(1, m.roughness + 0.06);
                seen[src.uuid] = m;
                _viewerMats.push(m);
            }
            o.material = seen[src.uuid];
        });
        _modelGroup.add(model);
        _scene.add(_modelGroup);

        // 底面接触阴影
        const sc = document.createElement('canvas');
        sc.width = sc.height = 128;
        const sctx = sc.getContext('2d');
        const sg = sctx.createRadialGradient(64, 64, 4, 64, 64, 62);
        sg.addColorStop(0, 'rgba(0,0,0,0.62)');
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        sctx.fillStyle = sg; sctx.fillRect(0, 0, 128, 128);
        const st = new THREE.CanvasTexture(sc);
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5),
            new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, opacity: 0.85 }));
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = -0.60;
        _modelGroup.add(shadow);

        // 稀有度轮廓光
        const col = new THREE.Color(RARITY_COLOR[rarity] || '#ffffff');
        if (_rim) { _rim.color.copy(col); _rim.intensity = rarity === 'common' ? 1.1 : 2.6; }
        _floor.material.color.copy(col).lerp(new THREE.Color(0xffffff), 0.55);

        // 自动旋转初值：从侧面进入，观感更好
        _rotY = -0.6; _rotX = 0.08; _velY = 0; _velX = 0;
        // 按模型包围盒自动取景，避免宽模型（显卡/步枪）被裁切
        try {
            _modelGroup.updateMatrixWorld(true);
            const bb = new THREE.Box3().setFromObject(model);
            const sz = new THREE.Vector3();
            bb.getSize(sz);
            const maxDim = Math.max(sz.x, sz.y, sz.z) || 1;
            const fit = (maxDim * 0.5) / Math.tan((_camera.fov * Math.PI / 180) * 0.5) * 1.22;
            _zoomTarget = Math.max(2.4, Math.min(4.6, fit));
        } catch (e) {
            _zoomTarget = 3.0;
        }
        _zoom = _zoomTarget * 1.06;
        _autoRotate = true;
        const autoBtn = _root.querySelector('#ivAuto');
        if (autoBtn) autoBtn.classList.add('on');
    }

    function _updateInfo(id) {
        const def = (typeof ITEMS !== 'undefined' && ITEMS[id]) || { name: id, rarity: 'common', type: 'misc', value: 0, w: 1, h: 1 };
        const rarity = def.rarity || 'common';
        const color = RARITY_COLOR[rarity] || '#ccc';
        const rarityName = (typeof RARITY !== 'undefined' && RARITY[rarity] && RARITY[rarity].name) || rarity;
        const typeName = TYPE_LABEL[def.type] || '物品';
        _root.style.setProperty('--iv-color', color);
        _root.style.setProperty('--iv-glow', color + '55');
        _root.querySelector('#ivRarity').textContent = rarityName;
        _root.querySelector('#ivName').textContent = def.name || id;
        _root.querySelector('#ivType').textContent = typeName;
        _root.querySelector('#ivValue').innerHTML = '₵' + (def.value || 0).toLocaleString() + '<span>出售价</span>';
        _root.querySelector('#ivSize').textContent = (def.w || 1) + '×' + (def.h || 1);
        _root.querySelector('#ivRarityText').textContent = rarityName;
        _root.querySelector('#ivTypeText').textContent = typeName;
        const polyEl = _root.querySelector('#ivPoly');
        let tri = 0;
        if (_modelGroup) {
            _modelGroup.traverse(function (o) {
                if (o.isMesh && o.geometry && o.geometry.attributes.position) {
                    tri += o.geometry.attributes.position.count / 3;
                }
            });
        }
        polyEl.textContent = tri > 0 ? Math.round(tri) + ' 面' : '—';
        const flavor = FLAVOR[def.type] || FLAVOR.valuable;
        const sizeText = (def.w || 1) * (def.h || 1) >= 4 ? '体积较大，占用了可观的背包空间。' : '体积紧凑，适合塞进安全箱。';
        _root.querySelector('#ivFlavor').textContent = flavor + ' ' + sizeText;
    }

    function _loop(t) {
        if (!_open) return;
        _raf = requestAnimationFrame(_loop);
        const dt = Math.min(0.05, (t - (_last || t)) / 1000);
        _last = t;

        if (!_dragging) {
            if (_autoRotate) _rotY += dt * 0.55;
            _rotY += _velY;
            _rotX = Math.max(-1.2, Math.min(1.2, _rotX + _velX));
            _velY *= 0.92;
            _velX *= 0.9;
        }
        _zoom += (_zoomTarget - _zoom) * Math.min(1, dt * 9);
        if (_camera) {
            _camera.position.z = _zoom;
            _camera.position.y = 0.16 + _rotX * 0.16;
            _camera.lookAt(0, 0.02 + _rotX * 0.05, 0);
        }
        if (_modelGroup) {
            _modelGroup.rotation.y = _rotY;
            _modelGroup.rotation.x = _rotX * 0.55;
            _modelGroup.position.y = Math.sin(t * 0.0012) * 0.012;
        }
        if (_particles) _particles.rotation.y += dt * 0.06;
        if (_renderer && _scene && _camera) _renderer.render(_scene, _camera);
    }

    function open(id, opt) {
        if (!id) return;
        clearTimeout(_disposeTimer);
        _ensure();
        if (!_initGL()) return;
        _currentId = id;
        _mountModel(id);
        _updateInfo(id);
        _root.classList.add('show');
        _open = true;
        _last = 0;
        try { if (typeof AudioEngine !== 'undefined') AudioEngine.play('inspect'); } catch (e) { }
        cancelAnimationFrame(_raf);
        _raf = requestAnimationFrame(_loop);
    }

    function close() {
        if (!_open) return;
        _open = false;
        cancelAnimationFrame(_raf);
        if (_root) _root.classList.remove('show');
        _scheduleDispose();
        try { if (typeof AudioEngine !== 'undefined') AudioEngine.play('uiBack'); } catch (e) { }
    }

    function isOpen() { return _open; }

    return { open: open, close: close, isOpen: isOpen };
})();
