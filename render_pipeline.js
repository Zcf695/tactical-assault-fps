/**
 * render_pipeline.js
 * 渲染管线 —— 统一画面基调与帧预算
 *
 * 职责（单一边界，不介入玩法逻辑）：
 * 1. 程序化天空穹顶：天顶/地平线渐变 + 太阳盘与光晕 + 稀薄云层 + 地平线雾霭
 * 2. 光照：方向光与天空太阳对齐，阴影相机跟随玩家收紧，半球光/环境光按主题配平
 * 3. 环境反射：由天空实时烘焙 PMREM，供金属/玻璃/水面使用
 * 4. 后期链：Bloom → 电影级 ACES 调色（对比/饱和/分离色调）→ 暗角/胶片颗粒/抖动消色带 → FXAA
 * 5. 画质分级：低/中/高对应像素比上限、阴影贴图、泛光强度
 * 6. 自适应分辨率：帧率不足时按 0.1 步长回退，稳定后逐步恢复
 *
 * 用法：
 *   RenderPipeline.init(renderer, scene, camera)   // 在 GraphicsEnhancement.init 之后
 *   RenderPipeline.setTheme(MAP_DATA.theme)        // 地图切换时
 *   RenderPipeline.render()                        // 替代 renderer.render()
 *
 * 设计约束：
 * - 任何一步失败都回退到 renderer.render()，不允许黑屏
 * - 天空/后期只读全局主题与设置，不写玩法状态
 * - 不替换材质引用，材质细化由 graphics_enhancement.js 负责
 */

