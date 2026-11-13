/**
 * audio_engine.js
 * 程序化音频引擎（WebAudio，无外部音频文件依赖）
 *
 * 为什么不用采样：
 * - 项目要能直接双击 index.html 运行，外部音频在 file:// 下容易被拦截；
 * - 分层合成可以按武器/材质/距离实时变化，比固定采样更耐听。
 *
 * 结构：
 *   干声 bus → 压缩器 → 主音量 → 输出
 *   发送 bus → 卷积混响（程序生成脉冲响应）→ 主音量
 *
 * 对外只暴露 play(name, opts) 与 startAmbient / stopAmbient。
 */
const AudioEngine = (function () {
    'use strict';

    let _ctx = null;
    let _master = null, _comp = null, _dry = null, _send = null, _reverb = null;
    let _noiseBuf = null;
    let _ambient = null;
    let _ambientGain = null;
    let _voices = 0;
    let _lastPlay = {};
    let _battleTimer = 0;
    let _enabled = true;

    function ctx() {
        if (_ctx) {
            if (_ctx.state === 'suspended') _ctx.resume();
            return _ctx;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        _ctx = new AC();

        _comp = _ctx.createDynamicsCompressor();
        _comp.threshold.value = -16;
        _comp.knee.value = 22;
        _comp.ratio.value = 3.2;
        _comp.attack.value = 0.004;
        _comp.release.value = 0.22;

        _master = _ctx.createGain();
        _master.gain.value = 1.0;

        _dry = _ctx.createGain();
        _dry.gain.value = 1.0;

        _send = _ctx.createGain();
        _send.gain.value = 0.9;

        // 程序化脉冲响应：1.1s 衰减噪声，模拟户外/厂房反射
        const len = Math.floor(_ctx.sampleRate * 1.1);
        const ir = _ctx.createBuffer(2, len, _ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = ir.getChannelData(c);
            for (let i = 0; i < len; i++) {
                const t = i / len;
                d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.4) * 0.55;
            }
        }
        _reverb = _ctx.createConvolver();
        _reverb.buffer = ir;

        _dry.connect(_comp);
        _reverb.connect(_comp);
        _comp.connect(_master);
        _master.connect(_ctx.destination);
        _send.connect(_reverb);

        // 2 秒白噪声，所有噪声类音效复用
        const nlen = _ctx.sampleRate * 2;
        _noiseBuf = _ctx.createBuffer(1, nlen, _ctx.sampleRate);
        const nd = _noiseBuf.getChannelData(0);
        for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;

        return _ctx;
    }

    function volume() {
        try {
            if (typeof GameSettings !== 'undefined' && GameSettings.getSettings) {
                const a = GameSettings.getSettings().audio || {};
                const m = a.masterVolume == null ? 0.8 : a.masterVolume;
                const s = a.sfxVolume == null ? 0.9 : a.sfxVolume;
                return Math.max(0, Math.min(1, m * s));
            }
        } catch (e) { }
        return 0.75;
    }

    function _voiceOk(name, minGap) {
        if (!_enabled) return false;
        const now = performance.now();
        if (_lastPlay[name] && now - _lastPlay[name] < minGap) return false;
        _lastPlay[name] = now;
        if (_voices > 26) return false;
        _voices++;
        // 简易回收：按最长的音效估算
        setTimeout(function () { _voices = Math.max(0, _voices - 1); }, 900);
        return true;
    }

    function _noise(dur, filterType, freq, q, gain, dest, pan) {
        const c = ctx();
        const src = c.createBufferSource();
        src.buffer = _noiseBuf;
        src.playbackRate.value = 0.92 + Math.random() * 0.16;
        const f = c.createBiquadFilter();
        f.type = filterType;
        f.frequency.setValueAtTime(freq, c.currentTime);
        f.Q.value = q == null ? 0.8 : q;
        const g = c.createGain();
        const v = Math.max(0.0001, gain);
        g.gain.setValueAtTime(0.0001, c.currentTime);
        g.gain.linearRampToValueAtTime(v, c.currentTime + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
        let out = g;
        if (pan != null && c.createStereoPanner) {
            const p = c.createStereoPanner();
            p.pan.value = Math.max(-1, Math.min(1, pan));
            g.connect(p);
            out = p;
        }
        src.connect(f);
        f.connect(g);
        out.connect(dest || _dry);
        src.start(c.currentTime);
        src.stop(c.currentTime + dur + 0.02);
        return { src: src, filter: f, gain: g };
    }

    function _tone(freq, endFreq, dur, type, gain, dest) {
        const c = ctx();
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, c.currentTime);
        if (endFreq && endFreq !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(12, endFreq), c.currentTime + dur);
        g.gain.setValueAtTime(0.0001, c.currentTime);
        g.gain.linearRampToValueAtTime(Math.max(0.0001, gain), c.currentTime + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
        o.connect(g);
        g.connect(dest || _dry);
        o.start(c.currentTime);
        o.stop(c.currentTime + dur + 0.02);
        return { osc: o, gain: g };
    }

    // ========== 各音效 ==========

    const GUN = {
        pistol: { dur: 0.11, freq: 1500, body: 150, thump: 0.5, gain: 0.30, tail: 0.55 },
        smg: { dur: 0.09, freq: 1700, body: 170, thump: 0.35, gain: 0.26, tail: 0.5 },
        rifle: { dur: 0.15, freq: 1150, body: 110, thump: 0.6, gain: 0.36, tail: 0.7 },
        shotgun: { dur: 0.24, freq: 760, body: 78, thump: 0.95, gain: 0.44, tail: 0.85 },
        sniper: { dur: 0.3, freq: 680, body: 62, thump: 1.0, gain: 0.42, tail: 0.95 },
        heavy: { dur: 0.26, freq: 560, body: 58, thump: 1.0, gain: 0.46, tail: 1.0 },
        knife: { dur: 0.08, freq: 2400, body: 240, thump: 0.1, gain: 0.14, tail: 0.25 },
    };

    function shot(kind, opt) {
        opt = opt || {};
        if (!_voiceOk('shot', 18)) return;
        const c = ctx();
        if (!c) return;
        const g = GUN[kind] || GUN.rifle;
        const vol = (opt.volume == null ? 1 : opt.volume) * g.gain * volume();

        // 1. 高频瞬态：枪口爆音
        _noise(g.dur * 0.35, 'highpass', 2800, 0.6, vol * 1.1);
        // 2. 中频主体：枪管共鸣
        const body = _noise(g.dur, 'lowpass', g.freq, 1.1, vol * 0.95);
        body.filter.frequency.exponentialRampToValueAtTime(Math.max(120, g.freq * 0.22), c.currentTime + g.dur);
        // 3. 低频冲击
        _tone(g.body * 1.6, g.body * 0.55, g.dur * 0.9, 'sine', vol * g.thump * 0.8);
        // 4. 尾音：混响 + 低通
        if (!opt.distant) {
            const tail = _noise(g.tail, 'lowpass', 1200, 0.5, vol * 0.28, _send);
            tail.filter.frequency.exponentialRampToValueAtTime(320, c.currentTime + g.tail);
        }
    }

    function distantShot() {
        const c = ctx();
        if (!c) return;
        const pan = (Math.random() * 2 - 1) * 0.85;
        const vol = 0.05 * volume();
        _noise(0.5, 'lowpass', 520, 0.9, vol, _send, pan);
        _noise(0.08, 'bandpass', 700, 1.2, vol * 1.28, _dry, pan);
        _tone(70, 38, 0.32, 'sine', vol * 0.6, _dry);
    }

    // 金属件动作：拉机柄 / 弹匣卡榫
    function metalClick(gain, freq, dur) {
        _noise(dur || 0.045, 'bandpass', freq || 2600, 3.0, (gain || 0.12) * volume());
        _tone((freq || 2600) * 0.6, (freq || 2600) * 0.5, (dur || 0.045) * 1.2, 'triangle', (gain || 0.12) * 0.35 * volume());
    }

    function reload(stage) {
        if (!_voiceOk('reload' + stage, 30)) return;
        if (stage === 'out') {
            metalClick(0.11, 2200, 0.05);
            setTimeout(function () { metalClick(0.09, 1800, 0.06); }, 90);
        } else if (stage === 'in') {
            setTimeout(function () { metalClick(0.13, 1500, 0.05); }, 40);
            setTimeout(function () {
                metalClick(0.15, 3200, 0.04);
                _tone(180, 90, 0.06, 'square', 0.05 * volume());
            }, 150);
        } else if (stage === 'bolt') {
            metalClick(0.15, 3000, 0.04);
            setTimeout(function () { metalClick(0.12, 2100, 0.05); }, 70);
        }
    }

    function footstep(surface, sprint, crouch) {
        if (!_voiceOk('step', sprint ? 120 : 180)) return;
        const base = sprint ? 1.0 : (crouch ? 0.35 : 0.7);
        const vol = 0.11 * base * volume();
        if (surface === 'metal') {
            _noise(0.07, 'bandpass', 1600, 1.2, vol);
            _tone(240, 150, 0.06, 'triangle', vol * 0.4);
        } else if (surface === 'water') {
            _noise(0.12, 'lowpass', 900, 0.6, vol * 1.1);
        } else if (surface === 'grass' || surface === 'dirt') {
            _noise(0.075, 'lowpass', 520, 0.7, vol * 0.9);
            _tone(90, 60, 0.05, 'sine', vol * 0.5);
        } else {
            _noise(0.06, 'bandpass', 900, 1.0, vol);
            _tone(110, 70, 0.05, 'sine', vol * 0.55);
        }
        if (sprint) _noise(0.05, 'lowpass', 380, 0.6, vol * 0.8);
    }

    function impact(surface) {
        const vol = 0.12 * volume();
        if (surface === 'metal' || surface === 'container') {
            _noise(0.06, 'bandpass', 2400, 2.0, vol);
            _tone(1400, 900, 0.07, 'triangle', vol * 0.25);
        } else {
            _noise(0.05, 'bandpass', 1100, 1.2, vol * 0.8);
            _noise(0.09, 'lowpass', 500, 0.7, vol * 0.5);
        }
    }

    function hitmarker(headshot) {
        _tone(headshot ? 1500 : 1050, headshot ? 1100 : 900, 0.05, 'triangle', 0.13 * volume());
        if (headshot) _tone(2200, 1800, 0.06, 'sine', 0.07 * volume());
    }

    function killConfirm() {
        _tone(320, 220, 0.10, 'sawtooth', 0.09 * volume());
        setTimeout(function () { _tone(760, 640, 0.09, 'sine', 0.07 * volume()); }, 55);
    }

    function hurt() {
        if (!_voiceOk('hurt', 220)) return;
        _noise(0.16, 'lowpass', 700, 0.8, 0.16 * volume());
        _tone(120, 52, 0.2, 'sine', 0.12 * volume());
    }

    function ui(kind) {
        if (kind === 'back') _tone(420, 300, 0.07, 'sine', 0.05 * volume());
        else _tone(720, 780, 0.035, 'triangle', 0.04 * volume());
    }

    function inspectSound() {
        if (!_voiceOk('inspect', 300)) return;
        _noise(0.24, 'bandpass', 1400, 0.8, 0.05 * volume());
        setTimeout(function () { metalClick(0.06, 2600, 0.03); }, 120);
    }

    function reloadAmbient() {
        const c = ctx();
        if (!c || _ambient) return;
        const src = c.createBufferSource();
        src.buffer = _noiseBuf;
        src.loop = true;
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 420;
        f.Q.value = 0.4;
        const g = c.createGain();
        g.gain.value = 0.0001;
        g.gain.linearRampToValueAtTime(0.055 * volume(), c.currentTime + 2.0);
        // 缓慢起伏的风声
        const lfo = c.createOscillator();
        const lfoGain = c.createGain();
        lfo.frequency.value = 0.07;
        lfoGain.gain.value = 160;
        lfo.connect(lfoGain);
        lfoGain.connect(f.frequency);
        src.connect(f); f.connect(g); g.connect(_dry);
        src.start();
        lfo.start();
        _ambient = { src: src, gain: g, lfo: lfo };
        _ambientGain = g;
        _scheduleBattle();
    }

    function _scheduleBattle() {
        clearTimeout(_battleTimer);
        _battleTimer = setTimeout(function () {
            if (!_ambient) return;
            if (Math.random() < 0.75) distantShot();
            if (Math.random() < 0.3) setTimeout(distantShot, 220 + Math.random() * 500);
            _scheduleBattle();
        }, 6000 + Math.random() * 12000);
    }

    function startAmbient() {
        const c = ctx();
        if (!c) return;
        if (!_ambient) reloadAmbient();
        else if (_ambientGain) _ambientGain.gain.linearRampToValueAtTime(0.055 * volume(), c.currentTime + 1.5);
    }

    function stopAmbient() {
        if (!_ambient) return;
        try {
            const c = ctx();
            _ambient.gain.gain.linearRampToValueAtTime(0.0001, c.currentTime + 1.2);
            const a = _ambient;
            _ambient = null;
            setTimeout(function () {
                try { a.src.stop(); a.lfo.stop(); } catch (e) { }
            }, 1400);
        } catch (e) {
            _ambient = null;
        }
    }

    function play(name, opt) {
        try {
            if (!ctx()) return;
            switch (name) {
                case 'shoot': shot(opt && opt.kind, opt); break;
                case 'shotDistant': distantShot(); break;
                case 'reload': reload(opt && opt.stage); break;
                case 'footstep': footstep(opt && opt.surface, opt && opt.sprint, opt && opt.crouch); break;
                case 'impact': impact(opt && opt.surface); break;
                case 'hit': hitmarker(opt && opt.headshot); break;
                case 'kill': killConfirm(); break;
                case 'hurt': hurt(); break;
                case 'inspect': inspectSound(); break;
                case 'ui': ui('click'); break;
                case 'uiBack': ui('back'); break;
                case 'metal': metalClick(opt && opt.gain, opt && opt.freq, opt && opt.dur); break;
                default: break;
            }
        } catch (e) {
            // 音频失败不影响游戏
        }
    }

    function setEnabled(v) { _enabled = v !== false; }

    return {
        play: play,
        startAmbient: startAmbient,
        stopAmbient: stopAmbient,
        setEnabled: setEnabled,
        // 兼容旧调用
        init: function () { ctx(); },
    };
})();
