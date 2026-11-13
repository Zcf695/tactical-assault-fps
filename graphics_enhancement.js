/**
 * graphics_enhancement.js
 * 美术增强模块 —— 为战术突击FPS游戏添加精致视觉效果
 * 
 * 包含：
 * 1. 程序化Canvas纹理（地面/墙壁/道路/混凝土）
 * 2. 渐变天空球
 * 3. 动态水面（波纹动画）
 * 4. 后期处理链（Bloom泛光 + FXAA抗锯齿 + 颜色校正 + 暗角）
 * 5. 光照与阴影升级
 * 
 * 用法：在game.js之后加载，调用 GraphicsEnhancement.init(renderer, scene, camera)
 *       渲染循环中用 GraphicsEnhancement.render() 替代 renderer.render()
 */

const GraphicsEnhancement = (function () {
    let _renderer = null;
    let _scene = null;
    let _camera = null;
    let _composer = null;
    let _bloomPass = null;
    let _fxaaPass = null;
    let _colorPass = null;
    let _vignettePass = null;
    let _waterMeshes = [];
    let _skyMesh = null;
    let _waterEnabled = true;
    let _enabled = false; // 默认关闭，init成功后才启用，避免未初始化时render崩溃
    let _clock = null;
    let _maxAnisotropy = 8;

    /**
     * 颜色贴图统一按 sRGB 解码。
     * 渲染管线启用了 sRGB 输出，若贴图仍按线性采样，整体会发灰、发白。
     */
    function finalizeColorTexture(tex, repeatX, repeatY) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        if (repeatX != null) tex.repeat.set(repeatX, repeatY == null ? repeatX : repeatY);
        tex.anisotropy = _maxAnisotropy;
        if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
        tex.needsUpdate = true;
        return tex;
    }

    // ========== 程序化纹理生成 ==========

    /**
     * 生成带噪点的纹理（用于地面、墙壁等）
     */
    function makeNoiseTexture(baseColor, noiseAmount, size, repeatX, repeatY) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size || 256;
        const ctx = canvas.getContext('2d');

        // 基色填充
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, size, size);

        // 添加噪点
        const imgData = ctx.getImageData(0, 0, size, size);
        const data = imgData.data;
        const amount = noiseAmount || 20;
        for (let i = 0; i < data.length; i += 4) {
            const n = (Math.random() - 0.5) * amount;
            data[i] = Math.max(0, Math.min(255, data[i] + n));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
        }
        ctx.putImageData(imgData, 0, 0);

        const tex = new THREE.CanvasTexture(canvas);
        return finalizeColorTexture(tex, repeatX || 1, repeatY || 1);
    }

    /**
     * 生成混凝土墙壁纹理（带污渍和裂纹）
     */
    function makeConcreteTexture(baseColor, size) {
        size = size || 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, size, size);

        // 细噪点
        let imgData = ctx.getImageData(0, 0, size, size);
        let data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const n = (Math.random() - 0.5) * 30;
            data[i] = Math.max(0, Math.min(255, data[i] + n));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
        }
        ctx.putImageData(imgData, 0, 0);

        // 大块污渍
        for (let i = 0; i < 15; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = 20 + Math.random() * 60;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            const dark = Math.random() > 0.5;
            grad.addColorStop(0, dark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }

        // 细微裂纹
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            let x = Math.random() * size;
            let y = Math.random() * size;
            ctx.moveTo(x, y);
            for (let j = 0; j < 5; j++) {
                x += (Math.random() - 0.5) * 40;
                y += (Math.random() - 0.5) * 40;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(canvas);
        return finalizeColorTexture(tex);
    }

    /**
     * 生成草地纹理
     */
    function makeGrassTexture(size) {
        size = size || 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');

        // 基色
        ctx.fillStyle = '#46543f';
        ctx.fillRect(0, 0, size, size);

        // 大尺度色块：先铺低频变化，避免整片草地像噪点电视
        for (let i = 0; i < 26; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = size * (0.06 + Math.random() * 0.14);
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            const light = Math.random() > 0.5;
            g.addColorStop(0, light ? 'rgba(96,112,74,0.30)' : 'rgba(52,64,44,0.32)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }

        // 草叶噪点（降低对比，保持颗粒但不刺眼）
        const imgData = ctx.getImageData(0, 0, size, size);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const n = (Math.random() - 0.5) * 16;
            data[i] = Math.max(0, Math.min(255, data[i] + n * 0.5));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 0.3));
        }
        ctx.putImageData(imgData, 0, 0);

        // 随机草叶
        for (let i = 0; i < 420; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const h = 3 + Math.random() * 7;
            ctx.strokeStyle = `rgba(${40 + Math.random() * 30},${80 + Math.random() * 40},${40 + Math.random() * 20},0.28)`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (Math.random() - 0.5) * 2, y - h);
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(canvas);
        return finalizeColorTexture(tex, 20, 20);
    }

    /**
     * 预制板围墙纹理：竖向分缝 + 横向压痕，远看是成排墙板而不是一整块噪点
     */
    function makePanelTexture(size) {
        size = size || 256;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#8b887d';
        ctx.fillRect(0, 0, size, size);

        // 细颗粒
        const imgData = ctx.getImageData(0, 0, size, size);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const n = (Math.random() - 0.5) * 14;
            data[i] = Math.max(0, Math.min(255, data[i] + n));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
        }
        ctx.putImageData(imgData, 0, 0);

        // 竖向分缝（每 1/4 一块板）
        ctx.strokeStyle = 'rgba(38,38,34,0.55)';
        ctx.lineWidth = 2;
        for (let i = 0; i <= 4; i++) {
            const x = (size / 4) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, size);
            ctx.stroke();
        }
        // 横向压顶/勒脚
        ctx.strokeStyle = 'rgba(48,48,42,0.35)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, size * 0.12); ctx.lineTo(size, size * 0.12);
        ctx.moveTo(0, size * 0.88); ctx.lineTo(size, size * 0.88);
        ctx.stroke();

        const tex = new THREE.CanvasTexture(canvas);
        return finalizeColorTexture(tex);
    }

    /**
     * 生成沥青道路纹理
     */    function makeAsphaltTexture(size) {
        size = size || 256;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#45453f';
        ctx.fillRect(0, 0, size, size);

        // 颗粒噪点
        const imgData = ctx.getImageData(0, 0, size, size);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const n = (Math.random() - 0.5) * 20;
            data[i] = Math.max(0, Math.min(255, data[i] + n));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
        }
        ctx.putImageData(imgData, 0, 0);

        const tex = new THREE.CanvasTexture(canvas);
        return finalizeColorTexture(tex, 8, 8);
    }

    // 区域提示圆盘的软边遮罩：把硬边圆形换成径向渐隐，避免场景里出现"绿色飞碟"
    let _zoneAlphaTex = null;
    function getZoneAlphaTexture() {
        if (_zoneAlphaTex) return _zoneAlphaTex;
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, size, size);
        const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.55, '#bbb');
        g.addColorStop(1, '#000');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        _zoneAlphaTex = new THREE.CanvasTexture(canvas);
        _zoneAlphaTex.minFilter = THREE.LinearFilter;
        _zoneAlphaTex.magFilter = THREE.LinearFilter;
        return _zoneAlphaTex;
    }

    // 预生成纹理缓存
    let _textures = null;
    function getTextures() {        if (!_textures) {
            _textures = {
                grass: makeGrassTexture(),
                asphalt: makeAsphaltTexture(),
                concrete: makeConcreteTexture('#5a5a5a'),
                concreteDark: makeConcreteTexture('#3d3d3d'),
                panel: makePanelTexture(256),
                dirt: makeNoiseTexture('#5a4a3a', 25, 256, 10, 10),
            };
        }
        return _textures;
    }

    // ========== 渐变天空（用Canvas纹理，更安全） ==========

    function createSkyTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 4;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        // 顶部深蓝
        grad.addColorStop(0, '#1a3a6a');
        grad.addColorStop(0.3, '#3a6aaa');
        grad.addColorStop(0.55, '#6a9ed0');
        // 地平线浅蓝
        grad.addColorStop(0.75, '#a8d0e8');
        grad.addColorStop(0.9, '#c8e0f0');
        // 底部微暖
        grad.addColorStop(1, '#d8d0c0');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 4, 256);
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearFilter;
        return tex;
    }

    let _skyTexture = null;

    // ========== 动态水面 ==========

    function createWater(width, depth) {
        const geo = new THREE.PlaneGeometry(width, depth, 32, 32);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x1a4a6a,
            roughness: 0.1,
            metalness: 0.4,
            transparent: true,
            opacity: 0.85,
            emissive: 0x0a2a3a,
            emissiveIntensity: 0.2,
        });
        const water = new THREE.Mesh(geo, mat);
        water.rotation.x = -Math.PI / 2;
        water.userData.isWater = true;
        water.userData.basePositions = Float32Array.from(geo.attributes.position.array);
        _waterMeshes.push(water);
        return water;
    }

    function updateWater(time) {
        if (!_waterEnabled) return;
        for (const water of _waterMeshes) {
            const geo = water.geometry;
            const pos = geo.attributes.position;
            const base = water.userData.basePositions;
            for (let i = 0; i < pos.count; i++) {
                const x = base[i * 3];
                const y = base[i * 3 + 1];
                const wave = Math.sin(x * 0.3 + time * 1.5) * 0.08 +
                    Math.cos(y * 0.4 + time * 1.2) * 0.06 +
                    Math.sin((x + y) * 0.2 + time * 0.8) * 0.04;
                pos.setZ(i, wave);
            }
            pos.needsUpdate = true;
            geo.computeVertexNormals();
            const nm = water.material && water.material.normalMap;
            if (nm) {
                nm.offset.x = (time * 0.012) % 1;
                nm.offset.y = (time * 0.007) % 1;
            }
        }
    }

    // ========== 后期处理 ==========

    // 颜色校正 shader
    const ColorCorrectionShader = {
        uniforms: {
            tDiffuse: { value: null },
            brightness: { value: 1.05 },
            contrast: { value: 1.12 },
            saturation: { value: 1.15 },
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float brightness;
            uniform float contrast;
            uniform float saturation;
            varying vec2 vUv;
            void main() {
                vec4 color = texture2D(tDiffuse, vUv);
                // 亮度
                color.rgb *= brightness;
                // 对比度
                color.rgb = (color.rgb - 0.5) * contrast + 0.5;
                // 饱和度
                float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                color.rgb = mix(vec3(gray), color.rgb, saturation);
                gl_FragColor = color;
            }
        `,
    };

    // 暗角 shader
    const VignetteShader = {
        uniforms: {
            tDiffuse: { value: null },
            offset: { value: 0.95 },
            darkness: { value: 1.1 },
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float offset;
            uniform float darkness;
            varying vec2 vUv;
            void main() {
                vec4 color = texture2D(tDiffuse, vUv);
                vec2 uv = (vUv - 0.5) * offset;
                float dist = dot(uv, uv);
                color.rgb *= smoothstep(0.8, offset * 0.5, darkness - dist);
                gl_FragColor = color;
            }
        `,
    };

    function initPostProcessing() {
        if (typeof THREE.EffectComposer === 'undefined') {
            console.warn('[GraphicsEnhancement] 后期处理库未加载，跳过后期处理');
            return false;
        }

        try {
            // 显式创建渲染目标，确保格式正确（r128兼容性关键）
            const rtParams = {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                type: THREE.UnsignedByteType,
                stencilBuffer: false
            };
            const renderTarget = new THREE.WebGLRenderTarget(
                window.innerWidth, window.innerHeight, rtParams
            );
            renderTarget.texture.name = 'EffectComposer.rt1';

            _composer = new THREE.EffectComposer(_renderer, renderTarget);
            _composer.setPixelRatio(_renderer.getPixelRatio());
            _composer.setSize(window.innerWidth, window.innerHeight);

            // 1. 基础渲染通道
            const renderPass = new THREE.RenderPass(_scene, _camera);
            renderPass.clear = true;
            renderPass.clearDepth = true;
            _composer.addPass(renderPass);

            // 2. Bloom泛光
            _bloomPass = new THREE.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.6,  // strength - 适度泛光
                0.5,  // radius
                0.75  // threshold - 只让亮部发光
            );
            _composer.addPass(_bloomPass);

            // 3. FXAA抗锯齿
            _fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
            const pr = _renderer.getPixelRatio();
            _fxaaPass.material.uniforms['resolution'].value.set(
                1 / (window.innerWidth * pr),
                1 / (window.innerHeight * pr)
            );
            _composer.addPass(_fxaaPass);

            // 4. 暗角（最后一个pass，渲染到屏幕）
            _vignettePass = new THREE.ShaderPass(VignetteShader);
            _vignettePass.renderToScreen = true;
            _composer.addPass(_vignettePass);

            console.log('[GraphicsEnhancement] 后期处理初始化成功');
            return true;
        } catch (e) {
            console.error('[GraphicsEnhancement] 后期处理初始化失败:', e);
            _composer = null;
            return false;
        }
    }

    // ========== 光照升级 ==========

    function upgradeLights() {
        // 遍历场景中的光源，升级参数
        _scene.traverse(obj => {
            if (obj.isDirectionalLight) {
                obj.intensity = 0.9;
                obj.shadow.mapSize.set(2048, 2048);
                obj.shadow.camera.left = -80;
                obj.shadow.camera.right = 80;
                obj.shadow.camera.top = 80;
                obj.shadow.camera.bottom = -80;
                obj.shadow.camera.near = 0.5;
                obj.shadow.camera.far = 200;
                obj.shadow.bias = -0.0005;
                obj.shadow.normalBias = 0.02;
            }
            if (obj.isAmbientLight) {
                obj.intensity = 0.4;
            }
            if (obj.isHemisphereLight) {
                obj.intensity = 0.4;
            }
        });
    }

    // ========== 水面法线 ==========
    let _waterNormalTex = null;
    function getWaterNormalTexture() {
        if (_waterNormalTex) return _waterNormalTex;
        const size = 256;
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        const img = ctx.createImageData(size, size);
        const d = img.data;
        const height = new Float32Array(size * size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
                height[y * size + x] =
                    Math.sin(u * 3 + Math.sin(v * 2) * 0.6) * 0.5 +
                    Math.sin(v * 5 + u * 1.4) * 0.35 +
                    Math.sin((u + v) * 2.2) * 0.25 +
                    Math.sin(u * 9 + v * 7) * 0.12;
            }
        }
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = y * size + x;
                const xm = (x - 1 + size) % size, xp = (x + 1) % size;
                const ym = (y - 1 + size) % size, yp = (y + 1) % size;
                let nx = (height[y * size + xm] - height[y * size + xp]) * 1.6;
                let ny = (height[ym * size + x] - height[yp * size + x]) * 1.6;
                const nz = 1;
                const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
                const p = i * 4;
                d[p] = (nx / len * 0.5 + 0.5) * 255;
                d[p + 1] = (ny / len * 0.5 + 0.5) * 255;
                d[p + 2] = (nz / len * 0.5 + 0.5) * 255;
                d[p + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = _maxAnisotropy;
        if ('encoding' in tex) tex.encoding = THREE.LinearEncoding;
        _waterNormalTex = tex;
        return tex;
    }

    // ========== 材质升级辅助 ==========

    /**
     * 优先使用程序化 PBR 材质（法线/粗糙度/金属度）。
     * 不可用时返回 false，调用方回落到单张颜色贴图。
     */
    function applyPBR(obj, kind, opt) {
        if (typeof PBRTextures === 'undefined') return false;
        return PBRTextures.applyToMesh(obj, kind, opt);
    }

    /**
     * 给现有mesh的材质添加颜色贴图。
     * repeat 按世界尺寸计算，避免大墙面出现被拉伸的纹理。
     */
    function applyTextureToMesh(mesh, texture, repeatX, repeatY) {
        if (!mesh || !mesh.material) return;
        // 共享材质（道路/围墙）各自克隆一份，否则最后一个网格的 repeat 会覆盖全部
        let mat = mesh.material;
        if (!mat.userData._ownSurfaceMat) {
            mat = mat.clone();
            mat.userData = Object.assign({}, mesh.material.userData, { _ownSurfaceMat: true });
            mesh.material = mat;
        }
        const tex = texture.clone();
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(Math.max(0.5, repeatX || 1), Math.max(0.5, repeatY == null ? repeatX || 1 : repeatY));
        tex.anisotropy = _maxAnisotropy;
        if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
        tex.needsUpdate = true;

        // 只回收本函数创建过的贴图，避免误删共享源贴图
        if (mat.map && mat.userData._ownTexture) mat.map.dispose();
        mat.map = tex;
        mat.userData._ownTexture = true;
        mat.needsUpdate = true;
    }

    /**
     * 地面双尺度采样：用同一张草地贴图再以大 5 倍的尺度混合一次，
     * 打断 0.5m 级别的重复节奏，近看仍保留细节。
     */
    function applyGroundMacroVariation(material) {
        if (!material || material.userData._groundMacro) return;
        material.userData._groundMacro = true;
        material.onBeforeCompile = function (shader) {
            shader.uniforms.uMacroScale = { value: 0.19 };
            shader.fragmentShader = 'uniform float uMacroScale;\n' + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                [
                    '#ifdef USE_MAP',
                    '  vec4 texelColor = texture2D( map, vUv );',
                    '  texelColor = mapTexelToLinear( texelColor );',
                    '  vec4 macroColor = texture2D( map, vUv * uMacroScale + vec2( 0.37, 0.21 ) );',
                    '  macroColor = mapTexelToLinear( macroColor );',
                    '  float macroLum = dot( macroColor.rgb, vec3( 0.299, 0.587, 0.114 ) );',
                    '  diffuseColor.rgb *= texelColor.rgb * ( 0.94 + 0.18 * macroLum );',
                    '#endif'
                ].join('\n')
            );
        };
        material.customProgramCacheKey = function () { return 'ground-macro-v1'; };
        material.needsUpdate = true;
    }

    /**
     * 升级整个地图环境的材质。
     * 优先读取 createEnvironment 打好的 userData.surface 标签；
     * 老地图没有标签时退回几何/颜色启发式判断。
     */
    function upgradeEnvironmentMaterials() {
        const tex = getTextures();
        if (!_scene) return;
        const mapSize = (typeof CONFIG !== 'undefined' && CONFIG.mapSize) || 300;

        // 换图后旧水面已随环境组移除，清理引用，避免继续更新已释放的几何体
        _waterMeshes = _waterMeshes.filter(function (w) {
            return w && w.parent && w.parent.parent === _scene;
        });

        _scene.traverse(obj => {
            if (!obj.isMesh || !obj.material) return;
            const mat = obj.material;
            if (Array.isArray(mat)) return;
            if (!mat.color) return;

            const surface = obj.userData && obj.userData.surface;
            const params = (obj.geometry && obj.geometry.parameters) || {};

            // ---- 区域提示圆盘：软边 + 低不透明度 ----
            if (surface === 'zonePatch') {
                if (!obj.userData.zoneSoftened) {
                    mat.alphaMap = getZoneAlphaTexture();
                    mat.transparent = true;
                    mat.opacity = 0.22;
                    mat.depthWrite = false;
                    mat.needsUpdate = true;
                    obj.renderOrder = 1;
                    obj.userData.zoneSoftened = true;
                }
                return;
            }

            // ---- 水面：低面数动态波纹 + 环境反射 ----
            if (surface === 'water' || (obj.userData && obj.userData.isWater)) {
                if (!obj.userData.enhanced) {
                    const w = params.width || 10;
                    const d = params.height || 10;
                    obj.geometry.dispose();
                    obj.geometry = new THREE.PlaneGeometry(w, d, 24, 24);
                    obj.userData.basePositions = Float32Array.from(obj.geometry.attributes.position.array);
                    obj.userData.enhanced = true;
                    _waterMeshes.push(obj);
                }
                if (mat.roughness !== undefined && !mat.userData._waterLook) {
                    const w = params.width || 10, d = params.height || 10;
                    mat.color.convertSRGBToLinear();
                    mat.roughness = 0.12;
                    mat.metalness = 0.22;
                    mat.envMapIntensity = 0.95;
                    mat.transparent = true;
                    mat.opacity = 0.93;
                    const nt = getWaterNormalTexture().clone();
                    nt.wrapS = nt.wrapT = THREE.RepeatWrapping;
                    nt.repeat.set(Math.max(4, w / 1.6), Math.max(4, d / 1.6));
                    nt.offset.set(Math.random(), Math.random());
                    nt.needsUpdate = true;
                    mat.normalMap = nt;
                    mat.normalScale.set(0.24, 0.24);
                    mat.userData._waterLook = true;
                    mat.needsUpdate = true;
                }
                return;
            }

            // ---- 地面：草地/泥土 + 双尺度混合 ----
            const isGround = surface === 'ground' ||
                (obj.geometry && obj.geometry.type === 'PlaneGeometry' &&
                    Math.abs(obj.position.y) < 0.1 && Math.abs(obj.rotation.x) > 0.1 && obj.scale.x > 20);
            if (isGround) {
                if (!obj.userData.textureUpgraded) {
                    const groundKind = (typeof MAP_DATA !== 'undefined' && MAP_DATA && MAP_DATA.theme &&
                        MAP_DATA.theme.groundSurface) || 'grass';
                    // tile 是「一张贴图铺几米」，所以必须跟着贴图边长走：
                    // 草地 512² → 5.5m/张（1.07 cm/texel），砾石/沥青 256² → 2.75m/张（同样 1.07 cm/texel）。
                    // 写死 5.5 的后果不是「稍微糙一点」，而是 256² 那两张密度直接翻倍，
                    // 砾石颗粒被放大成拳头大、沥青失去细砂质感。
                    const _texSize = (typeof PBRTextures !== 'undefined' && PBRTextures.sizeOf)
                        ? (PBRTextures.sizeOf(groundKind) || 256) : 256;
                    const _groundTile = 2.75 * (_texSize / 256);
                    const okPBR = applyPBR(obj, groundKind, {
                        tile: _groundTile, normalScale: 1.1, color: 0xffffff,
                        roughness: 1.0, metalness: 0.0, envMapIntensity: 0.18,
                    });
                    if (!okPBR) {
                        // 回退也要跟随地图地面种类，否则三张图在降级路径下都变成草地
                        const fallbackTex = tex[groundKind] || tex.grass;
                        applyTextureToMesh(obj, fallbackTex, mapSize / 11, mapSize / 11);
                    }
                    // 贴图本身已是地表反照率，材质色若继续相乘会把地面压成墨绿
                    mat.color.setHex(0xffffff);
                    if (mat.roughness !== undefined) mat.roughness = 1.0;
                    mat.envMapIntensity = 0.18;
                    applyGroundMacroVariation(mat);
                    obj.userData.textureUpgraded = true;
                }
                return;
            }

            // ---- 道路：沥青，按长宽铺 ----
            const isRoad = surface === 'road' ||
                (obj.geometry && obj.geometry.type === 'BoxGeometry' && obj.position.y < 0.1 &&
                    mat.color.r < 0.4 && mat.color.g < 0.4 && mat.color.b < 0.38);
            if (isRoad) {
                if (!obj.userData.textureUpgraded) {
                    const okPBR = applyPBR(obj, 'asphalt', {
                        tile: 3.2, normalScale: 0.8, color: 0xffffff,
                        roughness: 1.0, metalness: 0.0, envMapIntensity: 0.25,
                    });
                    if (!okPBR) {
                        const w = params.width || 1, d = params.depth || 1;
                        applyTextureToMesh(obj, tex.asphalt, Math.max(1, w / 4), Math.max(1, d / 4));
                    }
                    // 沥青贴图偏暗，材质色提到浅灰，避免与草地阴影糊成一块黑斑
                    mat.color.setHex(0xffffff);
                    if (mat.roughness !== undefined) mat.roughness = 1.0;
                    mat.envMapIntensity = 0.25;
                    obj.userData.textureUpgraded = true;
                }
                return;
            }

            // ---- 边界围墙：预制板分缝，避免整面墙退化成黑色幕布 ----
            if (surface === 'boundary') {
                if (!obj.userData.textureUpgraded) {
                    const okPBR = applyPBR(obj, 'concrete', {
                        tile: 3.0, normalScale: 1.0, color: 0xffffff,
                        roughness: 1.0, metalness: 0.0, envMapIntensity: 0.2,
                    });
                    if (!okPBR) {
                        const w = params.width || mapSize;
                        const h = params.height || 6;
                        applyTextureToMesh(obj, tex.panel, Math.max(1, w / 6), Math.max(1, h / 6));
                    }
                    mat.color.setHex(0xffffff);
                    if (mat.roughness !== undefined) mat.roughness = 1.0;
                    mat.envMapIntensity = 0.35;
                    obj.userData.textureUpgraded = true;
                }
                return;
            }

            // ---- 建筑：混凝土，按立面高度铺 ----
            if (surface === 'building' || surface === 'wall') {
                if (!obj.userData.textureUpgraded) {
                    const okPBR = applyPBR(obj, surface === 'wall' ? 'concreteDark' : 'concrete', {
                        tile: 4.0, normalScale: 1.0, roughness: 1.0, metalness: 0.0,
                        envMapIntensity: 0.4,
                    });
                    if (!okPBR) {
                        const h = params.height || 3;
                        const w = params.width || 3;
                        applyTextureToMesh(obj, tex.concrete, Math.max(1, w / 3.2), Math.max(1, h / 3.2));
                    }
                    // 保留建筑原色的色相，但把亮度提回贴图反照率水平
                    mat.color.lerp(new THREE.Color(0xffffff), surface === 'wall' ? 0.35 : 0.30);
                    if (mat.roughness !== undefined) mat.roughness = 1.0;
                    mat.envMapIntensity = 0.22;
                    obj.userData.textureUpgraded = true;
                }
                return;
            }

            // ---- 集装箱：瓦楞板 + 锈迹，保留箱体色相 ----
            if (surface === 'container') {
                if (!obj.userData.textureUpgraded) {
                    const okPBR = applyPBR(obj, 'corrugated', {
                        tileU: 2.4, tileV: 2.4, normalScale: 1.1,
                        roughness: 1.0, metalness: 1.0, envMapIntensity: 0.35,
                    });
                    if (!okPBR) {
                        applyTextureToMesh(obj, tex.concreteDark, 2, 2);
                    }
                    mat.color.lerp(new THREE.Color(0xffffff), 0.35);
                    obj.userData.textureUpgraded = true;
                }
                return;
            }

            // ---- 岸边泥地 ----
            if (surface === 'bank') {
                if (!obj.userData.textureUpgraded) {
                    applyPBR(obj, 'gravel', {
                        tile: 3.2, normalScale: 0.8, color: 0xbfb6a4,
                        roughness: 1.0, metalness: 0.0, envMapIntensity: 0.25,
                    });
                    obj.userData.textureUpgraded = true;
                }
                return;
            }

            // ---- 屋顶：沥青卷材 ----
            if (surface === 'roof') {
                if (!obj.userData.textureUpgraded) {
                    applyPBR(obj, 'roof', {
                        tile: 2.5, normalScale: 0.7, color: 0xffffff,
                        roughness: 1.0, metalness: 0.0, envMapIntensity: 0.25,
                    });
                    obj.userData.textureUpgraded = true;
                }
                return;
            }

            // ---- 掩体/大型道具：给一点混凝土颗粒，保留原色 ----
            if (surface === 'cover' && params.width && params.width > 1.4) {
                if (!obj.userData.textureUpgraded) {
                    const okPBR = applyPBR(obj, 'concreteDark', {
                        tile: 2.2, normalScale: 0.9, roughness: 1.0,
                        metalness: 0.0, envMapIntensity: 0.35,
                    });
                    if (!okPBR) {
                        applyTextureToMesh(obj, tex.concreteDark, Math.max(1, params.width / 2.5), Math.max(1, (params.height || 1) / 2.5));
                    }
                    mat.color.lerp(new THREE.Color(0xffffff), 0.25);
                    obj.userData.textureUpgraded = true;
                }
            }

            // ---- 兜底：没被任何分支认领的标准材质，至少把 IBL 强度压到场景量级 ----
            //
            // 为什么必须有这一段：建筑的窗户、饰条、女儿墙、栏杆等子网格在建的时候
            // 没有打 userData.surface 标签，于是从上面的 if 链里一路漏下来，
            // envMapIntensity 保持 Three.js 默认值 1.0 —— 而地面是 0.18。
            // 实测 6467 个盒体网格停在这个状态：它们不参与贴图升级倒也罢了，
            // 但吃满 IBL 会让整栋楼比脚下的地亮 5 倍，这正是「画面塑料感」的主因。
            //
            // 只改反射强度，不碰 color / map / 贴图，所以不会改变任何物体的辨识度，
            // 也不会触发着色器重编译（envMapIntensity 是 uniform）。
            if (mat.isMeshStandardMaterial && !mat.transparent && mat.envMapIntensity > 0.4 && !obj.userData.textureUpgraded) {
                mat.envMapIntensity = 0.2;
            }
        });
    }

    // ========== 公共API ==========

    function init(renderer, scene, camera) {
        _renderer = renderer;
        _scene = scene;
        _camera = camera;
        _clock = new THREE.Clock();
        try {
            _maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
        } catch (e) { _maxAnisotropy = 4; }

        // 程序化 PBR 材质：初始化并在空闲时预生成常用材质，避免开局卡顿
        // 列表里带上当前地图的地面贴图种类（军事=dirt、港口=concrete、密林=grass），
        // 否则非 grass 的地面会在材质升级时惰性生成，造成一次 40–80ms 的进图卡顿。
        // 注意 MAP_DATA 是 var 声明，typeof 守卫在这里是安全的。
        if (typeof PBRTextures !== 'undefined') {
            PBRTextures.init(renderer);
            const _groundKind = (typeof MAP_DATA !== 'undefined' && MAP_DATA &&
                MAP_DATA.theme && MAP_DATA.theme.groundSurface) || 'grass';
            // 预热列表只放「实际会被 applyPBR 用到的种类」。
            // 'dirt' 曾经在这里，但它从来没被任何 surface 分支选中过 ——
            // 它只是 audio_engine 里一个音效分支的名字，和贴图种类同名纯属巧合。
            // 每多预热一种 256² 贴图，就是多一套 albedo+normal+roughness 的显存与烘焙时间。
            PBRTextures.warmup(['concrete', 'asphalt', 'grass', 'gravel',
                'corrugated', 'metal', 'wood', 'roof', _groundKind]);
        }

        // 升级渲染器设置
        _renderer.toneMapping = THREE.ACESFilmicToneMapping;
        _renderer.toneMappingExposure = 1.1;
        _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        if (_renderer.shadowMap) {
            _renderer.shadowMap.needsUpdate = true;
        }

        // 渐变天空（用Canvas纹理作为背景，安全无遮挡问题）
        _skyTexture = createSkyTexture();
        _scene.background = _skyTexture;

        // 升级光照
        upgradeLights();

        // 初始化后期处理（r128 EffectComposer兼容性问题待排查，暂时禁用以保证稳定）
        let ppOk = false;
        if (ppOk) {
            console.log('[GraphicsEnhancement] 后期处理已启用');
        } else {
            console.log('[GraphicsEnhancement] 后期处理未启用（r128兼容性待修复），使用直接渲染');
        }

        // 窗口大小变化时更新
        window.addEventListener('resize', onResize);

        _enabled = true;
        console.log('[GraphicsEnhancement] 初始化完成');
        return true;
    }

    function onResize() {
        if (_composer) {
            _composer.setSize(window.innerWidth, window.innerHeight);
        }
        if (_fxaaPass) {
            const pixelRatio = _renderer.getPixelRatio();
            _fxaaPass.material.uniforms['resolution'].value.set(
                1 / (window.innerWidth * pixelRatio),
                1 / (window.innerHeight * pixelRatio)
            );
        }
        if (_bloomPass) {
            _bloomPass.resolution.set(window.innerWidth, window.innerHeight);
        }
    }

    function render() {
        // 未初始化时不渲染，避免崩溃
        if (!_renderer || !_scene || !_camera) return;

        const time = _clock ? _clock.getElapsedTime() : 0;

        // 更新水面
        if (_waterMeshes.length > 0) {
            updateWater(time);
        }

        if (_composer && _enabled) {
            try {
                _composer.render();
            } catch (e) {
                // 后期处理运行时出错，自动降级到直接渲染，避免黑屏
                console.warn('[GraphicsEnhancement] 后期处理渲染出错，已自动降级:', e);
                _composer = null;
                _renderer.render(_scene, _camera);
            }
        } else {
            _renderer.render(_scene, _camera);
        }
    }

    function setBloomStrength(v) {
        if (_bloomPass) _bloomPass.strength = v;
    }

    function setEnabled(v) {
        _enabled = v;
    }

    function isEnabled() {
        return _enabled;
    }

    function getWaterMeshes() {
        return _waterMeshes;
    }

    function setWaterEnabled(v) {
        _waterEnabled = v !== false;
        for (const w of _waterMeshes) w.visible = _waterEnabled;
    }

    return {
        init,
        setWaterEnabled,
        render,
        setBloomStrength,
        setEnabled,
        isEnabled,
        getWaterMeshes,
        updateWater,
        createWater,
        upgradeEnvironmentMaterials,
        applyTextureToMesh,
        getTextures,
        makeNoiseTexture,
        makeConcreteTexture,
        makeGrassTexture,
        makeAsphaltTexture,
    };
})();

