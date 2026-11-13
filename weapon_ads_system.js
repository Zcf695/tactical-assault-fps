// ============================================================
// 武器开镜系统 (Weapon Aim-Down-Sights System)
// 版本: 1.0
// 功能: 开镜/关镜动画、弹道散布区分、视野缩放、镜头晃动、UI反馈
// ============================================================

const WeaponADS = (function() {
    'use strict';

    // ========== 状态枚举 ==========
    const ADS_STATE = {
        IDLE: 'idle',           // 腰射
        AIMING_IN: 'aiming_in', // 正在开镜
        AIMED: 'aimed',         // 完全开镜
        AIMING_OUT: 'aiming_out' // 正在关镜
    };

    // ========== 瞄准镜类型配置 ==========
    const SCOPE_TYPES = {
        iron: {
            name: '机械瞄具',
            fov: 65,
            spreadMultiplier: 0.45,
            swayAmount: 0.003,
            adsTime: 0.25,
            overlay: 'iron_sights',
            moveSpeedMultiplier: 0.85
        },
        reddot: {
            name: '红点瞄准镜',
            fov: 70,
            spreadMultiplier: 0.35,
            swayAmount: 0.002,
            adsTime: 0.20,
            overlay: 'reddot',
            moveSpeedMultiplier: 0.88
        },
        holographic: {
            name: '全息瞄准镜',
            fov: 68,
            spreadMultiplier: 0.30,
            swayAmount: 0.002,
            adsTime: 0.22,
            overlay: 'holographic',
            moveSpeedMultiplier: 0.87
        },
        scope_2x: {
            name: '2倍瞄准镜',
            fov: 50,
            spreadMultiplier: 0.20,
            swayAmount: 0.004,
            adsTime: 0.35,
            overlay: 'scope_2x',
            moveSpeedMultiplier: 0.75
        },
        scope_4x: {
            name: '4倍瞄准镜',
            fov: 35,
            spreadMultiplier: 0.12,
            swayAmount: 0.006,
            adsTime: 0.45,
            overlay: 'scope_4x',
            moveSpeedMultiplier: 0.65
        },
        scope_8x: {
            name: '8倍瞄准镜',
            fov: 22,
            spreadMultiplier: 0.06,
            swayAmount: 0.010,
            adsTime: 0.60,
            overlay: 'scope_8x',
            moveSpeedMultiplier: 0.50
        },
        scope_12x: {
            name: '12倍瞄准镜',
            fov: 15,
            spreadMultiplier: 0.04,
            swayAmount: 0.015,
            adsTime: 0.75,
            overlay: 'scope_12x',
            moveSpeedMultiplier: 0.40
        }
    };

    // ========== 武器默认瞄准镜映射 ==========
    const WEAPON_DEFAULT_SCOPE = {
        // 手枪类 - 机械瞄具
        pistol: 'iron', compactPistol: 'iron', hcPistol: 'iron',
        revolver: 'iron', magnum: 'iron', deagle: 'iron',
        autoPistol: 'reddot', burstPistol: 'reddot',
        // 冲锋枪类 - 红点/全息
        smg: 'reddot', pdw: 'reddot', mp5: 'holographic',
        p90: 'holographic', vector: 'reddot', machinePistol: 'reddot', compactSMG: 'reddot',
        // 步枪类 - 全息/2倍
        rifle: 'holographic', carbine: 'holographic', ak: 'iron',
        hk416: 'holographic', battleRifle: 'scope_2x',
        // 精确射手/狙击类 - 高倍镜
        dmr: 'scope_4x', marksman: 'scope_4x',
        sniper: 'scope_8x', antiMat: 'scope_12x', antiMaterial: 'scope_12x',
        // 霰弹枪类 - 机械瞄具
        shotgun: 'iron', combatShotgun: 'reddot', autoShotgun: 'reddot',
        doubleBarrel: 'iron', heavyShotgun: 'iron',
        // 机枪类 - 2倍镜
        lmg: 'scope_2x', mmg: 'scope_2x', hmg: 'scope_4x',
        // 近战 - 无
        knife: null, baton: null, axe: null, sword: null, machete: null
    };

    // ========== 内部状态 ==========
    let _state = ADS_STATE.IDLE;
    let _aimProgress = 0; // 0=腰射, 1=完全开镜
    let _targetAim = 0;   // 目标开镜进度
    let _currentScope = null;
    let _currentWeaponKey = null;
    let _baseFov = 78;
    let _camera = null;
    let _weaponGroup = null;
    let _crosshairEl = null;
    let _scopeOverlayEl = null;
    let _swayOffsetX = 0;
    let _swayOffsetY = 0;
    let _weaponOffsetX = 0;
    let _weaponOffsetY = 0;
    let _weaponOffsetZ = 0;
    let _breathPhase = 0;
    let _isInitialized = false;
    let _holdToAim = true; // true=按住开镜, false=切换开镜
    let _moveSpeedMultiplier = 1.0;

    // ========== 武器位置偏移（weaponGroup相对于camera的偏移） ==========
    // 注意：武器模型在weaponGroup内部，body位置约(0.22,-0.25,-0.38)
    // 开镜设计原则：武器只轻微移动，主要靠FOV缩放实现瞄准放大效果
    // 偏移过大导致武器挡住屏幕中央视野，所以偏移量要小
    const WEAPON_IDLE_POS = { x: 0, y: 0, z: 0 };
    const WEAPON_AIM_POS = { x: -0.21, y: 0.155, z: 0.06 };
    const WEAPON_IDLE_ROT = { x: 0, y: 0, z: 0 };
    const WEAPON_AIM_ROT = { x: 0, y: 0, z: 0 };

    // ========== 初始化 ==========
    function init(camera, weaponGroup) {
        if (_isInitialized) return;
        _camera = camera;
        _weaponGroup = weaponGroup;
        _baseFov = camera.fov;
        _createUIElements();
        _isInitialized = true;
        console.log('[WeaponADS] 开镜系统初始化完成');
    }

    // ========== 创建UI元素 ==========
    function _createUIElements() {
        // 瞄准镜overlay容器
        _scopeOverlayEl = document.createElement('div');
        _scopeOverlayEl.id = 'scopeOverlay';
        _scopeOverlayEl.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none; z-index: 50; display: none;
        `;
        document.body.appendChild(_scopeOverlayEl);
    }

    // ========== 设置当前武器 ==========
    function setWeapon(weaponKey) {
        if (_currentWeaponKey === weaponKey) return;
        _currentWeaponKey = weaponKey;
        const scopeType = WEAPON_DEFAULT_SCOPE[weaponKey];
        _currentScope = scopeType ? SCOPE_TYPES[scopeType] : null;
        // 切换武器时自动关镜
        if (_state !== ADS_STATE.IDLE) {
            _targetAim = 0;
            _state = ADS_STATE.AIMING_OUT;
        }
        _updateScopeOverlay();
    }

    // ========== 开始开镜 ==========
    function startAim() {
        if (!_currentScope) return; // 近战武器不能开镜
        if (_state === ADS_STATE.AIMED || _state === ADS_STATE.AIMING_IN) return;
        _targetAim = 1;
        _state = ADS_STATE.AIMING_IN;
        _hideCrosshair();
    }

    // ========== 停止开镜 ==========
    function stopAim() {
        if (_state === ADS_STATE.IDLE || _state === ADS_STATE.AIMING_OUT) return;
        _targetAim = 0;
        _state = ADS_STATE.AIMING_OUT;
        _showCrosshair();
    }

    // ========== 切换开镜（点击模式） ==========
    function toggleAim() {
        if (_state === ADS_STATE.IDLE || _state === ADS_STATE.AIMING_OUT) {
            startAim();
        } else {
            stopAim();
        }
    }

    // ========== 是否开镜中（含过渡） ==========
    function isAiming() {
        return _aimProgress > 0.05;
    }

    // ========== 是否完全开镜 ==========
    function isFullyAimed() {
        return _state === ADS_STATE.AIMED;
    }

    // ========== 获取当前开镜进度 ==========
    function getAimProgress() {
        return _aimProgress;
    }

    // ========== 获取当前移动速度倍率 ==========
    function getMoveSpeedMultiplier() {
        return _moveSpeedMultiplier;
    }

    // ========== 获取当前弹道散布倍率 ==========
    function getSpreadMultiplier() {
        if (!_currentScope) return 1.0;
        // 线性插值：腰射1.0 -> 开镜spreadMultiplier
        return 1.0 - _aimProgress * (1.0 - _currentScope.spreadMultiplier);
    }

    // ========== 获取当前后坐力倍率（开镜时后坐力更小） ==========
    function getRecoilMultiplier() {
        if (!_currentScope) return 1.0;
        return 1.0 - _aimProgress * 0.4; // 开镜时后坐力降低40%
    }

    // ========== 每帧更新 ==========
    function update(deltaTime) {
        if (!_isInitialized || !_currentScope) return;

        const adsTime = _currentScope.adsTime;
        const speed = deltaTime / adsTime;

        // 平滑过渡开镜进度
        if (_aimProgress < _targetAim) {
            _aimProgress = Math.min(_targetAim, _aimProgress + speed);
        } else if (_aimProgress > _targetAim) {
            _aimProgress = Math.max(_targetAim, _aimProgress - speed);
        }

        // 状态转换
        if (_state === ADS_STATE.AIMING_IN && _aimProgress >= 1.0) {
            _state = ADS_STATE.AIMED;
        } else if (_state === ADS_STATE.AIMING_OUT && _aimProgress <= 0.0) {
            _state = ADS_STATE.IDLE;
        }

        // 相机FOV缩放
        const targetFov = _baseFov - _aimProgress * (_baseFov - _currentScope.fov);
        _camera.fov += (targetFov - _camera.fov) * Math.min(1, deltaTime * 15);
        _camera.updateProjectionMatrix();

        // 武器位置偏移（由animation_enhancement.js叠加应用，避免冲突）
        // 开镜时从腰射位置(0,0,0)移到瞄准位置(-0.22,0.22,0.18)
        const t = _easeInOutCubic(_aimProgress);
        // 优先使用当前视模自带的瞄具对齐偏移（每种枪的瞄具高度不同）
        const custom = (typeof weaponGroup !== 'undefined' && weaponGroup && weaponGroup.userData && weaponGroup.userData.adsOffset) || null;
        const aimPos = custom || WEAPON_AIM_POS;
        _weaponOffsetX = aimPos.x * t;
        _weaponOffsetY = aimPos.y * t;
        _weaponOffsetZ = aimPos.z * t;
        // 注意：不直接设置weaponGroup.position，由animation_enhancement.js的applyWeaponTransform统一应用

        // 呼吸晃动（开镜时更明显，模拟手持瞄准的不稳定）
        _breathPhase += deltaTime * 1.5; // 呼吸频率
        const breathAmount = _currentScope.swayAmount * _aimProgress;
        const targetSwayX = Math.sin(_breathPhase) * breathAmount;
        const targetSwayY = Math.cos(_breathPhase * 0.7) * breathAmount * 0.6;
        _swayOffsetX += (targetSwayX - _swayOffsetX) * Math.min(1, deltaTime * 8);
        _swayOffsetY += (targetSwayY - _swayOffsetY) * Math.min(1, deltaTime * 8);

        // 应用晃动到相机（轻微旋转）
        if (_aimProgress > 0.1) {
            _camera.rotation.z = _swayOffsetX * 0.3;
        } else {
            _camera.rotation.z = 0;
        }

        // 移动速度倍率
        _moveSpeedMultiplier = 1.0 - _aimProgress * (1.0 - _currentScope.moveSpeedMultiplier);

        // 更新overlay显示
        _updateScopeOverlay();
    }

    // ========== 缓动函数 ==========
    function _easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // ========== 更新瞄准镜overlay ==========
    function _updateScopeOverlay() {
        if (!_scopeOverlayEl) return;
        if (_aimProgress < 0.1 || !_currentScope || !_currentScope.overlay) {
            _scopeOverlayEl.style.display = 'none';
            return;
        }
        _scopeOverlayEl.style.display = 'block';
        _scopeOverlayEl.style.opacity = _aimProgress;

        const scopeType = _currentScope.overlay;
        let html = '';

        if (scopeType === 'iron_sights') {
            // 机械瞄具：简化版小准星（前准星柱+中心点）
            html = `
                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);">
                    <div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);
                        width:2px;height:12px;background:#111;border:1px solid #333;"></div>
                    <div style="position:absolute;top:-1px;left:50%;transform:translateX(-50%);
                        width:4px;height:4px;background:#222;border-radius:50%;border:1px solid #444;"></div>
                </div>`;
        } else if (scopeType === 'reddot') {
            // 红点：中心红点
            html = `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                width:8px;height:8px;border-radius:50%;
                background:radial-gradient(circle,#ff2222 0%,#ff0000 40%,rgba(255,0,0,0) 70%);
                box-shadow:0 0 10px #ff0000;"></div>`;
        } else if (scopeType === 'holographic') {
            // 全息：绿色圆环+中心点
            html = `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                width:40px;height:40px;border:2px solid rgba(0,255,100,0.8);border-radius:50%;
                box-shadow:0 0 15px rgba(0,255,100,0.5);"></div>
                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                width:4px;height:4px;border-radius:50%;background:#00ff66;
                box-shadow:0 0 8px #00ff66;"></div>`;
        } else if (scopeType.startsWith('scope_')) {
            // 高倍镜：仅十字线+中心点（取消黑色遮罩，避免挡视野）
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            html = `
                <div style="position:absolute;top:${centerY}px;left:0;width:100%;height:1px;
                    background:rgba(0,0,0,0.6);"></div>
                <div style="position:absolute;top:0;left:${centerX}px;width:1px;height:100%;
                    background:rgba(0,0,0,0.6);"></div>
                <div style="position:absolute;top:${centerY - 3}px;left:${centerX - 3}px;
                    width:6px;height:6px;border:1px solid rgba(0,0,0,0.7);border-radius:50%;"></div>
            `;
        }

        _scopeOverlayEl.innerHTML = html;
    }

    // ========== 隐藏准星 ==========
    function _hideCrosshair() {
        const crosshair = document.getElementById('crosshair');
        if (crosshair) crosshair.style.display = 'none';
    }

    // ========== 显示准星 ==========
    function _showCrosshair() {
        const crosshair = document.getElementById('crosshair');
        if (crosshair) crosshair.style.display = 'block';
    }

    // ========== 设置开镜模式 ==========
    function setHoldToAim(hold) {
        _holdToAim = hold;
    }

    function isHoldToAim() {
        return _holdToAim;
    }

    // ========== 获取当前瞄准镜信息 ==========
    function getCurrentScope() {
        return _currentScope;
    }

    // ========== 获取所有瞄准镜类型 ==========
    function getAllScopeTypes() {
        return SCOPE_TYPES;
    }

    // ========== 重置（切换地图/死亡时） ==========
    function reset() {
        _state = ADS_STATE.IDLE;
        _aimProgress = 0;
        _targetAim = 0;
        _swayOffsetX = 0;
        _swayOffsetY = 0;
        _moveSpeedMultiplier = 1.0;
        if (_camera) {
            _camera.fov = _baseFov;
            _camera.updateProjectionMatrix();
            _camera.rotation.z = 0;
        }
        if (_weaponGroup) {
            _weaponGroup.position.set(0, 0, 0);
            _weaponGroup.rotation.set(0, 0, 0);
        }
        _showCrosshair();
        if (_scopeOverlayEl) _scopeOverlayEl.style.display = 'none';
    }

    // ========== 公共API ==========
    return {
        ADS_STATE,
        SCOPE_TYPES,
        init,
        setWeapon,
        startAim,
        stopAim,
        toggleAim,
        isAiming,
        isFullyAimed,
        getAimProgress,
        getMoveSpeedMultiplier,
        getSpreadMultiplier,
        getRecoilMultiplier,
        getWeaponOffset: function() {
            return { x: _weaponOffsetX, y: _weaponOffsetY, z: _weaponOffsetZ };
        },
        update,
        reset,
        setHoldToAim,
        isHoldToAim,
        getCurrentScope,
        getAllScopeTypes
    };
})();

// 兼容全局访问
if (typeof window !== 'undefined') {
    window.WeaponADS = WeaponADS;
}
