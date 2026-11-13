// ============================================================
// BOSS系统V2 - 扩展版
// 功能: 5种BOSS + 技能系统 + 多阶段 + 顶部血条UI + 小兵装备 + AI优化 + 任务链 + 音乐 + 击杀结算
// ============================================================

const BossSystemV2 = (function() {
    'use strict';

    // ========== 状态变量 ==========
    let _activeBoss = null;       // 当前激活的BOSS（用于顶部血条）
    let _bossHealthBarEl = null;  // 顶部血条DOM元素
    let _bossMusicAudio = null;    // BOSS战音乐
    let _musicVolume = 0.0;        // 当前音乐音量
    let _targetMusicVolume = 0.0;  // 目标音乐音量
    let _bossKillCamera = null;    // 击杀特写相机状态
    let _isKillCamActive = false;  // 是否正在播放击杀特写
    let _initialized = false;

    // ========== BOSS音乐文件夹配置 ==========
    const BOSS_MUSIC_FOLDER = 'audio/boss_music/';
    const BOSS_MUSIC_FILES = {
        'forest_hunter': 'forest_hunter_battle.mp3',
        'industrial_juggernaut': 'industrial_juggernaut_battle.mp3',
        'military_commander': 'military_commander_battle.mp3',
        'port_colossus': 'port_colossus_battle.mp3',
        'forest_shaman': 'forest_shaman_battle.mp3'
    };

    // ============================================================
    // 一、5种BOSS配置
    // ============================================================
    const BOSS_CONFIG_V2 = {
        // ========== BOSS 1: 森林猎手（敏捷型） ==========
        'forest_hunter': {
            name: '森林猎手·暗影',
            title: '密林之中的无声杀戮者',
            icon: '🏹',
            themeColor: 0x2d5a27,
            accentColor: 0x88ff44,
            health: 1200,
            damage: 22,
            speed: 5.5,
            attackRange: 30,
            attackCd: 1.2,
            modelType: 'hunter',
            phases: [
                { threshold: 1.0, name: '第一阶段：猎手警戒', skillSet: ['rapid_shot', 'trap_throw'] },
                { threshold: 0.65, name: '第二阶段：暗影潜行', skillSet: ['rapid_shot', 'trap_throw', 'shadow_step', 'poison_arrow'] },
                { threshold: 0.35, name: '第三阶段：狂暴猎杀', skillSet: ['rapid_shot', 'shadow_step', 'poison_arrow', 'fury_volley'] }
            ],
            skills: {
                rapid_shot: { name: '连射', damage: 15, cd: 3.0, castTime: 0.8, range: 35, color: 0x88ff44, desc: '快速射出3支箭矢' },
                trap_throw: { name: '投掷陷阱', damage: 25, cd: 6.0, castTime: 1.0, range: 20, color: 0xffaa00, desc: '在玩家位置投掷陷阱，2秒后爆炸' },
                shadow_step: { name: '暗影步', damage: 0, cd: 8.0, castTime: 0.5, range: 15, color: 0x9944ff, desc: '瞬移到玩家身后并进入潜行' },
                poison_arrow: { name: '毒箭', damage: 10, cd: 5.0, castTime: 1.2, range: 40, color: 0x44ff88, desc: '射出毒箭，造成持续伤害' },
                fury_volley: { name: '狂暴箭雨', damage: 8, cd: 12.0, castTime: 2.0, range: 50, color: 0xff4444, desc: '向天空射出箭雨，覆盖大范围区域' }
            }
        },

        // ========== BOSS 2: 工业铁卫（重装型） ==========
        'industrial_juggernaut': {
            name: '工业铁卫·壁垒',
            title: '永不陷落的钢铁要塞',
            icon: '🛡️',
            themeColor: 0x3a3a4a,
            accentColor: 0x00ccff,
            health: 2000,
            damage: 30,
            speed: 2.5,
            attackRange: 25,
            attackCd: 1.8,
            modelType: 'juggernaut',
            hasShield: true,
            shieldHealth: 500,
            phases: [
                { threshold: 1.0, name: '第一阶段：护盾巡航', skillSet: ['shield_bash', 'heavy_slam'] },
                { threshold: 0.70, name: '第二阶段：护盾破损', skillSet: ['shield_bash', 'heavy_slam', 'missile_barrage', 'ground_pound'] },
                { threshold: 0.40, name: '第三阶段：过载模式', skillSet: ['heavy_slam', 'missile_barrage', 'ground_pound', 'overdrive_charge'] }
            ],
            skills: {
                shield_bash: { name: '盾击', damage: 35, cd: 4.0, castTime: 0.8, range: 8, color: 0x00ccff, desc: '用护盾猛击前方玩家' },
                heavy_slam: { name: '重锤猛击', damage: 45, cd: 5.0, castTime: 1.2, range: 10, color: 0xff8800, desc: '举起重锤砸向地面，造成范围伤害' },
                missile_barrage: { name: '导弹齐射', damage: 20, cd: 8.0, castTime: 1.5, range: 40, color: 0xff4400, desc: '发射多枚追踪导弹' },
                ground_pound: { name: '地震冲击', damage: 30, cd: 10.0, castTime: 1.8, range: 25, color: 0xaa8844, desc: '重击地面产生冲击波，击退玩家' },
                overdrive_charge: { name: '过载冲锋', damage: 55, cd: 15.0, castTime: 1.0, range: 30, color: 0xff0000, desc: '进入过载状态，高速冲撞玩家' }
            }
        },

        // ========== BOSS 3: 军事指挥官（指挥型） ==========
        'military_commander': {
            name: '军事指挥官·烈阳',
            title: '统御战场的铁血战术家',
            icon: '🎖️',
            themeColor: 0x4a1a1a,
            accentColor: 0xff2222,
            health: 1600,
            damage: 28,
            speed: 3.5,
            attackRange: 28,
            attackCd: 1.5,
            modelType: 'commander',
            canSummon: true,
            phases: [
                { threshold: 1.0, name: '第一阶段：战术指挥', skillSet: ['precision_shot', 'smoke_grenade'] },
                { threshold: 0.65, name: '第二阶段：增援呼叫', skillSet: ['precision_shot', 'smoke_grenade', 'call_reinforcements', 'grenade_throw'] },
                { threshold: 0.35, name: '第三阶段：最后决战', skillSet: ['precision_shot', 'call_reinforcements', 'grenade_throw', 'airstrike'] }
            ],
            skills: {
                precision_shot: { name: '精准射击', damage: 40, cd: 3.5, castTime: 1.0, range: 50, color: 0xff2222, desc: '瞄准玩家头部进行精准射击' },
                smoke_grenade: { name: '烟雾弹', damage: 0, cd: 7.0, castTime: 0.8, range: 25, color: 0x888888, desc: '投掷烟雾弹，遮蔽视野并移动到新位置' },
                call_reinforcements: { name: '呼叫增援', damage: 0, cd: 15.0, castTime: 2.0, range: 0, color: 0xffaa00, desc: '呼叫2-3名精英士兵增援' },
                grenade_throw: { name: '手雷投掷', damage: 35, cd: 6.0, castTime: 1.0, range: 30, color: 0x44aa44, desc: '投掷手雷，造成范围爆炸伤害' },
                airstrike: { name: '呼叫空袭', damage: 50, cd: 20.0, castTime: 3.0, range: 60, color: 0xff0000, desc: '呼叫空袭，对大范围区域进行轰炸' }
            }
        },

        // ========== BOSS 4: 港口巨像（机械型） ==========
        'port_colossus': {
            name: '港口巨像·深渊',
            title: '从海底苏醒的远古机械',
            icon: '⚙️',
            themeColor: 0x1a3a4a,
            accentColor: 0x00ffaa,
            health: 2500,
            damage: 35,
            speed: 2.0,
            attackRange: 35,
            attackCd: 2.0,
            modelType: 'colossus',
            phases: [
                { threshold: 1.0, name: '第一阶段：系统启动', skillSet: ['laser_beam', 'rocket_punch'] },
                { threshold: 0.70, name: '第二阶段：武器解锁', skillSet: ['laser_beam', 'rocket_punch', 'tesla_coil', 'missile_rain'] },
                { threshold: 0.40, name: '第三阶段：核心过载', skillSet: ['laser_beam', 'tesla_coil', 'missile_rain', 'core_explosion'] }
            ],
            skills: {
                laser_beam: { name: '激光束', damage: 25, cd: 4.0, castTime: 1.5, range: 60, color: 0x00ffaa, desc: '从眼部发射持续激光束' },
                rocket_punch: { name: '火箭飞拳', damage: 45, cd: 6.0, castTime: 1.0, range: 35, color: 0xff6600, desc: '发射火箭推进的拳头攻击' },
                tesla_coil: { name: '特斯拉线圈', damage: 20, cd: 8.0, castTime: 1.2, range: 30, color: 0x4488ff, desc: '释放电弧，连锁攻击附近目标' },
                missile_rain: { name: '导弹雨', damage: 15, cd: 10.0, castTime: 2.0, range: 50, color: 0xff4444, desc: '从背部发射大量导弹覆盖区域' },
                core_explosion: { name: '核心爆发', damage: 60, cd: 18.0, castTime: 2.5, range: 40, color: 0xffff00, desc: '核心过载释放能量波，造成巨大范围伤害' }
            }
        },

        // ========== BOSS 5: 密林祭司（法术型） ==========
        'forest_shaman': {
            name: '密林祭司·毒藤',
            title: '被森林吞噬的堕落萨满',
            icon: '🌿',
            themeColor: 0x2a4a1a,
            accentColor: 0xaa44ff,
            health: 1400,
            damage: 20,
            speed: 3.0,
            attackRange: 35,
            attackCd: 1.6,
            modelType: 'shaman',
            canHeal: true,
            phases: [
                { threshold: 1.0, name: '第一阶段：自然之怒', skillSet: ['thorn_blast', 'healing_touch'] },
                { threshold: 0.65, name: '第二阶段：毒雾蔓延', skillSet: ['thorn_blast', 'healing_touch', 'poison_cloud', 'vine_grasp'] },
                { threshold: 0.35, name: '第三阶段：森林化身', skillSet: ['thorn_blast', 'poison_cloud', 'vine_grasp', 'summon_ent'] }
            ],
            skills: {
                thorn_blast: { name: '荆棘爆发', damage: 25, cd: 3.5, castTime: 1.0, range: 30, color: 0x44aa22, desc: '在玩家位置召唤荆棘爆发' },
                healing_touch: { name: '治愈之触', damage: 0, cd: 10.0, castTime: 1.5, range: 0, color: 0x44ff44, desc: '恢复自身20%最大生命值' },
                poison_cloud: { name: '毒云术', damage: 8, cd: 7.0, castTime: 1.2, range: 35, color: 0x88ff44, desc: '释放持续毒云，造成范围持续伤害' },
                vine_grasp: { name: '藤蔓缠绕', damage: 15, cd: 8.0, castTime: 1.0, range: 25, color: 0x228822, desc: '召唤藤蔓缠绕玩家，限制移动3秒' },
                summon_ent: { name: '召唤树人', damage: 0, cd: 20.0, castTime: 2.0, range: 0, color: 0x664422, desc: '召唤1个强大的树人守卫协助战斗' }
            }
        }
    };

    // ============================================================
    // 二、小兵装备系统扩展
    // ============================================================
    const GRUNT_WEAPONS = {
        'pistol_standard': { name: '制式手枪', damage: 12, fireRate: 300, range: 35, spread: 0.04, icon: '🔫' },
        'smg_standard': { name: '制式冲锋枪', damage: 10, fireRate: 80, range: 40, spread: 0.06, icon: '🔫' },
        'rifle_standard': { name: '制式突击步枪', damage: 18, fireRate: 100, range: 60, spread: 0.035, icon: '🎯' },
        'rifle_marksman': { name: '精确射手步枪', damage: 30, fireRate: 250, range: 100, spread: 0.015, icon: '🔭' },
        'shotgun_standard': { name: '制式霰弹枪', damage: 12, fireRate: 700, range: 25, spread: 0.12, pellets: 6, icon: '💥' },
        'lmg_support': { name: '班用轻机枪', damage: 16, fireRate: 110, range: 70, spread: 0.05, icon: '🔥' },
        'grenadier': { name: '榴弹发射器', damage: 40, fireRate: 1500, range: 45, spread: 0.02, isExplosive: true, icon: '💣' },
        'sniper_elite': { name: '精英狙击枪', damage: 55, fireRate: 900, range: 150, spread: 0.005, icon: '🔭' }
    };

    const GRUNT_ARMORS = {
        'none': { name: '无防护', armorValue: 0, speedMod: 1.0, icon: '' },
        'light_vest': { name: '轻型防弹衣', armorValue: 15, speedMod: 0.95, icon: '🦺' },
        'standard_armor': { name: '标准护甲', armorValue: 30, speedMod: 0.90, icon: '🛡️' },
        'heavy_armor': { name: '重型护甲', armorValue: 50, speedMod: 0.80, icon: '🛡️' },
        'exosuit': { name: '外骨骼装甲', armorValue: 70, speedMod: 0.85, icon: '🤖' }
    };

    const GRUNT_CLASSES = {
        'rifleman': { name: '步枪兵', weapon: 'rifle_standard', armor: 'light_vest', hp: 80, behavior: 'balanced', color: 0x4a5a3a },
        'assault': { name: '突击手', weapon: 'smg_standard', armor: 'light_vest', hp: 70, behavior: 'aggressive', color: 0x5a3a3a },
        'marksman': { name: '精确射手', weapon: 'rifle_marksman', armor: 'standard_armor', hp: 75, behavior: 'cautious', color: 0x3a4a5a },
        'support': { name: '火力支援', weapon: 'lmg_support', armor: 'heavy_armor', hp: 120, behavior: 'suppressive', color: 0x5a4a2a },
        'engineer': { name: '工兵', weapon: 'grenadier', armor: 'standard_armor', hp: 85, behavior: 'tactical', color: 0x4a3a5a },
        'sniper': { name: '狙击手', weapon: 'sniper_elite', armor: 'light_vest', hp: 65, behavior: 'stealth', color: 0x2a3a2a },
        'shotgunner': { name: '霰弹手', weapon: 'shotgun_standard', armor: 'heavy_armor', hp: 110, behavior: 'rusher', color: 0x5a2a2a },
        'officer': { name: '指挥官', weapon: 'pistol_standard', armor: 'exosuit', hp: 150, behavior: 'commander', color: 0x3a3a5a }
    };

    // ============================================================
    // 三、初始化
    // ============================================================
    function init() {
        if (_initialized) return;
        _createBossHealthBarUI();
        _initialized = true;
        console.log('[BossSystemV2] BOSS系统V2初始化完成');
    }

    // ============================================================
    // 四、屏幕顶部BOSS血条UI（尘白禁区风格）
    // ============================================================
    function _createBossHealthBarUI() {
        if (_bossHealthBarEl) return;

        const container = document.createElement('div');
        container.id = 'bossHealthBarV2';
        container.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            width: 60%; max-width: 800px; min-width: 400px;
            z-index: 9999; display: none; pointer-events: none;
            font-family: 'Microsoft YaHei', sans-serif;
        `;

        container.innerHTML = `
            <!-- BOSS名称和标题 -->
            <div style="text-align:center; margin-bottom:6px;">
                <div id="bossV2Name" style="font-size:22px; font-weight:bold; color:#fff; text-shadow:0 0 10px rgba(255,50,50,0.8); letter-spacing:2px;"></div>
                <div id="bossV2Title" style="font-size:12px; color:#aaa; margin-top:2px;"></div>
            </div>
            <!-- 阶段指示器 -->
            <div id="bossV2PhaseIndicator" style="display:flex; justify-content:center; gap:8px; margin-bottom:4px;">
            </div>
            <!-- 血条主体 -->
            <div style="position:relative; height:28px; background:rgba(0,0,0,0.7); border:2px solid; border-color:var(--boss-accent,#ff4444); border-radius:4px; overflow:hidden; box-shadow:0 0 20px rgba(255,50,50,0.4);">
                <!-- 血条背景纹理 -->
                <div style="position:absolute; inset:0; background:repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(0,0,0,0.3) 19px, rgba(0,0,0,0.3) 20px);"></div>
                <!-- 血条填充（延迟层，用于伤害反馈） -->
                <div id="bossV2HealthDelay" style="position:absolute; left:0; top:0; height:100%; width:100%; background:linear-gradient(180deg, #ff8866 0%, #cc4422 100%); transition:width 0.5s ease-out;"></div>
                <!-- 血条填充（实时层） -->
                <div id="bossV2HealthFill" style="position:absolute; left:0; top:0; height:100%; width:100%; background:linear-gradient(180deg, #ff6644 0%, #cc2200 100%); transition:width 0.15s ease-out;"></div>
                <!-- 血条高光 -->
                <div style="position:absolute; left:0; top:0; width:100%; height:50%; background:linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%); pointer-events:none;"></div>
                <!-- 血量文字 -->
                <div id="bossV2HealthText" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:bold; color:#fff; text-shadow:1px 1px 2px #000;"></div>
            </div>
            <!-- 技能名称提示 -->
            <div id="bossV2SkillName" style="text-align:center; margin-top:6px; font-size:14px; color:#ffcc00; text-shadow:0 0 8px rgba(255,200,0,0.6); opacity:0; transition:opacity 0.3s;"></div>
        `;

        document.body.appendChild(container);
        _bossHealthBarEl = container;
    }

    function showBossHealthBar(boss) {
        // 只有BOSS V2才显示顶部血条，防止旧版BOSS冲突
        if (!boss || !boss.isBossV2) return;
        if (!_bossHealthBarEl) _createBossHealthBarUI();
        _activeBoss = boss;

        const config = BOSS_CONFIG_V2[boss.bossTypeV2] || BOSS_CONFIG_V2['forest_hunter'];
        const accentHex = '#' + config.accentColor.toString(16).padStart(6, '0');

        _bossHealthBarEl.style.setProperty('--boss-accent', accentHex);
        _bossHealthBarEl.style.display = 'block';

        document.getElementById('bossV2Name').textContent = config.icon + ' ' + config.name;
        document.getElementById('bossV2Title').textContent = config.title;

        // 创建阶段指示器
        const phaseContainer = document.getElementById('bossV2PhaseIndicator');
        phaseContainer.innerHTML = '';
        config.phases.forEach((phase, i) => {
            const dot = document.createElement('div');
            dot.style.cssText = `width:12px; height:12px; border-radius:50%; border:2px solid ${accentHex}; background:${i === 0 ? accentHex : 'transparent'}; transition:all 0.3s;`;
            dot.dataset.phase = i;
            phaseContainer.appendChild(dot);
        });

        updateBossHealthBar();
    }

    function hideBossHealthBar() {
        if (_bossHealthBarEl) _bossHealthBarEl.style.display = 'none';
        _activeBoss = null;
    }

    function updateBossHealthBar() {
        if (!_activeBoss || !_bossHealthBarEl) return;

        const boss = _activeBoss;
        const config = BOSS_CONFIG_V2[boss.bossTypeV2] || BOSS_CONFIG_V2['forest_hunter'];
        const healthPercent = Math.max(0, boss.health / boss.maxHealth);

        document.getElementById('bossV2HealthFill').style.width = (healthPercent * 100) + '%';
        document.getElementById('bossV2HealthDelay').style.width = (healthPercent * 100) + '%';
        document.getElementById('bossV2HealthText').textContent =
            Math.ceil(boss.health) + ' / ' + boss.maxHealth;

        // 更新阶段指示器
        let currentPhase = 0;
        for (let i = 0; i < config.phases.length; i++) {
            if (healthPercent <= config.phases[i].threshold) currentPhase = i;
        }
        const dots = document.querySelectorAll('#bossV2PhaseIndicator > div');
        dots.forEach((dot, i) => {
            const accentHex = '#' + config.accentColor.toString(16).padStart(6, '0');
            if (i <= currentPhase) {
                dot.style.background = accentHex;
                dot.style.boxShadow = '0 0 8px ' + accentHex;
            } else {
                dot.style.background = 'transparent';
                dot.style.boxShadow = 'none';
            }
        });
    }

    function showBossSkillName(skillName, duration) {
        if (!_bossHealthBarEl) return;
        const el = document.getElementById('bossV2SkillName');
        if (!el) return;
        el.textContent = '⚠ ' + skillName;
        el.style.opacity = '1';
        clearTimeout(el._hideTimer);
        el._hideTimer = setTimeout(() => { el.style.opacity = '0'; }, duration || 1500);
    }

    // ============================================================
    // 五、BOSS创建（独特视觉模型）
    // ============================================================
    function createBossV2(bossType, x, z) {
        const config = BOSS_CONFIG_V2[bossType] || BOSS_CONFIG_V2['forest_hunter'];
        const grp = new THREE.Group();

        const bodyMat = new THREE.MeshStandardMaterial({
            color: config.themeColor, roughness: 0.6, metalness: 0.4
        });
        const accentMat = new THREE.MeshStandardMaterial({
            color: config.accentColor, roughness: 0.3, metalness: 0.6,
            emissive: config.accentColor, emissiveIntensity: 0.4
        });

        // 根据模型类型创建不同外观
        if (config.modelType === 'hunter') {
            _buildHunterModel(grp, bodyMat, accentMat);
        } else if (config.modelType === 'juggernaut') {
            _buildJuggernautModel(grp, bodyMat, accentMat);
        } else if (config.modelType === 'commander') {
            _buildCommanderModel(grp, bodyMat, accentMat);
        } else if (config.modelType === 'colossus') {
            _buildColossusModel(grp, bodyMat, accentMat);
        } else if (config.modelType === 'shaman') {
            _buildShamanModel(grp, bodyMat, accentMat);
        } else if (config.modelType === 'assassin') {
            _buildAssassinModel(grp, bodyMat, accentMat);
        } else if (config.modelType === 'lava') {
            _buildLavaModel(grp, bodyMat, accentMat);
        }

        // 通用：地面光环
        const ringGeo = new THREE.RingGeometry(1.0, 1.5, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color: config.accentColor, transparent: true, opacity: 0.4,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        ring.name = 'bossGlowRing';
        grp.add(ring);

        grp.position.set(x, 0, z);
        scene.add(grp);

        // BOSS数据对象
        const boss = {
            mesh: grp,
            health: config.health,
            maxHealth: config.health,
            speed: config.speed,
            damage: config.damage,
            attackRange: config.attackRange,
            attackCd: config.attackCd,
            lastAttack: 0,
            state: 'patrol',
            patrolTarget: { x: x + (Math.random() - 0.5) * 20, z: z + (Math.random() - 0.5) * 20 },
            alertTimer: 0,
            lostSightTimer: 0,
            enemyLevel: 5,
            isBoss: true,
            isBossV2: true,
            bossName: config.name,
            bossTypeV2: bossType,
            bossIcon: config.icon,
            bossConfig: config,
            currentPhase: 0,
            phaseChanged: false,
            skillCooldowns: {},
            isCasting: false,
            castSkill: null,
            castTimer: 0,
            shieldHealth: config.shieldHealth || 0,
            maxShieldHealth: config.shieldHealth || 0,
            lootGenerated: false,
            lootItems: [],
            glowRing: ring,
            spawnPos: { x, z }
        };

        // 初始化技能冷却
        for (const skillName in config.skills) {
            boss.skillCooldowns[skillName] = 0;
        }

        // 命中盒
        const hb = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 2.8, 1.0),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
        );
        hb.position.set(0, 1.4, 0);
        hb.userData.enemy = boss;
        grp.add(hb);
        enemyHitboxes.push(hb);

        // 生成战利品
        _generateBossLootV2(boss, bossType);

        bosses.push(boss);
        enemies.push(boss);

        // 显示顶部血条
        showBossHealthBar(boss);

        // 播放BOSS战音乐
        startBossMusic(bossType);

        // BOSS扩展：开始BOSS战追踪和战场互动
        if (typeof BossExtensions !== 'undefined') {
            try {
                BossExtensions.startBossFight(bossType);
                // 暂时禁用战场物体生成（可能导致页面卡死，待调试）
                // BossExtensions.spawnBattleArenaObjects(x, z, 20);
            } catch(e) {
                console.log('[BossSystemV2] BOSS扩展初始化错误:', e);
            }
        }

        return boss;
    }

    // ========== 模型构建函数 ==========
    function _buildHunterModel(grp, bodyMat, accentMat) {
        // 轻盈的猎手身材
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 1.2, 10), bodyMat);
        torso.position.y = 1.2; torso.castShadow = true; grp.add(torso);
        // 头部（带兜帽）
        const hood = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.6, 8), bodyMat);
        hood.position.y = 2.1; grp.add(hood);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), accentMat);
        head.position.y = 1.9; head.castShadow = true; head.userData.isHead = true; grp.add(head);
        // 发光眼睛
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
        lEye.position.set(-0.08, 1.95, 0.2); grp.add(lEye);
        const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
        rEye.position.set(0.08, 1.95, 0.2); grp.add(rEye);
        // 长弓
        const bow = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 6, 16, Math.PI), accentMat);
        bow.position.set(0.5, 1.2, 0); bow.rotation.z = Math.PI / 2; grp.add(bow);
        // 手臂
        const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.7, 6), bodyMat);
        lArm.position.set(-0.4, 1.1, 0); grp.add(lArm);
        const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.7, 6), bodyMat);
        rArm.position.set(0.4, 1.1, 0); grp.add(rArm);
        // 腿
        const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.8, 6), bodyMat);
        lLeg.position.set(-0.15, 0.4, 0); grp.add(lLeg);
        const rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.8, 6), bodyMat);
        rLeg.position.set(0.15, 0.4, 0); grp.add(rLeg);
    }

    function _buildJuggernautModel(grp, bodyMat, accentMat) {
        // 厚重的装甲身材
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.8), bodyMat);
        torso.position.y = 1.3; torso.castShadow = true; grp.add(torso);
        // 护盾（左臂）
        const shield = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.8), accentMat);
        shield.position.set(-0.7, 1.3, 0.2); shield.castShadow = true; grp.add(shield);
        // 重锤（右臂）
        const hammerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), new THREE.MeshStandardMaterial({ color: 0x444444 }));
        hammerHandle.position.set(0.7, 1.0, 0.3); hammerHandle.rotation.x = 0.3; grp.add(hammerHandle);
        const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), accentMat);
        hammerHead.position.set(0.7, 0.5, 0.5); grp.add(hammerHead);
        // 头盔
        const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), bodyMat);
        helmet.position.y = 2.2; grp.add(helmet);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        visor.position.set(0, 2.2, 0.25); grp.add(visor);
        // 粗壮的腿
        const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.35), bodyMat);
        lLeg.position.set(-0.25, 0.45, 0); grp.add(lLeg);
        const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.35), bodyMat);
        rLeg.position.set(0.25, 0.45, 0); grp.add(rLeg);
    }

    function _buildCommanderModel(grp, bodyMat, accentMat) {
        // 标准军事身材，带披风
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.35, 1.3, 10), bodyMat);
        torso.position.y = 1.2; torso.castShadow = true; grp.add(torso);
        // 披风
        const cape = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.5), new THREE.MeshStandardMaterial({ color: 0x2a0a0a, side: THREE.DoubleSide }));
        cape.position.set(0, 1.3, -0.4); grp.add(cape);
        // 军帽
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.15, 10), bodyMat);
        cap.position.y = 2.1; grp.add(cap);
        const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.1, 10), accentMat);
        capTop.position.y = 2.2; grp.add(capTop);
        // 头部
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshStandardMaterial({ color: 0xccaa88 }));
        head.position.y = 1.9; head.userData.isHead = true; grp.add(head);
        // 墨镜
        const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        glasses.position.set(0, 1.95, 0.25); grp.add(glasses);
        // 手枪
        const pistol = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.25), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        pistol.position.set(0.45, 1.0, 0.3); grp.add(pistol);
        // 手臂
        const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.75, 6), bodyMat);
        lArm.position.set(-0.45, 1.1, 0); grp.add(lArm);
        const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.75, 6), bodyMat);
        rArm.position.set(0.45, 1.1, 0); grp.add(rArm);
        // 腿
        const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.85, 6), bodyMat);
        lLeg.position.set(-0.18, 0.42, 0); grp.add(lLeg);
        const rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.85, 6), bodyMat);
        rLeg.position.set(0.18, 0.42, 0); grp.add(rLeg);
    }

    function _buildColossusModel(grp, bodyMat, accentMat) {
        // 巨大的机械身材
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 1.0), bodyMat);
        torso.position.y = 1.6; torso.castShadow = true; grp.add(torso);
        // 核心（胸口发光）
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), accentMat);
        core.position.set(0, 1.7, 0.5); grp.add(core);
        // 头部（机械）
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), bodyMat);
        head.position.y = 2.7; grp.add(head);
        const eyeLaser = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0x00ffaa }));
        eyeLaser.position.set(0, 2.75, 0.25); grp.add(eyeLaser);
        // 巨型手臂
        const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), bodyMat);
        lArm.position.set(-0.9, 1.5, 0); grp.add(lArm);
        const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), bodyMat);
        rArm.position.set(0.9, 1.5, 0); grp.add(rArm);
        // 导弹舱（肩部）
        const lMissile = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.6), accentMat);
        lMissile.position.set(-0.7, 2.3, 0); grp.add(lMissile);
        const rMissile = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.6), accentMat);
        rMissile.position.set(0.7, 2.3, 0); grp.add(rMissile);
        // 粗壮的机械腿
        const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 0.45), bodyMat);
        lLeg.position.set(-0.35, 0.55, 0); grp.add(lLeg);
        const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 0.45), bodyMat);
        rLeg.position.set(0.35, 0.55, 0); grp.add(rLeg);
    }

    function _buildShamanModel(grp, bodyMat, accentMat) {
        // 瘦高的祭司身材，带藤蔓装饰
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.4, 10), bodyMat);
        torso.position.y = 1.3; torso.castShadow = true; grp.add(torso);
        // 头骨面具
        const mask = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshStandardMaterial({ color: 0xddddcc }));
        mask.position.y = 2.1; mask.userData.isHead = true; grp.add(mask);
        const maskEyes = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0xaa44ff }));
        maskEyes.position.set(0, 2.15, 0.27); grp.add(maskEyes);
        // 羽毛头饰
        for (let i = 0; i < 5; i++) {
            const feather = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.4, 4), accentMat);
            feather.position.set((i - 2) * 0.08, 2.5, 0);
            feather.rotation.z = (i - 2) * 0.2;
            grp.add(feather);
        }
        // 法杖
        const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 6), new THREE.MeshStandardMaterial({ color: 0x4a3020 }));
        staff.position.set(0.5, 1.2, 0.2); staff.rotation.z = 0.2; grp.add(staff);
        const staffOrb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), accentMat);
        staffOrb.position.set(0.55, 2.2, 0.25); grp.add(staffOrb);
        // 藤蔓手臂
        const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.8, 6), bodyMat);
        lArm.position.set(-0.4, 1.2, 0); lArm.rotation.z = 0.3; grp.add(lArm);
        const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.8, 6), bodyMat);
        rArm.position.set(0.4, 1.2, 0); rArm.rotation.z = -0.3; grp.add(rArm);
        // 腿（长袍覆盖）
        const robe = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 8), bodyMat);
        robe.position.y = 0.5; grp.add(robe);
    }

    // ============================================================
    // 六、BOSS AI更新（技能+多阶段）
    // ============================================================
    function updateBossV2(boss, dt) {
        if (!boss.isBossV2) return;

        const config = boss.bossConfig;
        const now = performance.now() / 1000;

        // 更新技能冷却
        for (const skillName in boss.skillCooldowns) {
            if (boss.skillCooldowns[skillName] > 0) {
                boss.skillCooldowns[skillName] -= dt;
            }
        }

        // 阶段检测
        try {
            const healthPercent = boss.health / boss.maxHealth;
            let newPhase = 0;
            for (let i = 0; i < config.phases.length; i++) {
                if (healthPercent <= config.phases[i].threshold) newPhase = i;
            }
            if (newPhase !== boss.currentPhase && !boss.phaseChanged) {
                boss.currentPhase = newPhase;
                boss.phaseChanged = true;
                _onBossPhaseChange(boss, config.phases[newPhase]);
                setTimeout(() => { boss.phaseChanged = false; }, 3000);
            }
        } catch(e) {
            console.log('[BossSystemV2] 阶段检测错误:', e);
        }

        // 施法中
        if (boss.isCasting) {
            boss.castTimer -= dt;
            _updateCastAnimation(boss, dt);
            if (boss.castTimer <= 0) {
                _executeBossSkill(boss, boss.castSkill);
                boss.isCasting = false;
                boss.castSkill = null;
            }
            return;
        }

        // 基础AI：追击玩家
        if (typeof playerGroup !== 'undefined') {
            const dx = playerGroup.position.x - boss.mesh.position.x;
            const dz = playerGroup.position.z - boss.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > boss.attackRange * 0.8) {
                // 移动向玩家
                const moveX = (dx / dist) * boss.speed * dt;
                const moveZ = (dz / dist) * boss.speed * dt;
                boss.mesh.position.x += moveX;
                boss.mesh.position.z += moveZ;
            } else {
                // 在攻击范围内，尝试释放技能
                _tryBossSkill(boss, config);
            }

            // 面向玩家
            boss.mesh.rotation.y = Math.atan2(dx, dz);
        }

        // 地面光环旋转
        if (boss.glowRing) {
            boss.glowRing.rotation.z += dt * 0.5;
        }

        // 更新顶部血条
        if (_activeBoss === boss) {
            updateBossHealthBar();
        }
    }

    function _tryBossSkill(boss, config) {
        const currentPhaseData = config.phases[boss.currentPhase];
        const availableSkills = currentPhaseData.skillSet.filter(
            name => boss.skillCooldowns[name] <= 0
        );

        if (availableSkills.length === 0) return;

        // 随机选择一个可用技能
        const skillName = availableSkills[Math.floor(Math.random() * availableSkills.length)];
        const skill = config.skills[skillName];

        // 开始施法
        boss.isCasting = true;
        boss.castSkill = skillName;
        boss.castTimer = skill.castTime;
        boss.skillCooldowns[skillName] = skill.cd + skill.castTime;

        // 显示技能名称
        showBossSkillName(skill.name, skill.castTime * 1000 + 500);

        // 施法前摇视觉效果
        _startCastEffect(boss, skill);
    }

    function _startCastEffect(boss, skill) {
        // BOSS身体发光
        boss.mesh.traverse(child => {
            if (child.material && child.material.emissive) {
                child.material.emissiveIntensity = 0.8;
            }
        });
    }

    function _updateCastAnimation(boss, dt) {
        // 施法时的抖动效果
        const shake = Math.sin(performance.now() * 0.02) * 0.05;
        boss.mesh.position.y = shake;
    }

    function _executeBossSkill(boss, skillName) {
        const config = boss.bossConfig;
        const skill = config.skills[skillName];

        // 恢复身体发光
        boss.mesh.traverse(child => {
            if (child.material && child.material.emissive) {
                child.material.emissiveIntensity = 0.3;
            }
        });
        boss.mesh.position.y = 0;

        // 执行技能效果（简化版，实际可扩展）
        console.log('[BossSystemV2] BOSS释放技能:', skill.name, '伤害:', skill.damage);

        // 对玩家造成伤害（通过damagePlayer函数，确保护甲减伤和死亡处理）
        if (typeof playerGroup !== 'undefined' && skill.damage > 0) {
            const dx = playerGroup.position.x - boss.mesh.position.x;
            const dz = playerGroup.position.z - boss.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= skill.range) {
                // 使用damagePlayer函数，确保护甲减伤、死亡检查、受击反馈等完整流程
                if (typeof damagePlayer === 'function') {
                    damagePlayer(skill.damage, boss.mesh.position.x, boss.mesh.position.z);
                } else if (typeof S !== 'undefined') {
                    // 降级：直接伤害（带死亡检查）
                    S.health -= skill.damage;
                    if (S.health <= 0) {
                        S.health = 0;
                        if (typeof sfxPlayerDeath === 'function') sfxPlayerDeath();
                        if (typeof endGame === 'function') endGame(false);
                    }
                    if (typeof PlayerAnimation !== 'undefined') {
                        PlayerAnimation.applyHitShake(skill.damage / 30);
                    }
                    updateHUD();
                }
            }
        }

        // 特殊技能效果
        if (skillName === 'call_reinforcements') {
            _spawnReinforcements(boss, 2);
        } else if (skillName === 'summon_ent') {
            _spawnReinforcements(boss, 1, 'heavy');
        } else if (skillName === 'healing_touch') {
            boss.health = Math.min(boss.maxHealth, boss.health + boss.maxHealth * 0.2);
        }
    }

    function _onBossPhaseChange(boss, phaseData) {
        try {
            console.log('[BossSystemV2] BOSS进入阶段:', phaseData.name);

            // 阶段转换特效（简化版，防止性能问题）
            if (typeof createHitEffect === 'function') {
                try {
                    createHitEffect(boss.mesh.position.clone().setY(1.5), boss.bossConfig.accentColor, 8);
                } catch(e) { console.log('[BossSystemV2] 阶段特效错误:', e); }
            }

            // 全屏提示
            const div = document.createElement('div');
            div.style.cssText = `
                position:fixed;top:40%;left:50%;transform:translate(-50%,-50%);
                background:rgba(0,0,0,0.9);border:2px solid #ff4444;border-radius:8px;
                padding:20px 50px;color:#ff4444;font-size:24px;font-weight:bold;
                z-index:200;pointer-events:none;text-align:center;
            `;
            div.innerHTML = '⚠ ' + phaseData.name + ' ⚠';
            document.body.appendChild(div);
            setTimeout(() => { if(div.parentNode) div.remove(); }, 2500);
        } catch(e) {
            console.log('[BossSystemV2] 阶段转换错误:', e);
        }
    }

    function _spawnReinforcements(boss, count, type) {
        // 调用现有敌人生成系统
        if (typeof createEnemy !== 'function') return;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const x = boss.mesh.position.x + Math.cos(angle) * 5;
            const z = boss.mesh.position.z + Math.sin(angle) * 5;
            const enemy = createEnemy(x, z, type || 'elite');
            if (enemy) {
                enemy.health *= 1.5;
                enemy.damage *= 1.3;
            }
        }
    }

    // ========== BOSS 6: 暗影刺客模型 ==========
    function _buildAssassinModel(grp, bodyMat, accentMat) {
        // 轻盈的刺客身材
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 1.1, 10), bodyMat);
        torso.position.y = 1.2; torso.castShadow = true; grp.add(torso);
        // 兜帽
        const hood = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 8), bodyMat);
        hood.position.y = 2.0; grp.add(hood);
        // 头部（完全阴影）
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0x0a0a0a }));
        head.position.y = 1.85; head.userData.isHead = true; grp.add(head);
        // 发光眼睛（粉色）
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff44aa });
        const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), eyeMat);
        lEye.position.set(-0.07, 1.9, 0.18); grp.add(lEye);
        const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), eyeMat);
        rEye.position.set(0.07, 1.9, 0.18); grp.add(rEye);
        // 双匕首
        for (let i = 0; i < 2; i++) {
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.4), accentMat);
            blade.position.set(i === 0 ? -0.35 : 0.35, 1.0, 0.25);
            blade.rotation.x = i === 0 ? 0.3 : -0.3;
            grp.add(blade);
            const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.1), new THREE.MeshStandardMaterial({ color: 0x222222 }));
            handle.position.set(i === 0 ? -0.35 : 0.35, 1.0, 0.05);
            grp.add(handle);
        }
        // 披风
        const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.2), new THREE.MeshStandardMaterial({ color: 0x1a1a2a, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
        cape.position.set(0, 1.3, -0.3); grp.add(cape);
        // 细腿
        const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.8, 6), bodyMat);
        lLeg.position.set(-0.12, 0.4, 0); grp.add(lLeg);
        const rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.8, 6), bodyMat);
        rLeg.position.set(0.12, 0.4, 0); grp.add(rLeg);
    }

    // ========== BOSS 7: 熔岩巨兽模型 ==========
    function _buildLavaModel(grp, bodyMat, accentMat) {
        // 巨大的岩石身躯
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 1.0), bodyMat);
        torso.position.y = 1.5; torso.castShadow = true; grp.add(torso);
        // 熔岩裂缝（胸口发光）
        const crackMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
        const crack1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.02), crackMat);
        crack1.position.set(0, 1.7, 0.51); grp.add(crack1);
        const crack2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.02), crackMat);
        crack2.position.set(0.2, 1.5, 0.51); grp.add(crack2);
        // 头部（岩石）
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), bodyMat);
        head.position.y = 2.5; head.userData.isHead = true; grp.add(head);
        // 熔岩眼睛
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const lEye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.05), eyeMat);
        lEye.position.set(-0.12, 2.55, 0.25); grp.add(lEye);
        const rEye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.05), eyeMat);
        rEye.position.set(0.12, 2.55, 0.25); grp.add(rEye);
        // 熔岩嘴巴
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0xff4400 }));
        mouth.position.set(0, 2.35, 0.25); grp.add(mouth);
        // 巨型手臂（熔岩拳）
        const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), bodyMat);
        lArm.position.set(-0.8, 1.4, 0); grp.add(lArm);
        const lFist = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.45), accentMat);
        lFist.position.set(-0.8, 0.8, 0); grp.add(lFist);
        const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), bodyMat);
        rArm.position.set(0.8, 1.4, 0); grp.add(rArm);
        const rFist = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.45), accentMat);
        rFist.position.set(0.8, 0.8, 0); grp.add(rFist);
        // 粗壮的腿
        const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.4), bodyMat);
        lLeg.position.set(-0.3, 0.45, 0); grp.add(lLeg);
        const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.4), bodyMat);
        rLeg.position.set(0.3, 0.45, 0); grp.add(rLeg);
        // 背部熔岩尖刺
        for (let i = 0; i < 3; i++) {
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 6), accentMat);
            spike.position.set(-0.2 + i * 0.2, 2.2, -0.4);
            spike.rotation.x = Math.PI;
            grp.add(spike);
        }
    }

    // ============================================================
    // 七、BOSS战利品生成V2
    // ============================================================
    function _generateBossLootV2(boss, bossType) {
        const items = [];
        const config = BOSS_CONFIG_V2[bossType];

        // BOSS专属武器
        const weaponMap = {
            'forest_hunter': 'hk416',
            'industrial_juggernaut': 'lmg',
            'military_commander': 'mmg',
            'port_colossus': 'antiMaterial',
            'forest_shaman': 'dmr'
        };
        const weaponKey = weaponMap[bossType] || 'hk416';
        if (typeof ITEMS !== 'undefined' && ITEMS[weaponKey + '_item']) {
            items.push({ id: weaponKey + '_item', taken: false, slot: 'primary' });
        }

        // 高价值收藏品
        if (typeof RED_COLLECTIBLES_CONFIG !== 'undefined') {
            const redIds = Object.keys(RED_COLLECTIBLES_CONFIG);
            if (redIds.length > 0 && Math.random() < 0.5) {
                const redId = redIds[Math.floor(Math.random() * redIds.length)];
                items.push({ id: redId, taken: false, slot: 'backpack' });
            }
        }

        // 金色收藏品
        if (typeof COLLECTIBLES_CONFIG !== 'undefined') {
            const goldIds = Object.keys(COLLECTIBLES_CONFIG).filter(id =>
                COLLECTIBLES_CONFIG[id].rarity === 'legendary'
            );
            if (goldIds.length > 0) {
                const goldId = goldIds[Math.floor(Math.random() * goldIds.length)];
                items.push({ id: goldId, taken: false, slot: 'backpack' });
            }
        }

        // 护甲
        if (typeof ITEMS !== 'undefined') {
            const armors = ['armor_t5', 'armor_t6', 'helmet_t5', 'helmet_t6'];
            for (const a of armors) {
                if (ITEMS[a] && Math.random() < 0.4) {
                    items.push({ id: a, taken: false, slot: a.includes('helmet') ? 'helmet' : 'armor' });
                }
            }
        }

        boss.lootItems = items;
        boss.lootGenerated = true;
    }

    // ============================================================
    // 八、BOSS战音乐系统
    // ============================================================
    function startBossMusic(bossType) {
        if (!BOSS_MUSIC_FILES[bossType]) return;

        // 停止之前的音乐
        if (_bossMusicAudio) {
            _bossMusicAudio.pause();
            _bossMusicAudio = null;
        }

        const audioPath = BOSS_MUSIC_FOLDER + BOSS_MUSIC_FILES[bossType];
        _bossMusicAudio = new Audio(audioPath);
        _bossMusicAudio.loop = true;
        _bossMusicAudio.volume = 0;
        _targetMusicVolume = 0.6;

        _bossMusicAudio.play().catch(err => {
            console.log('[BossSystemV2] 音乐播放失败（可能文件不存在）:', audioPath);
        });

        // 渐入
        _fadeMusic();
    }

    function stopBossMusic() {
        _targetMusicVolume = 0;
        _fadeMusic();
        setTimeout(() => {
            if (_bossMusicAudio) {
                _bossMusicAudio.pause();
                _bossMusicAudio = null;
            }
        }, 1000);
    }

    function _fadeMusic() {
        if (!_bossMusicAudio) return;
        const fade = setInterval(() => {
            if (!_bossMusicAudio) { clearInterval(fade); return; }
            _musicVolume += (_targetMusicVolume - _musicVolume) * 0.1;
            _bossMusicAudio.volume = _musicVolume;
            if (Math.abs(_musicVolume - _targetMusicVolume) < 0.01) {
                clearInterval(fade);
            }
        }, 50);
    }

    function updateBossMusicVolume(playerDistToBoss) {
        if (!_bossMusicAudio) return;
        // 距离越近音量越大
        const maxDist = 80;
        const volume = Math.max(0.1, Math.min(0.8, 1 - playerDistToBoss / maxDist));
        _targetMusicVolume = volume;
        _musicVolume += (_targetMusicVolume - _musicVolume) * 0.05;
        _bossMusicAudio.volume = _musicVolume;
    }

    // ============================================================
    // 九、击杀特写和结算
    // ============================================================
    function startBossKillCam(boss) {
        if (_isKillCamActive) return;
        _isKillCamActive = true;

        // 隐藏顶部血条
        setTimeout(() => hideBossHealthBar(), 500);

        // 停止音乐
        stopBossMusic();

        // 创建击杀特写UI
        const camDiv = document.createElement('div');
        camDiv.id = 'bossKillCamV2';
        camDiv.style.cssText = `
            position:fixed;inset:0;z-index:300;pointer-events:none;
            background:radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.8) 100%);
            animation:killCamFade 0.5s ease-out;
        `;
        camDiv.innerHTML = `
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;">
                <div style="font-size:64px;color:#ff4444;text-shadow:0 0 30px rgba(255,50,50,0.8);animation:bossKillText 1s ease-out;">BOSS击杀</div>
                <div style="font-size:28px;color:#fff;margin-top:20px;">${boss.bossIcon} ${boss.bossName}</div>
                <div style="font-size:16px;color:#aaa;margin-top:10px;">已击败</div>
            </div>
        `;
        document.body.appendChild(camDiv);

        // 相机震动
        if (typeof PlayerAnimation !== 'undefined') {
            PlayerAnimation.applyHitShake(1.0);
        }

        // 3秒后显示结算
        setTimeout(() => {
            if (camDiv.parentNode) camDiv.remove();
            _showBossRewardScreen(boss);
            _isKillCamActive = false;
        }, 3000);
    }

    // 全局清理BOSS相关UI（游戏结束/返回主菜单时调用）
    function clearBossUI() {
        try {
            const killCam = document.getElementById('bossKillCamV2');
            if (killCam) killCam.remove();
            const rewardScreen = document.getElementById('bossRewardScreenV2');
            if (rewardScreen) rewardScreen.remove();
            hideBossHealthBar();
            stopBossMusic();
            _isKillCamActive = false;
            _activeBoss = null;
        } catch(e) {
            console.log('[BossSystemV2] 清理UI错误:', e);
        }
    }

    function _showBossRewardScreen(boss) {
        const rewardDiv = document.createElement('div');
        rewardDiv.id = 'bossRewardScreenV2';
        rewardDiv.style.cssText = `
            position:fixed;inset:0;z-index:300;background:rgba(0,0,0,0.92);
            display:flex;align-items:center;justify-content:center;
            animation:rewardFadeIn 0.5s ease-out;
        `;

        let lootHtml = '';
        if (boss.lootItems && boss.lootItems.length > 0) {
            lootHtml = '<div style="margin-top:20px;"><div style="color:#ffd700;font-size:18px;margin-bottom:10px;">战利品</div><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;max-width:500px;">';
            boss.lootItems.forEach(item => {
                const itemDef = typeof ITEMS !== 'undefined' ? ITEMS[item.id] : null;
                const name = itemDef ? itemDef.name : item.id;
                const icon = itemDef ? (itemDef.icon || '📦') : '📦';
                lootHtml += `<div style="background:rgba(255,215,0,0.1);border:1px solid #ffd700;border-radius:6px;padding:10px;text-align:center;min-width:80px;">
                    <div style="font-size:24px;">${icon}</div>
                    <div style="font-size:12px;color:#fff;margin-top:5px;">${name}</div>
                </div>`;
            });
            lootHtml += '</div></div>';
        }

        rewardDiv.innerHTML = `
            <div style="text-align:center;max-width:600px;padding:40px;">
                <div style="font-size:48px;color:#ffd700;text-shadow:0 0 20px rgba(255,215,0,0.6);">🏆 战斗胜利</div>
                <div style="font-size:24px;color:#fff;margin-top:15px;">${boss.bossIcon} ${boss.bossName}</div>
                <div style="font-size:14px;color:#888;margin-top:5px;">已成功击败</div>
                ${lootHtml}
                <div style="margin-top:30px;">
                    <button id="bossRewardCloseBtn" style="background:linear-gradient(180deg,#ff8844,#cc4400);color:#fff;border:none;padding:12px 40px;font-size:16px;border-radius:6px;cursor:pointer;">搜索战利品</button>
                </div>
                <div style="font-size:12px;color:#666;margin-top:15px;">战利品已掉落在BOSS附近，快去搜索吧！</div>
            </div>
        `;

        document.body.appendChild(rewardDiv);

        // 3秒后自动关闭（总共击杀特写3s + 结算3s = 6s）
        let rewardCountdown = 3;
        const closeBtn = document.getElementById('bossRewardCloseBtn');
        const updateBtnText = () => {
            closeBtn.textContent = `搜索战利品 (${rewardCountdown}s)`;
        };
        updateBtnText();
        const rewardTimer = setInterval(() => {
            rewardCountdown--;
            if (rewardCountdown <= 0) {
                clearInterval(rewardTimer);
                if (rewardDiv.parentNode) rewardDiv.remove();
            } else {
                updateBtnText();
            }
        }, 1000);

        // 关闭结算界面的函数
        const closeReward = () => {
            clearInterval(rewardTimer);
            if (rewardDiv.parentNode) rewardDiv.remove();
        };

        // 点击按钮关闭
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            closeReward();
        };

        // 点击结算界面任意位置关闭（不阻挡按钮点击）
        rewardDiv.addEventListener('click', (e) => {
            if (e.target === rewardDiv || e.target.tagName !== 'BUTTON') {
                closeReward();
            }
        });
    }

    // ============================================================
    // 十、小兵装备和AI优化
    // ============================================================
    function applyGruntLoadout(enemy, gruntClass) {
        const classDef = GRUNT_CLASSES[gruntClass] || GRUNT_CLASSES['rifleman'];
        const weaponDef = GRUNT_WEAPONS[classDef.weapon];
        const armorDef = GRUNT_ARMORS[classDef.armor];

        enemy.gruntClass = gruntClass;
        enemy.gruntWeapon = classDef.weapon;
        enemy.gruntArmor = classDef.armor;
        enemy.weaponDef = weaponDef;
        enemy.armorDef = armorDef;

        // 应用装备属性
        enemy.damage = weaponDef.damage;
        enemy.fireRate = weaponDef.fireRate;
        enemy.range = weaponDef.range;
        enemy.spread = weaponDef.spread;
        enemy.maxHealth = classDef.hp + (armorDef.armorValue || 0);
        enemy.health = enemy.maxHealth;
        enemy.speed = (enemy.speed || 3.0) * armorDef.speedMod;
        enemy.color = classDef.color;
        enemy.behavior = classDef.behavior;

        // AI状态扩展
        enemy.inCover = false;
        enemy.coverTarget = null;
        enemy.suppressing = false;
        enemy.retreating = false;
        enemy.lastHitTime = 0;
        enemy.friendsNearby = 0;
    }

    function updateGruntAI(enemy, dt, allEnemies) {
        if (!enemy.gruntClass) return;

        const now = performance.now() / 1000;

        // 统计附近友军
        enemy.friendsNearby = 0;
        for (const other of allEnemies) {
            if (other === enemy || other.isBoss) continue;
            const dx = other.mesh.position.x - enemy.mesh.position.x;
            const dz = other.mesh.position.z - enemy.mesh.position.z;
            if (Math.sqrt(dx * dx + dz * dz) < 15) enemy.friendsNearby++;
        }

        // 受伤行为变化
        const healthPercent = enemy.health / enemy.maxHealth;
        if (healthPercent < 0.3 && !enemy.retreating && enemy.behavior !== 'aggressive') {
            // 低血量撤退
            enemy.retreating = true;
            setTimeout(() => { enemy.retreating = false; }, 5000);
        }

        // 根据行为类型调整AI
        switch (enemy.behavior) {
            case 'aggressive':
                // 激进型：持续推进，不找掩护
                enemy.speed = Math.min(enemy.speed, 4.5);
                break;
            case 'cautious':
                // 谨慎型：保持距离，利用掩护
                if (typeof playerGroup !== 'undefined') {
                    const dx = playerGroup.position.x - enemy.mesh.position.x;
                    const dz = playerGroup.position.z - enemy.mesh.position.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist < 20) {
                        // 太近，后退
                        enemy.mesh.position.x -= (dx / dist) * enemy.speed * dt * 0.5;
                        enemy.mesh.position.z -= (dz / dist) * enemy.speed * dt * 0.5;
                    }
                }
                break;
            case 'suppressive':
                // 压制型：高射速，掩护友军
                if (enemy.friendsNearby > 0) {
                    enemy.fireRate = Math.max(50, enemy.fireRate * 0.8);
                }
                break;
            case 'stealth':
                // 潜行型：远距离狙击
                break;
            case 'rusher':
                // 冲锋型：快速接近
                enemy.speed = Math.min(enemy.speed, 5.0);
                break;
            case 'commander':
                // 指挥型：增益附近友军
                if (enemy.friendsNearby > 0) {
                    // 指挥官光环：附近友军伤害+10%
                    for (const other of allEnemies) {
                        if (other === enemy || other.isBoss) continue;
                        const dx = other.mesh.position.x - enemy.mesh.position.x;
                        const dz = other.mesh.position.z - enemy.mesh.position.z;
                        if (Math.sqrt(dx * dx + dz * dz) < 15) {
                            other.damage = (other.damage || 10) * 1.1;
                        }
                    }
                }
                break;
        }
    }

    // ============================================================
    // 十一、公共API
    // ============================================================
    return {
        init,
        BOSS_CONFIG_V2,
        GRUNT_WEAPONS,
        GRUNT_ARMORS,
        GRUNT_CLASSES,
        createBossV2,
        updateBossV2,
        showBossHealthBar,
        hideBossHealthBar,
        updateBossHealthBar,
        showBossSkillName,
        startBossMusic,
        stopBossMusic,
        updateBossMusicVolume,
        startBossKillCam,
        clearBossUI,
        applyGruntLoadout,
        updateGruntAI,
        isKillCamActive: () => _isKillCamActive
    };
})();

// 全局访问
if (typeof window !== 'undefined') {
    window.BossSystemV2 = BossSystemV2;
}