// 自动初始化兜底：本脚本在 game.js 之后加载（index.html 第 1451 行 vs 第 1447 行）。
//
// 更正一条曾写反的注释：原注释是「game.js 先执行并调用 init()，此时本脚本还未加载」——
// 这与实际行为相反。真实情况是：
//   ① game.js 末尾走 ResourceLoader.startLoading(() => init())，startLoading 是 async，
//      阶段 3/4 有真实的音频/图片异步等待 + setTimeout，所以 init() 被推迟到
//      所有 <script> 解析完毕之后；
//   ② 因此 game.js:init() 里对 GameSettings / GraphicsEnhancement 的引用能成功，
//      纯粹依赖这条「没人写下来」的时序契约（见 docs/architecture/overview.md §3.2）。
//   ③ 本段 autoInit 只在「init() 竟然先于本脚本跑完」这种异常时序下才会生效，
//      属于兜底而非主路径。它必须自己防重入，否则会把 init 做两遍。
(function autoInit() {
    if (typeof GraphicsEnhancement !== 'undefined' && GraphicsEnhancement.isEnabled()) return; // 已初始化，防重入
    if (typeof renderer !== 'undefined' && renderer &&
        typeof scene !== 'undefined' && scene &&
        typeof camera !== 'undefined' && camera) {
        try {
            GraphicsEnhancement.init(renderer, scene, camera);
            // 初始化后升级当前地图材质
            GraphicsEnhancement.upgradeEnvironmentMaterials();
            console.log('[GraphicsEnhancement] 自动初始化完成（兜底路径）');
        } catch (e) {
            // 不再只写 console.warn —— 走统一诊断通道，避免「画面降级但零报错」
            if (typeof reportInitError === 'function') reportInitError('autoInit:GraphicsEnhancement', e);
            else console.warn('[GraphicsEnhancement] 自动初始化失败:', e);
        }
    } else {
        // 如果还没准备好，等 DOM 加载完成后再试
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', autoInit);
        }
    }
})();
