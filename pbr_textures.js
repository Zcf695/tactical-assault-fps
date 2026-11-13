/**
 * pbr_textures.js
 * 程序化 PBR 材质库（反照率 / 法线 / 粗糙度 / 金属度）
 *
 * 设计目标：
 * - 不依赖外部图片，离线可用，避免 file:// 与 CORS 问题；
 * - 所有纹理可无缝平铺（噪声在整数周期上取模）；
 * - 贴图只生成一次并全局共享，网格通过缩放 UV 控制世界尺度，
 *   因此不会出现「每个网格克隆一张贴图」的显存爆炸；
 * - 单张 256²，法线由高度场 Sobel 生成，足以支撑 3A 风格的中近景。
 *
 * 用法：
 *   PBRTextures.init(renderer);                 // 可选，用于各向异性过滤
 *   PBRTextures.applyToMesh(mesh, 'concrete', { tileU: 2.4, tileV: 2.4 });
 *   const set = PBRTextures.get('asphalt');     // { map, normalMap, roughnessMap }
 */
const PBRTextures = (function () {
    'use strict';

    const _sets = {};
    let _maxAniso = 4;
    let _renderer = null;

    // ========== 基础数学 / 噪声 ==========

    function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
    function mix(a, b, t) { return a + (b - a) * t; }
    function smoothstep(e0, e1, x) {
        const t = clamp01((x - e0) / (e1 - e0 || 1e-6));
        return t * t * (3 - 2 * t);
    }
    function fract(v) { return v - Math.floor(v); }

    // 整数格点哈希：保证 (x + period) 与 x 同值 → 可平铺
    function hash2(x, y, seed) {
        const n = Math.sin(x * 127.1 + y * 311.7 + seed * 43.771) * 43758.5453123;
        return n - Math.floor(n);
    }

    function vnoise(x, y, period, seed) {
        const xi = Math.floor(x), yi = Math.floor(y);
        const xf = x - xi, yf = y - yi;
        const u = xf * xf * (3 - 2 * xf);
        const v = yf * yf * (3 - 2 * yf);
        const p = Math.max(1, period | 0);
        const w = function (i) { return ((i % p) + p) % p; };
        const x0 = w(xi), x1 = w(xi + 1), y0 = w(yi), y1 = w(yi + 1);
        const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed);
        const c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
        return mix(mix(a, b, u), mix(c, d, u), v);
    }

    function fbm(x, y, freq, octaves, seed, gain) {
        let sum = 0, amp = 1, norm = 0, f = Math.max(1, freq | 0);
        gain = gain == null ? 0.5 : gain;
        for (let o = 0; o < octaves; o++) {
            sum += vnoise(x * f, y * f, f, seed + o * 17) * amp;
            norm += amp;
            amp *= gain;
            f *= 2;
        }
        return sum / norm;
    }

    // 脊状噪声：用于裂缝、纤维
    function ridge(x, y, freq, octaves, seed) {
        let sum = 0, amp = 1, norm = 0, f = Math.max(1, freq | 0);
        for (let o = 0; o < octaves; o++) {
            const n = vnoise(x * f, y * f, f, seed + o * 31);
            sum += (1 - Math.abs(n * 2 - 1)) * amp;
            norm += amp;
            amp *= 0.5;
            f *= 2;
        }
        return sum / norm;
    }

    // ========== 生成管线 ==========

    function makeCanvas(size) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        return c;
    }

    function encodeNormal(size, height, strength) {
        const canvas = makeCanvas(size);
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(size, size);
        const d = img.data;
        const wrap = function (i) { return ((i % size) + size) % size; };
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const hL = height[y * size + wrap(x - 1)];
                const hR = height[y * size + wrap(x + 1)];
                const hUp = height[wrap(y - 1) * size + x];
                const hDn = height[wrap(y + 1) * size + x];
                let nx = (hL - hR) * strength;
                let ny = (hDn - hUp) * strength;
                const nz = 1;
                const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
                const i = (y * size + x) * 4;
                d[i] = (nx / len * 0.5 + 0.5) * 255;
                d[i + 1] = (ny / len * 0.5 + 0.5) * 255;
                d[i + 2] = (nz / len * 0.5 + 0.5) * 255;
                d[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = _maxAniso;
        if ('encoding' in tex) tex.encoding = THREE.LinearEncoding;
        return tex;
    }

    function encodeGray(size, values, srgb) {
        const canvas = makeCanvas(size);
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(size, size);
        const d = img.data;
        for (let i = 0, p = 0; i < values.length; i++, p += 4) {
            const v = Math.max(0, Math.min(255, values[i] * 255)) | 0;
            d[p] = d[p + 1] = d[p + 2] = v;
            d[p + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = _maxAniso;
        if ('encoding' in tex) tex.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
        return tex;
    }

    /**
     * @param {object} spec size / height(u,v) / albedo(u,v,h) -> [r,g,b] / rough(u,v,h) / metal(u,v,h)
     */
    function build(spec) {
        const size = spec.size || 256;
        const count = size * size;
        const height = new Float32Array(count);
        for (let y = 0; y < size; y++) {
            const v = y / size;
            for (let x = 0; x < size; x++) {
                height[y * size + x] = spec.height(x / size, v);
            }
        }

        const canvas = makeCanvas(size);
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(size, size);
        const data = img.data;
        const rough = new Float32Array(count);
        const metal = new Float32Array(count);
        const hasMetal = typeof spec.metal === 'function';

        for (let y = 0; y < size; y++) {
            const v = y / size;
            for (let x = 0; x < size; x++) {
                const i = y * size + x;
                const u = x / size;
                const h = height[i];
                const c = spec.albedo(u, v, h);
                const p = i * 4;
                data[p] = Math.max(0, Math.min(255, c[0]));
                data[p + 1] = Math.max(0, Math.min(255, c[1]));
                data[p + 2] = Math.max(0, Math.min(255, c[2]));
                data[p + 3] = 255;
                rough[i] = spec.rough ? spec.rough(u, v, h) : 0.8;
                if (hasMetal) metal[i] = spec.metal(u, v, h);
            }
        }
        ctx.putImageData(img, 0, 0);

        const map = new THREE.CanvasTexture(canvas);
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.anisotropy = _maxAniso;
        if ('encoding' in map) map.encoding = THREE.sRGBEncoding;

        const out = {
            map: map,
            normalMap: encodeNormal(size, height, spec.normalStrength || 2.0),
            roughnessMap: encodeGray(size, rough, false),
        };
        if (hasMetal) out.metalnessMap = encodeGray(size, metal, false);
        out.size = size;
        return out;
    }

    // ========== 材质规格 ==========

    // 通用：面板分缝距离（0 = 位于缝上）
    function seamDist(u, cells) {
        const f = fract(u * cells);
        return Math.min(f, 1 - f) / cells;
    }

    const SPECS = {

        // ---- 混凝土：大面板 + 麻点 + 水渍 ----
        concrete: {
            size: 256, normalStrength: 2.4,
            height: function (u, v) {
                const grain = fbm(u, v, 64, 3, 3) * 0.35;
                const pit = fbm(u, v, 40, 2, 9);
                const seam = Math.min(seamDist(u, 2), seamDist(v, 3));
                let h = 0.55 + grain;
                h -= smoothstep(0.012, 0.0, seam) * 0.42;
                h -= Math.max(0, pit - 0.62) * 0.7;
                return h;
            },
            albedo: function (u, v, h) {
                const stain = fbm(u, v, 3, 4, 21);
                const streak = fbm(u * 0.35, v * 6, 8, 2, 33);
                const pit = fbm(u, v, 40, 2, 9);
                let base = 132 + (h - 0.55) * 120;
                base -= Math.max(0, stain - 0.5) * 70;
                base -= Math.max(0, streak - 0.55) * 46;
                if (pit > 0.7) base -= 22;
                const warm = 1 + (stain - 0.5) * 0.08;
                return [base * warm, base * 0.995, base * 0.955];
            },
            rough: function (u, v, h) {
                const stain = fbm(u, v, 3, 4, 21);
                return clamp01(0.86 - Math.max(0, stain - 0.5) * 0.18);
            }
        },

        // ---- 深色混凝土（围墙/掩体）----
        concreteDark: {
            size: 256, normalStrength: 2.2,
            height: function (u, v) {
                const grain = fbm(u, v, 56, 3, 5) * 0.4;
                const pit = fbm(u, v, 36, 2, 15);
                const seam = Math.min(seamDist(u, 2), seamDist(v, 2));
                let h = 0.5 + grain;
                h -= smoothstep(0.016, 0, seam) * 0.35;
                return h - Math.max(0, pit - 0.66) * 0.5;
            },
            albedo: function (u, v, h) {
                const stain = fbm(u, v, 4, 4, 41);
                let base = 92 + (h - 0.5) * 110;
                base -= Math.max(0, stain - 0.55) * 46;
                return [base * 0.98, base, base * 0.96];
            },
            rough: function (u, v, h) { return clamp01(0.9 - (h - 0.5) * 0.2); }
        },

        // ---- 沥青：骨料 + 裂缝 + 补丁 ----
        asphalt: {
            size: 256, normalStrength: 1.6,
            height: function (u, v) {
                const agg = vnoise(u * 90, v * 90, 90, 7) * 0.55;
                const grain = fbm(u, v, 26, 3, 11) * 0.35;
                const crack = ridge(u, v, 4, 3, 23);
                let h = 0.5 + agg * 0.4 + grain * 0.3;
                h -= Math.max(0, crack - 0.82) * 2.4;
                return h;
            },
            albedo: function (u, v, h) {
                const patch = fbm(u, v, 2, 3, 51);
                const agg = vnoise(u * 90, v * 90, 90, 7);
                const crack = ridge(u, v, 4, 3, 23);
                let base = 40 + (agg - 0.5) * 34 + (patch - 0.5) * 16;
                if (crack > 0.86) base *= 0.45;
                return [base * 0.98, base, base * 0.95];
            },
            rough: function (u, v) { return 0.9 + (1 - vnoise(u * 90, v * 90, 90, 7)) * 0.08; }
        },

        // ---- 碎石 / 砂砾地 ----
        gravel: {
            size: 256, normalStrength: 2.8,
            height: function (u, v) {
                const pebble = vnoise(u * 46, v * 46, 46, 17);
                const fine = fbm(u, v, 80, 2, 13);
                return 0.42 + pebble * 0.5 + fine * 0.2;
            },
            albedo: function (u, v, h) {
                const pebble = vnoise(u * 46, v * 46, 46, 17);
                const tint = vnoise(u * 12, v * 12, 12, 29);
                const base = 82 + (pebble - 0.5) * 96;
                return [base * (0.94 + tint * 0.12), base * 0.95, base * 0.88];
            },
            rough: function () { return 0.95; }
        },

        // ---- 草地：草簇 + 干土斑 ----
        grass: {
            size: 512, normalStrength: 1.9,
            height: function (u, v) {
                const clump = fbm(u, v, 12, 4, 3);
                const blade = ridge(u, v, 120, 2, 19);
                const dirt = smoothstep(0.46, 0.32, fbm(u, v, 4, 3, 61));
                return 0.5 + clump * 0.34 + blade * 0.16 - dirt * 0.22;
            },
            albedo: function (u, v, h) {
                const clump = fbm(u, v, 12, 4, 3);
                const dry = fbm(u, v, 3, 3, 71);
                const blade = ridge(u, v, 120, 2, 19);
                const dirtMask = smoothstep(0.46, 0.34, fbm(u, v, 4, 3, 61));
                // 深绿 → 橄榄 → 土黄，控制土斑比例避免像迷彩
                let r = mix(44, 88, dry) + blade * 26;
                let g = mix(70, 102, dry) + blade * 30;
                let b = mix(34, 50, dry) + blade * 12;
                const t = dirtMask * 0.72;
                r = mix(r, 106, t); g = mix(g, 92, t); b = mix(b, 60, t);
                const shade = 0.86 + clump * 0.28;
                return [r * shade, g * shade, b * shade];
            },
            rough: function () { return 0.96; }
        },

        // ---- 泥土 / 泥地 ----
        dirt: {
            size: 256, normalStrength: 1.8,
            height: function (u, v) {
                const clod = fbm(u, v, 20, 4, 7);
                const stone = vnoise(u * 54, v * 54, 54, 31);
                return 0.5 + clod * 0.3 + Math.max(0, stone - 0.75) * 0.7;
            },
            albedo: function (u, v, h) {
                const clod = fbm(u, v, 20, 4, 7);
                const damp = fbm(u, v, 3, 3, 43);
                let base = 96 + clod * 40;
                if (damp > 0.58) base *= 0.78;
                return [base * 1.02, base * 0.88, base * 0.68];
            },
            rough: function () { return 0.94; }
        },

        // ---- 涂装金属：划痕 + 锈斑（带金属度贴图）----
        metal: {
            size: 256, normalStrength: 1.2,
            height: function (u, v) {
                const dent = fbm(u, v, 18, 3, 5) * 0.18;
                const scratch = ridge(u, v * 0.12, 60, 2, 37);
                return 0.55 + dent - Math.max(0, scratch - 0.88) * 0.5;
            },
            albedo: function (u, v, h) {
                const rust = smoothstep(0.56, 0.78, fbm(u, v, 6, 4, 27));
                const scratch = ridge(u, v * 0.12, 60, 2, 37);
                let r = 138, g = 140, b = 136;
                r = mix(r, 112, rust); g = mix(g, 58, rust); b = mix(b, 32, rust);
                if (scratch > 0.9) { r = 180; g = 182; b = 180; }
                const tone = 0.9 + fbm(u, v, 3, 2, 9) * 0.2;
                return [r * tone, g * tone, b * tone];
            },
            rough: function (u, v) {
                const rust = smoothstep(0.56, 0.78, fbm(u, v, 6, 4, 27));
                return clamp01(0.42 + rust * 0.45);
            },
            metal: function (u, v) {
                const rust = smoothstep(0.56, 0.78, fbm(u, v, 6, 4, 27));
                const scratch = ridge(u, v * 0.12, 60, 2, 37);
                return clamp01(0.55 - rust * 0.45 + Math.max(0, scratch - 0.9) * 2.5);
            }
        },

        // ---- 瓦楞集装箱板：竖向棱 + 锈迹 ----
        corrugated: {
            size: 256, normalStrength: 3.2,
            height: function (u, v) {
                const rib = Math.sin(u * Math.PI * 2 * 10) * 0.5 + 0.5;
                const dent = fbm(u, v, 12, 3, 61) * 0.12;
                const rust = smoothstep(0.62, 0.86, fbm(u, v, 5, 3, 71));
                return 0.4 + rib * 0.28 + dent - rust * 0.05;
            },
            albedo: function (u, v, h) {
                const rib = Math.sin(u * Math.PI * 2 * 10) * 0.5 + 0.5;
                const rust = smoothstep(0.62, 0.86, fbm(u, v, 5, 3, 71));
                const streak = smoothstep(0.66, 0.9, fbm(u * 0.6, v * 0.12, 9, 2, 83));
                let base = 196 - (1 - rib) * 26;
                let r = base, g = base, b = base;
                const rustAmt = Math.max(rust, streak * 0.7);
                r = mix(r, 122, rustAmt); g = mix(g, 64, rustAmt); b = mix(b, 38, rustAmt);
                return [r, g, b];
            },
            rough: function (u, v) {
                const rust = smoothstep(0.62, 0.86, fbm(u, v, 5, 3, 71));
                return clamp01(0.55 + rust * 0.4);
            },
            metal: function (u, v) {
                const rust = smoothstep(0.62, 0.86, fbm(u, v, 5, 3, 71));
                return clamp01(0.55 - rust * 0.5);
            }
        },

        // ---- 木板：拼板 + 木纹 + 结疤 ----
        wood: {
            size: 256, normalStrength: 2.0,
            height: function (u, v) {
                const plank = fract(v * 6);
                const gap = smoothstep(0.06, 0.0, Math.min(plank, 1 - plank));
                const grain = fbm(u * 0.25, v * 14, 20, 3, 5);
                const knot = smoothstep(0.78, 0.95, fbm(u, v, 8, 2, 45));
                return 0.55 + grain * 0.12 - gap * 0.35 - knot * 0.08;
            },
            albedo: function (u, v, h) {
                const plank = Math.floor(v * 6);
                const tone = hash2(plank, 3, 17);
                const grain = fbm(u * 0.25, v * 14, 20, 3, 5);
                const gap = smoothstep(0.05, 0.0, Math.min(fract(v * 6), 1 - fract(v * 6)));
                let r = 118 + tone * 34 + grain * 34;
                let g = 86 + tone * 24 + grain * 26;
                let b = 56 + tone * 16 + grain * 18;
                r *= 1 - gap * 0.65; g *= 1 - gap * 0.65; b *= 1 - gap * 0.65;
                return [r, g, b];
            },
            rough: function () { return 0.88; }
        },

        // ---- 沙袋：麻布编织 + 袋体起伏 ----
        sandbag: {
            size: 256, normalStrength: 2.6,
            height: function (u, v) {
                const row = Math.floor(v * 5);
                const offset = (row % 2) * 0.5;
                const bx = fract(u * 3 + offset);
                const by = fract(v * 5);
                const dome = Math.sin(bx * Math.PI) * Math.sin(by * Math.PI);
                const weave = (Math.sin(u * 420) * Math.sin(v * 420)) * 0.06;
                const seam = smoothstep(0.04, 0.0, Math.min(bx, 1 - bx));
                return 0.42 + dome * 0.34 + weave - seam * 0.2;
            },
            albedo: function (u, v, h) {
                const weave = (Math.sin(u * 420) * Math.sin(v * 420)) * 10;
                const dirt = fbm(u, v, 9, 3, 91);
                let base = 150 + weave + (dirt - 0.5) * 44;
                return [base * 1.0, base * 0.9, base * 0.68];
            },
            rough: function () { return 0.97; }
        },

        // ---- 屋顶：沥青卷材 + 碎石 ----
        roof: {
            size: 256, normalStrength: 1.8,
            height: function (u, v) {
                const grit = vnoise(u * 70, v * 70, 70, 5);
                const seam = seamDist(v, 3);
                return 0.5 + grit * 0.3 - smoothstep(0.01, 0, seam) * 0.2;
            },
            albedo: function (u, v, h) {
                const grit = vnoise(u * 70, v * 70, 70, 5);
                const base = 58 + grit * 44;
                return [base, base * 0.99, base * 0.96];
            },
            rough: function () { return 0.93; }
        },

        // ---- 砖墙：错缝砌筑 ----
        brick: {
            size: 256, normalStrength: 2.6,
            height: function (u, v) {
                const row = Math.floor(v * 10);
                const offset = (row % 2) * 0.5;
                const bx = fract(u * 4 + offset);
                const by = fract(v * 10);
                const mortar = smoothstep(0.05, 0.015, Math.min(bx, 1 - bx)) +
                    smoothstep(0.14, 0.06, Math.min(by, 1 - by));
                const rough = fbm(u, v, 40, 2, 7) * 0.1;
                return 0.55 + rough - Math.min(1.2, mortar) * 0.28;
            },
            albedo: function (u, v, h) {
                const row = Math.floor(v * 10);
                const offset = (row % 2) * 0.5;
                const bx = fract(u * 4 + offset);
                const by = fract(v * 10);
                const mortar = Math.min(1, smoothstep(0.05, 0.015, Math.min(bx, 1 - bx)) +
                    smoothstep(0.14, 0.06, Math.min(by, 1 - by)));
                const tone = hash2(Math.floor(u * 4 + offset), row, 13);
                const grime = fbm(u, v, 7, 3, 19);
                let r = mix(126, 158, tone) - grime * 30;
                let g = mix(62, 82, tone) - grime * 18;
                let b = mix(48, 62, tone) - grime * 12;
                r = mix(r, 158, mortar); g = mix(g, 152, mortar); b = mix(b, 144, mortar);
                return [r, g, b];
            },
            rough: function () { return 0.92; }
        },
    };

    // ========== 对外接口 ==========

    function init(renderer) {
        _renderer = renderer || null;
        if (_renderer) {
            try { _maxAniso = Math.min(8, _renderer.capabilities.getMaxAnisotropy()); } catch (e) { _maxAniso = 4; }
        }
    }

    function get(kind) {
        if (_sets[kind]) return _sets[kind];
        const spec = SPECS[kind];
        if (!spec) return null;
        const t0 = performance.now();
        const set = build(spec);
        _sets[kind] = set;
        if (typeof console !== 'undefined' && console.debug) {
            console.debug('[PBRTextures] ' + kind + ' 生成完成 ' + (performance.now() - t0).toFixed(0) + 'ms');
        }
        return set;
    }

    function ready(kind) { return !!_sets[kind]; }

    /** 预生成：分帧执行，避免一次性卡住开局 */
    function warmup(kinds) {
        const list = (kinds || ['concrete', 'asphalt', 'grass', 'corrugated', 'metal', 'wood']).filter(function (k) { return !_sets[k]; });
        let i = 0;
        function step() {
            if (i >= list.length) return;
            get(list[i++]);
            setTimeout(step, 0);
        }
        setTimeout(step, 0);
    }

    /** 按尺寸缩放几何体 UV（仅首次），使纹理按世界米数平铺 */
    function scaleUVs(meshOrGeo, tileU, tileV, geoKind) {
        // 允许传入网格或几何体：早期调用传的是 geometry，曾导致平面 UV 缩放被静默跳过
        const geo = meshOrGeo && meshOrGeo.geometry ? meshOrGeo.geometry : meshOrGeo;
        if (!geo || !geo.attributes || !geo.attributes.uv) return;
        if (geo.userData._pbrUV) return;
        const uv = geo.attributes.uv;
        const su = Math.max(0.05, tileU);
        const sv = Math.max(0.05, tileV == null ? tileU : tileV);
        for (let i = 0; i < uv.count; i++) {
            uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
        }
        uv.needsUpdate = true;
        geo.userData._pbrUV = true;
        geo.userData._pbrGeoKind = geoKind || '';
    }

    /**
     * 盒体逐面世界坐标 UV：
     * 按每个顶点的法线选择投影平面，再用世界坐标 / 平铺尺寸，
     * 彻底避免「宽路面用最长边缩放」导致的条纹拉伸。
     */
    function scaleBoxUVs(geo, tileU, tileV) {
        if (!geo || geo.userData._pbrUV) return;
        const pos = geo.attributes.position;
        const nor = geo.attributes.normal;
        const uv = geo.attributes.uv;
        if (!pos || !nor || !uv) return;
        const tu = Math.max(0.05, tileU);
        const tv = Math.max(0.05, tileV == null ? tileU : tileV);
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
            const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
            let u, v;
            if (ax >= ay && ax >= az) { u = z / tu; v = y / tv; }
            else if (ay >= az) { u = x / tu; v = z / tv; }
            else { u = x / tu; v = y / tv; }
            uv.setXY(i, u, v);
        }
        uv.needsUpdate = true;
        geo.userData._pbrUV = true;
    }

    /**
     * 给网格套用 PBR 材质。
     * @param {THREE.Mesh} mesh
     * @param {string} kind
     * @param {object} opt { tileU, tileV, normalScale, color, metalness, roughness, envMapIntensity }
     */
    function applyToMesh(mesh, kind, opt) {
        if (!mesh || !mesh.material) return false;
        const set = get(kind);
        if (!set) return false;
        opt = opt || {};
        let mat = mesh.material;
        if (Array.isArray(mat)) return false;
        if (!mat.isMeshStandardMaterial) return false;

        // 同一材质可能被多个网格共享，克隆一次后再改贴图
        if (!mat.userData._pbrOwned) {
            mat = mat.clone();
            mat.userData = Object.assign({}, mat.userData, { _pbrOwned: true });
            mesh.material = mat;
        }

        const geo = mesh.geometry;
        const params = (geo && geo.parameters) || {};
        const tileU = opt.tileU || opt.tile || 2.0;
        const tileV = opt.tileV || opt.tile || 2.0;
        if (geo && geo.type === 'BoxGeometry') {
            // 盒体逐面世界 UV，宽路面/薄墙都不会被拉伸
            scaleBoxUVs(geo, tileU, tileV);
        } else {
            let w = 1, h = 1;
            if (geo && geo.type === 'PlaneGeometry') {
                w = params.width || 1; h = params.height || 1;
            } else if (geo && (geo.type === 'CylinderGeometry' || geo.type === 'ConeGeometry')) {
                w = 2 * Math.PI * (params.radiusTop || 1);
                h = params.height || 1;
            }
            scaleUVs(geo, w / tileU, h / tileV, kind);
        }

        mat.map = set.map;
        mat.normalMap = set.normalMap;
        if (set.normalScale !== undefined) mat.normalScale.copy(set.normalScale);
        else mat.normalScale.set(opt.normalScale == null ? 0.85 : opt.normalScale, opt.normalScale == null ? 0.85 : opt.normalScale);
        mat.roughnessMap = set.roughnessMap;
        if (set.metalnessMap) mat.metalnessMap = set.metalnessMap;
        mat.roughness = opt.roughness == null ? 1.0 : opt.roughness;
        mat.metalness = opt.metalness == null ? (set.metalnessMap ? 1.0 : 0.0) : opt.metalness;
        mat.envMapIntensity = opt.envMapIntensity == null ? 0.28 : opt.envMapIntensity;
        if (opt.color != null) mat.color.set(opt.color);
        mat.needsUpdate = true;
        return true;
    }

    return {
        init: init,
        get: get,
        ready: ready,
        warmup: warmup,
        applyToMesh: applyToMesh,
        kinds: Object.keys(SPECS),
    };
})();
