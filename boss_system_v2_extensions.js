// ============================================================
// BOSS系统V2 扩展模块
// 功能: 任务链UI + 成就系统 + 皮肤系统 + 排行榜 + 新BOSS + 小兵可视化 + 场景互动
// ============================================================

const BossExtensions = (function() {
    'use strict';

    let _initialized = false;
    let _bossMissionPanel = null;
    let _bossAchievementPanel = null;
    let _bossLeaderboardPanel = null;
    let _destructibleObjects = [];
    let _explosiveObjects = [];
    let _interactiveTraps = [];

    // ============================================================
    // 一、第6、7种BOSS配置
    // ============================================================
    const EXTRA_BOSSES = {
        // ========== BOSS 6: 暗影刺客（潜行型） ==========
        'shadow_assassin': {
            name: '暗影刺客·夜刃',
            title: '来自黑暗的致命舞者',
            icon: '🗡️',
            themeColor: 0x1a1a2a,
            accentColor: 0xff44aa,
            health: 1000,
            damage: 35,
            speed: 7.0,
            attackRange: 15,
            attackCd: 0.8,
            modelType: 'assassin',
            phases: [
                { threshold: 1.0, name: '第一阶段：暗影潜行', skillSet: ['quick_slash', 'smoke_bomb'] },
                { threshold: 0.60, name: '第二阶段：致命舞步', skillSet: ['quick_slash', 'smoke_bomb', 'shadow_clone', 'bleed_strike'] },
                { threshold: 0.30, name: '第三阶段：死神降临', skillSet: ['quick_slash', 'shadow_clone', 'bleed_strike', 'death_mark'] }
            ],
            skills: {
                quick_slash: { name: '快速斩击', damage: 25, cd: 2.0, castTime: 0.3, range: 8, color: 0xff44aa, desc: '高速接近并斩击' },
                smoke_bomb: { name: '烟雾弹', damage: 0, cd: 5.0, castTime: 0.5, range: 15, color: 0x888888, desc: '释放烟雾并隐身' },
                shadow_clone: { name: '暗影分身', damage: 15, cd: 8.0, castTime: 1.0, range: 20, color: 0xaa44ff, desc: '创造分身同时攻击' },
                bleed_strike: { name: '流血打击', damage: 20, cd: 6.0, castTime: 0.6, range: 10, color: 0xff0044, desc: '造成持续流血伤害' },
                death_mark: { name: '死亡标记', damage: 80, cd: 15.0, castTime: 1.5, range: 25, color: 0xff0000, desc: '标记玩家，3秒后造成巨额伤害' }
            }
        },

        // ========== BOSS 7: 熔岩巨兽（元素型） ==========
        'lava_behemoth': {
            name: '熔岩巨兽·炎魔',
            title: '从地心苏醒的毁灭化身',
            icon: '🌋',
            themeColor: 0x3a1a0a,
            accentColor: 0xff6600,
            health: 2200,
            damage: 40,
            speed: 2.2,
            attackRange: 30,
            attackCd: 2.5,
            modelType: 'lava',
            phases: [
                { threshold: 1.0, name: '第一阶段：岩浆涌动', skillSet: ['lava_ball', 'ground_crack'] },
                { threshold: 0.65, name: '第二阶段：火山喷发', skillSet: ['lava_ball', 'ground_crack', 'fire_rain', 'magma_surge'] },
                { threshold: 0.35, name: '第三阶段：世界焚毁', skillSet: ['lava_ball', 'fire_rain', 'magma_surge', 'supernova'] }
            ],
            skills: {
                lava_ball: { name: '熔岩球', damage: 35, cd: 3.0, castTime: 0.8, range: 35, color: 0xff6600, desc: '投掷巨大熔岩球' },
                ground_crack: { name: '大地裂缝', damage: 25, cd: 5.0, castTime: 1.0, range: 25, color: 0xff4400, desc: '地面裂开喷射岩浆' },
                fire_rain: { name: '火焰雨', damage: 15, cd: 8.0, castTime: 1.5, range: 40, color: 0xff2200, desc: '天空降下火焰陨石' },
                magma_surge: { name: '岩浆潮涌', damage: 30, cd: 10.0, castTime: 1.2, range: 30, color: 0xff8800, desc: '岩浆波浪席卷战场' },
                supernova: { name: '超新星爆发', damage: 100, cd: 20.0, castTime: 3.0, range: 50, color: 0xffff00, desc: '自身爆炸造成毁灭范围伤害' }
            }
        }
    };

    // ============================================================
    // 二、BOSS任务链系统
    // ============================================================
    const BOSS_MISSION_CHAINS = {
        'forest_hunter': {
            bossName: '森林猎手·暗影',
            bossIcon: '🏹',
            chain: [
                { id: 'fh_intel', name: '情报收集：密林传闻', desc: '搜索3个密林区域的容器，收集关于猎手的情报', target: 3, type: 'search_containers', reward: { money: 5000, xp: 100 } },
                { id: 'fh_eliminate', name: '前置清除：精英巡逻队', desc: '击杀5名密林精英敌人', target: 5, type: 'kill_any', reward: { money: 8000, xp: 150 } },
                { id: 'fh_boss', name: '最终决战：森林猎手', desc: '击败森林猎手·暗影', target: 1, type: 'kill_boss_forest_hunter', reward: { money: 50000, xp: 500, skin: 'forest_hunter_bow' } }
            ]
        },
        'industrial_juggernaut': {
            bossName: '工业铁卫·壁垒',
            bossIcon: '🛡️',
            chain: [
                { id: 'ij_intel', name: '情报收集：工厂图纸', desc: '搜索工业区的保险箱，获取铁卫设计图', target: 2, type: 'search_containers', reward: { money: 6000, xp: 120 } },
                { id: 'ij_eliminate', name: '前置清除：工厂守卫', desc: '击杀8名工业区敌人', target: 8, type: 'kill_any', reward: { money: 10000, xp: 180 } },
                { id: 'ij_boss', name: '最终决战：工业铁卫', desc: '击败工业铁卫·壁垒', target: 1, type: 'kill_boss_industrial_juggernaut', reward: { money: 60000, xp: 600, skin: 'industrial_shield' } }
            ]
        },
        'military_commander': {
            bossName: '军事指挥官·烈阳',
            bossIcon: '🎖️',
            chain: [
                { id: 'mc_intel', name: '情报收集：军事密报', desc: '搜索军事基地的指挥中心，获取指挥官情报', target: 3, type: 'search_containers', reward: { money: 8000, xp: 150 } },
                { id: 'mc_eliminate', name: '前置清除：精锐部队', desc: '击杀10名军事基地敌人', target: 10, type: 'kill_any', reward: { money: 12000, xp: 200 } },
                { id: 'mc_boss', name: '最终决战：军事指挥官', desc: '击败军事指挥官·烈阳', target: 1, type: 'kill_boss_military_commander', reward: { money: 80000, xp: 800, skin: 'military_pistol' } }
            ]
        },
        'port_colossus': {
            bossName: '港口巨像·深渊',
            bossIcon: '⚙️',
            chain: [
                { id: 'pc_intel', name: '情报收集：远古遗迹', desc: '搜索港口区域的集装箱，获取巨像资料', target: 4, type: 'search_containers', reward: { money: 10000, xp: 180 } },
                { id: 'pc_eliminate', name: '前置清除：机械守卫', desc: '击杀12名港口敌人', target: 12, type: 'kill_any', reward: { money: 15000, xp: 250 } },
                { id: 'pc_boss', name: '最终决战：港口巨像', desc: '击败港口巨像·深渊', target: 1, type: 'kill_boss_port_colossus', reward: { money: 100000, xp: 1000, skin: 'colossus_laser' } }
            ]
        },
        'forest_shaman': {
            bossName: '密林祭司·毒藤',
            bossIcon: '🌿',
            chain: [
                { id: 'fs_intel', name: '情报收集：堕落传说', desc: '搜索密林深处的祭坛，获取祭司传说', target: 3, type: 'search_containers', reward: { money: 7000, xp: 140 } },
                { id: 'fs_eliminate', name: '前置清除：邪教徒', desc: '击杀7名密林敌人', target: 7, type: 'kill_any', reward: { money: 9000, xp: 160 } },
                { id: 'fs_boss', name: '最终决战：密林祭司', desc: '击败密林祭司·毒藤', target: 1, type: 'kill_boss_forest_shaman', reward: { money: 70000, xp: 700, skin: 'shaman_staff' } }
            ]
        },
        'shadow_assassin': {
            bossName: '暗影刺客·夜刃',
            bossIcon: '🗡️',
            chain: [
                { id: 'sa_intel', name: '情报收集：暗夜传闻', desc: '搜索5个任意区域容器，收集刺客情报', target: 5, type: 'search_containers', reward: { money: 12000, xp: 200 } },
                { id: 'sa_eliminate', name: '前置清除：暗影佣兵', desc: '击杀15名敌人', target: 15, type: 'kill_any', reward: { money: 18000, xp: 300 } },
                { id: 'sa_boss', name: '最终决战：暗影刺客', desc: '击败暗影刺客·夜刃', target: 1, type: 'kill_boss_shadow_assassin', reward: { money: 120000, xp: 1200, skin: 'assassin_blades' } }
            ]
        },
        'lava_behemoth': {
            bossName: '熔岩巨兽·炎魔',
            bossIcon: '🌋',
            chain: [
                { id: 'lb_intel', name: '情报收集：地心异动', desc: '搜索6个任意区域容器，收集巨兽情报', target: 6, type: 'search_containers', reward: { money: 15000, xp: 250 } },
                { id: 'lb_eliminate', name: '前置清除：火焰元素', desc: '击杀20名敌人', target: 20, type: 'kill_any', reward: { money: 25000, xp: 400 } },
                { id: 'lb_boss', name: '最终决战：熔岩巨兽', desc: '击败熔岩巨兽·炎魔', target: 1, type: 'kill_boss_lava_behemoth', reward: { money: 150000, xp: 1500, skin: 'lava_gauntlets' } }
            ]
        }
    };

    // ============================================================
    // 三、BOSS成就系统
    // ============================================================
    const BOSS_ACHIEVEMENTS = {
        // 首次击杀成就
        'first_kill_forest_hunter': { name: '初猎·暗影', desc: '首次击败森林猎手·暗影', icon: '🏹', rarity: 'common', reward: { money: 10000, xp: 200 } },
        'first_kill_industrial_juggernaut': { name: '初破·壁垒', desc: '首次击败工业铁卫·壁垒', icon: '🛡️', rarity: 'common', reward: { money: 12000, xp: 250 } },
        'first_kill_military_commander': { name: '初胜·烈阳', desc: '首次击败军事指挥官·烈阳', icon: '🎖️', rarity: 'rare', reward: { money: 15000, xp: 300 } },
        'first_kill_port_colossus': { name: '初陨·深渊', desc: '首次击败港口巨像·深渊', icon: '⚙️', rarity: 'rare', reward: { money: 20000, xp: 400 } },
        'first_kill_forest_shaman': { name: '初净·毒藤', desc: '首次击败密林祭司·毒藤', icon: '🌿', rarity: 'common', reward: { money: 12000, xp: 250 } },
        'first_kill_shadow_assassin': { name: '初斩·夜刃', desc: '首次击败暗影刺客·夜刃', icon: '🗡️', rarity: 'epic', reward: { money: 30000, xp: 500 } },
        'first_kill_lava_behemoth': { name: '初熄·炎魔', desc: '首次击败熔岩巨兽·炎魔', icon: '🌋', rarity: 'epic', reward: { money: 35000, xp: 600 } },

        // 无伤击杀成就
        'flawless_forest_hunter': { name: '完美狩猎', desc: '无伤击败森林猎手', icon: '💎', rarity: 'epic', reward: { money: 50000, xp: 800 } },
        'flawless_industrial_juggernaut': { name: '铜墙铁壁', desc: '无伤击败工业铁卫', icon: '💎', rarity: 'epic', reward: { money: 60000, xp: 900 } },
        'flawless_military_commander': { name: '战术大师', desc: '无伤击败军事指挥官', icon: '💎', rarity: 'legendary', reward: { money: 80000, xp: 1200 } },

        // 限时击杀成就
        'speedrun_forest_hunter': { name: '疾风猎手', desc: '60秒内击败森林猎手', icon: '⚡', rarity: 'rare', reward: { money: 30000, xp: 500 } },
        'speedrun_any_boss': { name: '速杀专家', desc: '120秒内击败任意BOSS', icon: '⚡', rarity: 'rare', reward: { money: 25000, xp: 400 } },

        // 综合成就
        'boss_hunter': { name: 'BOSS猎人', desc: '击败3种不同的BOSS', icon: '🏆', rarity: 'rare', reward: { money: 50000, xp: 800 } },
        'boss_slayer': { name: 'BOSS屠戮者', desc: '击败5种不同的BOSS', icon: '🏆', rarity: 'epic', reward: { money: 100000, xp: 1500 } },
        'boss_legend': { name: 'BOSS传说', desc: '击败全部7种BOSS', icon: '👑', rarity: 'legendary', reward: { money: 300000, xp: 5000 } },
        'boss_10_kills': { name: '百战BOSS', desc: '累计击杀10个BOSS', icon: '🎯', rarity: 'epic', reward: { money: 80000, xp: 1200 } },
        'boss_50_kills': { name: '千锤百炼', desc: '累计击杀50个BOSS', icon: '🎯', rarity: 'legendary', reward: { money: 200000, xp: 3000 } }
    };

    // ============================================================
    // 四、BOSS皮肤系统
    // ============================================================
    const BOSS_SKINS = {
        'forest_hunter_bow': { name: '暗影猎弓', icon: '🏹', weapon: 'hk416', desc: '森林猎手的专属猎弓皮肤，带有绿色流光特效', color: 0x44ff88, unlocked: false },
        'industrial_shield': { name: '壁垒护盾', icon: '🛡️', weapon: 'lmg', desc: '工业铁卫的重型护盾皮肤，蓝色能量护盾特效', color: 0x00ccff, unlocked: false },
        'military_pistol': { name: '烈阳手枪', icon: '🎖️', weapon: 'deagle', desc: '军事指挥官的配枪，金色枪身红色装饰', color: 0xffd700, unlocked: false },
        'colossus_laser': { name: '深渊激光', icon: '⚙️', weapon: 'antiMaterial', desc: '港口巨像的激光武器，青色能量核心', color: 0x00ffaa, unlocked: false },
        'shaman_staff': { name: '毒藤法杖', icon: '🌿', weapon: 'dmr', desc: '密林祭司的法杖，紫色毒雾缠绕', color: 0xaa44ff, unlocked: false },
        'assassin_blades': { name: '夜刃双刃', icon: '🗡️', weapon: 'vector', desc: '暗影刺客的双刃，粉色暗影流光', color: 0xff44aa, unlocked: false },
        'lava_gauntlets': { name: '炎魔护手', icon: '🌋', weapon: 'hmg', desc: '熔岩巨兽的护手，橙色熔岩流动特效', color: 0xff6600, unlocked: false }
    };

    // ============================================================
    // 五、BOSS排行榜
    // ============================================================
    const BOSS_LEADERBOARD = {
        // 每个BOSS的最快击杀记录
        records: {},
        // 全局排行榜
        global: []
    };

    // ============================================================
    // 六、初始化
    // ============================================================
    function init() {
        if (_initialized) return;
        _loadProgress();
        _createBossMissionPanel();
        _createBossAchievementPanel();
        _createBossLeaderboardPanel();
        _initialized = true;
        console.log('[BossExtensions] BOSS扩展模块初始化完成');
    }

    function _loadProgress() {
        // 从localStorage加载BOSS任务、成就、皮肤、排行榜进度
        try {
            const saved = localStorage.getItem('boss_extensions_progress');
            if (saved) {
                const data = JSON.parse(saved);
                if (data.missionProgress) _missionProgress = data.missionProgress;
                if (data.achievements) _unlockedAchievements = data.achievements;
                if (data.skins) _unlockedSkins = data.skins;
                if (data.leaderboard) BOSS_LEADERBOARD.records = data.leaderboard;
                if (data.global) BOSS_LEADERBOARD.global = data.global;
            }
        } catch (e) {
            console.log('[BossExtensions] 加载进度失败:', e);
        }
    }

    function _saveProgress() {
        try {
            const data = {
                missionProgress: _missionProgress,
                achievements: _unlockedAchievements,
                skins: _unlockedSkins,
                leaderboard: BOSS_LEADERBOARD.records,
                global: BOSS_LEADERBOARD.global
            };
            localStorage.setItem('boss_extensions_progress', JSON.stringify(data));
        } catch (e) {
            console.log('[BossExtensions] 保存进度失败:', e);
        }
    }

    let _missionProgress = {};
    let _unlockedAchievements = {};
    let _unlockedSkins = {};
    let _currentBossFight = null; // {bossType, startTime, damageTaken}

    // ============================================================
    // 七、BOSS任务链UI
    // ============================================================
    function _createBossMissionPanel() {
        const panel = document.createElement('div');
        panel.id = 'bossMissionPanel';
        panel.style.cssText = `
            position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
            width:700px;max-height:80vh;background:rgba(15,15,25,0.97);
            border:2px solid #ff4444;border-radius:12px;z-index:500;
            display:none;overflow-y:auto;padding:20px;
            font-family:'Microsoft YaHei',sans-serif;color:#fff;
            box-shadow:0 0 40px rgba(255,50,50,0.4);
        `;
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <h2 style="color:#ff4444;margin:0;font-size:24px;">⚔️ BOSS任务链</h2>
                <button onclick="BossExtensions.closeMissionPanel()" style="background:#333;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:16px;">✕ 关闭</button>
            </div>
            <div id="bossMissionList" style="display:flex;flex-direction:column;gap:12px;"></div>
        `;
        document.body.appendChild(panel);
        _bossMissionPanel = panel;
    }

    function openMissionPanel() {
        if (!_bossMissionPanel) _createBossMissionPanel();
        _renderMissionList();
        _bossMissionPanel.style.display = 'block';
    }

    function closeMissionPanel() {
        if (_bossMissionPanel) _bossMissionPanel.style.display = 'none';
    }

    function _renderMissionList() {
        const container = document.getElementById('bossMissionList');
        if (!container) return;

        let html = '';
        for (const bossType in BOSS_MISSION_CHAINS) {
            const chain = BOSS_MISSION_CHAINS[bossType];
            const progress = _missionProgress[bossType] || { currentStep: 0, steps: {} };

            html += `
                <div style="background:rgba(40,40,60,0.8);border:1px solid #444;border-radius:8px;padding:15px;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                        <span style="font-size:28px;">${chain.bossIcon}</span>
                        <div>
                            <div style="font-size:18px;font-weight:bold;color:#ff8866;">${chain.bossName}</div>
                            <div style="font-size:12px;color:#888;">任务进度: ${Math.min(progress.currentStep + 1, chain.chain.length)}/${chain.chain.length}</div>
                        </div>
                    </div>
            `;

            chain.chain.forEach((mission, idx) => {
                const stepProgress = progress.steps[mission.id] || { progress: 0, completed: false, claimed: false };
                const isLocked = idx > progress.currentStep;
                const isCurrent = idx === progress.currentStep;
                const statusColor = stepProgress.completed ? '#44ff44' : (isCurrent ? '#ffaa00' : '#666');
                const lockIcon = isLocked ? '🔒' : (stepProgress.completed ? '✅' : (isCurrent ? '⏳' : '⬜'));

                html += `
                    <div style="background:${isLocked ? 'rgba(30,30,40,0.5)' : 'rgba(50,50,70,0.6)'};border-left:3px solid ${statusColor};border-radius:4px;padding:10px;margin-top:8px;opacity:${isLocked ? 0.5 : 1};">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <div>
                                <span style="margin-right:8px;">${lockIcon}</span>
                                <span style="font-weight:bold;color:${statusColor};">${mission.name}</span>
                                <span style="font-size:11px;color:#888;margin-left:10px;">${mission.desc}</span>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:12px;color:#aaa;">${stepProgress.progress}/${mission.target}</div>
                                ${stepProgress.completed && !stepProgress.claimed ? `<button onclick="BossExtensions.claimMissionReward('${bossType}','${mission.id}')" style="background:#ff8800;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;margin-top:4px;">领取奖励</button>` : ''}
                                ${stepProgress.claimed ? '<span style="color:#44ff44;font-size:12px;">已领取</span>' : ''}
                            </div>
                        </div>
                        <div style="margin-top:6px;font-size:11px;color:#ffd700;">
                            奖励: ₵${mission.reward.money.toLocaleString()} | ${mission.reward.xp} XP${mission.reward.skin ? ' | 皮肤:' + BOSS_SKINS[mission.reward.skin].name : ''}
                        </div>
                    </div>
                `;
            });

            html += '</div>';
        }

        container.innerHTML = html;
    }

    function updateMissionProgress(type, amount) {
        // 更新任务进度（由game.js中的trackMission调用）
        for (const bossType in BOSS_MISSION_CHAINS) {
            const chain = BOSS_MISSION_CHAINS[bossType];
            const progress = _missionProgress[bossType] || { currentStep: 0, steps: {} };
            _missionProgress[bossType] = progress;

            const currentMission = chain.chain[progress.currentStep];
            if (!currentMission) continue;

            if (currentMission.type === type || (type === 'kill_boss' && currentMission.type.startsWith('kill_boss_'))) {
                const stepProgress = progress.steps[currentMission.id] || { progress: 0, completed: false, claimed: false };
                stepProgress.progress = Math.min(currentMission.target, stepProgress.progress + amount);
                if (stepProgress.progress >= currentMission.target && !stepProgress.completed) {
                    stepProgress.completed = true;
                    _showMissionCompleteNotification(currentMission);
                }
                progress.steps[currentMission.id] = stepProgress;
            }
        }
        _saveProgress();
    }

    function claimMissionReward(bossType, missionId) {
        const chain = BOSS_MISSION_CHAINS[bossType];
        const mission = chain.chain.find(m => m.id === missionId);
        const progress = _missionProgress[bossType];
        if (!mission || !progress) return;

        const stepProgress = progress.steps[missionId];
        if (!stepProgress.completed || stepProgress.claimed) return;

        stepProgress.claimed = true;

        // 发放奖励
        if (typeof P !== 'undefined') {
            P.money = (P.money || 0) + mission.reward.money;
            P.xp = (P.xp || 0) + mission.reward.xp;
        }

        // 解锁皮肤
        if (mission.reward.skin) {
            unlockSkin(mission.reward.skin);
        }

        // 推进到下一步
        const missionIdx = chain.chain.findIndex(m => m.id === missionId);
        if (missionIdx === progress.currentStep && progress.currentStep < chain.chain.length - 1) {
            progress.currentStep++;
        }

        _saveProgress();
        _renderMissionList();
        _showRewardNotification(mission.reward);
    }

    function _showMissionCompleteNotification(mission) {
        const div = document.createElement('div');
        div.style.cssText = `
            position:fixed;top:30%;left:50%;transform:translateX(-50%);
            background:rgba(0,80,0,0.95);border:2px solid #44ff44;border-radius:8px;
            padding:15px 40px;color:#44ff44;font-size:18px;font-weight:bold;
            z-index:600;pointer-events:none;animation:missionComplete 0.5s ease-out;
        `;
        div.textContent = '✅ 任务完成: ' + mission.name;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 2500);
    }

    function _showRewardNotification(reward) {
        const div = document.createElement('div');
        div.style.cssText = `
            position:fixed;top:35%;left:50%;transform:translateX(-50%);
            background:rgba(80,60,0,0.95);border:2px solid #ffd700;border-radius:8px;
            padding:15px 40px;color:#ffd700;font-size:16px;
            z-index:600;pointer-events:none;
        `;
        div.innerHTML = `🎁 获得奖励: ₵${reward.money.toLocaleString()} | ${reward.xp} XP${reward.skin ? ' | 皮肤: ' + BOSS_SKINS[reward.skin].name : ''}`;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    // ============================================================
    // 八、成就系统
    // ============================================================
    function _createBossAchievementPanel() {
        const panel = document.createElement('div');
        panel.id = 'bossAchievementPanel';
        panel.style.cssText = `
            position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
            width:750px;max-height:80vh;background:rgba(15,15,25,0.97);
            border:2px solid #ffd700;border-radius:12px;z-index:500;
            display:none;overflow-y:auto;padding:20px;
            font-family:'Microsoft YaHei',sans-serif;color:#fff;
            box-shadow:0 0 40px rgba(255,215,0,0.4);
        `;
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <h2 style="color:#ffd700;margin:0;font-size:24px;">🏆 BOSS成就</h2>
                <button onclick="BossExtensions.closeAchievementPanel()" style="background:#333;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:16px;">✕ 关闭</button>
            </div>
            <div id="bossAchievementList" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;"></div>
        `;
        document.body.appendChild(panel);
        _bossAchievementPanel = panel;
    }

    function openAchievementPanel() {
        if (!_bossAchievementPanel) _createBossAchievementPanel();
        _renderAchievementList();
        _bossAchievementPanel.style.display = 'block';
    }

    function closeAchievementPanel() {
        if (_bossAchievementPanel) _bossAchievementPanel.style.display = 'none';
    }

    function _renderAchievementList() {
        const container = document.getElementById('bossAchievementList');
        if (!container) return;

        const rarityColors = { common: '#888', rare: '#4488ff', epic: '#aa44ff', legendary: '#ffd700' };
        let html = '';

        for (const id in BOSS_ACHIEVEMENTS) {
            const ach = BOSS_ACHIEVEMENTS[id];
            const unlocked = _unlockedAchievements[id];
            const color = rarityColors[ach.rarity] || '#888';

            html += `
                <div style="background:${unlocked ? 'rgba(60,60,40,0.8)' : 'rgba(30,30,40,0.6)'};border:1px solid ${unlocked ? color : '#333'};border-radius:8px;padding:12px;opacity:${unlocked ? 1 : 0.6};">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:32px;filter:${unlocked ? 'none' : 'grayscale(100%)'};">${ach.icon}</span>
                        <div style="flex:1;">
                            <div style="font-weight:bold;color:${unlocked ? color : '#666'};">${ach.name}</div>
                            <div style="font-size:11px;color:#888;">${ach.desc}</div>
                            <div style="font-size:11px;color:#ffd700;margin-top:4px;">奖励: ₵${ach.reward.money.toLocaleString()} | ${ach.reward.xp} XP</div>
                        </div>
                        ${unlocked ? '<span style="color:#44ff44;font-size:20px;">✓</span>' : '<span style="color:#444;font-size:20px;">🔒</span>'}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    function unlockAchievement(id) {
        if (_unlockedAchievements[id]) return;
        const ach = BOSS_ACHIEVEMENTS[id];
        if (!ach) return;

        _unlockedAchievements[id] = { unlockedAt: Date.now() };

        // 发放奖励
        if (typeof P !== 'undefined') {
            P.money = (P.money || 0) + ach.reward.money;
            P.xp = (P.xp || 0) + ach.reward.xp;
        }

        _saveProgress();
        _showAchievementUnlockNotification(ach);
    }

    function _showAchievementUnlockNotification(ach) {
        const div = document.createElement('div');
        div.style.cssText = `
            position:fixed;top:20%;left:50%;transform:translateX(-50%);
            background:linear-gradient(135deg,rgba(80,60,0,0.95),rgba(40,30,0,0.95));
            border:2px solid #ffd700;border-radius:10px;
            padding:20px 50px;color:#ffd700;text-align:center;
            z-index:700;pointer-events:none;animation:achUnlock 0.8s ease-out;
            box-shadow:0 0 30px rgba(255,215,0,0.6);
        `;
        div.innerHTML = `
            <div style="font-size:14px;color:#aaa;margin-bottom:5px;">🏆 成就解锁</div>
            <div style="font-size:36px;">${ach.icon}</div>
            <div style="font-size:20px;font-weight:bold;margin-top:5px;">${ach.name}</div>
            <div style="font-size:12px;color:#aaa;margin-top:5px;">${ach.desc}</div>
        `;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 4000);
    }

    function checkBossKillAchievements(bossType, killTime, damageTaken) {
        // 首次击杀
        unlockAchievement('first_kill_' + bossType);

        // 无伤击杀
        if (damageTaken === 0) {
            if (bossType === 'forest_hunter') unlockAchievement('flawless_forest_hunter');
            if (bossType === 'industrial_juggernaut') unlockAchievement('flawless_industrial_juggernaut');
            if (bossType === 'military_commander') unlockAchievement('flawless_military_commander');
        }

        // 限时击杀
        if (killTime <= 60 && bossType === 'forest_hunter') unlockAchievement('speedrun_forest_hunter');
        if (killTime <= 120) unlockAchievement('speedrun_any_boss');

        // 累计不同BOSS
        const killedBosses = Object.keys(_unlockedAchievements).filter(id => id.startsWith('first_kill_'));
        if (killedBosses.length >= 3) unlockAchievement('boss_hunter');
        if (killedBosses.length >= 5) unlockAchievement('boss_slayer');
        if (killedBosses.length >= 7) unlockAchievement('boss_legend');

        // 累计击杀数
        const totalKills = (BOSS_LEADERBOARD.global || []).length;
        if (totalKills >= 10) unlockAchievement('boss_10_kills');
        if (totalKills >= 50) unlockAchievement('boss_50_kills');
    }

    // ============================================================
    // 九、皮肤系统
    // ============================================================
    function unlockSkin(skinId) {
        if (_unlockedSkins[skinId]) return;
        const skin = BOSS_SKINS[skinId];
        if (!skin) return;

        _unlockedSkins[skinId] = { unlockedAt: Date.now() };
        skin.unlocked = true;
        _saveProgress();

        const div = document.createElement('div');
        div.style.cssText = `
            position:fixed;top:25%;left:50%;transform:translateX(-50%);
            background:linear-gradient(135deg,rgba(0,60,80,0.95),rgba(0,30,40,0.95));
            border:2px solid #00ccff;border-radius:10px;
            padding:20px 50px;color:#00ccff;text-align:center;
            z-index:700;pointer-events:none;
            box-shadow:0 0 30px rgba(0,200,255,0.6);
        `;
        div.innerHTML = `
            <div style="font-size:14px;color:#aaa;margin-bottom:5px;">🎨 皮肤解锁</div>
            <div style="font-size:36px;">${skin.icon}</div>
            <div style="font-size:20px;font-weight:bold;margin-top:5px;">${skin.name}</div>
            <div style="font-size:12px;color:#aaa;margin-top:5px;">${skin.desc}</div>
        `;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 4000);
    }

    function getUnlockedSkins() {
        return _unlockedSkins;
    }

    function isSkinUnlocked(skinId) {
        return !!_unlockedSkins[skinId];
    }

    // ============================================================
    // 十、排行榜系统
    // ============================================================
    function _createBossLeaderboardPanel() {
        const panel = document.createElement('div');
        panel.id = 'bossLeaderboardPanel';
        panel.style.cssText = `
            position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
            width:600px;max-height:80vh;background:rgba(15,15,25,0.97);
            border:2px solid #44aaff;border-radius:12px;z-index:500;
            display:none;overflow-y:auto;padding:20px;
            font-family:'Microsoft YaHei',sans-serif;color:#fff;
            box-shadow:0 0 40px rgba(68,170,255,0.4);
        `;
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <h2 style="color:#44aaff;margin:0;font-size:24px;">📊 BOSS排行榜</h2>
                <button onclick="BossExtensions.closeLeaderboardPanel()" style="background:#333;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:16px;">✕ 关闭</button>
            </div>
            <div id="bossLeaderboardContent"></div>
        `;
        document.body.appendChild(panel);
        _bossLeaderboardPanel = panel;
    }

    function openLeaderboardPanel() {
        if (!_bossLeaderboardPanel) _createBossLeaderboardPanel();
        _renderLeaderboard();
        _bossLeaderboardPanel.style.display = 'block';
    }

    function closeLeaderboardPanel() {
        if (_bossLeaderboardPanel) _bossLeaderboardPanel.style.display = 'none';
    }

    function _renderLeaderboard() {
        const container = document.getElementById('bossLeaderboardContent');
        if (!container) return;

        let html = '<h3 style="color:#ffd700;margin-bottom:10px;">最快击杀记录</h3>';
        html += '<div style="display:flex;flex-direction:column;gap:8px;">';

        for (const bossType in BOSS_MISSION_CHAINS) {
            const chain = BOSS_MISSION_CHAINS[bossType];
            const record = BOSS_LEADERBOARD.records[bossType];
            html += `
                <div style="background:rgba(40,40,60,0.8);border-radius:6px;padding:10px;display:flex;justify-content:space-between;align-items:center;">
                    <div><span style="font-size:20px;margin-right:8px;">${chain.bossIcon}</span><span style="font-weight:bold;">${chain.bossName}</span></div>
                    <div style="color:${record ? '#44ff44' : '#666'};font-size:14px;">${record ? record.toFixed(1) + ' 秒' : '暂无记录'}</div>
                </div>
            `;
        }

        html += '</div>';

        // 全局击杀统计
        const totalKills = (BOSS_LEADERBOARD.global || []).length;
        html += `
            <h3 style="color:#ffd700;margin:20px 0 10px;">击杀统计</h3>
            <div style="background:rgba(40,40,60,0.8);border-radius:6px;padding:15px;text-align:center;">
                <div style="font-size:36px;color:#ff8844;font-weight:bold;">${totalKills}</div>
                <div style="font-size:14px;color:#888;">累计BOSS击杀</div>
            </div>
        `;

        container.innerHTML = html;
    }

    function recordBossKill(bossType, killTime) {
        // 更新最快记录
        const currentRecord = BOSS_LEADERBOARD.records[bossType];
        if (!currentRecord || killTime < currentRecord) {
            BOSS_LEADERBOARD.records[bossType] = killTime;
            _showNewRecordNotification(bossType, killTime);
        }

        // 添加到全局记录
        if (!BOSS_LEADERBOARD.global) BOSS_LEADERBOARD.global = [];
        BOSS_LEADERBOARD.global.push({ bossType, killTime, timestamp: Date.now() });

        _saveProgress();
    }

    function _showNewRecordNotification(bossType, time) {
        const chain = BOSS_MISSION_CHAINS[bossType];
        const div = document.createElement('div');
        div.style.cssText = `
            position:fixed;top:15%;left:50%;transform:translateX(-50%);
            background:linear-gradient(135deg,rgba(80,60,0,0.95),rgba(40,30,0,0.95));
            border:2px solid #ffd700;border-radius:10px;
            padding:15px 40px;color:#ffd700;text-align:center;
            z-index:700;pointer-events:none;
            box-shadow:0 0 30px rgba(255,215,0,0.6);
        `;
        div.innerHTML = `
            <div style="font-size:14px;">⚡ 新纪录！</div>
            <div style="font-size:24px;font-weight:bold;margin-top:5px;">${chain.bossIcon} ${chain.bossName}</div>
            <div style="font-size:20px;color:#44ff44;margin-top:5px;">${time.toFixed(1)} 秒</div>
        `;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3500);
    }

    // ============================================================
    // 十一、BOSS战开始/结束追踪
    // ============================================================
    function startBossFight(bossType) {
        _currentBossFight = {
            bossType,
            startTime: performance.now() / 1000,
            damageTaken: 0,
            startHealth: typeof S !== 'undefined' ? S.health : 100
        };
    }

    function endBossFight(bossType, killed) {
        if (!_currentBossFight) return;

        const killTime = performance.now() / 1000 - _currentBossFight.startTime;
        const damageTaken = _currentBossFight.startHealth - (typeof S !== 'undefined' ? S.health : 100);

        if (killed) {
            recordBossKill(bossType, killTime);
            checkBossKillAchievements(bossType, killTime, Math.max(0, damageTaken));
        }

        _currentBossFight = null;
    }

    function getCurrentBossFight() {
        return _currentBossFight;
    }

    // ============================================================
    // 十二、小兵装备可视化
    // ============================================================
    function applyGruntVisualization(enemy) {
        if (!enemy.gruntClass || !enemy.mesh) return;

        const classDef = (typeof BossSystemV2 !== 'undefined' && BossSystemV2.GRUNT_CLASSES)
            ? BossSystemV2.GRUNT_CLASSES[enemy.gruntClass]
            : null;
        if (!classDef) return;

        const grp = enemy.mesh;

        // 根据兵种添加可视化装备
        switch (enemy.gruntClass) {
            case 'rifleman':
                _addWeaponMesh(grp, 'rifle', 0x333333);
                _addArmorVest(grp, 0x4a5a3a);
                _addHelmet(grp, 0x4a5a3a, false);
                break;
            case 'assault':
                _addWeaponMesh(grp, 'smg', 0x222222);
                _addArmorVest(grp, 0x5a3a3a);
                _addHelmet(grp, 0x5a3a3a, false);
                _addFaceMask(grp, 0x333333);
                break;
            case 'marksman':
                _addWeaponMesh(grp, 'dmr', 0x2a2a2a);
                _addArmorVest(grp, 0x3a4a5a);
                _addHelmet(grp, 0x3a4a5a, true);
                _addScope(grp);
                break;
            case 'support':
                _addWeaponMesh(grp, 'lmg', 0x333333);
                _addArmorVest(grp, 0x5a4a2a, true);
                _addHelmet(grp, 0x5a4a2a, false);
                _addAmmoBelt(grp);
                break;
            case 'engineer':
                _addWeaponMesh(grp, 'grenade', 0x444444);
                _addArmorVest(grp, 0x4a3a5a);
                _addHelmet(grp, 0x4a3a5a, false);
                _addToolBelt(grp);
                break;
            case 'sniper':
                _addWeaponMesh(grp, 'sniper', 0x1a1a1a);
                _addArmorVest(grp, 0x2a3a2a, true);
                _addHelmet(grp, 0x2a3a2a, true);
                _addGhillieSuit(grp);
                break;
            case 'shotgunner':
                _addWeaponMesh(grp, 'shotgun', 0x3a2a2a);
                _addArmorVest(grp, 0x5a2a2a, true);
                _addHelmet(grp, 0x5a2a2a, false);
                _addFaceMask(grp, 0x222222);
                break;
            case 'officer':
                _addWeaponMesh(grp, 'pistol', 0x222222);
                _addExosuit(grp, 0x3a3a5a);
                _addHelmet(grp, 0x3a3a5a, true);
                _addOfficerCap(grp);
                break;
        }
    }

    function _addWeaponMesh(grp, type, color) {
        const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.4 });
        let weapon;
        switch (type) {
            case 'rifle':
                weapon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.5), mat);
                weapon.position.set(0.35, 1.0, 0.25);
                break;
            case 'smg':
                weapon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.3), mat);
                weapon.position.set(0.35, 1.0, 0.2);
                break;
            case 'dmr':
            case 'sniper':
                weapon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.7), mat);
                weapon.position.set(0.35, 1.0, 0.3);
                break;
            case 'lmg':
                weapon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.55), mat);
                weapon.position.set(0.35, 0.95, 0.28);
                break;
            case 'shotgun':
                weapon = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.45), mat);
                weapon.position.set(0.35, 1.0, 0.25);
                break;
            case 'pistol':
                weapon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.18), mat);
                weapon.position.set(0.35, 1.0, 0.15);
                break;
            case 'grenade':
                weapon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.15, 8), mat);
                weapon.position.set(0.35, 1.0, 0.15);
                break;
        }
        if (weapon) {
            weapon.castShadow = true;
            grp.add(weapon);
        }
    }

    function _addArmorVest(grp, color, heavy) {
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3 });
        const vest = new THREE.Mesh(
            new THREE.BoxGeometry(heavy ? 0.7 : 0.6, heavy ? 0.8 : 0.65, heavy ? 0.35 : 0.3),
            mat
        );
        vest.position.set(0, 1.2, 0);
        vest.castShadow = true;
        grp.add(vest);
    }

    function _addHelmet(grp, color, hasVisor) {
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4 });
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
        helmet.position.set(0, 1.85, 0);
        helmet.castShadow = true;
        grp.add(helmet);

        if (hasVisor) {
            const visorMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.6 });
            const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.05), visorMat);
            visor.position.set(0, 1.85, 0.22);
            grp.add(visor);
        }
    }

    function _addFaceMask(grp, color) {
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
        const mask = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.05), mat);
        mask.position.set(0, 1.75, 0.22);
        grp.add(mask);
    }

    function _addScope(grp) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 });
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), mat);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0.35, 1.1, 0.25);
        grp.add(scope);
    }

    function _addAmmoBelt(grp) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x665533, roughness: 0.8 });
        for (let i = 0; i < 5; i++) {
            const bullet = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 6), mat);
            bullet.position.set(-0.2 + i * 0.1, 0.9, 0.28);
            grp.add(bullet);
        }
    }

    function _addToolBelt(grp) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.7 });
        const belt = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 12), mat);
        belt.rotation.x = Math.PI / 2;
        belt.position.set(0, 0.85, 0);
        grp.add(belt);
    }

    function _addGhillieSuit(grp) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 0.9 });
        for (let i = 0; i < 8; i++) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), mat);
            strip.position.set(
                (Math.random() - 0.5) * 0.5,
                0.8 + Math.random() * 0.8,
                (Math.random() - 0.5) * 0.3
            );
            strip.rotation.z = (Math.random() - 0.5) * 0.5;
            grp.add(strip);
        }
    }

    function _addExosuit(grp, color) {
        const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3 });
        // 背部装置
        const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.15), mat);
        pack.position.set(0, 1.2, -0.25);
        grp.add(pack);
        // 腿部支架
        const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), mat);
        lLeg.position.set(-0.2, 0.5, 0);
        grp.add(lLeg);
        const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), mat);
        rLeg.position.set(0.2, 0.5, 0);
        grp.add(rLeg);
    }

    function _addOfficerCap(grp) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x2a2a4a, roughness: 0.5 });
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.08, 10), mat);
        cap.position.set(0, 2.0, 0);
        grp.add(cap);
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 10), mat);
        brim.position.set(0, 1.96, 0.05);
        grp.add(brim);
    }

    // ============================================================
    // 十三、BOSS战场景互动
    // ============================================================
    function spawnBattleArenaObjects(centerX, centerZ, radius) {
        _destructibleObjects = [];
        _explosiveObjects = [];
        _interactiveTraps = [];

        // 生成可破坏掩体
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dist = radius * 0.5 + Math.random() * radius * 0.3;
            const x = centerX + Math.cos(angle) * dist;
            const z = centerZ + Math.sin(angle) * dist;
            _createDestructibleCover(x, z);
        }

        // 生成爆炸物
        for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = radius * 0.3 + Math.random() * radius * 0.4;
            const x = centerX + Math.cos(angle) * dist;
            const z = centerZ + Math.sin(angle) * dist;
            _createExplosiveBarrel(x, z);
        }

        // 生成机关陷阱
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = radius * 0.4 + Math.random() * radius * 0.3;
            const x = centerX + Math.cos(angle) * dist;
            const z = centerZ + Math.sin(angle) * dist;
            _createTrapPanel(x, z);
        }
    }

    function _createDestructibleCover(x, z) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x665544, roughness: 0.8 });
        const cover = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.4), mat);
        cover.position.set(x, 0.5, z);
        cover.castShadow = true;
        cover.receiveShadow = true;
        scene.add(cover);

        const obj = { mesh: cover, health: 50, maxHealth: 50, x, z, type: 'cover' };
        _destructibleObjects.push(obj);

        // 添加到障碍物
        if (typeof obstacles !== 'undefined') {
            obstacles.push({ mesh: cover, isAABB: true, halfW: 0.75, halfD: 0.2, height: 1.0 });
        }
    }

    function _createExplosiveBarrel(x, z) {
        const mat = new THREE.MeshStandardMaterial({ color: 0xcc3300, roughness: 0.5, metalness: 0.6, emissive: 0x331100, emissiveIntensity: 0.3 });
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 12), mat);
        barrel.position.set(x, 0.4, z);
        barrel.castShadow = true;
        scene.add(barrel);

        // 警告标志
        const warnMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const warn = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.02), warnMat);
        warn.position.set(x, 0.5, z + 0.26);
        scene.add(warn);

        const obj = { mesh: barrel, warnMesh: warn, health: 20, maxHealth: 20, x, z, type: 'explosive', exploded: false };
        _explosiveObjects.push(obj);

        if (typeof obstacles !== 'undefined') {
            obstacles.push({ mesh: barrel, isAABB: true, halfW: 0.25, halfD: 0.25, height: 0.8 });
        }
    }

    function _createTrapPanel(x, z) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x444466, roughness: 0.3, metalness: 0.7, emissive: 0x222244, emissiveIntensity: 0.2 });
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 1.2), mat);
        panel.position.set(x, 0.025, z);
        panel.receiveShadow = true;
        scene.add(panel);

        const obj = { mesh: panel, x, z, type: 'trap', active: false, cooldown: 0 };
        _interactiveTraps.push(obj);
    }

    function updateBattleObjects(dt) {
        // 更新陷阱
        for (const trap of _interactiveTraps) {
            if (trap.cooldown > 0) {
                trap.cooldown -= dt;
                trap.mesh.material.emissiveIntensity = 0.1;
            } else {
                trap.mesh.material.emissiveIntensity = 0.3 + Math.sin(performance.now() * 0.005) * 0.1;
            }

            // 检测玩家是否踩中
            if (typeof playerGroup !== 'undefined' && trap.cooldown <= 0) {
                const dx = playerGroup.position.x - trap.x;
                const dz = playerGroup.position.z - trap.z;
                if (Math.abs(dx) < 0.6 && Math.abs(dz) < 0.6) {
                    _triggerTrap(trap);
                }
            }
        }
    }

    function _triggerTrap(trap) {
        trap.active = true;
        trap.cooldown = 5.0;
        trap.mesh.material.emissive.setHex(0xff0000);
        trap.mesh.material.emissiveIntensity = 0.8;

        // 对玩家造成伤害
        if (typeof S !== 'undefined') {
            S.health -= 15;
            if (typeof PlayerAnimation !== 'undefined') {
                PlayerAnimation.applyHitShake(0.5);
            }
        }

        // 电击特效
        if (typeof createHitEffect === 'function') {
            createHitEffect(new THREE.Vector3(trap.x, 0.5, trap.z), 0xffff00, 10);
        }

        setTimeout(() => {
            trap.mesh.material.emissive.setHex(0x222244);
        }, 500);
    }

    function damageExplosive(x, z, damage) {
        for (const exp of _explosiveObjects) {
            if (exp.exploded) continue;
            const dx = exp.x - x;
            const dz = exp.z - z;
            if (Math.sqrt(dx * dx + dz * dz) < 1.0) {
                exp.health -= damage;
                if (exp.health <= 0) {
                    _explodeBarrel(exp);
                }
                return true;
            }
        }
        return false;
    }

    function _explodeBarrel(exp) {
        if (exp.exploded) return;
        exp.exploded = true;

        // 爆炸特效
        if (typeof createHitEffect === 'function') {
            createHitEffect(new THREE.Vector3(exp.x, 0.8, exp.z), 0xff6600, 20);
        }

        // 范围伤害
        const explosionRadius = 5.0;
        const explosionDamage = 60;

        if (typeof playerGroup !== 'undefined') {
            const dx = playerGroup.position.x - exp.x;
            const dz = playerGroup.position.z - exp.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < explosionRadius) {
                const dmg = explosionDamage * (1 - dist / explosionRadius);
                if (typeof S !== 'undefined') S.health -= dmg;
                if (typeof PlayerAnimation !== 'undefined') PlayerAnimation.applyHitShake(dmg / 30);
            }
        }

        // 连锁爆炸
        for (const other of _explosiveObjects) {
            if (other === exp || other.exploded) continue;
            const dx = other.x - exp.x;
            const dz = other.z - exp.z;
            if (Math.sqrt(dx * dx + dz * dz) < explosionRadius) {
                setTimeout(() => _explodeBarrel(other), 200);
            }
        }

        // 移除模型
        scene.remove(exp.mesh);
        scene.remove(exp.warnMesh);

        // 从障碍物移除
        if (typeof obstacles !== 'undefined') {
            const idx = obstacles.findIndex(o => o.mesh === exp.mesh);
            if (idx >= 0) obstacles.splice(idx, 1);
        }
    }

    function damageCover(x, z, damage) {
        for (const cover of _destructibleObjects) {
            const dx = cover.x - x;
            const dz = cover.z - z;
            if (Math.abs(dx) < 1.0 && Math.abs(dz) < 0.5) {
                cover.health -= damage;
                if (cover.health <= 0) {
                    _destroyCover(cover);
                }
                return true;
            }
        }
        return false;
    }

    function _destroyCover(cover) {
        // 破坏特效
        if (typeof createHitEffect === 'function') {
            createHitEffect(new THREE.Vector3(cover.x, 0.5, cover.z), 0x886644, 15);
        }

        // 移除模型
        scene.remove(cover.mesh);

        // 从障碍物移除
        if (typeof obstacles !== 'undefined') {
            const idx = obstacles.findIndex(o => o.mesh === cover.mesh);
            if (idx >= 0) obstacles.splice(idx, 1);
        }

        // 从列表移除
        const idx = _destructibleObjects.indexOf(cover);
        if (idx >= 0) _destructibleObjects.splice(idx, 1);
    }

    function clearBattleObjects() {
        for (const cover of _destructibleObjects) {
            scene.remove(cover.mesh);
            if (typeof obstacles !== 'undefined') {
                const idx = obstacles.findIndex(o => o.mesh === cover.mesh);
                if (idx >= 0) obstacles.splice(idx, 1);
            }
        }
        for (const exp of _explosiveObjects) {
            scene.remove(exp.mesh);
            scene.remove(exp.warnMesh);
            if (typeof obstacles !== 'undefined') {
                const idx = obstacles.findIndex(o => o.mesh === exp.mesh);
                if (idx >= 0) obstacles.splice(idx, 1);
            }
        }
        for (const trap of _interactiveTraps) {
            scene.remove(trap.mesh);
        }
        _destructibleObjects = [];
        _explosiveObjects = [];
        _interactiveTraps = [];
    }

    // ============================================================
    // 十四、公共API
    // ============================================================
    return {
        init,
        EXTRA_BOSSES,
        BOSS_MISSION_CHAINS,
        BOSS_ACHIEVEMENTS,
        BOSS_SKINS,
        BOSS_LEADERBOARD,

        // 任务链
        openMissionPanel,
        closeMissionPanel,
        updateMissionProgress,
        claimMissionReward,

        // 成就
        openAchievementPanel,
        closeAchievementPanel,
        unlockAchievement,
        checkBossKillAchievements,

        // 皮肤
        unlockSkin,
        getUnlockedSkins,
        isSkinUnlocked,

        // 排行榜
        openLeaderboardPanel,
        closeLeaderboardPanel,
        isMissionPanelOpen: () => _bossMissionPanel && _bossMissionPanel.style.display === 'block',
        isAchievementPanelOpen: () => _bossAchievementPanel && _bossAchievementPanel.style.display === 'block',
        isLeaderboardPanelOpen: () => _bossLeaderboardPanel && _bossLeaderboardPanel.style.display === 'block',
        recordBossKill,

        // BOSS战追踪
        startBossFight,
        endBossFight,
        getCurrentBossFight,

        // 小兵可视化
        applyGruntVisualization,

        // 场景互动
        spawnBattleArenaObjects,
        updateBattleObjects,
        damageExplosive,
        damageCover,
        clearBattleObjects
    };
})();

// 全局访问
if (typeof window !== 'undefined') {
    window.BossExtensions = BossExtensions;
}
