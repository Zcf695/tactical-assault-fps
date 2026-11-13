/**
 * performance_guard.js
 * 自适应性能守卫
 *
 * 背景：浏览器/核显/软件渲染（SwiftShader、llvmpipe）差异极大，
 * 固定画质档位很容易在低端设备上掉到个位数帧率。
 *
 * 策略：
 * - 启动时识别软件渲染器，直接预降两级；
 * - 每 1.2s 采样一次实际帧率，低于阈值逐级降级，只降不升，避免来回抖动；
 * - 降级顺序：关后期/降分辨率 → 关阴影 → 低配天空/去 IBL/去法线贴图 → 减植被与特效；
 * - 支持 URL `?perf=low` 强制最低档，方便排查。
 */
const PerformanceGuard = (function () {
    'use strict';

    let _renderer = null, _scene = null;
    let _level = 0;
    let _done = false;
    let _warm = 0;
    let _acc = 0, _frames = 0, _checks = 0;
    let _lastT = 0;
    let _lowStreak = 0;
    let _software = false;
    let _toastShown = false;

    function _toast(msg) {
        if (_toastShown) return;
        _toastShown = true;
        try {
            const d = document.createElement('div');
            d.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);' +
                'background:rgba(8,12,18,.9);border:1px solid rgba(255,255,255,.14);border-radius:6px;' +
                'padding:8px 16px;color:#cfe0ee;font-size:12px;letter-spacing:.5px;z-index:210;pointer-events:none;' +
                'transition:opacity .4s;';
            d.textContent = msg;
            document.body.appendChild(d);
            setTimeout(function () { d.style.opacity = '0'; }, 2600);
            setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3200);
        } catch (e) { }
    }

    function _detectSoftware() {
        try {
            const gl = _renderer.getContext();
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
            return /swiftshader|software|llvmpipe|basic render|microsoft basic/i.test(name);
        } catch (e) {
            return false;
        }
    }

    function _apply(n) {
        if (n <= _level) return;
        _level = n;
        const pipeline = (typeof RenderPipeline !== 'undefined') ? RenderPipeline : null;
        try {
            const g = (typeof GameSettings !== 'undefined' && GameSettings.getSettings) ? GameSettings.getSettings().graphics : null;
            if (g) {
                // 注意：这里不再设置 dynamicResolution = true。
                // 那是给自适应分辨率「开闸」，与守卫自己的「只降不升」语义自相矛盾：
                // 守卫把分辨率压下去、又主动打开一个会把它升回来的机制，等于自废武功。
                // 守卫对分辨率的控制权通过 RenderPipeline.setResolutionScale() 写入 _dprFloor 生效。
                if (n >= 1) { g.quality = 'low'; g.postFX = false; }
                if (n >= 2) { g.shadowQuality = 'off'; }
                if (typeof GameSettings.applySettings === 'function') GameSettings.applySettings();
            }
            if (pipeline) {
                if (n >= 3) pipeline.setLowMode(true);
                pipeline.applyQuality(true);
            }
        } catch (e) { }

        if (n >= 1) {
            const scale = n >= 4 ? 0.55 : (n >= 3 ? 0.65 : (n >= 2 ? 0.75 : 0.85));
            // 必须走管线接口，否则下一次 applyQuality 会把分辨率改回去
            if (typeof RenderPipeline !== 'undefined' && RenderPipeline.setResolutionScale) {
                RenderPipeline.setResolutionScale(scale);
            } else if (_renderer) {
                _renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, scale));
            }
        }

        // 第三级：去掉法线贴图与环境反射，这是像素着色器最贵的两块
        if (n >= 3 && _scene) {
            _scene.traverse(function (o) {
                if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
                const m = o.material;
                let dirty = false;
                if (m.normalMap) { m.normalMap = null; dirty = true; }
                if (m.envMapIntensity !== undefined && m.envMapIntensity > 0.1) { m.envMapIntensity = 0.1; dirty = true; }
                if (dirty) m.needsUpdate = true;
            });
            if (typeof ItemIcons !== 'undefined' && ItemIcons.setLowMode) ItemIcons.setLowMode(true);
        }

        if (n >= 2 && typeof WorldPolish !== 'undefined' && WorldPolish.setContactShadowsVisible) {
            WorldPolish.setContactShadowsVisible(false);
        }
        if (n >= 2 && typeof WeaponFX !== 'undefined' && WeaponFX.setLowMode) {
            WeaponFX.setLowMode(true);
        }

        // 第四级：继续压分辨率与远景，但不隐藏水面/掉落物，保证玩法信息完整
        if (n >= 4 && _scene) {
            if (typeof RenderPipeline !== 'undefined' && RenderPipeline.setResolutionScale) RenderPipeline.setResolutionScale(0.55);
            const dust = _scene.getObjectByName('dustParticles');
            if (dust) dust.visible = false;
            if (_scene.fog) _scene.fog.far = Math.min(_scene.fog.far, 120);
        }

        _toast(n >= 3 ? '已切换到性能模式（低画质）' : '帧率较低，已自动降低画质');
    }

    function init(renderer, scene) {
        _renderer = renderer;
        _scene = scene;
        _software = _detectSoftware();

        const forced = /[?&]perf=low/.test(window.location.search);
        const disabled = /[?&]perf=off/.test(window.location.search);
        if (disabled) {
            _done = true;
            return;
        }
        if (forced) {
            _apply(3);
            _done = true;
        } else if (_software) {
            // 软件渲染先降两级，但仍继续采样，必要时降到第三级
            _apply(2);
            _warm = 2.5;
        }
    }

    function update() {
        if (_done || !_renderer) return;
        // 必须用真实时间：主循环的 frameDt 有上限，低帧率时会被截断成“正常帧率”
        const now = performance.now();
        const dt = _lastT ? (now - _lastT) / 1000 : 0;
        _lastT = now;
        if (!dt || dt > 0.5) { _acc = 0; _frames = 0; return; }
        _warm += dt;
        if (_warm < 3.2) return;

        _acc += dt;
        _frames++;
        if (_acc < 1.2) return;

        const fps = _frames / _acc;
        _acc = 0;
        _frames = 0;
        _checks++;

        // 连续两次低帧才降级，避免加载/切图的一次长帧造成误判
        if (fps < 30) _lowStreak++; else _lowStreak = 0;
        if (_lowStreak >= 2) {
            if (fps < 6 && _level < 4) _apply(4);
            else if (fps < 12 && _level < 3) _apply(3);
            else if (fps < 20 && _level < 2) _apply(2);
            else if (fps < 30 && _level < 1) _apply(1);
        }

        // 已经降到最低且采样足够，就停止检测，避免持续开销
        if ((_level >= 3 && _checks >= 3) || _checks >= 10) _done = true;
    }

    function getLevel() { return _level; }
    function forceLevel(n) { _apply(n); if (n >= 3) _done = true; }

    return { init: init, update: update, getLevel: getLevel, forceLevel: forceLevel };
})();
