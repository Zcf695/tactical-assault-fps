/**
 * item_icons.js
 * 用离屏 WebGL 把物品 3D 模型渲染成库存缩略图
 *
 * 为什么这么做：
 * - 库存里原本是 emoji，与场景中的实体模型完全脱节；
 * - 用同一套 ItemModels 渲染 96px 缩略图，图标、地面模型、检视模型三者一致；
 * - 生成一次后缓存为 dataURL，之后只是普通 <img>，没有持续渲染开销。
 *
 * 用法：
 *   ItemIcons.request(itemId)  → dataURL | null（未生成时返回 null，调用方先用 emoji 占位）
 *   ItemIcons.prewarm([...ids])
 */
const ItemIcons = (function () {
    'use strict';

    const SIZE = 112;
    let _renderer = null, _scene = null, _camera = null, _root = null;
    const _cache = {};
    const _queue = [];
    let _running = false;
    let _onReady = null;
    let _lowMode = false;
    let _idleTimer = 0;

    function _ensure() {
        if (_renderer) return true;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = SIZE;
            _renderer = new THREE.WebGLRenderer({
                canvas: canvas, alpha: true, antialias: true, preserveDrawingBuffer: true,
            });
            _renderer.setPixelRatio(1);
            _renderer.setSize(SIZE, SIZE, false);
            _renderer.setClearAlpha(0);
            if ('outputEncoding' in _renderer) _renderer.outputEncoding = THREE.sRGBEncoding;
            _renderer.toneMapping = THREE.ACESFilmicToneMapping;
            _renderer.toneMappingExposure = 1.0;
        } catch (e) {
            console.warn('[ItemIcons] WebGL 初始化失败，使用 emoji 回退', e);
            return false;
        }

        _scene = new THREE.Scene();
        _camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
        _camera.position.set(0, 0.42, 2.5);
        _camera.lookAt(0, -0.02, 0);

        // 环境：暗背景 + 柔光箱，保证金属有反射层次
        try {
            const c = document.createElement('canvas');
            c.width = 128; c.height = 64;
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#1a2028'; ctx.fillRect(0, 0, 128, 64);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(12, 4, 34, 18);
            ctx.fillStyle = 'rgba(255,210,160,0.9)'; ctx.fillRect(72, 12, 14, 22);
            ctx.fillStyle = 'rgba(150,205,255,0.8)'; ctx.fillRect(102, 8, 12, 18);
            const tex = new THREE.CanvasTexture(c);
            tex.mapping = THREE.EquirectangularReflectionMapping;
            const pmrem = new THREE.PMREMGenerator(_renderer);
            pmrem.compileEquirectangularShader();
            const rt = pmrem.fromEquirectangular(tex);
            _scene.environment = rt.texture;
            tex.dispose();
            pmrem.dispose();
        } catch (e) { /* 没环境也能出图 */ }

        const key = new THREE.DirectionalLight(0xfff2df, 2.0);
        key.position.set(2, 3, 3);
        _scene.add(key);
        const fill = new THREE.DirectionalLight(0x9cc4e0, 1.0);
        fill.position.set(-3, 0.5, 1.5);
        _scene.add(fill);
        const rim = new THREE.DirectionalLight(0xffffff, 1.8);
        rim.position.set(-1, 1.5, -2.5);
        _scene.add(rim);
        _scene.add(new THREE.AmbientLight(0x8899aa, 0.5));

        _root = new THREE.Group();
        _scene.add(_root);
        return true;
    }

    function _renderOne(id) {
        if (!_ensure()) return null;
        while (_root.children.length) _root.remove(_root.children[0]);
        const model = ItemModels.create(id, { size: 1.35 });
        model.rotation.set(0.12, -0.55, 0);
        _root.add(model);
        _renderer.render(_scene, _camera);
        try {
            return _renderer.domElement.toDataURL('image/png');
        } catch (e) {
            return null;
        }
    }

    function _notify(id, url) {
        if (!url) return;
        if (typeof document === 'undefined') return;
        const nodes = document.querySelectorAll('[data-icon-id="' + id + '"]');
        for (let i = 0; i < nodes.length; i++) {
            const el = nodes[i];
            if (el.tagName === 'IMG') el.src = url;
            else {
                const img = document.createElement('img');
                img.src = url;
                img.setAttribute('data-icon-id', id);
                img.style.cssText = 'max-width:92%;max-height:92%;object-fit:contain;pointer-events:none;';
                el.replaceWith(img);
            }
        }
        if (typeof _onReady === 'function') {
            try { _onReady(id, url); } catch (e) { }
        }
    }

    function _disposeGL() {
        if (_renderer) {
            try { _renderer.dispose(); } catch (e) { }
            try { _renderer.forceContextLoss(); } catch (e) { }
        }
        _renderer = null; _scene = null; _camera = null; _root = null;
    }

    function _scheduleDispose() {
        clearTimeout(_idleTimer);
        // 图标已缓存为 dataURL，闲置后释放额外 WebGL 上下文，避免低端设备多上下文掉帧
        _idleTimer = setTimeout(_disposeGL, 4000);
    }

    function setLowMode(v) {
        _lowMode = v !== false;
        if (_lowMode) {
            _queue.length = 0;
            _running = false;
            _disposeGL();
        }
    }

    function _step() {
        clearTimeout(_idleTimer);
        if (_lowMode) { _queue.length = 0; _running = false; _disposeGL(); return; }
        if (!_queue.length) { _running = false; _scheduleDispose(); return; }
        // 跑图期间不要做 GPU 回读，等切到背包/搜索界面再生成
        if (typeof S !== 'undefined' && S && S.phase === 'playing') {
            setTimeout(_step, 900);
            return;
        }
        const id = _queue.shift();
        if (_cache[id] === undefined) {
            _cache[id] = _renderOne(id) || null;
            _notify(id, _cache[id]);
        }
        // 正在跑图时暂停缩略图生成：toDataURL 会同步回读 GPU，容易造成明显卡顿。
        // 玩家打开背包/搜索界面（phase 切换）后再继续生成。
        const inRaid = (typeof S !== 'undefined' && S && S.phase === 'playing');
        setTimeout(_step, inRaid ? 900 : 24);
    }

    function _kick() {
        if (_running) return;
        _running = true;
        requestAnimationFrame(_step);
    }

    function request(id) {
        if (!id) return null;
        if (_cache[id] !== undefined) return _cache[id];
        if (_queue.indexOf(id) < 0) { _queue.push(id); _kick(); }
        return null;
    }

    function prewarm(ids) {
        (ids || []).forEach(function (id) {
            if (_cache[id] === undefined && _queue.indexOf(id) < 0) _queue.push(id);
        });
        _kick();
    }

    function setReadyCallback(fn) { _onReady = fn; }

    return { request: request, prewarm: prewarm, setReadyCallback: setReadyCallback, setLowMode: setLowMode };
})();
