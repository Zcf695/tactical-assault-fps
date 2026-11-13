/**
 * settings.js
 * 游戏设置菜单系统
 * 包含：按键自定义、画面调节、鼠标灵敏度、音效音量、ESC暂停菜单
 */

const GameSettings = (function () {
    // 默认设置
    const DEFAULTS = {
        keyBindings: {
            forward: 'KeyW',
            backward: 'KeyS',
            left: 'KeyA',
            right: 'KeyD',
            jump: 'Space',
            sprint: 'ShiftLeft',
            crouch: 'ControlLeft',
            reload: 'KeyR',
            interact: 'KeyF',
            backpack: 'KeyB',
            map: 'KeyM',
            inspect: 'KeyV',
            useMedkit: 'Digit5',
            useBandage: 'Digit6',
            usePainkiller: 'Digit7',
        },
        graphics: {
            quality: 'medium', // low / medium / high
            fov: 78,           // 视野角度（60-100）
            brightness: 1.0,
            contrast: 1.0,
            shadowQuality: 'medium', // off / low / medium / high
            bloomEnabled: false,
            postFX: true,           // 后期处理：泛光 / ACES 调色 / 暗角 / 颗粒
            dynamicResolution: true, // 帧率不足时自动降低渲染分辨率
            performanceMode: false,  // 性能模式：强制低配天空/关阴影/关后期
        },
        mouse: {
            sensitivity: 0.002,
            sensitivityX: 1.0,
            sensitivityY: 1.0,
            invertY: false,
        },
        audio: {
            masterVolume: 0.8,
            sfxVolume: 0.9,
            musicVolume: 0.5,
        },
        gameplay: {
            showFPS: false,
            autoReload: true,
            wheelSwitchWeapon: true,
        }
    };

    let _settings = loadSettings();
    let _listeningForKey = null;
    let _settingsPanel = null;
    let _pauseMenu = null;

    // ========== 持久化 ==========
    function loadSettings() {
        try {
            const saved = localStorage.getItem('fps_game_settings');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) { console.warn('设置加载失败，使用默认值'); }
        return JSON.parse(JSON.stringify(DEFAULTS));
    }

    function saveSettings() {
        try {
            localStorage.setItem('fps_game_settings', JSON.stringify(_settings));
        } catch (e) { console.warn('设置保存失败'); }
    }

    // 设置改变时实时保存和应用
    function onSettingChange() {
        saveSettings();
        applySettings();
    }

    // ========== 设置面板创建 ==========
    function createSettingsPanel() {
        if (_settingsPanel) return _settingsPanel;

        const panel = document.createElement('div');
        panel.id = 'settingsPanel';
        panel.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:10000;justify-content:center;align-items:center;';

        panel.innerHTML = `
            <div style="background:#1a1a2e;width:700px;max-height:85vh;border-radius:12px;border:1px solid #333;display:flex;flex-direction:column;overflow:hidden;">
                <div style="padding:16px 24px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;">
                    <h2 style="margin:0;color:#ff9800;font-size:20px;">游戏设置</h2>
                    <button id="settingsCloseBtn" style="background:none;border:none;color:#888;font-size:24px;cursor:pointer;">&times;</button>
                </div>
                <div style="display:flex;flex:1;overflow:hidden;">
                    <div id="settingsTabs" style="width:140px;background:#16162a;border-right:1px solid #333;padding:8px 0;">
                        <div class="settings-tab active" data-tab="controls" style="padding:12px 16px;cursor:pointer;color:#ccc;border-left:3px solid transparent;">控制</div>
                        <div class="settings-tab" data-tab="graphics" style="padding:12px 16px;cursor:pointer;color:#ccc;border-left:3px solid transparent;">画面</div>
                        <div class="settings-tab" data-tab="mouse" style="padding:12px 16px;cursor:pointer;color:#ccc;border-left:3px solid transparent;">鼠标</div>
                        <div class="settings-tab" data-tab="audio" style="padding:12px 16px;cursor:pointer;color:#ccc;border-left:3px solid transparent;">音效</div>
                        <div class="settings-tab" data-tab="gameplay" style="padding:12px 16px;cursor:pointer;color:#ccc;border-left:3px solid transparent;">游戏</div>
                    </div>
                    <div id="settingsContent" style="flex:1;padding:20px;overflow-y:auto;color:#ddd;"></div>
                </div>
                <div style="padding:12px 24px;border-top:1px solid #333;display:flex;justify-content:space-between;">
                    <button id="settingsResetBtn" style="padding:8px 16px;background:#444;color:#fff;border:none;border-radius:4px;cursor:pointer;">恢复默认</button>
                    <button id="settingsSaveBtn" style="padding:8px 24px;background:#ff9800;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">保存并关闭</button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        _settingsPanel = panel;

        // 标签切换
        panel.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                panel.querySelectorAll('.settings-tab').forEach(t => {
                    t.classList.remove('active');
                    t.style.color = '#ccc';
                    t.style.borderLeftColor = 'transparent';
                    t.style.background = 'transparent';
                });
                tab.classList.add('active');
                tab.style.color = '#ff9800';
                tab.style.borderLeftColor = '#ff9800';
                tab.style.background = 'rgba(255,152,0,0.1)';
                renderSettingsTab(tab.dataset.tab);
            });
        });

        // 按钮事件
        panel.querySelector('#settingsCloseBtn').addEventListener('click', closeSettings);
        panel.querySelector('#settingsSaveBtn').addEventListener('click', () => { saveSettings(); applySettings(); closeSettings(); });
        panel.querySelector('#settingsResetBtn').addEventListener('click', () => {
            if (confirm('确定恢复所有设置为默认值吗？')) {
                _settings = JSON.parse(JSON.stringify(DEFAULTS));
                const activeTab = panel.querySelector('.settings-tab.active').dataset.tab;
                renderSettingsTab(activeTab);
            }
        });

        // 初始化第一个标签
        const firstTab = panel.querySelector('.settings-tab');
        firstTab.style.color = '#ff9800';
        firstTab.style.borderLeftColor = '#ff9800';
        firstTab.style.background = 'rgba(255,152,0,0.1)';
        renderSettingsTab('controls');

        return panel;
    }

    // ========== 渲染各设置页 ==========
    function renderSettingsTab(tab) {
        const content = _settingsPanel.querySelector('#settingsContent');
        let html = '';

        if (tab === 'controls') {
            html = '<h3 style="margin-top:0;color:#ff9800;">按键设置</h3><p style="color:#888;font-size:13px;">点击按键后按下新键位进行绑定</p>';
            const keyNames = {
                forward: '前进', backward: '后退', left: '左移', right: '右移',
                jump: '跳跃', sprint: '冲刺', crouch: '蹲下', reload: '换弹',
                interact: '交互', backpack: '背包', map: '地图', inspect: '检视武器',
                useMedkit: '使用医疗包', useBandage: '使用绷带', usePainkiller: '使用止痛药'
            };
            for (const [key, name] of Object.entries(keyNames)) {
                const currentKey = _settings.keyBindings[key];
                html += `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #2a2a3a;">
                        <span>${name}</span>
                        <button class="keybind-btn" data-key="${key}" style="padding:6px 16px;background:#2a2a4a;color:#fff;border:1px solid #444;border-radius:4px;cursor:pointer;min-width:100px;">${formatKeyName(currentKey)}</button>
                    </div>
                `;
            }
            content.innerHTML = html;
            content.querySelectorAll('.keybind-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    _listeningForKey = btn.dataset.key;
                    btn.textContent = '按下新键位...';
                    btn.style.background = '#ff9800';
                });
            });
        } else if (tab === 'graphics') {
            html = `
                <h3 style="margin-top:0;color:#ff9800;">画面设置</h3>
                <div style="padding:8px 0;">
                    <label style="display:block;margin-bottom:6px;">画质等级</label>
                    <select id="gfxQuality" style="width:100%;padding:8px;background:#2a2a4a;color:#fff;border:1px solid #444;border-radius:4px;">
                        <option value="low" ${_settings.graphics.quality==='low'?'selected':''}>低</option>
                        <option value="medium" ${_settings.graphics.quality==='medium'?'selected':''}>中</option>
                        <option value="high" ${_settings.graphics.quality==='high'?'selected':''}>高</option>
                    </select>
                </div>
                <div style="padding:8px 0;">
                    <label style="display:block;margin-bottom:6px;">视野 FOV: <span id="fovVal">${(_settings.graphics.fov || 78).toFixed(0)}</span></label>
                    <input type="range" id="gfxFov" min="65" max="100" step="1" value="${_settings.graphics.fov || 78}" style="width:100%;">
                </div>
                <div style="padding:8px 0;">
                    <label style="display:block;margin-bottom:6px;">亮度: <span id="brightnessVal">${_settings.graphics.brightness.toFixed(2)}</span></label>
                    <input type="range" id="gfxBrightness" min="0.5" max="1.5" step="0.05" value="${_settings.graphics.brightness}" style="width:100%;">
                </div>
                <div style="padding:8px 0;">
                    <label style="display:block;margin-bottom:6px;">对比度: <span id="contrastVal">${_settings.graphics.contrast.toFixed(2)}</span></label>
                    <input type="range" id="gfxContrast" min="0.5" max="1.5" step="0.05" value="${_settings.graphics.contrast}" style="width:100%;">
                </div>
                <div style="padding:8px 0;">
                    <label style="display:block;margin-bottom:6px;">阴影质量</label>
                    <select id="gfxShadow" style="width:100%;padding:8px;background:#2a2a4a;color:#fff;border:1px solid #444;border-radius:4px;">
                        <option value="off" ${_settings.graphics.shadowQuality==='off'?'selected':''}>关闭</option>
                        <option value="low" ${_settings.graphics.shadowQuality==='low'?'selected':''}>低</option>
                        <option value="medium" ${_settings.graphics.shadowQuality==='medium'?'selected':''}>中</option>
                        <option value="high" ${_settings.graphics.shadowQuality==='high'?'selected':''}>高</option>
                    </select>
                </div>
                <div style="padding:8px 0;display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" id="gfxPostFX" ${_settings.graphics.postFX !== false ? 'checked' : ''}>
                    <label for="gfxPostFX">启用后期处理（泛光 / 调色 / 暗角）</label>
                </div>
                <div style="padding:8px 0;display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" id="gfxDynRes" ${_settings.graphics.dynamicResolution !== false ? 'checked' : ''}>
                    <label for="gfxDynRes">动态分辨率（帧率不足时自动降采样）</label>
                </div>
                <div style="padding:8px 0;display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" id="gfxPerf" ${_settings.graphics.performanceMode ? 'checked' : ''}>
                    <label for="gfxPerf">性能模式（核显/软件渲染建议开启）</label>
                </div>
            `;
            content.innerHTML = html;
            content.querySelector('#gfxFov').addEventListener('input', e => { _settings.graphics.fov = parseFloat(e.target.value); content.querySelector('#fovVal').textContent = e.target.value; onSettingChange(); });
            content.querySelector('#gfxBrightness').addEventListener('input', e => { _settings.graphics.brightness = parseFloat(e.target.value); content.querySelector('#brightnessVal').textContent = e.target.value; onSettingChange(); });
            content.querySelector('#gfxContrast').addEventListener('input', e => { _settings.graphics.contrast = parseFloat(e.target.value); content.querySelector('#contrastVal').textContent = e.target.value; onSettingChange(); });
            content.querySelector('#gfxQuality').addEventListener('change', e => { _settings.graphics.quality = e.target.value; onSettingChange(); });
            content.querySelector('#gfxShadow').addEventListener('change', e => { _settings.graphics.shadowQuality = e.target.value; onSettingChange(); });
            content.querySelector('#gfxPostFX').addEventListener('change', e => { _settings.graphics.postFX = e.target.checked; onSettingChange(); });
            content.querySelector('#gfxDynRes').addEventListener('change', e => { _settings.graphics.dynamicResolution = e.target.checked; onSettingChange(); });
            content.querySelector('#gfxPerf').addEventListener('change', e => {
                _settings.graphics.performanceMode = e.target.checked;
                if (e.target.checked && typeof PerformanceGuard !== 'undefined') PerformanceGuard.forceLevel(3);
                onSettingChange();
            });
        } else if (tab === 'mouse') {
            html = `
                <h3 style="margin-top:0;color:#ff9800;">鼠标设置</h3>
                <div style="padding:8px 0;">
                    <label style="display:block;margin-bottom:6px;">基础灵敏度: <span id="sensVal">${_settings.mouse.sensitivity.toFixed(4)}</span></label>
                    <input type="range" id="mouseSens" min="0.0005" max="0.005" step="0.0001" value="${_settings.mouse.sensitivity}" style="width:100%;">
                </div>
                <div style="padding:8px 0;">
                    <label style="display:block;margin-bottom:6px;">X轴灵敏度倍率: <span id="sensXVal">${_settings.mouse.sensitivityX.toFixed(2)}</span></label>
                    <input type="range" id="mouseSensX" min="0.5" max="2.0" step="0.05" value="${_settings.mouse.sensitivityX}" style="width:100%;">
                </div>
                <div style="padding:8px 0;">
                    <label style="display:block;margin-bottom:6px;">Y轴灵敏度倍率: <span id="sensYVal">${_settings.mouse.sensitivityY.toFixed(2)}</span></label>
                    <input type="range" id="mouseSensY" min="0.5" max="2.0" step="0.05" value="${_settings.mouse.sensitivityY}" style="width:100%;">
                </div>
                <div style="padding:8px 0;display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" id="mouseInvertY" ${_settings.mouse.invertY?'checked':''}>
                    <label for="mouseInvertY">反转Y轴</label>
                </div>
            `;
            content.innerHTML = html;
            content.querySelector('#mouseSens').addEventListener('input', e => {
                _settings.mouse.sensitivity = parseFloat(e.target.value);
                content.querySelector('#sensVal').textContent = parseFloat(e.target.value).toFixed(4);
                onSettingChange();
            });
            content.querySelector('#mouseSensX').addEventListener('input', e => {
                _settings.mouse.sensitivityX = parseFloat(e.target.value);
                content.querySelector('#sensXVal').textContent = e.target.value;
                onSettingChange();
            });
            content.querySelector('#mouseSensY').addEventListener('input', e => {
                _settings.mouse.sensitivityY = parseFloat(e.target.value);
                content.querySelector('#sensYVal').textContent = e.target.value;
                onSettingChange();
            });
            content.querySelector('#mouseInvertY').addEventListener('change', e => { _settings.mouse.invertY = e.target.checked; onSettingChange(); });
        } else if (tab === 'audio') {
            html = `
                <h3 style="margin-top:0;color:#ff9800;">音效设置</h3>
                <div style="padding:8px 0;">
                    <label style="display:block;margin-bottom:6px;">主音量: <span id="masterVal">${Math.round(_settings.audio.masterVolume*100)}%</span></label>
                    <input type="range" id="audioMaster" min="0" max="1" step="0.05" value="${_settings.audio.masterVolume}" style="width:100%;">
                </div>
                <div style="padding:8px 0;">
                    <label style="display:block;margin-bottom:6px;">音效音量: <span id="sfxVal">${Math.round(_settings.audio.sfxVolume*100)}%</span></label>
                    <input type="range" id="audioSfx" min="0" max="1" step="0.05" value="${_settings.audio.sfxVolume}" style="width:100%;">
                </div>
                <div style="padding:8px 0;">
                    <label style="display:block;margin-bottom:6px;">音乐音量: <span id="musicVal">${Math.round(_settings.audio.musicVolume*100)}%</span></label>
                    <input type="range" id="audioMusic" min="0" max="1" step="0.05" value="${_settings.audio.musicVolume}" style="width:100%;">
                </div>
            `;
            content.innerHTML = html;
            content.querySelector('#audioMaster').addEventListener('input', e => {
                _settings.audio.masterVolume = parseFloat(e.target.value);
                content.querySelector('#masterVal').textContent = Math.round(e.target.value*100) + '%';
                onSettingChange();
            });
            content.querySelector('#audioSfx').addEventListener('input', e => {
                _settings.audio.sfxVolume = parseFloat(e.target.value);
                content.querySelector('#sfxVal').textContent = Math.round(e.target.value*100) + '%';
                onSettingChange();
            });
            content.querySelector('#audioMusic').addEventListener('input', e => {
                _settings.audio.musicVolume = parseFloat(e.target.value);
                content.querySelector('#musicVal').textContent = Math.round(e.target.value*100) + '%';
                onSettingChange();
            });
        } else if (tab === 'gameplay') {
            html = `
                <h3 style="margin-top:0;color:#ff9800;">游戏设置</h3>
                <div style="padding:8px 0;display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" id="gpShowFPS" ${_settings.gameplay.showFPS?'checked':''}>
                    <label for="gpShowFPS">显示帧率（FPS）</label>
                </div>
                <div style="padding:8px 0;display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" id="gpAutoReload" ${_settings.gameplay.autoReload?'checked':''}>
                    <label for="gpAutoReload">弹匣为空时自动换弹</label>
                </div>
                <div style="padding:8px 0;display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" id="gpWheelSwitch" ${_settings.gameplay.wheelSwitchWeapon?'checked':''}>
                    <label for="gpWheelSwitch">鼠标滚轮切换武器</label>
                </div>
            `;
            content.innerHTML = html;
            content.querySelector('#gpShowFPS').addEventListener('change', e => { _settings.gameplay.showFPS = e.target.checked; onSettingChange(); });
            content.querySelector('#gpAutoReload').addEventListener('change', e => { _settings.gameplay.autoReload = e.target.checked; onSettingChange(); });
            content.querySelector('#gpWheelSwitch').addEventListener('change', e => { _settings.gameplay.wheelSwitchWeapon = e.target.checked; onSettingChange(); });
        }
    }

    function formatKeyName(code) {
        if (!code) return '未设置';
        return code.replace('Key', '').replace('Digit', '').replace('ShiftLeft', 'Shift').replace('ControlLeft', 'Ctrl').replace('Space', '空格');
    }

    // ========== 按键监听 ==========
    function handleKeyDown(e) {
        if (_listeningForKey) {
            e.preventDefault();
            e.stopPropagation();
            _settings.keyBindings[_listeningForKey] = e.code;
            _listeningForKey = null;
            renderSettingsTab('controls');
            return false;
        }
    }

    // ========== 暂停菜单 ==========
    function createPauseMenu() {
        if (_pauseMenu) return _pauseMenu;
        const menu = document.createElement('div');
        menu.id = 'pauseMenu';
        menu.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;justify-content:center;align-items:center;';
        menu.innerHTML = `
            <div style="background:#1a1a2e;padding:32px 48px;border-radius:12px;border:1px solid #333;text-align:center;min-width:300px;">
                <h2 style="color:#ff9800;margin:0 0 24px 0;">游戏暂停</h2>
                <button id="pauseResume" style="display:block;width:100%;padding:12px;margin:8px 0;background:#ff9800;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:16px;">继续游戏</button>
                <button id="pauseSettings" style="display:block;width:100%;padding:12px;margin:8px 0;background:#333;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:16px;">设置</button>
                <button id="pauseUnstuck" style="display:block;width:100%;padding:12px;margin:8px 0;background:#2196f3;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:16px;">脱离卡死</button>
                <button id="pauseAbandon" style="display:block;width:100%;padding:12px;margin:8px 0;background:#f44336;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:16px;">放弃战斗</button>
            </div>
        `;
        document.body.appendChild(menu);
        _pauseMenu = menu;

        menu.querySelector('#pauseResume').addEventListener('click', resumeGame);
        menu.querySelector('#pauseSettings').addEventListener('click', () => { closePauseMenu(); openSettings(); });
        menu.querySelector('#pauseUnstuck').addEventListener('click', () => {
            if (typeof unstuckPlayer === 'function') {
                unstuckPlayer();
                resumeGame();
            }
        });
        menu.querySelector('#pauseAbandon').addEventListener('click', () => {
            closePauseMenu();
            if (typeof abandonGame === 'function') abandonGame();
        });

        return menu;
    }

    function openPauseMenu() {
        createPauseMenu();
        _pauseMenu.style.display = 'flex';
        // 隐藏"点击画面开始游戏"提示
        const ctp = document.getElementById('clickToPlay');
        if (ctp) ctp.style.display = 'none';
        if (document.pointerLockElement) document.exitPointerLock();
    }

    function closePauseMenu() {
        if (_pauseMenu) _pauseMenu.style.display = 'none';
    }

    function resumeGame() {
        closePauseMenu();
        const canvas = document.getElementById('gameCanvas');
        if (canvas && typeof S !== 'undefined' && S.phase === 'playing') {
            canvas.requestPointerLock();
        }
    }

    // ========== 公开接口 ==========
    function openSettings() {
        createSettingsPanel();
        _settingsPanel.style.display = 'flex';
    }

    function closeSettings() {
        if (_settingsPanel) _settingsPanel.style.display = 'none';
    }

    function applySettings() {
        // 应用鼠标灵敏度到游戏
        if (typeof CONFIG !== 'undefined') {
            CONFIG.mouseSensitivity = _settings.mouse.sensitivity;
        }
        // 视野 FOV：与开镜系统共存，开镜倍率仍由 WeaponADS 控制
        if (typeof camera !== 'undefined' && camera && camera.isPerspectiveCamera) {
            const fov = _settings.graphics.fov || 78;
            if (Math.abs(camera.fov - fov) > 0.01) {
                camera.fov = fov;
                camera.updateProjectionMatrix();
            }
        }
        // 应用画质
        if (typeof renderer !== 'undefined' && renderer) {
            const brightness = _settings.graphics.brightness;
            const contrast = _settings.graphics.contrast;
            // 默认 1/1 时不要挂 CSS filter：它会强制额外合成层，低端设备上很贵
            renderer.domElement.style.filter = (brightness === 1 && contrast === 1)
                ? 'none'
                : `brightness(${brightness}) contrast(${contrast})`;

            // 同时承担画面与帧预算的模块，优先交给渲染管线统一处理
            if (typeof RenderPipeline !== 'undefined' && RenderPipeline.isEnabled()) {
                RenderPipeline.setPostEnabled(_settings.graphics.postFX !== false);
                RenderPipeline.setDynamicResolution(_settings.graphics.dynamicResolution !== false);
                RenderPipeline.applyQuality();
                console.log('[Settings] 设置已应用（RenderPipeline）');
                return;
            }

            // 应用画质等级（渲染管线不可用时的兜底路径）
            const quality = _settings.graphics.quality;
            if (quality === 'low') {
                renderer.setPixelRatio(1.0);
                renderer.shadowMap.enabled = false;
            } else if (quality === 'medium') {
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.PCFShadowMap;
            } else if (quality === 'high') {
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            }

            // 应用阴影质量（覆盖画质等级中的阴影设置）
            const shadowQuality = _settings.graphics.shadowQuality;
            if (shadowQuality === 'off') {
                renderer.shadowMap.enabled = false;
            } else if (shadowQuality === 'low') {
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.BasicShadowMap;
            } else if (shadowQuality === 'medium') {
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.PCFShadowMap;
            } else if (shadowQuality === 'high') {
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            }
        }
        if (_settings.graphics.performanceMode && typeof PerformanceGuard !== 'undefined' && PerformanceGuard.getLevel() < 3) {
            PerformanceGuard.forceLevel(3);
        }
        console.log('[Settings] 设置已应用');
    }

    function getKey(action) {
        return _settings.keyBindings[action] || DEFAULTS.keyBindings[action];
    }

    function getSettings() {
        return _settings;
    }

    // 全局按键监听（用于按键绑定）
    document.addEventListener('keydown', handleKeyDown, true);

    return {
        openSettings,
        closeSettings,
        openPauseMenu,
        closePauseMenu,
        resumeGame,
        applySettings,
        getKey,
        getSettings,
        isPauseOpen: () => _pauseMenu && _pauseMenu.style.display === 'flex',
    };
})();