const RenderPipeline = (function () {
    // ---------- 句柄 ----------
    let _renderer = null;
    let _scene = null;
    let _camera = null;
    let _composer = null;
    let _bloomPass = null;
    let _gradePass = null;
    let _fxaaPass = null;

    // ---------- 天空与光照 ----------
    let _skyMesh = null;
    let _skyMat = null;
    let _sun = null;
    let _hemi = null;
    let _ambient = null;
    let _bounce = null;
    let _pmrem = null;
    let _envRT = null;
    let _themeKey = '';
    let _theme = null;

    // ---------- 状态 ----------
    let _enabled = false;
    let _postEnabled = true;
    let _dynamicRes = true;
    let _lowMode = false;
    let _quality = 'medium';
    let _shadowQuality = 'medium';
    let _dpr = 1;
    let _dprCap = 1.5;
    let _dprMin = 0.85;
    // 性能守卫（PerformanceGuard）写入的分辨率下限。
    // 轨道 A（守卫：离散分级、只降不升、降到底后永久停止）与轨道 B（_adaptResolution：连续、双向）
    // 都会写 _dpr。若不加下限，轨道 B 会在帧率恢复后把守卫刚压下去的 dpr 一路升回 _dprCap，
    // 而守卫此时已 _done = true 不再降级 —— 结果是「先低画质能玩 → 慢慢变清晰 → 再次卡死」。
    // 语义：_dprFloor > 0 时，_adaptResolution 的上升不得超过它；守卫写入即视为定案。
    let _dprFloor = 0;
    let _adaptTimer = 0;
    let _recoverTimer = 0;
    let _fpsAvg = 60;
    let _time = 0;
    let _waterAcc = 0;
    let _lastSunPos = new THREE.Vector3(1e9, 0, 0);
    // 侧后方低角度太阳：正面受光 + 长投影，避免出生点看到整片逆光黑墙
    let _sunDir = new THREE.Vector3(0.54, 0.50, -0.68).normalize();
    const _tmpWorld = new THREE.Vector3();

    // 天空穹顶半径：必须小于相机 far(300)，并每帧跟随相机
    const SKY_RADIUS = 280;

    // ---------- 调色参数（集中管理，便于统一调整） ----------
    const GRADE = {
        exposure: 0.98,
        contrast: 1.06,
        saturation: 1.04,
        vignette: 0.32,
        grain: 0.016,
    };

    // ============================================================
    // 天空
    // ============================================================

    const SKY_VERT = `
        varying vec3 vDir;
        void main() {
            vDir = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    // 低配天空：只保留渐变 + 廉价太阳光晕，去掉 fbm 云层，软件渲染也能跑
    const LOW_SKY_FRAG = `
        varying vec3 vDir;
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uGround;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.75, max(h, 0.0)));
            float sd = max(dot(d, uSunDir), 0.0);
            col += uSunColor * pow(sd, 32.0) * 0.35;
            col += uSunColor * smoothstep(0.9995, 0.9999, sd) * 2.0;
            col = mix(col, uGround, smoothstep(0.0, -0.15, h));
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
        }
    `;

    const SKY_FRAG = `
        varying vec3 vDir;
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uGround;
        uniform vec3 uSunColor;
        uniform vec3 uCloudColor;
        uniform vec3 uSunDir;
        uniform float uTime;
        uniform float uCloud;

        float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }
        float vnoise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash21(i);
            float b = hash21(i + vec2(1.0, 0.0));
            float c = hash21(i + vec2(0.0, 1.0));
            float d = hash21(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 5; i++) {
                v += a * vnoise(p);
                p *= 2.03;
                a *= 0.5;
            }
            return v;
        }

        void main() {
            vec3 d = normalize(vDir);
            float h = d.y;

            // 天顶 → 地平线：低角度变化慢，高角度变化快，接近真实天空的亮度曲线
            float t = pow(clamp(h, 0.0, 1.0), 0.55);
            vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.95, t));

            // 太阳：宽光晕 + 收紧的眩光 + 圆盘
            float sd = max(dot(d, uSunDir), 0.0);
            col += uSunColor * pow(sd, 14.0) * 0.13;
            col += uSunColor * pow(sd, 240.0) * 0.90;
            float disc = smoothstep(0.99962, 0.99986, sd);
            col += uSunColor * disc * 3.2;

            // 地平线雾霭：让远景几何与天空自然咬合
            float haze = pow(clamp(1.0 - abs(h), 0.0, 1.0), 9.0);
            col = mix(col, uHorizon * 1.02, haze * 0.42);

            // 云层：投影到高空平面采样，地平线附近淡出，避免拉伸
            if (h > 0.010) {
                vec2 cuv = d.xz / (h + 0.12) * 1.0;
                vec2 drift = vec2(uTime * 0.0042, uTime * 0.0016);
                // 坐标扭曲：让云团边缘不规则，而不是一团团模糊的圆斑
                vec2 warp = vec2(fbm(cuv * 0.7 + 1.7), fbm(cuv * 0.7 + 9.2)) - 0.5;
                vec2 wuv = cuv + warp * 0.55;
                float base = fbm(wuv * 1.05 + drift);
                float detail = fbm(wuv * 3.4 - drift * 1.6 + vec2(3.1, 7.7));
                float n = base * 0.7 + detail * 0.3;
                float cl = smoothstep(0.485, 0.60, n);
                // 边缘侵蚀，打碎平滑的等值线
                cl *= smoothstep(0.28, 0.55, detail + 0.18);
                cl *= smoothstep(0.010, 0.22, h);
                // 云底偏冷、云顶偏亮，形成体积感
                float lit = smoothstep(0.35, 0.75, detail);
                vec3 cloudCol = mix(uCloudColor * 0.72, uCloudColor * 1.12, lit);
                cloudCol = mix(cloudCol, uSunColor * 1.18, pow(sd, 6.0) * 0.55);
                col = mix(col, cloudCol, cl * uCloud);
                // 逆光银边
                col += uSunColor * cl * pow(sd, 10.0) * 0.18;
            }

            // 地平线以下：地面反照色，避免看到“世界底面”
            col = mix(col, uGround, smoothstep(0.0, -0.18, h));

            gl_FragColor = vec4(col, 1.0);
            // 直出渲染时与场景材质共用同一套色调映射/编码；渲染到后期目标时这两个 chunk 自动退化为 no-op
            #include <tonemapping_fragment>
            #include <encodings_fragment>
        }
    `;

    function _makeSkyMaterial() {
        const c = _theme || {};
        const sky = new THREE.Color(c.skyColor != null ? c.skyColor : 0x87ceeb);
        const fog = new THREE.Color(c.fogColor != null ? c.fogColor : 0xa8d0e0);
        const ground = new THREE.Color(c.groundColor != null ? c.groundColor : 0x3d4f3f);

        // 天顶压暗、偏蓝；地平线掺暖，形成日照方向的空气感
        const zenith = sky.clone().lerp(new THREE.Color(0x17416e), 0.62);
        const horizon = fog.clone().lerp(new THREE.Color(0xffcf9e), 0.30).multiplyScalar(0.94);
        const sunColor = new THREE.Color(0xffe6bd);
        const cloudColor = fog.clone().lerp(new THREE.Color(0xf4f0e6), 0.72);
        const groundCol = ground.clone().lerp(fog, 0.42).multiplyScalar(0.82);
        // 颜色按 sRGB 书写，进入着色器前转线性，避免 ACES + sRGB 输出把天空整体提亮
        zenith.convertSRGBToLinear();
        horizon.convertSRGBToLinear();
        sunColor.convertSRGBToLinear();
        cloudColor.convertSRGBToLinear();
        groundCol.convertSRGBToLinear();

        return new THREE.ShaderMaterial({
            uniforms: {
                uZenith: { value: zenith },
                uHorizon: { value: horizon },
                uGround: { value: groundCol },
                uSunColor: { value: sunColor },
                uCloudColor: { value: cloudColor },
                uSunDir: { value: _sunDir.clone() },
                uTime: { value: 0 },
                uCloud: { value: 0.78 },
            },
            vertexShader: SKY_VERT,
            fragmentShader: _lowMode ? LOW_SKY_FRAG : SKY_FRAG,
            side: THREE.BackSide,
            depthWrite: false,
            depthTest: false,
            fog: false,
        });
    }

    function _buildSky() {
        if (_skyMesh) {
            _scene.remove(_skyMesh);
            _skyMesh.geometry.dispose();
            _skyMesh.material.dispose();
        }
        const geo = new THREE.SphereGeometry(SKY_RADIUS, 40, 24);
        _skyMat = _makeSkyMaterial();
        _skyMesh = new THREE.Mesh(geo, _skyMat);
        _skyMesh.name = 'renderPipelineSky';
        _skyMesh.renderOrder = -1000;
        _skyMesh.frustumCulled = false;
        if (_camera) _skyMesh.position.copy(_camera.getWorldPosition(new THREE.Vector3()));
        _scene.add(_skyMesh);

        // 天空负责背景，移除旧的扁平背景纹理/纯色
        _scene.background = null;
    }

    /**
     * 用天空烘焙环境贴图，金属/水面/玻璃才有正确的环境反射。
     * 只在主题切换时执行一次，代价约几十毫秒，落在加载阶段。
     */
    function _bakeEnvironment() {
        if (!_renderer || !_skyMat) return;
        if (_lowMode) {
            if (_scene) _scene.environment = null;
            return;
        }
        try {
            const tmpScene = new THREE.Scene();
            const tmpMat = _skyMat.clone();
            const tmpMesh = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), tmpMat);
            tmpMesh.material.side = THREE.BackSide;
            tmpScene.add(tmpMesh);

            if (_pmrem) _pmrem.dispose();
            _pmrem = new THREE.PMREMGenerator(_renderer);
            const rt = _pmrem.fromScene(tmpScene, 0.04, 0.1, 200);
            if (_envRT && _envRT.texture) _envRT.dispose();
            _envRT = rt;
            _scene.environment = rt.texture;

            tmpMesh.geometry.dispose();
            tmpMat.dispose();
        } catch (e) {
            console.warn('[RenderPipeline] 环境贴图烘焙失败，沿用现有光照:', e);
        }
    }

    // ============================================================
    // 光照与阴影
    // ============================================================

    function _findLights() {
        _sun = null; _hemi = null; _ambient = null;
        _scene.traverse(function (o) {
            if (o.isDirectionalLight && !o.userData.isBounce && !_sun) _sun = o;
            else if (o.isHemisphereLight && !_hemi) _hemi = o;
            else if (o.isAmbientLight && !_ambient) _ambient = o;
        });
        if (!_sun) {
            _sun = new THREE.DirectionalLight(0xffe9cc, 1.5);
            _scene.add(_sun);
        }
        if (!_sun.target.parent) _scene.add(_sun.target);
        if (!_hemi) {
            _hemi = new THREE.HemisphereLight(0x9fc4dd, 0x4a4034, 0.45);
            _scene.add(_hemi);
        }
        if (!_ambient) {
            _ambient = new THREE.AmbientLight(0x556677, 0.18);
            _scene.add(_ambient);
        }
        // 反向补光（模拟地面/天空反弹），只提亮阴影，不产生二次投影
        if (!_bounce) {
            _bounce = new THREE.DirectionalLight(0x9fbfd6, 0.0);
            _bounce.userData.isBounce = true;
            _bounce.castShadow = false;
            _scene.add(_bounce);
            _scene.add(_bounce.target);
        }
    }

    function _applyLighting() {
        if (!_sun) return;
        const c = _theme || {};
        const fog = new THREE.Color(c.fogColor != null ? c.fogColor : 0xa8d0e0);
        const ground = new THREE.Color(c.groundColor != null ? c.groundColor : 0x3d4f3f);

        _sun.color.setHex(0xffe2b8);
        _sun.intensity = 1.35;
        _sun.castShadow = _shadowQuality !== 'off';
        _sun.shadow.bias = -0.0007;
        _sun.shadow.normalBias = 0.04;

        const mapSize = _shadowQuality === 'high' ? 2048 : (_shadowQuality === 'low' ? 1024 : 1536);
        if (_sun.shadow.mapSize.x !== mapSize) {
            _sun.shadow.mapSize.set(mapSize, mapSize);
            if (_sun.shadow.map) {
                _sun.shadow.map.dispose();
                _sun.shadow.map = null;
            }
        }
        // 阴影相机只覆盖玩家周围，等于把有限分辨率集中到可见范围
        const ext = 68;
        _sun.shadow.camera.left = -ext;
        _sun.shadow.camera.right = ext;
        _sun.shadow.camera.top = ext;
        _sun.shadow.camera.bottom = -ext;
        _sun.shadow.camera.near = 1;
        _sun.shadow.camera.far = 220;
        _sun.shadow.camera.updateProjectionMatrix();

        // 半球光取天空/地面颜色，避免阴影区死黑
        _hemi.color.copy(fog).lerp(new THREE.Color(0xbcd8ee), 0.45);
        _hemi.groundColor.copy(ground).multiplyScalar(0.7);
        _hemi.intensity = 0.22;

        _ambient.color.setHex(0x6c8ba5);
        _ambient.intensity = 0.06;

        if (_bounce) {
            _bounce.color.setHex(0x9fbfd6);
            _bounce.intensity = 0.42;
        }

        _lastSunPos.set(1e9, 0, 0);
        _updateSunPosition(true);
    }

    function _updateSunPosition(force) {
        if (!_sun) return;
        const target = (typeof playerGroup !== 'undefined' && playerGroup) ? playerGroup.position : _camera.position;
        // 每移动 2.5m 才重算，减少阴影贴图抖动与矩阵更新
        if (!force && _lastSunPos.distanceToSquared(target) < 6.25) return;
        _lastSunPos.copy(target);
        _sun.target.position.set(target.x, 0, target.z);
        _sun.position.set(
            target.x + _sunDir.x * 95,
            _sunDir.y * 95,
            target.z + _sunDir.z * 95
        );
        _sun.target.updateMatrixWorld();

        if (_bounce) {
            _bounce.target.position.set(target.x, 0, target.z);
            _bounce.position.set(
                target.x - _sunDir.x * 70,
                32,
                target.z - _sunDir.z * 70
            );
            _bounce.target.updateMatrixWorld();
        }
    }

    // ============================================================
    // 后期处理
    // ============================================================

    const GradeShader = {
        uniforms: {
            tDiffuse: { value: null },
            uExposure: { value: GRADE.exposure },
            uContrast: { value: GRADE.contrast },
            uSaturation: { value: GRADE.saturation },
            uVignette: { value: GRADE.vignette },
            uGrain: { value: GRADE.grain },
            uTime: { value: 0 },
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
            uniform float uExposure;
            uniform float uContrast;
            uniform float uSaturation;
            uniform float uVignette;
            uniform float uGrain;
            uniform float uTime;
            varying vec2 vUv;

            // Narkowicz ACES 拟合：高光滚降自然，暗部保留细节
            vec3 aces(vec3 x) {
                const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
                return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
            }
            vec3 lin2srgb(vec3 c) {
                return mix(1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
                           c * 12.92,
                           step(c, vec3(0.0031308)));
            }
            float hash21(vec2 p) {
                p = fract(p * vec2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return fract(p.x * p.y);
            }

            void main() {
                vec3 c = texture2D(tDiffuse, vUv).rgb;
                c *= uExposure;
                c = aces(c);
                c = lin2srgb(c);

                // 分离色调：暗部偏冷、亮部偏暖，建立电影感层次
                float l = dot(c, vec3(0.299, 0.587, 0.114));
                c += vec3(-0.014, 0.004, 0.020) * (1.0 - smoothstep(0.0, 0.55, l));
                c += vec3(0.014, 0.007, -0.016) * smoothstep(0.45, 1.0, l);

                // 对比与饱和
                c = (c - 0.5) * uContrast + 0.5;
                float lg = dot(c, vec3(0.299, 0.587, 0.114));
                c = mix(vec3(lg), c, uSaturation);

                // 暗角：轻微收紧注意力，不遮挡 HUD
                vec2 q = vUv - 0.5;
                float vig = smoothstep(0.92, 0.22, length(q) * 1.18);
                c *= mix(1.0, vig, uVignette);

                // 胶片颗粒 + 抖动：掩盖天空渐变的 8bit 色带
                float g = hash21(vUv * vec2(1920.0, 1080.0) + fract(uTime * 0.37) * 131.7);
                c += (g - 0.5) * uGrain;
                c += (hash21(vUv * 977.0 + 3.1) - 0.5) * (1.0 / 255.0);

                gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
            }
        `,
    };

    /**
     * 后期链路自己完成 ACES + sRGB，材质端必须关闭色调映射，
     * 否则 r128 会在渲染目标里先做一遍 ACES，最终画面被压平、发灰。
     * 直出渲染时再恢复 ACES，保证两条路径观感一致。
     */
    function _syncToneMapping() {
        if (!_renderer) return;
        const usePost = !!(_composer && _postEnabled);
        const mode = usePost ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
        if (_renderer.toneMapping !== mode) {
            _renderer.toneMapping = mode;
            _renderer.toneMappingExposure = 1.0;
        }
    }

    function _buildComposer() {
        if (typeof THREE.EffectComposer === 'undefined' || typeof THREE.RenderPass === 'undefined') {
            console.warn('[RenderPipeline] 后期处理库不可用，直接渲染');
            return false;
        }
        try {
            const w = window.innerWidth, h = window.innerHeight;
            const rtParams = {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                type: THREE.UnsignedByteType,
                stencilBuffer: false,
                depthBuffer: true,
            };
            const rt = new THREE.WebGLRenderTarget(Math.max(1, Math.floor(w * _dpr)), Math.max(1, Math.floor(h * _dpr)), rtParams);
            _composer = new THREE.EffectComposer(_renderer, rt);
            _composer.setPixelRatio(_dpr);
            _composer.setSize(w, h);

            _composer.addPass(new THREE.RenderPass(_scene, _camera));

            if (typeof THREE.UnrealBloomPass !== 'undefined') {
                _bloomPass = new THREE.UnrealBloomPass(
                    new THREE.Vector2(w, h),
                    _quality === 'high' ? 0.42 : 0.30,
                    0.62,
                    0.86
                );
                _composer.addPass(_bloomPass);
            }

            // 色调映射 + sRGB 转换 + 调色（渲染目标里是线性色，必须在本pass完成）
            _gradePass = new THREE.ShaderPass(GradeShader);
            _composer.addPass(_gradePass);

            if (typeof THREE.FXAAShader !== 'undefined') {
                _fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
                _fxaaPass.material.uniforms['resolution'].value.set(
                    1 / (w * _dpr), 1 / (h * _dpr)
                );
                _composer.addPass(_fxaaPass);
            }

            const last = _composer.passes[_composer.passes.length - 1];
            last.renderToScreen = true;

            console.log('[RenderPipeline] 后期链就绪：Bloom + ACES + Grade + FXAA');
            _syncToneMapping();
            return true;
        } catch (e) {
            console.error('[RenderPipeline] 后期链初始化失败，回退直接渲染:', e);
            _composer = null;
            return false;
        }
    }

    // ============================================================
    // 画质与分辨率
    // ============================================================

    function _applyQuality(resetDpr) {
        if (!_renderer) return;
        if (typeof GameSettings !== 'undefined' && GameSettings.getSettings) {
            try {
                const g = GameSettings.getSettings().graphics;
                _quality = g.quality || 'medium';
                _shadowQuality = g.shadowQuality || 'medium';
                _postEnabled = g.postFX !== false;
                _dynamicRes = g.dynamicResolution !== false;
            } catch (e) { /* 忽略设置读取失败 */ }
        }

        // 更保守的分辨率上限：移动端/核显最常见的瓶颈是像素填充而不是几何
        _dprCap = _quality === 'high' ? 1.5 : (_quality === 'low' ? 0.9 : 1.25);
        _dprMin = _quality === 'low' ? 0.55 : 0.7;
        // 低画质强制关闭后期与阴影，保证“低”是真的能跑
        if (_quality === 'low') {
            _postEnabled = false;
            _shadowQuality = 'off';
        }
        if (_lowMode) {
            _postEnabled = false;
            _shadowQuality = 'off';
        }

        // 渲染器基础设置
        _renderer.shadowMap.enabled = _shadowQuality !== 'off';
        _renderer.shadowMap.type = _shadowQuality === 'high' ? THREE.PCFSoftShadowMap
            : (_shadowQuality === 'low' ? THREE.BasicShadowMap : THREE.PCFShadowMap);
        if ('outputEncoding' in _renderer) _renderer.outputEncoding = THREE.sRGBEncoding;
        _syncToneMapping();

        const cap = Math.min(window.devicePixelRatio || 1, _dprCap);
        // 仅在初始化或超过上限时收敛，避免拖动亮度滑杆时反复重建缓冲
        if (resetDpr || !_dpr || _dpr > cap) _dpr = cap;
        _applyDpr();

        if (_bloomPass) {
            _bloomPass.strength = _quality === 'high' ? 0.42 : 0.30;
            _bloomPass.enabled = _postEnabled;
        }
        if (_bloomPass && _bloomPass.resolution) {
            _bloomPass.resolution.set(window.innerWidth, window.innerHeight);
        }

        _applyLighting();
    }

    function setResolutionScale(v) {
        if (!_renderer) return;
        _dpr = Math.max(0.5, Math.min(_dprCap, v || 1));
        // 记录下限：性能守卫压下来的分辨率不允许被自适应分辨率悄悄升回去
        _dprFloor = _dpr;
        _applyDpr();
    }

    /** 清除守卫写入的下限，恢复自适应分辨率对 dpr 的完整控制权（重开一局 / 用户改画质时调用） */
    function clearResolutionFloor() {
        _dprFloor = 0;
        _recoverTimer = 0;
    }

    function _applyDpr() {
        if (!_renderer) return;
        _renderer.setPixelRatio(_dpr);
        _renderer.setSize(window.innerWidth, window.innerHeight);
        if (_composer) {
            _composer.setPixelRatio(_dpr);
            _composer.setSize(window.innerWidth, window.innerHeight);
        }
        _updateFxaaResolution();
    }

    function _updateFxaaResolution() {
        if (!_fxaaPass) return;
        _fxaaPass.material.uniforms['resolution'].value.set(
            1 / Math.max(1, window.innerWidth * _dpr),
            1 / Math.max(1, window.innerHeight * _dpr)
        );
    }

    function _adaptResolution(dt) {
        if (!_dynamicRes || !_renderer) return;
        // 用帧时长估算平滑帧率（比 1/帧时长 稳定）
        const inst = 1 / Math.max(dt, 0.0001);
        _fpsAvg += (Math.min(inst, 240) - _fpsAvg) * 0.05;

        _adaptTimer += dt;
        if (_adaptTimer < 1.0) return;
        _adaptTimer = 0;

        const cap = Math.min(window.devicePixelRatio || 1, _dprCap);
        // 上升上界：守卫写入过下限时，自适应不得越过它（下降永远允许 —— 继续变糊总是安全的）
        const riseCap = _dprFloor > 0 ? Math.min(cap, _dprFloor) : cap;
        if (_fpsAvg < 48 && _dpr > _dprMin) {
            _dpr = Math.max(_dprMin, _dpr - 0.1);
            _applyDpr();
            _recoverTimer = 0;
        } else if (_fpsAvg > 57) {
            _recoverTimer += 1;
            if (_recoverTimer >= 4 && _dpr < riseCap) {
                _dpr = Math.min(riseCap, _dpr + 0.05);
                _applyDpr();
                _recoverTimer = 0;
            }
        } else {
            _recoverTimer = 0;
        }
    }

    // ============================================================
    // 公共流程
    // ============================================================

    function init(renderer, scene, camera) {
        if (!renderer || !scene || !camera) return false;
        _renderer = renderer;
        _scene = scene;
        _camera = camera;

        try {
            _theme = (typeof MAP_DATA !== 'undefined' && MAP_DATA && MAP_DATA.theme) || _theme || {};
            _findLights();

            _renderer.toneMapping = THREE.ACESFilmicToneMapping;
            _renderer.toneMappingExposure = 1.0;
            if ('outputEncoding' in _renderer) _renderer.outputEncoding = THREE.sRGBEncoding;

            _buildSky();
            _syncFog();
            _bakeEnvironment();
            _buildComposer();
            _applyQuality(true);

            _enabled = true;
            window.addEventListener('resize', onResize);
            console.log('[RenderPipeline] 初始化完成（sky + IBL + post）');
            return true;
        } catch (e) {
            console.error('[RenderPipeline] 初始化失败，保持原有渲染:', e);
            _enabled = false;
            _composer = null;
            return false;
        }
    }

    /**
     * 地图切换：重建天空配色、雾、光照与环境反射。
     * 允许在 init 之前调用（只记录主题）。
     */
    function setTheme(theme) {
        _theme = theme || _theme || {};
        const key = JSON.stringify([
            _theme.skyColor, _theme.fogColor, _theme.groundColor,
            _theme.fogNear, _theme.fogFar
        ]);
        if (key === _themeKey) {
            if (_scene && _scene.fog) _syncFog();
            return;
        }
        _themeKey = key;

        if (!_enabled) return;
        try {
            _buildSky();
            _applyLighting();
            _syncFog();
            _bakeEnvironment();
        } catch (e) {
            console.warn('[RenderPipeline] 主题应用失败:', e);
        }
    }

    function _syncFog() {
        if (!_scene) return;
        const c = _theme || {};
        const fogColor = new THREE.Color(c.fogColor != null ? c.fogColor : 0xa8d0e0);
        const horizon = fogColor.clone().lerp(new THREE.Color(0xffcf9e), 0.30).multiplyScalar(0.94).convertSRGBToLinear();
        // 尊重每张地图的雾配置（森林 45/195、军事 55/205、港口 65/235）。
        // 历史实现是 Math.max(c.fogNear || 50, 65) / Math.max(c.fogFar || 160, 235)，
        // 把三张图的雾距统一抬成 65/235 —— 地图的 fog 配置全部失效，三图空气透视一模一样，
        // 森林图「密林迷雾」的潜行氛围完全丢失。这里只保留「far 必须明显大于 near」的安全约束，
        // 不再设绝对下限；雾距是地图设计参数，应由地图数据决定。
        const near = c.fogNear != null ? c.fogNear : 50;
        const far = Math.max(c.fogFar != null ? c.fogFar : 160, near + 40);
        if (!_scene.fog) {
            _scene.fog = new THREE.Fog(horizon, near, far);
        } else {
            _scene.fog.color.copy(horizon);
            _scene.fog.near = near;
            _scene.fog.far = far;
        }
        if (_renderer) _renderer.setClearColor(horizon, 1);
    }

    function onResize() {
        if (!_renderer) return;
        _renderer.setSize(window.innerWidth, window.innerHeight);
        if (_composer) {
            _composer.setPixelRatio(_dpr);
            _composer.setSize(window.innerWidth, window.innerHeight);
        }
        if (_bloomPass && _bloomPass.resolution) {
            _bloomPass.resolution.set(window.innerWidth, window.innerHeight);
        }
        _updateFxaaResolution();
    }

    function render(frameDt) {
        if (!_renderer || !_scene || !_camera) return;
        if (!_enabled) {
            _renderer.render(_scene, _camera);
            return;
        }

        // 由主循环传入帧时长，避免与游戏时间轴各算一套
        const dt = (typeof frameDt === 'number' && frameDt > 0 && frameDt < 0.5)
            ? frameDt
            : ((typeof clock !== 'undefined' && clock) ? clock.getDelta() : 0.016);
        _time += dt;

        // 天空跟随相机（必须用世界坐标：相机是 playerGroup 的子节点）
        if (_skyMesh) _skyMesh.position.copy(_camera.getWorldPosition(_tmpWorld));
        if (_skyMat) _skyMat.uniforms.uTime.value = _time;

        _updateSunPosition(false);
        _adaptResolution(dt);

        // 水面：20Hz 更新足够，几何法线重算较贵
        _waterAcc += dt;
        if (_waterAcc >= 0.05) {
            _waterAcc = 0;
            if (typeof GraphicsEnhancement !== 'undefined' && GraphicsEnhancement.updateWater) {
                GraphicsEnhancement.updateWater(_time);
            }
        }

        if (_gradePass) _gradePass.uniforms.uTime.value = _time;
        _syncToneMapping();

        if (_composer && _postEnabled) {
            try {
                _composer.render();
                return;
            } catch (e) {
                console.warn('[RenderPipeline] 后期渲染异常，降级直接渲染:', e);
                _composer = null;
            }
        }
        _renderer.render(_scene, _camera);
    }

    function setPostEnabled(v) {
        _postEnabled = v !== false;
        if (_bloomPass) _bloomPass.enabled = _postEnabled;
        _syncToneMapping();
    }

    function setDynamicResolution(v) {
        _dynamicRes = v !== false;
        if (!_dynamicRes) {
            const cap = Math.min(window.devicePixelRatio || 1, _dprCap);
            _dpr = cap;
            _applyDpr();
        }
    }

    function applyQuality() {
        // 用户显式改画质 / 内部重置：清除守卫写入的分辨率下限，交还自适应分辨率控制权。
        // 守卫自身的调用序列是 setLowMode → applyQuality → setResolutionScale，
        // setResolutionScale 在最后重新写入下限，因此这里清除不会削弱守卫的降级效果。
        clearResolutionFloor();
        _applyQuality(false);
    }

    /** 低配模式：廉价天空、关闭 IBL/后期/阴影，供性能守卫调用 */
    function setLowMode(v) {
        _lowMode = v !== false;
        if (_lowMode) {
            _postEnabled = false;
            if (_bloomPass) _bloomPass.enabled = false;
            if (_scene) _scene.environment = null;
        }
        if (_renderer) {
            _renderer.shadowMap.enabled = !_lowMode && _shadowQuality !== 'off';
        }
        _buildSky();
        _applyQuality(true);
    }

    function isEnabled() { return _enabled && !!( _composer || _renderer ); }
    function getStats() {
        return {
            quality: _quality,
            dpr: _dpr,
            dprFloor: _dprFloor,
            fps: Math.round(_fpsAvg),
            post: !!(_composer && _postEnabled),
            shadow: _shadowQuality,
        };
    }

    return {
        init,
        render,
        setTheme,
        setPostEnabled,
        setDynamicResolution,
        applyQuality,
        setLowMode,
        setResolutionScale,
        clearResolutionFloor,
        isEnabled,
        getStats,
        onResize,
    };
})();
