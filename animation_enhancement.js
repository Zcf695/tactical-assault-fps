/**
 * animation_enhancement.js
 * 第一人称武器动画系统增强
 *
 * 设计原则：
 * - weaponGroup 基础位置为 (0,0,0)，武器部件自身 position 处理基础偏移
 * - 所有动画只做 delta 偏移，不覆盖基础位置 → 修复武器"缩小"问题
 * - 第一人称武器 castShadow=false → 修复多重阴影问题
 *
 * 功能：
 * 1. idle 呼吸动画
 * 2. 行走/奔跑/冲刺摆动（与速度、方向联动）
 * 3. 后坐力系统（主后坐力+次后坐力+阻尼恢复）
 * 4. 三段式换弹动画
 * 5. 受击反馈（相机震动+武器抖动，与伤害成正比）
 * 6. 跳跃/落地动作
 * 7. V键武器检视（360°旋转）
 */

const PlayerAnimation = (function () {
    // ========== 状态变量 ==========
    let _idleTime = 0;
    let _bobTime = 0;

    // 屏幕震动
    let _shakeX = 0, _shakeY = 0;
    let _shakeDecay = 0.88;

    // 后坐力
    let _recoilPitch = 0;      // 主后坐力（枪口上抬，rotation.x）
    let _recoilYaw = 0;        // 次后坐力（水平偏移，rotation.y）
    let _recoilKick = 0;       // 后坐力位移（position.z，武器后移）
    let _recoilDecay = 0.82;   // 阻尼系数

    // 武器摆动目标（delta，基于0点）
    let _bobOffsetX = 0, _bobOffsetY = 0, _bobOffsetZ = 0;
    let _bobRotX = 0, _bobRotY = 0, _bobRotZ = 0;

    // 换弹动画
    let _reloadTime = 0;
    let _reloadDuration = 0;
    let _isReloading = false;

    // 检视动画
    let _isInspecting = false;
    let _inspectTime = 0;

    // 跳跃/落地
    let _wasInAir = false;
    let _landTimer = 0;
    let _jumpOffset = 0;

    // 受击武器抖动
    let _hitShakeX = 0, _hitShakeY = 0;
    let _hitShakeDecay = 0.8;

    // 切枪抬枪动画
    let _switchTime = 0;
    const SWITCH_DUR = 0.34;

    // 相机后坐力（叠加在鼠标俯仰上，独立衰减）
    let _camKickPitch = 0, _camKickYaw = 0;

    // 相机基础位置（用于震动后恢复）
    const _camBaseY = 1.7;

    // ========== 工具函数 ==========
    function lerp(a, b, t) { return a + (b - a) * t; }
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function damp(current, target, lambda, dt) {
        return lerp(current, target, 1 - Math.exp(-lambda * dt));
    }

    // ========== 屏幕震动 ==========
    function screenShake(amount) {
        _shakeX = Math.max(_shakeX, (Math.random() - 0.5) * amount * 2);
        _shakeY = Math.max(_shakeY, (Math.random() - 0.5) * amount * 2);
    }

    function updateScreenShake(dt) {
        if (Math.abs(_shakeX) > 0.001 || Math.abs(_shakeY) > 0.001) {
            // 基于当前相机高度叠加震动（不覆盖蹲伏视角）
            camera.position.x = _shakeX;
            camera.position.y += _shakeY;
            _shakeX *= _shakeDecay;
            _shakeY *= _shakeDecay;
        } else {
            // 震动结束时不重置y，让蹲伏逻辑控制高度
            camera.position.x = 0;
            _shakeX = 0; _shakeY = 0;
        }
    }

    // ========== 后坐力系统 ==========
    /**
     * 应用后坐力
     * @param {number} amount - 后坐力强度（与武器类型成正比）
     */
    function applyRecoil(amount) {
        // 主后坐力：枪口上抬
        _recoilPitch += amount * 0.4;
        // 次后坐力：随机水平偏移
        _recoilYaw += (Math.random() - 0.5) * amount * 0.25;
        // 武器后移
        _recoilKick += amount * 0.15;

        // 相机后坐力：枪口上抬的同时视线也被顶一下
        _camKickPitch += amount * 0.55;
        _camKickYaw += (Math.random() - 0.5) * amount * 0.35;

        // 限制最大值
        _recoilPitch = clamp(_recoilPitch, 0, 0.2);
        _recoilYaw = clamp(_recoilYaw, -0.1, 0.1);
        _recoilKick = clamp(_recoilKick, 0, 0.08);
        _camKickPitch = clamp(_camKickPitch, 0, 0.09);
        _camKickYaw = clamp(_camKickYaw, -0.05, 0.05);
    }

    function updateRecoil(dt) {
        // 阻尼恢复：平滑逐步回归中立位置
        _recoilPitch = damp(_recoilPitch, 0, 8, dt);
        _recoilYaw = damp(_recoilYaw, 0, 8, dt);
        _recoilKick = damp(_recoilKick, 0, 10, dt);

        if (Math.abs(_recoilPitch) < 0.0005) _recoilPitch = 0;
        if (Math.abs(_recoilYaw) < 0.0005) _recoilYaw = 0;
        if (Math.abs(_recoilKick) < 0.0005) _recoilKick = 0;

        _camKickPitch = damp(_camKickPitch, 0, 7, dt);
        _camKickYaw = damp(_camKickYaw, 0, 7, dt);
        if (Math.abs(_camKickPitch) < 0.0002) _camKickPitch = 0;
        if (Math.abs(_camKickYaw) < 0.0002) _camKickYaw = 0;
    }

    // ========== 武器摆动（idle + 移动） ==========
    // 检视动画关键帧：抬枪 → 看左侧 → 看右侧与顶部 → 回位
    const INSPECT_KEYS = [
        { t: 0.00, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 },
        { t: 0.14, x: -0.05, y: 0.02, z: 0.02, rx: -0.16, ry: 0.02, rz: 0.06 },
        { t: 0.38, x: -0.06, y: 0.00, z: 0.03, rx: -0.04, ry: -0.88, rz: 0.24 },
        { t: 0.62, x: -0.05, y: 0.01, z: 0.03, rx: 0.22, ry: 0.86, rz: -0.18 },
        { t: 0.82, x: -0.02, y: 0.01, z: 0.01, rx: 0.04, ry: 0.10, rz: 0.02 },
        { t: 1.00, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 },
    ];
    function sampleInspect(t) {
        let a = INSPECT_KEYS[0], b = INSPECT_KEYS[INSPECT_KEYS.length - 1];
        for (let i = 0; i < INSPECT_KEYS.length - 1; i++) {
            if (t >= INSPECT_KEYS[i].t && t <= INSPECT_KEYS[i + 1].t) {
                a = INSPECT_KEYS[i]; b = INSPECT_KEYS[i + 1];
                break;
            }
        }
        const span = (b.t - a.t) || 1;
        let k = clamp((t - a.t) / span, 0, 1);
        k = k * k * (3 - 2 * k);
        return {
            x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k),
            rx: lerp(a.rx, b.rx, k), ry: lerp(a.ry, b.ry, k), rz: lerp(a.rz, b.rz, k),
        };
    }

    // 冲刺姿态混合（枪口下压、枪身外倾）
    let _sprintBlend = 0;

    function updateWeaponBob(dt, isMoving, isSprinting, isCrouching, isInAir, moveSpeed) {
        _idleTime += dt;

        // 目标delta偏移（基于weaponGroup原点0,0,0）
        let targetX = 0, targetY = 0, targetZ = 0;
        let targetRotX = 0, targetRotY = 0, targetRotZ = 0;

        if (_isInspecting) {
            // 检视动画：分解动作，而不是整体旋转一圈
            _inspectTime += dt;
            const totalDur = 4.0;
            const t = clamp(_inspectTime / totalDur, 0, 1);
            const k = sampleInspect(t);
            _bobOffsetX = damp(_bobOffsetX, k.x, 12, dt);
            _bobOffsetY = damp(_bobOffsetY, k.y, 12, dt);
            _bobOffsetZ = damp(_bobOffsetZ, k.z, 12, dt);
            _bobRotX = damp(_bobRotX, k.rx, 12, dt);
            _bobRotY = damp(_bobRotY, k.ry, 12, dt);
            _bobRotZ = damp(_bobRotZ, k.rz, 12, dt);

            if (_inspectTime >= totalDur) {
                _isInspecting = false;
                _inspectTime = 0;
            }
            return;
        }

        // 冲刺姿态：开镜时不生效，避免与 ADS 偏移打架
        const aiming = typeof WeaponADS !== 'undefined' && WeaponADS.isAiming && WeaponADS.isAiming();
        const wantSprint = isSprinting && !aiming;
        _sprintBlend = damp(_sprintBlend, wantSprint ? 1 : 0, 8, dt);

        if (isInAir) {
            // 跳跃中：武器向上抬起，跟随缓冲
            _jumpOffset = damp(_jumpOffset, 0.04, 6, dt);
            targetY = _jumpOffset;
            targetRotX = -0.08;
        } else if (_landTimer > 0) {
            // 刚落地：武器下沉 + 回弹
            _landTimer -= dt;
            const landT = clamp(_landTimer / 0.25, 0, 1);
            // 下沉然后回弹
            const bounce = Math.sin(landT * Math.PI) * 0.04;
            targetY = -bounce;
            targetRotX = landT * 0.12;
            _jumpOffset = 0;
        } else if (isMoving) {
            _jumpOffset = 0;
            // 移动摆动：与速度、方向联动
            _bobTime += dt;
            // 速度因子：0~1
            const speedFactor = clamp(moveSpeed / 8, 0.3, 1);
            const bobFreq = isSprinting ? 14 : (isCrouching ? 5 : 9);
            const bobAmp = isSprinting ? 0.022 : (isCrouching ? 0.006 : 0.012) * speedFactor;
            const sideAmp = isSprinting ? 0.016 : 0.008 * speedFactor;
            const rotAmp = isSprinting ? 0.025 : 0.012 * speedFactor;

            const t = _bobTime * bobFreq;
            // 上下浮动
            targetY = Math.sin(t) * bobAmp;
            // 水平摆动（与移动方向联动）
            targetX = Math.cos(t * 0.5) * sideAmp;
            // 旋转摆动（模拟重量感）
            targetRotZ = Math.sin(t * 0.5) * rotAmp;
            targetRotX = Math.abs(Math.sin(t)) * bobAmp * 0.5;

            // 冲刺时额外相机抖动
            if (isSprinting) {
                screenShake(0.015);
            }
        } else {
            // idle 呼吸动画：细微垂直浮动
            _jumpOffset = 0;
            const breath = Math.sin(_idleTime * 1.3) * 0.004;
            const breathX = Math.sin(_idleTime * 0.7) * 0.0015;
            targetY = breath;
            targetX = breathX;
            targetRotZ = Math.sin(_idleTime * 0.9) * 0.002;
        }

        // 切枪：先下压再抬起
        if (_switchTime > 0) {
            _switchTime -= dt;
            const k = clamp(_switchTime / SWITCH_DUR, 0, 1);
            targetY -= 0.26 * k;
            targetZ += 0.05 * k;
            targetRotX += 0.55 * k;
            targetRotZ -= 0.18 * k;
        }

        // 冲刺时枪口下压、枪身外倾，形成明显的移动姿态
        if (_sprintBlend > 0.001) {
            targetY -= 0.048 * _sprintBlend;
            targetX += 0.032 * _sprintBlend;
            targetRotX += 0.24 * _sprintBlend;
            targetRotZ -= 0.34 * _sprintBlend;
            targetRotY += 0.14 * _sprintBlend;
        }

        // 平滑插值（模拟重量感与运动惯性）
        const smooth = 1 - Math.exp(-12 * dt);
        _bobOffsetX = lerp(_bobOffsetX, targetX, smooth);
        _bobOffsetY = lerp(_bobOffsetY, targetY, smooth);
        _bobOffsetZ = lerp(_bobOffsetZ, targetZ, smooth);
        _bobRotX = lerp(_bobRotX, targetRotX, smooth);
        _bobRotY = lerp(_bobRotY, targetRotY, smooth);
        _bobRotZ = lerp(_bobRotZ, targetRotZ, smooth);
    }

    // ========== 三段式换弹动画 ==========
    function startReloadAnimation(duration) {
        _isReloading = true;
        _reloadTime = 0;
        _reloadDuration = duration;
    }

    function updateReloadAnimation(dt) {
        if (!_isReloading) return false;
        _reloadTime += dt;
        const t = clamp(_reloadTime / _reloadDuration, 0, 1);

        // 三段式：向下位移 → 旋转检视 → 复位
        let dropY = 0, dropZ = 0, rotX = 0, rotZ = 0;

        if (t < 0.3) {
            // 阶段1：向下位移（0~30%）
            const p = t / 0.3;
            const ease = p * p * (3 - 2 * p);  // smoothstep
            dropY = -0.12 * ease;
            dropZ = 0.04 * ease;
            rotX = 0.4 * ease;
        } else if (t < 0.7) {
            // 阶段2：旋转检视（30%~70%）
            const p = (t - 0.3) / 0.4;
            dropY = -0.12;
            dropZ = 0.04;
            rotX = 0.4 + Math.sin(p * Math.PI) * 0.2;
            rotZ = Math.sin(p * Math.PI * 2) * 0.15;
        } else {
            // 阶段3：复位至待击位置（70%~100%）
            const p = (t - 0.7) / 0.3;
            const ease = p * p * (3 - 2 * p);
            dropY = -0.12 * (1 - ease);
            dropZ = 0.04 * (1 - ease);
            rotX = 0.4 * (1 - ease);
            rotZ = 0;
        }

        // 直接覆盖摆动偏移（换弹期间优先级最高）
        _bobOffsetY = dropY;
        _bobOffsetZ = dropZ;
        _bobRotX = rotX;
        _bobRotZ = rotZ;
        _bobOffsetX = damp(_bobOffsetX, 0, 8, dt);
        _bobRotY = damp(_bobRotY, 0, 8, dt);

        if (t >= 1) {
            _isReloading = false;
            _bobOffsetY = 0; _bobOffsetZ = 0;
            _bobRotX = 0; _bobRotZ = 0;
        }
        return true;
    }

    // ========== 受击反馈 ==========
    function onPlayerHit(damage) {
        // 受击时自动关闭 3D 检视，避免玩家在看模型时被白白打死
        if (typeof InspectViewer !== 'undefined' && InspectViewer.isOpen && InspectViewer.isOpen()) {
            InspectViewer.close();
        }
        // 相机震动：与伤害强度成正比
        const shakeAmount = clamp(damage * 0.015, 0.02, 0.25);
        screenShake(shakeAmount);
        // 武器抖动：短促剧烈位移
        _hitShakeX = (Math.random() - 0.5) * clamp(damage * 0.008, 0.01, 0.08);
        _hitShakeY = (Math.random() - 0.5) * clamp(damage * 0.008, 0.01, 0.08);
    }

    function updateHitShake(dt) {
        if (Math.abs(_hitShakeX) > 0.0005 || Math.abs(_hitShakeY) > 0.0005) {
            _hitShakeX *= _hitShakeDecay;
            _hitShakeY *= _hitShakeDecay;
        } else {
            _hitShakeX = 0; _hitShakeY = 0;
        }
    }

    // ========== 武器检视 ==========
    function toggleInspect() {
        if (_isInspecting || _isReloading) return;
        _isInspecting = true;
        _inspectTime = 0;
    }

    function playSwitch() {
        _switchTime = SWITCH_DUR;
        _isInspecting = false;
    }

    /** 相机后坐力：由 updatePlayer 叠加到 mouseY 上 */
    function getCameraKick() {
        return { pitch: _camKickPitch, yaw: _camKickYaw };
    }

    // ========== 应用所有变换到 weaponGroup ==========
    function applyWeaponTransform() {
        // 开镜位置偏移
        let adsX = 0, adsY = 0, adsZ = 0;
        if (typeof WeaponADS !== 'undefined') {
            const off = WeaponADS.getWeaponOffset();
            adsX = off.x; adsY = off.y; adsZ = off.z;
        }
        // 基础位置(0,0,0) + 开镜偏移 + 摆动偏移 + 后坐力位移 + 受击抖动
        weaponGroup.position.x = adsX + _bobOffsetX + _hitShakeX;
        weaponGroup.position.y = adsY + _bobOffsetY + _hitShakeY;
        weaponGroup.position.z = adsZ + _bobOffsetZ + _recoilKick;

        // 旋转：摆动 + 后坐力
        weaponGroup.rotation.x = _bobRotX + _recoilPitch;
        weaponGroup.rotation.y = _bobRotY + _recoilYaw;
        weaponGroup.rotation.z = _bobRotZ;
    }

    // ========== 主更新函数（每帧调用） ==========
    function update(dt) {
        if (typeof S === 'undefined' || S.phase !== 'playing') return;
        if (typeof weaponGroup === 'undefined' || !weaponGroup) return;

        // 计算移动状态
        const velX = S._velX || 0;
        const velZ = S._velZ || 0;
        const moveSpeed = Math.sqrt(velX * velX + velZ * velZ);
        const isMoving = moveSpeed > 0.1;
        // 键盘事件记录的是 ShiftLeft/ShiftRight，不存在 'Shift' 键码
        const isSprinting = !!(keys && (keys['ShiftLeft'] || keys['ShiftRight'])) && isMoving;
        const isCrouching = S.isCrouching || false;
        const isInAir = typeof playerGroup !== 'undefined' && playerGroup && playerGroup.position.y > 0.05;

        // 落地检测
        if (isInAir) {
            _wasInAir = true;
        } else if (_wasInAir) {
            _landTimer = 0.25;
            _wasInAir = false;
            // 落地撞击相机震动
            screenShake(0.06);
        }

        // 换弹动画优先级最高
        if (!updateReloadAnimation(dt)) {
            // 武器摆动（idle/移动/跳跃/落地）
            updateWeaponBob(dt, isMoving, isSprinting, isCrouching, isInAir, moveSpeed);
            // 后坐力恢复
            updateRecoil(dt);
        }

        // 受击武器抖动
        updateHitShake(dt);

        // 应用所有变换
        applyWeaponTransform();

        // 屏幕震动
        updateScreenShake(dt);
    }

    return {
        update,
        screenShake,
        applyRecoil,
        startReloadAnimation,
        toggleInspect,
        playSwitch,
        getCameraKick,
        onPlayerHit,
        isReloading: () => _isReloading,
    };
})();
