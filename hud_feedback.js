/**
 * hud_feedback.js
 * 战斗与导航反馈 —— 让“打中了/被打中/往哪走”一眼可读
 *
 * 参考 3A FPS 的 HUD 分层做法：
 * 1. 罗盘目标标记：撤离点 / 空投 / Boss 任务点投影到罗盘条上，
 *    超出视野时收在边缘并降低不透明度，玩家不需要频繁开大地图。
 * 2. 伤害来源弧形：替代单一小箭头，支持同帧多次受击叠加，
 *    弧线沿屏幕边缘展开，指向性更明确且不遮挡准星。
 * 3. 命中分级：普通/爆头/击杀三种准星反馈，颜色与缩放不同。
 *
 * 本模块只读游戏状态、只操作 HUD 层，不修改玩法数据。
 */

const HudFeedback = (function () {
    let _objLayer = null;
    let _arcLayer = null;
    let _markers = [];
    let _extractRef = null;
    let _airdropRef = null;
    let _taskRef = null;
    let _sig = '';
    let _hitTimer = null;
    let _arcSeq = 0;

    const COMPASS_PX_PER_DEG = 6; // 与 game.js updateCompass 保持一致
    const COMPASS_HALF = 140;

    function init() {
        _objLayer = document.getElementById('compassObjectives');
        _arcLayer = document.getElementById('damageArcs');
    }

    function _norm180(deg) {
        let d = ((deg + 180) % 360 + 360) % 360 - 180;
        return d;
    }

    function _bearingTo(x, z) {
        const px = (typeof playerGroup !== 'undefined' && playerGroup) ? playerGroup.position.x : 0;
        const pz = (typeof playerGroup !== 'undefined' && playerGroup) ? playerGroup.position.z : 0;
        // 与罗盘一致：0=北(-Z)，顺时针为正
        return (Math.atan2(x - px, -(z - pz)) * 180 / Math.PI + 360) % 360;
    }

    function _ensureMarkers() {
        if (!_objLayer) return;
        const extracts = (typeof extractPoints !== 'undefined' && extractPoints) || [];
        const drops = (typeof airDrops !== 'undefined' && airDrops) || [];
        const tasks = (typeof bossTaskPoints !== 'undefined' && bossTaskPoints) || [];

        // 引用变化 = 新一局/新地图；长度变化 = 新增空投/任务点，均需重建
        const sig = extracts.length + '|' + drops.length + '|' + tasks.length;
        if (_extractRef === extracts && _airdropRef === drops && _taskRef === tasks && _sig === sig && _markers.length) return;
        _extractRef = extracts;
        _airdropRef = drops;
        _taskRef = tasks;
        _sig = sig;

        _objLayer.innerHTML = '';
        _markers = [];

        const add = (kind, label, getX, getZ, isActive) => {
            const el = document.createElement('div');
            el.className = 'cm cm-' + kind;
            el.innerHTML = '<i></i><b>' + label + '</b>';
            _objLayer.appendChild(el);
            _markers.push({ el: el, kind: kind, getX: getX, getZ: getZ, active: isActive });
        };

        extracts.forEach(function (ep) {
            add('extract', '撤', () => ep.x, () => ep.z, () => true);
        });
        drops.forEach(function (ad) {
            add('airdrop', '空', () => ad.x, () => ad.z, () => !ad.looted);
        });
        tasks.forEach(function (tp) {
            add('boss', 'B', () => tp.x, () => tp.z, () => !tp.accepted);
        });
    }

    /**
     * 罗盘目标投影
     * @param {number} headingDeg 相机朝向（0=北，顺时针）
     */
    function updateCompassMarkers(headingDeg) {
        if (!_objLayer) return;
        _ensureMarkers();
        if (!_markers.length) return;

        for (let i = 0; i < _markers.length; i++) {
            const m = _markers[i];
            if (!m.active()) { m.el.style.display = 'none'; continue; }
            m.el.style.display = '';

            const rel = _norm180(_bearingTo(m.getX(), m.getZ()) - headingDeg);
            let x = rel * COMPASS_PX_PER_DEG;
            const edge = Math.abs(x) > COMPASS_HALF - 8;
            if (edge) x = Math.sign(x) * (COMPASS_HALF - 8);
            m.el.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
            m.el.classList.toggle('edge', edge);
        }
    }

    /**
     * 伤害方向弧形：可叠加，1 秒后自动移除
     */
    function damageFrom(fromX, fromZ) {
        if (!_arcLayer) {
            _arcLayer = document.getElementById('damageArcs');
            if (!_arcLayer) return;
        }
        const px = (typeof playerGroup !== 'undefined' && playerGroup) ? playerGroup.position.x : 0;
        const pz = (typeof playerGroup !== 'undefined' && playerGroup) ? playerGroup.position.z : 0;
        const camDir = new THREE.Vector3();
        if (typeof camera !== 'undefined' && camera) camera.getWorldDirection(camDir);
        const camAngle = Math.atan2(camDir.x, -camDir.z) * 180 / Math.PI;
        const worldAngle = Math.atan2(fromX - px, -(fromZ - pz)) * 180 / Math.PI;
        const rel = _norm180(worldAngle - camAngle);

        // 同时最多 5 条，超出时移除最旧的，避免密集受击时 DOM 膨胀
        while (_arcLayer.children.length >= 5) {
            _arcLayer.removeChild(_arcLayer.firstChild);
        }

        const wrap = document.createElement('div');
        wrap.className = 'dmg-arc-wrap';
        wrap.style.transform = 'translate(-50%,-50%) rotate(' + rel.toFixed(1) + 'deg)';
        wrap.innerHTML =
            '<svg viewBox="-100 -100 200 200" aria-hidden="true">' +
            '<path class="dmg-arc-main" d="M -33 -84 A 90 90 0 0 1 33 -84"/>' +
            '<path class="dmg-arc-tip" d="M -20 -93 A 95 95 0 0 1 20 -93"/>' +
            '</svg>';
        wrap.dataset.seq = String(++_arcSeq);
        _arcLayer.appendChild(wrap);

        setTimeout(function () {
            if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        }, 1000);
    }

    /**
     * 命中反馈分级
     * @param {'hit'|'headshot'|'kill'} kind
     */
    function hit(kind) {
        const hm = document.getElementById('hitMarker');
        if (!hm) return;
        const k = (kind === true) ? 'kill' : (kind === false || !kind ? 'hit' : kind);
        hm.classList.remove('show', 'kill', 'headshot');
        void hm.offsetWidth;
        if (k === 'kill') hm.classList.add('kill');
        else if (k === 'headshot') hm.classList.add('headshot');
        else hm.classList.add('show');

        clearTimeout(_hitTimer);
        _hitTimer = setTimeout(function () {
            hm.classList.remove('show', 'kill', 'headshot');
        }, 500);
    }

    function reset() {
        _markers = [];
        _extractRef = null;
        _airdropRef = null;
        _taskRef = null;
        _sig = '';
        if (_objLayer) _objLayer.innerHTML = '';
        if (_arcLayer) _arcLayer.innerHTML = '';
    }

    return { init, updateCompassMarkers, damageFrom, hit, reset };
})();
