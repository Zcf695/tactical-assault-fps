/**
 * perf_manager.js
 * HUD 性能管理 —— 把“每帧重算 UI”改成“变化时才写 DOM”
 *
 * 背景：
 * 主循环原本每帧执行 updateHUD / updateWeaponUI / updateMinimap / updateCompass，
 * 其中包含大量 getElementById、innerHTML 重建与全量 canvas 重绘：
 * - updateWeaponUI 每帧重建 4 个武器槽的耐久条 DOM
 * - updateMinimap 每帧重画 100+ 建筑、200+ 容器、50+ 敌人
 * 这些开销与渲染无关，却直接吃掉帧预算。
 *
 * 职责：
 * 1. 节点缓存：同一 id 只查询一次
 * 2. 写入去重：文本/宽度/类名与上次一致时跳过
 * 3. 分频调度：HUD 20Hz、小地图 12.5Hz、罗盘 30Hz（视觉上足够平滑）
 * 4. 小地图静态层：地图底图（道路/建筑/水域/区域）离屏预渲染一次
 *
 * 用法：
 *   const due = PerfManager.tick(frameDt);
 *   if (due.hud) { updateHUD(); updateWeaponUI(); }
 *   if (due.compass) updateCompass();
 *   if (due.minimap) updateMinimap();
 */

const PerfManager = (function () {
    const _els = new Map();
    const _textCache = new Map();
    const _widthCache = new Map();
    const _classCache = new Map();

    // 分频间隔（秒）
    const INTERVAL = {
        hud: 0.05,       // 20Hz：血条/弹药/负重
        minimap: 0.08,   // 12.5Hz：小地图
        compass: 0.033,  // 30Hz：罗盘与目标标记
    };

    let _acc = { hud: 1, minimap: 1, compass: 1 };
    let _minimapLayer = null;
    let _minimapKey = '';

    /** 缓存查询；动态创建的元素请传 noCache=true */
    function el(id, noCache) {
        if (noCache) return document.getElementById(id);
        if (_els.has(id)) {
            const cached = _els.get(id);
            // 节点可能因界面重建被移除，失效时重新查询
            if (cached && cached.isConnected) return cached;
        }
        const node = document.getElementById(id);
        _els.set(id, node);
        return node;
    }

    function setText(id, value) {
        const node = el(id);
        if (!node) return;
        const text = value == null ? '' : String(value);
        if (_textCache.get(id) === text) return;
        _textCache.set(id, text);
        node.textContent = text;
    }

    function setWidth(id, percent) {
        const node = el(id);
        if (!node) return;
        let p = Number(percent);
        if (!isFinite(p)) p = 0;
        p = Math.max(0, Math.min(100, p));
        const key = Math.round(p * 10) / 10;
        if (_widthCache.get(id) === key) return;
        _widthCache.set(id, key);
        node.style.width = key + '%';
    }

    function setStyle(id, prop, value) {
        const node = el(id);
        if (!node) return;
        const key = id + '|' + prop;
        if (_textCache.get(key) === value) return;
        _textCache.set(key, value);
        node.style[prop] = value;
    }

    function toggleClass(id, className, on) {
        const node = el(id);
        if (!node) return;
        const key = id + '|' + className;
        if (_classCache.get(key) === on) return;
        _classCache.set(key, on);
        node.classList.toggle(className, !!on);
    }

    /** 主循环调用：返回本帧需要更新的 UI 分频 */
    function tick(dt) {
        const d = Math.min(dt || 0.016, 0.1);
        const due = { hud: false, minimap: false, compass: false };
        for (const k in due) {
            _acc[k] += d;
            if (_acc[k] >= INTERVAL[k]) {
                _acc[k] = 0;
                due[k] = true;
            }
        }
        return due;
    }

    /** 事件驱动的立即刷新（例如受伤、拾取、切枪） */
    function invalidate(which) {
        if (!which) {
            _acc.hud = INTERVAL.hud;
            _acc.minimap = INTERVAL.minimap;
            _acc.compass = INTERVAL.compass;
            return;
        }
        if (_acc[which] !== undefined) _acc[which] = INTERVAL[which];
    }

    /**
     * 预渲染小地图底图。
     * 底图独立于玩家位置，切图时才需要重建。
     * @param {Object} mapData MAP_DATA
     * @param {Array} buildings FIXED_BUILDINGS
     * @param {Array} zones MAP_ZONES
     */
    function buildMinimapLayer(mapData, buildings, zones) {
        if (!mapData) return _minimapLayer;
        const mapSize = mapData.mapSize || 300;
        const key = (mapData.name || 'map') + '|' + mapSize + '|' + ((buildings && buildings.length) || 0);
        if (_minimapKey === key && _minimapLayer) return _minimapLayer;

        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        const s = size / mapSize;
        const toX = (wx) => (wx + mapSize / 2) * s;
        const toY = (wz) => (wz + mapSize / 2) * s;

        // 底色与 50m 网格，提供空间尺度参照
        ctx.fillStyle = '#0c1117';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = 'rgba(255,255,255,0.045)';
        ctx.lineWidth = 1;
        for (let g = -mapSize / 2; g <= mapSize / 2; g += 50) {
            ctx.beginPath();
            ctx.moveTo(toX(g), 0); ctx.lineTo(toX(g), size);
            ctx.moveTo(0, toY(g)); ctx.lineTo(size, toY(g));
            ctx.stroke();
        }

        // 水域
        ctx.fillStyle = 'rgba(26,74,106,0.65)';
        for (const wa of (mapData.waterAreas || [])) {
            ctx.fillRect(toX(wa.x - wa.w / 2), toY(wa.z - wa.d / 2), wa.w * s, wa.d * s);
        }

        // 道路
        ctx.fillStyle = 'rgba(120,120,110,0.30)';
        for (const road of (mapData.roads || [])) {
            ctx.fillRect(toX(road.x - road.w / 2), toY(road.z - road.d / 2), road.w * s, road.d * s);
        }

        // 建筑：主体 + 顶部高光边，形成可读的街区轮廓
        for (const b of (buildings || [])) {
            const x = toX(b.x - b.w / 2), y = toY(b.z - b.d / 2);
            const w = Math.max(1, b.w * s), h = Math.max(1, b.d * s);
            ctx.fillStyle = 'rgba(86,96,110,0.92)';
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = 'rgba(180,196,214,0.22)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
        }

        // 区域边界：保留原色但降低饱和度，避免底图过于花哨
        for (const z of (zones || [])) {
            ctx.strokeStyle = z.color || 'rgba(150,160,175,0.35)';
            ctx.globalAlpha = 0.35;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(toX(z.x), toY(z.z), (z.radius || 14) * s, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        _minimapLayer = canvas;
        _minimapKey = key;
        return _minimapLayer;
    }

    function resetMinimapLayer() {
        _minimapLayer = null;
        _minimapKey = '';
    }

    return {
        el,
        setText,
        setWidth,
        setStyle,
        toggleClass,
        tick,
        invalidate,
        buildMinimapLayer,
        resetMinimapLayer,
    };
})();
