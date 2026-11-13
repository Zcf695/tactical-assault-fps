// ============================================================
// 战术突击 - 搜打撤 v4.0
// Delta Force style tactical FPS with grid-based inventory
// ============================================================

// ========== SECTION 0: 初始化诊断通道（S-16） ==========
//
// 为什么需要这个：
// 本项目曾发生一次「所有道具一件都没生成」的事故 —— WorldProps 里引用了尚未初始化的
// let 变量触发 TDZ ReferenceError，异常被 rebuildMapEnvironment 的 try/catch 吞掉，
// 只留下一条 console.warn。游戏照常运行，只是地图空旷了，没有任何人发现。
//
// 根因不是那个 TDZ，而是三重静默叠加：try/catch 吞异常 + console.warn 不显眼 + typeof 守卫跳过。
// 所以这里做两件事：
//   1) reportInitError()：任何被吞掉的异常都必须留一条可查询的计数记录；
//   2) showFatalOverlay()：真正致命的缺失（缺 Three.js、缺 AI 模块）必须让玩家看见，
//      而不是让他在 3 FPS 里猜发生了什么。
//
// 「静默」这个物种一旦有了计数器，就不再静默。

const __initErrors = [];
const __initErrorSeen = Object.create(null);
const __bootedAt = Date.now();

(function initDiagnostics() {
    try {
        window.__initErrors = __initErrors;
        // 与 QA 约定的别名：tests/strategy.md 里称它为 __qa.swallowed
        window.__qa = window.__qa || {};
        Object.defineProperty(window.__qa, 'swallowed', {
            get: function () { return __initErrors; },
            configurable: true,
        });
        window.__qa.bootedAt = __bootedAt;
    } catch (e) { /* 诊断通道自身不允许抛错 */ }
})();

/**
 * 记录一个被捕获的异常。
 * 非致命错误按 where 去重（只留首条 + 计数），避免热路径上的重复 catch 撑爆数组。
 * @param {string} where  位置标识，写成 "函数名 或 文件:函数"，便于搜代码
 * @param {*} err
 * @param {{fatal?:boolean, once?:boolean}} [opts]
 */
function reportInitError(where, err, opts) {
    opts = opts || {};
    const fatal = opts.fatal === true;
    const once = opts.once !== false && !fatal;
    try {
        const msg = (err && err.message) ? err.message : String(err);
        if (once && __initErrorSeen[where]) {
            __initErrorSeen[where].count++;
            return;
        }
        const rec = {
            where: where,
            message: msg,
            stack: (err && err.stack) ? String(err.stack).split('\n').slice(0, 6).join('\n') : '',
            fatal: fatal,
            at: Date.now() - __bootedAt,
            count: 1,
        };
        if (once) __initErrorSeen[where] = rec;
        __initErrors.push(rec);
        if (fatal) console.error('[init:' + where + ']', err);
        else console.warn('[swallowed:' + where + ']', msg);
    } catch (e) { /* 诊断通道自身不允许抛错 */ }
}

/**
 * 全屏致命错误层：用于「缺了就跑不起来」的依赖。
 * z-index 高于加载界面(300)与所有 HUD，确保一定被看见。
 * @param {string} title
 * @param {string[]} lines
 */
function showFatalOverlay(title, lines) {
    try {
        let el = document.getElementById('fatalOverlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'fatalOverlay';
            el.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;' +
                'justify-content:center;background:rgba(6,8,12,0.94);backdrop-filter:blur(3px);' +
                'font-family:ui-monospace,Consolas,monospace;color:#d8dee8;padding:32px;';
            document.body.appendChild(el);
        }
        const body = (lines || []).map(function (l) {
            return '<li style="margin:6px 0;line-height:1.55">' + String(l)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</li>';
        }).join('');
        el.innerHTML =
            '<div style="max-width:760px;border:1px solid rgba(255,90,90,0.45);border-radius:10px;' +
            'background:rgba(20,10,12,0.96);padding:26px 30px">' +
            '<div style="font-size:13px;letter-spacing:2px;color:#ff6b6b;margin-bottom:10px">' +
            'INITIALIZATION FAILED / 初始化失败</div>' +
            '<div style="font-size:19px;font-weight:600;color:#fff;margin-bottom:14px">' + title + '</div>' +
            '<ul style="margin:0 0 16px 0;padding-left:20px;font-size:13px;color:#aab4c2">' + body + '</ul>' +
            '<div style="font-size:11px;color:#5f6b7a;border-top:1px solid rgba(255,255,255,0.08);' +
            'padding-top:12px">按 F5 重新加载。若反复出现，请检查 index.html 的 &lt;script&gt; 加载顺序' +
            '（顺序即架构契约，见 docs/architecture/overview.md §3.1）。' +
            '<br>另有 <span id="fatalOverlayCount">' + __initErrors.filter(function (e) { return !e.fatal; }).length +
            '</span> 条被吞掉的非致命异常（控制台执行 window.__initErrors 查看）</div>' +
            '</div>';
    } catch (e) { /* 不允许在错误处理里再抛错 */ }
}

/**
 * 断言致命模块已就位。返回 false 表示不应继续启动。
 * 只断言「缺了必然跑不对」的模块；可降级的模块只记入诊断通道，不阻断启动。
 */
function assertCriticalModules() {
    const fatalMissing = [];

    // Three.js：缺了连场景都建不出来（CDN 加载失败时最常见的症状是白屏 + 无红字）
    if (typeof THREE === 'undefined') {
        fatalMissing.push('THREE —— three.js 未加载。检查 index.html 第 1414 行的 ' +
            'cdnjs three.js r128 是否可达（断网 / CDN 被拦截时会白屏且控制台无报错）。' +
            '建议改用本地 vendor/three.min.js。');
    }
    // 敌人 AI：缺了没有可用的降级路径（旧的降级分支已按团队决策删除，它每帧 raycast，
    // 会完整复刻「单帧 399ms / FPS 3」的事故）。见 ADR-002 与本文件 updateEnemies()。
    if (typeof EnemyAI === 'undefined') {
        fatalMissing.push('EnemyAI —— enemy_ai.js 未加载。该模块是硬依赖（无降级实现），' +
            '需确保 index.html 中 <script src="enemy_ai.js"> 位于 game.js 之后。');
    }

    if (fatalMissing.length) {
        for (const m of fatalMissing) {
            reportInitError('assertCriticalModules', new Error(m), { fatal: true });
        }
        showFatalOverlay('关键模块未加载，游戏无法启动', fatalMissing);
        return false;
    }

    // 可降级的模块：只记录，继续运行（三级渲染回落 / 设置默认值都会兜住）
    // 注意：不能用 window[name] 判断 —— 这些模块是 <script> 顶层的 const 声明，
    // 存在于「全局词法环境」而不是 window 上，window.RenderPipeline 永远是 undefined。
    // 也不用 eval('typeof ' + name)，那会把 TDZ 检查绕成运行时求值。
    // 直接写 typeof，逐个列举。
    const degradable = [
        [typeof RenderPipeline, 'RenderPipeline', '渲染管线未加载：画面将回落到 GraphicsEnhancement 或裸 renderer.render（天空/IBL/ACES 后期/自适应分辨率全部失效）'],
        [typeof GraphicsEnhancement, 'GraphicsEnhancement', '美术增强未加载：材质不升级、无水波纹、无旧版后期链'],
        [typeof PBRTextures, 'PBRTextures', '程序化 PBR 贴图库未加载：材质回落到单张 Canvas 颜色贴图'],
        [typeof GameSettings, 'GameSettings', '设置模块未加载：用户设置不生效，走默认值'],
        [typeof WorldProps, 'WorldProps', '关卡道具模块未加载：集装箱/路障/沙袋/植被全部缺失（地图会显得空旷）'],
        [typeof PerfManager, 'PerfManager', 'HUD 性能管理未加载：HUD 将每帧全量刷新'],
    ];
    for (const [t, name, why] of degradable) {
        if (t === 'undefined') {
            reportInitError('assertCriticalModules:' + name, new Error(why), { once: true });
        }
    }

    // 就绪清单：写进诊断对象，便于 QA 一次读取（不改变任何分支）
    try {
        window.__qa.modules = {
            THREE: typeof THREE !== 'undefined',
            EnemyAI: typeof EnemyAI !== 'undefined',
            RenderPipeline: typeof RenderPipeline !== 'undefined',
            GraphicsEnhancement: typeof GraphicsEnhancement !== 'undefined',
            PBRTextures: typeof PBRTextures !== 'undefined',
            WeaponFX: typeof WeaponFX !== 'undefined',
            GameSettings: typeof GameSettings !== 'undefined',
            WorldProps: typeof WorldProps !== 'undefined',
            PerfManager: typeof PerfManager !== 'undefined',
            PerformanceGuard: typeof PerformanceGuard !== 'undefined',
            BossSystemV2: typeof BossSystemV2 !== 'undefined',
        };
    } catch (e) {
        reportInitError('assertCriticalModules:snapshot', e);
    }
    return true;
}

// ========== SECTION 1: RARITY & CONFIG ==========

const RARITY = {
    common:    { name: '普通',  color: '#9e9e9e', bg: '#3a3a3a', border: '#555' },
    uncommon:  { name: '精良',  color: '#4caf50', bg: '#1a3a1a', border: '#3a7a3a' },
    rare:      { name: '稀有',  color: '#2196f3', bg: '#1a2a3a', border: '#3a5a8a' },
    epic:      { name: '史诗',  color: '#9c27b0', bg: '#221a32', border: '#6a3a8a' },
    legendary: { name: '传说',  color: '#ff9800', bg: '#32281a', border: '#8a6a3a' },
    ultimate:  { name: '终极',  color: '#f44336', bg: '#321a1a', border: '#8a3a3a' },
};

// ========== 经济标定（FIX-07）==========
// 全项目唯一真源。改价格只能改这里，不要回去动 ITEMS / SHOP_PRICES 的字面量。
//
// 为什么要拆开：原实现里 ITEMS[].value 与 SHOP_PRICES[].buy 被强制相等（实测 139 件
// 基础物品 buy/value = 1.00），于是「这件战利品值多少钱」和「在商店买它要多少钱」
// 是同一个数，无法独立调节 —— 想让战利品贬值就必须让商店跟着打折，反之亦然。
// 现在 value 表示战利品估值，buy 表示零售价，两者各自独立缩放。
const ECON = {
    PRICE_SCALE: 0.625,   // 零售价 = 原标价 × 0.625（T3 从 ₵6.4M → ₵4.0M）
    LOOT_SCALE: 0.27,     // 战利品估值 = 原 value × 0.27（单局带出 ₵3.29M → ₵0.89M）
    SELL_RATE: 0.85,      // 卖出回收率（不变）
};

const CONFIG = {
    mapSize: 110,
    gameTime: { normal: 900, hard: 600 },
    extractTime: 8,
    maxEnemies: 14,           // normal mode max
    maxEnemiesHard: 24,       // hard mode max
    maxParticles: 50,
    playerSpeed: 8,
    sprintMultiplier: 1.65,
    crouchSpeedMultiplier: 0.45,
    mouseSensitivity: 0.002,
    // 高危入场费 ≈ T2 配装成本的 13%。原来是 20 万，相当于单局收益的 3-10%，
    // 玩家根本不会犹豫要不要进高危 —— 那就不是风险，是背景音。
    hardModeFee: 60000,
    FIXED_DT: 1 / 60,
    MAX_FRAME_DT: 0.1,
    // Stamina
    maxStamina: 100,
    staminaDrainPerSec: 30,    // Drain when sprinting
    staminaRegenPerSec: 18,     // Regen when not sprinting
    staminaExhaustedPenalty: 1.5, // Seconds recovery when depleted
    // Grid dimensions (base, before stash upgrades)
    STASH_COLS: 10, STASH_ROWS: 8,
    BACKPACK_COLS: 6, BACKPACK_ROWS: 4,
    // Weight system (7 levels, max 1000kg)
    WEIGHT_LEVELS: [70, 120, 200, 350, 500, 750, 1000],
    // Stash grid levels (7 levels: [cols, rows]) — columns fixed at 10, rows expand vertically
    STASH_LEVELS: [[10,8],[10,10],[10,12],[10,14],[10,17],[10,20],[10,24]],
};
// Get current stash dimensions based on player level
function getStashDims(){var lv=(P.stashLevel||1)-1;var arr=CONFIG.STASH_LEVELS[lv]||CONFIG.STASH_LEVELS[0];return{cols:arr[0],rows:arr[1]};}
// Get current max weight based on player level
function getMaxWeight(){var lv=(P.weightLevel||1)-1;return CONFIG.WEIGHT_LEVELS[lv]||CONFIG.WEIGHT_LEVELS[0];}
// Calculate item weight (based on grid size and type)
function getItemWeight(itemId){
    var def=ITEMS[itemId];if(!def)return 0.1;
    var w=def.w||1,h=def.h||1;
    var base=w*h*0.3;
    if(def.type==='weapon')base+=0.8;
    if(def.type==='ammo')base=w*h*0.1;
    if(def.type==='armor'||def.type==='helmet')base+=0.5;
    if(def.subType==='backpack')base+=0.5;
    return Math.round(base*10)/10;
}
// Calculate total weight of stash
function getStashWeight(){
    if(!P.stashGrid||!P.stashGrid._items)return 0;
    var total=0;
    for(const e of P.stashGrid._items){total+=getItemWeight(e.id);}
    return Math.round(total*10)/10;
}

// ========== SECTION 2: ITEMS & WEAPONS ==========
const WEAPONS = {
    // ===== SECONDARY (Sidearms) — 8 weapons =====
    pistol:         { name: '手枪',      damage: 22, fireRate: 280, magSize: 15, reloadTime: 1.0, spread: 0.020, auto: false, ammo: 'pistol',  icon: '🔫', range: 50 },
    compactPistol:  { name: '紧凑手枪',   damage: 18, fireRate: 250, magSize: 12, reloadTime: 0.9, spread: 0.030, auto: false, ammo: 'pistol',  icon: '🔫', range: 40 },
    hcPistol:       { name: '大威力手枪', damage: 30, fireRate: 320, magSize: 10, reloadTime: 1.2, spread: 0.025, auto: false, ammo: 'pistol',  icon: '🔫', range: 60 },
    revolver:       { name: '左轮手枪',   damage: 40, fireRate: 400, magSize: 6,  reloadTime: 1.8, spread: 0.018, auto: false, ammo: 'pistol',  icon: '🔫', range: 65 },
    magnum:         { name: '马格南',     damage: 50, fireRate: 500, magSize: 6,  reloadTime: 1.5, spread: 0.030, auto: false, ammo: 'pistol',  icon: '🔫', range: 75 },
    deagle:         { name: '沙鹰',       damage: 55, fireRate: 350, magSize: 7,  reloadTime: 1.6, spread: 0.040, auto: false, ammo: 'pistol',  icon: '🔫', range: 65 },
    autoPistol:     { name: '冲锋手枪',    damage: 18, fireRate: 100, magSize: 20, reloadTime: 1.3, spread: 0.050, auto: true,  ammo: 'pistol',  icon: '🔫', range: 40 },
    burstPistol:    { name: '三发手枪',    damage: 24, fireRate: 80,  magSize: 18, reloadTime: 1.4, spread: 0.022, auto: false, ammo: 'pistol',  icon: '🔫', range: 55, burst: 3 },
    // ===== SUBMACHINE GUNS — 7 weapons (uses smg ammo) =====
    smg:            { name: '冲锋枪',      damage: 17, fireRate: 75,  magSize: 35, reloadTime: 1.5, spread: 0.045, auto: true,  ammo: 'smg',    icon: '🔫', range: 60 },
    pdw:            { name: '个人防卫武器', damage: 15, fireRate: 70,  magSize: 40, reloadTime: 1.4, spread: 0.050, auto: true,  ammo: 'smg',    icon: '🔫', range: 55 },
    mp5:            { name: 'MP5冲锋枪',   damage: 18, fireRate: 80,  magSize: 30, reloadTime: 1.3, spread: 0.040, auto: true,  ammo: 'smg',    icon: '🔫', range: 65 },
    p90:            { name: 'P90冲锋枪',   damage: 16, fireRate: 65,  magSize: 50, reloadTime: 1.6, spread: 0.055, auto: true,  ammo: 'smg',    icon: '🔫', range: 55 },
    vector:         { name: 'Vector冲锋枪',damage: 19, fireRate: 60,  magSize: 25, reloadTime: 1.5, spread: 0.035, auto: true,  ammo: 'smg',    icon: '🔫', range: 60 },
    machinePistol:  { name: '微型冲锋',    damage: 15, fireRate: 90,  magSize: 25, reloadTime: 1.2, spread: 0.060, auto: true,  ammo: 'smg',    icon: '🔫', range: 35 },
    compactSMG:     { name: '紧凑冲锋',    damage: 16, fireRate: 80,  magSize: 28, reloadTime: 1.2, spread: 0.055, auto: true,  ammo: 'smg',    icon: '🔫', range: 45 },
    // ===== ASSAULT RIFLES — 5 weapons (uses rifle ammo) =====
    rifle:          { name: '突击步枪',    damage: 26, fireRate: 95,  magSize: 30, reloadTime: 1.8, spread: 0.026, auto: true,  ammo: 'rifle',  icon: '🎯', range: 120 },
    carbine:        { name: '卡宾枪',     damage: 24, fireRate: 90,  magSize: 30, reloadTime: 1.7, spread: 0.028, auto: true,  ammo: 'rifle',  icon: '🎯', range: 100 },
    ak:             { name: 'AK突击步枪',  damage: 30, fireRate: 100, magSize: 30, reloadTime: 1.9, spread: 0.038, auto: true,  ammo: 'rifle',  icon: '🎯', range: 110 },
    hk416:          { name: 'HK416步枪',   damage: 28, fireRate: 88,  magSize: 30, reloadTime: 1.7, spread: 0.022, auto: true,  ammo: 'rifle',  icon: '🎯', range: 130 },
    battleRifle:    { name: '战斗步枪',    damage: 38, fireRate: 130, magSize: 20, reloadTime: 2.1, spread: 0.030, auto: true,  ammo: 'rifle',  icon: '🎯', range: 140 },
    // ===== MARKSMAN & SNIPER — 5 weapons =====
    dmr:            { name: '精确射手步枪', damage: 42, fireRate: 200, magSize: 15, reloadTime: 2.0, spread: 0.015, auto: false, ammo: 'rifle',  icon: '🔭', range: 180 },
    marksman:       { name: '射手步枪',    damage: 48, fireRate: 220, magSize: 10, reloadTime: 2.3, spread: 0.012, auto: false, ammo: 'sniper', icon: '🔭', range: 200 },
    sniper:         { name: '狙击步枪',    damage: 75, fireRate: 800, magSize: 5,  reloadTime: 3.0, spread: 0.005, auto: false, ammo: 'sniper', icon: '🔭', range: 250 },
    antiMat:        { name: '反器材步枪',   damage: 85, fireRate: 500, magSize: 3,  reloadTime: 3.5, spread: 0.005, auto: false, ammo: 'heavy',  icon: '🔭', range: 300 },
    antiMaterial:   { name: '反器材',      damage: 120,fireRate: 1200,magSize: 3,  reloadTime: 3.5, spread: 0.008, auto: false, ammo: 'heavy',  icon: '🔭', range: 300 },
    // ===== SHOTGUNS — 5 weapons =====
    shotgun:        { name: '霰弹枪',     damage: 14, fireRate: 700, magSize: 6,  reloadTime: 2.2, spread: 0.12, auto: false, ammo: 'shotgun', icon: '💥', range: 30, pellets: 7 },
    combatShotgun:  { name: '战术霰弹枪',  damage: 16, fireRate: 600, magSize: 8,  reloadTime: 2.0, spread: 0.11, auto: false, ammo: 'shotgun', icon: '💥', range: 35, pellets: 8 },
    autoShotgun:    { name: '自动霰弹枪',  damage: 12, fireRate: 250, magSize: 10, reloadTime: 2.5, spread: 0.14, auto: true,  ammo: 'shotgun', icon: '💥', range: 25, pellets: 6 },
    doubleBarrel:   { name: '双管霰弹枪',  damage: 18, fireRate: 800, magSize: 2,  reloadTime: 2.8, spread: 0.10, auto: false, ammo: 'shotgun', icon: '💥', range: 35, pellets: 9 },
    heavyShotgun:   { name: '重霰弹',      damage: 18, fireRate: 750, magSize: 5,  reloadTime: 2.8, spread: 0.10, auto: false, ammo: 'shotgun', icon: '💥', range: 35, pellets: 8 },
    // ===== LIGHT MACHINE GUNS — 2 weapons (uses heavy ammo) =====
    lmg:            { name: '轻机枪',      damage: 24, fireRate: 110, magSize: 75, reloadTime: 4.0, spread: 0.060, auto: true,  ammo: 'heavy',  icon: '🔥', range: 150 },
    mmg:            { name: '中型机枪',     damage: 28, fireRate: 100, magSize: 100,reloadTime: 4.5, spread: 0.055, auto: true,  ammo: 'heavy',  icon: '🔥', range: 160 },
    hmg:            { name: '重机枪',      damage: 30, fireRate: 110, magSize: 75, reloadTime: 4.5, spread: 0.080, auto: true,  ammo: 'heavy',  icon: '🔫', range: 150 },
    // ===== MELEE — 5 weapons =====
    knife:          { name: '匕首',       damage: 35, fireRate: 400, magSize: Infinity, reloadTime: 0, spread: 0, auto: false, ammo: null, icon: '🔪', range: 2, isMelee: true },
    baton:          { name: '警棍',       damage: 40, fireRate: 450, magSize: Infinity, reloadTime: 0, spread: 0, auto: false, ammo: null, icon: '🏏', range: 3, isMelee: true },
    axe:            { name: '战术斧',      damage: 55, fireRate: 550, magSize: Infinity, reloadTime: 0, spread: 0, auto: false, ammo: null, icon: '🪓', range: 3, isMelee: true },
    sword:          { name: '军用刀',      damage: 45, fireRate: 380, magSize: Infinity, reloadTime: 0, spread: 0, auto: false, ammo: null, icon: '⚔️', range: 3, isMelee: true },
    machete:        { name: '砍刀',       damage: 50, fireRate: 500, magSize: Infinity, reloadTime: 0, spread: 0, auto: false, ammo: null, icon: '🔪', range: 3, isMelee: true },
};

// 后坐力按口径分档：原先所有武器共用 0.08，手感没有区分
(function tuneWeaponRecoil() {
    const recoilByAmmo = { pistol: 0.065, smg: 0.05, rifle: 0.075, shotgun: 0.15, sniper: 0.185, heavy: 0.21 };
    Object.keys(WEAPONS).forEach(function (k) {
        const w = WEAPONS[k];
        if (w.recoil == null) w.recoil = recoilByAmmo[w.ammo] || 0.08;
    });
})();



const ITEMS = {
    // === Common (灰/白) - 垃圾 ===
    cash:         { name: '现金',   value: 20000, icon: '💰', type: 'valuable', rarity: 'common', w:1, h:1 },
    bandage:      { name: '绷带',   value: 8000,  icon: '🩹', type: 'heal', amount: 20, rarity: 'common', w:1, h:1 },
    pistolAmmo:   { name: '手枪弹药', value: 6000, icon: '📦', type: 'ammo', ammoType: 'pistol', amount: 24, rarity: 'common', w:1, h:1 },
    lighter:      { name: '打火机', value: 5000,  icon: '🔥', type: 'valuable', rarity: 'common', w:1, h:1 },
    bolt:         { name: '螺丝钉', value: 3000,  icon: '🔩', type: 'valuable', rarity: 'common', w:1, h:1 },
    tape:         { name: '胶带',   value: 4000,  icon: '🧻', type: 'valuable', rarity: 'common', w:1, h:1 },
    // === Uncommon (绿) ===
    medkit:       { name: '急救包', value: 25000, icon: '💊', type: 'heal', amount: 60, rarity: 'uncommon', w:1, h:1 },
    painkiller:   { name: '止痛药', value: 15000, icon: '💉', type: 'heal', amount: 30, rarity: 'uncommon', w:1, h:1 },
    rifleAmmo:    { name: '步枪弹药', value: 10000,icon: '📦', type: 'ammo', ammoType: 'rifle', amount: 30, rarity: 'uncommon', w:1, h:1 },
    shotgunAmmo:  { name: '霰弹',   value: 8000,  icon: '📦', type: 'ammo', ammoType: 'shotgun', amount: 12, rarity: 'uncommon', w:1, h:1 },
    smgAmmo:      { name: '冲锋枪弹药', value: 9000,  icon: '📦', type: 'ammo', ammoType: 'smg', amount: 28, rarity: 'uncommon', w:1, h:1 },
    sniperAmmo:   { name: '狙击弹药',   value: 15000, icon: '📦', type: 'ammo', ammoType: 'sniper', amount: 10, rarity: 'rare', w:1, h:1 },
    heavyAmmo:    { name: '重型弹药',   value: 20000, icon: '📦', type: 'ammo', ammoType: 'heavy', amount: 50, rarity: 'rare', w:1, h:1 },
    battery:      { name: '电池',   value: 18000, icon: '🔋', type: 'valuable', rarity: 'uncommon', w:1, h:1 },
    wire:         { name: '电线',   value: 12000, icon: '🔌', type: 'valuable', rarity: 'uncommon', w:1, h:1 },
    lens:         { name: '镜头',   value: 22000, icon: '📷', type: 'valuable', rarity: 'uncommon', w:1, h:1 },
    // === Rare (蓝) ===
    helmet:       { name: '头盔',   value: 80000, icon: '⛑️', type: 'helmet', amount: 50, rarity: 'rare', w:2, h:2 },
    armor:        { name: '防弹衣', value: 120000,icon: '🦺', type: 'armor', amount: 100, rarity: 'rare', w:2, h:2 },
    watch:        { name: '手表',   value: 60000, icon: '⌚', type: 'valuable', rarity: 'rare', w:1, h:1 },
    phone:        { name: '手机',   value: 50000, icon: '📱', type: 'valuable', rarity: 'rare', w:1, h:1 },
    whiskey:      { name: '威士忌', value: 70000, icon: '🥃', type: 'valuable', rarity: 'rare', w:1, h:1 },
    // === Epic (紫) ===
    pistol_w:     { name: '手枪',   value: 80000, icon: '🔫', type: 'weapon', weapon: 'pistol', rarity: 'epic', w:2, h:1 },
    shotgun_w:    { name: '霰弹枪', value: 180000,icon: '💥', type: 'weapon', weapon: 'shotgun', rarity: 'epic', w:3, h:1 },
    circuit:      { name: '芯片',   value: 220000,icon: '💾', type: 'valuable', rarity: 'epic', w:1, h:1 },
    perfume:      { name: '香水',   value: 180000,icon: '🧴', type: 'valuable', rarity: 'epic', w:1, h:1 },
    // === Legendary (橙/金) ===
    rifle_w:      { name: '突击步枪', value: 250000,icon: '🎯', type: 'weapon', weapon: 'rifle', rarity: 'legendary', w:3, h:1 },
    gold:         { name: '金条',   value: 120000,icon: '🥇', type: 'valuable', rarity: 'legendary', w:1, h:1 },
    gpu:          { name: '显卡',   value: 350000,icon: '🖥️', type: 'valuable', rarity: 'legendary', w:2, h:1 },
    laptop:       { name: '军用电脑', value: 400000,icon: '💻', type: 'valuable', rarity: 'legendary', w:2, h:1 },
    ivory:        { name: '象牙',   value: 280000,icon: '🦷', type: 'valuable', rarity: 'legendary', w:1, h:2 },
    // === Ultimate (红/大红) ===
    diamond:      { name: '钻石',   value: 300000,icon: '💎', type: 'valuable', rarity: 'ultimate', w:1, h:1 },
    relic:        { name: '古代遗物', value: 600000,icon: '📿', type: 'valuable', rarity: 'ultimate', w:1, h:1 },
    red_ring:     { name: '钻戒',   value: 450000,icon: '💍', type: 'valuable', rarity: 'ultimate', w:1, h:1 },
    red_watch:    { name: '古董怀表', value: 420000,icon: '⌚', type: 'valuable', rarity: 'ultimate', w:1, h:1 },
    red_necklace: { name: '宝石项链', value: 580000,icon: '📿', type: 'valuable', rarity: 'ultimate', w:1, h:2 },
    red_tiger:    { name: '虎符',   value: 750000,icon: '🐯', type: 'valuable', rarity: 'ultimate', w:2, h:1 },
    red_vase:     { name: '明代花瓶', value: 550000,icon: '🏺', type: 'valuable', rarity: 'ultimate', w:2, h:2 },
    red_lion:     { name: '金狮雕像', value: 850000,icon: '🦁', type: 'valuable', rarity: 'ultimate', w:2, h:2 },
    red_crown:    { name: '帝王皇冠', value: 1200000,icon:'👑', type: 'valuable', rarity: 'ultimate', w:2, h:2 },
    // 3×3 大红藏品 - 价值千万
    red_painting: { name: '蒙娜丽莎', value: 1800000,icon:'🖼️', type: 'valuable', rarity: 'ultimate', w:3, h:3 },
    red_statue:   { name: '青铜巨像', value: 2200000,icon:'🗿', type: 'valuable', rarity: 'ultimate', w:3, h:3 },
    red_scepter:  { name: '黄金权杖', value: 2000000,icon:'🔱', type: 'valuable', rarity: 'ultimate', w:3, h:3 },
    // 最最最稀有
    africa_star:  { name: '非洲之星', value: 15465000,icon:'🌟', type: 'valuable', rarity: 'ultimate', w:1, h:1 },

    // === Gear: Chest Rigs (add pocket slots) ===
    basic_rig:    { name: '基础胸挂', value: 5000,  icon: '🎽', type: 'chestRig', slots: 2, rarity: 'common', w:2, h:1 },
    tactical_rig: { name: '战术胸挂', value: 30000, icon: '🎽', type: 'chestRig', slots: 4, rarity: 'rare', w:2, h:1 },
    elite_rig:    { name: '精英胸挂', value: 120000,icon: '🎽', type: 'chestRig', slots: 6, rarity: 'epic', w:2, h:2 },

    // === Gear: Backpacks (determine backpack grid) ===
    small_bag:    { name: '小背包',   value: 5000,  icon: '🎒', type: 'backpack', bCols:4, bRows:3, rarity: 'common', w:2, h:2 },
    medium_bag:   { name: '中背包',   value: 30000, icon: '🎒', type: 'backpack', bCols:5, bRows:4, rarity: 'rare', w:2, h:2 },
    large_bag:    { name: '大背包',   value: 150000,icon: '🎒', type: 'backpack', bCols:6, bRows:5, rarity: 'epic', w:3, h:2 },
    military_bag: { name: '军用背包', value: 500000,icon: '🎒', type: 'backpack', bCols:7, bRows:5, rarity: 'legendary', w:3, h:3 },

    // === Gear: Armor (HP for armor slot, breaks at 0) ===
    light_armor:  { name: '轻型甲', value: 25000, icon: '🦺', type: 'armor', amount: 50,  rarity: 'uncommon', w:2, h:2 },
    medium_armor: { name: '中型甲', value: 80000, icon: '🦺', type: 'armor', amount: 100, rarity: 'rare', w:2, h:2 },
    heavy_armor:  { name: '重型甲', value: 250000,icon: '🦺', type: 'armor', amount: 150, rarity: 'epic', w:2, h:2 },
    elite_armor:  { name: '精英甲', value: 600000,icon: '🦺', type: 'armor', amount: 200, rarity: 'legendary', w:3, h:2 },

    // === Gear: Helmets ===
    basic_helmet: { name: '基础盔', value: 8000,  icon: '⛑️', type: 'helmet', amount: 25, rarity: 'uncommon', w:1, h:1 },
    adv_helmet:   { name: '高级盔', value: 50000, icon: '⛑️', type: 'helmet', amount: 50, rarity: 'rare', w:2, h:1 },
    elite_helmet: { name: '精英盔', value: 200000,icon: '⛑️', type: 'helmet', amount: 75, rarity: 'epic', w:2, h:2 },

    // === Weapon items (expanded 27 items matching new WEAPONS) ===
    // Secondaries
    pistol_item:        { name: '手枪',       value: 80000,  icon: '🔫', type: 'weapon', weapon: 'pistol',        wSlot: 'secondary', rarity: 'common', w:2, h:1 },
    compactPistol_item: { name: '紧凑手枪',    value: 60000,  icon: '🔫', type: 'weapon', weapon: 'compactPistol', wSlot: 'secondary', rarity: 'common', w:1, h:1 },
    hcPistol_item:      { name: '大威力手枪',  value: 120000, icon: '🔫', type: 'weapon', weapon: 'hcPistol',      wSlot: 'secondary', rarity: 'uncommon', w:2, h:1 },
    revolver_item:      { name: '左轮手枪',    value: 150000, icon: '🔫', type: 'weapon', weapon: 'revolver',      wSlot: 'secondary', rarity: 'uncommon', w:2, h:1 },
    magnum_item:        { name: '马格南',      value: 180000, icon: '🔫', type: 'weapon', weapon: 'magnum',        wSlot: 'secondary', rarity: 'rare', w:2, h:1 },
    deagle_item:        { name: '沙鹰',        value: 280000, icon: '🔫', type: 'weapon', weapon: 'deagle',        wSlot: 'secondary', rarity: 'rare', w:2, h:1 },
    autoPistol_item:    { name: '冲锋手枪',    value: 250000, icon: '🔫', type: 'weapon', weapon: 'autoPistol',    wSlot: 'secondary', rarity: 'epic', w:2, h:1 },
    burstPistol_item:   { name: '三发手枪',    value: 200000, icon: '🔫', type: 'weapon', weapon: 'burstPistol',   wSlot: 'secondary', rarity: 'rare', w:2, h:1 },
    // SMGs
    smg_item:           { name: '冲锋枪',      value: 220000, icon: '🔫', type: 'weapon', weapon: 'smg',           wSlot: 'primary', rarity: 'rare', w:3, h:1 },
    pdw_item:           { name: '个人防卫武器', value: 180000, icon: '🔫', type: 'weapon', weapon: 'pdw',           wSlot: 'primary', rarity: 'uncommon', w:3, h:1 },
    mp5_item:           { name: 'MP5冲锋枪',   value: 260000, icon: '🔫', type: 'weapon', weapon: 'mp5',           wSlot: 'primary', rarity: 'rare', w:3, h:1 },
    p90_item:           { name: 'P90冲锋枪',   value: 300000, icon: '🔫', type: 'weapon', weapon: 'p90',           wSlot: 'primary', rarity: 'rare', w:3, h:1 },
    vector_item:        { name: 'Vector冲锋枪',value: 350000, icon: '🔫', type: 'weapon', weapon: 'vector',        wSlot: 'primary', rarity: 'epic', w:3, h:1 },
    machinePistol_item: { name: '微型冲锋',    value: 240000, icon: '🔫', type: 'weapon', weapon: 'machinePistol', wSlot: 'primary', rarity: 'epic', w:2, h:1 },
    compactSMG_item:    { name: '紧凑冲锋',    value: 200000, icon: '🔫', type: 'weapon', weapon: 'compactSMG',    wSlot: 'primary', rarity: 'rare', w:2, h:1 },
    // Rifles
    rifle_item:         { name: '突击步枪',    value: 250000, icon: '🎯', type: 'weapon', weapon: 'rifle',         wSlot: 'primary', rarity: 'legendary', w:3, h:1 },
    carbine_item:       { name: '卡宾枪',      value: 220000, icon: '🎯', type: 'weapon', weapon: 'carbine',       wSlot: 'primary', rarity: 'rare', w:3, h:1 },
    ak_item:            { name: 'AK突击步枪',  value: 280000, icon: '🎯', type: 'weapon', weapon: 'ak',            wSlot: 'primary', rarity: 'epic', w:3, h:1 },
    hk416_item:         { name: 'HK416步枪',   value: 350000, icon: '🎯', type: 'weapon', weapon: 'hk416',         wSlot: 'primary', rarity: 'legendary', w:3, h:1 },
    battleRifle_item:   { name: '战斗步枪',    value: 380000, icon: '🎯', type: 'weapon', weapon: 'battleRifle',   wSlot: 'primary', rarity: 'legendary', w:3, h:1 },
    // DMR / Sniper
    dmr_item:           { name: '精确射手步枪',value: 400000, icon: '🔭', type: 'weapon', weapon: 'dmr',           wSlot: 'primary', rarity: 'legendary', w:3, h:1 },
    marksman_item:      { name: '射手步枪',    value: 550000, icon: '🔭', type: 'weapon', weapon: 'marksman',      wSlot: 'primary', rarity: 'legendary', w:4, h:1 },
    sniper_item:        { name: '狙击步枪',    value: 700000, icon: '🔭', type: 'weapon', weapon: 'sniper',        wSlot: 'primary', rarity: 'legendary', w:4, h:1 },
    antiMat_item:       { name: '反器材步枪',  value: 900000, icon: '🔭', type: 'weapon', weapon: 'antiMat',       wSlot: 'primary', rarity: 'ultimate', w:4, h:1 },
    // Shotguns
    shotgun_item:       { name: '霰弹枪',      value: 180000, icon: '💥', type: 'weapon', weapon: 'shotgun',       wSlot: 'primary', rarity: 'epic', w:3, h:1 },
    combatShotgun_item: { name: '战术霰弹枪',  value: 250000, icon: '💥', type: 'weapon', weapon: 'combatShotgun', wSlot: 'primary', rarity: 'epic', w:3, h:1 },
    autoShotgun_item:   { name: '自动霰弹枪',  value: 400000, icon: '💥', type: 'weapon', weapon: 'autoShotgun',   wSlot: 'primary', rarity: 'epic', w:3, h:1 },
    doubleBarrel_item:  { name: '双管霰弹枪',  value: 150000, icon: '💥', type: 'weapon', weapon: 'doubleBarrel',  wSlot: 'primary', rarity: 'uncommon', w:3, h:1 },
    heavyShotgun_item:  { name: '重霰弹',      value: 320000, icon: '💥', type: 'weapon', weapon: 'heavyShotgun',  wSlot: 'primary', rarity: 'epic', w:3, h:1 },
    // LMGs
    lmg_item:           { name: '轻机枪',      value: 500000, icon: '🔥', type: 'weapon', weapon: 'lmg',           wSlot: 'primary', rarity: 'legendary', w:4, h:2 },
    mmg_item:           { name: '中型机枪',    value: 700000, icon: '🔥', type: 'weapon', weapon: 'mmg',           wSlot: 'primary', rarity: 'legendary', w:4, h:2 },
    hmg_item:           { name: '重机枪',      value: 950000, icon: '🔫', type: 'weapon', weapon: 'hmg',           wSlot: 'primary', rarity: 'ultimate', w:4, h:2 },
    // Melee
    knife_item:         { name: '匕首',        value: 30000,  icon: '🔪', type: 'weapon', weapon: 'knife',         wSlot: 'melee', rarity: 'common', w:1, h:1 },
    baton_item:         { name: '警棍',        value: 45000,  icon: '🏏', type: 'weapon', weapon: 'baton',         wSlot: 'melee', rarity: 'common', w:1, h:2 },
    axe_item:           { name: '战术斧',      value: 80000,  icon: '🪓', type: 'weapon', weapon: 'axe',           wSlot: 'melee', rarity: 'uncommon', w:2, h:1 },
    sword_item:         { name: '军用刀',      value: 65000,  icon: '⚔️', type: 'weapon', weapon: 'sword',         wSlot: 'melee', rarity: 'uncommon', w:2, h:1 },
    machete_item:       { name: '砍刀',        value: 55000,  icon: '🔪', type: 'weapon', weapon: 'machete',       wSlot: 'melee', rarity: 'common', w:2, h:1 },

    // === Expanded Medical ===
    surgeryKit:   { name: '战场手术包', value: 80000, icon: '🏥', type: 'heal', amount: 100, rarity: 'rare', w:2, h:1 },
    adrenaline:   { name: '肾上腺素',   value: 45000, icon: '💉', type: 'heal', amount: 40, rarity: 'uncommon', w:1, h:1 },
    tourniquet:   { name: '止血带',     value: 15000, icon: '🩸', type: 'heal', amount: 25, rarity: 'common', w:1, h:1 },
    stimInjector: { name: '兴奋剂',     value: 60000, icon: '🧪', type: 'stim', amount: 1, rarity: 'rare', w:1, h:1 },

    // === Throwables ===
    fragGrenade:  { name: '破片手雷',   value: 35000, icon: '💣', type: 'throwable', damage: 60, blastRadius: 8, rarity: 'uncommon', w:1, h:1 },
    smokeGrenade: { name: '烟雾弹',     value: 25000, icon: '🌫️', type: 'throwable', duration: 8, rarity: 'common', w:1, h:1 },
    flashbang:    { name: '闪光弹',     value: 30000, icon: '💥', type: 'throwable', duration: 3, rarity: 'uncommon', w:1, h:1 },
    molotov:      { name: '燃烧瓶',     value: 20000, icon: '🔥', type: 'throwable', damage: 30, duration: 5, rarity: 'common', w:1, h:1 },

    // === Keycards ===
    blueKeycard:   { name: '蓝色钥匙卡', value: 80000,  icon: '💳', type: 'keycard', keyLevel: 1, rarity: 'rare', w:1, h:1 },
    purpleKeycard: { name: '紫色钥匙卡', value: 250000, icon: '💳', type: 'keycard', keyLevel: 2, rarity: 'epic', w:1, h:1 },
    goldKeycard:   { name: '金色钥匙卡', value: 800000, icon: '💳', type: 'keycard', keyLevel: 3, rarity: 'legendary', w:1, h:1 },
    redKeycard:    { name: '红色钥匙卡', value: 2000000,icon: '💳', type: 'keycard', keyLevel: 4, rarity: 'ultimate', w:1, h:1 },

    // === Expanded Armor (6 tiers: Type I to Type VI) ===
    tier1_armor:   { name: 'I级防弹衣',  value: 15000,  icon: '🦺', type: 'armor', amount: 30,  rarity: 'common', w:2, h:2 },
    tier2_armor:   { name: 'II级防弹衣', value: 40000,  icon: '🦺', type: 'armor', amount: 60,  rarity: 'uncommon', w:2, h:2 },
    tier3_armor:   { name: 'III级防弹衣',value: 120000, icon: '🦺', type: 'armor', amount: 100, rarity: 'rare', w:2, h:2 },
    tier4_armor:   { name: 'IV级防弹衣', value: 300000, icon: '🦺', type: 'armor', amount: 160, rarity: 'epic', w:2, h:2 },
    tier5_armor:   { name: 'V级防弹衣',  value: 600000, icon: '🦺', type: 'armor', amount: 220, rarity: 'legendary', w:3, h:2 },
    tier6_armor:   { name: 'VI级防弹衣', value: 1200000,icon: '🦺', type: 'armor', amount: 320, rarity: 'ultimate', w:3, h:3 },

    // === Expanded Helmets (6 tiers) ===
    tier1_helmet:  { name: 'I级头盔',   value: 5000,   icon: '⛑️', type: 'helmet', amount: 20,  rarity: 'common', w:1, h:1 },
    tier2_helmet:  { name: 'II级头盔',  value: 20000,  icon: '⛑️', type: 'helmet', amount: 40,  rarity: 'uncommon', w:1, h:1 },
    tier3_helmet:  { name: 'III级头盔', value: 80000,  icon: '⛑️', type: 'helmet', amount: 65,  rarity: 'rare', w:2, h:1 },
    tier4_helmet:  { name: 'IV级头盔',  value: 250000, icon: '⛑️', type: 'helmet', amount: 90,  rarity: 'epic', w:2, h:2 },
    tier5_helmet:  { name: 'V级头盔',   value: 600000, icon: '⛑️', type: 'helmet', amount: 130, rarity: 'legendary', w:2, h:2 },
    tier6_helmet:  { name: 'VI级头盔',  value: 1200000,icon: '⛑️', type: 'helmet', amount: 170, rarity: 'ultimate', w:2, h:2 },

    // === Expanded Chest Rigs (4 tiers) ===
    light_rig:     { name: '轻型胸挂',   value: 2000,   icon: '🎽', type: 'chestRig', slots: 1,  rarity: 'common', w:1, h:1 },
    assault_rig:   { name: '突击胸挂',   value: 60000,  icon: '🎽', type: 'chestRig', slots: 5,  rarity: 'rare', w:2, h:1 },
    tactical_rig2: { name: '战术胸挂',   value: 150000, icon: '🎽', type: 'chestRig', slots: 7,  rarity: 'epic', w:2, h:2 },
    heavy_rig:     { name: '重型胸挂',   value: 400000, icon: '🎽', type: 'chestRig', slots: 10, rarity: 'legendary', w:2, h:2 },

    // === Expanded Backpacks (6 tiers) ===
    pouch:         { name: '腰包',      value: 1000,   icon: '👝', type: 'backpack', bCols: 2, bRows: 2, rarity: 'common', w:1, h:1 },
    school_bag:    { name: '书包',      value: 15000,  icon: '🎒', type: 'backpack', bCols: 4, bRows: 4, rarity: 'uncommon', w:2, h:2 },
    hiking_bag:    { name: '登山包',    value: 80000,  icon: '🎒', type: 'backpack', bCols: 5, bRows: 5, rarity: 'rare', w:2, h:2 },
    assault_bag:   { name: '突击背包',  value: 250000, icon: '🎒', type: 'backpack', bCols: 6, bRows: 6, rarity: 'epic', w:3, h:2 },
    expedition_bag:{ name: '远征背包',  value: 600000, icon: '🎒', type: 'backpack', bCols: 7, bRows: 6, rarity: 'legendary', w:3, h:3 },
    gamma_bag:     { name: '伽马背包',  value: 1500000,icon: '🎒', type: 'backpack', bCols: 8, bRows: 7, rarity: 'ultimate', w:4, h:3 },

    // === Expanded Collectibles - Epic ===
    jade:          { name: '翡翠佛珠',   value: 250000, icon: '📿', type: 'valuable', rarity: 'epic', w:1, h:1 },
    goldMask:      { name: '黄金面具',   value: 380000, icon: '🎭', type: 'valuable', rarity: 'epic', w:2, h:2 },
    // === Expanded Collectibles - Legendary ===
    crown:         { name: '钻石王冠',   value: 800000, icon: '👑', type: 'valuable', rarity: 'legendary', w:2, h:2 },
    cursedIdol:    { name: '诅咒雕像',   value: 650000, icon: '🗿', type: 'valuable', rarity: 'legendary', w:2, h:2 },
    // === Expanded Collectibles - Ultimate ===
    goldenFalcon:  { name: '黄金猎鹰',   value: 1500000,icon: '🦅', type: 'valuable', rarity: 'ultimate', w:2, h:2 },
    emperorSeal:   { name: '传国玉玺',   value: 2500000,icon: '🔴', type: 'valuable', rarity: 'ultimate', w:2, h:2 },
    moonStone:     { name: '月光石',     value: 3500000,icon: '💎', type: 'valuable', rarity: 'ultimate', w:1, h:1 },
    // === Intel Items ===
    encryptedUsb:  { name: '加密U盘',    value: 120000, icon: '💾', type: 'valuable', rarity: 'rare', w:1, h:1 },
    confidentialDoc:{name:'机密文件',    value: 280000, icon: '📄', type: 'valuable', rarity: 'epic', w:2, h:1 },
    satellitePhoto:{ name: '卫星照片',   value: 450000, icon: '🛰️', type: 'valuable', rarity: 'epic', w:2, h:2 },
    commanderDiary:{ name: '指挥官日记', value: 600000, icon: '📖', type: 'valuable', rarity: 'legendary', w:1, h:1 },
};

// === Set keycard images ===
ITEMS.goldKeycard.img = '装备及药品等杂项/钥匙卡/金色钥匙卡.png';
ITEMS.blueKeycard.img = '装备及药品等杂项/钥匙卡/蓝色钥匙卡.png';
ITEMS.purpleKeycard.img = '装备及药品等杂项/钥匙卡/紫色钥匙卡.png';
ITEMS.redKeycard.img = '装备及药品等杂项/钥匙卡/红色钥匙卡.png';

// === Item Image Paths (装备及药品等杂项 folder) ===
var _itemImgs = {
    // Weapons - SMGs
    smg_item:           '装备及药品等杂项/主武器(冲锋)/冲锋枪.png',
    pdw_item:           '装备及药品等杂项/主武器(冲锋)/个人防卫武器.png',
    mp5_item:           '装备及药品等杂项/主武器(冲锋)/MP5冲锋枪.png',
    p90_item:           '装备及药品等杂项/主武器(冲锋)/P90冲锋枪.png',
    vector_item:        '装备及药品等杂项/主武器(冲锋)/Vector冲锋枪.png',
    machinePistol_item: '装备及药品等杂项/主武器(冲锋)/微型冲锋.png',
    compactSMG_item:    '装备及药品等杂项/主武器(冲锋)/紧凑冲锋.png',
    // Weapons - Rifles
    rifle_item:         '装备及药品等杂项/主武器(步枪)/突击步枪.png',
    carbine_item:       '装备及药品等杂项/主武器(步枪)/卡宾枪.png',
    ak_item:            '装备及药品等杂项/主武器(步枪)/AK突击步枪.png',
    hk416_item:         '装备及药品等杂项/主武器(步枪)/HK416步枪.png',
    battleRifle_item:   '装备及药品等杂项/主武器(步枪)/战斗步枪.png',
    // Weapons - Sniper
    dmr_item:           '装备及药品等杂项/主武器(狙击)/精确射手步枪.png',
    marksman_item:      '装备及药品等杂项/主武器(狙击)/射手步枪.png',
    sniper_item:        '装备及药品等杂项/主武器(狙击)/狙击步枪.png',
    antiMat_item:       '装备及药品等杂项/主武器(狙击)/反器材步枪.png',
    // Weapons - Shotguns
    shotgun_item:       '装备及药品等杂项/主武器(霰弹)/霰弹枪.png',
    combatShotgun_item: '装备及药品等杂项/主武器(霰弹)/战术霰弹枪.png',
    autoShotgun_item:   '装备及药品等杂项/主武器(霰弹)/自动霰弹枪.png',
    doubleBarrel_item:  '装备及药品等杂项/主武器(霰弹)/双管霰弹枪.png',
    heavyShotgun_item:  '装备及药品等杂项/主武器(霰弹)/重霰弹.png',
    shotgun_w:          '装备及药品等杂项/主武器(霰弹)/霰弹枪.png',
    rifle_w:            '装备及药品等杂项/主武器(步枪)/突击步枪.png',
    // Weapons - LMGs
    lmg_item:           '装备及药品等杂项/主武器(机枪)/轻机枪.png',
    mmg_item:           '装备及药品等杂项/主武器(机枪)/中型机枪.png',
    hmg_item:           '装备及药品等杂项/主武器(机枪)/重机枪.png',
    // Medical
    bandage:            '装备及药品等杂项/医疗/绷带.png',
    medkit:             '装备及药品等杂项/医疗/急救包.png',
    surgeryKit:         '装备及药品等杂项/医疗/战场手术包.png',
    painkiller:         '装备及药品等杂项/医疗/止痛药.png',
    tourniquet:         '装备及药品等杂项/医疗/止血带.png',
    adrenaline:         '装备及药品等杂项/医疗/肾上腺素.png',
    stimInjector:       '装备及药品等杂项/医疗/兴奋剂.png',
    // Ammo
    pistolAmmo:         '装备及药品等杂项/弹药/手枪弹药png.png',
    rifleAmmo:          '装备及药品等杂项/弹药/步枪弹药.png',
    smgAmmo:            '装备及药品等杂项/弹药/冲锋枪弹药.png',
    sniperAmmo:         '装备及药品等杂项/弹药/狙击弹药.png',
    heavyAmmo:          '装备及药品等杂项/弹药/重型弹药.png',
    shotgunAmmo:        '装备及药品等杂项/弹药/霰弹.png',
    // Helmets
    tier1_helmet:       '装备及药品等杂项/头盔/I级头盔.png',
    tier2_helmet:       '装备及药品等杂项/头盔/II级头盔.png',
    tier3_helmet:       '装备及药品等杂项/头盔/III级头盔.png',
    tier4_helmet:       '装备及药品等杂项/头盔/IV级头盔.png',
    tier5_helmet:       '装备及药品等杂项/头盔/V级头盔.png',
    tier6_helmet:       '装备及药品等杂项/头盔/VI级头盔.png',
    // Armor
    tier1_armor:        '装备及药品等杂项/护甲/I级防弹衣.png',
    tier2_armor:        '装备及药品等杂项/护甲/II级防弹衣.png',
    tier3_armor:        '装备及药品等杂项/护甲/III级防弹衣.png',
    tier4_armor:        '装备及药品等杂项/护甲/IV级防弹衣.png',
    tier5_armor:        '装备及药品等杂项/护甲/V级防弹衣.png',
    tier6_armor:        '装备及药品等杂项/护甲/VI级防弹衣.png',
    // Backpacks
    pouch:              '装备及药品等杂项/背包/腰包.png',
    school_bag:         '装备及药品等杂项/背包/书包.png',
    hiking_bag:         '装备及药品等杂项/背包/登山包png.png',
    assault_bag:        '装备及药品等杂项/背包/突击背包.png',
    expedition_bag:     '装备及药品等杂项/背包/远征背包.png',
    gamma_bag:          '装备及药品等杂项/背包/伽马背包.png',
    small_bag:          '装备及药品等杂项/背包/小背包.png',
    medium_bag:         '装备及药品等杂项/背包/中背包.png',
    large_bag:          '装备及药品等杂项/背包/大背包.png',
    military_bag:       '装备及药品等杂项/背包/军用背包.png',
    // Chest Rigs
    light_rig:          '装备及药品等杂项/胸挂/轻型胸挂.png',
    assault_rig:        '装备及药品等杂项/胸挂/突击胸挂.png',
    tactical_rig2:      '装备及药品等杂项/胸挂/战术胸挂.png',
    heavy_rig:          '装备及药品等杂项/胸挂/重型胸挂.png',
    basic_rig:          '装备及药品等杂项/胸挂/基础胸挂.png',
    elite_rig:          '装备及药品等杂项/胸挂/精英胸挂.png',
    // Keycards
    blueKeycard:        '装备及药品等杂项/钥匙卡/蓝色钥匙卡.png',
    purpleKeycard:      '装备及药品等杂项/钥匙卡/紫色钥匙卡.png',
    goldKeycard:        '装备及药品等杂项/钥匙卡/金色钥匙卡.png',
    redKeycard:         '装备及药品等杂项/钥匙卡/红色钥匙卡.png',
};
for (var _iid in _itemImgs) { if (ITEMS[_iid]) ITEMS[_iid].img = _itemImgs[_iid]; }

// === Weapon Image Paths ===
var _weaponImgs = {
    smg:            '装备及药品等杂项/主武器(冲锋)/冲锋枪.png',
    pdw:            '装备及药品等杂项/主武器(冲锋)/个人防卫武器.png',
    mp5:            '装备及药品等杂项/主武器(冲锋)/MP5冲锋枪.png',
    p90:            '装备及药品等杂项/主武器(冲锋)/P90冲锋枪.png',
    vector:         '装备及药品等杂项/主武器(冲锋)/Vector冲锋枪.png',
    machinePistol:  '装备及药品等杂项/主武器(冲锋)/微型冲锋.png',
    compactSMG:     '装备及药品等杂项/主武器(冲锋)/紧凑冲锋.png',
    rifle:          '装备及药品等杂项/主武器(步枪)/突击步枪.png',
    carbine:        '装备及药品等杂项/主武器(步枪)/卡宾枪.png',
    ak:             '装备及药品等杂项/主武器(步枪)/AK突击步枪.png',
    hk416:          '装备及药品等杂项/主武器(步枪)/HK416步枪.png',
    battleRifle:    '装备及药品等杂项/主武器(步枪)/战斗步枪.png',
    dmr:            '装备及药品等杂项/主武器(狙击)/精确射手步枪.png',
    marksman:       '装备及药品等杂项/主武器(狙击)/射手步枪.png',
    sniper:         '装备及药品等杂项/主武器(狙击)/狙击步枪.png',
    antiMat:        '装备及药品等杂项/主武器(狙击)/反器材步枪.png',
    shotgun:        '装备及药品等杂项/主武器(霰弹)/霰弹枪.png',
    combatShotgun:  '装备及药品等杂项/主武器(霰弹)/战术霰弹枪.png',
    autoShotgun:    '装备及药品等杂项/主武器(霰弹)/自动霰弹枪.png',
    doubleBarrel:   '装备及药品等杂项/主武器(霰弹)/双管霰弹枪.png',
    heavyShotgun:   '装备及药品等杂项/主武器(霰弹)/重霰弹.png',
    lmg:            '装备及药品等杂项/主武器(机枪)/轻机枪.png',
    mmg:            '装备及药品等杂项/主武器(机枪)/中型机枪.png',
    hmg:            '装备及药品等杂项/主武器(机枪)/重机枪.png',
};
for (var _wid in _weaponImgs) { if (WEAPONS[_wid]) WEAPONS[_wid].img = _weaponImgs[_wid]; }

const CONTAINER_TYPES = {
    // Loot tables: more duplicates = higher probability.
    // Ultimate items appear once; common/uncommon/rare/epic duplicated for higher drop rates.
    weaponBox:  { name: '武器箱', icon: '🔫', color: 0x3a5a3a, shape: 'long',   w:7, h:4,
        items:['pistolAmmo','pistolAmmo','rifleAmmo','rifleAmmo','rifleAmmo','shotgunAmmo','shotgunAmmo','pistol_item','pistol_item','magnum_item','smg_item','rifle_item','shotgun_item','dmr_item','blueKeycard'],
        min:2, max:4, searchTime:1.5 },
    medBox:     { name: '医疗箱', icon: '💊', color: 0xeeeeee, shape: 'cube',   w:6, h:3,
        items:['bandage','bandage','bandage','bandage','painkiller','painkiller','painkiller','medkit','medkit','medkit','whiskey'],
        min:2, max:5, searchTime:1.2 },
    equipBox:   { name: '装备箱', icon: '🛡️', color: 0x3a4a5a, shape: 'tall',   w:7, h:4,
        items:['light_armor','light_armor','medium_armor','medium_armor','heavy_armor','tier2_armor','tier2_armor','tier3_armor','tier1_helmet','tier1_helmet','tier2_helmet','tier3_helmet','basic_helmet','adv_helmet','basic_rig','tactical_rig','small_bag','small_bag','medium_bag','gpu','laptop','watch','phone','purpleKeycard'],
        min:2, max:4, searchTime:1.5 },
    supplyBox:  { name: '物资箱', icon: '📦', color: 0x8b6914, shape: 'crate',  w:7, h:4,
        items:['lighter','lighter','bolt','bolt','tape','tape','battery','battery','wire','lens','bandage','bandage','painkiller','pistolAmmo','rifleAmmo','cash','cash','cash','gold','perfume'],
        min:2, max:4, searchTime:1.0 },
    ammoBox:    { name: '弹药箱', icon: '📦', color: 0x5a3030, shape: 'small',  w:5, h:3,
        items:['pistolAmmo','pistolAmmo','pistolAmmo','rifleAmmo','rifleAmmo','rifleAmmo','shotgunAmmo','shotgunAmmo','bolt','tape'],
        min:3, max:6, searchTime:0.8 },
    safe:       { name: '保险箱', icon: '🔐', color: 0x4a4a3a, shape: 'safe',   w:7, h:5,
        // FIX-05：africa_star 已移出常规池，改为独立头奖掷骰（见 JACKPOT_TABLE）
        items:['cash','cash','cash','cash','gold','gold','gold','watch','watch','phone','phone','whiskey','whiskey','circuit','circuit','gpu','gpu','ivory','ivory','diamond','relic','red_ring','red_watch','red_necklace','red_tiger','red_vase','redKeycard'],
        min:1, max:3, searchTime:2.5 },
    premiumBox: { name: '高级物资箱', icon: '✨', color: 0xffd700, shape: 'premium', w:8, h:6,
        // FIX-05：africa_star 已移出常规池，改为独立头奖掷骰（见 JACKPOT_TABLE）
        items:['gold','gold','gold','gpu','gpu','gpu','laptop','laptop','laptop','ivory','ivory','ivory','circuit','circuit','circuit','perfume','perfume','perfume','whiskey','whiskey','diamond','relic','tier4_armor','tier4_helmet','tier5_armor','red_ring','red_necklace','red_tiger','red_vase','red_lion','red_crown','red_painting','red_statue','red_scepter','rifle_w','goldKeycard'],
        min:1, max:3, searchTime:3.0 },
};

// ========== 头奖与红藏品独立掷骰（FIX-05 / FIX-06）==========
//
// 以前这两类稀有物是「塞进容器 items 数组」实现的，效果等于给池子加水：
// 阵列越长，单件出现概率越低，但它们占的期望价值份额却始终存在。
// 更糟的是红藏品被 93 件全量 concat 进 safe，池子从 28 项膨胀到 140 项，
// 开一箱至少出 1 件红的概率高达 88.7% —— 这不是「稀有」，这是「保底」。
//
// 现在改成独立掷骰：先按常规池抽物品，再各自掷一次是否出货。每箱最多 1 件。

// 非洲之星：safe 每箱 0.2%，premiumBox 0.4%，空投 2%
const JACKPOT_ID = 'africa_star';
const JACKPOT_TABLE = { safe: 0.002, premiumBox: 0.004, airdrop: 0.02 };

// 红藏品：按价值分三档，各自独立加权
// 档位口径按 RED_COLLECTIBLES_CONFIG[].value，不新增字段
const RED_TIER_BOUNDS = [1000000, 5000000];   // <1e6 入门 / 1e6-5e6 中档 / >=5e6 顶级
const RED_ROLL = {
    safe:       { p: 0.08, w: [0.78, 0.19, 0.03] },
    premiumBox: { p: 0.15, w: [0.72, 0.24, 0.04] },
};
// premiumBox 字面量里手写的九件红藏品保留在基础池内（那是它的定位），
// 掷骰池要排除它们，否则同一件东西会被计入两次，红色产出直接翻倍。
const RED_HANDWRITTEN_IN_PREMIUM = [
    'red_ring', 'red_necklace', 'red_tiger', 'red_vase', 'red_lion',
    'red_crown', 'red_painting', 'red_statue', 'red_scepter',
];
// 三档掷骰池，在收藏品合并阶段填充（此时才知道每件的 value）
const RED_ROLL_POOL = [[], [], []];

/**
 * 独立掷骰：头奖 + 红藏品。
 *
 * 直接写进 containerGrid，而不是返回一个数组让调用方再拼 ——
 * 因为 createContainer 后面就是从 containerGrid 反推出 items 列表的，
 * 写进格子等于自动被算进去；另起一条返回通道迟早会漏掉其中一条。
 *
 * 格子满了就放弃这次出货（findFreeSlot 返回 null）。这是有意的：
 * 强行塞进去会破坏格子布局，而少一件头奖只是概率上少一点，不会出错。
 */
function _rollContainerRare(def, containerGrid, type) {
    const gw = def.w || 5, gh = def.h || 3;
    if (JACKPOT_TABLE[type] && Math.random() < JACKPOT_TABLE[type]) {
        const s = findFreeSlot(containerGrid, gw, gh, JACKPOT_ID);
        if (s) placeInGrid(containerGrid, gw, JACKPOT_ID, s.col, s.row);
    }
    const rr = RED_ROLL[type];
    if (rr && Math.random() < rr.p) {
        const r = Math.random();
        const t = r < rr.w[0] ? 0 : (r < rr.w[0] + rr.w[1] ? 1 : 2);
        const pool = RED_ROLL_POOL[t];
        if (pool.length) {
            const id = pool[Math.floor(Math.random() * pool.length)];
            const s = findFreeSlot(containerGrid, gw, gh, id);
            if (s) placeInGrid(containerGrid, gw, id, s.col, s.row);
        }
    }
}

// Sell = 85% of buy price
const SHOP_PRICES = {
    pistol_w:{buy:80000,sell:68000}, rifle_w:{buy:250000,sell:212500}, shotgun_w:{buy:180000,sell:153000},
    armor:{buy:150000,sell:127500}, helmet:{buy:100000,sell:85000},
    medkit:{buy:25000,sell:21250}, bandage:{buy:8000,sell:6800}, painkiller:{buy:15000,sell:12750},
    pistolAmmo:{buy:6000,sell:5100}, rifleAmmo:{buy:10000,sell:8500}, shotgunAmmo:{buy:8000,sell:6800},
    smgAmmo:{buy:9000,sell:7650}, sniperAmmo:{buy:15000,sell:12750}, heavyAmmo:{buy:20000,sell:17000},
    cash:{buy:20000,sell:17000}, lighter:{buy:5000,sell:4250}, bolt:{buy:3000,sell:2550}, tape:{buy:4000,sell:3400},
    battery:{buy:18000,sell:15300}, wire:{buy:12000,sell:10200}, lens:{buy:22000,sell:18700},
    watch:{buy:60000,sell:51000}, phone:{buy:50000,sell:42500}, whiskey:{buy:70000,sell:59500},
    circuit:{buy:220000,sell:187000}, perfume:{buy:180000,sell:153000},
    gold:{buy:120000,sell:102000}, gpu:{buy:350000,sell:297500}, laptop:{buy:400000,sell:340000}, ivory:{buy:280000,sell:238000},
    diamond:{buy:300000,sell:255000}, relic:{buy:600000,sell:510000},
    red_ring:{buy:450000,sell:382500}, red_watch:{buy:420000,sell:357000}, red_necklace:{buy:580000,sell:493000},
    red_tiger:{buy:750000,sell:637500}, red_vase:{buy:550000,sell:467500},
    red_lion:{buy:850000,sell:722500}, red_crown:{buy:1200000,sell:1020000},
    red_painting:{buy:1800000,sell:1530000}, red_statue:{buy:2200000,sell:1870000}, red_scepter:{buy:2000000,sell:1700000},
    africa_star:{buy:15465000,sell:13145200},
    // Secondaries
    pistol_item:{buy:80000,sell:68000}, compactPistol_item:{buy:60000,sell:51000},
    hcPistol_item:{buy:120000,sell:102000}, revolver_item:{buy:150000,sell:127500},
    magnum_item:{buy:180000,sell:153000}, deagle_item:{buy:280000,sell:238000},
    autoPistol_item:{buy:250000,sell:212500}, burstPistol_item:{buy:200000,sell:170000},
    // SMGs
    smg_item:{buy:220000,sell:187000}, pdw_item:{buy:180000,sell:153000},
    mp5_item:{buy:260000,sell:221000}, p90_item:{buy:300000,sell:255000},
    vector_item:{buy:350000,sell:297500}, machinePistol_item:{buy:240000,sell:204000},
    compactSMG_item:{buy:200000,sell:170000},
    // Rifles
    rifle_item:{buy:250000,sell:212500}, carbine_item:{buy:220000,sell:187000},
    ak_item:{buy:280000,sell:238000}, hk416_item:{buy:350000,sell:297500},
    battleRifle_item:{buy:380000,sell:323000},
    // DMR / Sniper
    dmr_item:{buy:400000,sell:340000}, marksman_item:{buy:550000,sell:467500},
    sniper_item:{buy:700000,sell:595000}, antiMat_item:{buy:900000,sell:765000},
    // Shotguns
    shotgun_item:{buy:180000,sell:153000}, combatShotgun_item:{buy:250000,sell:212500},
    autoShotgun_item:{buy:400000,sell:340000}, doubleBarrel_item:{buy:150000,sell:127500},
    heavyShotgun_item:{buy:320000,sell:272000},
    // LMGs
    lmg_item:{buy:500000,sell:425000}, mmg_item:{buy:700000,sell:595000},
    hmg_item:{buy:950000,sell:807500},
    // Melee
    knife_item:{buy:30000,sell:25500}, baton_item:{buy:45000,sell:38250},
    axe_item:{buy:80000,sell:68000}, sword_item:{buy:65000,sell:55250},
    machete_item:{buy:55000,sell:46750},
    // Gear
    basic_rig:{buy:5000,sell:4250}, tactical_rig:{buy:30000,sell:25500}, elite_rig:{buy:120000,sell:102000},
    light_rig:{buy:2000,sell:1700}, assault_rig:{buy:60000,sell:51000}, tactical_rig2:{buy:150000,sell:127500}, heavy_rig:{buy:400000,sell:340000},
    small_bag:{buy:5000,sell:4250}, medium_bag:{buy:30000,sell:25500}, large_bag:{buy:150000,sell:127500}, military_bag:{buy:500000,sell:425000},
    pouch:{buy:1000,sell:850}, school_bag:{buy:15000,sell:12750}, hiking_bag:{buy:80000,sell:68000}, assault_bag:{buy:250000,sell:212500},
    expedition_bag:{buy:600000,sell:510000}, gamma_bag:{buy:1500000,sell:1275000},
    light_armor:{buy:25000,sell:21250}, medium_armor:{buy:80000,sell:68000}, heavy_armor:{buy:250000,sell:212500}, elite_armor:{buy:600000,sell:510000},
    tier1_armor:{buy:15000,sell:12750}, tier2_armor:{buy:40000,sell:34000}, tier3_armor:{buy:120000,sell:102000},
    tier4_armor:{buy:300000,sell:255000}, tier5_armor:{buy:600000,sell:510000}, tier6_armor:{buy:1200000,sell:1020000},
    basic_helmet:{buy:8000,sell:6800}, adv_helmet:{buy:50000,sell:42500}, elite_helmet:{buy:200000,sell:170000},
    tier1_helmet:{buy:5000,sell:4250}, tier2_helmet:{buy:20000,sell:17000}, tier3_helmet:{buy:80000,sell:68000},
    tier4_helmet:{buy:250000,sell:212500}, tier5_helmet:{buy:600000,sell:510000}, tier6_helmet:{buy:1200000,sell:1020000},
    // Medical expanded
    surgeryKit:{buy:80000,sell:68000}, adrenaline:{buy:45000,sell:38250}, tourniquet:{buy:15000,sell:12750}, stimInjector:{buy:60000,sell:51000},
    // Throwables
    fragGrenade:{buy:35000,sell:29750}, smokeGrenade:{buy:25000,sell:21250}, flashbang:{buy:30000,sell:25500}, molotov:{buy:20000,sell:17000},
    // Keycards
    blueKeycard:{buy:80000,sell:68000}, purpleKeycard:{buy:250000,sell:212500}, goldKeycard:{buy:800000,sell:680000}, redKeycard:{buy:2000000,sell:1700000},
    // Collectibles expanded
    jade:{buy:250000,sell:212500}, goldMask:{buy:380000,sell:323000},
    crown:{buy:800000,sell:680000}, cursedIdol:{buy:650000,sell:552500},
    goldenFalcon:{buy:1500000,sell:1275000}, emperorSeal:{buy:2500000,sell:2125000}, moonStone:{buy:3500000,sell:2975000},
    encryptedUsb:{buy:120000,sell:102000}, confidentialDoc:{buy:280000,sell:238000},
    satellitePhoto:{buy:450000,sell:382500}, commanderDiary:{buy:600000,sell:510000},
};

// ========== MERGE RED COLLECTIBLES CONFIG ==========
// Helper: render item icon HTML (supports PNG images from 收藏品/ folder)
function itemIcon(def) {
    if (!def) return '📦';
    // 优先使用 3D 模型渲染出的缩略图；未生成时用 emoji 占位，生成后自动替换
    if (def._id && !def.img && typeof ItemIcons !== 'undefined') {
        var url = ItemIcons.request(def._id);
        if (url) {
            return '<img src="' + url + '" data-icon-id="' + def._id + '" style="max-width:92%;max-height:92%;object-fit:contain;pointer-events:none;">';
        }
        return '<span data-icon-id="' + def._id + '" style="pointer-events:none;font-size:20px;">' + (def.icon || '📦') + '</span>';
    }
    if (def.img) {
        var fb = (def.icon || '📦').replace(/'/g, "\\'");
        return '<img src="' + encodeURI(def.img) + '" style="max-width:90%;max-height:90%;object-fit:contain;pointer-events:none;" onerror="this.outerHTML=\'' + fb + '\'">';
    }
    return def.icon || '📦';
}

// ========== 物品 3D 检视：代理点击 ==========
// 库存格子数量多且动态生成，这里用事件代理统一接管单击，
// 双击仍然保留原来的「移动物品」行为（220ms 内取消检视）。
(function setupItemInspect() {
    var nameToId = {};
    Object.keys(ITEMS).forEach(function (k) {
        var n = ITEMS[k] && ITEMS[k].name;
        if (n && !nameToId[n]) nameToId[n] = k;
    });
    var timer = null;
    document.addEventListener('click', function (e) {
        if (typeof InspectViewer === 'undefined') return;
        if (e.target.closest && (e.target.closest('#ivRoot') || e.target.closest('.inspect-red-btn'))) return;
        var el = e.target.closest ? e.target.closest('.grid-item') : null;
        if (!el) return;
        if (el.classList.contains('unrevealed') || el.classList.contains('taken')) return;
        var id = el.dataset ? el.dataset.itemId : null;
        if (!id) {
            var title = el.getAttribute('title') || '';
            var name = title.split(' - ')[0].trim();
            id = nameToId[name] || null;
            if (!id && name) {
                // 收集品是在本监听器创建后才并入 ITEMS 的，按名字惰性反查
                for (var _k in ITEMS) {
                    if (ITEMS[_k] && ITEMS[_k].name === name) { nameToId[name] = _k; id = _k; break; }
                }
            }
        }
        if (!id || !ITEMS[id]) return;
        clearTimeout(timer);
        timer = setTimeout(function () {
            InspectViewer.open(id);
        }, 220);
    }, true);
    document.addEventListener('dblclick', function () {
        clearTimeout(timer);
    }, true);
})();

// Merge red collectibles into ITEMS, SHOP_PRICES (balanced container distribution)
if (typeof RED_COLLECTIBLES_CONFIG !== 'undefined') {
    for (var rcId in RED_COLLECTIBLES_CONFIG) {
        var rcCfg = RED_COLLECTIBLES_CONFIG[rcId];
        ITEMS[rcId] = {
            name: rcCfg.name,
            value: rcCfg.value,
            icon: rcCfg.icon || '💎',
            img: rcCfg.img || null,
            type: 'valuable',
            rarity: 'ultimate',
            w: rcCfg.w || 1,
            h: rcCfg.h || 1
        };
        SHOP_PRICES[rcId] = {
            buy: rcCfg.value,
            sell: Math.floor(rcCfg.value * 0.85)
        };
    }
    // FIX-06：以前这里把 93 件红藏品全量 concat 进 safe / premiumBox 的 items 数组，
    // 等于把「稀有」做成了「保底」。现在改为独立掷骰，这里只负责建掷骰池。
    // 池子按价值分三档；premiumBox 字面量里手写的那九件排除在外，避免重复计入。
    var _handwritten = {};
    for (var _hi = 0; _hi < RED_HANDWRITTEN_IN_PREMIUM.length; _hi++) {
        _handwritten[RED_HANDWRITTEN_IN_PREMIUM[_hi]] = true;
    }
    for (var rcPoolId in RED_COLLECTIBLES_CONFIG) {
        if (_handwritten[rcPoolId]) continue;
        var _v = RED_COLLECTIBLES_CONFIG[rcPoolId].value || 0;
        var _t = _v < RED_TIER_BOUNDS[0] ? 0 : (_v < RED_TIER_BOUNDS[1] ? 1 : 2);
        RED_ROLL_POOL[_t].push(rcPoolId);
    }
}

// Merge white/blue/purple/gold collectibles into ITEMS, SHOP_PRICES (balanced)
if (typeof COLLECTIBLES_CONFIG !== 'undefined') {
    for (var cId in COLLECTIBLES_CONFIG) {
        var cCfg = COLLECTIBLES_CONFIG[cId];
        ITEMS[cId] = {
            name: cCfg.name,
            value: cCfg.value,
            icon: cCfg.icon || '📦',
            img: cCfg.img || null,
            type: 'valuable',
            rarity: cCfg.rarity,
            w: cCfg.w || 1,
            h: cCfg.h || 1
        };
        SHOP_PRICES[cId] = {
            buy: cCfg.value,
            sell: Math.floor(cCfg.value * 0.85)
        };
    }
    // Distribute collectibles to containers by rarity (selective, not all)
    var _wcIds = [], _bcIds = [], _pcIds = [], _gcIds = [];
    for (var cId2 in COLLECTIBLES_CONFIG) {
        var _r = COLLECTIBLES_CONFIG[cId2].rarity;
        if (_r === 'common') _wcIds.push(cId2);
        else if (_r === 'rare') _bcIds.push(cId2);
        else if (_r === 'epic') _pcIds.push(cId2);
        else if (_r === 'legendary') _gcIds.push(cId2);
    }
    // White → supplyBox (third only, keep supply box focused on basics)
    CONTAINER_TYPES.supplyBox.items = CONTAINER_TYPES.supplyBox.items.concat(
        _wcIds.filter(function(_, i) { return i % 3 === 0; })
    );
    // Blue → equipBox (third only)
    CONTAINER_TYPES.equipBox.items = CONTAINER_TYPES.equipBox.items.concat(
        _bcIds.filter(function(_, i) { return i % 3 === 0; })
    );
    // Purple → equipBox (quarter), safe (third)
    CONTAINER_TYPES.equipBox.items = CONTAINER_TYPES.equipBox.items.concat(
        _pcIds.filter(function(_, i) { return i % 4 === 0; })
    );
    CONTAINER_TYPES.safe.items = CONTAINER_TYPES.safe.items.concat(
        _pcIds.filter(function(_, i) { return i % 3 === 0; })
    );
    // Gold → safe (quarter), premiumBox (third)
    CONTAINER_TYPES.safe.items = CONTAINER_TYPES.safe.items.concat(
        _gcIds.filter(function(_, i) { return i % 4 === 0; })
    );
    CONTAINER_TYPES.premiumBox.items = CONTAINER_TYPES.premiumBox.items.concat(
        _gcIds.filter(function(_, i) { return i % 3 === 0; })
    );
}

// ========== FIX-07：经济重定标（一次性遍历，不逐条改字面量）==========
//
// 必须在所有收藏品合并完之后执行，否则后合并进来的条目会漏掉缩放，
// 而漏掉的那些恰好是最贵的红藏品 —— 这种错误在数值上表现为「怎么调都还差一点」。
//
// 顺序要点：buy / sell 都从**原始的 ITEMS[].value** 派生，所以必须先算价格、再缩放 value。
// 反过来做的话，buy 会变成「已缩放的 value × 0.625」，等于把系数平方，价格会低到离谱。
for (var _pid in SHOP_PRICES) {
    var _origPrice = (ITEMS[_pid] && typeof ITEMS[_pid].value === 'number')
        ? ITEMS[_pid].value
        : SHOP_PRICES[_pid].buy;
    SHOP_PRICES[_pid].buy = Math.round(_origPrice * ECON.PRICE_SCALE / 100) * 100;
    // sell 由 value 派生而不是由 buy 派生：否则「战利品估值」和「零售价」又被绑回一起，
    // 0.625 × 0.85 = 0.53 意味着卖价接近半价，拆箱即套利。
    SHOP_PRICES[_pid].sell = Math.round(_origPrice * ECON.LOOT_SCALE * ECON.SELL_RATE / 100) * 100;
}
for (var _iid2 in ITEMS) {
    if (ITEMS[_iid2] && typeof ITEMS[_iid2].value === 'number') {
        ITEMS[_iid2].value = Math.round(ITEMS[_iid2].value * ECON.LOOT_SCALE);
    }
}

// 为每个物品记录 id：3D 图标 / 检视器按 id 取模型
for (var _iid in ITEMS) { if (ITEMS[_iid]) ITEMS[_iid]._id = _iid; }
// 空闲时预渲染库存缩略图（分帧执行，不阻塞首屏）
if (typeof ItemIcons !== 'undefined') {
    setTimeout(function () {
        try {
            // 自定义收集品保留原图，不需要离屏渲染；只预热没有图片的基础物品
            var iconIds = Object.keys(ITEMS).filter(function (k) { return ITEMS[k] && !ITEMS[k].img; });
            ItemIcons.prewarm(iconIds.slice(0, 45));
        } catch (e) { }
    }, 3200);
}

// ========== SECTION 3: AUDIO SYSTEM ==========
let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; audioCtx = new AC(); }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

// ========== 物资揭示音效 (搜索音效文件夹) ==========
// 文件名 → 稀有度映射:
//   白色蓝色.mp3 → common / uncommon / rare (白蓝档)
//   紫色.mp3     → epic (紫档)
//   金色.mp3     → legendary (金档)
//   红色.mp3     → ultimate (红档)
const RARITY_SOUNDS = {
    common:    '搜索音效/白色蓝色.mp3',
    uncommon:  '搜索音效/白色蓝色.mp3',
    rare:      '搜索音效/白色蓝色.mp3',
    epic:      '搜索音效/紫色.mp3',
    legendary: '搜索音效/金色.mp3',
    ultimate:  '搜索音效/红色.mp3',
};
// 使用 HTMLAudioElement 预加载 (兼容 file:// 协议; fetch 在 file:// 下会被 CORS 拦截)
const _rarityAudioCache = {};
function preloadRaritySounds() {
    Object.keys(RARITY_SOUNDS).forEach(rarity => {
        const a = new Audio(RARITY_SOUNDS[rarity]);
        a.preload = 'auto';
        a.volume = 0.6;
        a.load();
        _rarityAudioCache[rarity] = a;
    });
}
preloadRaritySounds();

function playRaritySound(rarity) {
    const cached = _rarityAudioCache[rarity];
    if (!cached) return false;
    // readyState >= 2 表示已有足够数据可以播放
    if (cached.readyState < 2) return false;
    try {
        // 每次创建新 Audio (浏览器缓存使加载瞬间完成), 支持快速连续播放不互相打断
        const audio = new Audio(RARITY_SOUNDS[rarity]);
        audio.volume = 0.6 * getSfxVolume();
        audio.play().catch(() => {});
        return true;
    } catch(e) { return false; }
}

// 获取当前音效音量（主音量 × 音效音量）
function getSfxVolume() {
    try {
        if (typeof GameSettings !== 'undefined' && typeof GameSettings.getSettings === 'function') {
            const audio = GameSettings.getSettings().audio;
            if (audio) {
                return (audio.masterVolume !== undefined ? audio.masterVolume : 0.8) * 
                       (audio.sfxVolume !== undefined ? audio.sfxVolume : 0.9);
            }
        }
    } catch(e) { reportInitError('getSfxVolume:GameSettings', e); }
    return 0.7; // 默认音量
}

function playTone(freq, duration, type, vol, glideTo) {
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        if (glideTo) osc.frequency.linearRampToValueAtTime(glideTo, ctx.currentTime + duration);
        const finalVol = (vol || 0.08) * getSfxVolume();
        gain.gain.setValueAtTime(finalVol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration);
    } catch(e) { reportInitError('playTone', e); }
}

function playNoise(duration, vol) {
    try {
        const ctx = getAudioCtx();
        const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
        const src = ctx.createBufferSource(); src.buffer = buf;
        const gain = ctx.createGain();
        const finalVol = (vol || 0.05) * getSfxVolume();
        gain.gain.setValueAtTime(finalVol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 0.5;
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        src.start(ctx.currentTime); src.stop(ctx.currentTime + duration);
    } catch(e) { reportInitError('playNoise', e); }
}

function sfxShoot(kind) {
    if (typeof AudioEngine !== 'undefined') { AudioEngine.play('shoot', { kind: kind || 'rifle' }); return; }
    playNoise(0.08, 0.06); playTone(80, 0.06, 'sawtooth', 0.06);
}
function sfxHit() {
    if (typeof AudioEngine !== 'undefined') { AudioEngine.play('hit', { headshot: false }); return; }
    playTone(200, 0.05, 'square', 0.04, 80);
}
function sfxHeadshot() {
    if (typeof AudioEngine !== 'undefined') { AudioEngine.play('hit', { headshot: true }); return; }
    playTone(600, 0.08, 'square', 0.06, 200); playTone(800, 0.06, 'sine', 0.04);
}
function sfxReload(stage) {
    if (typeof AudioEngine !== 'undefined') { AudioEngine.play('reload', { stage: stage || 'in' }); return; }
    playTone(300, 0.1, 'triangle', 0.04); setTimeout(() => playTone(500, 0.08, 'triangle', 0.04), 100);
}
function sfxPickup(rarity) {
    // 优先播放搜索音效文件夹中的揭示音效
    if (playRaritySound(rarity)) return;
    // 后备：合成音效 (音频文件未加载时使用)
    const rarityFreq = { common: 220, uncommon: 330, rare: 440, epic: 550, legendary: 660, ultimate: 880 };
    const freq = rarityFreq[rarity] || 330;
    playTone(freq, 0.1, 'sine', 0.07);
    if (rarity === 'legendary') { setTimeout(() => playTone(freq * 1.25, 0.1, 'sine', 0.06), 80); setTimeout(() => playTone(freq * 1.5, 0.12, 'sine', 0.05), 160); }
    if (rarity === 'ultimate') { playTone(freq * 0.75, 0.12, 'triangle', 0.06); setTimeout(() => { playTone(freq, 0.15, 'sine', 0.08); playTone(freq * 1.5, 0.15, 'sine', 0.06); }, 100); setTimeout(() => playTone(freq * 2, 0.2, 'sine', 0.05), 200); }
}
function sfxSearchStart() { playNoise(0.15, 0.04); playTone(150, 0.15, 'sawtooth', 0.03, 300); }
function sfxSearchComplete() { playTone(400, 0.1, 'sine', 0.06); setTimeout(() => playTone(600, 0.1, 'sine', 0.06), 80); setTimeout(() => playTone(800, 0.12, 'sine', 0.05), 160); }
function sfxExtractTick() { playTone(440, 0.05, 'sine', 0.04); }
function sfxExtractComplete() { playTone(523, 0.15, 'sine', 0.08); setTimeout(() => playTone(659, 0.15, 'sine', 0.08), 150); setTimeout(() => playTone(784, 0.2, 'sine', 0.08), 300); }
function sfxUseItem() { playTone(350, 0.08, 'sine', 0.04, 500); }
function sfxEnemyAlert() { playTone(150, 0.2, 'sawtooth', 0.04, 300); }
function sfxFootstep(isSprinting, isCrouching, surface) {
    if (typeof AudioEngine !== 'undefined') {
        AudioEngine.play('footstep', { surface: surface || 'concrete', sprint: isSprinting, crouch: isCrouching });
        return;
    }
    const vol = isSprinting ? 0.025 : (isCrouching ? 0.006 : 0.015);
    const freq = isSprinting ? 180 : (isCrouching ? 80 : 120);
    playNoise(0.04, vol);
    playTone(freq, 0.03, 'square', vol * 0.3);
}
function sfxKillEnemy() {
    if (typeof AudioEngine !== 'undefined') { AudioEngine.play('kill'); return; }
    playTone(120, 0.1, 'sawtooth', 0.05, 60); playNoise(0.1, 0.03);
}
function sfxPlayerDeath() {
    if (typeof AudioEngine !== 'undefined') { AudioEngine.play('hurt'); }
    playTone(60, 0.5, 'sawtooth', 0.08, 20); playNoise(0.3, 0.06);
}

// 根据玩家位置推断脚下材质，供脚步声/弹着音使用
function getGroundSurface() {
    if (typeof _standingOnObstacle !== 'undefined' && _standingOnObstacle) {
        const s = _standingOnObstacle.userData && _standingOnObstacle.userData.surface;
        if (s) return s;
        return 'metal';
    }
    const px = playerGroup ? playerGroup.position.x : 0;
    const pz = playerGroup ? playerGroup.position.z : 0;
    const roads = (typeof MAP_DATA !== 'undefined' && MAP_DATA && MAP_DATA.roads) || [];
    for (const r of roads) {
        if (Math.abs(px - r.x) < r.w / 2 && Math.abs(pz - r.z) < r.d / 2) return 'asphalt';
    }
    const theme = (typeof MAP_DATA !== 'undefined' && MAP_DATA && MAP_DATA.theme) || {};
    return theme.groundSurface || 'grass';
}
let _stepTimer = 0;
let _standingOnObstacle = null;

// ========== SECTION 4: GRID HELPERS ==========
function canPlaceInGrid(grid, cols, itemId, col, row, excludeEntry) {
    const def = ITEMS[itemId];
    if (!def) return false;
    if (col < 0 || row < 0 || col + def.w > cols || row + def.h > (grid.rows || CONFIG.BACKPACK_ROWS)) return false;
    for (let r = row; r < row + def.h; r++) {
        for (let c = col; c < col + def.w; c++) {
            const cell = (grid[r] && grid[r][c]) ? grid[r][c] : null;
            if (cell && cell !== excludeEntry) return false;
        }
    }
    return true;
}

function placeInGrid(grid, cols, itemId, col, row) {
    const def = ITEMS[itemId];
    if (!def) return false;
    if (!canPlaceInGrid(grid, cols, itemId, col, row)) return false;
    const entry = { id: itemId, col, row };
    if (!grid._items) grid._items = [];
    grid._items.push(entry);
    for (let r = row; r < row + def.h; r++) {
        if (!grid[r]) grid[r] = [];
        for (let c = col; c < col + def.w; c++) {
            grid[r][c] = entry;
        }
    }
    return true;
}

function removeFromGrid(grid, entry) {
    const def = ITEMS[entry.id];
    if (!def) return;
    for (let r = entry.row; r < entry.row + def.h; r++) {
        for (let c = entry.col; c < entry.col + def.w; c++) {
            if (grid[r]) grid[r][c] = null;
        }
    }
    if (grid._items) {
        const idx = grid._items.indexOf(entry);
        if (idx >= 0) grid._items.splice(idx, 1);
    }
}

// 从容器中拿取物品：同时标记 taken 并清除容器网格占用（修复存放过的区域无法再存放的bug）
function takeContainerItem(container, item) {
    item.taken = true;
    if (item.gridEntry && container && container.grid) {
        removeFromGrid(container.grid, item.gridEntry);
    }
}

function findFreeSlot(grid, cols, maxRows, itemId) {
    const def = ITEMS[itemId];
    if (!def) return null;
    for (let r = 0; r <= maxRows - def.h; r++) {
        for (let c = 0; c <= cols - def.w; c++) {
            if (canPlaceInGrid(grid, cols, itemId, c, r)) return { col: c, row: r };
        }
    }
    return null;
}

function initGrid(rows) {
    const grid = { _items: [], rows };
    for (let r = 0; r < rows; r++) grid[r] = [];
    return grid;
}

function countGridItems(grid) {
    return grid._items ? grid._items.length : 0;
}

function gridIsEmpty(grid) {
    return countGridItems(grid) === 0;
}

// ========== Drag & Drop ==========
let dragData = null;

function canDropAt(grid, cols, maxRows, entry, col, row, excludeEntry) {
    const def = ITEMS[entry.id];
    if (!def) return false;
    if (col < 0 || row < 0 || col + def.w > cols || row + def.h > maxRows) return false;
    for (let r = row; r < row + def.h; r++) {
        for (let c = col; c < col + def.w; c++) {
            const cell = (grid[r] && grid[r][c]) ? grid[r][c] : null;
            if (cell && cell !== excludeEntry) return false;
        }
    }
    return true;
}

function moveGridItem(grid, cols, maxRows, entry, newCol, newRow) {
    if (!canDropAt(grid, cols, maxRows, entry, newCol, newRow, entry)) return false;
    var savedKeyUses = entry._keyUses;
    removeFromGrid(grid, entry);
    var result = placeInGrid(grid, cols, entry.id, newCol, newRow);
    if (result && savedKeyUses !== undefined) {
        var ne = grid._items[grid._items.length - 1];
        if (ne) ne._keyUses = savedKeyUses;
    }
    return result;
}

function autoSortGrid(grid, cols, maxRows) {
    if (!grid._items || grid._items.length === 0) return;
    const originalPositions = grid._items.map(e => ({ ...e }));
    const items = [...grid._items];
    const rarityOrder = ['ultimate', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
    items.sort((a, b) => {
        const ra = rarityOrder.indexOf(ITEMS[a.id]?.rarity);
        const rb = rarityOrder.indexOf(ITEMS[b.id]?.rarity);
        if (ra !== rb) return ra - rb;
        const sa = (ITEMS[a.id]?.w || 1) * (ITEMS[a.id]?.h || 1);
        const sb = (ITEMS[b.id]?.w || 1) * (ITEMS[b.id]?.h || 1);
        return sb - sa;
    });
    const failed = [];
    for (const entry of [...grid._items]) removeFromGrid(grid, entry);
    for (const entry of items) {
        const slot = findFreeSlot(grid, cols, maxRows, entry.id);
        if (slot) {
            placeInGrid(grid, cols, entry.id, slot.col, slot.row);
            // Preserve custom properties (e.g., keycard uses)
            var ne = grid._items[grid._items.length - 1];
            if (ne && entry._keyUses !== undefined) ne._keyUses = entry._keyUses;
        }
        else failed.push(entry);
    }
    // Restore failed items to their original positions
    for (const entry of failed) {
        const orig = originalPositions.find(o => o.id === entry.id);
        if (orig && canPlaceInGrid(grid, cols, entry.id, orig.col, orig.row)) {
            placeInGrid(grid, cols, entry.id, orig.col, orig.row);
            var ne2 = grid._items[grid._items.length - 1];
            if (ne2 && entry._keyUses !== undefined) ne2._keyUses = entry._keyUses;
        } else {
            const slot = findFreeSlot(grid, cols, maxRows, entry.id);
            if (slot) {
                placeInGrid(grid, cols, entry.id, slot.col, slot.row);
                var ne3 = grid._items[grid._items.length - 1];
                if (ne3 && entry._keyUses !== undefined) ne3._keyUses = entry._keyUses;
            }
        }
    }
}

// Global drag handlers (exposed for HTML ondrag* attributes)
function onDragStart(gridType, entryIdx, e) {
    const evt = e || event;
    let grid, cols, maxRows, entry;
    if (gridType === 'stash') {
        var sd = getStashDims(); grid = P.stashGrid; cols = sd.cols; maxRows = sd.rows;
        entry = grid._items[entryIdx];
    } else if (gridType === 'backpack') {
        grid = S.backpack; cols = S.backpackCols; maxRows = S.backpackRows;
        entry = grid._items[entryIdx];
    } else return;
    if (!entry) return;
    dragData = { grid, cols, maxRows, entry, gridType };
    if (evt && evt.dataTransfer) {
        evt.dataTransfer.effectAllowed = 'move';
        evt.dataTransfer.setData('text/plain', gridType + ':' + entryIdx);
    }
}

function onDragOverCell(gridType, col, row) {
    if (!dragData || dragData.gridType !== gridType) return;
    const { grid, cols, maxRows, entry } = dragData;
    if (canDropAt(grid, cols, maxRows, entry, col, row, entry)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }
}

function onDropOnCell(gridType, col, row) {
    if (!dragData || dragData.gridType !== gridType) return;
    const { grid, cols, maxRows, entry } = dragData;
    if (moveGridItem(grid, cols, maxRows, entry, col, row)) {
        // Re-render the appropriate grid
        if (gridType === 'stash') {
            renderStashGrid();
            savePersistent();
        } else if (gridType === 'backpack') {
            if (S.currentSearchContainer) {
                renderSearchGrid(S.currentSearchContainer);
                updateSearchValue();
            }
        }
    }
    dragData = null;
}

function onDragEnd() {
    dragData = null;
    // Remove highlight from all cells
    document.querySelectorAll('.grid-cell.drag-over').forEach(el => el.classList.remove('drag-over'));
}

// ========== SECTION 5: MAP DATA (loaded from map/*.js) ==========
let MAP_ZONES = [];
let FIXED_BUILDINGS = [];
let FIXED_EXTRACTS = [];
let FIXED_CONTAINERS = [];
let HARD_MODE_CONTAINERS = [];
let FIXED_GROUND_SPAWNS = [];
let HARD_MODE_GROUND_SPAWNS = [];
let groundLootItems = [];

function loadMapData() {
    if (typeof MAP_DATA !== 'undefined') {
        MAP_ZONES = MAP_DATA.zones || [];
        FIXED_BUILDINGS = MAP_DATA.buildings || [];
        FIXED_EXTRACTS = MAP_DATA.extracts || [];
        FIXED_CONTAINERS = MAP_DATA.containers || [];
        HARD_MODE_CONTAINERS = MAP_DATA.hardContainers || [];
        FIXED_GROUND_SPAWNS = MAP_DATA.groundSpawns || [];
        HARD_MODE_GROUND_SPAWNS = MAP_DATA.hardGroundSpawns || [];
        CONFIG.mapSize = MAP_DATA.mapSize || 110;
        CONFIG.gameTime = MAP_DATA.gameTime || { normal: 900, hard: 600 };
        CONFIG.enemyCount = MAP_DATA.enemyCount || { normal: 7, hard: 11 };
        return MAP_DATA;
    }
    return null;
}

// Legacy fallback (uses military_base if no map script loaded)
if (typeof MAP_DATA === 'undefined') {
    MAP_ZONES = [
        { name: '军事基地', x: 0, z: 5, color: '#5a6a7a' },{ name: '工业区', x: -32, z: -30, color: '#6a6a5a' },
        { name: '住宅区', x: 30, z: -28, color: '#7a6a5a' },{ name: '港口', x: 30, z: 28, color: '#5a6a7a' },
        { name: '医疗营地', x: -28, z: 30, color: '#5a7a6a' },{ name: '森林哨站', x: -10, z: -42, color: '#4a6a4a' },
    ];
    FIXED_BUILDINGS = [
        { x: 0, z: 0, w: 16, d: 14, h: 7, color: 0x4a5568, name: '指挥中心' },{ x: 12, z: 10, w: 8, d: 8, h: 4, color: 0x5a5a5a, name: '军械库' },
        { x: -8, z: 12, w: 10, d: 6, h: 3, color: 0x4a4a5a, name: '营房' },{ x: -35, z: -25, w: 16, d: 14, h: 6, color: 0x6a6a52, name: '主工厂' },
        { x: -25, z: -38, w: 10, d: 8, h: 4, color: 0x5a5a4a, name: '仓库A' },{ x: -40, z: -18, w: 8, d: 8, h: 5, color: 0x5a5a42, name: '车间' },
        { x: 25, z: -35, w: 12, d: 10, h: 5, color: 0x8a7a6a, name: '公寓楼' },{ x: 35, z: -22, w: 10, d: 8, h: 4, color: 0x7a6a5a, name: '商店' },
        { x: 28, z: -18, w: 6, d: 10, h: 4, color: 0x6a5a4a, name: '民房' },{ x: 22, z: 32, w: 14, d: 12, h: 5, color: 0x5a6a6a, name: '码头仓库' },
        { x: 38, z: 25, w: 10, d: 8, h: 3, color: 0x4a5a6a, name: '调度室' },{ x: -22, z: 35, w: 12, d: 10, h: 4, color: 0x5a7a6a, name: '野战医院' },
        { x: -35, z: 28, w: 8, d: 8, h: 3, color: 0x4a6a5a, name: '药品库' },{ x: -5, z: -45, w: 10, d: 10, h: 4, color: 0x3a5a3a, name: '哨站' },
    ];
    FIXED_EXTRACTS = [{ x: -48, z: 0, name: '西撤离点' },{ x: 45, z: -40, name: '东南撤离点' },{ x: 0, z: 50, name: '北撤离点' }];
    FIXED_CONTAINERS = [
        { type: 'weaponBox', x: 2, z: -5 },{ type: 'weaponBox', x: -3, z: 3 },{ type: 'safe', x: 0, z: 1 },
        { type: 'equipBox', x: 10, z: 8 },{ type: 'safe', x: 8, z: -2 },{ type: 'ammoBox', x: -5, z: -3 },{ type: 'supplyBox', x: 5, z: 5 },
        { type: 'weaponBox', x: -38, z: -28 },{ type: 'equipBox', x: -32, z: -22 },{ type: 'supplyBox', x: -28, z: -36 },
        { type: 'weaponBox', x: -25, z: -20 },{ type: 'ammoBox', x: -38, z: -33 },{ type: 'safe', x: -34, z: -26 },
        { type: 'medBox', x: 28, z: -32 },{ type: 'supplyBox', x: 22, z: -38 },{ type: 'medBox', x: 33, z: -24 },
        { type: 'safe', x: 30, z: -28 },{ type: 'supplyBox', x: 24, z: 30 },{ type: 'weaponBox', x: 35, z: 22 },
        { type: 'equipBox', x: 20, z: 35 },{ type: 'ammoBox', x: 32, z: 28 },{ type: 'safe', x: 28, z: 25 },
        { type: 'medBox', x: -24, z: 33 },{ type: 'medBox', x: -30, z: 28 },{ type: 'supplyBox', x: -20, z: 38 },
        { type: 'medBox', x: -28, z: 36 },{ type: 'safe', x: -25, z: 30 },{ type: 'supplyBox', x: -34, z: 25 },
        { type: 'supplyBox', x: -8, z: -42 },{ type: 'ammoBox', x: -2, z: -48 },{ type: 'weaponBox', x: -15, z: -40 },
        { type: 'medBox', x: -10, z: -38 },{ type: 'equipBox', x: -20, z: -45 },
        { type: 'supplyBox', x: 15, z: -15 },{ type: 'supplyBox', x: -15, z: -15 },{ type: 'medBox', x: 10, z: 15 },
        { type: 'ammoBox', x: -12, z: 18 },{ type: 'supplyBox', x: 18, z: 8 },{ type: 'supplyBox', x: -18, z: -8 },
        { type: 'equipBox', x: -8, z: -20 },{ type: 'weaponBox', x: 20, z: -8 },
    ];
    HARD_MODE_CONTAINERS = [
        { type: 'premiumBox', x: 1, z: -2 },{ type: 'premiumBox', x: -36, z: -24 },{ type: 'premiumBox', x: 26, z: -30 },
        { type: 'premiumBox', x: 26, z: 27 },{ type: 'premiumBox', x: -26, z: 32 },
        { type: 'safe', x: -10, z: 0 },{ type: 'safe', x: 15, z: -25 },{ type: 'safe', x: -15, z: 25 },
    ];
    CONFIG.mapSize = 110; CONFIG.gameTime = { normal: 900, hard: 600 };
}

// ====== Ground Loot (Open World Spawn) ======
function weightedRandom(weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [key, w] of Object.entries(weights)) {
        r -= w;
        if (r <= 0) return key;
    }
    return 'common';
}

function getRandomItemByRarity(rarity) {
    const candidates = Object.entries(ITEMS).filter(([k, v]) => v.rarity === rarity && v.type !== 'weapon' && v.type !== 'armor' && v.type !== 'helmet' && v.type !== 'chestRig' && v.type !== 'backpack').map(([k]) => k);
    if (candidates.length === 0) {
        // Fallback to any item of this rarity
        const all = Object.entries(ITEMS).filter(([k, v]) => v.rarity === rarity).map(([k]) => k);
        if (all.length === 0) return null;
        return all[Math.floor(Math.random() * all.length)];
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}

const MIN_GROUND_LOOT_DIST = 2.5; // Min distance from containers and other ground loot
const MIN_GL_TO_GL_DIST = 2.0;    // Min distance between ground loot items

function isPositionNearContainer(x, z, containersList, minDist) {
    for (const c of containersList) {
        const dx = x - c.x, dz = z - c.z;
        if (dx*dx + dz*dz < minDist*minDist) return true;
    }
    return false;
}

function isPositionNearExistingLoot(x, z, lootItems, minDist) {
    for (const gl of lootItems) {
        const dx = x - gl.x, dz = z - gl.z;
        if (dx*dx + dz*dz < minDist*minDist) return true;
    }
    return false;
}

function findNearbyOpenSpot(origX, origZ, containersList, existingLoot, maxAttempts) {
    // Try offsets in increasing radius
    const angles8 = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, 5*Math.PI/4, 3*Math.PI/2, 7*Math.PI/4];
    for (let r = 2; r <= maxAttempts; r += 1.5) {
        // Shuffle angle order each time for randomness
        const shuffled = [...angles8].sort(() => Math.random() - 0.5);
        for (const angle of shuffled) {
            const tx = origX + Math.cos(angle) * r;
            const tz = origZ + Math.sin(angle) * r;
            if (!isPositionNearContainer(tx, tz, containersList, MIN_GROUND_LOOT_DIST) &&
                !isPositionNearExistingLoot(tx, tz, existingLoot, MIN_GL_TO_GL_DIST)) {
                return { x: tx, z: tz };
            }
        }
    }
    return null; // No open spot found within range
}

function spawnGroundLoot() {
    // Clean up old ground loot
    groundLootItems.forEach(gl => { if (gl.mesh && gl.mesh.parent) scene.remove(gl.mesh); });
    groundLootItems = [];

    const spawns = [...(FIXED_GROUND_SPAWNS || [])];
    if (S.mode === 'hard') spawns.push(...(HARD_MODE_GROUND_SPAWNS || []));

    for (const sp of spawns) {
        let spx = sp.x, spz = sp.z;
        // Check if this spawn point overlaps with any container or existing ground loot
        if (isPositionNearContainer(spx, spz, containers, MIN_GROUND_LOOT_DIST) ||
            isPositionNearExistingLoot(spx, spz, groundLootItems, MIN_GL_TO_GL_DIST)) {
            const alt = findNearbyOpenSpot(spx, spz, containers, groundLootItems, 10);
            if (alt) { spx = alt.x; spz = alt.z; }
            else continue; // No room nearby, skip this spawn
        }

        const rarity = weightedRandom(sp.rarityWeights || { common: 60, uncommon: 25, rare: 10, epic: 3.5, legendary: 1.2, ultimate: 0.15 });
        const itemId = getRandomItemByRarity(rarity);
        if (!itemId) continue;
        const def = ITEMS[itemId];
        if (!def) continue;

        const grp = new THREE.Group();
        const glowColor = new THREE.Color(RARITY[rarity]?.color || 0xffffff);
        const isHighValue = rarity === 'ultimate' || rarity === 'legendary' || rarity === 'epic';

        // Glow ring (color based on rarity)
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.25, 0.55, 16),
            new THREE.MeshBasicMaterial({
                color: glowColor, transparent: true,
                opacity: isHighValue ? 0.6 : 0.35,
                side: THREE.DoubleSide
            })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        grp.add(ring);

        // 接触阴影：让悬浮模型有落地感，比真实阴影便宜
        const blob = new THREE.Mesh(
            new THREE.PlaneGeometry(1.0, 1.0),
            new THREE.MeshBasicMaterial({ map: getLootShadowTexture(), transparent: true, opacity: 0.55, depthWrite: false })
        );
        blob.rotation.x = -Math.PI / 2;
        blob.position.y = 0.022;
        blob.renderOrder = 2;
        grp.add(blob);

        // Light beam for epic+ items
        if (isHighValue) {
            const beam = new THREE.Mesh(
                new THREE.CylinderGeometry(0.04, 0.25, 3 + (rarity === 'ultimate' ? 2 : 0), 8, 1, true),
                new THREE.MeshBasicMaterial({
                    color: glowColor, transparent: true,
                    opacity: rarity === 'ultimate' ? 0.25 : 0.12,
                    side: THREE.DoubleSide,
                })
            );
            beam.position.y = 1.5 + (rarity === 'ultimate' ? 1 : 0);
            grp.add(beam);
        }

        // 真实物品模型：合并网格以控制 draw call，靠近后缓慢旋转悬浮
        if (typeof ItemModels !== 'undefined') {
            const model = ItemModels.create(itemId, {
                merged: true,
                size: isHighValue ? 0.46 : 0.38,
                ground: true,
            });
            model.rotation.y = Math.random() * Math.PI * 2;
            model.position.y += 0.05;
            grp.add(model);
            grp.userData.model = model;
        } else {
            // 兜底：发光球
            const orb = new THREE.Mesh(
                new THREE.SphereGeometry(isHighValue ? 0.18 : 0.12, 8, 8),
                new THREE.MeshStandardMaterial({
                    color: glowColor, emissive: glowColor,
                    emissiveIntensity: isHighValue ? 0.5 : 0.2,
                    metalness: 0.3, roughness: 0.5
                })
            );
            orb.position.y = 0.1;
            grp.add(orb);
        }

        // Pulsating animation data
        grp.userData.time = Math.random() * Math.PI * 2;

        grp.position.set(spx, 0, spz);
        scene.add(grp);

        groundLootItems.push({
            mesh: grp,
            x: spx, z: spz,
            itemId,
            name: def.name,
            value: def.value,
            icon: def.icon,
            rarity,
            taken: false,
            radius: 1.2,
        });
    }
}

// 掉落物接触阴影（复用一张径向渐变贴图）
let _lootShadowTex = null;
function getLootShadowTexture() {
    if (_lootShadowTex) return _lootShadowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(0,0,0,0.62)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    _lootShadowTex = new THREE.CanvasTexture(c);
    return _lootShadowTex;
}

/** 拾取动画：物品缩小并飞向镜头，避免“瞬间消失” */
function playLootPickupFX(gl) {
    const mesh = gl.mesh;
    gl.taken = true;
    if (!mesh) return;
    const start = mesh.position.clone();
    const startScale = mesh.scale.clone();
    const camWorld = new THREE.Vector3();
    camera.getWorldPosition(camWorld);
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const target = camWorld.clone().addScaledVector(fwd, 0.55).add(new THREE.Vector3(0, -0.18, 0));
    const t0 = performance.now();
    function step() {
        const t = Math.min(1, (performance.now() - t0) / 260);
        const e = t * t * (3 - 2 * t);
        mesh.position.lerpVectors(start, target, e);
        mesh.position.y += Math.sin(e * Math.PI) * 0.55;
        mesh.scale.copy(startScale).multiplyScalar(Math.max(0.05, 1 - 0.9 * e));
        mesh.rotation.y += 0.3;
        if (t < 1) requestAnimationFrame(step);
        else if (mesh.parent) scene.remove(mesh);
    }
    requestAnimationFrame(step);
}

function updateGroundLootAnimation() {
    if (!groundLootItems.length) return;
    const px = playerGroup ? playerGroup.position.x : 0;
    const pz = playerGroup ? playerGroup.position.z : 0;
    for (const gl of groundLootItems) {
        if (gl.taken || !gl.mesh) continue;
        // 距离剔除：远处掉落物不参与绘制，避免几十个模型拖累帧率
        const dx = gl.x - px, dz = gl.z - pz;
        const visible = (dx * dx + dz * dz) < 3025; // 55m
        if (gl.mesh.visible !== visible) gl.mesh.visible = visible;
        if (!visible) continue;
        gl.mesh.userData.time += 0.03;
        gl.mesh.position.y = Math.sin(gl.mesh.userData.time) * 0.05 + 0.02;
        gl.mesh.rotation.y += 0.012;
        const model = gl.mesh.userData.model;
        if (model) {
            // 模型绕自身轴慢转，光环保持平放
            model.rotation.y += 0.006;
        }
    }
}

// 拾取提示：右侧滚动小卡片，带 3D 缩略图与稀有度色条
function showLootToast(def, value, rarity) {
    if (!def) return;
    let layer = document.getElementById('lootToastLayer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'lootToastLayer';
        layer.style.cssText = 'position:fixed;right:26px;top:36%;display:flex;flex-direction:column;gap:6px;z-index:96;pointer-events:none;';
        document.body.appendChild(layer);
    }
    while (layer.children.length >= 4) layer.removeChild(layer.firstChild);
    const color = (RARITY[rarity] && RARITY[rarity].color) || '#9e9e9e';
    const card = document.createElement('div');
    card.style.cssText = 'display:flex;align-items:center;gap:9px;min-width:170px;padding:7px 10px 7px 8px;' +
        'background:linear-gradient(90deg,rgba(10,14,20,0.92),rgba(10,14,20,0.7));' +
        'border-left:3px solid ' + color + ';border-radius:4px;' +
        'box-shadow:0 4px 18px rgba(0,0,0,0.45);opacity:0;transform:translateX(18px);' +
        'transition:opacity .22s ease,transform .22s ease;';
    card.innerHTML = '<div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;font-size:20px;">' + itemIcon(def) + '</div>' +
        '<div style="line-height:1.25;"><div style="font-size:12px;color:#e6edf3;font-weight:600;">' + (def.name || '') + '</div>' +
        '<div style="font-size:11px;color:' + color + ';">+₵' + (value || 0).toLocaleString() + '</div></div>';
    layer.appendChild(card);
    requestAnimationFrame(function () { card.style.opacity = '1'; card.style.transform = 'translateX(0)'; });
    setTimeout(function () {
        card.style.opacity = '0';
        card.style.transform = 'translateX(18px)';
        setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, 260);
    }, 1900);
}

function checkNearbyGroundLoot() {
    let nearest = null, nd = 1.8 * 1.8;
    for (const gl of groundLootItems) {
        if (gl.taken) continue;
        const dx = playerGroup.position.x - gl.x, dz = playerGroup.position.z - gl.z;
        const d = dx * dx + dz * dz;
        if (d < nd) { nd = d; nearest = gl; }
    }
    const prompt = document.getElementById('groundLootPrompt');
    if (!prompt) return null;
    if (nearest && S.phase === 'playing') {
        prompt.style.display = 'block';
        prompt.querySelector('.prompt-title').innerHTML = nearest.icon + ' ' + nearest.name;
        prompt.querySelector('.prompt-hint').textContent = '按 F 拾取 [' + (RARITY[nearest.rarity]?.name || '普通') + ']';
        prompt.style.borderColor = RARITY[nearest.rarity]?.color || '#fff';
    } else {
        prompt.style.display = 'none';
    }
    return nearest;
}

function pickupGroundLoot(gl) {
    if (gl.taken) return;
    const def = ITEMS[gl.itemId];
    if (!def) return;

    // Auto-place: keycards go to keychain first
    if (def.type === 'keycard') {
        for (var ki = 0; ki < 4; ki++) {
            if (!S.keychain[ki]) {
                S.keychain[ki] = gl.itemId;
                S.keyUses[ki] = 10;
                playLootPickupFX(gl);
                S.lootValue += def.value;
                S._lootItems = S._lootItems || [];
                S._lootItems.push({ id: gl.itemId, name: def.name, value: def.value, rarity: def.rarity });
                sfxPickup(def.rarity);
                showLootToast(def, def.value, def.rarity);
                updateHUD(); updateWeaponUI();
                if (S.phase === 'backpack') renderBackpackInventory();
                return;
            }
        }
        // Keychain full — fall through to backpack
    }

    // Try backpack first, then secure container
    let slot = S.backpackCols > 0 ? findFreeSlot(S.backpack, S.backpackCols, S.backpackRows, gl.itemId) : null;
    let tg = S.backpack, tc = S.backpackCols, tr = S.backpackRows;
    if (!slot) {
        slot = findFreeSlot(S.secureContainer, S.secureCols, S.secureRows, gl.itemId);
        tg = S.secureContainer; tc = S.secureCols; tr = S.secureRows;
    }
    if (!slot) { alert('背包和安全箱已满！'); return; }
    placeInGrid(tg, tc, gl.itemId, slot.col, slot.row);
    gl.taken = true;
    playLootPickupFX(gl);
    S.lootValue += def.value;
    S._lootItems = S._lootItems || [];
    S._lootItems.push({ id: gl.itemId, name: def.name, value: def.value, rarity: def.rarity });
    sfxPickup(def.rarity);
    showLootToast(def, def.value, def.rarity);
    // Flag red collectible for inspection on next UI close
    if(isRedCollectible(gl.itemId)) S._pendingRedGroundPickup=true;
    if (autoEquipLoot(gl.itemId)) {
        // Remove from grid if auto-equipped
        if (tg._items && tg._items.length > 0) {
            const last = tg._items[tg._items.length - 1];
            if (last.id === gl.itemId) removeFromGrid(tg, last);
        }
    }
    updateHUD();
    updateSearchValue();
}

// ====== User System ======
let currentUser = null;
function getSaveKey() { return currentUser ? 'tactical_assault_' + currentUser : null; }

function loginUser() {
    const name = document.getElementById('loginUsername').value.trim();
    if (!name) { document.getElementById('loginMsg').textContent = '请输入用户名'; return; }
    if (name.length < 1 || name.length > 20) { document.getElementById('loginMsg').textContent = '用户名1-20个字符'; return; }
    currentUser = name;
    // Load or create save
    const key = getSaveKey();
    const raw = localStorage.getItem(key);
    if (raw) {
        try {
            const loaded = JSON.parse(raw);
            P.money = loaded.money != null ? loaded.money : 1000000;
            const grid = initGrid(CONFIG.STASH_ROWS);
            const items = loaded.stashItems || [];
            items.forEach(entry => { if (ITEMS[entry.id]) {
                placeInGrid(grid, CONFIG.STASH_COLS, entry.id, entry.col, entry.row);
                // Preserve keycard uses
                if (entry._keyUses !== undefined) {
                    var ne = grid._items[grid._items.length - 1];
                    if (ne) ne._keyUses = entry._keyUses;
                }
            }});
            P.stashGrid = grid;
            P.mailItems = loaded.mailItems || [];
            P.stats = loaded.stats || { kills: 0, extracts: 0, totalValue: 0, games: 0 };
            P.missions = loaded.missions;
            P.xp = loaded.xp || 0;
            P.keychain = loaded.keychain || [null, null, null, null];
            P.keyUses = loaded.keyUses || [0, 0, 0, 0];
            P.weightLevel = loaded.weightLevel || 1;
            P.stashLevel = loaded.stashLevel || 1;
            P.upgradeProgress = loaded.upgradeProgress || {};
            P.weaponDurability = loaded.weaponDurability || {};
            P.loadouts = loaded.loadouts || [];
            P.achievements = loaded.achievements || {};
            P.skillPoints = loaded.skillPoints || 0;
            P.skills = loaded.skills || {};
            // Resize stash grid if stash level > 1
            if (P.stashLevel > 1) {
                var dims = getStashDims();
                var newGrid = initGrid(dims.rows);
                if (P.stashGrid._items) {
                    P.stashGrid._items.forEach(function(entry) {
                        if (entry.col < dims.cols && entry.row < dims.rows) {
                            placeInGrid(newGrid, dims.cols, entry.id, entry.col, entry.row);
                            var ne = newGrid._items[newGrid._items.length - 1];
                            if (ne && entry._keyUses !== undefined) ne._keyUses = entry._keyUses;
                        } else {
                            // Item out of bounds (e.g. old save with wider grid) — re-place in first free slot
                            var slot = findFreeSlot(newGrid, dims.cols, dims.rows, entry.id);
                            if (slot) {
                                placeInGrid(newGrid, dims.cols, entry.id, slot.col, slot.row);
                                var ne2 = newGrid._items[newGrid._items.length - 1];
                                if (ne2 && entry._keyUses !== undefined) ne2._keyUses = entry._keyUses;
                            }
                        }
                    });
                }
                P.stashGrid = newGrid;
            }
        } catch(e) { /* use defaults */ }
    }
    initOrRefreshMissions();
    initAchievements();
    initSkillTree();
    enterLobby(name);
}

function registerUser() {
    const name = document.getElementById('loginUsername').value.trim();
    if (!name) { document.getElementById('loginMsg').textContent = '请输入用户名'; return; }
    if (localStorage.getItem('tactical_assault_' + name)) { document.getElementById('loginMsg').textContent = '用户名已存在，请直接进入游戏'; return; }
    currentUser = name;
    // Create fresh save
    const dp = defaultPersistent();
    P.money = dp.money; P.stashGrid = dp.stashGrid; P.mailItems = []; P.stats = dp.stats;
    P.keychain = dp.keychain; P.keyUses = dp.keyUses;
    P.weightLevel = 1; P.stashLevel = 1; P.upgradeProgress = {}; P.weaponDurability = {}; P.loadouts = [];
    savePersistent();
    enterLobby(name);
}

function enterLobby(name) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('lobbyScreen').style.display = 'flex';
    document.getElementById('displayUsername').textContent = name;
    document.getElementById('loginMsg').textContent = '';
    updateAllLobbyUI();
    // Render initial inventory view
    setTimeout(() => { switchLobbyTab('action'); }, 100);
}

function logoutUser() {
    if (confirm('确定退出登录？存档已保存。')) {
        savePersistent();
        currentUser = null;
        document.getElementById('lobbyScreen').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginMsg').textContent = '';
    }
}

const SAVE_KEY = 'tactical_assault_save_v3'; // Legacy key, will be cleared

function defaultPersistent() {
    const g = initGrid(CONFIG.STASH_ROWS);
    // Default stash: some cash and basic gear, no free weapons
    placeInGrid(g, CONFIG.STASH_COLS, 'pistol_item', 0, 0);
    placeInGrid(g, CONFIG.STASH_COLS, 'bandage', 6, 0);
    placeInGrid(g, CONFIG.STASH_COLS, 'bandage', 7, 0);
    placeInGrid(g, CONFIG.STASH_COLS, 'painkiller', 8, 0);
    return {
        // 起始资金 ≈ T1 配装成本（₵206,200）。取 20 万是为了让首局就「差一点买不起 T2」，
        // 而不是一上来就能直接进中档。原来给 100 万，等于把前 10 局的装备成长整个跳过了。
        money: 200000,
        stashGrid: g,
        mailItems: [], // Unlimited overflow storage
        stats: { kills: 0, extracts: 0, totalValue: 0, games: 0 },
        missions: { daily: [], weekly: [], faction: [] },
        xp: 0,
        keychain: [null, null, null, null],
        keyUses: [0, 0, 0, 0],
        weightLevel: 1,  // Weight capacity level (1-7)
        stashLevel: 1,   // Stash grid size level (1-7)
        upgradeProgress: {}, // Track material submission progress for upgrades
        weaponDurability: {}, // Weapon durability tracking (weapon key -> 0-100)
        loadouts: [], // Saved loadout presets
        _version: 6,
    };
}

function savePersistent() {
    const key = getSaveKey(); if (!key) return;
    try {
        const s = {
            money: P.money,
            stashItems: P.stashGrid._items || [],
            mailItems: P.mailItems || [],
            stats: P.stats,
            missions: P.missions,
            xp: P.xp || 0,
            keychain: P.keychain || [null, null, null, null],
            keyUses: P.keyUses || [0, 0, 0, 0],
            weightLevel: P.weightLevel || 1,
            stashLevel: P.stashLevel || 1,
            upgradeProgress: P.upgradeProgress || {},
            weaponDurability: P.weaponDurability || {},
            loadouts: P.loadouts || [],
            achievements: P.achievements || {},
            skillPoints: P.skillPoints || 0,
            skills: P.skills || {},
            _version: 6,
        };
        localStorage.setItem(key, JSON.stringify(s));
    } catch(e) { console.warn('Save failed'); }
}

// P starts with defaults; loaded after login
let P = defaultPersistent();

// Clear legacy global save
(function clearLegacy() {
    try {
        const legacy = localStorage.getItem('tactical_assault_save_v3');
        if (legacy) {
            localStorage.removeItem('tactical_assault_save_v3');
            localStorage.removeItem('tactical_assault_save_v2');
        }
    } catch(e) { reportInitError('migrateLegacySave:localStorage', e); }
})();

// ========== SECTION 5: SESSION STATE ==========
const S = {
    mode: 'normal',
    phase: 'lobby',

    health: 100, maxHealth: 100,
    armor: 0, maxArmor: 100,
    helmet: 0, maxHelmet: 50,

    // 4 weapon slots: primary1, primary2, secondary, knife
    weaponSlots: [null, null, null, 'knife'],
    magAmmo: [0, 0, 0, 0],
    reserveAmmo: { pistol: 0, rifle: 0, shotgun: 0, smg: 0, sniper: 0, heavy: 0 },
    currentWeapon: 3, // Start with knife
    isReloading: false,
    lastShot: 0,

    // Equipment
    equipment: { armor: null, armorHP: 0, helmet: null, helmetHP: 0, chestRig: null, backpack: null },

    // Pockets (base 5 + chest rig bonus)
    pockets: [], // ['medkit', 'bandage', ...]
    maxPockets: 5,

    // Keychain (4 slots, keycards only, 10 uses each)
    keychain: [null, null, null, null],
    keyUses: [0, 0, 0, 0],

    // Secure container 3×3 (items survive death)
    secureContainer: initGrid(3),
    secureCols: 3,
    secureRows: 3,

    backpack: initGrid(1), // Default 0×0 if no backpack
    backpackCols: 0,
    backpackRows: 0,

    lootValue: 0,
    containersSearched: 0,
    kills: 0,

    isExtracting: false,
    extractProgress: 0,

    startTime: 0,
    gameTime: 900,
    currentSearchContainer: null,

    broughtItems: [],
    _velocityY: 0,
};

// ========== SECTION 6: THREE.JS SETUP ==========
let scene, camera, renderer, clock, playerRaycaster, enemyRaycaster;
let playerGroup, weaponGroup;
let enemies = [], enemyHitboxes = [];
let bosses = []; // Boss enemies with special loot
let bossTaskPoints = []; // Task pickup points for boss missions
let airDrops = []; // Airdrop supply events
let airdropTimer = 0; // Countdown to next airdrop
let particles = [];
let containers = [];
// 容器统一挂在这个分组下，而不是直接挂 scene。
// 目的只有一个：能让它们被 WorldPolish.batchStatic 当成一个独立批次处理，
// 而不与地图环境混在一起（环境已经是合批过的，再合一次没有收益，反而多一轮遍历）。
let containerGroup = null;
// 容器的地表价值光圈（透明）不参与合批，单独攒成 InstancedMesh。
// 结构：{ key: 'color|opacity', color, opacity, items: [{x,z}] }
let _containerGlow = [];

/**
 * 容器材质缓存。
 *
 * 为什么必须做：原实现里每个子网格都 new 一个 MeshStandardMaterial，
 * 170 个容器 × 5.36 个子网格 = 912 个材质实例、912 次 draw call，
 * 占整帧 1077 次 draw call 的 85%。合批的前提是「材质可共用」，
 * 材质不共用时 batchStatic 一组都凑不出来。
 *
 * 缓存键必须包含所有会进 shader 的参数。漏一个（比如当初漏了 envMapIntensity）
 * 的后果是两种本该不同的材质被当成同一种共用 —— 这个错误不会报错，只会悄悄画错。
 */
const _containerMatCache = {};
function _cMat(color, opt) {
    opt = opt || {};
    const rough = opt.roughness == null ? 0.7 : opt.roughness;
    const metal = opt.metalness || 0;
    const emis = opt.emissive || 0;
    const emisI = opt.emissiveIntensity || 0;
    const envI = opt.envMapIntensity == null ? 0.18 : opt.envMapIntensity;
    const key = 'S|' + color + '|' + rough + '|' + metal + '|' + emis + '|' + emisI + '|' + envI;
    let m = _containerMatCache[key];
    if (m) return m;
    m = new THREE.MeshStandardMaterial({
        color: color, roughness: rough, metalness: metal,
        emissive: emis, emissiveIntensity: emisI, envMapIntensity: envI,
    });
    _containerMatCache[key] = m;
    return m;
}
function _cBasic(color, opt) {
    opt = opt || {};
    const key = 'B|' + color + '|' + (opt.opacity == null ? 1 : opt.opacity) + '|' + (opt.side || 0);
    let m = _containerMatCache[key];
    if (m) return m;
    m = new THREE.MeshBasicMaterial({ color: color, opacity: opt.opacity == null ? 1 : opt.opacity });
    if (opt.opacity != null) m.transparent = true;
    if (opt.side) m.side = opt.side;
    _containerMatCache[key] = m;
    return m;
}
let obstacles = [];
let extractPoints = [];
let bulletTrails = [];
let mapEnvironmentGroup = null;

// Key-locked buildings state
let keyBuildingsState = [];
let nearbyKeyBuilding = null;

const keys = {};
let mouseX = 0, mouseY = 0;
let isMouseDown = false;
let accumulator = 0, lastTime = 0;

// 按键绑定辅助函数：获取设置中绑定的按键代码
function getBoundKey(action) {
    try {
        if (typeof GameSettings !== 'undefined' && typeof GameSettings.getSettings === 'function') {
            const settings = GameSettings.getSettings();
            if (settings.keyBindings && settings.keyBindings[action]) {
                return settings.keyBindings[action];
            }
        }
    } catch(e) { reportInitError('getBoundKey:GameSettings', e); }
    // 默认按键
    const defaults = {
        forward: 'KeyW', backward: 'KeyS', left: 'KeyA', right: 'KeyD',
        jump: 'Space', sprint: 'ShiftLeft', crouch: 'ControlLeft',
        reload: 'KeyR', interact: 'KeyF', backpack: 'KeyB', map: 'KeyM',
        inspect: 'KeyV', useMedkit: 'Digit5', useBandage: 'Digit6', usePainkiller: 'Digit7',
    };
    return defaults[action] || null;
}

// 检查某个动作的按键是否被按下
function isActionPressed(action) {
    const key = getBoundKey(action);
    if (!key) return false;
    // 处理特殊按键（如ShiftLeft/ShiftRight, ControlLeft/ControlRight）
    if (action === 'sprint') return keys['ShiftLeft'] || keys['ShiftRight'];
    if (action === 'crouch') return keys['ControlLeft'] || keys['ControlRight'];
    return !!keys[key];
}

let enemyModels = {};
let enemyAnimations = {};
const ENEMY_MODEL_FILES = {
    Soldier: 'models/Soldier.glb',
    Xbot: 'models/Xbot.glb',
    RobotExpressive: 'models/RobotExpressive.glb',
};
const _modelFailures = [];

/** base64 → ArrayBuffer。给 loader.parse 用，避免 data URI 的二次 URL 解析。 */
function _b64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const n = bin.length;
    const bytes = new Uint8Array(n);
    for (let i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
}

/**
 * 仅在 file:// 下动态注入 models_embedded.js。
 *
 * 为什么用动态 <script> 而不是在 index.html 里静态引入：
 * 该文件有 7MB，http 部署时完全不需要它 —— 静态引入会让每个在线玩家白下载 7MB。
 * 动态注入同时验证了一件事：脚本标签在 file:// 下是放行的（受限制的只有 XHR/fetch），
 * 这也是本方案能成立的前提。
 */
function _loadEmbeddedModels(cb) {
    if (window.EMBEDDED_MODELS) { cb(window.EMBEDDED_MODELS); return; }
    const s = document.createElement('script');
    s.id = 'modelsEmbeddedScript';
    s.src = 'models_embedded.js';
    s.onload = function () {
        cb(window.EMBEDDED_MODELS || null);
    };
    s.onerror = function () {
        reportInitError('loadEnemyModels:embedded', new Error('models_embedded.js 注入失败（文件是否随包分发？）'));
        cb(null);
    };
    document.head.appendChild(s);
}

/**
 * 模型全部失败时给一条玩家能看懂的提示。
 *
 * 之前这条路径是完全静默的：file:// 下三个模型全部 CORS 失败，敌人变成圆柱，
 * 玩家只会觉得「这游戏做得很糙」，而不会想到是协议限制。
 * 提示必须可关闭 —— 它只是解释，不是阻断。
 */
function _showModelFallbackNotice() {
    if (document.getElementById('modelFallbackNotice')) return;
    const d = document.createElement('div');
    d.id = 'modelFallbackNotice';
    d.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:9999;' +
        'max-width:min(620px,92vw);padding:10px 34px 10px 14px;border-radius:8px;' +
        'background:rgba(28,28,32,.94);color:#e8e8ea;font:13px/1.55 system-ui,-apple-system,"Microsoft YaHei",sans-serif;' +
        'box-shadow:0 6px 22px rgba(0,0,0,.45);border:1px solid rgba(255,180,80,.5);';
    d.innerHTML = '<b style="color:#ffb450">敌人模型未加载，当前为占位体</b><br>' +
        '直接双击打开时浏览器会拦截本地模型读取。' +
        '把游戏放到本地服务器（或从项目根运行一个静态服务）后即可正常显示。' +
        '玩法不受影响。';
    const x = document.createElement('button');
    x.textContent = '×';
    x.style.cssText = 'position:absolute;right:6px;top:4px;background:none;border:0;color:#aaa;font-size:18px;cursor:pointer;line-height:1;padding:4px 6px;';
    x.onclick = function () { d.remove(); };
    d.appendChild(x);
    document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.remove(); }, 12000);
}

function loadEnemyModels() {
    const loader = new THREE.GLTFLoader();
    const want = Object.keys(ENEMY_MODEL_FILES);

    function onLoaded(name, gltf) {
        // GLB 自带的材质同样是 envMapIntensity 默认 1.0，在 IBL 开启时会把士兵
        // 打成过曝的橙色塑料。这里在「加载完成」而不是「每个实例」处统一压一次：
        // SkeletonUtils.clone 是共享材质的，改一次对所有克隆体生效，也不会随敌人数增长而重复遍历。
        gltf.scene.traverse(function (o) {
            if (!o.isMesh || !o.material) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) {
                if (m && m.envMapIntensity !== undefined) m.envMapIntensity = 0.12;
            }
        });
        enemyModels[name] = gltf.scene;
        enemyAnimations[name] = gltf.animations;
        if (typeof enemies !== 'undefined') {
            for (const _e of enemies) {
                if (_e.mesh && _e.mesh.userData.placeholder) attachEnemyModel(_e.mesh, _e.enemyLevel);
            }
        }
    }

    function onFailed(name, err) {
        // 这里必须留痕。历史上三条 onError 是缺省的，
        // 结果 CORS 拦截在 __initErrors 里一条都不剩，排查时只能靠肉眼看控制台。
        reportInitError('loadEnemyModels:' + name, err || new Error('未知加载失败'));
        if (_modelFailures.indexOf(name) < 0) _modelFailures.push(name);
        if (_modelFailures.length >= want.length) _showModelFallbackNotice();
    }

    if (location.protocol === 'file:') {
        _loadEmbeddedModels(function (emb) {
            if (!emb) {
                want.forEach(function (n) { onFailed(n, new Error('内嵌模型不可用')); });
                return;
            }
            want.forEach(function (name) {
                const b64 = emb[name];
                if (!b64) { onFailed(name, new Error('内嵌模型缺少 ' + name)); return; }
                try {
                    // 第二个参数是资源根路径，GLB 自带贴图，留空即可
                    loader.parse(_b64ToArrayBuffer(b64), '', function (gltf) {
                        onLoaded(name, gltf);
                    }, function (err) {
                        onFailed(name, err);
                    });
                } catch (e) {
                    onFailed(name, e);
                }
            });
        });
        return;
    }

    for (const name of want) {
        loader.load(ENEMY_MODEL_FILES[name], function (gltf) {
            onLoaded(name, gltf);
        }, undefined, function (err) {
            onFailed(name, err);
        });
    }
}

function _findClip(anims, keys) {
    for (const k of keys) {
        const c = anims.find(a => a.name.toLowerCase().indexOf(k) >= 0);
        if (c) return c;
    }
    return null;
}


var _tmpGunVec = new THREE.Vector3();

function createEnemyGun() {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({color:0x1a1a1a, metalness:0.85, roughness:0.3});
    const wood = new THREE.MeshStandardMaterial({color:0x4a2a15, roughness:0.8});
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.055,0.09,0.32), dark);
    body.position.set(0,0,0.1); g.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,0.22,6), dark);
    barrel.rotation.x = Math.PI/2; barrel.position.set(0,0.01,0.34); g.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035,0.14,0.055), dark);
    mag.position.set(0,-0.1,0.08); g.add(mag);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035,0.09,0.045), wood);
    grip.position.set(0,-0.075,-0.04); grip.rotation.x = 0.3; g.add(grip);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.07,0.14), wood);
    stock.position.set(0,-0.01,-0.15); g.add(stock);
    return g;
}

function setupEnemyModel(grp, modelName) {
    if (!enemyModels[modelName]) return false;
    const model = THREE.SkeletonUtils.clone(enemyModels[modelName]);
    model.scale.set(0.9, 0.9, 0.9);
    model.rotation.y = Math.PI;
    grp.add(model);
    let _hand = null;
    model.traverse(function (_o) {
        if (_hand) return;
        const _n = (_o.name || '').toLowerCase();
        if (_n.indexOf('righthand') >= 0 || _n.indexOf('hand.r') >= 0 || _n === 'handr') _hand = _o;
    });
    if (_hand) {
        const _gun = createEnemyGun();
        grp.add(_gun);
        grp.userData.gun = _gun;
        grp.userData.handBone = _hand;
        // 以前这里有一行 showFloatingMsg('已挂枪 @ ' + _hand.name)。
        // 那是调骨位时的临时输出，但每生成一个敌人就会在屏幕中央弹一次，
        // 一局里能弹几十条。骨位查找失败是静默的 false，删掉这行不影响诊断。
        // 需要确认挂枪是否成功时，看 grp.userData.gun 是否存在即可。
    }
    const mixer = new THREE.AnimationMixer(model);
    const anims = enemyAnimations[modelName] || [];
    const map = {};
    const idleC = _findClip(anims, ['idle']);
    const walkC = _findClip(anims, ['walk']);
    const runC  = _findClip(anims, ['run']);
    if (idleC) map.idle = mixer.clipAction(idleC);
    if (walkC) map.walk = mixer.clipAction(walkC);
    if (runC)  map.run  = mixer.clipAction(runC);
    if (!map.idle && !map.walk && !map.run && anims.length) map.idle = mixer.clipAction(anims[0]);
    if (map.idle) map.idle.play();
    grp.userData.mixer = mixer;
    grp.userData.actions = map;
    grp.userData.currentAnim = 'idle';
    grp.userData.placeholder = false;
    return true;
}

function setEnemyAnim(grp, name) {
    const acts = grp.userData.actions;
    if (!acts || !acts[name] || grp.userData.currentAnim === name) return;
    const prev = acts[grp.userData.currentAnim];
    const next = acts[name];
    next.reset().fadeIn(0.15).play();
    if (prev) prev.fadeOut(0.15);
    grp.userData.currentAnim = name;
}

function attachEnemyModel(grp, elv) {
    const modelName = elv >= 3 ? 'RobotExpressive' : (elv === 2 ? 'Xbot' : 'Soldier');
    if (!grp.userData.placeholder) return;
    if (!enemyModels[modelName]) return;
    const ph = grp.getObjectByName('ph_placeholder');
    if (ph) grp.remove(ph);
    setupEnemyModel(grp, modelName);
}

function init() {
    // 致命依赖断言（S-11 方案 B / S-16）：缺 Three.js 或 AI 模块时直接显示全屏错误层，
    // 不进入任何降级路径。历史上缺 AI 会静默切到一条每帧 raycast 的降级分支，
    // 结果是「能跑，但 3 FPS」，比明确报错糟糕得多。
    if (!assertCriticalModules()) return;

    loadEnemyModels();
    // 更新加载进度
    if (typeof ResourceLoader !== 'undefined') ResourceLoader.showLoadingScreen();
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0xa8d8e8, 40, 130);

    camera = new THREE.PerspectiveCamera(78, window.innerWidth/window.innerHeight, 0.1, 300);
    camera.position.set(0, 1.7, 0);

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;

    clock = new THREE.Clock();
    playerRaycaster = new THREE.Raycaster();
    playerRaycaster.far = 250;
    enemyRaycaster = new THREE.Raycaster();
    enemyRaycaster.far = 250;

    playerGroup = new THREE.Group();
    playerGroup.add(camera);
    scene.add(playerGroup);

    weaponGroup = new THREE.Group();
    camera.add(weaponGroup);

    // 初始化武器开镜系统
    if (typeof WeaponADS !== 'undefined') {
        WeaponADS.init(camera, weaponGroup);
    }

    setupLights();
    
    // 更新加载进度：构建地图环境（最耗时）
    if (typeof ResourceLoader !== 'undefined') {
        const fill = document.getElementById('loadingProgressFill');
        const percentEl = document.getElementById('loadingPercent');
        const statusEl = document.getElementById('loadingStatus');
        if (fill) fill.style.width = '55%';
        if (percentEl) percentEl.textContent = '55%';
        if (statusEl) statusEl.textContent = '构建地图环境...';
    }
    
    // 将地图构建推迟到下一帧，避免UI阻塞
    // 同时启动动画循环，确保加载界面可以响应
    lastTime = performance.now();
    animate(lastTime);
    
    setTimeout(() => {
        try {
            rebuildMapEnvironment();
        } catch(e) {
            console.warn('Map environment build failed:', e);
        }
        
        // 更新加载进度：地图环境构建完成
        if (typeof ResourceLoader !== 'undefined') {
            const fill = document.getElementById('loadingProgressFill');
            const percentEl = document.getElementById('loadingPercent');
            const statusEl = document.getElementById('loadingStatus');
            if (fill) fill.style.width = '70%';
            if (percentEl) percentEl.textContent = '70%';
            if (statusEl) statusEl.textContent = '初始化游戏系统...';
        }
        
        setupEvents();
        // 应用游戏设置
        if (typeof GameSettings !== 'undefined') {
            GameSettings.applySettings();
        }
        // 美术增强初始化（后期处理/渐变天空/动态水面）
        if (typeof GraphicsEnhancement !== 'undefined') {
            GraphicsEnhancement.init(renderer, scene, camera);
        }
        // 渲染管线：天空穹顶 / 环境反射 / ACES 后期 / 自适应分辨率
        if (typeof RenderPipeline !== 'undefined') {
            RenderPipeline.init(renderer, scene, camera);
        }
        // ---- 首局静态合批（补跑）----
        // rebuildMapEnvironment() 在本函数的前半段已经跑过一次，但那时
        // GraphicsEnhancement.init() 还没执行，GraphicsEnhancement.isEnabled() === false，
        // 于是 batchStatic 被 game.js:rebuildMapEnvironment 里的守卫跳过。
        // 后果：玩家第一次进图之前，场景以约 11,000 个未合批网格在渲染，
        // draw call 约 3,500（合批后约 1,050），也就是「新玩家第一眼看到的是最差的一帧」。
        // 这里补跑一次即可，成本远低于重建整张地图。
        // 注意：只补 batchStatic + 雾距刷新，**不要重跑 WorldPolish.apply** ——
        // 接地阴影的足迹采集依赖 ConeGeometry 类型，而合批后的树冠已变成普通 BufferGeometry，
        // 重跑会丢树影。第一批 apply 建的 InstancedMesh 不受合批影响（batchStatic 跳过 InstancedMesh）。
        try {
            if (typeof WorldPolish !== 'undefined' && mapEnvironmentGroup &&
                typeof GraphicsEnhancement !== 'undefined' && GraphicsEnhancement.isEnabled()) {
                WorldPolish.batchStatic(mapEnvironmentGroup);
                if (typeof RenderPipeline !== 'undefined' && RenderPipeline.refreshFog) {
                    RenderPipeline.refreshFog();
                }
            }
        } catch (e) {
            reportInitError('init:firstRaidBatching', e);
        }
        // 武器世界特效：枪口火焰 / 抛壳 / 弹孔贴花 / 火花
        if (typeof WeaponFX !== 'undefined') {
            WeaponFX.init(scene, camera);
        }
        // 自适应性能守卫：识别软件渲染/低帧率并逐级降级
        if (typeof PerformanceGuard !== 'undefined') {
            PerformanceGuard.init(renderer, scene);
        }
        // HUD 反馈层：罗盘目标标记、伤害弧形
        if (typeof HudFeedback !== 'undefined') {
            HudFeedback.init();
        }
        // 初始化BOSS系统V2
        if (typeof BossSystemV2 !== 'undefined') {
            BossSystemV2.init();
        }
        // 初始化BOSS扩展模块
        if (typeof BossExtensions !== 'undefined') {
            BossExtensions.init();
        }
        
        // 更新加载进度：初始化完成
        if (typeof ResourceLoader !== 'undefined') {
            const fill = document.getElementById('loadingProgressFill');
            const percentEl = document.getElementById('loadingPercent');
            const statusEl = document.getElementById('loadingStatus');
            if (fill) fill.style.width = '95%';
            if (percentEl) percentEl.textContent = '95%';
            if (statusEl) statusEl.textContent = '最终准备...';
        }
        
        // Hide lobby until login
        document.getElementById('lobbyScreen').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        
        // 隐藏加载界面
        setTimeout(() => {
            if (typeof ResourceLoader !== 'undefined') {
                ResourceLoader.hideLoadingScreen();
            }
        }, 300);
    }, 100);
}

function setupLights() {
    scene.add(new THREE.AmbientLight(0x8899aa, 0.5));
    const sun = new THREE.DirectionalLight(0xffeedd, 0.7);
    sun.position.set(60, 100, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -100; sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100; sun.shadow.camera.bottom = -100;
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 250;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x8899cc, 0x443322, 0.3));
}

// ========== SECTION 7: MAP ==========
function clearMapEnvironment() {
    if (mapEnvironmentGroup) {
        scene.remove(mapEnvironmentGroup);
        mapEnvironmentGroup.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        });
        mapEnvironmentGroup = null;
    }
    obstacles = [];
}

function rebuildMapEnvironment() {
    clearMapEnvironment();
    createEnvironment();
    // 关卡道具增强：集装箱堆场 / 路障 / 沙袋 / 路灯 / 铁丝网 / 路面标线
    if (typeof WorldProps !== 'undefined' && mapEnvironmentGroup) {
        try {
            WorldProps.apply(mapEnvironmentGroup, obstacles);
        } catch (e) {
            // 这里曾经只写 console.warn —— 历史上正因如此，「所有道具一件都没生成」
            // 才长期没被发现（异常被吞、地图只是显得空旷、无任何界面提示）。
            // 现在统一走诊断通道：控制台有 warn，window.__initErrors 里有一条可查询记录。
            reportInitError('rebuildMapEnvironment:WorldProps', e);
        }
    }
    // 美术增强：升级地图材质
    if (typeof GraphicsEnhancement !== 'undefined') {
        GraphicsEnhancement.upgradeEnvironmentMaterials();
    }
    // 场景接地阴影：单次实例化绘制，不参与碰撞
    if (typeof WorldPolish !== 'undefined' && mapEnvironmentGroup) {
        // 材质升级后再合批，保证同材质签名一致；首次启动（美术模块未就绪）不执行
        if (typeof GraphicsEnhancement !== 'undefined' && GraphicsEnhancement.isEnabled()) {
            WorldPolish.batchStatic(mapEnvironmentGroup);
        }
        WorldPolish.apply(mapEnvironmentGroup, obstacles);
    }
    // 通知渲染管线按新地图主题重建天空/雾/光照/环境反射
    if (typeof RenderPipeline !== 'undefined') {
        RenderPipeline.setTheme((MAP_DATA && MAP_DATA.theme) || {});
    }
    // 小地图底图按地图重建
    if (typeof PerfManager !== 'undefined') {
        PerfManager.resetMinimapLayer();
    }
}

function applyMapTheme() {
    const theme = (MAP_DATA && MAP_DATA.theme) || {};
    const skyColor = theme.skyColor ?? 0x1a1a2e;
    const fogColor = theme.fogColor ?? skyColor;
    // 美术增强启用时使用渐变天空纹理，不被主题纯色覆盖；渲染管线启用时由天空穹顶负责背景
    const useEnhancedSky = typeof GraphicsEnhancement !== 'undefined' && GraphicsEnhancement.isEnabled();
    const usePipelineSky = typeof RenderPipeline !== 'undefined' && RenderPipeline.isEnabled();
    if (!useEnhancedSky && !usePipelineSky) {
        scene.background = new THREE.Color(skyColor);
    }
    if (scene.fog) {
        scene.fog.color.setHex(fogColor);
        scene.fog.near = theme.fogNear ?? 30;
        scene.fog.far = theme.fogFar ?? 90;
    }
}

function isPointBlockedByMap(x, z, margin) {
    margin = margin || 0;
    for (const w of ((MAP_DATA && MAP_DATA.waterAreas) || [])) {
        const hw = w.w / 2 + margin, hd = w.d / 2 + margin;
        if (x > w.x - hw && x < w.x + hw && z > w.z - hd && z < w.z + hd) return true;
    }
    return false;
}

function createEnvironment() {
    mapEnvironmentGroup = new THREE.Group();
    const env = mapEnvironmentGroup;
    const theme = (MAP_DATA && MAP_DATA.theme) || {};
    applyMapTheme();

    const groundColor = theme.groundColor ?? 0x3d4f3f;
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(CONFIG.mapSize, CONFIG.mapSize),
        new THREE.MeshStandardMaterial({ color: groundColor, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData.surface = 'ground';
    env.add(ground);

    for (const zone of MAP_ZONES) {
        const radius = zone.radius || 14;
        const patch = new THREE.Mesh(
            new THREE.CircleGeometry(radius, 32),
            new THREE.MeshStandardMaterial({ color: zone.color, roughness: 0.85, transparent: true, opacity: 0.22 })
        );
        patch.rotation.x = -Math.PI / 2;
        patch.position.set(zone.x, 0.015, zone.z);
        patch.receiveShadow = true;
        patch.userData.surface = 'zonePatch';
        env.add(patch);
    }

    const roadMat = new THREE.MeshStandardMaterial({ color: theme.roadColor ?? 0x3a3a32, roughness: 0.92 });
    for (const road of ((MAP_DATA && MAP_DATA.roads) || [])) {
        const rd = new THREE.Mesh(new THREE.BoxGeometry(road.w, 0.04, road.d), roadMat);
        rd.position.set(road.x, 0.02, road.z);
        rd.receiveShadow = true;
        rd.userData.surface = 'road';
        env.add(rd);
    }

    for (const w of ((MAP_DATA && MAP_DATA.waterAreas) || [])) {
        // 岸边泥地：柔化水面与草地之间的硬边
        const bank = new THREE.Mesh(
            new THREE.PlaneGeometry(w.w + 2.8, w.d + 2.8),
            new THREE.MeshStandardMaterial({ color: 0x6f6048, roughness: 0.96 })
        );
        bank.rotation.x = -Math.PI / 2;
        bank.position.set(w.x, 0.012, w.z);
        bank.receiveShadow = true;
        bank.userData.surface = 'bank';
        env.add(bank);

        const water = new THREE.Mesh(
            new THREE.PlaneGeometry(w.w, w.d),
            new THREE.MeshStandardMaterial({
                color: theme.waterColor ?? 0x1a4a6a,
                roughness: 0.15,
                metalness: 0.35,
                transparent: true,
                opacity: 0.82
            })
        );
        water.rotation.x = -Math.PI / 2;
        water.position.set(w.x, 0.025, w.z);
        water.userData.surface = 'water';
        env.add(water);
        obstacles.push({ mesh: water, isAABB: true, halfW: w.w / 2, halfD: w.d / 2, isWater: true });
    }

    // 树冠/树干同样要压 envMapIntensity：默认 1.0 会让叶子吃满 IBL 变成薄荷绿塑料片，
    // 在实际画面里比天空还亮。0.12 与地面 0.18 同一量级，靠漫反射+阴影保留体积感。
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9, envMapIntensity: 0.12 });
    const leafMat = new THREE.MeshStandardMaterial({ color: theme.treeColor ?? 0x2a5a2a, roughness: 0.85, envMapIntensity: 0.12 });
    for (const t of ((MAP_DATA && MAP_DATA.trees) || [])) {
        const tree = new THREE.Group();
        const h = t.h || (2.2 + (Math.abs(t.x * 7 + t.z * 13) % 10) / 10);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, h * 0.45, 6), trunkMat);
        trunk.position.y = h * 0.22;
        trunk.castShadow = true;
        tree.add(trunk);
        const foliage = new THREE.Mesh(new THREE.ConeGeometry(0.9 + h * 0.08, h * 0.65, 7), leafMat);
        foliage.position.y = h * 0.62;
        foliage.castShadow = true;
        tree.add(foliage);
        tree.position.set(t.x, 0, t.z);
        tree.userData.surface = 'tree';
        env.add(tree);
    }

    // === 场景装饰物：油桶、木箱、栅栏 ===
    // 这四个材质原来都是默认 envMapIntensity 1.0，比地面 0.18 亮 5.5 倍，
    // 在 IBL 开启的近景里油桶会反光成塑料罐。与 world_props.mat() 保持同一档。
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x8b2500, roughness: 0.6, metalness: 0.4, envMapIntensity: 0.12 });
    const barrelBlueMat = new THREE.MeshStandardMaterial({ color: 0x1a3a6a, roughness: 0.6, metalness: 0.4, envMapIntensity: 0.12 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85, envMapIntensity: 0.12 });
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9, envMapIntensity: 0.12 });
    const decorCount = 35 + Math.floor(Math.random() * 15);
    for (let di = 0; di < decorCount; di++) {
        const dx = (Math.random() - 0.5) * (CONFIG.mapSize - 20);
        const dz = (Math.random() - 0.5) * (CONFIG.mapSize - 20);
        // 避开建筑物
        let nearBuilding = false;
        for (const b of FIXED_BUILDINGS) {
            if (Math.abs(dx - b.x) < b.w / 2 + 3 && Math.abs(dz - b.z) < b.d / 2 + 3) { nearBuilding = true; break; }
        }
        if (nearBuilding || isPointBlockedByMap(dx, dz, 1)) continue;

        const dtype = Math.random();
        if (dtype < 0.35) {
            // 油桶（低矮，可跳上）
            const barrel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.25, 0.25, 0.7, 10),
                Math.random() < 0.5 ? barrelMat : barrelBlueMat
            );
            barrel.position.set(dx, 0.35, dz);
            barrel.castShadow = true; barrel.receiveShadow = true;
            barrel.userData.surface = 'prop';
            env.add(barrel);
            obstacles.push({ mesh: barrel, isAABB: true, halfW: 0.28, halfD: 0.28, height: 0.7, climbable: true });
        } else if (dtype < 0.7) {
            // 木箱（低矮，可跳上，可能堆叠）
            const stackH = 1 + Math.floor(Math.random() * 2);
            for (let si = 0; si < stackH; si++) {
                const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), crateMat);
                crate.position.set(dx + (si % 2) * 0.1, 0.3 + si * 0.6, dz);
                crate.castShadow = true; crate.receiveShadow = true;
                crate.userData.surface = 'prop';
                env.add(crate);
                obstacles.push({ mesh: crate, isAABB: true, halfW: 0.38, halfD: 0.38, height: 0.6 * (si + 1), climbable: true });
            }
        } else {
            // 栅栏段（不可翻越，加碰撞）
            const fenceLen = 2 + Math.random() * 3;
            const fence = new THREE.Group();
            const posts = Math.ceil(fenceLen / 0.8);
            for (let pi = 0; pi <= posts; pi++) {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), fenceMat);
                post.position.set(-fenceLen / 2 + pi * (fenceLen / posts), 0.4, 0);
                post.castShadow = true;
                fence.add(post);
            }
            const rail1 = new THREE.Mesh(new THREE.BoxGeometry(fenceLen, 0.06, 0.05), fenceMat);
            rail1.position.set(0, 0.55, 0); fence.add(rail1);
            const rail2 = new THREE.Mesh(new THREE.BoxGeometry(fenceLen, 0.06, 0.05), fenceMat);
            rail2.position.set(0, 0.25, 0); fence.add(rail2);
            fence.position.set(dx, 0, dz);
            fence.rotation.y = Math.random() * Math.PI;
            fence.userData.surface = 'prop';
            env.add(fence);
            // 栅栏用AABB碰撞，按旋转后的包围盒近似
            const fhw = fenceLen / 2, fhd = 0.15;
            obstacles.push({ mesh: fence, isAABB: true, halfW: fhw, halfD: fhd, height: 0.8, climbable: false });
        }
    }

    const wallMat = new THREE.MeshStandardMaterial({ color: theme.wallColor ?? 0x7d7c72, roughness: 0.82 });
    const wallCapMat = new THREE.MeshStandardMaterial({ color: 0x3f403c, roughness: 0.7 });
    const half = CONFIG.mapSize / 2, h = 6;
    [[0, h / 2, -half, CONFIG.mapSize, h, 0.5], [0, h / 2, half, CONFIG.mapSize, h, 0.5], [half, h / 2, 0, 0.5, h, CONFIG.mapSize], [-half, h / 2, 0, 0.5, h, CONFIG.mapSize]].forEach(w => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w[3], w[4], w[5]), wallMat);
        wall.position.set(w[0], w[1], w[2]);
        wall.receiveShadow = wall.castShadow = true;
        wall.userData.surface = 'boundary';
        env.add(wall);
        // 压顶：给边界墙一条明确的收边，避免远看是一块没有厚度的黑幕
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w[3] + 0.12, 0.22, w[5] + 0.32), wallCapMat);
        cap.position.set(w[0], w[4] + 0.11, w[2]);
        cap.receiveShadow = true;
        env.add(cap);
    });

    for (const b of FIXED_BUILDINGS) {
        const grp = new THREE.Group();
        const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(b.color).lerp(new THREE.Color(0xb5b0a4), 0.5), roughness: 0.78 });
        const trimMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.3 });
        const windowMat = new THREE.MeshStandardMaterial({ color: 0x141e26, roughness: 0.22, metalness: 0.28, emissive: 0x080f14, emissiveIntensity: 0.3, envMapIntensity: 0.28 });
        // Foundation base
        const base = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.3, 0.3, b.d + 0.3), trimMat);
        base.position.y = 0.15; base.receiveShadow = true; grp.add(base);
        // Main body
        const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), wallMat);
        body.position.y = b.h / 2 + 0.3;
        body.castShadow = body.receiveShadow = true; grp.add(body);
        body.userData.surface = 'building';
        // ===== 立面：楼层腰线 + 逐窗（窗框/玻璃/窗台），避免整栋楼是一块灰盒子 =====
        const winFloors = Math.max(1, Math.floor((b.h - 0.4) / 2.6));
        for (let wf = 0; wf < winFloors; wf++) {
            const wy = 1.45 + wf * 2.6;
            if (wy > b.h - 0.3) break;
            const ledge = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.26, 0.12, b.d + 0.26), trimMat);
            ledge.position.y = wy + 0.72;
            ledge.castShadow = true; ledge.receiveShadow = true;
            grp.add(ledge);

            // 前后立面窗
            const count = Math.max(2, Math.floor((b.w * 0.78) / 2.05));
            const span = b.w * 0.78;
            for (const side of [1, -1]) {
                for (let i = 0; i < count; i++) {
                    const wx = -span / 2 + span * (i + 0.5) / count;
                    // 一层中间是门，跳过
                    if (wf === 0 && side === 1 && Math.abs(wx) < 1.35) continue;
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.06, 1.30, 0.10), trimMat);
                    frame.position.set(wx, wy, side * (b.d / 2 + 0.02));
                    grp.add(frame);
                    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.08, 0.04), windowMat);
                    pane.position.set(wx, wy, side * (b.d / 2 + 0.075));
                    grp.add(pane);
                    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.06, 0.06), trimMat);
                    mullion.position.set(wx, wy, side * (b.d / 2 + 0.085));
                    grp.add(mullion);
                    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.07, 0.20), trimMat);
                    sill.position.set(wx, wy - 0.68, side * (b.d / 2 + 0.08));
                    grp.add(sill);
                }
            }
            // 侧立面窗
            const countS = Math.max(1, Math.floor((b.d * 0.72) / 2.2));
            const spanS = b.d * 0.72;
            for (const side of [1, -1]) {
                for (let i = 0; i < countS; i++) {
                    const wz = -spanS / 2 + spanS * (i + 0.5) / countS;
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.30, 1.06), trimMat);
                    frame.position.set(side * (b.w / 2 + 0.02), wy, wz);
                    grp.add(frame);
                    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.08, 0.86), windowMat);
                    pane.position.set(side * (b.w / 2 + 0.075), wy, wz);
                    grp.add(pane);
                }
            }
        }

        // 雨棚 + 门柱
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 1.15), trimMat);
        canopy.position.set(0, 2.42, b.d / 2 + 0.55);
        canopy.castShadow = true; grp.add(canopy);
        for (const px of [-1.05, 1.05]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.4, 0.09), trimMat);
            post.position.set(px, 1.2, b.d / 2 + 1.0);
            grp.add(post);
        }

        // 侧墙空调外机与落水管
        if (b.w * b.d > 30) {
            const ac = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.42),
                new THREE.MeshStandardMaterial({ color: 0x9a9d96, roughness: 0.72, metalness: 0.25 }));
            ac.position.set(b.w / 2 + 0.22, Math.min(b.h - 0.8, 2.6), (Math.random() - 0.5) * b.d * 0.4);
            ac.rotation.y = Math.PI / 2;
            ac.castShadow = true;
            grp.add(ac);
            const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, b.h, 6),
                new THREE.MeshStandardMaterial({ color: 0x4a4a46, roughness: 0.8 }));
            pipe.position.set(-b.w / 2 - 0.12, b.h / 2 + 0.3, b.d / 2 - 0.35);
            grp.add(pipe);
        }

        // 屋顶女儿墙
        const roofColor = b.roofColor ?? (theme.roofColor ?? 0x333333);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.6, 0.25, b.d + 0.6), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.62 }));
        roof.position.y = b.h + 0.42; roof.castShadow = true; grp.add(roof);
        roof.userData.surface = 'roof';
        const parapetMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.66 });
        const py = b.h + 0.75;
        for (const cfg of [[0, b.d / 2 + 0.22, b.w + 0.7, 0.22], [0, -b.d / 2 - 0.22, b.w + 0.7, 0.22], [b.w / 2 + 0.22, 0, 0.22, b.d + 0.7], [-b.w / 2 - 0.22, 0, 0.22, b.d + 0.7]]) {
            const p = new THREE.Mesh(new THREE.BoxGeometry(cfg[2], 0.55, cfg[3]), parapetMat);
            p.position.set(cfg[0], py, cfg[1]);
            p.castShadow = true; p.receiveShadow = true;
            grp.add(p);
        }
        if (b.landmark) {
            const sign = new THREE.Mesh(
                new THREE.CylinderGeometry(0.2, 0.2, 1.2, 6),
                new THREE.MeshStandardMaterial({ color: 0xff9800, emissive: 0x331100, emissiveIntensity: 0.4 })
            );
            sign.position.y = b.h + 1.1;
            grp.add(sign);
        }
        // Key building lock indicator
        if (b.keyType) {
            var lockColor = getKeycardRarityColor(b.keyType);
            var lockMat = new THREE.MeshStandardMaterial({ color: lockColor, emissive: lockColor, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.7 });
            // Padlock body
            var lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.2), lockMat);
            lockBody.position.set(0, 2.8, b.d / 2 + 0.15);
            lockBody.userData.noBatch = true;
            grp.add(lockBody);
            // Padlock shackle
            var shackle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 }));
            shackle.position.set(0, 3.05, b.d / 2 + 0.15);
            shackle.rotation.x = Math.PI / 2;
            shackle.userData.noBatch = true;
            grp.add(shackle);
            // Glowing ring on ground
            var glowRing = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.5, 24), new THREE.MeshBasicMaterial({ color: lockColor, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
            glowRing.rotation.x = -Math.PI / 2; glowRing.position.y = 0.05;
            glowRing.userData.noBatch = true;
            grp.add(glowRing);
            // Store reference for unlock animation
            var kbState = keyBuildingsState.find(function(kb) { return kb.x === b.x && kb.z === b.z; });
            if (kbState) { kbState.lockMesh = lockBody; kbState.shackleMesh = shackle; kbState.glowRing = glowRing; }
        }
        grp.position.set(b.x, 0, b.z);
        env.add(grp);
        obstacles.push({ mesh: grp, isAABB: true, halfW: b.w / 2, halfD: b.d / 2, height: b.h || 4, climbable: false });
    }

    for (const p of ((MAP_DATA && MAP_DATA.props) || [])) {
        const prop = new THREE.Group();
        if (p.type === 'container') {
            const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 6), new THREE.MeshStandardMaterial({ color: p.color ?? 0x4a6a5a, roughness: 0.6, metalness: 0.3 }));
            box.position.y = 1.2;
            box.castShadow = box.receiveShadow = true;
            box.userData.surface = 'container';
            prop.add(box);
            obstacles.push({ mesh: prop, isAABB: true, halfW: 1.2, halfD: 3, height: 2.4, climbable: false });
        } else if (p.type === 'barrel') {
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1.0, 8), new THREE.MeshStandardMaterial({ color: p.color ?? 0x6a4a2a, roughness: 0.7 }));
            barrel.position.y = 0.5;
            barrel.castShadow = true;
            prop.add(barrel);
            obstacles.push({ mesh: prop, radius: 0.45, height: 1.0, climbable: true });
        }
        prop.position.set(p.x, 0, p.z);
        if (p.rot) prop.rotation.y = p.rot;
        env.add(prop);
    }

    const coverGeos = [new THREE.BoxGeometry(2, 1.2, 2), new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8), new THREE.BoxGeometry(3, 0.8, 0.5)];
    const coverColors = theme.coverColors || [0x6b5b45, 0x4a4a4a, 0x8b7355];
    let coverSpots = (MAP_DATA && MAP_DATA.coverSpots) ? [...MAP_DATA.coverSpots] : [];
    if (coverSpots.length === 0) {
        const seed = ((MAP_DATA && MAP_DATA.name) || 'map').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        for (let i = 0; i < 28; i++) {
            const r1 = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
            const r2 = Math.sin(seed * 93.9898 + i * 45.233) * 43758.5453;
            const cx = ((r1 - Math.floor(r1)) - 0.5) * (CONFIG.mapSize - 14);
            const cz = ((r2 - Math.floor(r2)) - 0.5) * (CONFIG.mapSize - 14);
            let nearBld = false;
            for (const b of FIXED_BUILDINGS) {
                if (Math.abs(cx - b.x) < b.w / 2 + 3 && Math.abs(cz - b.z) < b.d / 2 + 3) { nearBld = true; break; }
            }
            if (nearBld || (Math.abs(cx) < 8 && Math.abs(cz) < 8) || isPointBlockedByMap(cx, cz, 1)) continue;
            coverSpots.push({ x: cx, z: cz, type: i % 3 });
        }
    }
    for (const cs of coverSpots) {
        const gi = cs.type != null ? cs.type % 3 : 0;
        const cov = new THREE.Mesh(coverGeos[gi], new THREE.MeshStandardMaterial({ color: coverColors[gi], roughness: 0.8 }));
        cov.position.set(cs.x, coverGeos[gi].parameters?.height ? coverGeos[gi].parameters.height / 2 : 0.6, cs.z);
        cov.castShadow = cov.receiveShadow = true;
        cov.userData.surface = 'cover';
        env.add(cov);
        const covH = coverGeos[gi].parameters?.height || 1.2;
        obstacles.push({ mesh: cov, radius: gi === 2 ? 1.6 : 1.2, height: covH, climbable: covH <= 0.9 });
    }

    // Atmospheric dust particles (ambient floating motes)
    const dustCount=Math.min(80,CONFIG.mapSize);
    const dustGeo=new THREE.BufferGeometry();
    const dustPositions=new Float32Array(dustCount*3);
    for(let i=0;i<dustCount;i++){
        dustPositions[i*3]=(Math.random()-0.5)*CONFIG.mapSize;
        dustPositions[i*3+1]=Math.random()*8+0.5;
        dustPositions[i*3+2]=(Math.random()-0.5)*CONFIG.mapSize;
    }
    dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
    const dustMat=new THREE.PointsMaterial({color:0xddccaa,size:0.15,transparent:true,opacity:0.25,depthWrite:false});
    const dustParticles=new THREE.Points(dustGeo,dustMat);
    dustParticles.name='dustParticles';
    env.add(dustParticles);

    scene.add(env);
}

// ========== SECTION 8: PLAYER ==========
function updatePlayer(dt) {
    if(S.phase!=='playing'||S._isSearching||S._fullMapOpen)return;
    playerGroup.rotation.y=mouseX;
    // 相机后坐力叠加：枪口上抬时视线同步被顶一下，再平滑回位
    var _camKick = (typeof PlayerAnimation!=='undefined'&&PlayerAnimation.getCameraKick)?PlayerAnimation.getCameraKick():null;
    camera.rotation.x=mouseY+(_camKick?_camKick.pitch:0);
    camera.rotation.y=(_camKick?_camKick.yaw:0);

    let mx=0,mz=0;
    if(isActionPressed('forward'))mz-=1;
    if(isActionPressed('backward'))mz+=1;
    if(isActionPressed('left'))mx-=1;
    if(isActionPressed('right'))mx+=1;
    if(mx||mz){const l=Math.sqrt(mx*mx+mz*mz);mx/=l;mz/=l;}

    // Crouch toggle (CTRL key)
    if(isActionPressed('crouch')&&!S._crouchCooldown){
        S.isCrouching=!S.isCrouching; S._crouchCooldown=true;
        setTimeout(()=>S._crouchCooldown=false,300);
    }
    const targetCamY=S.isCrouching?1.0:1.7;
    camera.position.y+=(targetCamY-camera.position.y)*12*dt;

    // Sprint: requires stamina > 0 and not crouching
    const isAimingNow = (typeof WeaponADS !== 'undefined') && WeaponADS.isAiming();
    const isSprinting=isActionPressed('sprint')&&!S.isCrouching&&S.stamina>0&&!S._staminaExhausted&&!isAimingNow;
    let speed=CONFIG.playerSpeed*dt;
    // 技能效果：移动速度提升
    let moveSpeedBonus = getTotalSkillEffect('moveSpeed');
    speed *= (1 + moveSpeedBonus);
    if(isSprinting)speed*=CONFIG.sprintMultiplier;
    else if(S.isCrouching)speed*=CONFIG.crouchSpeedMultiplier;
    // Fracture reduces movement speed by 40%
    if(S.fracture)speed*=0.6;
    // 开镜时移动速度降低
    if(isAimingNow&&typeof WeaponADS!=='undefined')speed*=WeaponADS.getMoveSpeedMultiplier();
    // Adrenaline boosts speed by 25%
    if(S._adrenalineTimer&&S._adrenalineTimer>0){speed*=1.25;S._adrenalineTimer-=dt;}
    // Painkiller timer countdown
    if(S._painkillerTimer&&S._painkillerTimer>0){S._painkillerTimer-=dt;}

    // Stamina management
    if(isSprinting&&(mx||mz)){
        S.stamina=Math.max(0,S.stamina-CONFIG.staminaDrainPerSec*dt);
        if(S.stamina<=0){S._staminaExhausted=true;S._staminaRecoverTimer=CONFIG.staminaExhaustedPenalty;}
    }else{
        if(S._staminaExhausted){S._staminaRecoverTimer-=dt;
            if(S._staminaRecoverTimer<=0)S._staminaExhausted=false;
        }else S.stamina=Math.min(CONFIG.maxStamina,S.stamina+CONFIG.staminaRegenPerSec*dt);
    }

    // Movement inertia / smooth acceleration
    if(!S._velX)S._velX=0;if(!S._velZ)S._velZ=0;
    const targetVX=mx*speed*60,targetVZ=mz*speed*60; // Convert to velocity
    const inertia=isSprinting?8:6; // Higher inertia when sprinting
    S._velX+=(targetVX-S._velX)*Math.min(1,inertia*dt);
    S._velZ+=(targetVZ-S._velZ)*Math.min(1,inertia*dt);
    const wdx=S._velX*dt,wdz=S._velZ*dt;

    const sin=Math.sin(mouseX),cos=Math.cos(mouseX);
    const fwdX=(wdx*cos+wdz*sin),fwdZ=(-wdx*sin+wdz*cos);

    let nx=playerGroup.position.x+fwdX,nz=playerGroup.position.z+fwdZ;
    const h2=CONFIG.mapSize/2-3;
    nx=Math.max(-h2,Math.min(h2,nx));nz=Math.max(-h2,Math.min(h2,nz));

    let blocked=false;
    let stepUpHeight = 0; // 可自动攀爬的台阶高度
    const playerFeetY = playerGroup.position.y;
    const PLAYER_RADIUS = 0.35; // 玩家碰撞半径（更精确）

    for(const o of obstacles){if(o.isWater)continue;
        // 计算障碍物顶部Y坐标
        const obsTopY = (o.mesh.position ? o.mesh.position.y : 0) + (o.height || 999);
        // 如果玩家脚部高于障碍物顶部附近，不阻挡（玩家在物体上方或正在从边缘走下）
        // 增大容差到0.4m，避免从建筑边缘下落时被碰撞箱卡住
        if (playerFeetY >= obsTopY - 0.4) continue;

        if(o.isAABB){
            const hw=o.halfW+PLAYER_RADIUS, hd=o.halfD+PLAYER_RADIUS;
            const ox=o.mesh.position.x, oz=o.mesh.position.z;
            if(nx>ox-hw&&nx<ox+hw&&nz>oz-hd&&nz<oz+hd){
                // 检查是否可攀爬：低矮物体 + 玩家在地面 + 目标位置在物体严格范围内
                const targetInside = nx >= ox - o.halfW && nx <= ox + o.halfW &&
                                     nz >= oz - o.halfD && nz <= oz + o.halfD;
                if (o.climbable && o.height <= 0.8 && playerFeetY < 0.1 && targetInside) {
                    stepUpHeight = Math.max(stepUpHeight, o.height);
                } else {
                    blocked=true;break;
                }
            }
        }else{
            const dx=nx-o.mesh.position.x,dz=nz-o.mesh.position.z;
            const r=o.radius+PLAYER_RADIUS;
            if(dx*dx+dz*dz<r*r){
                const targetInside = dx*dx + dz*dz <= o.radius * o.radius;
                if (o.climbable && o.height <= 0.8 && playerFeetY < 0.1 && targetInside) {
                    stepUpHeight = Math.max(stepUpHeight, o.height);
                } else {
                    blocked=true;break;
                }
            }
        }
    }
    if(!blocked){
        playerGroup.position.x=nx;playerGroup.position.z=nz;
        // 自动攀爬台阶
        if (stepUpHeight > 0 && playerFeetY < 0.1) {
            playerGroup.position.y = stepUpHeight;
            S._velocityY = 0;
        }
    }
    else{S._velX=0;S._velZ=0;}

    // Jump (higher when not crouching)
    const onGround=playerGroup.position.y<=0.01;
    if(isActionPressed('jump')&&onGround&&!S.isCrouching){S._velocityY=0.2;_standingOnObstacle=null;}

    // 检查玩家是否站在障碍物顶部（在应用重力之前，避免下落-吸回抖动）
    let standingTop = 0;
    let standingObj = null;
    if (S._velocityY <= 0.01) {
        const px = playerGroup.position.x, pz = playerGroup.position.z;
        for (const o of obstacles) {
            if (!o.height) continue;
            const obsTop = (o.mesh.position ? o.mesh.position.y : 0) + o.height;
            if (obsTop <= 0.05) continue;
            // 严格水平检测：玩家必须完全在障碍物范围内（不加容差）
            let inside = false;
            if (o.isAABB) {
                inside = px >= o.mesh.position.x - o.halfW &&
                         px <= o.mesh.position.x + o.halfW &&
                         pz >= o.mesh.position.z - o.halfD &&
                         pz <= o.mesh.position.z + o.halfD;
            } else {
                const dx = px - o.mesh.position.x, dz = pz - o.mesh.position.z;
                inside = dx*dx + dz*dz <= o.radius * o.radius;
            }
            // 垂直检测：玩家脚部在顶部附近
            if (inside && playerGroup.position.y <= obsTop + 0.08 && playerGroup.position.y >= obsTop - 0.15) {
                if (obsTop > standingTop) { standingTop = obsTop; standingObj = o; }
            }
        }
    }

    if (standingTop > 0) {
        // 站在物体上：直接保持在顶部，不应用重力
        playerGroup.position.y = standingTop;
        S._velocityY = 0;
        _standingOnObstacle = standingObj;
    } else {
        // 不在物体上：应用重力
        _standingOnObstacle = null;
        S._velocityY -= 0.012;
        playerGroup.position.y += S._velocityY;
        // 地面碰撞
        if (playerGroup.position.y <= 0) {
            playerGroup.position.y = 0;
            S._velocityY = 0;
        }
    }

    // Weapon bob — 已由 animation_enhancement.js 统一处理
    // const speedNorm=Math.abs(S._velX)+Math.abs(S._velZ);
    // const bobFreq=(isSprinting?0.022:0.014)*(S.isCrouching?0.5:1);
    // if(mx||mz){weaponGroup.position.y=Math.sin(performance.now()*bobFreq)*(isSprinting?0.014:0.006)*(S.isCrouching?0.6:1);}
    // else weaponGroup.position.y*=0.9;

    // Footstep sounds
    if(mx||mz){
        const stepInterval=isSprinting?0.32:(S.isCrouching?0.7:0.45);
        _stepTimer+=dt;
        if(_stepTimer>=stepInterval){_stepTimer=0;sfxFootstep(isSprinting,S.isCrouching,getGroundSurface());}
    }else _stepTimer=0;

    const w=S.weaponSlots[S.currentWeapon]?WEAPONS[S.weaponSlots[S.currentWeapon]]:null;
    if(w&&w.auto&&isMouseDown&&S.phase==='playing')shoot();

    // Reset prompt flags before proximity checks
    var _prompt=document.getElementById('searchPrompt');
    if(_prompt){_prompt._isAirdrop=false;_prompt._isBossTask=false;}
    checkNearbyBossTaskPoints();
    checkNearbyAirdrops();
    checkNearbyContainers();
    checkNearbyGroundLoot();
    checkNearbyKeyBuildings();
    checkExtractZone();
    updateBossIndicators();
    updateAirdrops(CONFIG.FIXED_DT);
    updateBleeding(CONFIG.FIXED_DT);
    updateExtractPointTimers(CONFIG.FIXED_DT);
}

// Get armor tier from item ID (supports both tierX_ and named armor)
function getArmorTier(itemId){
    if(!itemId)return 1;
    var m=itemId.match(/tier(\d+)/);
    if(m)return parseInt(m[1]);
    // Map named armor/helmets to equivalent tiers
    var tierMap={
        'light_armor':1,'medium_armor':3,'heavy_armor':4,'elite_armor':5,
        'basic_helmet':1,'adv_helmet':2,'elite_helmet':4,
    };
    return tierMap[itemId]||1;
}

// Tier-based mitigation parameters
function getArmorMitigation(tier){
    var t=Math.max(1,Math.min(6,tier));
    // Flat damage reduction per hit: T1=1, T2=2, T3=3, T4=4, T5=6, T6=10
    var flatTable=[0,1,2,3,4,6,10];
    // Armor HP degradation resistance: T4=10%, T5=15%, T6=25% less wear per hit
    var degradeTable=[0,0,0,0,0.10,0.15,0.25];
    // Overall damage reduction (applied before armor absorption): T4=5%, T5=10%, T6=15%
    var drTable=[0,0,0,0,0.05,0.10,0.15];
    return {flatReduce:flatTable[t], degradeResist:degradeTable[t], overallDR:drTable[t]};
}

function damagePlayer(raw, sourceX, sourceZ){
    let amt=raw;
    // Overall mitigation based on highest armor tier worn
    var maxTier=0;
    if(S.equipment.armor) maxTier=Math.max(maxTier, getArmorTier(S.equipment.armor));
    if(S.equipment.helmet) maxTier=Math.max(maxTier, getArmorTier(S.equipment.helmet));
    if(maxTier>=1){
        var topMit=getArmorMitigation(maxTier);
        // Overall percentage DR (T4+: 5-15%)
        amt*=(1-topMit.overallDR);
        // Flat damage reduction (inherent armor quality, applied once, does not consume HP)
        amt=Math.max(0, amt-topMit.flatReduce);
    }
    // Helmet percentage absorption (tier-based, with degradation resistance)
    if(S.equipment.helmetHP>0&&amt>0){
        var helmTier=getArmorTier(S.equipment.helmet);
        var helmMit=getArmorMitigation(helmTier);
        var helmAbsorbRate=0.30+helmTier*0.05; // 35%(T1) → 60%(T6)
        var helmPct=Math.min(S.equipment.helmetHP, amt*helmAbsorbRate);
        // 技能效果：护甲耐久度提升（减少耐久消耗）
        let armorDurabilityBonus = getTotalSkillEffect('armorDurability');
        S.equipment.helmetHP-=helmPct*(1-helmMit.degradeResist)*(1-armorDurabilityBonus);
        amt-=helmPct;
        if(S.equipment.helmetHP<=0){S.equipment.helmetHP=0;S.equipment.helmet=null;}
    }
    // Armor percentage absorption (tier-based, with degradation resistance)
    if(S.equipment.armorHP>0&&amt>0){
        var armorTier=getArmorTier(S.equipment.armor);
        var armorMit=getArmorMitigation(armorTier);
        var armorAbsorbRate=0.50+armorTier*0.05; // 55%(T1) → 80%(T6)
        var armorPct=Math.min(S.equipment.armorHP, amt*armorAbsorbRate);
        // 技能效果：护甲耐久度提升（减少耐久消耗）
        let armorDurabilityBonus = getTotalSkillEffect('armorDurability');
        S.equipment.armorHP-=armorPct*(1-armorMit.degradeResist)*(1-armorDurabilityBonus);
        amt-=armorPct;
        if(S.equipment.armorHP<=0){S.equipment.armorHP=0;S.equipment.armor=null;}
    }
    // Clamp: can't deal more than raw damage, can't go negative
    amt=Math.max(0,Math.min(amt,raw));
    // 技能效果：低血量减伤（生命值低于20%时触发）
    if (S.health / S.maxHealth < 0.2) {
        let lowHealthDR = getTotalSkillEffect('lowHealthDamageReduction');
        amt *= Math.max(0.3, 1.0 - lowHealthDR);
    }
    S.health-=amt; updateHUD();
    // 增强版受击反馈
    if (typeof PlayerAnimation !== 'undefined' && amt > 0) PlayerAnimation.onPlayerHit(amt);
    const ov=document.getElementById('damageOverlay');ov.style.opacity='1';setTimeout(()=>ov.style.opacity='0',120);
    // Directional damage indicator + screen shake
    if (sourceX !== undefined && sourceZ !== undefined) {
        showDamageDirection(sourceX, sourceZ);
    }
    triggerScreenShake();
    // Bleeding chance based on damage amount (armor mitigates bleeding too)
    if(amt>8 && Math.random()<Math.min(0.6,amt*0.03)){
        S.bleeding=Math.min(5,(S.bleeding||0)+1); // Stack bleeding up to 5
        showBleedingIndicator();
    }
    // Fracture chance on high damage
    if(amt>20 && Math.random()<0.15 && !S.fracture){
        S.fracture=true;
        showFractureIndicator();
    }
    if(S.health<=0){S.health=0;sfxPlayerDeath();endGame(false);}
}

// ========== BLEEDING & INJURY SYSTEM ==========
function updateBleeding(dt){
    if(S.phase!=='playing'||!S.bleeding||S.bleeding<=0)return;
    // Drain health based on bleeding severity
    S._bleedAccum=(S._bleedAccum||0)+dt;
    if(S._bleedAccum>=1.0){
        S._bleedAccum=0;
        var dmg=S.bleeding*0.8; // 0.8 HP per second per bleeding level
        S.health-=dmg;
        updateHUD();
        // Pulse the damage overlay slightly
        var ov=document.getElementById('damageOverlay');
        if(ov){ov.style.opacity='0.3';setTimeout(function(){ov.style.opacity='0';},100);}
        if(S.health<=0){S.health=0;sfxPlayerDeath();endGame(false);}
    }
}

function showBleedingIndicator(){
    var div=document.getElementById('bleedingIndicator');
    if(!div){
        div=document.createElement('div');
        div.id='bleedingIndicator';
        div.style.cssText='position:fixed;top:55%;left:50%;transform:translateX(-50%);background:rgba(139,0,0,0.85);border:1px solid #ff0000;border-radius:4px;padding:4px 16px;color:#ff6666;font-size:13px;font-weight:bold;z-index:100;animation:bleedPulse 1.2s ease-in-out infinite;pointer-events:none;';
        document.body.appendChild(div);
    }
    div.innerHTML='🩸 流血中 (Lv.'+S.bleeding+') - 使用绷带止血';
    div.style.display='block';
}

function showFractureIndicator(){
    var div=document.getElementById('fractureIndicator');
    if(!div){
        div=document.createElement('div');
        div.id='fractureIndicator';
        div.style.cssText='position:fixed;top:62%;left:50%;transform:translateX(-50%);background:rgba(60,30,0,0.85);border:1px solid #ff9800;border-radius:4px;padding:4px 16px;color:#ffaa44;font-size:13px;font-weight:bold;z-index:100;pointer-events:none;';
        document.body.appendChild(div);
    }
    div.innerHTML='🦴 骨折 - 移动速度降低40%，使用手术包治疗';
    div.style.display='block';
}

function stopBleeding(){
    S.bleeding=0;
    var div=document.getElementById('bleedingIndicator');
    if(div)div.style.display='none';
}

function healFracture(){
    S.fracture=false;
    var div=document.getElementById('fractureIndicator');
    if(div)div.style.display='none';
}

function useItem(type){
    if(S.phase!=='playing')return;
    var consumed=false;
    // Check pockets first
    const pIdx=S.pockets.indexOf(type);
    if(pIdx>=0){S.pockets.splice(pIdx,1);consumed=true;}
    // Check backpack
    else if(S.backpack._items){const eIdx=S.backpack._items.findIndex(e=>e.id===type);
        if(eIdx>=0){const e=S.backpack._items[eIdx];removeFromGrid(S.backpack,e);S.lootValue=Math.max(0,S.lootValue-ITEMS[type].value);consumed=true;}}
    
    if(!consumed)return;
    
    // Apply item effects
    var def=ITEMS[type];
    if(def){
        // Healing items - 技能效果：生命恢复速度提升
        if(def.amount){
            let healAmount = def.amount;
            let healBonus = getTotalSkillEffect('healthRegen');
            healAmount *= (1 + healBonus);
            S.health=Math.min(S.maxHealth,S.health+healAmount);
        }
        
        // Bandage - heals small amount + stops bleeding
        if(type==='bandage'){stopBleeding();}
        // Tourniquet - stops severe bleeding + small heal
        else if(type==='tourniquet'){stopBleeding();S.health=Math.min(S.maxHealth,S.health+5);}
        // Surgery kit - heals fracture + moderate heal
        else if(type==='surgeryKit'){healFracture();S.health=Math.min(S.maxHealth,S.health+30);}
        // Adrenaline - boost + stop bleeding + speed boost
        else if(type==='adrenaline'){stopBleeding();S._adrenalineTimer=15; /* 15s speed boost */}
        // Painkiller - temporary pain relief (no direct heal, but reduces bleed for a while)
        else if(type==='painkiller'){S._painkillerTimer=30;if(S.bleeding>0){S.bleeding=Math.max(0,S.bleeding-1);if(S.bleeding===0)stopBleeding();else showBleedingIndicator();}}
        // Medkit - full heal + stop bleeding + heal fracture
        else if(type==='medkit'){stopBleeding();healFracture();}
    }
    updateHUD();sfxUseItem();
}

// ========== SECTION 9: WEAPONS (RAYCASTER) ==========
function shoot(){
    if(S.isReloading||S._isSearching||S.weaponJammed)return;
    const wt=S.weaponSlots[S.currentWeapon];if(!wt)return;
    const weapon=WEAPONS[wt],now=performance.now()/1000;
    if(now-S.lastShot<weapon.fireRate/1000)return;

    // Melee attack (knife)
    if(weapon.isMelee){
        S.lastShot=now;sfxShoot();
        // Melee hit check using raycaster
        const origin=new THREE.Vector3();camera.getWorldPosition(origin);
        const dir=new THREE.Vector3();camera.getWorldDirection(dir);
        playerRaycaster.set(origin,dir);playerRaycaster.far=2.5;
        const hits=playerRaycaster.intersectObjects(enemyHitboxes,false);
        if(hits.length>0){const e=hits[0].object.userData.enemy;
            if(!e)return;
            e.health-=weapon.damage;
            if (typeof EnemyAI !== 'undefined') EnemyAI.onEnemyHit(e, weapon.damage);
            createHitEffect(hits[0].point,0xff4444,5);
            updateEnemyHealthBar(e);showDamageNumber(hits[0].point.clone(),weapon.damage,null);showHitMarker('hit');if(e.health<=0)killEnemy(e);
        }
        // 近战后坐力由动画系统统一处理
        if (typeof PlayerAnimation !== 'undefined') PlayerAnimation.applyRecoil(0.06);
        else { weaponGroup.position.z+=0.05;setTimeout(()=>weaponGroup.position.z=0,60); }
        return;
    }

    if(S.magAmmo[S.currentWeapon]<=0){
        // 检查设置中的自动换弹选项
        let autoReloadEnabled = true;
        try {
            if (typeof GameSettings !== 'undefined' && typeof GameSettings.getSettings === 'function') {
                autoReloadEnabled = GameSettings.getSettings().gameplay.autoReload !== false;
            }
        } catch(e) { reportInitError('autoReload:GameSettings', e); }
        if (autoReloadEnabled) reload();
        return;
    }
    // Weapon durability check - chance to jam if durability is low
    P.weaponDurability=P.weaponDurability||{};
    var dur=P.weaponDurability[wt];
    if(dur===undefined)dur=100; // Default to 100%
    if(dur<30 && Math.random()<(30-dur)*0.005){
        // Weapon jammed!
        S.weaponJammed=true;
        sfxReload(); // Click sound
        showJamNotification();
        setTimeout(function(){S.weaponJammed=false;},1500); // Auto-clear after 1.5s
        return;
    }
    S.lastShot=now;S.magAmmo[S.currentWeapon]--;updateWeaponUI();
    // Reduce weapon durability (non-melee)
    P.weaponDurability[wt]=Math.max(0,dur-0.05); // Each shot reduces 0.05%
    sfxShoot(weapon.ammo || (weapon.isMelee ? 'knife' : 'rifle'));
    // 世界空间特效：枪口火焰 / 抛壳 / 硝烟
    if (typeof WeaponFX !== 'undefined') {
        WeaponFX.onShoot({ kind: weapon.ammo || (weapon.isMelee ? 'knife' : 'rifle') });
    }

    const pellets=weapon.pellets||1;
    let mwp=null;
    for(let i=0;i<pellets;i++){
        const origin=new THREE.Vector3();camera.getWorldPosition(origin);
        const dir=new THREE.Vector3();camera.getWorldDirection(dir);
        // 应用开镜散布倍率
        let spreadMult = 1.0;
        let isAiming = false;
        if (typeof WeaponADS !== 'undefined') {
            spreadMult = WeaponADS.getSpreadMultiplier();
            isAiming = WeaponADS.isAiming();
        }
        // 技能效果：开镜精准度（仅在开镜时生效）+ 终极技能所有战斗属性
        if (isAiming) {
            let accuracyBonus = getTotalSkillEffect('adsAccuracy');
            accuracyBonus += getTotalSkillEffect('allCombat');
            spreadMult *= Math.max(0.3, 1.0 - accuracyBonus);
        }
        const effectiveSpread = weapon.spread * spreadMult;
        if(effectiveSpread>0){dir.x+=(Math.random()-0.5)*effectiveSpread*2;dir.y+=(Math.random()-0.5)*effectiveSpread*2;dir.normalize();}

        playerRaycaster.set(origin,dir);playerRaycaster.far=weapon.range;
        const eh=playerRaycaster.intersectObjects(enemyHitboxes,false);
        const oh=raycastObstacles(origin,dir,weapon.range);

        let hitEnemy=null,hitPoint=null;
        if(eh.length>0){const no=oh.length>0?oh[0].distance:Infinity;
            if(eh[0].distance<no){hitEnemy=eh[0].object.userData.enemy;hitPoint=eh[0].point.clone();
                if(!hitEnemy){hitEnemy=null;}
                else{
                let hs=false;let obj=eh[0].object;
                while(obj){if(obj.userData&&obj.userData.isHead){hs=true;break;}obj=obj.parent;}
                // 技能效果：伤害提升 + 终极技能所有战斗属性
                let damageMult = 1.0;
                damageMult += getTotalSkillEffect('damageBoost');
                damageMult += getTotalSkillEffect('allCombat');
                const dmg=(hs?weapon.damage*2.5:weapon.damage)*damageMult;hitEnemy.health-=dmg;
                if (typeof EnemyAI !== 'undefined') EnemyAI.onEnemyHit(hitEnemy, dmg);
                createHitEffect(hitPoint,hs?0xffff00:0xff4444,hs?8:5);
                if(hs)sfxHeadshot();else sfxHit();
                updateEnemyHealthBar(hitEnemy);
                showDamageNumber(hitPoint.clone(),Math.round(dmg),hs?'headshot':null);
                if(hitEnemy.health<=0){killEnemy(hitEnemy,hs);if(hs)trackMission('kill_headshot',1);showHitMarker('kill');showDamageNumber(hitEnemy.mesh.position.clone().setY(1.8),Math.round(dmg),'kill');}
                else showHitMarker(hs?'headshot':'hit');
                if(typeof WeaponFX!=='undefined')WeaponFX.bloodHit(hitPoint);
                }
            }else if(oh.length>0){hitPoint=oh[0].point.clone();createHitEffect(hitPoint,0xcccccc,3);spawnBulletImpact(oh[0]);}
        }else if(oh.length>0){hitPoint=oh[0].point.clone();createHitEffect(hitPoint,0xcccccc,3);spawnBulletImpact(oh[0]);}

        const trailEnd=hitPoint||origin.clone().add(dir.clone().multiplyScalar(weapon.range));
        createBulletTrail(origin.clone(),trailEnd);
        if(i===0)mwp=origin.clone();
    }
    if(mwp && (typeof WeaponFX === 'undefined' || !WeaponFX.isReady()))createMuzzleFlash(mwp);
    // 增强版后坐力
    if (typeof PlayerAnimation !== 'undefined') {
        let recoilMult = 1.0;
        if (typeof WeaponADS !== 'undefined') recoilMult = WeaponADS.getRecoilMultiplier();
        // 技能效果：后坐力控制 + 终极技能所有战斗属性
        let recoilReduction = getTotalSkillEffect('recoilReduction');
        recoilReduction += getTotalSkillEffect('allCombat');
        recoilMult *= Math.max(0.3, 1.0 - recoilReduction);
        PlayerAnimation.applyRecoil((weapon.recoil || 0.08) * recoilMult);
    } else {
        weaponGroup.position.z+=0.03;weaponGroup.rotation.x+=0.02;
        setTimeout(()=>{weaponGroup.position.z=0;weaponGroup.rotation.x=0;},40);
    }
    alertEnemies(playerGroup.position,35);
}

function showJamNotification(){
    var div=document.getElementById('jamNotification');
    if(!div){
        div=document.createElement('div');
        div.id='jamNotification';
        div.style.cssText='position:fixed;top:45%;left:50%;transform:translateX(-50%);background:rgba(80,20,0,0.9);border:2px solid #ff6600;border-radius:4px;padding:8px 20px;color:#ff8844;font-size:14px;font-weight:bold;z-index:150;pointer-events:none;';
        document.body.appendChild(div);
    }
    div.innerHTML='⚠️ 武器卡壳！请稍候...';
    div.style.display='block';
    div.style.opacity='1';
    setTimeout(function(){div.style.opacity='0';setTimeout(function(){div.style.display='none';},300);},1200);
}

function getWeaponDurability(wKey){
    P.weaponDurability=P.weaponDurability||{};
    if(P.weaponDurability[wKey]===undefined)P.weaponDurability[wKey]=100;
    return P.weaponDurability[wKey];
}

function repairWeapon(wKey){
    if(!wKey||wKey==='knife')return;
    var dur=getWeaponDurability(wKey);
    if(dur>=100){alert('该武器耐久已满！');return;}
    // ₵150/1% 与 ECON.PRICE_SCALE 同比例（原 500 × 0.625 ≈ 312，但维修是消耗项，
    // 按 150 定档让「修满一把枪」约等于一次中等战利品，不至于修枪就破产）。
    var repairCost=Math.round((100-dur)*150);
    if(P.money<repairCost){alert('资金不足！需要 ₵'+repairCost.toLocaleString());return;}
    P.money-=repairCost;
    P.weaponDurability[wKey]=100;
    savePersistent();renderShopTab();updateAllLobbyUI();
}

function reload(){
    if(S.isReloading)return;const wt=S.weaponSlots[S.currentWeapon];if(!wt)return;
    const weapon=WEAPONS[wt];if(weapon.isMelee)return;
    if(S.magAmmo[S.currentWeapon]>=getEffectiveMagSize(weapon))return;
    // Find ammo in quick slots (rig/pockets) first, then backpack
    const AMMO_ITEM_MAP = { pistol:'pistolAmmo', rifle:'rifleAmmo', shotgun:'shotgunAmmo', smg:'smgAmmo', sniper:'sniperAmmo', heavy:'heavyAmmo' };
    const ammoId = AMMO_ITEM_MAP[weapon.ammo] || null;
    if(!ammoId)return;
    const rigItems = S._rigItems || [];
    const ammoInRig = rigItems.filter(i=>i===ammoId).length;
    const ammoInPocket = S.pockets.filter(i=>i===ammoId).length;
    const ammoInBackpack = (S.backpack && S.backpack._items) ? S.backpack._items.filter(i=>i.id===ammoId).length : 0;
    if(ammoInRig+ammoInPocket+ammoInBackpack<=0)return;
    // Consume from rig first, then pockets, then backpack
    if(ammoInRig>0){const ri=rigItems.indexOf(ammoId);if(ri>=0)rigItems.splice(ri,1);}
    else if(ammoInPocket>0){const pi=S.pockets.indexOf(ammoId);if(pi>=0)S.pockets.splice(pi,1);}
    else if(ammoInBackpack>0){const bi=S.backpack._items.findIndex(i=>i.id===ammoId);if(bi>=0)S.backpack._items.splice(bi,1);}
    S.isReloading=true;sfxReload();
    // 技能效果：换弹速度 + 终极技能所有战斗属性
    let reloadSpeedBonus = getTotalSkillEffect('reloadSpeed');
    reloadSpeedBonus += getTotalSkillEffect('allCombat');
    const actualReloadTime = weapon.reloadTime * Math.max(0.3, 1.0 - reloadSpeedBonus);
    if (typeof PlayerAnimation !== 'undefined') {
        PlayerAnimation.startReloadAnimation(actualReloadTime);
    } else {
        weaponGroup.rotation.x=-0.3;
    }
    const need=getEffectiveMagSize(weapon)-S.magAmmo[S.currentWeapon];
    S.magAmmo[S.currentWeapon]+=need; // Full reload from quick slot ammo
    setTimeout(()=>{S.isReloading=false;weaponGroup.rotation.x=0;updateWeaponUI();},actualReloadTime*1000);
}

function switchWeapon(slot){if(slot<0||slot>3||!S.weaponSlots[slot]||S.isReloading)return;S.currentWeapon=slot;updateWeaponModel();updateWeaponUI();if(typeof PlayerAnimation!=='undefined'&&PlayerAnimation.playSwitch)PlayerAnimation.playSwitch();if(typeof WeaponADS!=='undefined'){const wt=S.weaponSlots[slot];if(wt)WeaponADS.setWeapon(wt);}}

function updateWeaponModel(){
    // 释放上一把武器的几何体/材质，避免反复切枪造成显存与内存泄漏
    while(weaponGroup.children.length>0){
        const old=weaponGroup.children[0];
        weaponGroup.remove(old);
        old.traverse(function(o){
            if(o.geometry)o.geometry.dispose();
            if(o.material){
                if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());
                else o.material.dispose();
            }
        });
    }
    weaponGroup.userData.adsOffset=null;
    const wt=S.weaponSlots[S.currentWeapon];if(!wt)return;
    const w=WEAPONS[wt];
    const _noShadow = m => { m.castShadow = false; m.receiveShadow = false; return m; };

    // ===== 视模根节点：放在画面右下方，ADS 时由 WeaponADS 平移回准线 =====
    const gun=new THREE.Group();
    gun.position.set(0.21,-0.235,-0.55);
    gun.rotation.set(0.02,-0.03,0.012);
    gun.scale.setScalar(0.86);
    weaponGroup.add(gun);

    const mkMat=(color,metal,rough,env)=>{
        const m=new THREE.MeshStandardMaterial({color:color,metalness:metal,roughness:rough,envMapIntensity:env==null?0.55:env});
        m.color.convertSRGBToLinear();
        return _noShadow(m);
    };
    const metal   = mkMat(0x1c2024, 0.68, 0.52, 0.38);
    const steel   = mkMat(0x343a40, 0.8, 0.38, 0.5);
    const polymer = mkMat(0x23262a, 0.10, 0.86, 0.28);
    const fde     = mkMat(0x5f5138, 0.08, 0.84, 0.26);
    const accent  = mkMat(0x0d0f11, 0.25, 0.70, 0.30);
    const glove   = mkMat(0x33352f, 0.04, 0.90, 0.25);
    const sleeve  = mkMat(0x43473b, 0.02, 0.94, 0.20);
    // 视模补光：微弱自发光抬起暗部，避免逆光时只剩黑色轮廓
    metal.emissive = new THREE.Color(0x0a0c0e);
    steel.emissive = new THREE.Color(0x101316);
    polymer.emissive = new THREE.Color(0x08090a);
    fde.emissive = new THREE.Color(0x140f08);
    const glass   = new THREE.MeshStandardMaterial({color:0x9fd4ea,metalness:0.1,roughness:0.05,transparent:true,opacity:0.3,envMapIntensity:1.2,emissive:0x0e2c3c,emissiveIntensity:0.18});
    const dotMat  = new THREE.MeshBasicMaterial({color:0xff3322});

    const B=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
    const C=(rt,rb,h,seg)=>new THREE.CylinderGeometry(rt,rb,h,seg||10);
    function part(parent,geo,mat,x,y,z,rx,ry,rz){
        const o=_noShadow(new THREE.Mesh(geo,mat));
        o.position.set(x||0,y||0,z||0);
        if(rx)o.rotation.x=rx;
        if(ry)o.rotation.y=ry;
        if(rz)o.rotation.z=rz;
        parent.add(o);
        return o;
    }

    // ===== 匕首：刀身朝上、刀面朝向镜头，斜握在右下 =====
    if(w.isMelee){
        const k=new THREE.Group();
        k.position.set(0.165,-0.205,-0.36);
        k.rotation.set(-0.36,0.58,-0.55);
        k.scale.setScalar(0.82);
        weaponGroup.add(k);
        const bladeMat=steel.clone(); bladeMat.color.setHex(0x6e757c); bladeMat.metalness=0.85; bladeMat.roughness=0.36; bladeMat.emissive=new THREE.Color(0x14181c);
        // 刀身（宽面朝 +Z）
        part(k,B(0.036,0.170,0.009),bladeMat,0,0.110,0);
        part(k,B(0.007,0.145,0.011),accent,0,0.100,0.001);
        // 刀尖
        const tip=part(k,new THREE.ConeGeometry(0.020,0.058,4),bladeMat,0,0.220,0);
        tip.rotation.y=Math.PI/4; tip.scale.z=0.32;
        // 刀背锯齿
        for(let i=0;i<5;i++) part(k,B(0.008,0.008,0.010),steel,0.020,0.048+i*0.017,0);
        // 护手 / 握把 / 缠绳 / 尾锤
        part(k,B(0.080,0.012,0.024),metal,0,0.018,0);
        part(k,B(0.030,0.100,0.026),accent,0,-0.045,0);
        for(let i=0;i<4;i++) part(k,B(0.032,0.006,0.028),steel,0,-0.012-i*0.023,0);
        part(k,B(0.036,0.014,0.030),metal,0,-0.100,0);
        // 持刀手
        part(k,B(0.052,0.078,0.062),glove,0,-0.045,0.026,-0.08);
        for(let i=0;i<3;i++) part(k,B(0.050,0.014,0.020),glove,0,-0.018-i*0.022,0.058);
        part(k,B(0.064,0.190,0.078),sleeve,0.012,-0.195,0.070,0.42);
        return;
    }

    // ===== 枪械参数按弹药类型区分 =====
    const cls = w.ammo || 'rifle';
    const isPistol = cls==='pistol';
    const isSMG = cls==='smg';
    const isShotgun = cls==='shotgun';
    const isSniper = cls==='sniper';
    const isHeavy = cls==='heavy';

    if(isPistol){
        const slide=part(gun,B(0.038,0.046,0.185),steel,0,0.020,-0.030);
        part(gun,B(0.040,0.010,0.185),metal,0,0.044,-0.030);
        part(gun,B(0.030,0.026,0.120),polymer,0,-0.012,0.010);
        part(gun,B(0.036,0.108,0.056),polymer,0,-0.070,0.060,-0.22);
        part(gun,B(0.040,0.012,0.060),metal,0,-0.122,0.078,-0.22);
        part(gun,C(0.011,0.011,0.030,8),accent,0,0.020,-0.135,Math.PI/2);
        part(gun,B(0.012,0.020,0.012),metal,0,0.048,-0.115);
        part(gun,B(0.014,0.016,0.010),metal,0,0.048,0.050);
        // 微型红点
        part(gun,B(0.026,0.012,0.040),accent,0,0.055,-0.020);
        part(gun,C(0.017,0.017,0.030,10),metal,0,0.070,-0.020,Math.PI/2);
        part(gun,C(0.014,0.014,0.004,10),glass,0,0.070,-0.036,Math.PI/2);
        part(gun,B(0.003,0.003,0.002),dotMat,0,0.070,-0.038);
        // 双手
        part(gun,B(0.052,0.070,0.080),glove,0.004,-0.062,0.062,-0.22);
        part(gun,B(0.048,0.060,0.060),glove,-0.024,-0.060,0.020,-0.10);
        part(gun,B(0.060,0.066,0.190),sleeve,0.045,-0.170,0.175,-0.58,0.20);
        part(gun,B(0.055,0.060,0.150),sleeve,-0.060,-0.165,0.100,-0.66,-0.28);
        weaponGroup.userData.adsOffset = {
            x: -gun.position.x,
            y: -(gun.position.y + 0.080 * gun.scale.y),
            z: -0.45 - (gun.position.z - 0.020 * gun.scale.z)
        };
        return;
    }

    // ---- 长枪通用尺寸 ----
    const receiverLen = isSMG?0.235:(isSniper?0.34:0.30);
    const handguardLen = isSMG?0.145:(isSniper?0.30:0.245);
    const barrelLen = isSniper?0.32:(isShotgun?0.30:0.17);
    const recZ = 0.02;
    const recFront = recZ - receiverLen/2;
    const hgCenter = recFront - handguardLen/2;
    const hgFront = recFront - handguardLen;
    const barrelCenter = hgFront - barrelLen/2;
    const muzzleZ = hgFront - barrelLen;

    // 机匣 / 上导轨 / 抛壳口
    part(gun,B(0.062,0.086,receiverLen),metal,0,0,recZ);
    part(gun,B(0.030,0.012,receiverLen+0.02),steel,0,0.049,recZ);
    part(gun,B(0.004,0.030,0.070),accent,0.032,0.012,recZ-0.02);
    part(gun,B(0.030,0.010,0.055),steel,0.033,0.036,recZ+0.01);

    // 护木 + M-LOK 槽
    part(gun,B(0.060,0.064,handguardLen),isShotgun?fde:fde,0,-0.002,hgCenter);
    part(gun,B(0.062,0.008,handguardLen*0.9),metal,0,0.030,hgCenter);
    for(let i=0;i<3;i++){
        part(gun,B(0.002,0.014,0.040),accent,0.031,-0.006,hgCenter+0.055-i*0.052);
        part(gun,B(0.002,0.014,0.040),accent,-0.031,-0.006,hgCenter+0.055-i*0.052);
    }
    // 枪管 / 消焰器 / 导气
    part(gun,C(0.0105,0.0105,barrelLen,10),steel,0,0.012,barrelCenter,Math.PI/2);
    part(gun,C(0.0165,0.0175,0.055,10),metal,0,0.012,muzzleZ-0.012,Math.PI/2);
    part(gun,B(0.030,0.028,0.030),metal,0,0.026,hgFront+0.02);
    if(isShotgun){
        // 泵动护木 + 弹管
        part(gun,B(0.068,0.070,0.150),fde,0,-0.010,hgCenter);
        for(let i=0;i<4;i++) part(gun,B(0.070,0.006,0.010),accent,0,-0.010,hgCenter+0.060-i*0.035);
        part(gun,C(0.012,0.012,0.26,10),metal,0,-0.036,barrelCenter,Math.PI/2);
    }

    // 枪托
    if(isSMG){
        part(gun,C(0.018,0.018,0.09,8),steel,0,0.006,recZ+receiverLen/2+0.04,Math.PI/2);
        part(gun,B(0.042,0.060,0.085),polymer,0,-0.002,recZ+receiverLen/2+0.105);
    }else if(isSniper){
        part(gun,B(0.048,0.070,0.230),fde,0,-0.006,recZ+receiverLen/2+0.10);
        part(gun,B(0.050,0.026,0.075),polymer,0,0.040,recZ+receiverLen/2+0.10);
        part(gun,B(0.050,0.030,0.050),polymer,0,-0.045,recZ+receiverLen/2+0.02);
    }else{
        part(gun,C(0.021,0.021,0.10,8),steel,0,0.004,recZ+receiverLen/2+0.05,Math.PI/2);
        part(gun,B(0.048,0.078,0.130),polymer,0,-0.008,recZ+receiverLen/2+0.14);
        part(gun,B(0.050,0.020,0.070),polymer,0,0.038,recZ+receiverLen/2+0.135);
    }

    // 握把 / 扳机护圈 / 弹匣
    part(gun,B(0.040,0.105,0.055),polymer,0,-0.086,recZ+0.075,-0.26);
    part(gun,B(0.036,0.012,0.075),metal,0,-0.058,recZ+0.012,0);
    part(gun,B(0.005,0.030,0.030),accent,0,-0.072,recZ+0.055,0.3);
    if(isHeavy){
        part(gun,C(0.070,0.070,0.055,14),metal,0,-0.105,recZ-0.030,Math.PI/2);
        part(gun,C(0.060,0.060,0.058,14),polymer,0,-0.105,recZ-0.030,Math.PI/2);
    }else if(isShotgun){
        // 管状弹仓，无弹匣
    }else{
        const magLen = isSniper?0.10:0.145;
        part(gun,B(0.036,magLen,0.072),isSniper?metal:polymer,0,-0.085,recZ-0.035,0.14);
        part(gun,B(0.038,0.012,0.076),metal,0,-0.085-magLen/2,recZ-0.045,0.14);
    }

    // 瞄具
    if(isSniper){
        part(gun,B(0.028,0.012,0.20),accent,0,0.060,-0.03);
        part(gun,C(0.034,0.034,0.24,14),metal,0,0.105,-0.03,Math.PI/2);
        part(gun,C(0.038,0.038,0.035,14),steel,0,0.105,-0.155,Math.PI/2);
        part(gun,C(0.030,0.030,0.004,14),glass,0,0.105,-0.174,Math.PI/2);
        part(gun,C(0.030,0.030,0.004,14),glass,0,0.105,0.094,Math.PI/2);
        // 调节旋钮
        part(gun,C(0.014,0.014,0.030,8),metal,0,0.138,-0.03,0);
        part(gun,C(0.014,0.014,0.030,8),metal,0.040,0.105,-0.03,Math.PI/2);
    }else if(isShotgun){
        part(gun,B(0.008,0.016,0.010),steel,0,0.052,muzzleZ+0.05);
        part(gun,B(0.026,0.010,0.014),metal,0,0.048,recZ+0.10);
    }else{
        // 红点（空心镜筒 + 前镜片 + 红点）
        part(gun,B(0.030,0.014,0.055),accent,0,0.060,-0.035);
        part(gun,new THREE.CylinderGeometry(0.020,0.020,0.042,14,1,true),metal,0,0.080,-0.035,Math.PI/2);
        part(gun,new THREE.TorusGeometry(0.020,0.0035,6,18),steel,0,0.080,-0.056);
        part(gun,new THREE.CylinderGeometry(0.016,0.016,0.002,14),glass,0,0.080,-0.055,Math.PI/2);
        part(gun,B(0.0075,0.0075,0.001),dotMat,0,0.080,-0.049);
        part(gun,B(0.020,0.026,0.010),metal,0,0.058,-0.285);
    }

    // 两脚架（狙击/重型）
    if(isSniper||isHeavy){
        for(const s of [-1,1]){
            const leg=part(gun,B(0.010,0.16,0.010),metal,s*0.030,-0.090,hgFront+0.10,0,0,s*0.28);
            leg.rotation.x=0.20;
        }
    }

    // 开镜对准：记录该武器瞄具在视模中的高度，ADS 时由 WeaponADS 读取
    const sightH = isSniper ? 0.105 : (isShotgun ? 0.052 : 0.080);
    weaponGroup.userData.adsOffset = {
        x: -gun.position.x,
        y: -(gun.position.y + sightH * gun.scale.y),
        z: -0.45 - (gun.position.z - 0.035 * gun.scale.z)
    };

    // ===== 双手与手臂 =====
    // 右手握把
    part(gun,B(0.054,0.076,0.088),glove,0.004,-0.078,recZ+0.086,-0.24);
    part(gun,B(0.070,0.062,0.180),sleeve,0.042,-0.245,recZ+0.225,-0.80,0.16);
    // 左手护木
    part(gun,B(0.058,0.058,0.110),glove,-0.004,-0.030,hgCenter+0.005,-0.06);
}

function createBulletTrail(from,to){const pts=[from,to];const geo=new THREE.BufferGeometry().setFromPoints(pts);const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xffcc44,transparent:true,opacity:0.6}));scene.add(line);bulletTrails.push({mesh:line,life:4});}
function createMuzzleFlash(pos){const f=new THREE.Mesh(new THREE.SphereGeometry(0.08,6,6),new THREE.MeshBasicMaterial({color:0xffcc00,transparent:true,opacity:1}));f.position.copy(pos);scene.add(f);particles.push({mesh:f,velocity:new THREE.Vector3(),life:3,maxLife:3,type:'flash'});}
function createHitEffect(pos,color,cnt){cnt=Math.min(cnt||4,CONFIG.maxParticles-particles.length);for(let i=0;i<cnt;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(0.04,4,4),new THREE.MeshBasicMaterial({color,transparent:true,opacity:1}));p.position.copy(pos);scene.add(p);particles.push({mesh:p,velocity:new THREE.Vector3((Math.random()-0.5)*0.2,Math.random()*0.2,(Math.random()-0.5)*0.2),life:15,maxLife:15,type:'hit'});}}

/**
 * 弹着点特效：世界空间法线 → 弹孔贴花 + 火花 + 尘烟 + 材质对应的击打声
 */
function spawnBulletImpact(hit){
    if(!hit) return;
    if(typeof WeaponFX==='undefined'||!WeaponFX.isReady()) return;
    const n=new THREE.Vector3(0,1,0);
    if(hit.face&&hit.face.normal){
        n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).normalize();
    }
    const surf=(hit.object.userData&&hit.object.userData.surface)||'concrete';
    WeaponFX.impact(hit.point,n,surf);
    if(typeof AudioEngine!=='undefined')AudioEngine.play('impact',{surface:surf});
}

// ========== SECTION 10: ENEMIES ==========
function spawnEnemies(){
    if (window.location.search.indexOf('test_models=1') > -1) {
        setTimeout(() => {
            const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, playerGroup.rotation.y, 0));
            const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, playerGroup.rotation.y, 0));
            const base = playerGroup.position.clone().add(forward.multiplyScalar(4));
            createEnemy(base.x - right.x * 1.5, base.z - right.z * 1.5, 1);
            createEnemy(base.x, base.z, 2);
            createEnemy(base.x + right.x * 1.5, base.z + right.z * 1.5, 3);
            console.log('TEST ENEMIES SPAWNED AT', base.x, base.z);
            if (typeof showFloatingMsg === 'function') showFloatingMsg('已生成测试敌人 Lv1/2/3');
        }, 1000);
    }
    const ec=CONFIG.enemyCount||{normal:7,hard:11};
    const c=S.mode==='hard'?ec.hard:ec.normal;
    S.enemiesTotal=c;
    S.enemiesSpawned=0;
    S._reinforceCounter=0;
    for(let i=0;i<c;i++)createEnemy();
}
function createEnemy(fx, fz, flv){
    const isHard = S.mode === 'hard';
    const maxE = isHard ? CONFIG.maxEnemiesHard : CONFIG.maxEnemies;
    if(enemies.length >= maxE) return;
    let x,z;const h2=CONFIG.mapSize/2-8;
    do{
        x=(Math.random()-0.5)*h2*2;z=(Math.random()-0.5)*h2*2;
    }while(
        Math.hypot(x-playerGroup.position.x,z-playerGroup.position.z)<22||
        isPointBlockedByMap(x,z,1)||
        FIXED_BUILDINGS.some(b=>{
            const hw=b.w/2+2,hd=b.d/2+2;
            return x>b.x-hw&&x<b.x+hw&&z>b.z-hd&&z<b.z+hd;
        })
    );
    let elv;
    if (flv !== undefined) {
        elv = flv;
    } else if (isHard) {
        elv = Math.random() < 0.40 ? 3 : Math.random() < 0.75 ? 2 : 1;
    } else {
        elv = Math.random() < 0.12 ? 2 : 1;
    }
    const grp=new THREE.Group();
const modelName = elv >= 3 ? 'RobotExpressive' : (elv === 2 ? 'Xbot' : 'Soldier');
if (!setupEnemyModel(grp, modelName)) {
    const m = new THREE.MeshStandardMaterial({color:0x8b4513});
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.42,1.1,12), m);
    b.position.y = 1.0; b.name = 'ph_placeholder'; grp.add(b);
    grp.userData.placeholder = true;
}
const headMarker = new THREE.Mesh(new THREE.SphereGeometry(0.25,8,8), new THREE.MeshBasicMaterial({visible:false}));
headMarker.position.y = 1.75; headMarker.name='head'; headMarker.userData.isHead=true; grp.add(headMarker);
// Invisible hitbox
    const hb=new THREE.Mesh(new THREE.SphereGeometry(0.9,8,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0}));hb.position.y=1.0;hb.name='hitbox';grp.add(hb);
    // Health bar
    const hbBg=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.08),new THREE.MeshBasicMaterial({color:0x333,side:THREE.DoubleSide}));hbBg.position.y=2.3;grp.add(hbBg);
    const hbFill=new THREE.Mesh(new THREE.PlaneGeometry(0.86,0.06),new THREE.MeshBasicMaterial({color:0x00ff00,side:THREE.DoubleSide}));hbFill.position.y=2.3;hbFill.position.z=0.01;hbFill.name='healthBar';grp.add(hbFill);
    grp.position.set(x,0,z);scene.add(grp);
    // Base stats by level
    let baseHP = 45 + elv * 15;
    let baseSpeed = elv === 3 ? 5 : elv === 2 ? 4.5 : 4;
    let baseDmg = elv === 3 ? 14 : elv === 2 ? 10 : 7;
    let baseRange = elv === 3 ? 22 : 18;
    let baseCd = elv === 3 ? 1.2 : 1.6;
    // Hard mode stat boosts: +40% HP, +50% DMG, +25% Speed, +25% Range, -20% AttackCd
    if (isHard) {
        baseHP = Math.round(baseHP * 1.4);
        baseDmg = Math.round(baseDmg * 1.5);
        baseSpeed = baseSpeed * 1.25;
        baseRange = Math.round(baseRange * 1.25);
        baseCd = baseCd * 0.8;
    }
    // 敌人类型决定行为模式
    let enemyType = 'scout';
    if (elv === 3) enemyType = Math.random() < 0.4 ? 'commander' : 'sniper';
    else if (elv === 2) enemyType = Math.random() < 0.5 ? 'rifleman' : 'rusher';
    const e={mesh:grp,health:baseHP,maxHealth:baseHP,speed:baseSpeed,damage:baseDmg,attackRange:baseRange,attackCd:baseCd,lastAttack:0,state:'patrol',patrolTarget:{x:x+(Math.random()-0.5)*30,z:z+(Math.random()-0.5)*30},alertTimer:0,lostSightTimer:0,enemyLevel:elv,lootGenerated:false,lootItems:[],
        // === AI增强属性 ===
        enemyType: enemyType,
        grenades: enemyType === 'rusher' ? 1 : (elv >= 2 ? 2 : 0),
        hitReactTimer: 0,
        isDying: false,
        deathTimer: 0,
        lastKnownPos: null,
        searchTimer: 0,
        burstCount: 0,
        burstTimer: 0,
        strafeDir: Math.random() < 0.5 ? 1 : -1,
        strafeTimer: 0,
        callReinforcementsCooldown: 0,
        meleeCooldown: 0,
    };
    enemies.push(e);enemyHitboxes.push(hb);hb.userData.enemy=e;
    S.enemiesSpawned=(S.enemiesSpawned||0)+1;
}

function updateEnemies(dt){
    for (const _e of enemies) {
        if (!_e.mesh || !_e.mesh.userData.mixer) continue;
        _e.mesh.userData.mixer.update(dt);
        const _pos = _e.mesh.position;
        let _spd = 0;
        if (_e._lastX !== undefined) _spd = Math.hypot(_pos.x - _e._lastX, _pos.z - _e._lastZ) / Math.max(dt, 0.0001);
        _e._lastX = _pos.x; _e._lastZ = _pos.z;
        let an = 'idle';
        const _st = _e.state;
        if (_st === 'attack' || _st === 'melee') {
            an = _spd > 0.4 ? 'walk' : 'idle';
        } else if (_spd > 3.5) {
            an = 'run';
        } else if (_spd > 0.4) {
            an = 'walk';
        }
        setEnemyAnim(_e.mesh, an);
        const _gun = _e.mesh.userData.gun, _hb = _e.mesh.userData.handBone;
        if (_gun && _hb) {
            _hb.getWorldPosition(_tmpGunVec);
            _e.mesh.worldToLocal(_tmpGunVec);
            _gun.position.copy(_tmpGunVec);
            _gun.rotation.set(0, 0, 0);
        }
    }
    const now=performance.now()/1000;
    // 更新手雷
    EnemyAI.updateGrenades(dt);
    for(let i=enemies.length-1;i>=0;i--){
        const e=enemies[i];
        // BOSS V2系统更新
        if (e.isBossV2 && typeof BossSystemV2 !== 'undefined') {
            BossSystemV2.updateBossV2(e, dt);
            // 更新BOSS战音乐音量
            if (typeof playerGroup !== 'undefined') {
                const bdx=playerGroup.position.x-e.mesh.position.x;
                const bdz=playerGroup.position.z-e.mesh.position.z;
                const bdist=Math.sqrt(bdx*bdx+bdz*bdz);
                BossSystemV2.updateBossMusicVolume(bdist);
            }
            continue; // BOSS V2使用独立AI，跳过原有AI
        }
        // 敌人 AI：enemy_ai.js 是硬依赖。
        // 历史上这里有一条「降级简单 AI」分支（typeof EnemyAI === 'undefined' 时启用），
        // 它每帧对每个敌人调用一次 hasLineOfSight()，没有任何节流 —— 正是 ADR-002 记录的那次
        // 「单帧 399ms / FPS 3」事故的完整复刻。一旦 enemy_ai.js 加载失败，它就会静默接管，
        // 玩家和开发者只会看到「怎么突然这么卡」，而不会想到是 AI 模块没加载。
        // 决策（团队拍板）：一个能跑但只有 3 FPS 的版本不是容错，是伪装成成功的失败。
        // 因此删除该分支，改为在 init() 中硬断言 + 可见错误层。见 assertCriticalModules()。
        EnemyAI.updateEnemyAI(e, dt, now);
    }
}

function enemyShoot(e){
    const o=new THREE.Vector3(e.mesh.position.x,1.4,e.mesh.position.z);
    const d=new THREE.Vector3(playerGroup.position.x-o.x,1.7-o.y,playerGroup.position.z-o.z).normalize();
    // Hard mode enemies are more accurate (less bullet spread)
    const spread = S.mode === 'hard' ? 0.04 : 0.08;
    d.x+=(Math.random()-0.5)*spread;d.y+=(Math.random()-0.5)*spread;d.normalize();
    const b=new THREE.Mesh(new THREE.SphereGeometry(0.05,4,4),new THREE.MeshBasicMaterial({color:0xff4444}));b.position.copy(o);scene.add(b);
    bulletTrails.push({mesh:b,life:40,isBullet:true,bulletData:{mesh:b,velocity:d.clone().multiplyScalar(1.5),life:40,pos:o.clone(),dir:d.clone(),damage:e.damage}});
}

function updateEnemyHealthBar(e){const hb=e.mesh.getObjectByName('healthBar');if(hb){const hp=Math.max(0,e.health/e.maxHealth);hb.scale.x=hp;hb.material.color.setHex(hp>0.5?0x00ff00:hp>0.2?0xffaa00:0xff0000);}}

// ====== Enemy Loot System ======
function generateEnemyLoot(e) {
    if (e.lootGenerated) return;
    const items = [];
    const lv = e.enemyLevel || 1;
    // Available weapon keys from WEAPONS
    const primaryGuns = ['mp5','pdw','p90','vector','machinePistol','compactSMG','smg','shotgun','combatShotgun','autoShotgun','heavyShotgun'];
    const secondaryGuns = ['pistol','compactPistol','hcPistol','revolver','autoPistol','burstPistol'];
    const highValueGuns = ['hk416','battleRifle','ak','dmr','marksman','sniper','antiMat','lmg','mmg','hmg'];
    const armorItems = ['tier1_armor','tier2_armor','tier3_armor','tier1_helmet','tier2_helmet','tier3_helmet'];
    const medItems = ['bandage','painkiller','medkit','tourniquet','adrenaline'];
    const commonLoot = ['cash','lighter','bolt','tape','battery','wire','lens'];
    const rareLoot = ['watch','phone','whiskey','circuit','perfume'];
    
    if (lv === 1) {
        // Scout - pistol + common loot
        const sw = secondaryGuns[Math.floor(Math.random() * secondaryGuns.length)];
        if (ITEMS[sw+'_item']) items.push({ id: sw+'_item', taken: false, slot: 'secondary' });
        const ammoCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < ammoCount; i++) items.push({ id: 'pistolAmmo', taken: false, slot: 'backpack' });
        for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) items.push({ id: commonLoot[Math.floor(Math.random() * commonLoot.length)], taken: false, slot: 'backpack' });
        items.push({ id: medItems[Math.floor(Math.random() * medItems.length)], taken: false, slot: 'backpack' });
        // Sometimes a basic helmet
        if (Math.random() < 0.3) items.push({ id: 'tier1_helmet', taken: false, slot: 'helmet' });
    } else if (lv === 2) {
        // Rifleman - SMG/shotgun + armor + medium loot
        const pw = primaryGuns[Math.floor(Math.random() * primaryGuns.length)];
        if (ITEMS[pw+'_item']) items.push({ id: pw+'_item', taken: false, slot: 'primary' });
        else items.push({ id: 'mp5_item', taken: false, slot: 'primary' });
        const sw = secondaryGuns[Math.floor(Math.random() * secondaryGuns.length)];
        if (ITEMS[sw+'_item']) items.push({ id: sw+'_item', taken: false, slot: 'secondary' });
        // Ammo
        const weaponDef = WEAPONS[pw];
        const ammoType = weaponDef ? weaponDef.ammo + 'Ammo' : 'rifleAmmo';
        const secAmmoType = 'pistolAmmo';
        if (ITEMS[ammoType]) for (let i = 0; i < 3; i++) items.push({ id: ammoType, taken: false, slot: 'backpack' });
        for (let i = 0; i < 2; i++) items.push({ id: secAmmoType, taken: false, slot: 'backpack' });
        // Armor
        if (Math.random() < 0.4) items.push({ id: armorItems[Math.floor(Math.random() * 3)], taken: false, slot: 'armor' });
        if (Math.random() < 0.3) items.push({ id: 'tier2_helmet', taken: false, slot: 'helmet' });
        // Loot
        for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
            items.push({ id: (Math.random() < 0.3 ? rareLoot : commonLoot)[Math.floor(Math.random() * ((Math.random() < 0.3 ? rareLoot : commonLoot).length))], taken: false, slot: 'backpack' });
        }
        items.push({ id: medItems[Math.floor(Math.random() * medItems.length)], taken: false, slot: 'backpack' });
        items.push({ id: medItems[Math.floor(Math.random() * medItems.length)], taken: false, slot: 'backpack' });
    } else {
        // Commander - high tier weapon + full gear
        const hw = highValueGuns[Math.floor(Math.random() * highValueGuns.length)];
        if (ITEMS[hw+'_item']) items.push({ id: hw+'_item', taken: false, slot: 'primary' });
        else items.push({ id: 'hk416_item', taken: false, slot: 'primary' });
        // Secondary (higher tier)
        const sw2 = ['deagle','magnum','revolver','hcPistol'][Math.floor(Math.random()*4)];
        if (ITEMS[sw2+'_item']) items.push({ id: sw2+'_item', taken: false, slot: 'secondary' });
        const hwDef = WEAPONS[hw];
        const ammoType = hwDef ? hwDef.ammo + 'Ammo' : 'rifleAmmo';
        if (ITEMS[ammoType]) for (let i = 0; i < 5; i++) items.push({ id: ammoType, taken: false, slot: 'backpack' });
        for (let i = 0; i < 4; i++) items.push({ id: 'pistolAmmo', taken: false, slot: 'backpack' });
        // Full armor
        items.push({ id: 'tier3_armor', taken: false, slot: 'armor' });
        if (Math.random() < 0.5) items.push({ id: 'tier3_helmet', taken: false, slot: 'helmet' });
        // High value loot
        for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
            items.push({ id: rareLoot[Math.floor(Math.random() * rareLoot.length)], taken: false, slot: 'backpack' });
        }
        items.push({ id: 'surgeryKit', taken: false, slot: 'backpack' });
        items.push({ id: 'adrenaline', taken: false, slot: 'backpack' });
        if (Math.random() < 0.2) items.push({ id: 'gpu', taken: false, slot: 'backpack' });
        if (Math.random() < 0.1) items.push({ id: 'diamond', taken: false, slot: 'backpack' });
    }
    e.lootItems = items;
    e.lootGenerated = true;
}

function spawnEnemyLootBox(x, z, lootItems, level) {
    const grp = new THREE.Group();
    // Box size and color based on level
    const size = 0.5 + level * 0.1;
    const colors = [0x5a3a2a, 0x6a4a3a, 0x8b1a1a];
    const glowColors = [0x886644, 0xaa8844, 0xff4444];
    const color = colors[Math.min(level - 1, colors.length - 1)] || 0x5a3a2a;
    const glowColor = glowColors[Math.min(level - 1, glowColors.length - 1)] || 0x886644;
    
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(size, size * 0.7, size),
        new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.3 })
    );
    body.position.y = size * 0.35;
    body.castShadow = body.receiveShadow = true;
    grp.add(body);
    
    // Level marker (more cones = higher level)
    for (let i = 0; i < level; i++) {
        const marker = new THREE.Mesh(
            new THREE.ConeGeometry(0.08, 0.15, 6),
            new THREE.MeshBasicMaterial({ color: 0xff4444 })
        );
        marker.position.set(-0.15 + i * 0.15, size * 0.75, 0);
        grp.add(marker);
    }
    // Glow ring
    const glow = new THREE.Mesh(
        new THREE.RingGeometry(size * 0.5, size * 0.75, 12),
        new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.2 + level * 0.1, side: THREE.DoubleSide })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.03;
    grp.add(glow);
    
    grp.position.set(x, 0, z);
    scene.add(grp);
    
    // Build container with player-style inventory layout
    var gridW = 4, gridH = Math.min(2 + level, 4);
    var grid = initGrid(gridH);
    // Equipment slots: helmet, armor, primary, secondary
    var equipmentSlots = {};
    var backpackItems = [];

    for (var li of (lootItems || [])) {
        var def = ITEMS[li.id];
        if (!def) continue;
        if (li.slot && li.slot !== 'backpack') {
            if (!equipmentSlots[li.slot]) {
                equipmentSlots[li.slot] = { id: li.id, taken: false };
            } else {
                backpackItems.push(li);
            }
        } else {
            backpackItems.push(li);
        }
    }
    // Place backpack items in grid
    for (var bi of backpackItems) {
        var slot = findFreeSlot(grid, gridW, gridH, bi.id);
        if (slot) placeInGrid(grid, gridW, bi.id, slot.col, slot.row);
    }

    const ci = grid._items || [];
    const items = ci.map(e => ({ ...ITEMS[e.id], type: e.id, taken: false, gridEntry: e }));
    const container = {
        mesh: grp, type: 'enemyLoot', name: '敌人物资盒', icon: '📦',
        x, z, items, grid, gridW, gridH,
        searchTime: 0.8, searched: false, isEnemyLoot: true,
        equipmentSlots: equipmentSlots,
        enemyLevel: level,
    };
    containers.push(container);
}

// ====== BOSS SYSTEM ======
const BOSS_TYPES = {
    'forest': {
        name: '森林猎手', meshColor: 0x4a3a2a, accentColor: 0xff6600,
        health: 800, damage: 18, speed: 3.5, attackRange: 22, attackCd: 1.5,
        weapon: 'hk416', icon: '💀',
    },
    'industrial': {
        name: '工业铁卫', meshColor: 0x3a3a4a, accentColor: 0x00ccff,
        health: 1200, damage: 25, speed: 2.8, attackRange: 25, attackCd: 1.8,
        weapon: 'lmg', icon: '🤖',
    },
    'military': {
        name: '军事指挥官', meshColor: 0x4a1a1a, accentColor: 0xff0000,
        health: 1800, damage: 32, speed: 3.0, attackRange: 28, attackCd: 2.0,
        weapon: 'mmg', icon: '🎖️',
    },
};

function createBoss(mapType, x, z) {
    var bt = BOSS_TYPES[mapType] || BOSS_TYPES['forest'];
    var grp = new THREE.Group();

    // Boss body - larger and more menacing
    var bodyMat = new THREE.MeshStandardMaterial({ color: bt.meshColor, roughness: 0.6, metalness: 0.4 });
    var accentMat = new THREE.MeshStandardMaterial({ color: bt.accentColor, roughness: 0.3, metalness: 0.6, emissive: bt.accentColor, emissiveIntensity: 0.3 });

    // Torso (larger)
    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 1.4, 12), bodyMat);
    torso.position.y = 1.1; torso.castShadow = true;
    grp.add(torso);

    // Head with accent
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), accentMat);
    head.position.y = 2.0; head.castShadow = true;
    head.userData.isHead = true;
    grp.add(head);

    // Shoulders/armor plates
    var lShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.4), accentMat);
    lShoulder.position.set(-0.5, 1.6, 0); grp.add(lShoulder);
    var rShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.4), accentMat);
    rShoulder.position.set(0.5, 1.6, 0); grp.add(rShoulder);

    // Arms
    var lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.8, 8), bodyMat);
    lArm.position.set(-0.55, 1.1, 0); grp.add(lArm);
    var rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.8, 8), bodyMat);
    rArm.position.set(0.55, 1.1, 0); grp.add(rArm);

    // Legs
    var lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.9, 8), bodyMat);
    lLeg.position.set(-0.2, 0.45, 0); grp.add(lLeg);
    var rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.9, 8), bodyMat);
    rLeg.position.set(0.2, 0.45, 0); grp.add(rLeg);

    // Weapon
    var weaponMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.7), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    weaponMesh.position.set(0.55, 1.0, 0.3); grp.add(weaponMesh);

    // Glowing eyes
    var eyeMat = new THREE.MeshBasicMaterial({ color: bt.accentColor });
    var lEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
    lEye.position.set(-0.1, 2.05, 0.25); grp.add(lEye);
    var rEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
    rEye.position.set(0.1, 2.05, 0.25); grp.add(rEye);

    // Boss indicator (floating marker above head)
    var indicatorGeo = new THREE.ConeGeometry(0.3, 0.5, 4);
    var indicatorMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
    var indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
    indicator.position.y = 3.0;
    indicator.name = 'bossIndicator';
    grp.add(indicator);

    // Boss health bar (3D)
    var hbBgGeo = new THREE.PlaneGeometry(1.5, 0.15);
    var hbBgMat = new THREE.MeshBasicMaterial({ color: 0x330000, transparent: true, opacity: 0.8 });
    var hbBg = new THREE.Mesh(hbBgGeo, hbBgMat);
    hbBg.position.y = 2.6; hbBg.name = 'bossHealthBar';
    grp.add(hbBg);

    var hbFillGeo = new THREE.PlaneGeometry(1.5, 0.12);
    var hbFillMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    var hbFill = new THREE.Mesh(hbFillGeo, hbFillMat);
    hbFill.position.set(0, 2.6, 0.01); hbFill.name = 'bossHealthFill';
    grp.add(hbFill);

    // Glow ring on ground
    var ringGeo = new THREE.RingGeometry(0.8, 1.2, 16);
    var ringMat = new THREE.MeshBasicMaterial({ color: bt.accentColor, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
    grp.add(ring);

    grp.position.set(x, 0, z);
    scene.add(grp);

    var boss = {
        mesh: grp,
        health: bt.health,
        maxHealth: bt.health,
        speed: bt.speed,
        damage: bt.damage,
        attackRange: bt.attackRange,
        attackCd: bt.attackCd,
        lastAttack: 0,
        state: 'patrol',
        patrolTarget: { x: x + (Math.random() - 0.5) * 20, z: z + (Math.random() - 0.5) * 20 },
        alertTimer: 0,
        lostSightTimer: 0,
        enemyLevel: 4,
        isBoss: true,
        bossName: bt.name,
        bossType: mapType,
        bossIcon: bt.icon,
        lootGenerated: false,
        lootItems: [],
        indicator: indicator,
        healthBarBg: hbBg,
        healthBarFill: hbFill,
    };

    // Hitbox (added as child of boss group so it follows boss movement)
    // Use transparent:opacity:0 (NOT visible:false) because material.visible=false causes Three.js raycaster to skip the mesh
    var hb = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 0.8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
    hb.position.set(0, 1.25, 0); hb.userData.enemy = boss;
    grp.add(hb);
    enemyHitboxes.push(hb);

    // Generate boss loot
    generateBossLoot(boss, mapType);
    bosses.push(boss);
    enemies.push(boss);
    // BOSS V2：显示顶部血条和播放音乐
    if (typeof BossSystemV2 !== 'undefined') {
        BossSystemV2.showBossHealthBar(boss);
    }
    return boss;
}

function generateBossLoot(boss, mapType) {
    var items = [];
    // Boss always drops high-tier equipment
    var weaponMap = { 'forest': 'hk416', 'industrial': 'lmg', 'military': 'mmg' };
    var weaponKey = weaponMap[mapType] || 'hk416';
    if (ITEMS[weaponKey + '_item']) items.push({ id: weaponKey + '_item', taken: false, slot: 'primary' });
    // Secondary weapon
    if (ITEMS['deagle_item']) items.push({ id: 'deagle_item', taken: false, slot: 'secondary' });
    // Full armor set (tier scales with boss type)
    var armorTierMap = { 'forest': 4, 'industrial': 5, 'military': 5 };
    var armorTierLevel = armorTierMap[mapType] || 4;
    items.push({ id: 'tier' + armorTierLevel + '_armor', taken: false, slot: 'armor' });
    items.push({ id: 'tier' + armorTierLevel + '_helmet', taken: false, slot: 'helmet' });
    // Military boss has a chance to drop T6 gear
    if (mapType === 'military' && Math.random() < 0.35) {
        items.push({ id: 'tier6_armor', taken: false, slot: 'backpack' });
    }
    if (mapType === 'military' && Math.random() < 0.25) {
        items.push({ id: 'tier6_helmet', taken: false, slot: 'backpack' });
    }

    // === Backpack loot: collectibles + keycards focused ===
    // Ammo (minimal: 3 primary + 2 pistol)
    var wDef = WEAPONS[weaponKey];
    var ammoType = wDef ? wDef.ammo + 'Ammo' : 'rifleAmmo';
    if (ITEMS[ammoType]) for (var i = 0; i < 3; i++) items.push({ id: ammoType, taken: false, slot: 'backpack' });
    for (var i = 0; i < 2; i++) items.push({ id: 'pistolAmmo', taken: false, slot: 'backpack' });

    // Med supplies (1 item only)
    var _medItems = ['medkit', 'surgeryKit', 'adrenaline'];
    items.push({ id: _medItems[Math.floor(Math.random() * _medItems.length)], taken: false, slot: 'backpack' });

    // === Collectibles by rarity tier ===
    if (typeof COLLECTIBLES_CONFIG !== 'undefined') {
        var _bossCIds = Object.keys(COLLECTIBLES_CONFIG);
        // Group by rarity
        var _byRarity = { common: [], rare: [], epic: [], legendary: [] };
        for (var _ci = 0; _ci < _bossCIds.length; _ci++) {
            var _cid = _bossCIds[_ci];
            var _r = COLLECTIBLES_CONFIG[_cid].rarity;
            if (_byRarity[_r]) _byRarity[_r].push(_cid);
        }
        // White collectibles (common): 2-3 items
        if (_byRarity.common.length > 0) {
            var _wcCount = 2 + (Math.random() < 0.5 ? 1 : 0);
            for (var _w = 0; _w < _wcCount; _w++) {
                items.push({ id: _byRarity.common[Math.floor(Math.random() * _byRarity.common.length)], taken: false, slot: 'backpack' });
            }
        }
        // Blue collectibles (rare): 2-3 items
        if (_byRarity.rare.length > 0) {
            var _bcCount = 2 + (Math.random() < 0.5 ? 1 : 0);
            for (var _b = 0; _b < _bcCount; _b++) {
                items.push({ id: _byRarity.rare[Math.floor(Math.random() * _byRarity.rare.length)], taken: false, slot: 'backpack' });
            }
        }
        // Purple collectibles (epic): 1-2 items, military boss gets +1
        if (_byRarity.epic.length > 0) {
            var _pcCount = 1 + (Math.random() < (mapType === 'military' ? 0.7 : 0.5) ? 1 : 0);
            for (var _p = 0; _p < _pcCount; _p++) {
                items.push({ id: _byRarity.epic[Math.floor(Math.random() * _byRarity.epic.length)], taken: false, slot: 'backpack' });
            }
        }
        // Gold collectibles (legendary): 1-2 items, military boss gets +1
        if (_byRarity.legendary.length > 0) {
            var _gcCount = 1 + (Math.random() < (mapType === 'military' ? 0.5 : 0.3) ? 1 : 0);
            for (var _g = 0; _g < _gcCount; _g++) {
                items.push({ id: _byRarity.legendary[Math.floor(Math.random() * _byRarity.legendary.length)], taken: false, slot: 'backpack' });
            }
        }
    }

    // Red collectibles (rare drop: 35% forest/industrial, 45% military)
    if (typeof RED_COLLECTIBLES_CONFIG !== 'undefined') {
        var _bossRcIds = Object.keys(RED_COLLECTIBLES_CONFIG);
        var _bossRcChance = mapType === 'military' ? 0.45 : 0.35;
        if (_bossRcIds.length > 0 && Math.random() < _bossRcChance) {
            var _bossRcId = _bossRcIds[Math.floor(Math.random() * _bossRcIds.length)];
            items.push({ id: _bossRcId, taken: false, slot: 'backpack' });
            if (mapType === 'military' && Math.random() < 0.2) {
                var _bossRcId2 = _bossRcIds[Math.floor(Math.random() * _bossRcIds.length)];
                items.push({ id: _bossRcId2, taken: false, slot: 'backpack' });
            }
        }
    }

    // Keycards (independent rolls for each tier)
    if (Math.random() < 0.35) items.push({ id: 'blueKeycard', taken: false, slot: 'backpack' });
    if (Math.random() < 0.22) items.push({ id: 'purpleKeycard', taken: false, slot: 'backpack' });
    if (Math.random() < 0.12) items.push({ id: 'goldKeycard', taken: false, slot: 'backpack' });
    if (Math.random() < 0.06) items.push({ id: 'redKeycard', taken: false, slot: 'backpack' });

    boss.lootItems = items;
    boss.lootGenerated = true;
}

function spawnBossLoot(e) {
    var grp = new THREE.Group();
    // Boss loot box - larger and golden
    var size = 1.0;
    var body = new THREE.Mesh(
        new THREE.BoxGeometry(size, size * 0.7, size),
        new THREE.MeshStandardMaterial({ color: 0x8b1a1a, roughness: 0.4, metalness: 0.5, emissive: 0x440000, emissiveIntensity: 0.2 })
    );
    body.position.y = size * 0.35; body.castShadow = true; body.receiveShadow = true;
    grp.add(body);

    // Golden glow ring
    var glow = new THREE.Mesh(
        new THREE.RingGeometry(size * 0.6, size * 0.9, 16),
        new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.03;
    grp.add(glow);

    // Skull marker
    var marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    marker.position.y = size * 0.8;
    grp.add(marker);

    grp.position.set(e.mesh.position.x, 0, e.mesh.position.z);
    scene.add(grp);

    // Build container with player-style inventory layout (5×5=25 slots for generous boss loot)
    var gridW = 5, gridH = 5;
    var grid = initGrid(gridH);
    // Equipment slots: helmet, armor, primary, secondary, chestRig, backpack
    var equipmentSlots = {};
    var backpackItems = [];

    for (var li of (e.lootItems || [])) {
        var def = ITEMS[li.id];
        if (!def) continue;
        if (li.slot && li.slot !== 'backpack') {
            // Equipment slot
            if (!equipmentSlots[li.slot]) {
                equipmentSlots[li.slot] = { id: li.id, taken: false };
            } else {
                // Duplicate equipment goes to backpack
                backpackItems.push(li);
            }
        } else {
            backpackItems.push(li);
        }
    }

    // Place backpack items in grid
    for (var bi of backpackItems) {
        var slot = findFreeSlot(grid, gridW, gridH, bi.id);
        if (slot) placeInGrid(grid, gridW, bi.id, slot.col, slot.row);
    }

    var ci = grid._items || [];
    var items = ci.map(function(ent) { return Object.assign({}, ITEMS[ent.id], { type: ent.id, taken: false, gridEntry: ent }); });

    var container = {
        mesh: grp, type: 'bossLoot', name: e.bossName + '的战利品', icon: '💀',
        x: e.mesh.position.x, z: e.mesh.position.z,
        items: items, grid: grid, gridW: gridW, gridH: gridH,
        searchTime: 1.5, searched: false, isEnemyLoot: true, isBossLoot: true,
        equipmentSlots: equipmentSlots,
        bossName: e.bossName,
    };
    containers.push(container);
}

function showBossKillNotification(e) {
    var div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:40%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);border:2px solid #ff0000;border-radius:8px;padding:15px 40px;color:#ff4444;font-size:20px;font-weight:bold;font-family:var(--font-heading);z-index:200;animation:bossKillIn 0.5s ease-out;text-align:center;letter-spacing:2px;';
    div.innerHTML = e.bossIcon + ' 击杀Boss: ' + e.bossName + '<br><span style="font-size:12px;color:#ff9800;">搜索掉落的战利品箱！</span>';
    document.body.appendChild(div);
    setTimeout(function() { if (div.parentNode) div.parentNode.removeChild(div); }, 3000);
}

function spawnBossTaskPoints(mapData) {
    // Spawn 1-2 task pickup points on the map
    var count = S.isHardMode ? 2 : 1;
    for (var i = 0; i < count; i++) {
        var x = (Math.random() - 0.5) * (CONFIG.mapSize - 20);
        var z = (Math.random() - 0.5) * (CONFIG.mapSize - 20);
        // Avoid water and buildings
        if (isNearObstacle(x, z, 5)) continue;

        var grp = new THREE.Group();
        // Task point marker - glowing pillar
        var pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.5, 3, 8),
            new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 })
        );
        pillar.position.y = 1.5;
        grp.add(pillar);

        // Ring on ground
        var ring = new THREE.Mesh(
            new THREE.RingGeometry(1.0, 1.5, 16),
            new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
        grp.add(ring);

        // Floating icon
        var iconGeo = new THREE.PlaneGeometry(0.8, 0.8);
        var iconMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        var icon = new THREE.Mesh(iconGeo, iconMat);
        icon.position.y = 3.5;
        grp.add(icon);

        grp.position.set(x, 0, z);
        scene.add(grp);

        bossTaskPoints.push({
            mesh: grp, x: x, z: z,
            mapType: S.currentMapType || 'forest',
            accepted: false,
            pillar: pillar, ring: ring,
        });
    }
}

function checkNearbyBossTaskPoints() {
    if (bossTaskPoints.length === 0) return;
    var px = playerGroup.position.x, pz = playerGroup.position.z;
    for (var tp of bossTaskPoints) {
        if (tp.accepted) continue;
        var dx = tp.x - px, dz = tp.z - pz;
        var dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 4) {
            var prompt = document.getElementById('searchPrompt');
            if (prompt && S.phase === 'playing') {
                setPromptBox('💀 Boss任务接取点', '[F] 接取Boss击杀任务', '#ff0000', '#ff4444');
                prompt.style.display = 'block';
                prompt._isBossTask = true;
                prompt._bossTaskPoint = tp;
            }
        }
    }
}

function acceptBossTask(tp) {
    if (!tp || tp.accepted) return;
    tp.accepted = true;
    // Change marker color to green
    tp.pillar.material.color.setHex(0x00ff00);
    tp.pillar.material.emissive.setHex(0x00ff00);
    tp.ring.material.color.setHex(0x00ff00);

    // Spawn boss near the task point
    var bx = tp.x + (Math.random() - 0.5) * 30;
    var bz = tp.z + (Math.random() - 0.5) * 30;
    // Clamp to map
    var halfMap = CONFIG.mapSize / 2 - 5;
    bx = Math.max(-halfMap, Math.min(halfMap, bx));
    bz = Math.max(-halfMap, Math.min(halfMap, bz));

    // 使用BOSS V2系统生成BOSS（带顶部全局血条）
    var bossV2Type = 'forest_hunter';
    if (tp.mapType === 'industrial') bossV2Type = 'industrial_juggernaut';
    else if (tp.mapType === 'military') bossV2Type = 'military_commander';

    if (typeof BossSystemV2 !== 'undefined') {
        BossSystemV2.createBossV2(bossV2Type, bx, bz);
    } else {
        createBoss(tp.mapType, bx, bz);
    }

    // Show notification
    var bossName = '未知BOSS';
    if (typeof BossSystemV2 !== 'undefined' && BossSystemV2.BOSS_CONFIG_V2) {
        var cfg = BossSystemV2.BOSS_CONFIG_V2[bossV2Type];
        if (cfg) bossName = (cfg.icon || '💀') + ' ' + cfg.name;
    } else {
        var bt = BOSS_TYPES[tp.mapType] || BOSS_TYPES['forest'];
        bossName = bt.icon + ' ' + bt.name;
    }
    var div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:35%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);border:2px solid #ff0000;border-radius:8px;padding:12px 30px;color:#ff4444;font-size:16px;font-weight:bold;font-family:var(--font-heading);z-index:200;animation:bossKillIn 0.3s ease-out;text-align:center;';
    div.innerHTML = bossName + ' 已出现!<br><span style="font-size:11px;color:#8b949e;">击杀Boss搜索高价值战利品！</span>';
    document.body.appendChild(div);
    setTimeout(function() { if (div.parentNode) div.parentNode.removeChild(div); }, 2500);
}

function isNearObstacle(x, z, radius) {
    for (var obs of obstacles) {
        var dx = x - (obs.x || 0), dz = z - (obs.z || 0);
        if (dx * dx + dz * dz < radius * radius) return true;
    }
    return false;
}

function updateBossIndicators() {
    // Animate boss indicators (floating up/down)
    var t = performance.now() / 1000;
    for (var b of bosses) {
        if (b.indicator) {
            b.indicator.position.y = 3.0 + Math.sin(t * 2) * 0.2;
            b.indicator.rotation.y = t * 1.5;
        }
        // Update boss health bar
        if (b.healthBarFill) {
            var pct = b.health / b.maxHealth;
            b.healthBarFill.scale.x = Math.max(0.01, pct);
            b.healthBarFill.position.x = -(1 - pct) * 0.75;
            // Color based on health
            if (pct > 0.5) b.healthBarFill.material.color.setHex(0xff4444);
            else if (pct > 0.25) b.healthBarFill.material.color.setHex(0xff8800);
            else b.healthBarFill.material.color.setHex(0xff0000);
        }
        // Billboard health bars toward camera
        if (b.healthBarBg) {
            b.healthBarBg.lookAt(camera.position);
            b.healthBarFill.lookAt(camera.position);
        }
    }
    // Animate task point pillars
    for (var tp of bossTaskPoints) {
        if (tp.pillar) {
            tp.pillar.position.y = 1.5 + Math.sin(t * 1.5) * 0.3;
            tp.pillar.rotation.y = t * 0.5;
        }
    }
}

// ========== AIRDROP SUPPLY EVENTS ==========
function updateAirdrops(dt){
    if(S.phase!=='playing')return;
    airdropTimer-=dt;
    if(airdropTimer<=0&&airDrops.length<2){
        triggerAirdrop();
        airdropTimer=120+Math.random()*120; // Next airdrop in 2-4 minutes
    }
    // Animate airdrop smoke and descent
    var t=performance.now()/1000;
    for(var i=airDrops.length-1;i>=0;i--){
        var ad=airDrops[i];
        if(ad.descending){
            ad.fallSpeed+=dt*2; // Gravity
            ad.mesh.position.y-=ad.fallSpeed*dt*8;
            if(ad.mesh.position.y<=0){
                ad.mesh.position.y=0;
                ad.descending=false;
                // Land notification
                showAirdropNotification('📦 空投已落地！前往拾取！');
            }
        }
        // Animate smoke
        if(ad.smoke){
            ad.smoke.rotation.y=t*0.5;
            ad.smoke.position.y=3+Math.sin(t*2)*0.3;
            ad.smoke.material.opacity=0.4+Math.sin(t*3)*0.1;
        }
        // Animate beacon light
        if(ad.beacon){
            ad.beacon.material.color.setHex(Math.sin(t*5)>0?0xff0000:0x660000);
        }
    }
}

function triggerAirdrop(){
    // Random position on map, away from obstacles
    var x,z,attempts=0;
    do{
        x=(Math.random()-0.5)*(CONFIG.mapSize-30);
        z=(Math.random()-0.5)*(CONFIG.mapSize-30);
        attempts++;
    }while(isNearObstacle(x,z,8)&&attempts<20);

    var grp=new THREE.Group();

    // Supply crate body
    var body=new THREE.Mesh(
        new THREE.BoxGeometry(1.2,1.0,1.2),
        new THREE.MeshStandardMaterial({color:0x2a4a2a,roughness:0.6,metalness:0.3})
    );
    body.position.y=0.5;body.castShadow=true;body.receiveShadow=true;
    grp.add(body);

    // Reinforced edges (gold accents)
    var edgeMat=new THREE.MeshStandardMaterial({color:0xffd700,roughness:0.3,metalness:0.8,emissive:0x886600,emissiveIntensity:0.2});
    var top=new THREE.Mesh(new THREE.BoxGeometry(1.3,0.1,1.3),edgeMat);
    top.position.y=1.05;grp.add(top);

    // Red smoke flare
    var smoke=new THREE.Mesh(
        new THREE.CylinderGeometry(0.15,0.4,5,8,1,true),
        new THREE.MeshBasicMaterial({color:0xff0000,transparent:true,opacity:0.4,side:THREE.DoubleSide})
    );
    smoke.position.y=3;grp.add(smoke);

    // Beacon light
    var beacon=new THREE.Mesh(
        new THREE.SphereGeometry(0.15,8,6),
        new THREE.MeshBasicMaterial({color:0xff0000})
    );
    beacon.position.y=1.2;grp.add(beacon);

    // Parachute (visible during descent)
    var parachute=new THREE.Mesh(
        new THREE.SphereGeometry(2,12,8,0,Math.PI*2,0,Math.PI/2),
        new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.6,side:THREE.DoubleSide})
    );
    parachute.position.y=4;parachute.visible=true;grp.add(parachute);

    grp.position.set(x,50,z); // Start high in the sky
    scene.add(grp);

    var drop={
        mesh:grp,x:x,z:z,
        descending:true,
        fallSpeed:2,
        smoke:smoke,
        beacon:beacon,
        parachute:parachute,
        looted:false,
    };
    airDrops.push(drop);
    showAirdropNotification('🚁 空投补给正在投放！查看地图标记！');

    // Remove parachute after landing
    setTimeout(function(){
        if(drop.parachute){drop.parachute.visible=false;}
    },8000);
}

function showAirdropNotification(msg){
    var div=document.createElement('div');
    div.style.cssText='position:fixed;top:15%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);border:2px solid #ffd700;border-radius:8px;padding:12px 30px;color:#ffd700;font-size:15px;font-weight:bold;font-family:var(--font-heading);z-index:200;animation:bossKillIn 0.3s ease-out;text-align:center;letter-spacing:1px;';
    div.textContent=msg;
    document.body.appendChild(div);
    setTimeout(function(){if(div.parentNode)div.parentNode.removeChild(div);},3500);
}

function checkNearbyAirdrops(){
    if(airDrops.length===0)return;
    var px=playerGroup.position.x,pz=playerGroup.position.z;
    for(var ad of airDrops){
        if(ad.looted||ad.descending)continue;
        var dx=ad.x-px,dz=ad.z-pz;
        var dist=Math.sqrt(dx*dx+dz*dz);
        if(dist<3){
            var prompt=document.getElementById('searchPrompt');
            if(prompt&&S.phase==='playing'){
                setPromptBox('📦 空投补给箱','[F] 搜索空投物资','#ffd700','#ffd700');
                prompt.style.display='block';
                prompt._isAirdrop=true;
                prompt._airdrop=ad;
            }
        }
    }
}

function searchAirdrop(ad){
    if(!ad||ad.looted)return;
    ad.looted=true;
    // Hide smoke and beacon
    if(ad.smoke)ad.smoke.visible=false;
    if(ad.beacon)ad.beacon.visible=false;
    // Change crate color to opened
    ad.mesh.children[0].material.color.setHex(0x1a3a1a);

    // Generate high-value loot
    var gridW=4,gridH=3;
    var grid=initGrid(gridH);
    var equipmentSlots={};

    // Airdrop loot table - high value items
    var possibleItems=[
        // Weapons (high tier)
        {id:'hk416_item',chance:0.3,slot:'primary'},
        {id:'ak_item',chance:0.3,slot:'primary'},
        {id:'sniper_item',chance:0.2,slot:'primary'},
        {id:'lmg_item',chance:0.25,slot:'primary'},
        {id:'mmg_item',chance:0.15,slot:'primary'},
        // Armor (high tier)
        {id:'tier3_armor',chance:0.5,slot:'armor'},
        {id:'tier3_helmet',chance:0.5,slot:'helmet'},
        {id:'tier4_armor',chance:0.3,slot:'armor'},
        {id:'tier4_helmet',chance:0.3,slot:'helmet'},
        // High-value valuables
        {id:'gpu',chance:0.4,slot:'backpack'},
        {id:'laptop',chance:0.3,slot:'backpack'},
        {id:'diamond',chance:0.3,slot:'backpack'},
        {id:'gold',chance:0.35,slot:'backpack'},
        {id:'circuit',chance:0.3,slot:'backpack'},
        {id:'ivory',chance:0.25,slot:'backpack'},
        {id:'relic',chance:0.15,slot:'backpack'},
        {id:'perfume',chance:0.3,slot:'backpack'},
        // Ammo
        {id:'rifleAmmo',chance:0.8,slot:'backpack'},
        {id:'rifleAmmo',chance:0.6,slot:'backpack'},
        {id:'sniperAmmo',chance:0.4,slot:'backpack'},
        {id:'heavyAmmo',chance:0.5,slot:'backpack'},
        // Medical
        {id:'surgeryKit',chance:0.4,slot:'backpack'},
        {id:'adrenaline',chance:0.5,slot:'backpack'},
        {id:'medkit',chance:0.6,slot:'backpack'},
        // Keycards (rare)
        {id:'purpleKeycard',chance:0.1,slot:'backpack'},
        {id:'goldKeycard',chance:0.05,slot:'backpack'},
        // Red collectibles (very rare) — old items
        {id:'red_ring',chance:0.08,slot:'backpack'},
        {id:'red_necklace',chance:0.06,slot:'backpack'},
        {id:'red_tiger',chance:0.05,slot:'backpack'},
        {id:'red_vase',chance:0.04,slot:'backpack'},
        {id:'red_lion',chance:0.03,slot:'backpack'},
        // Red collectibles — new rc_ items
        {id:'rc_caviar',chance:0.06,slot:'backpack'},
        {id:'rc_mechwatch',chance:0.05,slot:'backpack'},
        {id:'rc_labdata',chance:0.04,slot:'backpack'},
        {id:'rc_quantumstorage',chance:0.03,slot:'backpack'},
        {id:'rc_pureoriginium',chance:0.03,slot:'backpack'},
        {id:'rc_goldbar',chance:0.04,slot:'backpack'},
        {id:'rc_terminal',chance:0.03,slot:'backpack'},
        {id:'rc_drone',chance:0.02,slot:'backpack'},
        {id:'rc_goldcrocodile',chance:0.015,slot:'backpack'},
        {id:'rc_goldgazelle',chance:0.01,slot:'backpack'},
    ];
    // Dynamically add ALL red collectibles from config (value-based drop chances)
    if(typeof RED_COLLECTIBLES_CONFIG!=='undefined'){
        for(var _rcId in RED_COLLECTIBLES_CONFIG){
            // Skip items already hardcoded above to avoid duplicates
            if(possibleItems.some(function(p){return p.id===_rcId;})) continue;
            var _rcVal=RED_COLLECTIBLES_CONFIG[_rcId].value;
            var _rcChance;
            if(_rcVal<500000) _rcChance=0.06;        // 35万-50万: 6%
            else if(_rcVal<1000000) _rcChance=0.04;   // 50万-100万: 4%
            else if(_rcVal<2000000) _rcChance=0.025;  // 100万-200万: 2.5%
            else if(_rcVal<3500000) _rcChance=0.015;  // 200万-350万: 1.5%
            else if(_rcVal<5000000) _rcChance=0.008;  // 350万-500万: 0.8%
            else _rcChance=0.003;                      // 500万+: 0.3%
            possibleItems.push({id:_rcId,chance:_rcChance,slot:'backpack'});
        }
    }

    var lootItems=[];
    for(var li of possibleItems){
        if(Math.random()<li.chance && ITEMS[li.id]){
            lootItems.push({id:li.id,taken:false,slot:li.slot});
        }
    }
    // Always include at least one weapon and one high-value item
    if(!lootItems.some(function(l){return l.slot==='primary';})){
        var guns=['hk416_item','ak_item','sniper_item','lmg_item'];
        lootItems.push({id:guns[Math.floor(Math.random()*guns.length)],taken:false,slot:'primary'});
    }

    // Sort into equipment slots and backpack
    var backpackItems=[];
    for(var li of lootItems){
        if(li.slot&&li.slot!=='backpack'){
            if(!equipmentSlots[li.slot]){
                equipmentSlots[li.slot]={id:li.id,taken:false};
            }else{
                backpackItems.push(li);
            }
        }else{
            backpackItems.push(li);
        }
    }
    // Place backpack items in grid
    for(var bi of backpackItems){
        var slot=findFreeSlot(grid,gridW,gridH,bi.id);
        if(slot)placeInGrid(grid,gridW,bi.id,slot.col,slot.row);
    }

    var ci=grid._items||[];
    var items=ci.map(function(ent){return Object.assign({},ITEMS[ent.id],{type:ent.id,taken:false,gridEntry:ent});});

    var container={
        mesh:ad.mesh,type:'airdrop',name:'空投补给箱',icon:'📦',
        x:ad.x,z:ad.z,
        items:items,grid:grid,gridW:gridW,gridH:gridH,
        searchTime:2.0,searched:false,isEnemyLoot:true,isAirdrop:true,
        equipmentSlots:equipmentSlots,
    };
    containers.push(container);
    // Open search interface directly
    openSearch(container);
}

// ========== 经验与等级系统 ==========
const XP_PER_LEVEL = 1000; // 每级所需经验

function getPlayerLevel() {
    return Math.floor(((P.xp||0)/XP_PER_LEVEL)+1);
}

function getXPToNextLevel() {
    const level = getPlayerLevel();
    return level * XP_PER_LEVEL;
}

function getCurrentLevelXP() {
    return (P.xp||0) % XP_PER_LEVEL;
}

function gainXP(amount, reason) {
    if (!amount || amount <= 0) return;
    const oldLevel = getPlayerLevel();
    P.xp = (P.xp||0) + amount;
    const newLevel = getPlayerLevel();
    
    // 检测升级
    if (newLevel > oldLevel) {
        showLevelUpNotification(newLevel);
        // 升级奖励：每级奖励5000游戏币 + 1技能点
        P.money += 5000;
        P.skillPoints = (P.skillPoints || 0) + 1;
        trackMission('reach_level', newLevel);
        // 成就追踪
        trackAchievement('level', newLevel);
    }
    
    // 显示经验获取提示（可选）
    if (reason && S.phase === 'playing') {
        showFloatingMsg('+' + amount + ' XP (' + reason + ')');
    }
    
    savePersistent();
}

function showLevelUpNotification(level) {
    // 创建升级通知
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:30%;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,rgba(255,152,0,0.95),rgba(255,193,7,0.95));color:#fff;padding:20px 40px;border-radius:10px;font-size:24px;font-weight:bold;z-index:500;text-align:center;box-shadow:0 0 30px rgba(255,152,0,0.6);animation:levelUpAnim 2s ease-out forwards;pointer-events:none;';
    div.innerHTML = `
        <div style="font-size:14px;opacity:0.9;">等级提升</div>
        <div style="font-size:36px;margin:5px 0;">🎖️ 等级 ${level}</div>
        <div style="font-size:14px;opacity:0.9;">获得 ₵5,000 奖励</div>
    `;
    document.body.appendChild(div);
    setTimeout(() => { if (div.parentNode) div.remove(); }, 2000);
    
    // 播放升级音效
    try {
        if (typeof sfxSearchComplete === 'function') sfxSearchComplete();
    } catch(e) { reportInitError('levelUp:sfx', e); }
}

// ========== 成就系统 ==========
const ACHIEVEMENTS = {
    // 战斗类成就
    first_blood: { id:'first_blood', name:'首次击杀', desc:'击杀第一个敌人', target:1, type:'kills', reward:{money:1000, xp:50} },
    kill_10: { id:'kill_10', name:'小试牛刀', desc:'累计击杀10名敌人', target:10, type:'kills', reward:{money:5000, xp:100} },
    kill_50: { id:'kill_50', name:'战场老手', desc:'累计击杀50名敌人', target:50, type:'kills', reward:{money:20000, xp:300} },
    kill_100: { id:'kill_100', name:'杀戮机器', desc:'累计击杀100名敌人', target:100, type:'kills', reward:{money:50000, xp:500} },
    first_headshot: { id:'first_headshot', name:'精准一击', desc:'完成第一次爆头', target:1, type:'headshots', reward:{money:2000, xp:100} },
    headshot_50: { id:'headshot_50', name:'神枪手', desc:'累计完成50次爆头', target:50, type:'headshots', reward:{money:30000, xp:400} },
    first_boss: { id:'first_boss', name:'屠龙勇士', desc:'击杀第一个BOSS', target:1, type:'boss_kills', reward:{money:10000, xp:300} },
    boss_10: { id:'boss_10', name:'BOSS猎人', desc:'累计击杀10个BOSS', target:10, type:'boss_kills', reward:{money:100000, xp:1000} },
    // 探索类成就
    first_search: { id:'first_search', name:'初次探索', desc:'搜索第一个容器', target:1, type:'searches', reward:{money:500, xp:30} },
    search_50: { id:'search_50', name:'探索者', desc:'累计搜索50个容器', target:50, type:'searches', reward:{money:15000, xp:200} },
    search_200: { id:'search_200', name:'寻宝大师', desc:'累计搜索200个容器', target:200, type:'searches', reward:{money:50000, xp:500} },
    // 撤离类成就
    first_extract: { id:'first_extract', name:'成功撤离', desc:'第一次成功撤离', target:1, type:'extracts', reward:{money:3000, xp:150} },
    extract_10: { id:'extract_10', name:'生存专家', desc:'累计成功撤离10次', target:10, type:'extracts', reward:{money:30000, xp:400} },
    extract_value_100k: { id:'extract_value_100k', name:'小富翁', desc:'单次撤离带出价值₵100,000的物资', target:100000, type:'extract_value', reward:{money:20000, xp:300} },
    extract_value_1m: { id:'extract_value_1m', name:'百万富翁', desc:'单次撤离带出价值₵1,000,000的物资', target:1000000, type:'extract_value', reward:{money:100000, xp:800} },
    // 等级成就
    level_5: { id:'level_5', name:'初露锋芒', desc:'达到5级', target:5, type:'level', reward:{money:10000, xp:200} },
    level_10: { id:'level_10', name:'身经百战', desc:'达到10级', target:10, type:'level', reward:{money:30000, xp:500} },
    level_20: { id:'level_20', name:'战术大师', desc:'达到20级', target:20, type:'level', reward:{money:100000, xp:1000} },
};

function initAchievements() {
    if (!P.achievements) {
        P.achievements = {};
        for (const id in ACHIEVEMENTS) {
            P.achievements[id] = { progress:0, completed:false, claimed:false };
        }
    }
    // 确保新成就被初始化
    for (const id in ACHIEVEMENTS) {
        if (!P.achievements[id]) {
            P.achievements[id] = { progress:0, completed:false, claimed:false };
        }
    }
}

function trackAchievement(type, amount) {
    if (!P.achievements) initAchievements();
    for (const id in ACHIEVEMENTS) {
        const ach = ACHIEVEMENTS[id];
        const prog = P.achievements[id];
        if (ach.type === type && !prog.completed) {
            prog.progress = Math.min(ach.target, (prog.progress||0) + amount);
            if (prog.progress >= ach.target) {
                prog.completed = true;
                showAchievementUnlock(ach);
            }
        }
    }
}

function showAchievementUnlock(ach) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:80px;right:20px;background:linear-gradient(135deg,rgba(255,193,7,0.95),rgba(255,152,0,0.95));color:#fff;padding:15px 25px;border-radius:8px;font-size:14px;z-index:600;box-shadow:0 0 20px rgba(255,193,7,0.5);animation:achievementSlide 0.5s ease-out;pointer-events:none;max-width:280px;';
    div.innerHTML = `
        <div style="font-size:11px;opacity:0.9;">🏆 成就解锁</div>
        <div style="font-size:16px;font-weight:bold;margin:3px 0;">${ach.name}</div>
        <div style="font-size:11px;opacity:0.9;">${ach.desc}</div>
        <div style="font-size:10px;margin-top:5px;color:#fff3e0;">奖励: ₵${ach.reward.money.toLocaleString()} + ${ach.reward.xp}XP</div>
    `;
    document.body.appendChild(div);
    setTimeout(() => { if (div.parentNode) div.remove(); }, 4000);
    // 播放音效
    try { if (typeof sfxSearchComplete === 'function') sfxSearchComplete(); } catch(e) { reportInitError('toastSfx:sfxSearchComplete', e); }
}

function claimAchievement(id) {
    const ach = ACHIEVEMENTS[id];
    const prog = P.achievements[id];
    if (!ach || !prog || !prog.completed || prog.claimed) return false;
    P.money += ach.reward.money;
    gainXP(ach.reward.xp, '成就奖励');
    prog.claimed = true;
    savePersistent();
    return true;
}

// ========== 技能树系统 ==========
const SKILL_TREES = {
    combat: {
        name: '战斗',
        icon: '⚔️',
        color: '#f44336',
        skills: [
            { id: 'combat_1', name: '精准射手', desc: '开镜时精准度+10%', maxLevel: 3, cost: 1, effect: { adsAccuracy: 0.10 } },
            { id: 'combat_2', name: '快速换弹', desc: '换弹速度+15%', maxLevel: 3, cost: 1, effect: { reloadSpeed: 0.15 } },
            { id: 'combat_3', name: '后坐力控制', desc: '后坐力-10%', maxLevel: 3, cost: 1, effect: { recoilReduction: 0.10 } },
            { id: 'combat_4', name: '伤害提升', desc: '武器伤害+10%', maxLevel: 3, cost: 1, effect: { damageBoost: 0.10 } },
            { id: 'combat_5', name: '弹匣扩容', desc: '弹匣容量+20%', maxLevel: 3, cost: 1, effect: { magSize: 0.20 } },
            { id: 'combat_ultimate', name: '战神', desc: '所有战斗属性+20%（需解锁前5个技能）', maxLevel: 1, cost: 3, effect: { allCombat: 0.20 }, isUltimate: true }
        ]
    },
    survival: {
        name: '生存',
        icon: '🛡️',
        color: '#4caf50',
        skills: [
            { id: 'survival_1', name: '强健体魄', desc: '最大生命值+20', maxLevel: 3, cost: 1, effect: { maxHealth: 20 } },
            { id: 'survival_2', name: '快速恢复', desc: '生命值恢复速度+20%', maxLevel: 3, cost: 1, effect: { healthRegen: 0.20 } },
            { id: 'survival_3', name: '护甲大师', desc: '护甲耐久度+25%', maxLevel: 3, cost: 1, effect: { armorDurability: 0.25 } },
            { id: 'survival_4', name: '耐力提升', desc: '最大体力+20%', maxLevel: 3, cost: 1, effect: { maxStamina: 0.20 } },
            { id: 'survival_5', name: '负重强化', desc: '负重上限+10kg', maxLevel: 3, cost: 1, effect: { maxWeight: 10 } },
            { id: 'survival_ultimate', name: '不死之身', desc: '生命值低于20%时减伤50%（需解锁前5个技能）', maxLevel: 1, cost: 3, effect: { lowHealthDamageReduction: 0.50 }, isUltimate: true }
        ]
    },
    exploration: {
        name: '探索',
        icon: '🔍',
        color: '#2196f3',
        skills: [
            { id: 'exploration_1', name: '搜索专家', desc: '搜索速度+20%', maxLevel: 3, cost: 1, effect: { searchSpeed: 0.20 } },
            { id: 'exploration_2', name: '幸运儿', desc: '稀有物品掉落率+15%', maxLevel: 3, cost: 1, effect: { lootRarity: 0.15 } },
            { id: 'exploration_3', name: '背包大师', desc: '背包容量+2格', maxLevel: 3, cost: 1, effect: { backpackSlots: 2 } },
            { id: 'exploration_4', name: '快速移动', desc: '移动速度+10%', maxLevel: 3, cost: 1, effect: { moveSpeed: 0.10 } },
            { id: 'exploration_5', name: '静音步伐', desc: '移动时噪音-30%', maxLevel: 3, cost: 1, effect: { moveNoise: 0.30 } },
            { id: 'exploration_ultimate', name: '寻宝猎人', desc: '所有容器物品数量+1（需解锁前5个技能）', maxLevel: 1, cost: 3, effect: { extraLoot: 1 }, isUltimate: true }
        ]
    }
};

function initSkillTree() {
    if (!P.skillPoints) P.skillPoints = 0;
    if (!P.skills) {
        P.skills = {};
        for (const treeId in SKILL_TREES) {
            P.skills[treeId] = {};
            for (const skill of SKILL_TREES[treeId].skills) {
                P.skills[treeId][skill.id] = 0;
            }
        }
    }
    // 确保新技能被初始化
    for (const treeId in SKILL_TREES) {
        if (!P.skills[treeId]) P.skills[treeId] = {};
        for (const skill of SKILL_TREES[treeId].skills) {
            if (P.skills[treeId][skill.id] === undefined) {
                P.skills[treeId][skill.id] = 0;
            }
        }
    }
}

function getSkillLevel(treeId, skillId) {
    if (!P.skills || !P.skills[treeId]) return 0;
    return P.skills[treeId][skillId] || 0;
}

function getSkillEffect(treeId, skillId) {
    const tree = SKILL_TREES[treeId];
    if (!tree) return null;
    const skill = tree.skills.find(s => s.id === skillId);
    if (!skill) return null;
    const level = getSkillLevel(treeId, skillId);
    if (level === 0) return null;
    const result = {};
    for (const key in skill.effect) {
        result[key] = skill.effect[key] * level;
    }
    return result;
}

function getTotalSkillEffect(effectKey) {
    let total = 0;
    for (const treeId in SKILL_TREES) {
        for (const skill of SKILL_TREES[treeId].skills) {
            const level = getSkillLevel(treeId, skill.id);
            if (level > 0 && skill.effect[effectKey] !== undefined) {
                total += skill.effect[effectKey] * level;
            }
        }
    }
    return total;
}

function canUnlockSkill(treeId, skillId) {
    const tree = SKILL_TREES[treeId];
    if (!tree) return false;
    const skill = tree.skills.find(s => s.id === skillId);
    if (!skill) return false;
    const currentLevel = getSkillLevel(treeId, skillId);
    if (currentLevel >= skill.maxLevel) return false;
    if (P.skillPoints < skill.cost) return false;
    // 终极技能需要解锁前5个技能
    if (skill.isUltimate) {
        const normalSkills = tree.skills.filter(s => !s.isUltimate);
        const allMaxed = normalSkills.every(s => getSkillLevel(treeId, s.id) >= s.maxLevel);
        if (!allMaxed) return false;
    }
    return true;
}

function unlockSkill(treeId, skillId) {
    if (!canUnlockSkill(treeId, skillId)) return false;
    const tree = SKILL_TREES[treeId];
    const skill = tree.skills.find(s => s.id === skillId);
    P.skillPoints -= skill.cost;
    P.skills[treeId][skillId] = getSkillLevel(treeId, skillId) + 1;
    savePersistent();
    // 应用技能效果
    applySkillEffects();
    return true;
}

function applySkillEffects() {
    // 生命值上限
    const maxHealthBonus = getTotalSkillEffect('maxHealth');
    S.maxHealth = 100 + maxHealthBonus;
    // 体力上限
    const maxStaminaBonus = getTotalSkillEffect('maxStamina');
    CONFIG.maxStamina = 100 * (1 + maxStaminaBonus);
    // 负重上限
    const maxWeightBonus = getTotalSkillEffect('maxWeight');
    S.maxWeight = 70 + maxWeightBonus;
}

// 获取应用技能效果后的弹匣容量
function getEffectiveMagSize(weapon) {
    if (!weapon) return 0;
    let magSizeBonus = getTotalSkillEffect('magSize');
    magSizeBonus += getTotalSkillEffect('allCombat');
    return Math.floor(weapon.magSize * (1 + magSizeBonus));
}

// 获取玩家噪音减少比例（静音步伐技能）
function getPlayerNoiseReduction() {
    return getTotalSkillEffect('moveNoise');
}

// 获取应用技能效果后的背包列数（背包大师技能）
function getEffectiveBackpackCols(baseCols) {
    const slotsBonus = Math.floor(getTotalSkillEffect('backpackSlots'));
    return baseCols + slotsBonus;
}

function openSkillTreePanel() {
    if (typeof SkillTreeUI !== 'undefined') {
        SkillTreeUI.open();
    } else {
        // 简单的技能树面板
        showFloatingMsg('技能树系统开发中...');
    }
}

function killEnemy(e, headshot){
    // BOSS V2击杀特写
    if (e.isBossV2 && typeof BossSystemV2 !== 'undefined') {
        BossSystemV2.startBossKillCam(e);
        // BOSS扩展：结束BOSS战追踪
        if (typeof BossExtensions !== 'undefined') {
            BossExtensions.endBossFight(e.bossTypeV2, true);
            // 清理战场互动物体
            BossExtensions.clearBattleObjects();
        }
    }
    createHitEffect(new THREE.Vector3(e.mesh.position.x,1.3,e.mesh.position.z),0xff0000,10);
    sfxKillEnemy();
    // Generate and spawn enemy loot box
    if(!e.lootGenerated)generateEnemyLoot(e);
    if(e.isBoss){
        spawnBossLoot(e);
        trackMission('kill_boss',1);
        showBossKillNotification(e);
    }else{
        spawnEnemyLootBox(e.mesh.position.x, e.mesh.position.z, e.lootItems, e.enemyLevel);
    }
    // Stats
    S.kills++;P.stats.kills++;addKillFeed(headshot,e.enemyLevel);
    trackMission('kill_any', 1);
    // 经验获取
    let killXP = 10; // 普通敌人
    if (e.isBoss || e.isBossV2) killXP = 200; // BOSS
    else if ((e.enemyLevel||0) >= 2) killXP = 30; // 精英敌人
    if (headshot) killXP += 5; // 爆头额外奖励
    gainXP(killXP, headshot ? '爆头击杀' : '击杀');
    // 成就追踪
    trackAchievement('kills', 1);
    if (headshot) trackAchievement('headshots', 1);
    if (e.isBoss || e.isBossV2) trackAchievement('boss_kills', 1);
    // Weapon-specific kill tracking
    var wKey=S.weaponSlots[S.currentWeapon];
    if(wKey){
        var wDef=WEAPONS[wKey];
        if(wDef){
            if(wDef.ammo==='smg')trackMission('kill_with_smg',1);
            else if(wDef.ammo==='rifle')trackMission('kill_with_rifle',1);
            else if(wDef.ammo==='sniper')trackMission('kill_with_sniper',1);
            else if(wDef.ammo==='shotgun')trackMission('kill_with_shotgun',1);
        }
    }
    // Kill streak tracking
    S._killStreak=(S._killStreak||0)+1;
    S._killStreakTimer=performance.now()/1000;
    updateKillStreak();
    // Remove boss from boss list
    if(e.isBoss){var bi=bosses.indexOf(e);if(bi>=0)bosses.splice(bi,1);}
    // 立即从碰撞体移除，避免被再次击中
    const hi=enemyHitboxes.findIndex(h=>h.userData.enemy===e);if(hi>=0)enemyHitboxes.splice(hi,1);
    // 启动死亡动画，动画结束后再从场景移除
    if (typeof EnemyAI !== 'undefined') {
        EnemyAI.startDeathAnimation(e);
        // 延迟移除（死亡动画时长1.2秒）
        setTimeout(() => {
            const ei=enemies.indexOf(e);if(ei>=0)enemies.splice(ei,1);
            scene.remove(e.mesh);
        }, 1300);
    } else {
        const ei=enemies.indexOf(e);if(ei>=0)enemies.splice(ei,1);
        scene.remove(e.mesh);
    }
    if(!e.isBoss)setTimeout(()=>{if(S.phase==='playing')createEnemy();},5000+Math.random()*4000);
}
function updateKillStreak(){
    var ks=document.getElementById('killStreak');
    if(!ks)return;
    var streak=S._killStreak||0;
    if(streak>=2){
        ks.style.display='block';
        ks.textContent='🔥 '+streak+'连杀';
    }else{
        ks.style.display='none';
    }
}
function alertEnemies(pos,r){for(const e of enemies){const dx=e.mesh.position.x-pos.x,dz=e.mesh.position.z-pos.z;if(dx*dx+dz*dz<r*r){e.state='chase';e.alertTimer=3;}}}
// 子弹遮挡：解析射线 vs 碰撞体，替代对建筑窗户等上百子网格的递归 raycast
const _shotNormal = new THREE.Vector3();
const _identityMatrix = new THREE.Matrix4();
function raycastObstacles(origin, dir, maxDist) {
    let bestT = maxDist, best = null, bestNX = 0, bestNY = 0, bestNZ = 0;
    for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        if (!o || !o.mesh) continue;
        const mx = o.mesh.position.x, mz = o.mesh.position.z;
        if (o.isAABB && o.halfW && o.halfD) {
            const h = o.height == null ? (o.isWater ? 0.05 : 3) : o.height;
            let t0 = 0, t1 = bestT;
            let nx = 0, ny = 0, nz = 0;
            // X
            if (Math.abs(dir.x) < 1e-8) {
                if (origin.x < mx - o.halfW || origin.x > mx + o.halfW) continue;
            } else {
                let a = (mx - o.halfW - origin.x) / dir.x, b = (mx + o.halfW - origin.x) / dir.x;
                let sign = -1;
                if (a > b) { const t = a; a = b; b = t; sign = 1; }
                if (a > t0) { t0 = a; nx = sign; ny = 0; nz = 0; }
                if (b < t1) t1 = b;
                if (t0 > t1) continue;
            }
            // Y
            if (Math.abs(dir.y) < 1e-8) {
                if (origin.y < 0 || origin.y > h) continue;
            } else {
                let a = (0 - origin.y) / dir.y, b = (h - origin.y) / dir.y;
                let sign = -1;
                if (a > b) { const t = a; a = b; b = t; sign = 1; }
                if (a > t0) { t0 = a; nx = 0; ny = sign; nz = 0; }
                if (b < t1) t1 = b;
                if (t0 > t1) continue;
            }
            // Z
            if (Math.abs(dir.z) < 1e-8) {
                if (origin.z < mz - o.halfD || origin.z > mz + o.halfD) continue;
            } else {
                let a = (mz - o.halfD - origin.z) / dir.z, b = (mz + o.halfD - origin.z) / dir.z;
                let sign = -1;
                if (a > b) { const t = a; a = b; b = t; sign = 1; }
                if (a > t0) { t0 = a; nx = 0; ny = 0; nz = sign; }
                if (b < t1) t1 = b;
                if (t0 > t1) continue;
            }
            if (t0 > 0.02 && t0 < bestT) {
                bestT = t0; best = o; bestNX = nx; bestNY = ny; bestNZ = nz;
            }
        } else if (o.radius) {
            const h = o.height || 2;
            const fx = origin.x - mx, fz = origin.z - mz;
            const a = dir.x * dir.x + dir.z * dir.z;
            if (a < 1e-8) continue;
            const b = 2 * (fx * dir.x + fz * dir.z);
            const c = fx * fx + fz * fz - o.radius * o.radius;
            const disc = b * b - 4 * a * c;
            if (disc < 0) continue;
            const sq = Math.sqrt(disc);
            let t = (-b - sq) / (2 * a);
            if (t < 0.02) t = (-b + sq) / (2 * a);
            if (t < 0.02 || t >= bestT) continue;
            const hy = origin.y + dir.y * t;
            if (hy < 0 || hy > h) continue;
            const hx = origin.x + dir.x * t, hz = origin.z + dir.z * t;
            const nl = Math.sqrt((hx - mx) * (hx - mx) + (hz - mz) * (hz - mz)) || 1;
            bestT = t; best = o;
            bestNX = (hx - mx) / nl; bestNY = 0; bestNZ = (hz - mz) / nl;
        }
    }
    if (!best) return [];
    const point = origin.clone().addScaledVector(dir, bestT);
    let surface = best.surface;
    if (!surface) {
        const h = best.height || 3;
        surface = h >= 4 ? 'building' : (h >= 2 ? 'container' : 'concrete');
    }
    return [{
        distance: bestT,
        point: point,
        face: { normal: new THREE.Vector3(bestNX, bestNY, bestNZ) },
        object: { matrixWorld: _identityMatrix, userData: { surface: surface } },
    }];
}

// 视线检测：用碰撞体做解析几何求交，避免对建筑窗户等上百个子网格逐三角形射线检测。
// 旧实现每个敌人每帧递归 intersectObjects，单帧可达数百毫秒，是低帧率的主因。
function hasLineOfSight(enemy,tp){
    const ox=enemy.mesh.position.x, oz=enemy.mesh.position.z;
    const dx=tp.x-ox, dz=tp.z-oz;
    const len=Math.sqrt(dx*dx+dz*dz);
    if(len<0.001) return true;
    for(let i=0;i<obstacles.length;i++){
        const o=obstacles[i];
        if(!o||o.isWater||!o.mesh) continue;
        const h=o.height==null?3:o.height;
        if(h<1.15) continue; // 低矮掩体不遮挡站姿视线
        const mx=o.mesh.position.x, mz=o.mesh.position.z;
        if(o.isAABB&&o.halfW&&o.halfD){
            const hw=o.halfW, hd=o.halfD;
            let t0=0,t1=1;
            // X 轴 slab
            if(Math.abs(dx)<1e-6){
                if(ox<mx-hw||ox>mx+hw) continue;
            }else{
                let a=(mx-hw-ox)/dx, b=(mx+hw-ox)/dx;
                if(a>b){const t=a;a=b;b=t;}
                if(a>t0)t0=a; if(b<t1)t1=b;
                if(t0>t1) continue;
            }
            // Z 轴 slab
            if(Math.abs(dz)<1e-6){
                if(oz<mz-hd||oz>mz+hd) continue;
            }else{
                let a=(mz-hd-oz)/dz, b=(mz+hd-oz)/dz;
                if(a>b){const t=a;a=b;b=t;}
                if(a>t0)t0=a; if(b<t1)t1=b;
                if(t0>t1) continue;
            }
            if(t1>0.02&&t0<0.98) return false;
        }else if(o.radius){
            // 线段与圆求交
            const fx=ox-mx, fz=oz-mz;
            const a=dx*dx+dz*dz;
            const b=2*(fx*dx+fz*dz);
            const c=fx*fx+fz*fz-o.radius*o.radius;
            const disc=b*b-4*a*c;
            if(disc<0) continue;
            const sq=Math.sqrt(disc);
            const ta=(-b-sq)/(2*a), tb=(-b+sq)/(2*a);
            if(tb>0.02&&ta<0.98) return false;
        }
    }
    return true;
}

function updateEnemyBullets(){
    for(let i=bulletTrails.length-1;i>=0;i--){const bt=bulletTrails[i];if(!bt.isBullet)continue;bt.life--;const bd=bt.bulletData;bd.pos.add(bd.velocity);if(bt.mesh)bt.mesh.position.copy(bd.pos);
        const dx=bd.pos.x-playerGroup.position.x,dz=bd.pos.z-playerGroup.position.z,dy=bd.pos.y-1.7;
        if(dx*dx+dz*dz+dy*dy<0.7){damagePlayer(bd.damage, bd.pos.x, bd.pos.z);createHitEffect(bd.pos.clone(),0xff0000,3);scene.remove(bt.mesh);bulletTrails.splice(i,1);continue;}
        let ho=false;
        for(const o of obstacles){
            if(o.isAABB){
                const hw=o.halfW+0.3,hd=o.halfD+0.3;
                const ox=o.mesh.position.x,oz=o.mesh.position.z;
                if(bd.pos.x>ox-hw&&bd.pos.x<ox+hw&&bd.pos.z>oz-hd&&bd.pos.z<oz+hd){ho=true;break;}
            }else if(o.radius){
                const ox=bd.pos.x-o.mesh.position.x,oz=bd.pos.z-o.mesh.position.z;
                if(ox*ox+oz*oz<o.radius*o.radius){ho=true;break;}
            }
        }
        if(bt.life<=0||ho){if(bt.mesh)scene.remove(bt.mesh);bulletTrails.splice(i,1);}
    }
}

// ========== SECTION 11: CONTAINERS & LOOT ==========
const MIN_CONTAINER_DIST = 3.5; // Minimum distance between container centers

function spawnContainers(){
    const positions = [...FIXED_CONTAINERS];
    if (S.mode === 'hard') positions.push(...HARD_MODE_CONTAINERS);
    const placedPositions = [];
    const buildings = FIXED_BUILDINGS;
    const waterAreas = (MAP_DATA && MAP_DATA.waterAreas) || [];
    const mapHalf = ((CONFIG.mapSize || 180) / 2) - 5;

    // Helper: push point out of a single building, return true if moved
    function pushOutOfBuilding(px, pz, b) {
        const bx=b.x, bz=b.z, hw=b.w/2, hd=b.d/2;
        if (!(px>bx-hw-1 && px<bx+hw+1 && pz>bz-hd-1 && pz<bz+hd+1)) return null;
        const dL=px-(bx-hw), dR=(bx+hw)-px, dT=pz-(bz-hd), dB=(bz+hd)-pz;
        const mH=Math.min(dL,dR), mV=Math.min(dT,dB);
        if (mH<mV) return {x:(dL<dR)?(bx-hw-3):(bx+hw+3), z:pz};
        return {x:px, z:(dT<dB)?(bz-hd-3):(bz+hd+3)};
    }
    // Helper: push point out of water
    function pushOutOfWater(px, pz, w) {
        if (!(px>w.x-w.w/2 && px<w.x+w.w/2 && pz>w.z-w.d/2 && pz<w.z+w.d/2)) return null;
        const dx=px-w.x, dz=pz-w.z;
        if (Math.abs(dx)/w.w > Math.abs(dz)/w.d) return {x:w.x+(dx>0?1:-1)*(w.w/2+3), z:pz};
        return {x:px, z:w.z+(dz>0?1:-1)*(w.d/2+3)};
    }
    // Helper: check if point is inside any building
    function inAnyBuilding(px, pz) {
        for (const b of buildings) {
            if (px>b.x-b.w/2-1 && px<b.x+b.w/2+1 && pz>b.z-b.d/2-1 && pz<b.z+b.d/2+1) return true;
        }
        return false;
    }

    for (const pos of positions) {
        let cx=pos.x, cz=pos.z;

        // Phase 1: Iteratively push out of buildings (up to 20 rounds)
        for (let iter=0; iter<20; iter++) {
            let moved = false;
            for (const b of buildings) {
                const np = pushOutOfBuilding(cx, cz, b);
                if (np) { cx=np.x; cz=np.z; moved=true; break; }
            }
            if (!moved) break;
        }
        // Phase 2: Iteratively push out of water (up to 10 rounds)
        for (let iter=0; iter<10; iter++) {
            let moved = false;
            for (const w of waterAreas) {
                const np = pushOutOfWater(cx, cz, w);
                if (np) { cx=np.x; cz=np.z; moved=true; break; }
            }
            if (!moved) break;
        }
        // Phase 3: Re-check buildings after water push
        for (let iter=0; iter<10; iter++) {
            let moved = false;
            for (const b of buildings) {
                const np = pushOutOfBuilding(cx, cz, b);
                if (np) { cx=np.x; cz=np.z; moved=true; break; }
            }
            if (!moved) break;
        }
        // Phase 4: Resolve overlaps with already-placed containers
        for (let iter=0; iter<10; iter++) {
            let adjusted = false;
            for (const pp of placedPositions) {
                const dx=cx-pp.x, dz=cz-pp.z;
                if (Math.abs(dx)<MIN_CONTAINER_DIST && Math.abs(dz)<MIN_CONTAINER_DIST) {
                    const dist=Math.sqrt(dx*dx+dz*dz);
                    if (dist<0.01) { cx+=MIN_CONTAINER_DIST; }
                    else {
                        const pushDist=MIN_CONTAINER_DIST-dist+0.5;
                        cx+=dx/dist*pushDist; cz+=dz/dist*pushDist;
                    }
                    adjusted=true;
                }
            }
            if (!adjusted) break;
        }
        // Phase 5: Final validation - spiral search if still stuck
        if (inAnyBuilding(cx, cz) || isPointBlockedByMap(cx, cz, 1)) {
            outer: for (let r=5; r<60; r+=3) {
                for (let angle=0; angle<360; angle+=30) {
                    const rad=angle*Math.PI/180;
                    const tx=Math.round(pos.x+Math.cos(rad)*r);
                    const tz=Math.round(pos.z+Math.sin(rad)*r);
                    if (!inAnyBuilding(tx, tz) && !isPointBlockedByMap(tx, tz, 1)) {
                        cx=tx; cz=tz;
                        break outer;
                    }
                }
            }
        }
        // Clamp to map bounds
        cx = Math.max(-mapHalf, Math.min(mapHalf, cx));
        cz = Math.max(-mapHalf, Math.min(mapHalf, cz));

        placedPositions.push({x:cx, z:cz});
        createContainer(pos.type, cx, cz);
    }
}

function createContainer(type, x, z){
    const def = CONTAINER_TYPES[type];
    // 惰性建组：保证「所有容器在同一个父节点下」，合批才有统一入口。
    if (!containerGroup && typeof scene !== 'undefined' && scene) {
        containerGroup = new THREE.Group();
        containerGroup.name = 'containerGroup';
        scene.add(containerGroup);
    }
    const grp = new THREE.Group();

    // Different 3D models based on container shape
    const shape = def.shape || 'crate';

    if (shape === 'long') {
        // Weapon box: long rectangular military crate (green)
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.9), _cMat(def.color, {roughness:0.6, metalness:0.2}));
        body.position.y=0.3; body.castShadow=body.receiveShadow=true; grp.add(body);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.1, 0.95), _cMat(0x2a4a2a, {roughness:0.5}));
        lid.position.y=0.65; grp.add(lid);
        // Ammo marking stripe
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 0.1), _cBasic(0xffcc00));
        stripe.position.set(0, 0.61, 0.45); grp.add(stripe);
        // Latches
        for (let lx of [-0.7, 0, 0.7]) {
            const latch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.08), _cMat(0x999999, {metalness:0.8}));
            latch.position.set(lx, 0.62, 0.47); grp.add(latch);
        }
    } else if (shape === 'cube') {
        // Medical box: white cube with red cross
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.9), _cMat(def.color, {roughness:0.4, metalness:0.1}));
        body.position.y=0.45; body.castShadow=body.receiveShadow=true; grp.add(body);
        // Red cross on top
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 0.7), _cBasic(0xff0000));
        crossH.position.set(0, 0.91, 0); grp.add(crossH);
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.25), _cBasic(0xff0000));
        crossV.position.set(0, 0.91, 0); grp.add(crossV);
        // Handle
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), _cMat(0xcccccc, {metalness:0.6}));
        handle.rotation.x = Math.PI/2; handle.position.set(0, 0.92, 0); grp.add(handle);
    } else if (shape === 'tall') {
        // Equipment case: dark gray tall Pelican-style case
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.7), _cMat(def.color, {roughness:0.3, metalness:0.5}));
        body.position.y=0.55; body.castShadow=body.receiveShadow=true; grp.add(body);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.72), _cMat(0x222222, {metalness:0.7}));
        trim.position.y=0.02; grp.add(trim);
        // Corner protectors
        for (let cx of [-0.42, 0.42]) { for (let cz of [-0.32, 0.32]) {
            const cp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), _cMat(0x333333, {metalness:0.8}));
            cp.position.set(cx, 0.04, cz); grp.add(cp);
        }}
    } else if (shape === 'safe') {
        // Safe/lockbox: small metal box with gold trim (high value indicator)
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), _cMat(0x3a3a3a, {roughness:0.2, metalness:0.8}));
        body.position.y=0.35; body.castShadow=true; grp.add(body);
        // Gold trim
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, 0.75), _cMat(0xffd700, {roughness:0.3, metalness:0.9, emissive:0x332200, emissiveIntensity:0.3}));
        trim.position.y=0.04; grp.add(trim);
        // Dial
        const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16), _cMat(0xffd700, {metalness:0.9}));
        dial.position.set(0.25, 0.35, 0.35); grp.add(dial);
        // Keyhole
        const keyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8), _cBasic(0x111111));
        keyhole.position.set(0, 0.35, 0.35); grp.add(keyhole);
    } else if (shape === 'small') {
        // Ammo box: small red/brown metal box
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), _cMat(def.color, {roughness:0.5, metalness:0.4}));
        body.position.y=0.25; body.castShadow=body.receiveShadow=true; grp.add(body);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.08, 0.64), _cMat(0x4a2020, {roughness:0.3, metalness:0.5}));
        lid.position.y=0.53; grp.add(lid);
    } else if (shape === 'premium') {
        // Premium box: glowing gold crate
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.0), _cMat(0x4a3a1a, {roughness:0.3, metalness:0.6}));
        body.position.y=0.5; body.castShadow=true; grp.add(body);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.12, 1.04), _cMat(0xffd700, {roughness:0.2, metalness:0.9, emissive:0x332200, emissiveIntensity:0.4}));
        lid.position.y=1.04; grp.add(lid);
        // Corner gems
        for (let gx of [-0.55, 0.55]) { for (let gz of [-0.35, 0.35]) {
            const gem = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), _cBasic(0xff4444));
            gem.position.set(gx, 0.52, gz); grp.add(gem);
        }}
    } else {
        // Supply crate: standard wooden crate
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), _cMat(def.color, {roughness:0.7, metalness:0.1}));
        body.position.y=0.45; body.castShadow=body.receiveShadow=true; grp.add(body);
        // Wood plank lines
        for (let py of [0.3, 0.45, 0.6]) {
            const plank = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.02, 0.82), _cMat(0x6a4a14, {roughness:0.6}));
            plank.position.y=py; grp.add(plank);
        }
    }

    // 地表价值光圈：颜色表示价值档位。
    // 原来是每个容器一个透明 RingGeometry，透明物体不参与 batchStatic，
    // 于是 170 个光圈就是 170 次 draw call —— 单独合批时它们才是最大的漏网项。
    // 这里改成只登记位置，等容器全部生成完再一次性做成 3 个 InstancedMesh。
    const glowColor = (shape === 'safe' || shape === 'premium') ? 0xffd700 : (shape === 'tall' || shape === 'long') ? 0x4a90d9 : 0x888888;
    const glowOpacity = 0.3 + (shape === 'premium' ? 0.2 : 0) + (shape === 'safe' ? 0.15 : 0);
    _containerGlow.push({ x: x, z: z, color: glowColor, opacity: glowOpacity });

    grp.position.set(x, 0, z);
    (containerGroup || scene).add(grp);

    // 技能效果：额外物品（寻宝猎人）+ 稀有物品概率提升（幸运儿）
    let extraLootBonus = Math.floor(getTotalSkillEffect('extraLoot'));
    let lootRarityBonus = getTotalSkillEffect('lootRarity');
    
    const cnt = def.min + Math.floor(Math.random()*(def.max-def.min+1)) + extraLootBonus;
    const containerGrid = initGrid(def.h||3);
    for (let i=0; i<cnt; i++) {
        // 幸运儿效果：增加稀有物品选择概率
        let it;
        if (lootRarityBonus > 0 && Math.random() < lootRarityBonus) {
            // 优先选择高价值物品（按value排序）
            const sortedItems = [...def.items].sort((a, b) => (ITEMS[b]?.value || 0) - (ITEMS[a]?.value || 0));
            const topCount = Math.max(1, Math.ceil(sortedItems.length * 0.3));
            it = sortedItems[Math.floor(Math.random() * topCount)];
        } else {
            it = def.items[Math.floor(Math.random()*def.items.length)];
        }
        const slot = findFreeSlot(containerGrid, def.w||5, def.h||3, it);
        if (slot) placeInGrid(containerGrid, def.w||5, it, slot.col, slot.row);
    }
    // FIX-05 / FIX-06：常规物品抽完后，再各自掷一次稀有出货。
    // 放在这里（而不是池子里塞条目）是本次平衡修复的核心：
    // 稀有物的出现概率从此与池子大小无关，改常规池配比不会再连带改变稀有产出。
    _rollContainerRare(def, containerGrid, type);
    const ci = containerGrid._items || [];
    const items = ci.map(e => ({...ITEMS[e.id], type:e.id, taken:false, gridEntry:e}));

    containers.push({mesh:grp, type, name:def.name, icon:def.icon, x, z, items, grid:containerGrid, gridW:def.w||5, gridH:def.h||3, searchTime:def.searchTime||1.5, searched:false});
}

// ========== 容器合批 ==========

/**
 * 把所有待建光圈做成 InstancedMesh。
 *
 * 为什么单独处理：光圈是透明的，WorldPolish.batchStatic 明确跳过透明材质
 * （避免打乱混合顺序）。如果不管它，170 个光圈就是 170 次 draw call，
 * 能把刚合批省下的收益吃掉四分之一。
 *
 * 分组键必须带 opacity —— 同一组 InstancedMesh 共用一个材质，opacity 是材质级参数。
 * 只按颜色分组会让「高级箱（0.5）」和「保险箱（0.45）」被迫取同一个透明度。
 */
function _buildContainerGlow() {
    if (!_containerGlow.length || !containerGroup) return 0;
    const groups = new Map();
    for (const g of _containerGlow) {
        const k = g.color + '|' + g.opacity.toFixed(2);
        if (!groups.has(k)) groups.set(k, { color: g.color, opacity: g.opacity, pts: [] });
        groups.get(k).pts.push(g);
    }
    // 共享几何：所有光圈都是同一个 RingGeometry(0.6,0.9,16)
    const ring = new THREE.RingGeometry(0.6, 0.9, 16);
    const mtx = new THREE.Matrix4();
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const pos = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    let made = 0;
    groups.forEach(function (grp) {
        const mat = new THREE.MeshBasicMaterial({
            color: grp.color, transparent: true, opacity: grp.opacity,
            side: THREE.DoubleSide, depthWrite: false,
        });
        const inst = new THREE.InstancedMesh(ring, mat, grp.pts.length);
        for (let i = 0; i < grp.pts.length; i++) {
            pos.set(grp.pts[i].x, 0.03, grp.pts[i].z);
            mtx.compose(pos, quat, one);
            inst.setMatrixAt(i, mtx);
        }
        inst.instanceMatrix.needsUpdate = true;
        inst.userData.isContainerGlow = true;
        // 必须关掉视锥剔除：InstancedMesh 的包围球按「单个几何」算，
        // 光圈散布在全图，按原点包围球裁会整批消失（只在看向地图中心时才出现）。
        inst.frustumCulled = false;
        containerGroup.add(inst);
        made++;
    });
    // 消费掉，避免下一次运行时重复生成同一批
    _containerGlow.length = 0;
    return made;
}

/**
 * 容器生成收尾：建光圈 + 合批。
 *
 * 可重复调用：钥匙房是玩家中途解锁的，解锁时会补 3 个容器进来。
 * batchStatic 会跳过已合批（isBatchedStatic）和已被隐藏的原始网格，
 * 所以第二次调用只会合并新增的那几个，不会把整批重做一遍。
 */
function finalizeContainerBatching() {
    if (!containerGroup || !containers.length) return { before: 0, after: 0, glow: 0 };
    const glow = _buildContainerGlow();
    let res = { before: 0, after: 0, merged: 0 };
    if (typeof WorldPolish !== 'undefined' && WorldPolish.batchStatic) {
        res = WorldPolish.batchStatic(containerGroup) || res;
    }
    if (typeof console !== 'undefined' && console.debug) {
        console.debug('[containers] 合批 ' + (res.before || 0) + ' → ' + (res.after || 0) + '，光圈实例 ' + glow + ' 组');
    }
    return { before: res.before || 0, after: res.after || 0, glow: glow };
}

/**
 * 重开一局时清空容器。
 *
 * 必须连 containerGroup 的子节点一起清：合批产出的合并网格不是任何 container.mesh
 * 的子孙，只按 containers 数组删会留下一整张「上一局的箱子」。
 */
function clearContainers() {
    if (containerGroup) {
        while (containerGroup.children.length) {
            const o = containerGroup.children[0];
            containerGroup.remove(o);
            o.traverse(function (n) { if (n.geometry && n.geometry.dispose) n.geometry.dispose(); });
        }
    } else {
        for (const c of containers) { if (c.mesh && c.mesh.parent) c.mesh.parent.remove(c.mesh); }
    }
    containers.length = 0;
    _containerGlow.length = 0;
}


// ========== Key Building System ==========
function initKeyBuildings() {
    keyBuildingsState = [];
    const buildings = (MAP_DATA && MAP_DATA.buildings) || [];
    for (const b of buildings) {
        if (b.keyType) {
            keyBuildingsState.push({
                x: b.x, z: b.z, w: b.w, d: b.d, h: b.h, color: b.color,
                keyType: b.keyType, name: b.name, unlocked: false, mesh: null, lockMesh: null
            });
        }
    }
}

function getKeycardRarityColor(keyType) {
    if (keyType === 'blueKeycard') return 0x2196f3;
    if (keyType === 'purpleKeycard') return 0x9c27b0;
    if (keyType === 'goldKeycard') return 0xff9800;
    if (keyType === 'redKeycard') return 0xf44336;
    return 0x888888;
}

function checkNearbyKeyBuildings() {
    let nearest = null, nd = 6 * 6; // 6 units from building edge
    for (const kb of keyBuildingsState) {
        if (kb.unlocked) continue;
        const dx = playerGroup.position.x - kb.x;
        const dz = playerGroup.position.z - kb.z;
        // Distance to building edge (not center) - accounts for building size
        const edgeDx = Math.max(Math.abs(dx) - kb.w / 2, 0);
        const edgeDz = Math.max(Math.abs(dz) - kb.d / 2, 0);
        const d = edgeDx * edgeDx + edgeDz * edgeDz;
        if (d < nd) { nd = d; nearest = kb; }
    }
    nearbyKeyBuilding = nearest;
    const prompt = document.getElementById('keyBuildingPrompt');
    if (prompt) {
        // Hide key building prompt if a container is nearby (container takes priority)
        let containerNearby = false;
        for (const c of containers) {
            const cdx = playerGroup.position.x - c.x, cdz = playerGroup.position.z - c.z;
            if (cdx * cdx + cdz * cdz < 2.8 * 2.8) { containerNearby = true; break; }
        }
        if (nearest && !containerNearby) {
            const keyDef = ITEMS[nearest.keyType];
            prompt.style.display = 'block';
            document.getElementById('kbPromptTitle').textContent = nearest.name + ' (锁定)';
            document.getElementById('kbPromptHint').textContent = '需要 ' + (keyDef ? keyDef.name : '钥匙卡') + '  [F] 开锁';
        } else {
            prompt.style.display = 'none';
        }
    }
}

function tryUnlockKeyBuilding(kb) {
    const slotIdx = S.keychain.findIndex(function(k) { return k === kb.keyType; });
    if (slotIdx < 0) {
        showKeyNotification('未持有 ' + ITEMS[kb.keyType].name + '！');
        return;
    }
    // Decrement uses
    S.keyUses[slotIdx]--;
    if (S.keyUses[slotIdx] <= 0) {
        const cardName = ITEMS[kb.keyType].name;
        S.keychain[slotIdx] = null;
        S.keyUses[slotIdx] = 0;
        showKeyNotification(cardName + ' 已损坏销毁！');
    }
    // Unlock building
    kb.unlocked = true;
    showKeyNotification(kb.name + ' 已解锁！');
    // Update building mesh (hide lock indicator)
    if (kb.lockMesh) { kb.lockMesh.visible = false; }
    if (kb.shackleMesh) { kb.shackleMesh.visible = false; }
    if (kb.glowRing) { kb.glowRing.visible = false; }
    // Spawn containers inside key building
    spawnKeyBuildingContainers(kb);
    // 钥匙房是中途解锁的，新补的 3 个容器要单独合批一次（batchStatic 只处理未合批的网格）
    if (typeof finalizeContainerBatching === 'function') finalizeContainerBatching();
    // Remove collision box so player can enter the building
    for (var oi = obstacles.length - 1; oi >= 0; oi--) {
        var obs = obstacles[oi];
        if (obs.isAABB && obs.mesh && Math.abs(obs.mesh.position.x - kb.x) < 1 && Math.abs(obs.mesh.position.z - kb.z) < 1) {
            obstacles.splice(oi, 1);
            break;
        }
    }
    // Hide prompt
    const prompt = document.getElementById('keyBuildingPrompt');
    if (prompt) prompt.style.display = 'none';
    nearbyKeyBuilding = null;
    // Update UI
    if (S.phase === 'backpack') renderBackpackInventory();
    sfxPickup('legendary');
}

function spawnKeyBuildingContainers(kb) {
    // Determine container types based on key rarity
    var types;
    if (kb.keyType === 'blueKeycard') types = ['weaponBox', 'supplyBox', 'medBox'];
    else if (kb.keyType === 'purpleKeycard') types = ['equipBox', 'weaponBox', 'safe'];
    else if (kb.keyType === 'goldKeycard') types = ['safe', 'equipBox', 'premiumBox'];
    else types = ['premiumBox', 'premiumBox', 'safe']; // redKeycard - best loot

    // Spawn containers inside the building footprint
    var halfW = kb.w / 2 - 2;
    for (var i = 0; i < types.length; i++) {
        var offsetX = (i - (types.length - 1) / 2) * Math.max(2.5, halfW / types.length * 1.5);
        var offsetZ = (i % 2 === 0) ? -1.5 : 1.5;
        createContainer(types[i], kb.x + offsetX, kb.z + offsetZ);
    }
}

function showKeyNotification(msg) {
    var el = document.getElementById('keyNotification');
    if (!el) return;
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(el._timer);
    el._timer = setTimeout(function() {
        el.style.opacity = '0';
        el.style.transform = 'translateX(-50%) translateY(-10px)';
    }, 2500);
}

// Per-item search reveal
let searchAnimData = null;
let searchRevealTimer = null;

function clearSearchReveal() {
    if (searchRevealTimer) { clearTimeout(searchRevealTimer); searchRevealTimer = null; }
}

function startSearchAnimation(container) {
    S._isSearching = true;
    S.currentSearchContainer = container;
    sfxSearchStart();
    document.getElementById('searchPrompt').style.display = 'none';
    const overlay = document.getElementById('searchProgressOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        document.getElementById('searchProgressName').textContent = (container.icon||'📦') + ' ' + container.name;
        document.getElementById('searchProgressFill').style.width = '0%';
    }
    // 技能效果：搜索速度提升（减少搜索时间）
    let searchSpeedBonus = getTotalSkillEffect('searchSpeed');
    const baseDuration = container.searchTime || 1.5;
    const actualDuration = baseDuration * Math.max(0.3, 1.0 - searchSpeedBonus);
    searchAnimData = { container, progress: 0, duration: actualDuration };
}

function updateSearchAnimation(dt) {
    if (!searchAnimData) return;
    searchAnimData.progress += dt;
    const pct = Math.min(100, (searchAnimData.progress / searchAnimData.duration) * 100);
    const fill = document.getElementById('searchProgressFill');
    if (fill) fill.style.width = pct + '%';

    if (searchAnimData.progress >= searchAnimData.duration) {
        const container = searchAnimData.container;
        searchAnimData = null;
        S._isSearching = false;
        S.phase = 'searching';
        showDropZones(true);
        const overlay = document.getElementById('searchProgressOverlay');
        if (overlay) overlay.style.display = 'none';
        sfxSearchComplete();
        if (document.pointerLockElement) document.exitPointerLock();
        if (!container.searched) { container.searched = true; S.containersSearched++; trackMission('search_containers',1); gainXP(5, '搜索容器'); trackAchievement('searches', 1); }

        // Init per-item reveal
        container._revealed = new Array(container.items.length).fill(false);
        container._revealCount = 0;
        S.currentSearchContainer = container;
        document.getElementById('searchContainerName').textContent = container.name;
        renderSearchGrid(container);
        document.getElementById('searchScreen').style.display = 'flex';
        startItemReveal(container);
    }
}

// Unified prompt box setter - prevents innerHTML conflicts
function setPromptBox(title, hint, borderColor, textColor){
    var prompt=document.getElementById('searchPrompt');
    if(!prompt)return;
    // Always rebuild with proper structure to ensure promptTitle exists
    prompt.innerHTML='<div class="prompt-box" style="'+(borderColor?'border-color:'+borderColor+';':'')+'">'+
        '<div class="prompt-title" id="promptTitle" style="'+(textColor?'color:'+textColor+';':'')+'">'+title+'</div>'+
        '<div class="prompt-hint" style="'+(textColor?'color:'+textColor+';':'')+'">'+hint+'</div></div>';
}

function checkNearbyContainers(){
    let nearest=null,nd=2.8*2.8;
    for(const c of containers){const dx=playerGroup.position.x-c.x,dz=playerGroup.position.z-c.z,d=dx*dx+dz*dz;if(d<nd){nd=d;nearest=c;}}
    const prompt=document.getElementById('searchPrompt');
    // Don't override airdrop or boss task prompts
    if(nearest){
        setPromptBox(nearest.name+(nearest.searched?' (已搜索)':''),'按 F 搜索');
        prompt.style.display='block';
        prompt._isAirdrop=false;
        prompt._isBossTask=false;
    }
    else if(!prompt._isAirdrop&&!prompt._isBossTask)prompt.style.display='none';
}

function interact(){
    if(S.phase!=='playing')return;
    // Check boss task points first
    var prompt=document.getElementById('searchPrompt');
    if(prompt&&prompt._isBossTask&&prompt._bossTaskPoint){
        acceptBossTask(prompt._bossTaskPoint);
        prompt._isBossTask=false;
        prompt._bossTaskPoint=null;
        prompt.style.display='none';
        return;
    }
    // Check airdrop supply
    if(prompt&&prompt._isAirdrop&&prompt._airdrop){
        searchAirdrop(prompt._airdrop);
        prompt._isAirdrop=false;
        prompt._airdrop=null;
        prompt.style.display='none';
        return;
    }
    // Check containers first (closest priority) - before key buildings
    let nearest=null,nd=2.8*2.8;
    for(const c of containers){const dx=playerGroup.position.x-c.x,dz=playerGroup.position.z-c.z,d=dx*dx+dz*dz;if(d<nd){nd=d;nearest=c;}}
    if(nearest){openSearch(nearest);return;}
    // Check ground loot (immediate pickup)
    const nearGL = checkNearbyGroundLoot();
    if (nearGL) { pickupGroundLoot(nearGL); return; }
    // Check key buildings - only if no container or loot is nearby
    if(nearbyKeyBuilding && !nearbyKeyBuilding.unlocked){
        tryUnlockKeyBuilding(nearbyKeyBuilding);
        return;
    }
    // Check extraction
    if(extractPoints&&extractPoints.length>0&&!S.isExtracting){
        for(const ep of extractPoints){const dx=playerGroup.position.x-ep.x,dz=playerGroup.position.z-ep.z;if(dx*dx+dz*dz<ep.radius*ep.radius){startExtraction();return;}}
    }
}

function getRevealTime(itemType) {
    if (itemType === 'africa_star') return 5.0;                // 5.0s  5圈 ⭐
    const def = ITEMS[itemType]; if (!def) return 0.5;
    switch (def.rarity) {
        case 'common':
        case 'uncommon':  return 0.5;                          // 0.5s  半圈
        case 'rare':      return 1.0;                          // 1.0s  1圈
        case 'epic':      return 2.0;                          // 2.0s  2圈
        case 'legendary':  return 3.0;                          // 3.0s  3圈
        case 'ultimate':   return 4.0;                          // 4.0s  4圈
        default: return 0.5;
    }
}

function getSearchTier(rarity) {
    switch(rarity) {
        case 'common': case 'uncommon': return 1;
        case 'rare': return 2;
        case 'epic': return 3;
        case 'legendary': case 'ultimate': return 4;
        default: return 1;
    }
}

function openSearch(container){
    S.phase='searching'; S.currentSearchContainer=container;
    showDropZones(true);
    if(document.pointerLockElement)document.exitPointerLock();
    if(!container.searched){container.searched=true;S.containersSearched++;trackMission('search_containers',1);gainXP(5,'搜索容器');trackAchievement('searches',1);}
    S._redSnapshotAtOpen=snapshotRedsInBackpack();

    // Initialize per-item reveal (preserve if already searched)
    if(!container._revealed||container._revealed.length!==container.items.length){
        container._revealed=new Array(container.items.length).fill(false);
        container._revealCount=0;
    }
    // If already fully revealed, skip reveal animation
    const allRevealed=container._revealed.every(r=>r===true);
    S.currentSearchContainer=container;

    document.getElementById('searchContainerName').textContent=container.name;
    document.getElementById('searchScreen').style.display='flex';
    renderSearchGrid(container);
    if(!allRevealed) startItemReveal(container);
}

function startItemReveal(container){
    clearSearchReveal();
    const items=container.items;
    let idx=0;
    function revealNext(){
        if(idx>=items.length||S.phase!=='searching'||S.currentSearchContainer!==container)return;
        const item=items[idx];
        if(item.taken){idx++;revealNext();return;}

        // Reveal this item
        container._revealed[idx]=true;
        container._revealCount=idx+1;
        updateSearchSlotDOM(container,idx);

        // Rarity-based reveal sound
        const def=ITEMS[item.type];
        if(def)sfxPickup(def.rarity);

        idx++;
        if(idx<items.length){
            const nextItem=items[idx];
            const delay=getRevealTime(nextItem.type)*1000;
            searchRevealTimer=setTimeout(revealNext,delay);
        }
    }
    // Start first reveal with full reveal time (no cap)
    const firstItem=items[0];
    const firstDelay=firstItem?getRevealTime(firstItem.type)*1000:300;
    searchRevealTimer=setTimeout(revealNext, firstDelay);
}

function findContainerItemAt(container, col, row) {
    if (!container.items) return null;
    for (let i = 0; i < container.items.length; i++) {
        const item = container.items[i];
        if (item.taken) continue;
        const ge = item.gridEntry;
        const def = ITEMS[item.type] || {w:1, h:1};
        if (col >= ge.col && col < ge.col + def.w && row >= ge.row && row < ge.row + def.h) return {item, idx: i};
    }
    return null;
}

function renderSearchGrid(container){
    const cGrid=document.getElementById('containerGrid');cGrid.innerHTML='';
    const colW=48,rowH=48;
    cGrid.style.gridTemplateColumns=`repeat(${container.gridW},${colW}px)`;
    cGrid.style.gridTemplateRows=`repeat(${container.gridH},${rowH}px)`;

    // Render equipment slots for enemy/boss loot
    if(container.equipmentSlots){
        renderEnemyEquipmentSlots(container);
    }

    for(let r=0;r<container.gridH;r++){for(let c=0;c<container.gridW;c++){
        const cell=document.createElement('div');cell.className='grid-cell empty';
        cell.style.gridColumn=c+1;cell.style.gridRow=r+1;
        const onChanged = function() { renderSearchGrid(container); updateSearchValue(); updateHUD(); updateWeaponUI(); };
        makeGridDropCell(cell, container.grid, container.gridW, container.gridH, 'container', onChanged);
        cGrid.appendChild(cell);
    }}

    const seen=new Set();
    for(let i=0;i<container.items.length;i++){
        const item=container.items[i];if(item.taken||seen.has(i))continue;seen.add(i);
        const ge=item.gridEntry;const r=ge.row,c=ge.col;const def=ITEMS[item.type]||item;
        const isRev=container._revealed&&container._revealed[i];

        const el=document.createElement('div');
        el.id='searchSlot_'+i;
        el.className='grid-item search-slot'+(isRev?' rarity-'+def.rarity+' revealed':' unrevealed')+(item.taken?' taken':'');
        el.style.gridColumn=(c+1)+'/span '+(def.w||1);el.style.gridRow=(r+1)+'/span '+(def.h||1);

        if(isRev){
            // Revealed: show item with double-click or drag to pickup
            el.draggable=true;
            el.style.position='relative';
            el.innerHTML=`<div class="search-content" style="display:flex;flex-direction:column;align-items:center;width:100%;height:100%;justify-content:center;"><div class="gi-icon">${itemIcon(def)}</div><div class="gi-name">${def.name}</div><div class="gi-value">₵${def.value}</div></div>`;
            el.title='双击或拖拽拾取';
            // Add inspect button for red collectibles
            if(isRedCollectible(item.type)){
                var ib=document.createElement('div');
                ib.className='inspect-red-btn';
                ib.textContent='🔍';
                ib.title='点击检视';
                ib.onclick=function(e){e.stopPropagation();e.preventDefault();manualInspectRed(item.type);};
                el.appendChild(ib);
            }
            el.ondblclick=()=>takeSearchItem(i);
            const itemId2=item.type;const itemCol2=ge.col;const itemRow2=ge.row;
            el.ondragstart=function(e){e.stopPropagation();el.classList.add('dragging');e.dataTransfer.setData('text/plain','item:container:'+itemId2+':'+itemCol2+':'+itemRow2);e.dataTransfer.effectAllowed='move';};
            el.ondragend=function(){el.classList.remove('dragging');};
        }else{
            // Hidden: spinner with tier indicator
            const tier=getSearchTier(def.rarity);
            const tierDots={1:'●',2:'◑',3:'◉',4:'◎'};
            const tierLabel={1:'垃圾',2:'普通',3:'高级',4:'稀有'};
            el.innerHTML=`<div class="search-hidden" style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;"><div class="search-spinner search-tier-${tier}"></div><div class="search-tier-dot">${tierDots[tier]||'●'}</div></div><div class="search-content" style="display:none;flex-direction:column;align-items:center;width:100%;height:100%;justify-content:center;"><div class="gi-icon"></div><div class="gi-name"></div><div class="gi-value"></div></div>`;
        }
        cGrid.appendChild(el);
    }
    renderSearchInventory();
    updateSearchRevealCount(container);
}

function renderEnemyEquipmentSlots(container){
    var panel=document.getElementById('containerGrid').parentElement;
    var eqDiv=document.getElementById('enemyEquipmentSlots');
    if(!eqDiv){
        eqDiv=document.createElement('div');
        eqDiv.id='enemyEquipmentSlots';
        eqDiv.style.cssText='display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;justify-content:center;';
        panel.insertBefore(eqDiv,document.getElementById('containerGrid'));
    }
    eqDiv.innerHTML='';
    var slotLabels={'helmet':'头盔','armor':'护甲','primary':'主武器','secondary':'副武器','chestRig':'胸挂','backpack':'背包'};
    var slotIcons={'helmet':'🪖','armor':'🦺','primary':'🔫','secondary':'🔫','chestRig':'🎒','backpack':'🎒'};
    for(let slotKey in slotLabels){
        let eqItem=container.equipmentSlots[slotKey];
        let slotDiv=document.createElement('div');
        // Check if item was already taken
        let isTaken = eqItem && eqItem.taken;
        slotDiv.style.cssText='width:64px;height:64px;background:'+(eqItem&&!isTaken?'rgba(255,152,0,0.1)':'rgba(0,0,0,0.3)')+';border:2px solid '+(eqItem&&!isTaken?'#ff9800':'#30363d')+';border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:'+(eqItem&&!isTaken?'pointer':'default')+';position:relative;transition:all 0.2s;'+(isTaken?'opacity:0.3;':'');
        if(eqItem && !isTaken){
            let def=ITEMS[eqItem.id];
            if(def){
                slotDiv.innerHTML='<div style="font-size:24px;">'+itemIcon(def)+'</div><div style="font-size:8px;color:#8b949e;margin-top:2px;">'+def.name+'</div>';
                slotDiv.title='双击拾取 '+def.name;
                // Add inspect button for red collectibles
                if(isRedCollectible(eqItem.id)){
                    var ib=document.createElement('div');
                    ib.className='inspect-red-btn';
                    ib.textContent='🔍';
                    ib.title='点击检视';
                    ib.onclick=function(e){e.stopPropagation();e.preventDefault();manualInspectRed(eqItem.id);};
                    slotDiv.appendChild(ib);
                }
                slotDiv.ondblclick=function(){
                    if(!eqItem.taken){
                        eqItem.taken=true;
                        takeSearchItemDirect(eqItem.id);
                    }
                };
            }
        }else if(eqItem && isTaken){
            // Show taken item as dimmed
            let def=ITEMS[eqItem.id];
            if(def){
                slotDiv.innerHTML='<div style="font-size:24px;opacity:0.3;">'+itemIcon(def)+'</div><div style="font-size:8px;color:#484f58;margin-top:2px;">已拾取</div>';
            }else{
                slotDiv.innerHTML='<div style="font-size:20px;opacity:0.3;">'+slotIcons[slotKey]+'</div><div style="font-size:8px;color:#484f58;margin-top:2px;">'+slotLabels[slotKey]+'</div>';
            }
        }else{
            slotDiv.innerHTML='<div style="font-size:20px;opacity:0.3;">'+slotIcons[slotKey]+'</div><div style="font-size:8px;color:#484f58;margin-top:2px;">'+slotLabels[slotKey]+'</div>';
        }
        // 为主武器/副武器空槽添加drop事件，接收玩家拖拽的武器
        if ((slotKey === 'primary' || slotKey === 'secondary') && (!eqItem || eqItem.taken)) {
            slotDiv.style.cursor = 'pointer';
            slotDiv.ondragover = function(e) { e.preventDefault(); slotDiv.style.background = 'rgba(76,175,80,0.3)'; slotDiv.style.borderColor = '#4caf50'; };
            slotDiv.ondragleave = function() { slotDiv.style.background = 'rgba(0,0,0,0.3)'; slotDiv.style.borderColor = '#30363d'; };
            slotDiv.ondrop = function(e) {
                e.preventDefault();
                slotDiv.style.background = 'rgba(0,0,0,0.3)';
                slotDiv.style.borderColor = '#30363d';
                const dt = e.dataTransfer.getData('text/plain');
                if (dt && dt.startsWith('weapon_item:')) {
                    const itemId = dt.substring(12);
                    // 从玩家背包移除武器
                    if (S.backpack && S.backpack._items) {
                        const entry = S.backpack._items.find(en => en.id === itemId);
                        if (entry) {
                            removeFromGrid(S.backpack, entry);
                            // 放到敌人物资盒
                            const slot = findFreeSlot(container.grid, container.gridW, container.gridH, itemId);
                            if (slot) {
                                placeInGrid(container.grid, container.gridW, itemId, slot.col, slot.row);
                                const newEntry = container.grid._items[container.grid._items.length - 1];
                                container._revealed.push(true);
                                const def = ITEMS[itemId];
                                container.items.push({ ...def, type: itemId, taken: false, gridEntry: newEntry });
                                showFloatingMsg('已放入物资盒: ' + (def ? def.name : itemId));
                            } else {
                                // 物资盒满了，放回玩家背包
                                placeInGrid(S.backpack, S.backpackCols, itemId, entry.col, entry.row);
                                showFloatingMsg('物资盒空间不足');
                            }
                        }
                    }
                    renderSearchGrid(container);
                    updateSearchValue();
                    updateHUD();
                } else if (dt && dt.startsWith('weapon:')) {
                    // 从玩家武器槽直接拖拽到敌人装备槽
                    const slotIndex = parseInt(dt.substring(7));
                    const weaponId = S.weaponSlots[slotIndex];
                    if (weaponId) {
                        const wItemId = 'weapon_' + weaponId;
                        const wDef = WEAPONS[weaponId];
                        if (wDef && !ITEMS[wItemId]) {
                            ITEMS[wItemId] = { name: wDef.name, icon: wDef.icon, type: 'weapon', rarity: wDef.rarity || 'rare', value: wDef.value || 5000, w: 2, h: 1, weight: wDef.weight || 3 };
                        }
                        // 放到敌人物资盒
                        const slot = findFreeSlot(container.grid, container.gridW, container.gridH, wItemId);
                        if (slot) {
                            placeInGrid(container.grid, container.gridW, wItemId, slot.col, slot.row);
                            const newEntry = container.grid._items[container.grid._items.length - 1];
                            container._revealed.push(true);
                            const def = ITEMS[wItemId];
                            container.items.push({ ...def, type: wItemId, taken: false, gridEntry: newEntry });
                            // 从玩家武器槽移除
                            S.weaponSlots[slotIndex] = null;
                            S.magAmmo[slotIndex] = 0;
                            if (S.currentWeapon === slotIndex) {
                                let found = false;
                                for (let i = 0; i < S.weaponSlots.length; i++) {
                                    if (S.weaponSlots[i]) { S.currentWeapon = i; found = true; break; }
                                }
                                if (!found) S.currentWeapon = 3;
                            }
                            if (S.weaponSlots[3] !== 'knife') S.weaponSlots[3] = 'knife';
                            if (typeof updateWeaponModel === 'function') updateWeaponModel();
                            showFloatingMsg('已放入物资盒: ' + (def ? def.name : wItemId));
                        } else {
                            showFloatingMsg('物资盒空间不足');
                        }
                    }
                    renderSearchGrid(container);
                    updateSearchValue();
                    updateHUD();
                    updateWeaponUI();
                }
            };
        }
        eqDiv.appendChild(slotDiv);
    }
}
function takeSearchItemDirect(itemId){
    // Take an item directly (from equipment slots)
    var def=ITEMS[itemId];
    if(!def)return;
    // Try keychain first for keycards
    if(def.type==='keycard'||def.subType==='keycard'){
        for(var i=0;i<4;i++){
            if(!P.keychain[i]){
                P.keychain[i]=itemId;
                P.keyUses[i]=10;
                savePersistent();
                updateHUD();
                showFloatingMsg('钥匙卡已放入钥匙链！');
                return;
            }
        }
    }
    // Try auto-equip for equipment items (weapon/armor/helmet/chestRig/backpack)
    var equipTypes=['weapon','armor','helmet','chestRig','backpack'];
    if(equipTypes.indexOf(def.type)>=0){
        if(autoEquipLoot(itemId)){
            // Successfully auto-equipped
            S.lootValue+=def.value||0;
            S._lootItems=S._lootItems||[];
            S._lootItems.push({id:itemId,name:def.name,value:def.value,rarity:def.rarity});
            sfxPickup(def.rarity);
            updateHUD();updateWeaponUI();updateSearchValue();
            showFloatingMsg('已装备: '+def.name);
            // Re-render equipment slots to show updated state
            if(S.currentSearchContainer)renderSearchGrid(S.currentSearchContainer);
            return;
        }
        // Equipment slot already filled — fall through to inventory
    }
    // Non-collectibles: try pockets → chest rig first (quick-access for meds, ammo, etc.)
    var _isCollectible = (def.type === 'valuable');
    if (!_isCollectible) {
        // Try pockets
        if(S.pockets.length<S.maxPockets){
            S.pockets.push(itemId);
            S.lootValue+=def.value||0;
            S._lootItems=S._lootItems||[];
            S._lootItems.push({id:itemId,name:def.name,value:def.value,rarity:def.rarity});
            sfxPickup(def.rarity);
            updateHUD();updateSearchValue();
            if(S.currentSearchContainer)renderSearchGrid(S.currentSearchContainer);
            return;
        }
        // Try chest rig
        var _rigSlots2 = S.equipment.chestRig ? ITEMS[S.equipment.chestRig].slots : 0;
        if (_rigSlots2 > 0 && (S._rigItems || []).length < _rigSlots2) {
            S._rigItems = S._rigItems || [];
            S._rigItems.push(itemId);
            S.lootValue+=def.value||0;
            S._lootItems=S._lootItems||[];
            S._lootItems.push({id:itemId,name:def.name,value:def.value,rarity:def.rarity});
            sfxPickup(def.rarity);
            updateHUD();updateSearchValue();
            if(S.currentSearchContainer)renderSearchGrid(S.currentSearchContainer);
            return;
        }
    }
    // Try backpack
    if(S.equipment.backpack&&S.backpackCols>0){
        var slot=findFreeSlot(S.backpack,S.backpackCols,S.backpackRows,itemId);
        if(slot){
            placeInGrid(S.backpack,S.backpackCols,itemId,slot.col,slot.row);
            S.lootValue+=def.value||0;
            S._lootItems=S._lootItems||[];
            S._lootItems.push({id:itemId,name:def.name,value:def.value,rarity:def.rarity});
            sfxPickup(def.rarity);
            updateHUD();updateSearchValue();
            if(S.currentSearchContainer)renderSearchGrid(S.currentSearchContainer);
            return;
        }
    }
    // Fallback: secure container
    var scSlot=findFreeSlot(S.secureContainer,3,3,itemId);
    if(scSlot){
        placeInGrid(S.secureContainer,3,itemId,scSlot.col,scSlot.row);
        S.lootValue+=def.value||0;
        S._lootItems=S._lootItems||[];
        S._lootItems.push({id:itemId,name:def.name,value:def.value,rarity:def.rarity});
        sfxPickup(def.rarity);
        updateHUD();updateSearchValue();
        if(S.currentSearchContainer)renderSearchGrid(S.currentSearchContainer);
        return;
    }
    // No space
    showFloatingMsg('背包空间不足！');
}

function updateSearchSlotDOM(container,idx){
    const slot=document.getElementById('searchSlot_'+idx);if(!slot)return;
    const item=container.items[idx];if(!item)return;
    const def=ITEMS[item.type]||item;

    // Switch from unrevealed to revealed
    slot.classList.remove('unrevealed');
    slot.classList.add('rarity-'+def.rarity,'revealed');
    const sp=slot.querySelector('.search-spinner');if(sp)sp.remove();
    const hd=slot.querySelector('.search-hidden');if(hd)hd.style.display='none';
    const ct=slot.querySelector('.search-content');
    if(ct){ct.style.display='flex';ct.querySelector('.gi-icon').innerHTML=itemIcon(def);ct.querySelector('.gi-name').textContent=def.name;ct.querySelector('.gi-value').textContent='₵'+def.value;}

    // Ultimate reveal: per-item glow pulse
    if(def.rarity==='ultimate'){
        slot.classList.add('ultimate-glow');
        setTimeout(()=>slot.classList.remove('ultimate-glow'),800);
    }

    // Set up double-click and drag
    slot.draggable=true;
    slot.title='双击或拖拽拾取';
    slot.ondblclick=()=>takeSearchItem(idx);
    const ge2=item.gridEntry;const sItemType=item.type;const sCol=ge2.col;const sRow=ge2.row;
    slot.ondragstart=function(e){e.stopPropagation();slot.classList.add('dragging');e.dataTransfer.setData('text/plain','item:container:'+sItemType+':'+sCol+':'+sRow);e.dataTransfer.effectAllowed='move';};
    slot.ondragend=function(){slot.classList.remove('dragging');};

    updateSearchRevealCount(container);
}

function updateSearchRevealCount(container){
    const el=document.getElementById('searchRevealCount');if(el&&container)el.textContent=(container._revealCount||0)+'/'+container.items.length;
}

function autoEquipLoot(type){
    const def=ITEMS[type];if(!def)return false;
    if(def.type==='weapon'){
        const wSlot=def.wSlot||'primary';
        if(wSlot==='primary'){
            let s=-1;if(!S.weaponSlots[0])s=0;else if(!S.weaponSlots[1])s=1;
            if(s>=0){S.weaponSlots[s]=def.weapon;S.magAmmo[s]=WEAPONS[def.weapon].magSize;updateWeaponUI();return true;}
        }else if(wSlot==='secondary'){
            if(!S.weaponSlots[2]){S.weaponSlots[2]=def.weapon;S.magAmmo[2]=WEAPONS[def.weapon].magSize;updateWeaponUI();return true;}
        }
    }else if(def.type==='armor'){
        if(!S.equipment.armor){S.equipment.armor=type;S.equipment.armorHP=def.amount;return true;}
    }else if(def.type==='helmet'){
        if(!S.equipment.helmet){S.equipment.helmet=type;S.equipment.helmetHP=def.amount;return true;}
    }else if(def.type==='chestRig'){
        if(!S.equipment.chestRig){S.equipment.chestRig=type;S.maxPockets=5;return true;}
    }else if(def.type==='backpack'){
        if(!S.equipment.backpack){S.equipment.backpack=type;S.backpackCols=def.bCols;S.backpackRows=def.bRows;S.backpack=initGrid(def.bRows);return true;}
    }
    return false;
}

function renderSearchBackpackPanel() {
    // Render backpack in search screen
    const bpDiv = document.getElementById('searchBackpackGrid');
    if (bpDiv) {
        bpDiv.innerHTML = '<div style="color:#8b949e;font-size:10px;margin-bottom:4px;">背包 (' + S.backpackCols + '×' + S.backpackRows + ')</div>';
        const bGrid = document.createElement('div');
        bGrid.style.cssText = `display:grid;grid-template-columns:repeat(${S.backpackCols},48px);grid-template-rows:repeat(${S.backpackRows},48px);gap:2px;padding:4px;background:rgba(0,0,0,0.3);border-radius:4px;`;
        renderGridWithItems(bGrid, S.backpack, S.backpackCols, S.backpackRows, 'backpack');
        bpDiv.appendChild(bGrid);
    }

    // Render secure container in search screen
    const secDiv = document.getElementById('searchSecureGrid');
    if (secDiv) {
        const sGrid = document.createElement('div');
        sGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(3,44px);gap:2px;padding:4px;background:rgba(255,152,0,0.1);border:1px solid #ff9800;border-radius:4px;';
        renderGridWithItems(sGrid, S.secureContainer, 3, 3, 'secure');
        secDiv.innerHTML = '<div style="color:#ff9800;font-size:10px;margin-bottom:4px;">安全箱 (死亡不掉落)</div>';
        secDiv.appendChild(sGrid);
    }
}

function renderGridWithItems(container, grid, cols, rows, gridType) {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.style.cssText = `background:rgba(0,0,0,0.2);border:1px solid #1a1a1a;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:20px;grid-column:${c + 1};grid-row:${r + 1};`;
            const entry = (grid[r] && grid[r][c]) || null;
            if (entry) {
                const def = ITEMS[entry.id];
                if (def) {
                    cell.style.background = 'var(--rarity-bg)';
                    cell.style.borderColor = 'var(--rarity-border)';
                    cell.innerHTML = itemIcon(def);
                    cell.dataset.itemId = entry.id;
                    cell.title = def.name + ' - 拖拽丢弃或双击放回容器';
                    cell.style.cursor = 'grab';
                    cell.draggable = true;
                    // 支持拖拽到丢弃区域
                    cell.ondragstart = function(e) {
                        e.stopPropagation();
                        cell.classList.add('dragging');
                        e.dataTransfer.setData('text/plain', 'item:' + gridType + ':' + entry.id + ':' + entry.col + ':' + entry.row);
                        e.dataTransfer.effectAllowed = 'move';
                    };
                    cell.ondragend = function() { cell.classList.remove('dragging'); };
                    cell.ondblclick = function () {
                        // Move from backpack/secure to container
                        const container2 = S.currentSearchContainer;
                        if (!container2) return;
                        const slot = findFreeSlot(container2.grid, container2.gridW, container2.gridH, entry.id);
                        if (slot) {
                            removeFromGrid(grid, entry);
                            if (gridType === 'backpack') S.lootValue = Math.max(0, S.lootValue - def.value);
                            placeInGrid(container2.grid, container2.gridW, entry.id, slot.col, slot.row);
                            const newEntry2 = container2.grid._items[container2.grid._items.length - 1];
                            container2._revealed.push(true);
                            container2.items.push({ ...def, type: entry.id, taken: false, gridEntry: newEntry2 });
                            renderSearchGrid(container2);
                            updateSearchValue();
                            updateHUD();
                        }
                    };
                }
            }
            container.appendChild(cell);
        }
    }
}

function renderBackpackGrid(){
    const bGrid=document.getElementById('backpackGrid');bGrid.innerHTML='';
    const colW=48,rowH=48;
    bGrid.style.gridTemplateColumns=`repeat(${S.backpackCols},${colW}px)`;
    bGrid.style.gridTemplateRows=`repeat(${S.backpackRows},${rowH}px)`;

    for(let r=0;r<S.backpackRows;r++){for(let c=0;c<S.backpackCols;c++){
        const cell=document.createElement('div');cell.className='grid-cell empty';
        cell.style.gridColumn=c+1;cell.style.gridRow=r+1;
        const dropCol=c,dropRow=r;
        cell.ondragover=function(e){
            e.preventDefault();
            // Highlight for both container→backpack and backpack internal drag
            if(e.dataTransfer&&e.dataTransfer.types.includes('text/plain')){
                const dt=e.dataTransfer.getData('text/plain');
                if(dt.startsWith('container:')){cell.classList.add('drag-over');}
            }
            if(dragData&&dragData.gridType==='backpack'){
                const{grid,cols,maxRows,entry}=dragData;
                if(canDropAt(grid,cols,maxRows,entry,dropCol,dropRow,entry))cell.classList.add('drag-over');
            }
        };
        cell.ondragleave=function(){cell.classList.remove('drag-over');};
        cell.ondrop=function(e){
            e.preventDefault();cell.classList.remove('drag-over');
            // Handle container→backpack (including swap)
            if(e.dataTransfer&&e.dataTransfer.types.includes('text/plain')){
                const dt=e.dataTransfer.getData('text/plain');
                if(dt.startsWith('container:')){
                    const idx=parseInt(dt.split(':')[1]);
                    const container=S.currentSearchContainer;if(!container)return;
                    const item=container.items[idx];
                    if(!item||item.taken||!container._revealed||!container._revealed[idx])return;
                    const def=ITEMS[item.type];if(!def)return;
                    if(canPlaceInGrid(S.backpack,S.backpackCols,item.type,dropCol,dropRow)){
                        takeContainerItem(container, item);
                        placeInGrid(S.backpack,S.backpackCols,item.type,dropCol,dropRow);
                        S.lootValue+=def.value;
                        if(autoEquipLoot(item.type)){removeFromGrid(S.backpack,S.backpack._items[S.backpack._items.length-1]);}
                        S._lootItems=S._lootItems||[];S._lootItems.push({id:item.type,name:def.name,value:def.value,rarity:def.rarity});
                        sfxPickup(def.rarity);
                    }else{
                        // Swap with occupying backpack item
                        const existing=(S.backpack[dropRow]&&S.backpack[dropRow][dropCol])||null;
                        if(existing&&ITEMS[existing.id]){
                            const exDef=ITEMS[existing.id];
                            removeFromGrid(S.backpack,existing);S.lootValue=Math.max(0,S.lootValue-exDef.value);
                            if(S._lootItems){const li=S._lootItems.findIndex(l=>l.id===existing.id);if(li>=0)S._lootItems.splice(li,1);}
                            takeContainerItem(container, item);placeInGrid(S.backpack,S.backpackCols,item.type,dropCol,dropRow);
                            S.lootValue+=def.value;
                            if(autoEquipLoot(item.type)){const placed=S.backpack._items[S.backpack._items.length-1];removeFromGrid(S.backpack,placed);}
                            S._lootItems=S._lootItems||[];S._lootItems.push({id:item.type,name:def.name,value:def.value,rarity:def.rarity});
                            sfxPickup(def.rarity);
                            // Put displaced item back in container
                            removeFromGrid(container.grid,item.gridEntry);
                            placeInGrid(container.grid,container.gridW,existing.id,item.gridEntry.col,item.gridEntry.row);
                            const swappedEntry = container.grid._items[container.grid._items.length - 1];
                            container._revealed.push(true);
                            container.items.push({...exDef,type:existing.id,taken:false,gridEntry:swappedEntry});
                        }else{
                            // Try secure container
                            const ss=findFreeSlot(S.secureContainer,S.secureCols,S.secureRows,item.type);
                            if(ss){takeContainerItem(container, item);placeInGrid(S.secureContainer,S.secureCols,item.type,ss.col,ss.row);S.lootValue+=def.value;
                                if(autoEquipLoot(item.type)){const placed=S.secureContainer._items[S.secureContainer._items.length-1];removeFromGrid(S.secureContainer,placed);}
                                S._lootItems=S._lootItems||[];S._lootItems.push({id:item.type,name:def.name,value:def.value,rarity:def.rarity});sfxPickup(def.rarity);}
                            else{alert('背包和安全箱都已满！');return;}
                        }
                    }
                    renderSearchGrid(container);updateSearchValue();updateHUD();updateWeaponUI();
                    return;
                }
            }
            // Handle backpack internal drag
            if(dragData&&dragData.gridType==='backpack'){onDropOnCell('backpack',dropCol,dropRow);}
        };
        bGrid.appendChild(cell);
    }}

    if(S.backpack._items){S.backpack._items.forEach((entry,idx)=>{
        const def=ITEMS[entry.id];if(!def)return;
        const el=document.createElement('div');
        el.className='grid-item rarity-'+def.rarity;
        el.dataset.itemId=entry.id;
        el.style.position='relative';
        el.draggable=true;
        el.style.gridColumn=(entry.col+1)+'/span '+def.w;el.style.gridRow=(entry.row+1)+'/span '+def.h;
        el.innerHTML=`<div class="gi-icon">${itemIcon(def)}</div><div class="gi-name">${def.name}</div><div class="gi-value">₵${def.value}</div>`;
        el.title=def.name+' | 双击移回容器 | 拖拽整理 | 点击检视';
        // Add inspect button for red collectibles
        if(isRedCollectible(entry.id)){
            var ib=document.createElement('div');
            ib.className='inspect-red-btn';
            ib.textContent='🔍';
            ib.title='点击检视';
            ib.onclick=function(e){e.stopPropagation();e.preventDefault();manualInspectRed(entry.id);};
            el.appendChild(ib);
        }
        el.ondblclick=function(){
            // Move backpack item back to container
            const container=S.currentSearchContainer;
            if(!container)return;
            const slot=findFreeSlot(container.grid,container.gridW,container.gridH,entry.id);
            if(slot){
                removeFromGrid(S.backpack,entry);S.lootValue=Math.max(0,S.lootValue-def.value);
                if(S._lootItems){const li=S._lootItems.findIndex(l=>l.id===entry.id);if(li>=0)S._lootItems.splice(li,1);}
                placeInGrid(container.grid,container.gridW,entry.id,slot.col,slot.row);
                const newEntryC = container.grid._items[container.grid._items.length - 1];
                container._revealed.push(true);
                container.items.push({...def,type:entry.id,taken:false,gridEntry:newEntryC});
                renderSearchGrid(container);updateSearchValue();updateHUD();updateWeaponUI();
            }
        };
        el.ondragstart=function(e){onDragStart('backpack',idx,e);el.classList.add('dragging');};
        el.ondragend=function(){el.classList.remove('dragging');onDragEnd();};
        el.oncontextmenu=function(e){e.preventDefault();removeFromGrid(S.backpack,entry);S.lootValue=Math.max(0,S.lootValue-def.value);renderSearchGrid(S.currentSearchContainer);updateSearchValue();};
        bGrid.appendChild(el);
    });}
}

function takeSearchItem(idx){
    const container=S.currentSearchContainer;if(!container)return;
    const item=container.items[idx];if(item.taken)return;
    if(!container._revealed||!container._revealed[idx])return; // Must be revealed first
    const def=ITEMS[item.type];if(!def)return;

    // For equipment items (armor/helmet/chestRig/backpack/weapon), try auto-equip first
    // to avoid duplicating the item in both backpack and equipment slot
    const equipTypes = ['armor','helmet','chestRig','backpack','weapon'];
    if (equipTypes.includes(def.type)) {
        if (autoEquipLoot(item.type)) {
            // Successfully equipped to character — don't put in backpack
            takeContainerItem(container, item);
            S.lootValue += def.value;
            S._lootItems = S._lootItems || [];
            S._lootItems.push({id:item.type, name:def.name, value:def.value, rarity:def.rarity});
            sfxPickup(def.rarity);
            renderSearchGrid(container);
            updateSearchValue();
            updateHUD(); updateWeaponUI();
            return;
        }
        // Equipment slot already filled — fall through to place in backpack
    }

    // Auto-place: keycards go to keychain first
    if (def.type === 'keycard') {
        for (var ki = 0; ki < 4; ki++) {
            if (!S.keychain[ki]) {
                S.keychain[ki] = item.type;
                S.keyUses[ki] = 10;
                takeContainerItem(container, item);
                S.lootValue += def.value;
                S._lootItems = S._lootItems || [];
                S._lootItems.push({id: item.type, name: def.name, value: def.value, rarity: def.rarity});
                sfxPickup(def.rarity);
                renderSearchGrid(container);
                updateSearchValue();
                updateHUD(); updateWeaponUI();
                return;
            }
        }
    }

    // Auto-place: non-collectibles → pockets → chest rig → backpack → secure
    // Collectibles (valuables) → backpack → secure (skip quick slots)
    var isCollectible = (def.type === 'valuable');
    if (!isCollectible) {
        // Try pockets first (quick-access for meds, ammo, throwables, etc.)
        if (S.pockets.length < S.maxPockets) {
            S.pockets.push(item.type);
            takeContainerItem(container, item);
            S.lootValue += def.value;
            S._lootItems = S._lootItems || [];
            S._lootItems.push({id: item.type, name: def.name, value: def.value, rarity: def.rarity});
            sfxPickup(def.rarity);
            renderSearchGrid(container);
            updateSearchValue();
            updateHUD(); updateWeaponUI();
            return;
        }
        // Try chest rig
        var rigSlots = S.equipment.chestRig ? ITEMS[S.equipment.chestRig].slots : 0;
        if (rigSlots > 0 && (S._rigItems || []).length < rigSlots) {
            S._rigItems = S._rigItems || [];
            S._rigItems.push(item.type);
            takeContainerItem(container, item);
            S.lootValue += def.value;
            S._lootItems = S._lootItems || [];
            S._lootItems.push({id: item.type, name: def.name, value: def.value, rarity: def.rarity});
            sfxPickup(def.rarity);
            renderSearchGrid(container);
            updateSearchValue();
            updateHUD(); updateWeaponUI();
            return;
        }
    }
    // Try backpack, then secure container
    let slot=findFreeSlot(S.backpack,S.backpackCols,S.backpackRows,item.type);
    let tg=S.backpack,tc=S.backpackCols,tr=S.backpackRows;
    if(!slot){slot=findFreeSlot(S.secureContainer,S.secureCols,S.secureRows,item.type);tg=S.secureContainer;tc=S.secureCols;tr=S.secureRows;}
    if(!slot){alert('背包和安全箱都已满！');return;}

    takeContainerItem(container, item);
    placeInGrid(tg,tc,item.type,slot.col,slot.row);
    S.lootValue+=def.value;
    S._lootItems=S._lootItems||[];S._lootItems.push({id:item.type,name:def.name,value:def.value,rarity:def.rarity});
    sfxPickup(def.rarity);
    renderSearchGrid(container);
    updateSearchValue();
    updateHUD();updateWeaponUI();
}

function sortBackpack(){
    if(!S.currentSearchContainer)return;
    // Sort backpack
    if(S.backpack._items&&S.backpack._items.length>0&&S.backpackCols>0){
        autoSortGrid(S.backpack,S.backpackCols,S.backpackRows);
    }
    // Sort container items
    const container=S.currentSearchContainer;
    if(container&&container.grid._items&&container.grid._items.length>0){
        autoSortGrid(container.grid,container.gridW,container.gridH);
        // Update gridEntry references in container.items
        for(const item of container.items){
            if(!item.taken&&item.gridEntry){
                const ge=item.gridEntry;const entry=(container.grid[ge.row]&&container.grid[ge.row][ge.col])||null;
                if(entry&&entry.id===item.type)continue; // Already correct
            }
            // Find the item in the grid
            if(container.grid._items){
                const found=container.grid._items.find(e=>e.id===item.type&&!container.items.some(ci=>ci.gridEntry&&ci.gridEntry.col===e.col&&ci.gridEntry.row===e.row&&ci!==item&&!ci.taken));
                if(found)item.gridEntry=found;
            }
        }
    }
    renderSearchGrid(container);updateSearchValue();updateHUD();
}

function takeAllItems(){
    const container=S.currentSearchContainer;if(!container)return;
    for(let i=0;i<container.items.length;i++){
        if(!container.items[i].taken && container._revealed && container._revealed[i]) takeSearchItem(i);
    }
    closeSearch();
}

function closeSearch(){
    clearSearchReveal();
    S.phase='playing';S.currentSearchContainer=null;searchAnimData=null;S._isSearching=false;
    isMouseDown=false; // 修复拖拽后鼠标左键状态异常
    document.getElementById('searchScreen').style.display='none';
    document.getElementById('searchProgressOverlay').style.display='none';
    showDropZones(false);
    // Clean up enemy equipment slots
    var eqDiv=document.getElementById('enemyEquipmentSlots');
    if(eqDiv)eqDiv.remove();
    document.getElementById('gameCanvas').requestPointerLock();
    checkRedInspection();
}
function showFloatingMsg(msg){
    var div=document.createElement('div');
    div.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);color:#ff9800;padding:10px 20px;border-radius:6px;font-size:14px;z-index:300;pointer-events:none;animation:bossKillIn 0.3s ease-out;';
    div.textContent=msg;
    document.body.appendChild(div);
    setTimeout(function(){if(div.parentNode)div.parentNode.removeChild(div);},1500);
}

function cancelSearchAnim(){
    clearSearchReveal();
    searchAnimData=null;S._isSearching=false;S.currentSearchContainer=null;
    document.getElementById('searchProgressOverlay').style.display='none';
}

function updateSearchValue(){
    const el=document.getElementById('searchLootValue');
    if(el)el.textContent='₵ '+S.lootValue.toLocaleString();
}

// ========== In-Game Backpack (press B) ==========
function openBackpack(){
    if(S.phase!=='playing')return;
    S.phase='backpack';
    S._preBpPhase='playing';
    S._redSnapshotAtOpen=snapshotRedsInBackpack();
    if(document.pointerLockElement)document.exitPointerLock();
    document.getElementById('backpackScreen').style.display='flex';
    renderBackpackInventory();
    updateBackpackValue();
    showDropZones(true);
}

function closeBackpack(){
    if(S.phase!=='backpack')return;
    S.phase='playing';
    isMouseDown=false; // 修复拖拽后鼠标左键状态异常
    document.getElementById('backpackScreen').style.display='none';
    showDropZones(false);
    document.getElementById('gameCanvas').requestPointerLock();
    checkRedInspection();
}

// ========== Red Collectible Inspection System ==========
var RED_INSPECT_ANIMATIONS=['redInspectFlip','redInspectLift','redInspectToss','redInspectMulti','redInspectZoom','redInspectCoinFlip','redInspectSlide','redInspectDrop','redInspectTumble','redInspectPulse'];
var _redInspectionActive=false;

function isRedCollectible(itemId){
    if(!itemId)return false;
    // Check new red collectibles config
    if(typeof RED_COLLECTIBLES_CONFIG!=='undefined'&&RED_COLLECTIBLES_CONFIG.hasOwnProperty(itemId))return true;
    // Check old red items with rarity 'ultimate' and type 'valuable'
    var def=ITEMS[itemId];
    if(def&&def.rarity==='ultimate'&&def.type==='valuable')return true;
    return false;
}

function countRedsInBackpack(){
    if(!S.backpack||!S.backpack._items)return 0;
    var c=0;
    for(var i=0;i<S.backpack._items.length;i++){
        if(isRedCollectible(S.backpack._items[i].id))c++;
    }
    return c;
}

// Snapshot red items in backpack as a set of "id:col:row" strings
function snapshotRedsInBackpack(){
    if(!S.backpack||!S.backpack._items)return {};
    var snap={};
    for(var i=0;i<S.backpack._items.length;i++){
        var e=S.backpack._items[i];
        if(isRedCollectible(e.id))snap[e.id+':'+e.col+':'+e.row]=true;
    }
    return snap;
}

// Find new reds by comparing current state with snapshot
function findNewRedsFromSnapshot(snapshot){
    if(!S.backpack||!S.backpack._items)return [];
    var newReds=[];
    for(var i=0;i<S.backpack._items.length;i++){
        var e=S.backpack._items[i];
        if(isRedCollectible(e.id)){
            var ref=e.id+':'+e.col+':'+e.row;
            if(!snapshot[ref])newReds.push(e);
        }
    }
    return newReds;
}

function checkRedInspection(){
    if(_redInspectionActive)return;
    if(!S.backpack||!S.backpack._items)return;
    
    // Find new reds by comparing with snapshot taken at UI open time
    var newReds=findNewRedsFromSnapshot(S._redSnapshotAtOpen||{});
    
    // Also check ground pickup flag
    if(newReds.length===0&&!S._pendingRedGroundPickup){
        S._redSnapshotAtOpen=snapshotRedsInBackpack();
        S._pendingRedGroundPickup=false;
        return;
    }
    
    // If no new reds from snapshot but ground pickup flag is set, find all reds
    if(newReds.length===0&&S._pendingRedGroundPickup){
        for(var i=0;i<S.backpack._items.length;i++){
            var e=S.backpack._items[i];
            if(isRedCollectible(e.id))newReds.push(e);
        }
    }
    
    S._redSnapshotAtOpen=snapshotRedsInBackpack();
    S._pendingRedGroundPickup=false;
    
    if(newReds.length>0){
        // Sort by value descending
        newReds.sort(function(a,b){
            var va=(ITEMS[a.id]&&ITEMS[a.id].value)||0;
            var vb=(ITEMS[b.id]&&ITEMS[b.id].value)||0;
            return vb-va;
        });
        // Play inspections sequentially
        _redInspectionQueue=newReds;
        playNextRedInspection();
    }
}

var _redInspectionQueue=[];

function playNextRedInspection(){
    if(_redInspectionQueue.length===0){
        _redInspectionActive=false;
        return;
    }
    var entry=_redInspectionQueue.shift();
    showRedInspection(entry);
}

// Manual inspection from UI — closes current screen and plays inspection for specific item
function manualInspectRed(itemId){
    if(!isRedCollectible(itemId))return;
    // Close whatever UI is open
    if(S.phase==='backpack'){
        S.phase='playing';
        document.getElementById('backpackScreen').style.display='none';
        document.getElementById('gameCanvas').requestPointerLock();
    }else if(S.phase==='searching'){
        clearSearchReveal();
        S.phase='playing';S.currentSearchContainer=null;searchAnimData=null;S._isSearching=false;
        document.getElementById('searchScreen').style.display='none';
        document.getElementById('searchProgressOverlay').style.display='none';
        var eqDiv=document.getElementById('enemyEquipmentSlots');
        if(eqDiv)eqDiv.remove();
        document.getElementById('gameCanvas').requestPointerLock();
    }
    // Clear queue and play single inspection
    _redInspectionQueue=[];
    _redInspectionActive=false;
    showRedInspection({id:itemId,col:0,row:0});
}

function showRedInspection(entry){
    var def=ITEMS[entry.id];
    if(!def)return;
    _redInspectionActive=true;
    var overlay=document.getElementById('redInspectionOverlay');
    var card=document.getElementById('redInspectCard');
    var face=document.getElementById('redInspectFace');
    var glow=document.getElementById('redInspectGlow');
    var info=document.getElementById('redInspectInfo');
    var nameEl=document.getElementById('redInspectName');
    var valueEl=document.getElementById('redInspectValue');
    var rarityEl=document.getElementById('redInspectRarity');
    var particleContainer=document.getElementById('redInspectParticles');

    // Set item image
    face.innerHTML='';
    if(def.img){
        var img=document.createElement('img');
        img.src=encodeURI(def.img);
        img.style.cssText='max-width:90%;max-height:90%;object-fit:contain;pointer-events:none;';
        img.onerror=function(){face.innerHTML='<span style="font-size:48px;">'+(def.icon||'💎')+'</span>';};
        face.appendChild(img);
    }else{
        face.innerHTML='<span style="font-size:48px;">'+(def.icon||'💎')+'</span>';
    }

    // Set info text
    nameEl.textContent=def.name;
    valueEl.textContent='价值 ₵ '+(def.value||0).toLocaleString();
    rarityEl.textContent='★ 红色收藏品 ★';

    // Pick random animation
    var animName=RED_INSPECT_ANIMATIONS[Math.floor(Math.random()*RED_INSPECT_ANIMATIONS.length)];
    var duration=4000;

    // Generate particles
    particleContainer.innerHTML='';
    for(var i=0;i<20;i++){
        var p=document.createElement('div');
        var size=3+Math.random()*5;
        var left=50+Math.random()*30-15;
        var delay=Math.random()*2;
        var color=Math.random()>0.5?'rgba(255,180,50,':'rgba(255,80,30,';
        p.style.cssText='position:absolute;bottom:50%;left:'+left+'%;width:'+size+'px;height:'+size+'px;border-radius:50%;background:'+color+'0.9);box-shadow:0 0 '+size*2+'px '+color+'0.6);animation:redParticleFloat '+(2+Math.random())+'s ease-out '+delay+'s infinite;';
        particleContainer.appendChild(p);
    }

    // Show overlay
    overlay.style.display='block';
    glow.style.opacity='1';
    glow.style.animation='redGlowPulse 2s ease-in-out infinite';

    // Start card animation
    card.style.animation='none';
    void card.offsetWidth; // force reflow
    card.style.animation=animName+' '+duration+'ms ease-in-out forwards';

    // Show info after delay
    info.style.opacity='0';
    setTimeout(function(){info.style.opacity='1';},800);

    // Play heartbeat sound
    playRedInspectionSound();

    // Auto-hide after animation, then play next in queue
    setTimeout(function(){
        hideRedInspection();
        if(_redInspectionQueue.length>0){
            setTimeout(playNextRedInspection,300);
        }
    },duration+300);

    // Click to skip (delayed to avoid immediate close from the closing click)
    var skipHandler=function(e){
        if(e.code==='Space'||e.code==='Escape'||e.type==='click'){
            hideRedInspection();
            if(_redInspectionQueue.length>0){
                setTimeout(playNextRedInspection,300);
            }
            document.removeEventListener('keydown',skipHandler);
            document.removeEventListener('click',skipHandler);
        }
    };
    setTimeout(function(){
        document.addEventListener('keydown',skipHandler);
        document.addEventListener('click',skipHandler);
    },500);
}

function hideRedInspection(){
    var overlay=document.getElementById('redInspectionOverlay');
    var card=document.getElementById('redInspectCard');
    var glow=document.getElementById('redInspectGlow');
    var info=document.getElementById('redInspectInfo');
    var particleContainer=document.getElementById('redInspectParticles');
    overlay.style.display='none';
    card.style.animation='none';
    glow.style.animation='none';
    glow.style.opacity='0';
    info.style.opacity='0';
    particleContainer.innerHTML='';
    _redInspectionActive=false;
}

function playRedInspectionSound(){
    try{
        // Heartbeat-style sound using Web Audio API
        var ctx=new(window.AudioContext||window.webkitAudioContext)();
        var playBeat=function(time,freq,dur){
            var osc=ctx.createOscillator();
            var gain=ctx.createGain();
            osc.connect(gain);gain.connect(ctx.destination);
            osc.frequency.value=freq;
            osc.type='sine';
            gain.gain.setValueAtTime(0,time);
            gain.gain.linearRampToValueAtTime(0.3,time+0.02);
            gain.gain.exponentialRampToValueAtTime(0.001,time+dur);
            osc.start(time);osc.stop(time+dur);
        };
        var t=ctx.currentTime;
        // First beat (low thump)
        playBeat(t,60,0.3);
        // Second beat (higher)
        playBeat(t+0.15,80,0.25);
        // Third beat (after delay)
        playBeat(t+1.0,55,0.4);
        playBeat(t+1.15,70,0.3);
        // Final deep beat
        playBeat(t+2.0,45,0.5);
        // Whoosh sound (rising frequency)
        var osc2=ctx.createOscillator();
        var gain2=ctx.createGain();
        osc2.connect(gain2);gain2.connect(ctx.destination);
        osc2.type='sawtooth';
        osc2.frequency.setValueAtTime(200,t);
        osc2.frequency.exponentialRampToValueAtTime(800,t+0.3);
        gain2.gain.setValueAtTime(0,t);
        gain2.gain.linearRampToValueAtTime(0.08,t+0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001,t+0.5);
        osc2.start(t);osc2.stop(t+0.5);
        // Cleanup
        setTimeout(function(){ctx.close();},3000);
    }catch(e){ reportInitError('revealSfx:ctxClose', e); }
}

function updateBackpackValue(){
    const el=document.getElementById('bpLootValue');
    if(el)el.textContent='₵ '+S.lootValue.toLocaleString();
}

function renderBackpackInventory(){
    // Character equipment slots
    const charGrid=document.getElementById('bpCharSlots');
    if(charGrid){
        const slots=[
            {type:'helmet',row:0,col:1,w:2,h:2,icon:'⛑️'},
            {type:'armor',row:2,col:1,w:2,h:2,icon:'🦺'},
            {type:'chestRig',row:4,col:1,w:2,h:1,icon:'🎽'},
            {type:'backpack',row:5,col:1,w:2,h:1,icon:'🎒'},
            {type:'secondary',row:6,col:1,w:2,h:1,icon:'🔫'},
            {type:'knife',row:7,col:1,w:2,h:1,icon:'🔪',fixed:true},
        ];
        charGrid.innerHTML='';
        for(const sl of slots){
            const cell=document.createElement('div');
            cell.className='char-slot';
            cell.style.gridColumn=(sl.col+1)+'/span '+sl.w;
            cell.style.gridRow=(sl.row+1)+'/span '+sl.h;
            const itemId=sl.fixed?'knife':getEquipItemId(sl.type);
            const def=itemId==='knife'?{icon:'🔪',name:'匕首',rarity:'common'}:(itemId?ITEMS[itemId]:null);
            if(def){cell.classList.add('equipped','rarity-'+(def.rarity||'common'));cell.innerHTML=itemIcon(def);cell.title=def.name+' (点击卸下到背包)';}
            else{cell.textContent=sl.icon;cell.style.opacity='0.35';cell.title=sl.type;}
            if(sl.type==='armor'&&S.equipment.armorHP>0)cell.innerHTML+=' <span style="font-size:10px;color:#aaa;">'+S.equipment.armorHP+'</span>';
            // 点击卸下装备到背包（匕首除外）
            if(!sl.fixed && itemId){
                cell.style.cursor='pointer';
                if(sl.type === 'backpack'){
                    cell.title=def.name+' (拖拽丢弃 | 需先清空背包物品)';
                    cell.onclick=function(){ showFloatingMsg('背包请拖拽到丢弃区域卸下'); };
                } else {
                    cell.title=def.name+' (点击卸下到背包 | 拖拽到容器/丢弃)';
                    cell.onclick=function(){ unequipItemToBackpack(sl.type); };
                }
                // 拖拽支持：可拖到容器/尸体空槽/丢弃区域
                cell.draggable=true;
                cell.ondragstart=function(e){
                    e.dataTransfer.setData('text/plain','equip:'+sl.type);
                    e.dataTransfer.effectAllowed='move';
                };
            } else if (!sl.fixed && !itemId) {
                // 空装备槽：接收背包物品拖拽装备
                const slotNameMap = {helmet:'头盔',armor:'护甲',chestRig:'胸挂',backpack:'背包',secondary:'副武器'};
                cell.style.cursor = 'pointer';
                cell.title = (slotNameMap[sl.type] || sl.type) + ' (拖拽装备到此)';
                cell.ondragover = function(e) { e.preventDefault(); cell.style.background = 'rgba(76,175,80,0.3)'; cell.style.borderColor = '#4caf50'; };
                cell.ondragleave = function() { cell.style.background = ''; cell.style.borderColor = ''; };
                cell.ondrop = function(e) {
                    e.preventDefault();
                    cell.style.background = '';
                    cell.style.borderColor = '';
                    const dt = e.dataTransfer.getData('text/plain');
                    if (dt && dt.startsWith('item:')) {
                        const parts = dt.split(':');
                        if (parts.length >= 5) {
                            const itemZone = parts[1];
                            const itemId = parts[2];
                            const itemCol = parseInt(parts[3]);
                            const itemRow = parseInt(parts[4]);
                            const itemDef = ITEMS[itemId];
                            if (itemDef) {
                                // 检查物品类型是否匹配装备槽
                                let canEquip = false;
                                if (sl.type === 'helmet' && itemDef.type === 'helmet') canEquip = true;
                                else if (sl.type === 'armor' && itemDef.type === 'armor') canEquip = true;
                                else if (sl.type === 'chestRig' && itemDef.type === 'chestRig') canEquip = true;
                                else if (sl.type === 'backpack' && itemDef.type === 'backpack') canEquip = true;
                                else if (sl.type === 'secondary' && itemDef.type === 'weapon' && (itemDef.wSlot || 'primary') === 'secondary') canEquip = true;
                                
                                if (canEquip) {
                                    // 从背包/容器移除物品
                                    let sourceGrid = null;
                                    if (itemZone === 'backpack') sourceGrid = S.backpack;
                                    else if (itemZone === 'secure') sourceGrid = S.secureContainer;
                                    else if (itemZone === 'rig') sourceGrid = S._rigItems;
                                    
                                    if (sourceGrid && sourceGrid._items) {
                                        const entry = sourceGrid._items.find(en => en.id === itemId && en.col == itemCol && en.row == itemRow);
                                        if (entry) {
                                            removeFromGrid(sourceGrid, entry);
                                            // 装备到角色
                                            if (sl.type === 'helmet') { S.equipment.helmet = itemId; S.equipment.helmetHP = itemDef.amount; }
                                            else if (sl.type === 'armor') { S.equipment.armor = itemId; S.equipment.armorHP = itemDef.amount; }
                                            else if (sl.type === 'chestRig') { S.equipment.chestRig = itemId; S.maxPockets = 5; }
                                            else if (sl.type === 'backpack') { S.equipment.backpack = itemId; S.backpackCols = itemDef.bCols; S.backpackRows = itemDef.bRows; S.backpack = initGrid(itemDef.bRows); }
                                            else if (sl.type === 'secondary') { S.weaponSlots[2] = itemDef.weapon; S.magAmmo[2] = WEAPONS[itemDef.weapon].magSize; if (typeof updateWeaponModel === 'function') updateWeaponModel(); }
                                            
                                            showFloatingMsg('已装备: ' + itemDef.name);
                                            // 根据当前界面调用正确的渲染函数
                                            if (S.phase === 'searching') {
                                                renderSearchInventory();
                                                if (S.currentSearchContainer) renderSearchGrid(S.currentSearchContainer);
                                            } else {
                                                renderBackpackInventory();
                                            }
                                            updateHUD();
                                            updateWeaponUI();
                                            updateBackpackValue();
                                        }
                                    }
                                } else {
                                    showFloatingMsg('无法装备到此槽位');
                                }
                            }
                        }
                    } else if (dt && dt.startsWith('weapon_item:')) {
                        // 武器物品拖拽到副武器槽
                        if (sl.type === 'secondary') {
                            const weaponItemId = dt.substring(12);
                            const wDef = ITEMS[weaponItemId];
                            if (wDef && wDef.type === 'weapon' && (wDef.wSlot || 'primary') === 'secondary') {
                                if (S.backpack && S.backpack._items) {
                                    const entry = S.backpack._items.find(en => en.id === weaponItemId);
                                    if (entry) {
                                        removeFromGrid(S.backpack, entry);
                                        S.weaponSlots[2] = wDef.weapon;
                                        S.magAmmo[2] = WEAPONS[wDef.weapon].magSize;
                                        if (typeof updateWeaponModel === 'function') updateWeaponModel();
                                        showFloatingMsg('已装备: ' + wDef.name);
                                        if (S.phase === 'searching') {
                                            renderSearchInventory();
                                            if (S.currentSearchContainer) renderSearchGrid(S.currentSearchContainer);
                                        } else {
                                            renderBackpackInventory();
                                        }
                                        updateHUD();
                                        updateWeaponUI();
                                    }
                                }
                            } else {
                                showFloatingMsg('此槽位只能装备副武器');
                            }
                        }
                    }
                };
            }
            charGrid.appendChild(cell);
        }
    }
    // Primary weapons
    const p1=document.getElementById('bpPrimary1');
    if(p1){const w=S.weaponSlots[0]?WEAPONS[S.weaponSlots[0]]:null;p1.innerHTML=w?itemIcon(w)+' '+w.name:'主武器1';p1.style.color=w?'#fff':'#555';p1.style.fontSize=w?'14px':'10px';
        if(w){p1.style.cursor='grab';p1.title=w.name+' (点击卸下到背包 | 拖拽移动/丢弃)';p1.onclick=function(){unequipWeaponToBackpack(0);};
            p1.draggable=true;p1.ondragstart=function(e){e.dataTransfer.setData('text/plain','equip:primary1');e.dataTransfer.effectAllowed='move';};
        }
        else{p1.style.cursor='pointer';p1.title='主武器1 (拖拽武器到此处装备)';p1.onclick=null;p1.draggable=false;
            p1.ondragover=function(e){e.preventDefault();p1.style.background='rgba(76,175,80,0.3)';p1.style.borderColor='#4caf50';};
            p1.ondragleave=function(){p1.style.background='';p1.style.borderColor='';};
            p1.ondrop=function(e){
                e.preventDefault();p1.style.background='';p1.style.borderColor='';
                const dt=e.dataTransfer.getData('text/plain');
                let itemId = null;
                if(dt&&dt.startsWith('weapon_item:')){
                    itemId = dt.substring(12);
                } else if(dt&&dt.startsWith('item:')){
                    const parts = dt.split(':');
                    if(parts.length >= 5) itemId = parts[2];
                }
                if(itemId && itemId.startsWith('weapon_')){
                    if(equipWeaponFromBackpack(itemId,0)){
                        // 成功
                    } else {
                        showFloatingMsg('装备失败，检查背包空间');
                    }
                }
            };
        }
    }
    const p2=document.getElementById('bpPrimary2');
    if(p2){const w=S.weaponSlots[1]?WEAPONS[S.weaponSlots[1]]:null;p2.innerHTML=w?itemIcon(w)+' '+w.name:'主武器2';p2.style.color=w?'#fff':'#555';p2.style.fontSize=w?'14px':'10px';
        if(w){p2.style.cursor='grab';p2.title=w.name+' (点击卸下到背包 | 拖拽移动/丢弃)';p2.onclick=function(){unequipWeaponToBackpack(1);};
            p2.draggable=true;p2.ondragstart=function(e){e.dataTransfer.setData('text/plain','equip:primary2');e.dataTransfer.effectAllowed='move';};
        }
        else{p2.style.cursor='pointer';p2.title='主武器2 (拖拽武器到此处装备)';p2.onclick=null;p2.draggable=false;
            p2.ondragover=function(e){e.preventDefault();p2.style.background='rgba(76,175,80,0.3)';p2.style.borderColor='#4caf50';};
            p2.ondragleave=function(){p2.style.background='';p2.style.borderColor='';};
            p2.ondrop=function(e){
                e.preventDefault();p2.style.background='';p2.style.borderColor='';
                const dt=e.dataTransfer.getData('text/plain');
                let itemId = null;
                if(dt&&dt.startsWith('weapon_item:')){
                    itemId = dt.substring(12);
                } else if(dt&&dt.startsWith('item:')){
                    const parts = dt.split(':');
                    if(parts.length >= 5) itemId = parts[2];
                }
                if(itemId && itemId.startsWith('weapon_')){
                    if(equipWeaponFromBackpack(itemId,1)){
                        // 成功
                    } else {
                        showFloatingMsg('装备失败，检查背包空间');
                    }
                }
            };
        }
    }

    // Keychain (4 slots, keycards only)
    renderKeychainGrid(document.getElementById('bpKeychainGrid'));

    // Rig
    const rigSlots=S.equipment.chestRig?ITEMS[S.equipment.chestRig].slots:0;
    const showRig=rigSlots>0;
    const rigParent=document.getElementById('bpRigGrid').parentElement;
    if(rigParent)rigParent.style.display=showRig?'':'none';
    if(showRig)renderZoneQuickGrid(document.getElementById('bpRigGrid'),S._rigItems||[],rigSlots,'rig');

    // Pockets
    renderZoneQuickGrid(document.getElementById('bpPocketGrid'),S.pockets,S.maxPockets,'pocket');

    // Backpack
    const hasBP=S.equipment.backpack&&S.backpackCols>0;
    const bpParent=document.getElementById('bpBackpackGrid').parentElement;
    if(bpParent)bpParent.style.display=hasBP?'':'none';
    if(hasBP)renderZoneStorageGrid(document.getElementById('bpBackpackGrid'),S.backpack,S.backpackCols,S.backpackRows,'backpack');

    // Secure container
    renderZoneStorageGrid(document.getElementById('bpSecureGrid'),S.secureContainer,S.secureCols,S.secureRows,'secure');

    // Weight
    const sw=document.getElementById('bpWeight');
    if(sw)sw.textContent=getTotalCarryWeight();
}

// ========== 游戏内装备自由卸下系统 ==========
function unequipItemToBackpack(slotType) {
    if (S.phase !== 'backpack' && S.phase !== 'search' && S.phase !== 'searching') return;
    const itemId = getEquipItemId(slotType);
    if (!itemId) { showFloatingMsg('该槽位没有装备'); return; }

    // 背包卸下前检查：胸挂里的物品需要先转移
    if (slotType === 'chestRig' && S._rigItems && S._rigItems.length > 0) {
        // 尝试把胸挂物品移到背包
        for (let i = S._rigItems.length - 1; i >= 0; i--) {
            const rid = S._rigItems[i];
            const s = findFreeSlot(S.backpack, S.backpackCols, S.backpackRows, rid);
            if (s) {
                placeInGrid(S.backpack, S.backpackCols, rid, s.col, s.row);
                S._rigItems.splice(i, 1);
            } else {
                // 尝试放进口袋
                if (S.pockets.length < S.maxPockets) {
                    S.pockets.push(rid);
                    S._rigItems.splice(i, 1);
                } else {
                    showFloatingMsg('背包/口袋空间不足，无法卸下胸挂（请先清空胸挂物品）');
                    renderBackpackInventory();
                    return;
                }
            }
        }
    }

    // 在背包中找空槽放装备
    const s = findFreeSlot(S.backpack, S.backpackCols, S.backpackRows, itemId);
    if (!s) { showFloatingMsg('背包空间不足，无法卸下'); return; }

    placeInGrid(S.backpack, S.backpackCols, itemId, s.col, s.row);
    clearEquipSlot(slotType);
    showFloatingMsg('已卸下: ' + (ITEMS[itemId] ? ITEMS[itemId].name : itemId));
    renderBackpackInventory();
    updateBackpackValue();
    updateHUD();
}

// 武器卸下到背包
function unequipWeaponToBackpack(slotIndex) {
    if (S.phase !== 'backpack' && S.phase !== 'search' && S.phase !== 'searching') return;
    const weaponId = S.weaponSlots[slotIndex];
    if (!weaponId) { showFloatingMsg('该槽位没有武器'); return; }
    const def = WEAPONS[weaponId];
    if (!def) return;
    // 武器作为物品放到背包（使用weapon_前缀的物品ID）
    const itemId = 'weapon_' + weaponId;
    // 确保物品定义存在
    if (!ITEMS[itemId]) {
        ITEMS[itemId] = { name: def.name, icon: def.icon, type: 'weapon', rarity: def.rarity || 'rare', value: def.value || 5000, w: 2, h: 1, weight: def.weight || 3 };
    }
    const s = findFreeSlot(S.backpack, S.backpackCols, S.backpackRows, itemId);
    if (!s) { showFloatingMsg('背包空间不足，无法卸下武器'); return; }
    placeInGrid(S.backpack, S.backpackCols, itemId, s.col, s.row);
    S.weaponSlots[slotIndex] = null;
    S.magAmmo[slotIndex] = 0;
    // 如果卸下的是当前武器，切换到其他武器（优先枪械，最后匕首）
    if (S.currentWeapon === slotIndex) {
        let found = false;
        for (let i = 0; i < S.weaponSlots.length; i++) {
            if (S.weaponSlots[i]) { S.currentWeapon = i; found = true; break; }
        }
        if (!found) { S.currentWeapon = 3; } // 确保至少有匕首
    }
    // 确保匕首始终存在
    if (S.weaponSlots[3] !== 'knife') S.weaponSlots[3] = 'knife';
    // 更新武器模型（关键！否则模型残留）
    if (typeof updateWeaponModel === 'function') updateWeaponModel();
    showFloatingMsg('已卸下武器: ' + def.name);
    renderBackpackInventory();
    if (typeof renderSearchInventory === 'function') renderSearchInventory();
    updateBackpackValue();
    updateHUD();
    updateWeaponUI();
}

// 从背包装备武器
function equipWeaponFromBackpack(itemId, targetSlot) {
    if (!itemId || !itemId.startsWith('weapon_')) return false;
    const weaponId = itemId.substring(7);
    const def = WEAPONS[weaponId];
    if (!def) return false;
    // 从背包移除
    const entry = S.backpack._items ? S.backpack._items.find(e => e.id === itemId) : null;
    if (!entry) return false;
    // 如果目标槽有武器，先卸下
    if (S.weaponSlots[targetSlot]) {
        const oldItemId = 'weapon_' + S.weaponSlots[targetSlot];
        const oldEntry = S.backpack._items ? S.backpack._items.find(e => e.id === oldItemId) : null;
        // 旧武器放回原位置
        if (!oldEntry) {
            // 需要找位置放旧武器
            const s = findFreeSlot(S.backpack, S.backpackCols, S.backpackRows, oldItemId);
            if (!s) { showFloatingMsg('背包空间不足，无法交换武器'); return false; }
            placeInGrid(S.backpack, S.backpackCols, oldItemId, s.col, s.row);
        }
    }
    removeFromGrid(S.backpack, entry);
    S.weaponSlots[targetSlot] = weaponId;
    S.currentWeapon = targetSlot;
    showFloatingMsg('已装备: ' + def.name);
    // 根据当前界面调用正确的渲染函数
    if (S.phase === 'searching') {
        renderSearchInventory();
        if (S.currentSearchContainer) renderSearchGrid(S.currentSearchContainer);
    } else {
        renderBackpackInventory();
    }
    updateBackpackValue();
    updateHUD();
    updateWeaponUI();
    if (typeof updateWeaponModel === 'function') updateWeaponModel();
    return true;
}

function equipItemFromBackpack(itemId, zone, col, row) {
    if (!itemId) return false;
    const def = ITEMS[itemId];
    if (!def) return false;
    
    // 只处理装备类型物品
    if (def.type !== 'helmet' && def.type !== 'armor' && def.type !== 'chestRig' && def.type !== 'backpack') {
        return false;
    }
    
    // 从源位置移除物品
    let sourceGrid = null;
    if (zone === 'backpack') sourceGrid = S.backpack;
    else if (zone === 'secure') sourceGrid = S.secureContainer;
    else if (zone === 'rig') sourceGrid = S._rigItems;
    
    if (!sourceGrid || !sourceGrid._items) return false;
    
    const entry = sourceGrid._items.find(en => en.id === itemId && en.col == col && en.row == row);
    if (!entry) return false;
    
    // 如果目标槽已有装备，先卸下到背包
    let targetSlot = null;
    if (def.type === 'helmet') targetSlot = 'helmet';
    else if (def.type === 'armor') targetSlot = 'armor';
    else if (def.type === 'chestRig') targetSlot = 'chestRig';
    else if (def.type === 'backpack') targetSlot = 'backpack';
    
    if (targetSlot && S.equipment[targetSlot]) {
        const oldItemId = S.equipment[targetSlot];
        // 旧装备放回背包
        const s = findFreeSlot(S.backpack, S.backpackCols, S.backpackRows, oldItemId);
        if (!s) { showFloatingMsg('背包空间不足，无法交换装备'); return false; }
        placeInGrid(S.backpack, S.backpackCols, oldItemId, s.col, s.row);
    }
    
    // 从源位置移除
    removeFromGrid(sourceGrid, entry);
    
    // 装备到角色
    if (def.type === 'helmet') { S.equipment.helmet = itemId; S.equipment.helmetHP = def.amount; }
    else if (def.type === 'armor') { S.equipment.armor = itemId; S.equipment.armorHP = def.amount; }
    else if (def.type === 'chestRig') { S.equipment.chestRig = itemId; S.maxPockets = 5; }
    else if (def.type === 'backpack') { S.equipment.backpack = itemId; S.backpackCols = def.bCols; S.backpackRows = def.bRows; S.backpack = initGrid(def.bRows); }
    
    showFloatingMsg('已装备: ' + def.name);
    // 根据当前界面调用正确的渲染函数
    if (S.phase === 'searching') {
        renderSearchInventory();
        if (S.currentSearchContainer) renderSearchGrid(S.currentSearchContainer);
    } else {
        renderBackpackInventory();
    }
    updateBackpackValue();
    updateHUD();
    updateWeaponUI();
    return true;
}

function sortBackpackBP(){
    // Sort backpack grid
    if(S.backpack&&S.backpack._items&&S.backpackCols>0){
        autoSortGrid(S.backpack,S.backpackCols,S.backpackRows);
    }
    // Sort secure container grid
    if(S.secureContainer&&S.secureContainer._items&&S.secureCols>0){
        autoSortGrid(S.secureContainer,S.secureCols,S.secureRows);
    }
    // Sort rig items by value (descending)
    if(S._rigItems&&S._rigItems.length>1){
        S._rigItems.sort(function(a,b){return (ITEMS[b]?ITEMS[b].value:0)-(ITEMS[a]?ITEMS[a].value:0);});
    }
    // Sort pockets by value (descending)
    if(S.pockets&&S.pockets.length>1){
        S.pockets.sort(function(a,b){return (ITEMS[b]?ITEMS[b].value:0)-(ITEMS[a]?ITEMS[a].value:0);});
    }
    renderBackpackInventory();
    updateBackpackValue();
    updateHUD();
}

// ========== SECTION 12: EXTRACTION ==========
function spawnExtractPoints(){
    extractPoints = [];
    for (const ep of FIXED_EXTRACTS) {
        const grp = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.RingGeometry(2.5, 3.5, 32), new THREE.MeshBasicMaterial({color:0xff9800, transparent:true, opacity:0.5, side:THREE.DoubleSide}));
        ring.rotation.x=-Math.PI/2; grp.add(ring);
        const inner = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.5, 32), new THREE.MeshBasicMaterial({color:0xff6600, transparent:true, opacity:0.7, side:THREE.DoubleSide}));
        inner.rotation.x=-Math.PI/2; inner.position.y=0.01; grp.add(inner);
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 2.5, 12, 16, 1, true), new THREE.MeshBasicMaterial({color:0xff9800, transparent:true, opacity:0.15, side:THREE.DoubleSide}));
        pillar.position.y=6; grp.add(pillar);
        // Label marker
        const label = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 4), new THREE.MeshStandardMaterial({color:0xff9800, emissive:0x331100, emissiveIntensity:0.5}));
        label.position.y=1.5; grp.add(label);
        grp.position.set(ep.x, 0.02, ep.z); scene.add(grp);
        // Dynamic extraction: random open/close status
        var isOpen=Math.random()<0.6; // 60% chance to start open
        extractPoints.push({
            mesh:grp, x:ep.x, z:ep.z, name:ep.name, desc:ep.desc, radius:3.5,
            isOpen:isOpen,
            openTimer:isOpen?(60+Math.random()*120):(30+Math.random()*60), // Time until status change
            ring:ring, inner:inner, label:label, pillar:pillar,
        });
    }
    updateExtractPointVisuals();
}

function updateExtractPointVisuals(){
    for(const ep of extractPoints){
        if(ep.isOpen){
            ep.ring.material.color.setHex(0x4caf50);
            ep.inner.material.color.setHex(0x66bb6a);
            ep.pillar.material.color.setHex(0x4caf50);
            ep.label.material.color.setHex(0x4caf50);
            ep.label.material.emissive.setHex(0x003300);
            ep.ring.material.opacity=0.5;
        }else{
            ep.ring.material.color.setHex(0x666666);
            ep.inner.material.color.setHex(0x444444);
            ep.pillar.material.color.setHex(0x666666);
            ep.label.material.color.setHex(0x666666);
            ep.label.material.emissive.setHex(0x222222);
            ep.ring.material.opacity=0.2;
        }
    }
}

function updateExtractPointTimers(dt){
    var statusChanged=false;
    for(const ep of extractPoints){
        ep.openTimer-=dt;
        if(ep.openTimer<=0){
            ep.isOpen=!ep.isOpen;
            ep.openTimer=ep.isOpen?(90+Math.random()*120):(40+Math.random()*60);
            statusChanged=true;
            // Show notification
            showExtractStatusNotification(ep);
        }
    }
    if(statusChanged)updateExtractPointVisuals();
}

function showExtractStatusNotification(ep){
    var div=document.getElementById('extractNotif');
    if(!div){
        div=document.createElement('div');
        div.id='extractNotif';
        div.style.cssText='position:fixed;top:20%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);border:1px solid '+(ep.isOpen?'#4caf50':'#666')+';border-radius:4px;padding:6px 20px;font-size:13px;z-index:100;pointer-events:none;animation:bossKillIn 0.3s ease-out;';
        document.body.appendChild(div);
    }
    div.style.borderColor=ep.isOpen?'#4caf50':'#666';
    div.style.color=ep.isOpen?'#4caf50':'#999';
    div.innerHTML=(ep.isOpen?'✅ ':'❌ ')+ep.name+' 撤离点'+(ep.isOpen?'已开放':'已关闭');
    div.style.display='block';
    div.style.opacity='1';
    setTimeout(function(){div.style.opacity='0';setTimeout(function(){div.style.display='none';},500);},2500);
}

function checkExtractZone(){
    if (!extractPoints || extractPoints.length === 0) return;
    let nearest = null, nearestDist = Infinity;
    for (const ep of extractPoints) {
        if(!ep.isOpen)continue; // Skip closed extraction points
        const dx=playerGroup.position.x-ep.x, dz=playerGroup.position.z-ep.z, d=dx*dx+dz*dz;
        if (d < nearestDist) { nearestDist=d; nearest=ep; }
    }
    const inZone = nearest && nearestDist < nearest.radius*nearest.radius;
    const prompt = document.getElementById('extractPrompt');
    if (!S.isExtracting) {
        prompt.style.display = inZone ? 'block' : 'none';
        if (inZone) {
            document.getElementById('extractTitle').textContent = nearest.name;
            document.getElementById('extractHint').textContent = (nearest.desc||nearest.name) + ' - 按 F 开始撤离';
            document.getElementById('extractProgressBar').style.display = 'none';
        }
    } else if (!inZone) {
        S.isExtracting=false; S.extractProgress=0; prompt.style.display='none';
    }
}

function startExtraction(){
    if (S.isExtracting) return;
    S.isExtracting=true; S.extractProgress=0; S._lastExtractTick=0;
    document.getElementById('extractTitle').textContent='撤离中...';
    document.getElementById('extractHint').textContent='请保持在撤离点内';
    document.getElementById('extractProgressBar').style.display='block';
}

function updateExtract(dt){
    if (!S.isExtracting) return;
    S.extractProgress += dt;
    const fill=document.getElementById('extractProgressFill');
    if (fill) fill.style.width = Math.min(100,(S.extractProgress/CONFIG.extractTime)*100)+'%';
    // Tick sound every second
    const tickSec = Math.floor(S.extractProgress);
    if (tickSec > (S._lastExtractTick||0)) {
        S._lastExtractTick = tickSec;
        sfxExtractTick();
    }
    // Hard mode: extraction alerts nearby enemies
    if (S.mode==='hard'&&tickSec>=(S._lastAlertTick||0)+3){
        S._lastAlertTick=tickSec;
        alertEnemies(playerGroup.position,40);
    }
    if (S.extractProgress >= CONFIG.extractTime) {
        sfxExtractComplete();
        endGame(true);
    }
}

// ========== SECTION 13: ECONOMY ==========
function canAfford(price){return P.money>=price;}

function buyItem(itemId){
    const sp=SHOP_PRICES[itemId];if(!sp||!canAfford(sp.buy))return false;
    // Keycards go to keychain first if there's a free slot
    if(ITEMS[itemId]&&ITEMS[itemId].type==='keycard'){
        for(var ki=0;ki<4;ki++){
            if(!P.keychain[ki]){
                P.money-=sp.buy;
                P.keychain[ki]=itemId;P.keyUses[ki]=10;
                savePersistent();updateAllLobbyUI();renderShopTab();renderStashGrid();
                return true;
            }
        }
    }
    var dims=getStashDims();
    const slot=findFreeSlot(P.stashGrid,dims.cols,dims.rows,itemId);
    if(!slot){alert('仓库空间不足！');return false;}
    P.money-=sp.buy;placeInGrid(P.stashGrid,dims.cols,itemId,slot.col,slot.row);
    savePersistent();updateAllLobbyUI();renderShopTab();renderStashGrid();return true;
}

function sellItem(itemId){
    const sp=SHOP_PRICES[itemId];if(!sp)return false;
    const entry=P.stashGrid._items?P.stashGrid._items.find(e=>e.id===itemId):null;
    if(!entry)return false;
    removeFromGrid(P.stashGrid,entry);P.money+=sp.sell;
    savePersistent();updateAllLobbyUI();renderShopTab();renderStashGrid();return true;
}

// ========== SECTION 14: HUD ==========
function updateHUD(){
    // 数值条：只在百分比变化超过 0.1% 时写样式（PerfManager 内部去重）
    PerfManager.setWidth('healthFill', S.health / S.maxHealth * 100);
    PerfManager.setText('healthValue', Math.ceil(S.health));

    const armorHP = S.equipment.armorHP || 0;
    const armorDef = S.equipment.armor ? ITEMS[S.equipment.armor] : null;
    const maxArmor = (armorDef && armorDef.amount) || 100;
    PerfManager.setWidth('armorFill', armorHP / maxArmor * 100);
    PerfManager.setText('armorValue', Math.ceil(armorHP));

    PerfManager.setWidth('staminaFill', S.stamina / CONFIG.maxStamina * 100);
    PerfManager.setText('staminaValue', Math.ceil(S.stamina));

    // 体力条状态：耗尽（红）/ 低于 30（橙）/ 正常（绿），按状态切换而非每帧赋值
    const sf = PerfManager.el('staminaFill');
    if (sf) {
        const mode = S._staminaExhausted ? 'ex' : (S.stamina < 30 ? 'low' : 'ok');
        if (sf._staminaMode !== mode) {
            sf._staminaMode = mode;
            sf.style.background = mode === 'ex'
                ? 'linear-gradient(90deg,#f44336,#e57373)'
                : (mode === 'low'
                    ? 'linear-gradient(90deg,#ff9800,#ffb74d)'
                    : 'linear-gradient(90deg,#4caf50,#81c784)');
        }
    }

    // 快捷栏数量（胸挂 + 口袋），一次遍历统计，避免三次 filter
    const allQuick = [...(S._rigItems || []), ...S.pockets];
    let qMed = 0, qBand = 0, qPain = 0;
    for (let i = 0; i < allQuick.length; i++) {
        const it = allQuick[i];
        if (it === 'medkit') qMed++;
        else if (it === 'bandage') qBand++;
        else if (it === 'painkiller') qPain++;
    }
    PerfManager.setText('medkitCount', qMed);
    PerfManager.setText('bandageCount', qBand);
    PerfManager.setText('painkillerCount', qPain);
    PerfManager.setText('grenadeCount', '0');

    // 战利品追踪
    PerfManager.setText('hudLootValue', S.lootValue.toLocaleString());
    PerfManager.setText('hudLootCount', (S._lootItems ? S._lootItems.length : 0) + '件');

    // 等级与经验
    const levelEl = PerfManager.el('hudPlayerLevel');
    if (levelEl) {
        PerfManager.setText('hudPlayerLevel', getPlayerLevel());
        const curXP = getCurrentLevelXP();
        const xpPct = Math.min(100, (curXP / XP_PER_LEVEL) * 100);
        PerfManager.setWidth('hudXPBar', xpPct);
        PerfManager.setText('hudCurrentXP', curXP);
        PerfManager.setText('hudNextXP', XP_PER_LEVEL);
    }
}

// 弹药类型 → 物品 id（避免每次刷新都重建映射表）
const WEAPON_AMMO_MAP = { pistol:'pistolAmmo', rifle:'rifleAmmo', shotgun:'shotgunAmmo', smg:'smgAmmo', sniper:'sniperAmmo', heavy:'heavyAmmo' };
let _lastAmmoLow = null;

function _setAmmoLow(on) {
    if (_lastAmmoLow === on) return;
    _lastAmmoLow = on;
    const el = PerfManager.el('magAmmo');
    // 低弹量样式挂在 .ammo-main 容器上（#magAmmo 只是数字）
    if (el && el.parentElement) el.parentElement.classList.toggle('low', !!on);
}

function updateWeaponUI(){
    // 武器槽：只有武器/耐久/选中态变化时才碰 DOM
    for(let i=0;i<4;i++){
        const slot=PerfManager.el('weaponSlot'+(i+1));
        if(!slot) continue;
        const wt=S.weaponSlots[i]||null;
        const dur=wt&&wt!=='knife'?Math.round(getWeaponDurability(wt)):null;
        const sig=wt+'|'+dur+'|'+(i===S.currentWeapon?1:0);
        if(slot._uiSig===sig) continue;
        slot._uiSig=sig;

        if(!slot._icon) slot._icon=slot.querySelector('.weapon-icon');
        if(!slot._name) slot._name=slot.querySelector('.weapon-name');

        if(wt){
            slot.classList.add('has-weapon');
            if(slot._icon) slot._icon.innerHTML=itemIcon(WEAPONS[wt]);
            if(slot._name) slot._name.textContent=WEAPONS[wt].name;

            if(!slot._dur){
                slot._dur=document.createElement('div');
                slot._dur.className='weapon-dur';
                slot._dur.style.cssText='position:absolute;bottom:0;left:0;right:0;height:2px;background:#333;border-radius:1px;overflow:hidden;';
                slot._durBar=document.createElement('div');
                slot._durBar.style.cssText='height:100%;width:100%;transition:width 0.3s;';
                slot._dur.appendChild(slot._durBar);
                slot.appendChild(slot._dur);
            }
            if(dur!=null){
                slot._dur.style.display='block';
                slot._durBar.style.width=dur+'%';
                slot._durBar.style.background=dur>60?'#4caf50':(dur>30?'#ff9800':'#f44336');
            }else if(slot._dur){
                slot._dur.style.display='none';
            }
        }else{
            slot.classList.remove('has-weapon');
            if(slot._icon) slot._icon.textContent='—';
            if(slot._name) slot._name.textContent='空';
            if(slot._dur) slot._dur.style.display='none';
        }
        slot.classList.toggle('active',i===S.currentWeapon);
    }

    // 弹药：Mag 与备弹分别去重写入
    const w=S.weaponSlots[S.currentWeapon]?WEAPONS[S.weaponSlots[S.currentWeapon]]:null;
    if(w&&!w.isMelee){
        const ammoId=WEAPON_AMMO_MAP[w.ammo]||null;
        let reserveCount=0;
        if(ammoId){
            for(const it of (S._rigItems||[])) if(it===ammoId) reserveCount++;
            for(const it of (S.pockets||[])) if(it===ammoId) reserveCount++;
            if(S.backpack&&S.backpack._items) for(const it of S.backpack._items) if(it.id===ammoId) reserveCount++;
        }
        PerfManager.setText('magAmmo', S.magAmmo[S.currentWeapon]);
        PerfManager.setText('reserveAmmo', reserveCount);
        PerfManager.setText('ammoType', w.name);
        _setAmmoLow(S.magAmmo[S.currentWeapon]<=5);
    }else if(w&&w.isMelee){
        PerfManager.setText('magAmmo','∞');
        PerfManager.setText('reserveAmmo','—');
        PerfManager.setText('ammoType','匕首');
        _setAmmoLow(false);
    }else{
        PerfManager.setText('magAmmo','-');
        PerfManager.setText('reserveAmmo','-');
        PerfManager.setText('ammoType','无武器');
        _setAmmoLow(false);
    }
}

function updateTimer(){
    if(S.phase!=='playing')return;const elapsed=performance.now()/1000-S.startTime,remain=Math.max(0,S.gameTime-elapsed);
    const m=Math.floor(remain/60),s=Math.floor(remain%60);
    PerfManager.setText('timerDisplay', m.toString().padStart(2,'0')+':'+s.toString().padStart(2,'0'));
    PerfManager.toggleClass('timerDisplay','warning',remain<60);
    if(remain<=0)endGame(false);
    // Kill streak timeout (8s)
    if(S._killStreak&&S._killStreakTimer){
        if(performance.now()/1000-S._killStreakTimer>8){S._killStreak=0;updateKillStreak();}
    }
    // Track survive_time every ~1s
    S._surviveTimer=(S._surviveTimer||0)+1;
    if(S._surviveTimer>=60){S._surviveTimer=0;trackMission('survive_time',1);}
    // Hard mode reinforcement system - spawn enemies every 40s
    if(S.mode==='hard'){
        S._reinforceCounter=(S._reinforceCounter||0)+1;
        if(S._reinforceCounter>=2400){ // ~40s at 60fps
            S._reinforceCounter=0;
            const maxE=CONFIG.maxEnemiesHard;
            const remaining=S.enemiesTotal-(S.enemiesSpawned||0);
            if(remaining>0&&enemies.length<maxE){
                const toSpawn=Math.min(Math.min(4,remaining),maxE-enemies.length);
                for(let i=0;i<toSpawn;i++)createEnemy();
                showReinforcementWarning(toSpawn);
            }
        }
    }
}

function addKillFeed(headshot, enemyLevel){
    const feed=document.getElementById('killFeed');
    if(!feed)return;
    const div=document.createElement('div');
    div.className='kill-item'+(headshot?' headshot':'');
    var icon=headshot?'🎯':'💥';
    var lvlText=enemyLevel>=3?'精锐':enemyLevel===2?'老兵':'侦察';
    div.innerHTML='<span class="kill-icon">'+icon+'</span><span>击杀 '+lvlText+' #'+S.kills+'</span>';
    feed.appendChild(div);
    setTimeout(()=>{if(div.parentNode)div.parentNode.removeChild(div);},4000);
    // Keep max 5 items
    while(feed.children.length>5)feed.removeChild(feed.firstChild);
}

// Hit marker（支持 hit / headshot / kill 三种反馈）
function showHitMarker(kind) {
    if (typeof HudFeedback !== 'undefined') {
        HudFeedback.hit(kind == null ? 'hit' : kind);
        return;
    }
    var hm = document.getElementById('hitMarker');
    if (!hm) return;
    var isKill = kind === true || kind === 'kill';
    hm.classList.remove('show', 'kill');
    void hm.offsetWidth; // reflow to restart animation
    hm.classList.add(isKill ? 'kill' : 'show');
    setTimeout(function() { hm.classList.remove('show', 'kill'); }, 500);
}

// Directional damage indicator（弧形，可叠加）
function showDamageDirection(fromX, fromZ) {
    if (typeof HudFeedback !== 'undefined') {
        HudFeedback.damageFrom(fromX, fromZ);
        return;
    }
    var di = document.getElementById('damageIndicator');
    if (!di) return;
    var dx = fromX - playerGroup.position.x;
    var dz = fromZ - playerGroup.position.z;
    var worldAngle = Math.atan2(dx, -dz);
    var camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    var camAngle = Math.atan2(camDir.x, -camDir.z);
    var relAngle = worldAngle - camAngle;
    di.style.opacity = '1';
    di.style.transform = 'translate(-50%,-50%) rotate(' + (relAngle * 180 / Math.PI) + 'deg)';
    clearTimeout(di._timer);
    di._timer = setTimeout(function() { di.style.opacity = '0'; }, 1500);
}

// Damage number display
function showDamageNumber(worldPos, damage, type) {
    var container = document.getElementById('damageNumbers');
    if (!container) return;
    // Project 3D position to screen
    var screenPos = worldPos.clone().project(camera);
    var x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    var y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
    // Check if behind camera
    if (screenPos.z > 1) return;
    var el = document.createElement('div');
    el.className = 'dmg-num' + (type === 'headshot' ? ' headshot' : type === 'kill' ? ' kill' : '');
    el.textContent = type === 'headshot' ? damage + ' ☠' : '-' + damage;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    container.appendChild(el);
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 800);
}

// Screen shake
function triggerScreenShake() {
    var canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    canvas.classList.remove('shake');
    void canvas.offsetWidth;
    canvas.classList.add('shake');
    setTimeout(function() { canvas.classList.remove('shake'); }, 300);
}

// Loot tracker pulse
function pulseLootTracker() {
    var lt = document.getElementById('lootTracker');
    if (!lt) return;
    lt.classList.remove('pulse');
    void lt.offsetWidth;
    lt.classList.add('pulse');
    setTimeout(function() { lt.classList.remove('pulse'); }, 300);
}

// 罗盘刻度表：常量只构建一次
const COMPASS_DIRS = (function () {
    const out = [];
    const cards = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let d = 0; d < 360; d += 15) out.push({ label: cards[d] || String(d), deg: d });
    return out;
})();
let _compassStrip = null;
let _lastCompassOffset = 1e9;

// Compass update
function updateCompass() {
    if (!_compassStrip) _compassStrip = document.getElementById('compassStrip');
    const strip = _compassStrip;
    if (!strip) return;
    var camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    var heading = Math.atan2(camDir.x, -camDir.z); // radians, 0 = north
    var headingDeg = (heading * 180 / Math.PI + 360) % 360;

    var pixelPerDeg = 6; // 6px per degree
    var offset = -(headingDeg * pixelPerDeg) + 140; // center
    // 位置变化小于 0.5px 时不写样式，减少合成层抖动
    if (Math.abs(offset - _lastCompassOffset) > 0.5) {
        _lastCompassOffset = offset;
        strip.style.transform = 'translateX(' + offset.toFixed(1) + 'px)';
    }

    if (!strip._built) {
        var html = '';
        for (var i = 0; i < 3; i++) {
            for (var j = 0; j < COMPASS_DIRS.length; j++) {
                var d = COMPASS_DIRS[j];
                var isCardinal = (d.label.length === 1);
                html += '<span class="compass-label' + (isCardinal ? ' n' : '') + '">' + d.label + '</span>';
            }
        }
        strip.innerHTML = html;
        strip._built = true;
    }

    // 目标方位投影（撤离点 / 空投 / Boss 任务点）
    if (typeof HudFeedback !== 'undefined') {
        HudFeedback.updateCompassMarkers(headingDeg);
    }
}

function showReinforcementWarning(count){
    var warn=document.getElementById('reinforceWarning');
    if(!warn){
        warn=document.createElement('div');
        warn.id='reinforceWarning';
        warn.style.cssText='position:absolute;top:140px;left:50%;transform:translateX(-50%);background:rgba(139,0,0,0.9);color:#fff;padding:10px 24px;border-radius:6px;font-size:16px;font-weight:bold;border:2px solid #ff4444;z-index:58;pointer-events:none;transition:opacity 0.5s;';
        document.body.appendChild(warn);
    }
    warn.textContent='⚠ 敌方增援到达！+'+count+'名敌人';
    warn.style.opacity='1';
    setTimeout(function(){warn.style.opacity='0';},3000);
}

function updateMinimap(){
    const canvas=PerfManager.el('minimapCanvas');if(!canvas)return;
    const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,scale=w/CONFIG.mapSize;
    const px=playerGroup.position.x,pz=playerGroup.position.z;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(0,0,0,0.5)';ctx.beginPath();ctx.arc(w/2,h/2,w/2-1,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.beginPath();ctx.arc(w/2,h/2,w/2-2,0,Math.PI*2);ctx.clip();

    // 静态底图（道路/建筑/水域/区域）只绘制一次，之后作为位图平移
    const layer=PerfManager.buildMinimapLayer(MAP_DATA,FIXED_BUILDINGS,MAP_ZONES);
    if(layer){
        const mapPx=CONFIG.mapSize*scale;
        ctx.drawImage(layer,w/2-px*scale-mapPx/2,h/2-pz*scale-mapPx/2,mapPx,mapPx);
    }

    // 敌人：同色批量成一条路径，减少 canvas 状态切换
    ctx.fillStyle='#ff4444';
    ctx.beginPath();
    for(const e of enemies){
        if(!e.mesh)continue;
        const ex=w/2+(e.mesh.position.x-px)*scale,ey=h/2+(e.mesh.position.z-pz)*scale;
        ctx.moveTo(ex+2.5,ey);ctx.arc(ex,ey,2.5,0,Math.PI*2);
    }
    ctx.fill();

    // 容器：矩形同样批量
    ctx.fillStyle='rgba(74,144,217,0.85)';
    ctx.beginPath();
    for(const c of containers){
        const cx=w/2+(c.x-px)*scale,cy=h/2+(c.z-pz)*scale;
        ctx.rect(cx-1,cy-1,2,2);
    }
    ctx.fill();

    // 地面物资：按稀有度颜色分组，每组一次 fill
    const lootGroups={};
    for(const gl of (typeof groundLootItems!=='undefined'?groundLootItems:[])){
        if(gl.taken)continue;
        const col=(RARITY[gl.rarity]&&RARITY[gl.rarity].color)||'#fff';
        (lootGroups[col]||(lootGroups[col]=[])).push(w/2+(gl.x-px)*scale,h/2+(gl.z-pz)*scale);
    }
    for(const col in lootGroups){
        const pts=lootGroups[col];
        ctx.fillStyle=col;ctx.beginPath();
        for(let i=0;i<pts.length;i+=2){ctx.moveTo(pts[i]+2.5,pts[i+1]);ctx.arc(pts[i],pts[i+1],2.5,0,Math.PI*2);}
        ctx.fill();
    }

    // 撤离点：开放=绿，关闭=灰
    if(extractPoints&&extractPoints.length>0){
        for(const ep of extractPoints){
            ctx.fillStyle=ep.isOpen?'#4caf50':'#666';
            const ex=w/2+(ep.x-px)*scale,ey=h/2+(ep.z-pz)*scale;
            ctx.beginPath();ctx.arc(ex,ey,4,0,Math.PI*2);ctx.fill();
            ctx.strokeStyle=ep.isOpen?'#4caf50':'#666';ctx.lineWidth=1;ctx.stroke();
        }
    }
    // Airdrop markers (gold, pulsing)
    const _now=performance.now();
    for(const ad of airDrops){
        if(ad.looted)continue;
        ctx.fillStyle='#ffd700';
        const ax=w/2+(ad.x-px)*scale,ay=h/2+(ad.z-pz)*scale;
        ctx.beginPath();ctx.arc(ax,ay,4+Math.sin(_now/200)*1,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#ffd700';ctx.lineWidth=1;ctx.stroke();
    }
    // Boss markers (red skull)
    for(const b of bosses){
        ctx.fillStyle='#ff0000';
        const bx=w/2+(b.mesh.position.x-px)*scale,by=h/2+(b.mesh.position.z-pz)*scale;
        ctx.beginPath();ctx.arc(bx,by,4,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#ff0000';ctx.lineWidth=1;ctx.stroke();
    }
    // BOSS任务点标记（紫色闪烁，未接取的显示）
    if(typeof bossTaskPoints!=='undefined'&&bossTaskPoints.length>0){
        const _pulse=0.5+Math.sin(_now/300)*0.5;
        for(const _btp of bossTaskPoints){
            if(_btp.accepted)continue;
            const _tx=w/2+(_btp.x-px)*scale,_ty=h/2+(_btp.z-pz)*scale;
            ctx.fillStyle='rgba(156,39,176,'+(0.6+_pulse*0.4)+')';
            ctx.beginPath();ctx.arc(_tx,_ty,5+_pulse*2,0,Math.PI*2);ctx.fill();
            ctx.strokeStyle='#e040fb';ctx.lineWidth=1.5;ctx.stroke();
            // 骷髅图标
            ctx.fillStyle='#fff';ctx.font='bold 8px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.fillText('💀',_tx,_ty);
        }
    }
    ctx.restore();
    // 玩家箭头：使用相机世界方向计算（与罗盘一致），修复方向反转bug
    ctx.fillStyle='#4caf50';ctx.beginPath();
    const _pa=w/2,_py=h/2;
    const _camDir=new THREE.Vector3();
    camera.getWorldDirection(_camDir);
    const _heading=Math.atan2(_camDir.x,-_camDir.z); // 0=北，与罗盘一致
    const _arrowAngle=_heading-Math.PI/2; // 转换为Canvas坐标系（北=上）
    ctx.moveTo(_pa+Math.cos(_arrowAngle)*6,_py+Math.sin(_arrowAngle)*6);
    ctx.lineTo(_pa+Math.cos(_arrowAngle+2.5)*4,_py+Math.sin(_arrowAngle+2.5)*4);
    ctx.lineTo(_pa+Math.cos(_arrowAngle-2.5)*4,_py+Math.sin(_arrowAngle-2.5)*4);
    ctx.closePath();ctx.fill();
    // Custom markers on minimap with guide lines
    if(S._mapMarkers&&S._mapMarkers.length>0){
        for(var _mi3=0;_mi3<S._mapMarkers.length;_mi3++){
            var _mm2=S._mapMarkers[_mi3];
            var _mx2=w/2+(_mm2.x-px)*scale,_my2=h/2+(_mm2.z-pz)*scale;
            var _dx2=_mx2-w/2,_dy2=_my2-h/2;
            var _dr2=Math.sqrt(_dx2*_dx2+_dy2*_dy2);
            var _mcol=_mm2.color||'#ffeb3b';
            if(_dr2<(w/2-4)){
                // Marker is within minimap range — draw dot + dashed line
                ctx.strokeStyle=_mcol;ctx.lineWidth=1;ctx.globalAlpha=0.4;
                ctx.setLineDash([3,3]);
                ctx.beginPath();ctx.moveTo(w/2,h/2);ctx.lineTo(_mx2,_my2);ctx.stroke();
                ctx.setLineDash([]);ctx.globalAlpha=1;
                ctx.fillStyle=_mcol;
                ctx.beginPath();ctx.arc(_mx2,_my2,3,0,Math.PI*2);ctx.fill();
            }else{
                // Marker is off-screen — draw edge arrow indicator
                var _ang2=Math.atan2(_dy2,_dx2);
                var _ex2=w/2+Math.cos(_ang2)*(w/2-8);
                var _ey2=h/2+Math.sin(_ang2)*(w/2-8);
                var _dist2=Math.round(Math.sqrt((_mm2.x-px)*(_mm2.x-px)+(_mm2.z-pz)*(_mm2.z-pz)));
                // Arrow at edge pointing toward marker
                ctx.fillStyle=_mcol;
                ctx.beginPath();
                ctx.moveTo(_ex2+Math.cos(_ang2)*5,_ey2+Math.sin(_ang2)*5);
                ctx.lineTo(_ex2+Math.cos(_ang2+2.4)*4,_ey2+Math.sin(_ang2+2.4)*4);
                ctx.lineTo(_ex2+Math.cos(_ang2-2.4)*4,_ey2+Math.sin(_ang2-2.4)*4);
                ctx.closePath();ctx.fill();
                // Distance text
                ctx.fillStyle=_mcol;ctx.font='bold 7px monospace';ctx.textAlign='center';
                ctx.fillText(_dist2+'m',_ex2-Math.cos(_ang2)*10,_ey2-Math.sin(_ang2)*10);
            }
        }
    }
    // Compass directions on minimap edge
    ctx.fillStyle='rgba(255,152,0,0.8)';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('N',w/2,8);
    ctx.fillText('S',w/2,h-8);
    ctx.fillText('W',8,h/2);
    ctx.fillText('E',w-8,h/2);
    ctx.textBaseline='alphabetic';
    // Minimap border ring
    ctx.strokeStyle='rgba(255,152,0,0.3)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(w/2,h/2,w/2-1,0,Math.PI*2);ctx.stroke();
}

// ========== Full Map System ==========
var _fullMapMarkerColors=['#ffeb3b','#4caf50','#2196f3','#e91e63','#ff9800'];
var _fullMapMarkerIcons=['1','2','3','4','5'];
var _fullMapClickHandler=null;
var _fullMapCtxHandler=null;

function toggleFullMap(){
    var overlay=document.getElementById('fullMapOverlay');
    if(!overlay)return;
    if(S._fullMapOpen){
        // Close map: re-lock pointer for gameplay
        S._fullMapOpen=false;
        overlay.style.display='none';
        // Remove event listeners
        if(_fullMapClickHandler){overlay.removeEventListener('click',_fullMapClickHandler);_fullMapClickHandler=null;}
        if(_fullMapCtxHandler){overlay.removeEventListener('contextmenu',_fullMapCtxHandler);_fullMapCtxHandler=null;}
        var ctp=document.getElementById('clickToPlay');
        if(ctp)ctp.style.display='none';
        document.getElementById('gameCanvas').requestPointerLock();
    }else{
        // Open map: exit pointer lock so mouse is free
        S._fullMapOpen=true;
        overlay.style.display='block';
        var ctp2=document.getElementById('clickToPlay');
        if(ctp2)ctp2.style.display='none';
        if(document.pointerLockElement)document.exitPointerLock();
        drawFullMap();

        // Use click event on overlay (more reliable than mousedown after pointer lock release)
        _fullMapClickHandler=function(e){
            e.preventDefault();
            e.stopPropagation();
            var canvas=document.getElementById('fullMapCanvas');
            var rect=canvas.getBoundingClientRect();
            // Check if click is within canvas bounds
            if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)return;
            var cx2=(e.clientX-rect.left)/rect.width*canvas.width;
            var cy2=(e.clientY-rect.top)/rect.height*canvas.height;
            var scale2=canvas.width/CONFIG.mapSize;
            var wx=(cx2-canvas.width/2)/scale2;
            var wz=(cy2-canvas.height/2)/scale2;
            // Left click: replace existing marker (only 1 allowed)
            if(!S._mapMarkers)S._mapMarkers=[];
            S._mapMarkers.length=0;
            S._mapMarkers.push({x:wx,z:wz,color:'#ffeb3b',label:'1'});
            drawFullMap();
        };
        _fullMapCtxHandler=function(e){
            e.preventDefault();
            e.stopPropagation();
            // Right click: clear marker
            if(S._mapMarkers&&S._mapMarkers.length>0){
                S._mapMarkers.length=0;
                drawFullMap();
            }
        };
        overlay.addEventListener('click',_fullMapClickHandler);
        overlay.addEventListener('contextmenu',_fullMapCtxHandler);
    }
}

function drawFullMap(){
    var canvas=document.getElementById('fullMapCanvas');
    if(!canvas)return;
    var ctx=canvas.getContext('2d');
    var w=canvas.width,h=canvas.height,scale=w/CONFIG.mapSize;
    var cx=w/2,cy=h/2;
    var px=playerGroup.position.x,pz=playerGroup.position.z;
    // Player canvas position (calculated early for guide lines)
    var pPx=cx+px*scale,pPy=cy+pz*scale;

    // Fixed map: world(0,0) is always at canvas center
    // Helper: convert world coords to canvas coords
    function w2cx(wx){return cx+wx*scale;}
    function w2cy(wz){return cy+wz*scale;}

    // Background
    ctx.fillStyle='#0a0a0a';ctx.fillRect(0,0,w,h);

    // Grid lines
    ctx.strokeStyle='rgba(60,60,60,0.3)';ctx.lineWidth=0.5;
    for(var gx=-CONFIG.mapSize/2;gx<=CONFIG.mapSize/2;gx+=20){
        var gxp=w2cx(gx);
        ctx.beginPath();ctx.moveTo(gxp,0);ctx.lineTo(gxp,h);ctx.stroke();
        var gzp=w2cy(gx);
        ctx.beginPath();ctx.moveTo(0,gzp);ctx.lineTo(w,gzp);ctx.stroke();
    }

    // Water areas
    for(var _wa of((MAP_DATA&&MAP_DATA.waterAreas)||[])){
        ctx.fillStyle='rgba(26,74,106,0.5)';
        ctx.fillRect(w2cx(_wa.x-_wa.w/2),w2cy(_wa.z-_wa.d/2),_wa.w*scale,_wa.d*scale);
    }

    // Buildings (fixed positions)
    for(var _b of FIXED_BUILDINGS){
        ctx.fillStyle='rgba(80,80,80,0.8)';
        ctx.fillRect(w2cx(_b.x-_b.w/2),w2cy(_b.z-_b.d/2),_b.w*scale,_b.d*scale);
        ctx.strokeStyle='rgba(120,120,120,0.4)';ctx.lineWidth=0.5;
        ctx.strokeRect(w2cx(_b.x-_b.w/2),w2cy(_b.z-_b.d/2),_b.w*scale,_b.d*scale);
    }

    // Map zones
    for(var _zone of MAP_ZONES){
        ctx.strokeStyle=_zone.color||'#666';ctx.lineWidth=1;ctx.globalAlpha=0.3;
        var zx=w2cx(_zone.x),zy=w2cy(_zone.z),r=(_zone.radius||14)*scale;
        ctx.beginPath();ctx.arc(zx,zy,r,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
        ctx.fillStyle='rgba(200,200,200,0.4)';ctx.font='10px monospace';ctx.textAlign='center';
        ctx.fillText(_zone.name||'',zx,zy-r-3);
    }

    // Containers
    ctx.fillStyle='#4a90d9';
    for(var _c of containers){
        ctx.fillRect(w2cx(_c.x)-1.5,w2cy(_c.z)-1.5,3,3);
    }

    // Ground loot
    for(var _gl of groundLootItems){
        if(_gl.taken)continue;
        ctx.fillStyle=(typeof RARITY!=='undefined'&&RARITY[_gl.rarity])?RARITY[_gl.rarity].color:'#fff';
        ctx.beginPath();ctx.arc(w2cx(_gl.x),w2cy(_gl.z),2,0,Math.PI*2);ctx.fill();
    }

    // Extraction points
    if(extractPoints&&extractPoints.length>0){
        for(var _ep of extractPoints){
            ctx.fillStyle=_ep.isOpen?'#4caf50':'#666';
            ctx.beginPath();ctx.arc(w2cx(_ep.x),w2cy(_ep.z),6,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#fff';ctx.font='9px monospace';ctx.textAlign='center';
            ctx.fillText('EX',w2cx(_ep.x),w2cy(_ep.z)-10);
        }
    }

    // Airdrops
    for(var _ad of airDrops){
        if(_ad.looted)continue;
        ctx.fillStyle='#ffd700';
        ctx.beginPath();ctx.arc(w2cx(_ad.x),w2cy(_ad.z),5,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#ffd700';ctx.lineWidth=1;ctx.stroke();
    }

    // Bosses
    for(var _boss of bosses){
        ctx.fillStyle='#ff0000';
        ctx.beginPath();ctx.arc(w2cx(_boss.mesh.position.x),w2cy(_boss.mesh.position.z),7,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#ff0000';ctx.lineWidth=2;ctx.stroke();
        ctx.fillStyle='#fff';ctx.font='bold 10px monospace';ctx.textAlign='center';
        ctx.fillText('B',w2cx(_boss.mesh.position.x),w2cy(_boss.mesh.position.z)+4);
    }

    // Enemies
    ctx.fillStyle='#ff4444';
    for(var _e of enemies){
        if(_e.isBoss)continue;
        ctx.beginPath();ctx.arc(w2cx(_e.mesh.position.x),w2cy(_e.mesh.position.z),2,0,Math.PI*2);ctx.fill();
    }

    // Custom markers with guide lines from player
    if(S._mapMarkers&&S._mapMarkers.length>0){
        for(var _mi=0;_mi<S._mapMarkers.length;_mi++){
            var _m=S._mapMarkers[_mi];
            var _mx=w2cx(_m.x),_my=w2cy(_m.z);
            // Dashed guide line from player to marker
            ctx.strokeStyle=_m.color;ctx.lineWidth=1;ctx.globalAlpha=0.5;
            ctx.setLineDash([6,4]);
            ctx.beginPath();ctx.moveTo(pPx,pPy);ctx.lineTo(_mx,_my);ctx.stroke();
            ctx.setLineDash([]);ctx.globalAlpha=1;
            // Distance label at midpoint
            var _mdx=_m.x-px,_mdz=_m.z-pz;
            var _mdist=Math.round(Math.sqrt(_mdx*_mdx+_mdz*_mdz));
            var _midx=(_m.mx+pPx)/2,_midy=(_my+pPy)/2;
            ctx.fillStyle=_m.color;ctx.font='bold 9px monospace';ctx.textAlign='center';
            ctx.fillText(_mdist+'m',(_mx+pPx)/2,(_my+pPy)/2-3);
            // Marker dot
            ctx.fillStyle=_m.color;
            ctx.beginPath();ctx.arc(_mx,_my,8,0,Math.PI*2);ctx.fill();
            ctx.strokeStyle=_m.color;ctx.lineWidth=2;ctx.stroke();
            ctx.fillStyle='#000';ctx.font='bold 10px monospace';ctx.textAlign='center';
            ctx.fillText(_m.label,_mx,_my+4);
        }
    }

    // Player (at its absolute position on the fixed map)
    var pAngle=mouseX-Math.PI/2;
    // Player view direction cone
    ctx.fillStyle='rgba(76,175,80,0.15)';
    ctx.beginPath();
    ctx.moveTo(pPx,pPy);
    ctx.arc(pPx,pPy,50,pAngle-0.5,pAngle+0.5);
    ctx.closePath();ctx.fill();
    // Player arrow
    ctx.fillStyle='#4caf50';
    ctx.beginPath();
    ctx.moveTo(pPx+Math.cos(pAngle)*10,pPy+Math.sin(pAngle)*10);
    ctx.lineTo(pPx+Math.cos(pAngle+2.5)*7,pPy+Math.sin(pAngle+2.5)*7);
    ctx.lineTo(pPx+Math.cos(pAngle-2.5)*7,pPy+Math.sin(pAngle-2.5)*7);
    ctx.closePath();ctx.fill();
    // Player dot ring
    ctx.strokeStyle='#4caf50';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(pPx,pPy,12,0,Math.PI*2);ctx.stroke();

    // === Compass directions on edges ===
    ctx.fillStyle='rgba(255,152,0,0.7)';ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('N',w/2,12); // North = top (negative Z)
    ctx.fillText('S',w/2,h-12); // South = bottom (positive Z)
    ctx.fillText('W',12,h/2); // West = left (negative X)
    ctx.fillText('E',w-12,h/2); // East = right (positive X)
    ctx.textBaseline='alphabetic';

    // Map border
    ctx.strokeStyle='rgba(255,152,0,0.3)';ctx.lineWidth=1;
    ctx.strokeRect(0,0,w,h);

    // Markers list sidebar
    var listEl=document.getElementById('fullMapMarkersList');
    if(listEl){
        var html='';
        if(S._mapMarkers&&S._mapMarkers.length>0){
            var _lm=S._mapMarkers[0];
            var _ldx=_lm.x-playerGroup.position.x,_ldz=_lm.z-playerGroup.position.z;
            var _ldist=Math.round(Math.sqrt(_ldx*_ldx+_ldz*_ldz));
            html='<div style="color:#ffeb3b;font-size:12px;margin-bottom:6px;font-weight:bold;">● 标记点 ('+_ldist+'m)</div>';
            html+='<div style="color:#8b949e;font-size:10px;">左键重新标点 | 右键删除</div>';
        }else{
            html='<div style="color:#8b949e;font-size:11px;">左键点击地图标点</div>';
        }
        listEl.innerHTML=html;
    }
}

// ========== Marker Guide HUD ==========
function updateMarkerGuide(){
    var el=document.getElementById('markerGuide');
    if(!el)return;
    if(!S._mapMarkers||S._mapMarkers.length===0||S.phase!=='playing'||S._fullMapOpen){
        el.style.display='none';
        return;
    }
    // Show distance to the single marker
    var m=S._mapMarkers[0];
    var px=playerGroup.position.x,pz=playerGroup.position.z;
    var dx=m.x-px,dz=m.z-pz;
    var dist=Math.sqrt(dx*dx+dz*dz);
    el.style.display='block';
    var distEl=document.getElementById('markerDist');
    if(distEl){
        distEl.textContent=Math.round(dist)+'m';
        distEl.style.color=m.color||'#ffeb3b';
    }
}

// ========== SECTION 15: LOBBY UI ==========
function switchLobbyTab(tab){
    const tabs=['action','loadout','inventory','shop','missions','upgrade','stats','mail'];
    document.querySelectorAll('.lobby-menu li').forEach((li,i)=>li.classList.toggle('active',tabs[i]===tab));
    document.querySelectorAll('.lobby-section').forEach(s=>s.classList.remove('active'));
    document.getElementById('tab-'+tab).classList.add('active');
    if(tab==='inventory'){renderAllInventory();renderStashGrid();}
    if(tab==='loadout'){renderLoadoutPanel();}
    if(tab==='shop')renderShopTab();
    if(tab==='mail')renderMailTab();
    if(tab==='missions')renderMissionTab(currentMissionTab||'daily');
    if(tab==='upgrade')renderUpgradeTab();
    if(tab==='stats')renderStatsTab();
}

function selectMode(mode){S.mode=mode;document.querySelectorAll('.mode-card').forEach(c=>c.classList.remove('selected'));event.currentTarget.classList.add('selected');}

// Map data cache - populated from script tags in index.html
var MAP_DATA = {};
const MAP_SOURCES = {
    military_base: typeof MAP_DATA_MILITARY !== 'undefined' ? MAP_DATA_MILITARY : null,
    industrial_port: typeof MAP_DATA_INDUSTRIAL !== 'undefined' ? MAP_DATA_INDUSTRIAL : null,
    forest_outpost: typeof MAP_DATA_FOREST !== 'undefined' ? MAP_DATA_FOREST : null,
};

function selectMap(mapName) {
    const src = MAP_SOURCES[mapName];
    if (src) {
        MAP_DATA = JSON.parse(JSON.stringify(src));
        // Set map type for boss system
        if(mapName==='forest_outpost')S.currentMapType='forest';
        else if(mapName==='industrial_port')S.currentMapType='industrial';
        else if(mapName==='military_base')S.currentMapType='military';
        else S.currentMapType='forest';
        loadMapData();
        rebuildMapEnvironment();
    }
}

// Initialize with military_base
(function initMap() {
    if (MAP_SOURCES.military_base) {
        MAP_DATA = JSON.parse(JSON.stringify(MAP_SOURCES.military_base));
    }
    loadMapData();
})();

function stashOrMail(itemId) {
    var dims=getStashDims();
    const s = findFreeSlot(P.stashGrid, dims.cols, dims.rows, itemId);
    if (s) { placeInGrid(P.stashGrid, dims.cols, itemId, s.col, s.row); return true; }
    P.mailItems = P.mailItems || []; P.mailItems.push(itemId); return false;
}

function updateAllLobbyUI(){
    document.getElementById('lobbyMoney').textContent=P.money.toLocaleString();
    document.getElementById('statKills').textContent=P.stats.kills;
    document.getElementById('statExtracts').textContent=P.stats.extracts;
    document.getElementById('statValue').textContent='₵'+P.stats.totalValue.toLocaleString();
    document.getElementById('statGames').textContent=P.stats.games;
    let sv=0;if(P.stashGrid._items)for(const e of P.stashGrid._items){const def=ITEMS[e.id];if(def)sv+=def.value;}
    if(P.keychain)for(let i=0;i<4;i++){if(P.keychain[i]){const def=ITEMS[P.keychain[i]];if(def)sv+=def.value;}}
    const svEl=document.getElementById('stashValue');if(svEl)svEl.textContent=sv.toLocaleString();
    const svSidebar=document.getElementById('stashValueSidebar');if(svSidebar)svSidebar.textContent=sv.toLocaleString();
    // Mail badge
    const mb=document.getElementById('mailBadge');if(mb){const mc=(P.mailItems||[]).length;mb.textContent=mc;mb.style.display=mc>0?'inline':'none';}
    // Weight display
    var wEl=document.getElementById('weightDisplay');
    if(wEl){var cw=getStashWeight();var mw=getMaxWeight();wEl.textContent=cw+'/'+mw+'kg';wEl.style.color=cw>mw*0.9?'#f44336':cw>mw*0.7?'#ff9800':'#4caf50';}
}

// ====== UPGRADE SYSTEM ======
const WEIGHT_UPGRADES = [
    { level: 2, materials: { wire: 10, circuit: 5 }, money: 50000, desc: '提交导线×10、电路板×5' },
    { level: 3, materials: { circuit: 10, gpu: 5 }, money: 100000, desc: '提交电路板×10、显卡×5' },
    { level: 4, materials: { gpu: 10, diamond: 5 }, money: 200000, desc: '提交显卡×10、钻石×5' },
    { level: 5, materials: { diamond: 15, gold: 5 }, money: 400000, desc: '提交钻石×15、金块×5' },
    { level: 6, materials: { gold: 20, diamond: 10 }, money: 600000, desc: '提交金块×20、钻石×10' },
    { level: 7, materials: { gold: 30, diamond: 20 }, money: 1000000, desc: '提交金块×30、钻石×20' },
];
const STASH_UPGRADES = [
    { level: 2, materials: { tape: 10, bolt: 10 }, money: 30000, desc: '提交胶带×10、螺栓×10' },
    { level: 3, materials: { tape: 15, wire: 15 }, money: 60000, desc: '提交胶带×15、导线×15' },
    { level: 4, materials: { wire: 20, circuit: 10 }, money: 100000, desc: '提交导线×20、电路板×10' },
    { level: 5, materials: { circuit: 15, gpu: 10 }, money: 200000, desc: '提交电路板×15、显卡×10' },
    { level: 6, materials: { gpu: 20, diamond: 10 }, money: 400000, desc: '提交显卡×20、钻石×10' },
    { level: 7, materials: { diamond: 30, gold: 15 }, money: 800000, desc: '提交钻石×30、金块×15' },
];

function getStashItemCount(itemId){
    if(!P.stashGrid._items)return 0;
    return P.stashGrid._items.filter(function(e){return e.id===itemId;}).length;
}
function removeStashItems(itemId, count){
    if(!P.stashGrid._items)return 0;
    var removed=0;
    for(var i=P.stashGrid._items.length-1;i>=0&&removed<count;i--){
        if(P.stashGrid._items[i].id===itemId){
            P.stashGrid._items.splice(i,1);
            removed++;
        }
    }
    return removed;
}
function canUpgradeWeight(){
    var lv=P.weightLevel||1;
    if(lv>=7)return false;
    var upg=WEIGHT_UPGRADES[lv-1];
    if(!upg)return false;
    if(P.money<upg.money)return false;
    for(var k in upg.materials){
        if(getStashItemCount(k)<upg.materials[k])return false;
    }
    return true;
}
function canUpgradeStash(){
    var lv=P.stashLevel||1;
    if(lv>=7)return false;
    var upg=STASH_UPGRADES[lv-1];
    if(!upg)return false;
    if(P.money<upg.money)return false;
    for(var k in upg.materials){
        if(getStashItemCount(k)<upg.materials[k])return false;
    }
    return true;
}
function doUpgradeWeight(){
    if(!canUpgradeWeight())return;
    var lv=P.weightLevel||1;
    var upg=WEIGHT_UPGRADES[lv-1];
    P.money-=upg.money;
    for(var k in upg.materials){
        removeStashItems(k,upg.materials[k]);
    }
    P.weightLevel=lv+1;
    savePersistent();
    renderUpgradeTab();
    updateAllLobbyUI();
}
function doUpgradeStash(){
    if(!canUpgradeStash())return;
    var lv=P.stashLevel||1;
    var upg=STASH_UPGRADES[lv-1];
    P.money-=upg.money;
    for(var k in upg.materials){
        removeStashItems(k,upg.materials[k]);
    }
    // Expand stash grid
    P.stashLevel=lv+1;
    var dims=getStashDims();
    var newGrid=initGrid(dims.rows);
    if(P.stashGrid._items){
        P.stashGrid._items.forEach(function(entry){
            if(entry.col<dims.cols&&entry.row<dims.rows){
                placeInGrid(newGrid,dims.cols,entry.id,entry.col,entry.row);
                var ne=newGrid._items[newGrid._items.length-1];
                if(ne&&entry._keyUses!==undefined)ne._keyUses=entry._keyUses;
            }else{
                var slot=findFreeSlot(newGrid,dims.cols,dims.rows,entry.id);
                if(slot){
                    placeInGrid(newGrid,dims.cols,entry.id,slot.col,slot.row);
                    var ne2=newGrid._items[newGrid._items.length-1];
                    if(ne2&&entry._keyUses!==undefined)ne2._keyUses=entry._keyUses;
                }
            }
        });
    }
    P.stashGrid=newGrid;
    savePersistent();
    renderUpgradeTab();
    renderStashGrid();
    updateAllLobbyUI();
}
function renderUpgradeTab(){
    var container=document.getElementById('upgradeContent');
    if(!container)return;
    var wLv=P.weightLevel||1;
    var sLv=P.stashLevel||1;
    var html='';
    // Weight upgrade card
    html+='<div style="background:rgba(22,27,34,0.8);border:1px solid #30363d;border-radius:8px;padding:20px;margin-bottom:15px;">';
    html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">';
    html+='<div><div style="color:#ff9800;font-size:18px;font-weight:bold;font-family:var(--font-heading);">负重等级</div>';
    html+='<div style="color:#8b949e;font-size:11px;margin-top:3px;">当前: Lv.'+wLv+' ('+getMaxWeight()+'kg) → '+(wLv<7?'Lv.'+(wLv+1)+' ('+CONFIG.WEIGHT_LEVELS[wLv]+'kg)':'已满级')+'</div></div>';
    html+='<div style="text-align:center;"><div style="color:#4caf50;font-size:24px;font-weight:bold;">'+getStashWeight()+'<span style="font-size:14px;color:#8b949e;">/'+getMaxWeight()+'kg</span></div></div></div>';
    if(wLv<7){
        var upg=WEIGHT_UPGRADES[wLv-1];
        var canUpg=canUpgradeWeight();
        html+='<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">';
        for(var k in upg.materials){
            var have=getStashItemCount(k);
            var need=upg.materials[k];
            var def=ITEMS[k];
            html+='<div style="background:'+(have>=need?'rgba(76,175,80,0.15)':'rgba(244,67,54,0.15)')+';border:1px solid '+(have>=need?'#4caf50':'#f44336')+';border-radius:4px;padding:6px 12px;font-size:12px;">';
            html+=(def?itemIcon(def):'📦')+' '+(def?def.name:k)+' '+have+'/'+need;
            html+='</div>';
        }
        html+='<div style="background:'+(P.money>=upg.money?'rgba(76,175,80,0.15)':'rgba(244,67,54,0.15)')+';border:1px solid '+(P.money>=upg.money?'#4caf50':'#f44336')+';border-radius:4px;padding:6px 12px;font-size:12px;">';
        html+='₵ '+P.money.toLocaleString()+'/'+upg.money.toLocaleString()+'</div>';
        html+='</div>';
        html+='<button class="sort-btn" style="width:100%;background:'+(canUpg?'#ff9800':'#333')+';color:'+(canUpg?'#fff':'#666')+';cursor:'+(canUpg?'pointer':'not-allowed')+';" '+(canUpg?'':'disabled')+' onclick="doUpgradeWeight()">升级到 Lv.'+(wLv+1)+'</button>';
    }else{
        html+='<div style="text-align:center;color:#4caf50;font-size:14px;padding:10px;">已达最高等级</div>';
    }
    html+='</div>';
    // Stash upgrade card
    html+='<div style="background:rgba(22,27,34,0.8);border:1px solid #30363d;border-radius:8px;padding:20px;margin-bottom:15px;">';
    html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">';
    html+='<div><div style="color:#ff9800;font-size:18px;font-weight:bold;font-family:var(--font-heading);">仓库容量</div>';
    var dims=getStashDims();
    html+='<div style="color:#8b949e;font-size:11px;margin-top:3px;">当前: Lv.'+sLv+' ('+dims.cols+'×'+dims.rows+'='+(dims.cols*dims.rows)+'格) → '+(sLv<7?'Lv.'+(sLv+1)+' ('+CONFIG.STASH_LEVELS[sLv][0]+'×'+CONFIG.STASH_LEVELS[sLv][1]+'='+CONFIG.STASH_LEVELS[sLv][0]*CONFIG.STASH_LEVELS[sLv][1]+'格)':'已满级')+'</div></div>';
    var usedSlots=P.stashGrid._items?P.stashGrid._items.length:0;
    html+='<div style="text-align:center;"><div style="color:#4caf50;font-size:24px;font-weight:bold;">'+usedSlots+'<span style="font-size:14px;color:#8b949e;">/'+(dims.cols*dims.rows)+'格</span></div></div></div>';
    if(sLv<7){
        var supg=STASH_UPGRADES[sLv-1];
        var scanUpg=canUpgradeStash();
        html+='<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">';
        for(var sk in supg.materials){
            var shave=getStashItemCount(sk);
            var sneed=supg.materials[sk];
            var sdef=ITEMS[sk];
            html+='<div style="background:'+(shave>=sneed?'rgba(76,175,80,0.15)':'rgba(244,67,54,0.15)')+';border:1px solid '+(shave>=sneed?'#4caf50':'#f44336')+';border-radius:4px;padding:6px 12px;font-size:12px;">';
            html+=(sdef?itemIcon(sdef):'📦')+' '+(sdef?sdef.name:sk)+' '+shave+'/'+sneed;
            html+='</div>';
        }
        html+='<div style="background:'+(P.money>=supg.money?'rgba(76,175,80,0.15)':'rgba(244,67,54,0.15)')+';border:1px solid '+(P.money>=supg.money?'#4caf50':'#f44336')+';border-radius:4px;padding:6px 12px;font-size:12px;">';
        html+='₵ '+P.money.toLocaleString()+'/'+supg.money.toLocaleString()+'</div>';
        html+='</div>';
        html+='<button class="sort-btn" style="width:100%;background:'+(scanUpg?'#ff9800':'#333')+';color:'+(scanUpg?'#fff':'#666')+';cursor:'+(scanUpg?'pointer':'not-allowed')+';" '+(scanUpg?'':'disabled')+' onclick="doUpgradeStash()">升级到 Lv.'+(sLv+1)+'</button>';
    }else{
        html+='<div style="text-align:center;color:#4caf50;font-size:14px;padding:10px;">已达最高等级</div>';
    }
    html+='</div>';
    container.innerHTML=html;
}

function renderMailTab(){
    const container=document.getElementById('mailItems');if(!container)return;
    const items=P.mailItems||[];
    if(items.length===0){container.innerHTML='<p style="color:#8b949e;">📭 邮箱为空</p>';return;}
    let h='<div class="inv-grid">';
    for(let i=0;i<items.length;i++){
        const def=ITEMS[items[i]];if(!def)continue;
        h+='<div class="inv-item rarity-'+def.rarity+'" style="cursor:pointer;" title="双击领取到仓库" ondblclick="claimMailItem('+i+')">'+itemIcon(def)+'<div class="item-name">'+def.name+'</div></div>';
    }
    h+='</div>';
    container.innerHTML=h;
}

function claimMailItem(idx){
    const items=P.mailItems||[];if(idx>=items.length)return;
    const itemId=items[idx];
    var dims=getStashDims();
    const s=findFreeSlot(P.stashGrid,dims.cols,dims.rows,itemId);
    if(!s){alert('仓库空间不足！');return;}
    placeInGrid(P.stashGrid,dims.cols,itemId,s.col,s.row);
    items.splice(idx,1);
    savePersistent();renderMailTab();renderStashGrid();updateAllLobbyUI();
}

// ====== Mission System ======
let currentMissionTab = 'daily';
const MISSION_TYPES = {
    kill_any:       { name: '消灭敌人',      desc: '击杀任意敌人' },
    kill_headshot:  { name: '爆头击杀',      desc: '爆头击杀敌人' },
    extract_success:{ name: '成功撤离',      desc: '成功撤离' },
    search_containers: { name: '搜索容器',   desc: '搜索物资容器' },
    earn_money:     { name: '赚取资金',      desc: '累计带出物资价值' },
    survive_time:   { name: '持久作战',      desc: '总存活时间(秒)' },
    extract_value:  { name: '高价值撤离',    desc: '单次撤离价值≥₵100000' },
    kill_with_smg:  { name: '冲锋枪击杀',    desc: '使用冲锋枪击杀敌人' },
    kill_with_rifle:{ name: '步枪击杀',      desc: '使用步枪击杀敌人' },
    kill_with_sniper:{name: '狙击枪击杀',    desc: '使用狙击枪击杀敌人' },
    kill_with_shotgun:{name:'霰弹枪击杀',    desc: '使用霰弹枪击杀敌人' },
    kill_boss:      { name: 'Boss击杀',      desc: '在局内击杀Boss' },
    submit_materials:{name: '物资提交',      desc: '向仓库提交指定材料' },
};
const MISSION_REWARDS = {
    daily:  { money: 50000, xp: 100 },
    weekly: { money: 300000, xp: 500 },
    faction:{ money: 1000000, xp: 2000 },
};
const MISSION_POOL = {
    daily: [
        { type: 'kill_any', target: 8 }, { type: 'kill_headshot', target: 3 },
        { type: 'extract_success', target: 2 }, { type: 'search_containers', target: 10 },
        { type: 'earn_money', target: 200000 },
        { type: 'kill_with_smg', target: 5 }, { type: 'kill_with_rifle', target: 5 },
        { type: 'kill_with_shotgun', target: 3 },
    ],
    weekly: [
        { type: 'kill_any', target: 30 }, { type: 'extract_success', target: 5 },
        { type: 'survive_time', target: 1800 }, { type: 'extract_value', target: 1 },
        { type: 'kill_with_sniper', target: 5 }, { type: 'kill_boss', target: 1 },
    ],
    faction: [
        { type: 'kill_any', target: 50, desc: '击杀50名敌人' },
        { type: 'earn_money', target: 1000000, desc: '累计带出₵1,000,000' },
        { type: 'kill_boss', target: 3, desc: '击杀3个Boss' },
    ],
};
function initOrRefreshMissions() {
    if (!P.missions) { P.missions = { daily: [], weekly: [], faction: [] }; P.missionProgress = {}; P.dailyRefresh = 0; P.weeklyRefresh = 0; P.xp = P.xp || 0; }
    const now = Date.now();
    if (now - (P.dailyRefresh||0) > 86400000) {
        P.missions.daily = shuffle([...MISSION_POOL.daily]).slice(0,3).map(m=>({...m,progress:0,completed:false,claimed:false}));
        P.dailyRefresh = now;
    }
    if (now - (P.weeklyRefresh||0) > 604800000) {
        P.missions.weekly = shuffle([...MISSION_POOL.weekly]).slice(0,2).map(m=>({...m,progress:0,completed:false,claimed:false}));
        P.missions.faction = shuffle([...MISSION_POOL.faction]).slice(0,1).map(m=>({...m,progress:0,completed:false,claimed:false}));
        P.weeklyRefresh = now;
    }
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function trackMission(type, amount) {
    // BOSS扩展任务进度追踪
    if (typeof BossExtensions !== 'undefined') {
        BossExtensions.updateMissionProgress(type, amount);
    }
    if (S.phase !== 'playing' || !P.missions) return;
    for (const cat of ['daily','weekly','faction']) {
        for (const m of (P.missions[cat]||[])) {
            if (m.type === type && !m.completed) {
                m.progress = Math.min(m.target, (m.progress||0) + amount);
                if (m.progress >= m.target) { m.completed = true; }
            }
        }
    }
}
function switchMissionTab(tab) { currentMissionTab = tab; renderMissionTab(tab); }
function renderMissionTab(tab) {
    const container = document.getElementById('missionList'); if (!container) return;
    document.querySelectorAll('#missionTabs .sort-btn').forEach((b,i)=>b.classList.toggle('active',['daily','weekly','faction'][i]===tab));
    const missions = (P.missions||{})[tab] || [];
    if (missions.length === 0) { container.innerHTML = '<p style="color:#8b949e;">暂无任务</p>'; return; }
    let html = '';
    for (let i = 0; i < missions.length; i++) {
        const m = missions[i]; const mt = MISSION_TYPES[m.type] || { name: m.type, desc: '' };
        const pct = m.target > 0 ? Math.min(100, Math.round((m.progress||0)/m.target*100)) : 0;
        const reward = MISSION_REWARDS[tab] || { money: 0 };
        html += `<div style="background:rgba(22,27,34,0.8);border:1px solid ${m.completed?'#ff9800':'#30363d'};border-radius:6px;padding:15px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div><div style="color:#f0f6fc;font-size:14px;font-weight:bold;">${mt.name}</div>
                <div style="color:#8b949e;font-size:11px;margin-top:3px;">${mt.desc||''}</div></div>
                <div style="text-align:right;"><div style="color:#ff9800;font-size:11px;">${m.progress||0}/${m.target}</div>
                <div style="color:#6e7681;font-size:10px;">奖励: ₵${reward.money} ${reward.xp?' + '+reward.xp+'XP':''}</div></div>
            </div>
            <div style="height:6px;background:#1a1a1a;border-radius:3px;margin-top:10px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${m.completed?'linear-gradient(90deg,#ff9800,#ffc107)':'linear-gradient(90deg,#4a4a4a,#888)'};border-radius:3px;transition:width 0.3s;"></div>
            </div>
            ${m.completed&&!m.claimed?`<button class="sort-btn" style="margin-top:8px;background:#ff9800;color:#fff;" onclick="claimMissionReward('${tab}',${i})">领取奖励</button>`:''}
            ${m.claimed?'<div style="color:#4caf50;font-size:10px;margin-top:8px;">✓ 已领取</div>':''}
        </div>`;
    }
    container.innerHTML = html;
}
function claimMissionReward(tab, idx) {
    const missions = (P.missions||{})[tab]||[]; const m = missions[idx];
    if (!m || !m.completed || m.claimed) return;
    const reward = MISSION_REWARDS[tab] || { money: 0 };
    P.money += reward.money;
    P.xp = (P.xp||0) + (reward.xp||0);
    m.claimed = true; savePersistent(); renderMissionTab(tab); updateAllLobbyUI();
}
function renderStatsTab() {
    const container = document.getElementById('statsContent'); if (!container) return;
    const st = P.stats || { kills:0, extracts:0, totalValue:0, games:0 };
    const level = Math.floor(((P.xp||0)/1000)+1);
    const nextXp = level * 1000;
    const pct = Math.min(100, Math.round(((P.xp||0)%1000)/10));
    container.innerHTML = `
        <div style="background:rgba(22,27,34,0.8);border:1px solid #30363d;border-radius:6px;padding:20px;margin-bottom:15px;">
            <div style="text-align:center;margin-bottom:15px;">
                <span style="font-size:36px;">🎖️</span>
                <div style="color:#ff9800;font-size:22px;font-weight:bold;margin-top:5px;">等级 ${level}</div>
                <div style="height:8px;background:#1a1a1a;border-radius:4px;margin:10px auto;width:200px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#ff9800,#ffc107);border-radius:4px;"></div>
                </div>
                <div style="color:#8b949e;font-size:10px;">${(P.xp||0)} / ${nextXp} 经验</div>
            </div>
        </div>
        <div class="player-stats">
            <div class="stat-item"><div class="stat-val">${st.games||0}</div><div class="stat-label">总行动</div></div>
            <div class="stat-item"><div class="stat-val">${st.extracts||0}</div><div class="stat-label">撤离成功</div></div>
            <div class="stat-item"><div class="stat-val">${st.kills||0}</div><div class="stat-label">总击杀</div></div>
            <div class="stat-item"><div class="stat-val">${st.games>0?Math.round((st.extracts||0)/st.games*100):0}%</div><div class="stat-label">撤离率</div></div>
            <div class="stat-item"><div class="stat-val">₵${(st.totalValue||0).toLocaleString()}</div><div class="stat-label">总价值</div></div>
        </div>`;
}
// ====== Equipment Helpers ======
function getEquipItemId(slotType) {
    if (slotType === 'primary1') { const w = S.weaponSlots[0]; return w ? Object.keys(ITEMS).find(k => ITEMS[k].type === 'weapon' && ITEMS[k].weapon === w) : null; }
    if (slotType === 'primary2') { const w = S.weaponSlots[1]; return w ? Object.keys(ITEMS).find(k => ITEMS[k].type === 'weapon' && ITEMS[k].weapon === w) : null; }
    if (slotType === 'secondary') { const w = S.weaponSlots[2]; return w ? Object.keys(ITEMS).find(k => ITEMS[k].type === 'weapon' && ITEMS[k].weapon === w) : null; }
    return S.equipment[slotType] || null;
}

function setEquipItem(slotType, itemId) {
    const def = ITEMS[itemId]; if (!def) return false;
    if (slotType === 'primary1' && def.type === 'weapon' && (def.wSlot || 'primary') === 'primary') { S.weaponSlots[0] = def.weapon; S.magAmmo[0] = WEAPONS[def.weapon].magSize; return true; }
    if (slotType === 'primary2' && def.type === 'weapon' && (def.wSlot || 'primary') === 'primary') { S.weaponSlots[1] = def.weapon; S.magAmmo[1] = WEAPONS[def.weapon].magSize; return true; }
    if (slotType === 'secondary' && def.type === 'weapon' && (def.wSlot || 'primary') === 'secondary') { S.weaponSlots[2] = def.weapon; S.magAmmo[2] = WEAPONS[def.weapon].magSize; return true; }
    if (slotType === 'armor' && def.type === 'armor') { S.equipment.armor = itemId; S.equipment.armorHP = def.amount; return true; }
    if (slotType === 'helmet' && def.type === 'helmet') { S.equipment.helmet = itemId; S.equipment.helmetHP = def.amount; return true; }
    if (slotType === 'chestRig' && def.type === 'chestRig') { S.equipment.chestRig = itemId; S.maxPockets = 5; return true; }
    if (slotType === 'backpack' && def.type === 'backpack') { S.equipment.backpack = itemId; S.backpackCols = getEffectiveBackpackCols(def.bCols); S.backpackRows = def.bRows; S.backpack = initGrid(def.bRows); return true; }
    return false;
}

function clearEquipSlot(slotType) {
    if (slotType === 'primary1') {
        S.weaponSlots[0] = null; S.magAmmo[0] = 0;
        if (S.currentWeapon === 0) _switchToAvailableWeapon();
    }
    else if (slotType === 'primary2') {
        S.weaponSlots[1] = null; S.magAmmo[1] = 0;
        if (S.currentWeapon === 1) _switchToAvailableWeapon();
    }
    else if (slotType === 'secondary') {
        S.weaponSlots[2] = null; S.magAmmo[2] = 0;
        if (S.currentWeapon === 2) _switchToAvailableWeapon();
    }
    else if (slotType === 'armor') { S.equipment.armor = null; S.equipment.armorHP = 0; }
    else if (slotType === 'helmet') { S.equipment.helmet = null; S.equipment.helmetHP = 0; }
    else if (slotType === 'chestRig') { S.equipment.chestRig = null; S.maxPockets = 5; }
    else if (slotType === 'backpack') { S.equipment.backpack = null; S.backpackCols = 0; S.backpackRows = 0; S.backpack = initGrid(1); }
    // 确保匕首始终存在
    if (S.weaponSlots[3] !== 'knife') S.weaponSlots[3] = 'knife';
    // 更新武器模型
    if (typeof updateWeaponModel === 'function') updateWeaponModel();
    if (typeof updateWeaponUI === 'function') updateWeaponUI();
}

function _switchToAvailableWeapon() {
    let found = false;
    for (let i = 0; i < S.weaponSlots.length; i++) {
        if (S.weaponSlots[i]) { S.currentWeapon = i; found = true; break; }
    }
    if (!found) S.currentWeapon = 3; // 匕首
}

function handleEquipDrop(slotType, e) {
    const dt = e.dataTransfer.getData('text/plain');
    if (!dt || !dt.startsWith('stash:')) return;
    const entryIdx = parseInt(dt.split(':')[1]);
    if (isNaN(entryIdx) || !P.stashGrid._items || entryIdx >= P.stashGrid._items.length) return;
    const entry = P.stashGrid._items[entryIdx];
    if (!entry) return;
    const existingId = getEquipItemId(slotType);
    var ed1=getStashDims();
    if (existingId) { const s = findFreeSlot(P.stashGrid, ed1.cols, ed1.rows, existingId); if (!s) { alert('仓库空间不足！'); return; } placeInGrid(P.stashGrid, ed1.cols, existingId, s.col, s.row); clearEquipSlot(slotType); }
    if (setEquipItem(slotType, entry.id)) { removeFromGrid(P.stashGrid, entry); } else { alert('该物品无法装备到此槽位！'); return; }
    savePersistent(); renderAllInventory(); renderStashGrid(); updateAllLobbyUI();
}

function equipFromStash(itemId) {
    const def = ITEMS[itemId]; if (!def) return;
    // For small items (ammo/heal/1x1 valuables), put in rig or pocket
    if (def.w === 1 && def.h === 1 && (def.type === 'ammo' || def.type === 'heal' || def.type === 'valuable')) {
        // Try rig first
        const rigSlots = S.equipment.chestRig ? ITEMS[S.equipment.chestRig].slots : 0;
        if (rigSlots > 0 && (S._rigItems || []).length < rigSlots) {
            S._rigItems = S._rigItems || []; S._rigItems.push(itemId);
            const entry = P.stashGrid._items ? P.stashGrid._items.find(e => e.id === itemId) : null;
            if (entry) removeFromGrid(P.stashGrid, entry);
            savePersistent(); renderAllInventory(); renderStashGrid(); updateAllLobbyUI(); return;
        }
        // Try pockets
        if (S.pockets.length < S.maxPockets) {
            S.pockets.push(itemId);
            const entry = P.stashGrid._items ? P.stashGrid._items.find(e => e.id === itemId) : null;
            if (entry) removeFromGrid(P.stashGrid, entry);
            savePersistent(); renderAllInventory(); renderStashGrid(); updateAllLobbyUI(); return;
        }
        alert('胸挂和口袋都已满！');
        return;
    }
    // Find appropriate equipment slot
    let slotType = null;
    if (def.type === 'weapon') {
        const wSlot = def.wSlot || 'primary';
        if (wSlot === 'primary') { if (!S.weaponSlots[0]) slotType = 'primary1'; else if (!S.weaponSlots[1]) slotType = 'primary2'; }
        else if (wSlot === 'secondary') { if (!S.weaponSlots[2]) slotType = 'secondary'; }
    } else if (def.type === 'armor') { if (!S.equipment.armor) slotType = 'armor'; }
    else if (def.type === 'helmet') { if (!S.equipment.helmet) slotType = 'helmet'; }
    else if (def.type === 'chestRig') { if (!S.equipment.chestRig) slotType = 'chestRig'; }
    else if (def.type === 'backpack') { if (!S.equipment.backpack) slotType = 'backpack'; }
    if (!slotType) { alert('没有可用装备槽！请将小件物品拖入胸挂或口袋。'); return; }
    // Unequip existing if any
    const existingId = getEquipItemId(slotType);
    var ed2=getStashDims();
    if (existingId) { const s = findFreeSlot(P.stashGrid, ed2.cols, ed2.rows, existingId); if (!s) { alert('仓库空间不足！'); return; } placeInGrid(P.stashGrid, ed2.cols, existingId, s.col, s.row); clearEquipSlot(slotType); }
    const entry = P.stashGrid._items ? P.stashGrid._items.find(e => e.id === itemId) : null;
    if (!entry) return;
    if (setEquipItem(slotType, itemId)) { removeFromGrid(P.stashGrid, entry); }
    savePersistent(); renderAllInventory(); renderStashGrid(); updateAllLobbyUI();
}

function unequipItem(slotType) {
    const itemId = getEquipItemId(slotType); if (!itemId) return;
    var ed3=getStashDims();
    const s = findFreeSlot(P.stashGrid, ed3.cols, ed3.rows, itemId); if (!s) { alert('仓库空间不足！'); return; }
    placeInGrid(P.stashGrid, ed3.cols, itemId, s.col, s.row); clearEquipSlot(slotType);
    savePersistent(); renderAllInventory(); renderStashGrid(); updateAllLobbyUI();
}

// ====== Loadout Preset System ======
function saveLoadout(name) {
    var loadout = {
        name: name,
        armor: S.equipment.armor || null,
        helmet: S.equipment.helmet || null,
        chestRig: S.equipment.chestRig || null,
        backpack: S.equipment.backpack || null,
        primary1: S.weaponSlots[0] || null,
        primary2: S.weaponSlots[1] || null,
        secondary: S.weaponSlots[2] || null,
        pockets: (S.pockets || []).slice(),
        rigItems: (S._rigItems || []).slice(),
        backpackItems: (S.backpack._items || []).map(function(e) { return e.id; }),
        secureItems: (S.secureContainer._items || []).map(function(e) { return e.id; }),
        keychain: (P.keychain || [null,null,null,null]).slice(),
        keyUses: (P.keyUses || [0,0,0,0]).slice(),
    };
    P.loadouts = P.loadouts || [];
    // Overwrite if same name exists
    for (var i = 0; i < P.loadouts.length; i++) {
        if (P.loadouts[i].name === name) { P.loadouts[i] = loadout; savePersistent(); renderLoadoutPanel(); showFloatingMsg('配装方案「' + name + '」已更新'); return; }
    }
    P.loadouts.push(loadout);
    savePersistent();
    renderLoadoutPanel();
    showFloatingMsg('配装方案「' + name + '」已保存');
}

function _takeFromStash(itemId) {
    if (!itemId) return false;
    var items = P.stashGrid._items || [];
    for (var i = 0; i < items.length; i++) {
        if (items[i].id === itemId) { removeFromGrid(P.stashGrid, items[i]); return true; }
    }
    return false;
}

// Auto-buy helper: try stash first, then purchase from shop if affordable
var _loadoutPurchased = [];
function _takeOrBuy(itemId) {
    if (!itemId) return false;
    if (_takeFromStash(itemId)) return true;
    var sp = SHOP_PRICES[itemId];
    if (sp && P.money >= sp.buy) {
        P.money -= sp.buy;
        _loadoutPurchased.push({ name: ITEMS[itemId] ? ITEMS[itemId].name : itemId, price: sp.buy });
        return true;
    }
    return false;
}

function loadLoadout(index) {
    var lt = P.loadouts[index];
    if (!lt) return;
    var ed = getStashDims();
    var stashCols = ed.cols, stashRows = ed.rows;
    _loadoutPurchased = [];

    // Step 1: Strip all current equipment → stash
    var slotTypes = ['helmet', 'armor', 'chestRig', 'backpack', 'secondary', 'primary2', 'primary1'];
    for (var si = 0; si < slotTypes.length; si++) {
        var st = slotTypes[si];
        var itemId = getEquipItemId(st);
        if (itemId && ITEMS[itemId]) {
            var s = findFreeSlot(P.stashGrid, stashCols, stashRows, itemId);
            if (s) { placeInGrid(P.stashGrid, stashCols, itemId, s.col, s.row); }
        }
        clearEquipSlot(st);
    }

    // Step 2: Strip carry items → stash
    // Pockets
    while (S.pockets.length > 0) {
        var pid = S.pockets.pop();
        if (pid && ITEMS[pid]) { var s = findFreeSlot(P.stashGrid, stashCols, stashRows, pid); if (s) placeInGrid(P.stashGrid, stashCols, pid, s.col, s.row); }
    }
    // Rig items
    if (S._rigItems) {
        while (S._rigItems.length > 0) {
            var rid = S._rigItems.pop();
            if (rid && ITEMS[rid]) { var s = findFreeSlot(P.stashGrid, stashCols, stashRows, rid); if (s) placeInGrid(P.stashGrid, stashCols, rid, s.col, s.row); }
        }
    }
    // Backpack grid items
    if (S.backpack._items) {
        var bpItems = S.backpack._items.slice();
        for (var bi = 0; bi < bpItems.length; bi++) {
            removeFromGrid(S.backpack, bpItems[bi]);
            if (ITEMS[bpItems[bi].id]) { var s = findFreeSlot(P.stashGrid, stashCols, stashRows, bpItems[bi].id); if (s) placeInGrid(P.stashGrid, stashCols, bpItems[bi].id, s.col, s.row); }
        }
    }
    // Secure container items
    if (S.secureContainer._items) {
        var scItems = S.secureContainer._items.slice();
        for (var ci = 0; ci < scItems.length; ci++) {
            removeFromGrid(S.secureContainer, scItems[ci]);
            if (ITEMS[scItems[ci].id]) { var s = findFreeSlot(P.stashGrid, stashCols, stashRows, scItems[ci].id); if (s) placeInGrid(P.stashGrid, stashCols, scItems[ci].id, s.col, s.row); }
        }
    }
    // Reset grids
    S.backpack = initGrid(1); S.backpackCols = 0; S.backpackRows = 0;
    S.secureContainer = initGrid(3);
    S._rigItems = [];

    // Strip keychain items → stash
    for (var kci = 0; kci < 4; kci++) {
        if (P.keychain[kci]) {
            var s = findFreeSlot(P.stashGrid, stashCols, stashRows, P.keychain[kci]);
            if (s) placeInGrid(P.stashGrid, stashCols, P.keychain[kci], s.col, s.row);
            P.keychain[kci] = null; P.keyUses[kci] = 0;
        }
    }

    // Step 3: Equip loadout items from stash (auto-buy if not in stash)
    var missing = [];

    // Equipment (armor/helmet/chestRig/backpack store item IDs directly)
    if (lt.armor) { if (_takeOrBuy(lt.armor)) setEquipItem('armor', lt.armor); else missing.push(lt.armor); }
    if (lt.helmet) { if (_takeOrBuy(lt.helmet)) setEquipItem('helmet', lt.helmet); else missing.push(lt.helmet); }
    if (lt.chestRig) { if (_takeOrBuy(lt.chestRig)) setEquipItem('chestRig', lt.chestRig); else missing.push(lt.chestRig); }
    if (lt.backpack) { if (_takeOrBuy(lt.backpack)) setEquipItem('backpack', lt.backpack); else missing.push(lt.backpack); }

    // Weapons (weaponSlots store weapon keys, stash stores _item variants)
    if (lt.primary1) {
        var wItem1 = lt.primary1 + '_item';
        if (_takeOrBuy(wItem1)) setEquipItem('primary1', wItem1); else missing.push(lt.primary1);
    }
    if (lt.primary2) {
        var wItem2 = lt.primary2 + '_item';
        if (_takeOrBuy(wItem2)) setEquipItem('primary2', wItem2); else missing.push(lt.primary2);
    }
    if (lt.secondary) {
        var wItem3 = lt.secondary + '_item';
        if (_takeOrBuy(wItem3)) setEquipItem('secondary', wItem3); else missing.push(lt.secondary);
    }

    // Pockets
    if (lt.pockets) {
        for (var pi = 0; pi < lt.pockets.length; pi++) {
            var ppid = lt.pockets[pi];
            if (ppid) { if (_takeOrBuy(ppid)) S.pockets.push(ppid); else missing.push(ppid); }
        }
    }
    // Rig items
    if (lt.rigItems) {
        for (var ri = 0; ri < lt.rigItems.length; ri++) {
            var rrid = lt.rigItems[ri];
            if (rrid) { if (_takeOrBuy(rrid)) S._rigItems.push(rrid); else missing.push(rrid); }
        }
    }
    // Backpack items (find free slots in the newly equipped backpack)
    if (lt.backpackItems) {
        for (var bi2 = 0; bi2 < lt.backpackItems.length; bi2++) {
            var bid = lt.backpackItems[bi2];
            if (bid && _takeOrBuy(bid)) {
                var s = findFreeSlot(S.backpack, S.backpackCols, S.backpackRows, bid);
                if (s) placeInGrid(S.backpack, S.backpackCols, bid, s.col, s.row);
            } else if (bid) missing.push(bid);
        }
    }
    // Secure container items
    if (lt.secureItems) {
        for (var si2 = 0; si2 < lt.secureItems.length; si2++) {
            var sid = lt.secureItems[si2];
            if (sid && _takeOrBuy(sid)) {
                var s = findFreeSlot(S.secureContainer, 3, 3, sid);
                if (s) placeInGrid(S.secureContainer, 3, sid, s.col, s.row);
            } else if (sid) missing.push(sid);
        }
    }
    // Keychain
    if (lt.keychain) {
        for (var ki = 0; ki < 4; ki++) {
            if (lt.keychain[ki] && _takeOrBuy(lt.keychain[ki])) {
                P.keychain[ki] = lt.keychain[ki];
                P.keyUses[ki] = lt.keyUses ? (lt.keyUses[ki] || 10) : 10;
            }
        }
    }

    savePersistent();
    renderAllInventory();
    renderStashGrid();
    renderStashKeychain();
    updateAllLobbyUI();

    if (missing.length > 0 && _loadoutPurchased.length > 0) {
        var totalCost = _loadoutPurchased.reduce(function(s, p) { return s + p.price; }, 0);
        showFloatingMsg('配装「' + lt.name + '」已加载，自动购买 ' + _loadoutPurchased.length + ' 件（₵' + totalCost.toLocaleString() + '），缺 ' + missing.length + ' 件');
    } else if (missing.length > 0) {
        showFloatingMsg('配装「' + lt.name + '」已加载，缺 ' + missing.length + ' 件物品（仓库中未找到）');
    } else if (_loadoutPurchased.length > 0) {
        var totalCost2 = _loadoutPurchased.reduce(function(s, p) { return s + p.price; }, 0);
        showFloatingMsg('配装「' + lt.name + '」已加载，自动购买 ' + _loadoutPurchased.length + ' 件（₵' + totalCost2.toLocaleString() + '）');
    } else {
        showFloatingMsg('配装「' + lt.name + '」已一键加载');
    }
}

function deleteLoadout(index) {
    if (!P.loadouts || index < 0 || index >= P.loadouts.length) return;
    var name = P.loadouts[index].name;
    P.loadouts.splice(index, 1);
    savePersistent();
    renderLoadoutPanel();
    showFloatingMsg('配装方案「' + name + '」已删除');
}

function saveLoadoutFromInput() {
    var input = document.getElementById('loadoutNameInput');
    var name = input ? input.value.trim() : '';
    if (!name) { showFloatingMsg('请输入配装名称'); return; }
    saveLoadout(name);
    if (input) input.value = '';
}

function renderLoadoutPanel() {
    var container = document.getElementById('loadoutPanel');
    if (!container) return;
    var loadouts = P.loadouts || [];
    var html = '';

    // Save row
    html += '<div class="loadout-save-row">';
    html += '<input type="text" id="loadoutNameInput" placeholder="输入配装名称..." maxlength="12" class="loadout-name-input">';
    html += '<button class="loadout-save-btn" onclick="saveLoadoutFromInput()">💾 保存当前配装</button>';
    html += '</div>';

    // Saved loadouts
    if (loadouts.length === 0) {
        html += '<div class="loadout-empty">暂无保存的配装方案，配置好装备后点击保存即可</div>';
    } else {
        for (var i = 0; i < loadouts.length; i++) {
            var lt = loadouts[i];
            var parts = [];
            if (lt.primary1) { var w = WEAPONS[lt.primary1]; if (w) parts.push(w.name); }
            if (lt.armor && ITEMS[lt.armor]) parts.push(ITEMS[lt.armor].name);
            if (lt.helmet && ITEMS[lt.helmet]) parts.push(ITEMS[lt.helmet].name);
            if (lt.chestRig && ITEMS[lt.chestRig]) parts.push(ITEMS[lt.chestRig].name);
            if (lt.backpack && ITEMS[lt.backpack]) parts.push(ITEMS[lt.backpack].name);
            var totalItems = (lt.pockets||[]).length + (lt.rigItems||[]).length + (lt.backpackItems||[]).length + (lt.secureItems||[]).length;
            html += '<div class="loadout-card" onclick="loadLoadout(' + i + ')">';
            html += '<div class="loadout-card-icon">⚡</div>';
            html += '<div class="loadout-card-body">';
            html += '<div class="loadout-card-name">' + lt.name + '</div>';
            html += '<div class="loadout-card-summary">' + (parts.join(' · ') || '空配装') + '</div>';
            html += '<div class="loadout-card-count">' + totalItems + ' 件携带物品</div>';
            html += '</div>';
            html += '<button class="loadout-card-delete" onclick="event.stopPropagation(); deleteLoadout(' + i + ')" title="删除">✕</button>';
            html += '</div>';
        }
    }

    container.innerHTML = html;
}

// ====== Render Character Equipment Panel ======
function renderCharPanel() {
    const grid = document.getElementById('equipCharSlots'); if (!grid) return;
    // Character slots: {slotType, row, col, w, h, icon, label}
    const slots = [
        { type: 'helmet',    row: 0,  col: 2, w: 2, h: 2, icon: '⛑️', label: '头盔' },
        { type: 'armor',     row: 2,  col: 2, w: 2, h: 2, icon: '🦺', label: '护甲' },
        { type: 'chestRig',  row: 4,  col: 2, w: 2, h: 2, icon: '🎽', label: '胸挂' },
        { type: 'backpack',  row: 6,  col: 2, w: 2, h: 2, icon: '🎒', label: '背包' },
        { type: 'secondary', row: 8,  col: 2, w: 2, h: 2, icon: '🔫', label: '副武器' },
        { type: 'knife',     row: 10, col: 2, w: 2, h: 2, icon: '🔪', label: '近战', fixed: true },
        { type: 'primary1',  row: 12, col: 0, w: 6, h: 2, icon: '🎯', label: '主武器1' },
        { type: 'primary2',  row: 14, col: 0, w: 6, h: 2, icon: '🎯', label: '主武器2' },
    ];
    grid.innerHTML = '';
    for (const sl of slots) {
        const cell = document.createElement('div');
        cell.className = 'char-slot';
        cell.style.gridColumn = (sl.col + 1) + '/span ' + sl.w;
        cell.style.gridRow = (sl.row + 1) + '/span ' + sl.h;
        const itemId = sl.fixed ? 'knife' : getEquipItemId(sl.type);
        const def = itemId === 'knife' ? { icon: '🔪', name: '匕首', rarity: 'common' } : (itemId ? ITEMS[itemId] : null);
        if (def) { cell.classList.add('equipped', 'rarity-' + (def.rarity || 'common')); cell.style.fontSize = '22px'; cell.innerHTML = itemIcon(def); cell.title = def.name + ' - 右键卸下'; }
        else { cell.textContent = sl.icon; cell.style.opacity = '0.35'; cell.title = sl.label; }
        // Durability display
        if (sl.type === 'armor' && S.equipment.armorHP > 0) { const d = document.createElement('span'); d.className = 'slot-dur'; d.textContent = S.equipment.armorHP; cell.appendChild(d); }
        if (sl.type === 'helmet' && S.equipment.helmetHP > 0) { const d = document.createElement('span'); d.className = 'slot-dur'; d.textContent = S.equipment.helmetHP; cell.appendChild(d); }
        // Drag/drop handlers
        if (!sl.fixed) {
            cell.ondragover = function (e) { e.preventDefault(); cell.classList.add('drag-over'); e.dataTransfer.dropEffect = 'move'; };
            cell.ondragleave = function (e) { cell.classList.remove('drag-over'); };
            cell.ondrop = function (e) { e.preventDefault(); cell.classList.remove('drag-over'); handleEquipDrop(sl.type, e); };
            if (def) { cell.ondblclick = function () { unequipItem(sl.type); }; cell.oncontextmenu = function (e) { e.preventDefault(); unequipItem(sl.type); }; }
        }
        grid.appendChild(cell);
    }
    // Weight display
    const wd = document.getElementById('weightDisplay');
    if (wd) { let tw = 0; for (const e of (P.stashGrid._items || [])) { const d = ITEMS[e.id]; if (d) tw += d.w * d.h; } wd.textContent = '负重 ' + tw + '/' + getMaxWeight() + ' kg'; }
}

// ====== Render Carry-in Inventory (胸挂/口袋/背包/安全箱) ======
function renderCarryInventory() {
    // Chest Rig (quick slots - 0 if no rig equipped)
    const rigSlots = S.equipment.chestRig ? ITEMS[S.equipment.chestRig].slots : 0;
    const showRig = rigSlots > 0;
    document.getElementById('rigGrid').parentElement.style.display = showRig ? '' : 'none';
    if (showRig) renderQuickGrid('rigGrid', 'rigCount', S._rigItems || [], rigSlots, 'rig');

    // Pockets (always visible)
    renderQuickGrid('pocketGrid', 'pocketCount', S.pockets, S.maxPockets, 'pocket');

    // Backpack (0×0 if no backpack equipped)
    const hasBP = S.equipment.backpack && S.backpackCols > 0 && S.backpackRows > 0;
    document.getElementById('backpackInvGrid').parentElement.style.display = hasBP ? '' : 'none';
    if (hasBP) renderStorageGrid('backpackInvGrid', 'bpCount', S.backpack, S.backpackCols, S.backpackRows);

    // Secure container (always 3×3)
    renderStorageGrid('secureInvGrid', 'secureCount', S.secureContainer, S.secureCols, S.secureRows);
}

function renderQuickGrid(divId, countId, items, maxSlots, gridType) {
    const div = document.getElementById(divId); if (!div) return;
    const count = document.getElementById(countId); if (count) count.textContent = items.length + '/' + maxSlots;
    const cols = Math.min(maxSlots, 6);
    const rows = Math.ceil(maxSlots / cols);
    div.style.gridTemplateColumns = 'repeat(' + cols + ', 42px)';
    div.style.gridTemplateRows = 'repeat(' + rows + ', 42px)';
    div.innerHTML = '';
    for (let i = 0; i < maxSlots; i++) {
        const cell = document.createElement('div'); cell.className = 'grid-cell empty';
        cell.style.gridColumn = (i % cols) + 1; cell.style.gridRow = Math.floor(i / cols) + 1;
        // Drop from stash
        cell.ondragover = function(e) { e.preventDefault(); cell.classList.add('drag-over'); e.dataTransfer.dropEffect = 'move'; };
        cell.ondragleave = function() { cell.classList.remove('drag-over'); };
        cell.ondrop = function(e) { e.preventDefault(); cell.classList.remove('drag-over');
            const dt = e.dataTransfer.getData('text/plain');
            if (dt && dt.startsWith('stash:')) {
                const idx = parseInt(dt.split(':')[1]);
                const entry = P.stashGrid._items ? P.stashGrid._items[idx] : null;
                if (entry && items.length < maxSlots) {
                    items.push(entry.id); removeFromGrid(P.stashGrid, entry);
                    savePersistent(); renderAllInventory(); renderStashGrid(); updateAllLobbyUI();
                }
            }
        };
        if (i < items.length && items[i]) {
            const def = ITEMS[items[i]];
            if (def) {
                cell.classList.remove('empty');
                cell.classList.add('grid-item', 'rarity-' + (def.rarity || 'common'));
                cell.innerHTML = '<div class="gi-icon">' + itemIcon(def) + '</div><div class="gi-name">' + def.name + '</div>';
                cell.title = def.name + ' (双击卸回仓库)';
                cell.ondblclick = function() {
                    var ed4=getStashDims();
                    const s = findFreeSlot(P.stashGrid, ed4.cols, ed4.rows, items[i]);
                    if (s) { placeInGrid(P.stashGrid, ed4.cols, items[i], s.col, s.row); items.splice(i, 1); savePersistent(); renderAllInventory(); renderStashGrid(); updateAllLobbyUI(); }
                };
            }
        }
        div.appendChild(cell);
    }
}

function renderStorageGrid(divId, countId, grid, cols, rows) {
    const div = document.getElementById(divId); if (!div) return;
    const count = document.getElementById(countId); if (count) count.textContent = (grid._items ? grid._items.length : 0) + '/' + (cols * rows);
    div.style.gridTemplateColumns = 'repeat(' + cols + ', 42px)';
    div.style.gridTemplateRows = 'repeat(' + rows + ', 42px)';
    div.innerHTML = '';
    // Empty cells
    for (let r = 0; r < rows; r++) { for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div'); cell.className = 'grid-cell empty';
        cell.style.gridColumn = c + 1; cell.style.gridRow = r + 1; div.appendChild(cell);
    }}
    // Items (spanning their full w×h with rarity styling)
    if (grid._items) { for (const entry of grid._items) {
        const def = ITEMS[entry.id]; if (!def) continue;
        const el = document.createElement('div');
        el.className = 'grid-item rarity-' + (def.rarity || 'common');
        el.style.gridColumn = (entry.col + 1) + '/span ' + (def.w || 1);
        el.style.gridRow = (entry.row + 1) + '/span ' + (def.h || 1);
        el.innerHTML = '<div class="gi-icon">' + itemIcon(def) + '</div><div class="gi-name">' + def.name + '</div>';
        el.title = def.name + ' - ₵' + def.value;
        div.appendChild(el);
    }}
}

function renderAllInventory() { renderCharPanel(); renderCarryInventory(); }

// ====== Search Screen Rendering ======
// ====== Weight & Zone Validation ======
function getItemWeight(itemId) {
    const def = ITEMS[itemId]; if (!def) return 0;
    return (def.w || 1) * (def.h || 1);
}

// ====== Keychain rendering ======
function renderKeychainGrid(div) {
    if (!div) return;
    const maxSlots = 4;
    div.style.gridTemplateColumns = 'repeat(4, 42px)';
    div.style.gridTemplateRows = 'repeat(1, 42px)';
    div.innerHTML = '';
    for (let i = 0; i < maxSlots; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell empty';
        cell.style.gridColumn = i + 1; cell.style.gridRow = 1;
        const onChange = function() {
            if (S.phase === 'backpack') { renderBackpackInventory(); updateBackpackValue(); }
            else { renderSearchGrid(S.currentSearchContainer); updateSearchValue(); }
            updateHUD(); updateWeaponUI();
        };
        makeKeychainDropCell(cell, i, onChange);
        const kid = S.keychain[i];
        if (kid) {
            const def = ITEMS[kid];
            if (def) {
                cell.classList.remove('empty');
                cell.classList.add('grid-item', 'rarity-' + (def.rarity || 'common'));
                cell.innerHTML = '<div class="gi-icon">' + itemIcon(def) + '</div><div class="gi-name" style="font-size:7px;">×' + S.keyUses[i] + '</div>';
                cell.title = def.name + ' (剩余' + S.keyUses[i] + '次)';
                cell.draggable = true;
                cell.ondragstart = function(e) { e.stopPropagation(); cell.classList.add('dragging'); e.dataTransfer.setData('text/plain', 'keychain:' + i); e.dataTransfer.effectAllowed = 'move'; };
                cell.ondragend = function() { cell.classList.remove('dragging'); };
                cell.ondblclick = function() { moveKeychainToContainer(i); };
            }
        } else {
            cell.innerHTML = '<span style="color:#444;font-size:10px;">🔑</span>';
        }
        div.appendChild(cell);
    }
}

function makeKeychainDropCell(cell, slotIdx, onChange) {
    cell.ondragover = function(e) {
        e.preventDefault(); e.stopPropagation();
        cell.style.background = 'rgba(255,152,0,0.2)';
    };
    cell.ondragleave = function() { cell.style.background = ''; };
    cell.ondrop = function(e) {
        e.preventDefault(); e.stopPropagation();
        cell.style.background = '';
        const dt = e.dataTransfer.getData('text/plain');
        if (!dt) return;
        // From container search screen
        if (dt.startsWith('container:')) {
            const idx = parseInt(dt.split(':')[1]);
            const container = S.currentSearchContainer;
            if (container && container.items[idx] && !container.items[idx].taken) {
                const itemType = container.items[idx].type;
                if (canItemFitZone(itemType, 'keychain') && !S.keychain[slotIdx]) {
                    S.keychain[slotIdx] = itemType;
                    S.keyUses[slotIdx] = 10;
                    takeContainerItem(container, container.items[idx]);
                    onChange();
                }
            }
            return;
        }
        // From another keychain slot (swap)
        if (dt.startsWith('keychain:')) {
            const srcIdx = parseInt(dt.split(':')[1]);
            if (srcIdx === slotIdx) return;
            const tmpType = S.keychain[slotIdx];
            const tmpUses = S.keyUses[slotIdx];
            S.keychain[slotIdx] = S.keychain[srcIdx];
            S.keyUses[slotIdx] = S.keyUses[srcIdx];
            S.keychain[srcIdx] = tmpType;
            S.keyUses[srcIdx] = tmpUses;
            onChange();
            return;
        }
        // From quick slot (rig/pocket)
        if (dt.startsWith('quick:')) {
            const parts = dt.split(':');
            const srcZone = parts[1]; const srcIdx = parseInt(parts[2]);
            let itemType = null;
            if (srcZone === 'rig') itemType = (S._rigItems || [])[srcIdx];
            else if (srcZone === 'pocket') itemType = S.pockets[srcIdx];
            if (itemType && canItemFitZone(itemType, 'keychain') && !S.keychain[slotIdx]) {
                S.keychain[slotIdx] = itemType;
                S.keyUses[slotIdx] = 10;
                if (srcZone === 'rig') S._rigItems.splice(srcIdx, 1);
                else S.pockets.splice(srcIdx, 1);
                onChange();
            }
            return;
        }
        // From backpack/secure grid
        if (dt.startsWith('grid:')) {
            const parts = dt.split(':');
            const srcZone = parts[1]; const srcRef = parts.slice(2).join(':');
            let srcGrid = null, srcEntry = null;
            if (srcZone === 'backpack') { srcGrid = S.backpack; srcEntry = S.backpack._items ? S.backpack._items.find(x => x.id + ':' + x.col + ':' + x.row === srcRef) : null; }
            else if (srcZone === 'secure') { srcGrid = S.secureContainer; srcEntry = S.secureContainer._items ? S.secureContainer._items.find(x => x.id + ':' + x.col + ':' + x.row === srcRef) : null; }
            if (srcEntry && canItemFitZone(srcEntry.id, 'keychain') && !S.keychain[slotIdx]) {
                S.keychain[slotIdx] = srcEntry.id;
                S.keyUses[slotIdx] = srcEntry._keyUses || 10;
                removeFromGrid(srcGrid, srcEntry);
                onChange();
            }
            return;
        }
    };
}

function moveKeychainToContainer(slotIdx) {
    const kid = S.keychain[slotIdx];
    if (!kid) return;
    var savedUses = S.keyUses[slotIdx];
    // Try backpack first
    if (S.backpackCols > 0) {
        const slot = findFreeSlot(S.backpack, S.backpackCols, S.backpackRows, kid);
        if (slot) {
            placeInGrid(S.backpack, S.backpackCols, kid, slot.col, slot.row);
            var ne = S.backpack._items[S.backpack._items.length - 1];
            if (ne && savedUses > 0) ne._keyUses = savedUses;
            S.keychain[slotIdx] = null; S.keyUses[slotIdx] = 0;
            if (S.phase === 'backpack') { renderBackpackInventory(); updateBackpackValue(); }
            else { renderSearchGrid(S.currentSearchContainer); updateSearchValue(); }
            updateHUD(); return;
        }
    }
    // Try secure container
    const sSlot = findFreeSlot(S.secureContainer, S.secureCols, S.secureRows, kid);
    if (sSlot) {
        placeInGrid(S.secureContainer, S.secureCols, kid, sSlot.col, sSlot.row);
        var ne2 = S.secureContainer._items[S.secureContainer._items.length - 1];
        if (ne2 && savedUses > 0) ne2._keyUses = savedUses;
        S.keychain[slotIdx] = null; S.keyUses[slotIdx] = 0;
        if (S.phase === 'backpack') { renderBackpackInventory(); updateBackpackValue(); }
        else { renderSearchGrid(S.currentSearchContainer); updateSearchValue(); }
        updateHUD();
    }
}

function getKeychainItem(slotIdx) {
    const kid = S.keychain[slotIdx];
    if (!kid) return null;
    return { type: kid, idx: slotIdx, isQuick: true };
}

function removeKeychainItem(slotIdx) {
    if (S.keychain[slotIdx]) { S.keychain[slotIdx] = null; S.keyUses[slotIdx] = 0; return true; }
    return false;
}

function getTotalCarryWeight() {
    let w = 0;
    // Weapons
    for (let i = 0; i < 3; i++) { if (S.weaponSlots[i]) { const wid = S.weaponSlots[i]; const itemId = Object.keys(ITEMS).find(k => ITEMS[k].type === 'weapon' && ITEMS[k].weapon === wid); if (itemId) w += getItemWeight(itemId); } }
    // Gear
    for (const k of ['armor', 'helmet', 'chestRig', 'backpack']) { if (S.equipment[k]) w += getItemWeight(S.equipment[k]); }
    // Backpack items
    if (S.backpack._items) { for (const e of S.backpack._items) w += getItemWeight(e.id); }
    // Secure container
    if (S.secureContainer._items) { for (const e of S.secureContainer._items) w += getItemWeight(e.id); }
    // Pockets + rig
    for (const p of S.pockets) w += getItemWeight(p);
    if (S._rigItems) for (const r of S._rigItems) w += getItemWeight(r);
    // Keychain
    for (const k of S.keychain) if (k) w += getItemWeight(k);
    return w;
}

// MAX_CARRY_WEIGHT 已废弃，使用 getMaxWeight() 根据负重等级动态获取上限

function canItemFitZone(itemType, zone) {
    const def = ITEMS[itemType]; if (!def) return false;
    if (zone === 'rig') {
        // 胸挂: 任何非装备物品 (和背包一样)
        return def.type !== 'armor' && def.type !== 'helmet' && def.type !== 'chestRig' && def.type !== 'backpack';
    }
    if (zone === 'pocket') {
        // 口袋: 任何非装备物品 (和背包一样)
        return def.type !== 'armor' && def.type !== 'helmet' && def.type !== 'chestRig' && def.type !== 'backpack';
    }
    if (zone === 'keychain') {
        // 钥匙链: 仅钥匙卡
        return def.type === 'keycard';
    }
    if (zone === 'backpack') {
        return def.type !== 'armor' && def.type !== 'helmet' && def.type !== 'chestRig' && def.type !== 'backpack';
    }
    if (zone === 'secure') return true;
    return false;
}

// ====== Search Screen Drop Handler ======
function makeZoneDropCell(cell, zone, col, row) {
    cell.ondragover = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer && e.dataTransfer.types.includes('text/plain')) {
            const dt = e.dataTransfer.getData('text/plain');
            if (dt.startsWith('container:')) {
                const idx = parseInt(dt.split(':')[1]);
                const container = S.currentSearchContainer;
                if (container && container.items[idx] && !container.items[idx].taken) {
                    const itemType = container.items[idx].type;
                    if (canItemFitZone(itemType, zone)) {
                        cell.classList.add('drag-over');
                        e.dataTransfer.dropEffect = 'move';
                    }
                }
            }
        }
    };
    cell.ondragleave = function (e) {
        cell.classList.remove('drag-over');
    };
    cell.ondrop = function (e) {
        e.preventDefault(); e.stopPropagation();
        cell.classList.remove('drag-over');
        const dt = e.dataTransfer.getData('text/plain');
        if (!dt || !dt.startsWith('container:')) return;
        const idx = parseInt(dt.split(':')[1]);
        const container = S.currentSearchContainer; if (!container) return;
        const item = container.items[idx];
        if (!item || item.taken || !container._revealed || !container._revealed[idx]) return;
        const def = ITEMS[item.type]; if (!def) return;

        // Zone validation
        if (!canItemFitZone(item.type, zone)) return;

        // Weight check
        const itemWt = getItemWeight(item.type);
        if (getTotalCarryWeight() + itemWt > getMaxWeight()) {
            alert('负重超限！当前总重 ' + getTotalCarryWeight() + 'kg，物品 ' + itemWt + 'kg，上限 ' + getMaxWeight() + 'kg');
            return;
        }

        // Place item in the correct zone
        let placed = false;
        if (zone === 'rig') {
            const rigSlots = S.equipment.chestRig ? ITEMS[S.equipment.chestRig].slots : 0;
            if (rigSlots > 0 && (S._rigItems || []).length < rigSlots) {
                S._rigItems = S._rigItems || []; S._rigItems.push(item.type); placed = true;
            }
        } else if (zone === 'pocket') {
            if (S.pockets.length < S.maxPockets) { S.pockets.push(item.type); placed = true; }
        } else if (zone === 'backpack') {
            if (S.backpackCols > 0) {
                // Try to place at drop position, or auto-find
                if (canPlaceInGrid(S.backpack, S.backpackCols, item.type, col, row)) {
                    placeInGrid(S.backpack, S.backpackCols, item.type, col, row); placed = true;
                } else {
                    const slot = findFreeSlot(S.backpack, S.backpackCols, S.backpackRows, item.type);
                    if (slot) { placeInGrid(S.backpack, S.backpackCols, item.type, slot.col, slot.row); placed = true; }
                }
            }
        } else if (zone === 'secure') {
            if (canPlaceInGrid(S.secureContainer, S.secureCols, item.type, col, row)) {
                placeInGrid(S.secureContainer, S.secureCols, item.type, col, row); placed = true;
            } else {
                const slot = findFreeSlot(S.secureContainer, S.secureCols, S.secureRows, item.type);
                if (slot) { placeInGrid(S.secureContainer, S.secureCols, item.type, slot.col, slot.row); placed = true; }
            }
        }

        if (placed) {
            takeContainerItem(container, item);
            S.lootValue += def.value;
            if (autoEquipLoot(item.type)) {
                // Item was equipped to character — remove from the zone it was placed in
                if (zone === 'rig') { const ri = (S._rigItems || []).lastIndexOf(item.type); if (ri >= 0) S._rigItems.splice(ri, 1); }
                else if (zone === 'pocket') { const pi = S.pockets.lastIndexOf(item.type); if (pi >= 0) S.pockets.splice(pi, 1); }
                else if (zone === 'backpack' && S.backpack._items && S.backpack._items.length > 0) { removeFromGrid(S.backpack, S.backpack._items[S.backpack._items.length - 1]); }
                else if (zone === 'secure' && S.secureContainer._items && S.secureContainer._items.length > 0) { removeFromGrid(S.secureContainer, S.secureContainer._items[S.secureContainer._items.length - 1]); }
            }
            S._lootItems = S._lootItems || []; S._lootItems.push({ id: item.type, name: def.name, value: def.value, rarity: def.rarity });
            sfxPickup(def.rarity);
            renderSearchGrid(container); updateSearchValue(); updateHUD(); updateWeaponUI();
        } else {
            alert('目标区域空间不足！');
        }
    };
}

// ====== Render Search Inventory ======
function renderSearchInventory() {
    // === Character equipment (compact, same slots as prep screen) ===
    const charGrid = document.getElementById('searchCharSlots');
    if (charGrid) {
        const searchSlots = [
            { type: 'helmet', row: 0, col: 1, w: 2, h: 2, icon: '⛑️' },
            { type: 'armor', row: 2, col: 1, w: 2, h: 2, icon: '🦺' },
            { type: 'chestRig', row: 4, col: 1, w: 2, h: 1, icon: '🎽' },
            { type: 'backpack', row: 5, col: 1, w: 2, h: 1, icon: '🎒' },
            { type: 'secondary', row: 6, col: 1, w: 2, h: 1, icon: '🔫' },
            { type: 'knife', row: 7, col: 1, w: 2, h: 1, icon: '🔪', fixed: true },
        ];
        charGrid.innerHTML = '';
        for (const sl of searchSlots) {
            const cell = document.createElement('div');
            cell.className = 'char-slot';
            cell.style.gridColumn = (sl.col + 1) + '/span ' + sl.w;
            cell.style.gridRow = (sl.row + 1) + '/span ' + sl.h;
            const itemId = sl.fixed ? 'knife' : getEquipItemId(sl.type);
            const def = itemId === 'knife' ? { icon: '🔪', name: '匕首', rarity: 'common' } : (itemId ? ITEMS[itemId] : null);
            if (def) { cell.classList.add('equipped', 'rarity-' + (def.rarity || 'common')); cell.innerHTML = itemIcon(def); cell.title = def.name + ' (点击卸下到背包)'; }
            else { cell.textContent = sl.icon; cell.style.opacity = '0.35'; cell.title = sl.type; }
            if (sl.type === 'armor' && S.equipment.armorHP > 0) cell.innerHTML += ' <span style="font-size:10px;color:#aaa;">' + S.equipment.armorHP + '</span>';
            // 点击卸下装备到背包（匕首除外）
            if (!sl.fixed && itemId) {
                cell.style.cursor = 'pointer';
                if (sl.type === 'backpack') {
                    cell.title = def.name + ' (拖拽丢弃 | 需先清空背包物品)';
                    cell.onclick = function () { showFloatingMsg('背包请拖拽到丢弃区域卸下'); };
                } else {
                    cell.title = def.name + ' (点击卸下到背包 | 拖拽到容器/丢弃)';
                    cell.onclick = function () {
                        unequipItemToBackpack(sl.type);
                        renderSearchInventory();
                    };
                }
                // 拖拽支持：可拖到容器/尸体空槽/丢弃区域
                cell.draggable = true;
                cell.ondragstart = function (e) {
                    e.dataTransfer.setData('text/plain', 'equip:' + sl.type);
                    e.dataTransfer.effectAllowed = 'move';
                };
            }
            charGrid.appendChild(cell);
        }
    }
    // Primary weapons display
    const p1 = document.getElementById('searchPrimary1');
    if (p1) {
        const w = S.weaponSlots[0] ? WEAPONS[S.weaponSlots[0]] : null;
        p1.innerHTML = w ? itemIcon(w) + ' ' + w.name : '主武器1';
        p1.style.color = w ? '#fff' : '#555';
        p1.style.fontSize = w ? '14px' : '10px';
        if (w) {
            p1.style.cursor = 'grab';
            p1.title = w.name + ' (点击卸下到背包 | 拖拽移动/丢弃)';
            p1.onclick = function() { unequipWeaponToBackpack(0); };
            p1.draggable = true;
            p1.ondragstart = function(e) { e.dataTransfer.setData('text/plain', 'equip:primary1'); e.dataTransfer.effectAllowed = 'move'; };
            p1.ondragover = null; p1.ondragleave = null; p1.ondrop = null;
        } else {
            p1.style.cursor = 'pointer';
            p1.title = '主武器1 (拖拽武器到此处装备)';
            p1.onclick = null;
            p1.draggable = false;
            p1.ondragover = function(e) { e.preventDefault(); p1.style.background = 'rgba(76,175,80,0.3)'; p1.style.borderColor = '#4caf50'; };
            p1.ondragleave = function() { p1.style.background = ''; p1.style.borderColor = ''; };
            p1.ondrop = function(e) {
                e.preventDefault(); p1.style.background = ''; p1.style.borderColor = '';
                const dt = e.dataTransfer.getData('text/plain');
                let itemId = null;
                if (dt && dt.startsWith('weapon_item:')) itemId = dt.substring(12);
                else if (dt && dt.startsWith('item:')) { const parts = dt.split(':'); if(parts.length >= 5) itemId = parts[2]; }
                if (itemId && itemId.startsWith('weapon_')) {
                    if (!equipWeaponFromBackpack(itemId, 0)) showFloatingMsg('装备失败，检查背包空间');
                }
            };
        }
    }
    const p2 = document.getElementById('searchPrimary2');
    if (p2) {
        const w = S.weaponSlots[1] ? WEAPONS[S.weaponSlots[1]] : null;
        p2.innerHTML = w ? itemIcon(w) + ' ' + w.name : '主武器2';
        p2.style.color = w ? '#fff' : '#555';
        p2.style.fontSize = w ? '14px' : '10px';
        if (w) {
            p2.style.cursor = 'grab';
            p2.title = w.name + ' (点击卸下到背包 | 拖拽移动/丢弃)';
            p2.onclick = function() { unequipWeaponToBackpack(1); };
            p2.draggable = true;
            p2.ondragstart = function(e) { e.dataTransfer.setData('text/plain', 'equip:primary2'); e.dataTransfer.effectAllowed = 'move'; };
            p2.ondragover = null; p2.ondragleave = null; p2.ondrop = null;
        } else {
            p2.style.cursor = 'pointer';
            p2.title = '主武器2 (拖拽武器到此处装备)';
            p2.onclick = null;
            p2.draggable = false;
            p2.ondragover = function(e) { e.preventDefault(); p2.style.background = 'rgba(76,175,80,0.3)'; p2.style.borderColor = '#4caf50'; };
            p2.ondragleave = function() { p2.style.background = ''; p2.style.borderColor = ''; };
            p2.ondrop = function(e) {
                e.preventDefault(); p2.style.background = ''; p2.style.borderColor = '';
                const dt = e.dataTransfer.getData('text/plain');
                let itemId = null;
                if (dt && dt.startsWith('weapon_item:')) itemId = dt.substring(12);
                else if (dt && dt.startsWith('item:')) { const parts = dt.split(':'); if(parts.length >= 5) itemId = parts[2]; }
                if (itemId && itemId.startsWith('weapon_')) {
                    if (!equipWeaponFromBackpack(itemId, 1)) showFloatingMsg('装备失败，检查背包空间');
                }
            };
        }
    }

    // === Carry-in grids with zone-based drop handlers ===
    // Keychain
    renderKeychainGrid(document.getElementById('sKeychainGrid'));

    // Rig
    const rigSlots = S.equipment.chestRig ? ITEMS[S.equipment.chestRig].slots : 0;
    const showRig = rigSlots > 0;
    document.getElementById('sRigGrid').parentElement.style.display = showRig ? '' : 'none';
    if (showRig) renderZoneQuickGrid(document.getElementById('sRigGrid'), S._rigItems || [], rigSlots, 'rig');

    // Pockets
    renderZoneQuickGrid(document.getElementById('sPocketGrid'), S.pockets, S.maxPockets, 'pocket');

    // Backpack
    const hasBP = S.equipment.backpack && S.backpackCols > 0;
    document.getElementById('sBackpackGrid').parentElement.style.display = hasBP ? '' : 'none';
    if (hasBP) renderZoneStorageGrid(document.getElementById('sBackpackGrid'), S.backpack, S.backpackCols, S.backpackRows, 'backpack');

    // Secure container
    renderZoneStorageGrid(document.getElementById('sSecureGrid'), S.secureContainer, S.secureCols, S.secureRows, 'secure');

    // Update weight display
    const sw = document.getElementById('searchWeight');
    if (sw) sw.textContent = getTotalCarryWeight();
}

// Zone-aware grid renderers (with drop handlers)
// ====== Universal Zone Item Drag ======
function makeZoneItemDraggable(el, sourceType, itemRef, zoneName) {
    el.draggable = true;
    el.ondragstart = function(e) {
        e.stopPropagation();
        el.classList.add('dragging');
        e.dataTransfer.setData('text/plain', 'zone:' + zoneName + ':' + itemRef);
        e.dataTransfer.effectAllowed = 'move';
    };
    el.ondragend = function() { el.classList.remove('dragging'); };
}

function getZoneItemFromRef(ref, zoneName) {
    if (zoneName === 'rig') { const idx = parseInt(ref); return (S._rigItems && idx >= 0 && idx < S._rigItems.length) ? { type: S._rigItems[idx], idx, isQuick: true } : null; }
    if (zoneName === 'pocket') { const idx = parseInt(ref); return (idx >= 0 && idx < S.pockets.length) ? { type: S.pockets[idx], idx, isQuick: true } : null; }
    if (zoneName === 'backpack') { if (!S.backpack._items) return null; const e = S.backpack._items.find(x => x.id + ':' + x.col + ':' + x.row === ref); return e ? { entry: e, grid: S.backpack, cols: S.backpackCols, rows: S.backpackRows } : null; }
    if (zoneName === 'secure') { if (!S.secureContainer._items) return null; const e = S.secureContainer._items.find(x => x.id + ':' + x.col + ':' + x.row === ref); return e ? { entry: e, grid: S.secureContainer, cols: S.secureCols, rows: S.secureRows } : null; }
    return null;
}

function removeZoneItem(ref, zoneName) {
    if (zoneName === 'rig') { const idx = parseInt(ref); if (S._rigItems && idx >= 0 && idx < S._rigItems.length) { S._rigItems.splice(idx, 1); return true; } }
    if (zoneName === 'pocket') { const idx = parseInt(ref); if (idx >= 0 && idx < S.pockets.length) { S.pockets.splice(idx, 1); return true; } }
    if (zoneName === 'backpack') { const e = S.backpack._items ? S.backpack._items.find(x => x.id + ':' + x.col + ':' + x.row === ref) : null; if (e) { removeFromGrid(S.backpack, e); return true; } }
    if (zoneName === 'secure') { const e = S.secureContainer._items ? S.secureContainer._items.find(x => x.id + ':' + x.col + ':' + x.row === ref) : null; if (e) { removeFromGrid(S.secureContainer, e); return true; } }
    return false;
}

function handleUniversalDrop(e, targetZone, col, row) {
    e.preventDefault(); e.stopPropagation();
    const dt = e.dataTransfer.getData('text/plain');
    if (!dt) return false;
    const container = S.currentSearchContainer;

    // 装备拖到容器/背包/安全箱/快捷槽
    if (dt.startsWith('equip:')) {
        const slotType = dt.substring(6);
        const itemId = getEquipItemId(slotType);
        if (!itemId) return false;
        const def = ITEMS[itemId]; if (!def) return false;

        // 胸挂卸下前检查：胸挂里的物品需要先转移
        if (slotType === 'chestRig' && S._rigItems && S._rigItems.length > 0) {
            alert('请先清空胸挂里的物品再卸下胸挂！');
            return false;
        }

        let placed = false;
        if (targetZone === 'container') {
            if (!container) return false;
            const slot = findFreeSlot(container.grid, container.gridW, container.gridH, itemId);
            if (!slot) { alert('容器空间不足！'); return false; }
            placeInGrid(container.grid, container.gridW, itemId, slot.col, slot.row);
            const newEntry = container.grid._items[container.grid._items.length - 1];
            container._revealed.push(true);
            container.items.push({ ...def, type: itemId, taken: false, gridEntry: newEntry });
            placed = true;
        } else if (targetZone === 'backpack') {
            if (S.backpackCols > 0) {
                if (canPlaceInGrid(S.backpack, S.backpackCols, itemId, col, row)) {
                    placeInGrid(S.backpack, S.backpackCols, itemId, col, row); placed = true;
                } else {
                    const s = findFreeSlot(S.backpack, S.backpackCols, S.backpackRows, itemId);
                    if (s) { placeInGrid(S.backpack, S.backpackCols, itemId, s.col, s.row); placed = true; }
                }
            }
            if (!placed) { alert('背包空间不足！'); return false; }
        } else if (targetZone === 'secure') {
            if (canPlaceInGrid(S.secureContainer, S.secureCols, itemId, col, row)) {
                placeInGrid(S.secureContainer, S.secureCols, itemId, col, row); placed = true;
            } else {
                const s = findFreeSlot(S.secureContainer, S.secureCols, S.secureRows, itemId);
                if (s) { placeInGrid(S.secureContainer, S.secureCols, itemId, s.col, s.row); placed = true; }
            }
            if (!placed) { alert('安全箱空间不足！'); return false; }
        } else if (targetZone === 'rig') {
            const maxS = S.equipment.chestRig ? ITEMS[S.equipment.chestRig].slots : 0;
            if ((S._rigItems || []).length < maxS) { S._rigItems = S._rigItems || []; S._rigItems.push(itemId); placed = true; }
            if (!placed) { alert('胸挂空间不足！'); return false; }
        } else if (targetZone === 'pocket') {
            if (S.pockets.length < S.maxPockets) { S.pockets.push(itemId); placed = true; }
            if (!placed) { alert('口袋空间不足！'); return false; }
        }

        if (placed) {
            clearEquipSlot(slotType);
            showFloatingMsg('已卸下: ' + def.name);
            sfxPickup(def.rarity || 'common');
            return true;
        }
        return false;
    }

    if (dt.startsWith('item:container:')) {
        // Container item → Zone (from unified drag format)
        const parts = dt.split(':'); const itemType = parts[2]; const srcCol = parseInt(parts[3]); const srcRow = parseInt(parts[4]);
        // Find the container item at this position
        if (!container) return false;
        let foundItem = null, foundIdx = -1;
        for (let ci = 0; ci < container.items.length; ci++) {
            const ci2 = container.items[ci]; const ge = ci2.gridEntry;
            if (!ci2.taken && container._revealed && container._revealed[ci] && ci2.type === itemType && ge && ge.col === srcCol && ge.row === srcRow) {
                foundItem = ci2; foundIdx = ci; break;
            }
        }
        if (!foundItem) return false;
        const def = ITEMS[itemType]; if (!def || !canItemFitZone(itemType, targetZone)) return false;
        if (getTotalCarryWeight() + getItemWeight(itemType) > getMaxWeight()) { alert('负重超限！'); return false; }
        let placed = false;
        if (targetZone === 'rig') { if ((S._rigItems || []).length < (S.equipment.chestRig ? ITEMS[S.equipment.chestRig].slots : 0)) { S._rigItems = S._rigItems || []; S._rigItems.push(itemType); placed = true; } }
        else if (targetZone === 'pocket') { if (S.pockets.length < S.maxPockets) { S.pockets.push(itemType); placed = true; } }
        else if (targetZone === 'backpack') { if (S.backpackCols > 0) { if (canPlaceInGrid(S.backpack, S.backpackCols, itemType, col, row)) { placeInGrid(S.backpack, S.backpackCols, itemType, col, row); placed = true; } else { const s = findFreeSlot(S.backpack, S.backpackCols, S.backpackRows, itemType); if (s) { placeInGrid(S.backpack, S.backpackCols, itemType, s.col, s.row); placed = true; } } } }
        else if (targetZone === 'secure') { if (canPlaceInGrid(S.secureContainer, S.secureCols, itemType, col, row)) { placeInGrid(S.secureContainer, S.secureCols, itemType, col, row); placed = true; } else { const s = findFreeSlot(S.secureContainer, S.secureCols, S.secureRows, itemType); if (s) { placeInGrid(S.secureContainer, S.secureCols, itemType, s.col, s.row); placed = true; } } }
        // Also try backpack/secure when target is rig/pocket (overflow)
        if (!placed && (targetZone === 'rig' || targetZone === 'pocket')) {
            if (S.backpackCols > 0) { const s = findFreeSlot(S.backpack, S.backpackCols, S.backpackRows, itemType); if (s) { placeInGrid(S.backpack, S.backpackCols, itemType, s.col, s.row); placed = true; targetZone = 'backpack'; } }
        }
        if (placed) {
            takeContainerItem(container, foundItem);
            S.lootValue += def.value;
            if (autoEquipLoot(itemType)) {
                // Item was equipped to character — remove from the zone it was placed in
                if (targetZone === 'rig') { const ri = (S._rigItems || []).lastIndexOf(itemType); if (ri >= 0) S._rigItems.splice(ri, 1); }
                else if (targetZone === 'pocket') { const pi = S.pockets.lastIndexOf(itemType); if (pi >= 0) S.pockets.splice(pi, 1); }
                else if (targetZone === 'backpack' && S.backpack._items && S.backpack._items.length > 0) { removeFromGrid(S.backpack, S.backpack._items[S.backpack._items.length - 1]); }
                else if (targetZone === 'secure' && S.secureContainer._items && S.secureContainer._items.length > 0) { removeFromGrid(S.secureContainer, S.secureContainer._items[S.secureContainer._items.length - 1]); }
            }
            S._lootItems = S._lootItems || []; S._lootItems.push({ id: itemType, name: def.name, value: def.value, rarity: def.rarity });
            sfxPickup(def.rarity);
        } else { alert('目标空间不足！'); }
        return placed;
    }

    if (dt.startsWith('item:') || dt.startsWith('zone:') || dt.startsWith('quick:') || dt.startsWith('keychain:')) {
        // Cross-zone moves: item:srcZone:id:col:row or zone:srcZone:ref or quick:srcZone:idx or keychain:idx
        const parts = dt.split(':');
        let srcZone, itemType, srcCol, srcRow, itemInfo, keychainIdx = -1;
        if (dt.startsWith('item:')) {
            srcZone = parts[1]; itemType = parts[2]; srcCol = parseInt(parts[3]); srcRow = parseInt(parts[4]);
        } else if (dt.startsWith('quick:')) {
            srcZone = parts[1]; const srcIdx = parseInt(parts[2]);
            itemType = srcZone === 'rig' ? (S._rigItems || [])[srcIdx] : S.pockets[srcIdx];
        } else if (dt.startsWith('keychain:')) {
            srcZone = 'keychain'; keychainIdx = parseInt(parts[1]);
            itemType = S.keychain[keychainIdx];
        } else {
            srcZone = parts[1]; const ref = parts.slice(2).join(':');
            itemInfo = getZoneItemFromRef(ref, srcZone);
            if (itemInfo) itemType = itemInfo.isQuick ? itemInfo.type : itemInfo.entry.id;
        }
        if (!itemType) return false;
        const def = ITEMS[itemType]; if (!def) return false;

        if (srcZone === targetZone && srcZone !== 'container') {
            // Same-zone move: reposition (already handled by makeGridDropCell for grid zones)
            if (targetZone === 'backpack' && S.backpackCols > 0) {
                const srcEntry = (S.backpack[srcRow] && S.backpack[srcRow][srcCol]) || null;
                if (srcEntry && canPlaceInGrid(S.backpack, S.backpackCols, itemType, col, row, srcEntry)) {
                    removeFromGrid(S.backpack, srcEntry);
                    placeInGrid(S.backpack, S.backpackCols, itemType, col, row);
                    return true;
                }
            }
            if (targetZone === 'secure') {
                const srcEntry = (S.secureContainer[srcRow] && S.secureContainer[srcRow][srcCol]) || null;
                if (srcEntry && canPlaceInGrid(S.secureContainer, S.secureCols, itemType, col, row, srcEntry)) {
                    removeFromGrid(S.secureContainer, srcEntry);
                    placeInGrid(S.secureContainer, S.secureCols, itemType, col, row);
                    return true;
                }
            }
            // Quick zones: same-zone just keeps item in place (no-op)
            if (targetZone === 'rig' || targetZone === 'pocket') return false;
            return false;
        }
        // Cross-zone: apply to target zone
        if (targetZone !== 'container') {
            if (!canItemFitZone(itemType, targetZone)) return false;
            // 从容器移入背包/安全箱时，物品之前不计入负重，需要加上；跨负重区域移动则重量不变
            const fromContainer = (srcZone === 'container');
            const weightAfterMove = fromContainer ? getTotalCarryWeight() + getItemWeight(itemType) : getTotalCarryWeight();
            if (weightAfterMove > getMaxWeight()) { alert('负重超限！'); return false; }
            let placed = false;
            if (targetZone === 'rig') { const maxS = S.equipment.chestRig ? ITEMS[S.equipment.chestRig].slots : 0; if ((S._rigItems || []).length < maxS) { S._rigItems = S._rigItems || []; S._rigItems.push(itemType); placed = true; } }
            else if (targetZone === 'pocket') { if (S.pockets.length < S.maxPockets) { S.pockets.push(itemType); placed = true; } }
            else if (targetZone === 'backpack') { if (S.backpackCols > 0) { if (canPlaceInGrid(S.backpack, S.backpackCols, itemType, col, row)) { placeInGrid(S.backpack, S.backpackCols, itemType, col, row); placed = true; } else { const s = findFreeSlot(S.backpack, S.backpackCols, S.backpackRows, itemType); if (s) { placeInGrid(S.backpack, S.backpackCols, itemType, s.col, s.row); placed = true; } } } }
            else if (targetZone === 'secure') { if (canPlaceInGrid(S.secureContainer, S.secureCols, itemType, col, row)) { placeInGrid(S.secureContainer, S.secureCols, itemType, col, row); placed = true; } else { const s = findFreeSlot(S.secureContainer, S.secureCols, S.secureRows, itemType); if (s) { placeInGrid(S.secureContainer, S.secureCols, itemType, s.col, s.row); placed = true; } } }
            if (placed) {
                // Remove from source zone
                if (dt.startsWith('item:')) {
                    const srcGrid = srcZone === 'backpack' ? S.backpack : (srcZone === 'secure' ? S.secureContainer : null);
                    if (srcGrid) { const se = (srcGrid[srcRow] && srcGrid[srcRow][srcCol]) || null; if (se) { removeFromGrid(srcGrid, se); if (srcZone === 'backpack') S.lootValue = Math.max(0, S.lootValue - def.value); } }
                } else if (dt.startsWith('quick:')) {
                    const srcIdx = parseInt(parts[2]);
                    if (srcZone === 'rig' && S._rigItems) S._rigItems.splice(srcIdx, 1);
                    else if (srcZone === 'pocket') S.pockets.splice(srcIdx, 1);
                } else if (dt.startsWith('keychain:')) {
                    S.keychain[keychainIdx] = null; S.keyUses[keychainIdx] = 0;
                } else {
                    const ref = parts.slice(2).join(':'); removeZoneItem(ref, srcZone);
                }
                return true;
            }
            alert('目标空间不足！');
        } else {
            // Zone → Container
            if (!container) return false;
            const slot = findFreeSlot(container.grid, container.gridW, container.gridH, itemType);
            if (!slot) { alert('容器空间不足！'); return false; }
            // Remove from source
            if (dt.startsWith('item:')) {
                const srcGrid = srcZone === 'backpack' ? S.backpack : (srcZone === 'secure' ? S.secureContainer : null);
                if (srcGrid) { const se = (srcGrid[srcRow] && srcGrid[srcRow][srcCol]) || null; if (se) { removeFromGrid(srcGrid, se); if (srcZone === 'backpack') S.lootValue = Math.max(0, S.lootValue - def.value); } }
            } else if (dt.startsWith('quick:')) {
                const qIdx = parseInt(parts[2]);
                if (srcZone === 'rig' && S._rigItems) S._rigItems.splice(qIdx, 1);
                else if (srcZone === 'pocket') S.pockets.splice(qIdx, 1);
            } else if (dt.startsWith('keychain:')) {
                S.keychain[keychainIdx] = null; S.keyUses[keychainIdx] = 0;
            }
            placeInGrid(container.grid, container.gridW, itemType, slot.col, slot.row);
            const newEntry = container.grid._items[container.grid._items.length - 1];
            container._revealed.push(true);
            container.items.push({ ...def, type: itemType, taken: false, gridEntry: newEntry });
            if (srcZone === 'backpack') S.lootValue = Math.max(0, S.lootValue - def.value);
            return true;
        }
    }
    return false;
}

// Unified drop handler: works for ALL grid types (container, backpack, secure)
function makeGridDropCell(cell, grid, cols, maxRows, gridName, onChanged) {
    cell.ondragover = function(e) { e.preventDefault(); e.stopPropagation(); cell.classList.add('drag-over'); e.dataTransfer.dropEffect = 'move'; };
    cell.ondragleave = function() { cell.classList.remove('drag-over'); };
    cell.ondrop = function(e) {
        e.preventDefault(); e.stopPropagation(); cell.classList.remove('drag-over');
        const dt = e.dataTransfer.getData('text/plain');
        if (!dt) return;
        const col = parseInt(cell.style.gridColumn) - 1;
        const row = parseInt(cell.style.gridRow) - 1;

        if (dt.startsWith('item:')) {
            // Same-grid reposition: "item:gridName:id:col:row"
            const parts = dt.split(':');
            if (parts[1] === gridName) {
                const itemId = parts[2]; const srcCol = parseInt(parts[3]); const srcRow = parseInt(parts[4]);
                const def = ITEMS[itemId];
                // Find the entry at source position
                const srcEntry = (grid[srcRow] && grid[srcRow][srcCol]) || null;
                if (srcEntry && def && canPlaceInGrid(grid, cols, itemId, col, row, srcEntry)) {
                    removeFromGrid(grid, srcEntry);
                    placeInGrid(grid, cols, itemId, col, row);
                    // For container grid: update the corresponding item's gridEntry reference
                    if (gridName === 'container' && S.currentSearchContainer) {
                        const container = S.currentSearchContainer;
                        for (const ci of container.items) {
                            if (!ci.taken && ci.gridEntry === srcEntry) {
                                ci.gridEntry = grid._items[grid._items.length - 1];
                                break;
                            }
                        }
                    }
                    playTone(300, 0.05, 'triangle', 0.03);
                    if (onChanged) onChanged();
                }
                return;
            }
        }

        if (dt.startsWith('quick:')) {
            // Quick slot item being dragged to grid
            const parts = dt.split(':');
            const srcZone = parts[1]; const srcIdx = parseInt(parts[2]);
            const itemType = srcZone === 'rig' ? (S._rigItems || [])[srcIdx] : S.pockets[srcIdx];
            if (!itemType) return;
            const def = ITEMS[itemType]; if (!def || !canItemFitZone(itemType, gridName)) return;
            if (getTotalCarryWeight() + getItemWeight(itemType) > getMaxWeight()) { alert('负重超限！'); return; }
            if (canPlaceInGrid(grid, cols, itemType, col, row)) {
                if (removeZoneItem(''+srcIdx, srcZone)) {
                    placeInGrid(grid, cols, itemType, col, row);
                    sfxPickup(def.rarity);
                    if (onChanged) onChanged();
                }
            } else {
                const s = findFreeSlot(grid, cols, maxRows, itemType);
                if (s) { removeZoneItem(''+srcIdx, srcZone); placeInGrid(grid, cols, itemType, s.col, s.row); sfxPickup(def.rarity); if (onChanged) onChanged(); }
            }
            return;
        }

        // External drop (container or other grid): handled by handleUniversalDrop
        if (handleUniversalDrop(e, gridName, col, row)) {
            if (onChanged) onChanged();
        }
    };
}

function makeQuickDropCell(cell, zone, idx, onChanged) {
    cell.ondragover = function(e) { e.preventDefault(); e.stopPropagation(); cell.classList.add('drag-over'); e.dataTransfer.dropEffect = 'move'; };
    cell.ondragleave = function() { cell.classList.remove('drag-over'); };
    cell.ondrop = function(e) {
        e.preventDefault(); e.stopPropagation(); cell.classList.remove('drag-over');
        if (handleUniversalDrop(e, zone, 0, idx)) {
            if (onChanged) onChanged();
        }
    };
}

// Double-click: move zone item back to container
function moveQuickToContainer(zone, idx) {
    const container = S.currentSearchContainer; if (!container) return;
    const items = zone === 'rig' ? (S._rigItems || []) : S.pockets;
    if (idx >= items.length) return;
    const itemType = items[idx]; const def = ITEMS[itemType]; if (!def) return;
    const slot = findFreeSlot(container.grid, container.gridW, container.gridH, itemType);
    if (!slot) { alert('容器空间不足！'); return; }
    items.splice(idx, 1);
    placeInGrid(container.grid, container.gridW, itemType, slot.col, slot.row);
    const newEntry = container.grid._items[container.grid._items.length - 1];
    container._revealed.push(true);
    container.items.push({ ...def, type: itemType, taken: false, gridEntry: newEntry });
    sfxPickup('common');
    renderSearchGrid(container); updateSearchValue(); updateHUD(); updateWeaponUI();
}

function moveGridToContainer(grid, cols, entry, zoneName) {
    const container = S.currentSearchContainer; if (!container) return;
    const def = ITEMS[entry.id]; if (!def) return;
    const slot = findFreeSlot(container.grid, container.gridW, container.gridH, entry.id);
    if (!slot) { alert('容器空间不足！'); return; }
    removeFromGrid(grid, entry);
    if (zoneName === 'backpack') S.lootValue = Math.max(0, S.lootValue - def.value);
    placeInGrid(container.grid, container.gridW, entry.id, slot.col, slot.row);
    const newEntry = container.grid._items[container.grid._items.length - 1];
    container._revealed.push(true);
    container.items.push({ ...def, type: entry.id, taken: false, gridEntry: newEntry });
    sfxPickup('common');
    renderSearchGrid(container); updateSearchValue(); updateHUD(); updateWeaponUI();
}

function renderZoneQuickGrid(div, items, maxSlots, zone) {
    if (!div) return;
    const cols = Math.min(maxSlots, 6); const rows = Math.ceil(maxSlots / cols);
    div.style.gridTemplateColumns = 'repeat(' + cols + ', 42px)';
    div.style.gridTemplateRows = 'repeat(' + rows + ', 42px)';
    div.innerHTML = '';
    for (let i = 0; i < maxSlots; i++) {
        const cell = document.createElement('div'); cell.className = 'grid-cell empty';
        cell.style.gridColumn = (i % cols) + 1; cell.style.gridRow = Math.floor(i / cols) + 1;
        const onChange = function() { 
            if (S.phase === 'backpack') { renderBackpackInventory(); updateBackpackValue(); }
            else { renderSearchGrid(S.currentSearchContainer); updateSearchValue(); }
            updateHUD(); updateWeaponUI(); 
        };
        makeQuickDropCell(cell, zone, i, onChange);
        if (i < items.length && items[i]) {
            const def = ITEMS[items[i]];
            if (def) {
                cell.classList.remove('empty');
                cell.classList.add('grid-item', 'rarity-' + (def.rarity || 'common'));
                cell.innerHTML = '<div class="gi-icon">' + itemIcon(def) + '</div><div class="gi-name">' + def.name + '</div>';
                cell.title = def.name + ' (拖拽移动)';
                cell.draggable = true;
                cell.ondragstart = function(e) { e.stopPropagation(); cell.classList.add('dragging'); e.dataTransfer.setData('text/plain', 'quick:' + zone + ':' + i); e.dataTransfer.effectAllowed = 'move'; };
                cell.ondragend = function() { cell.classList.remove('dragging'); };
                cell.ondblclick = function() { moveQuickToContainer(zone, i); };
            }
        }
        div.appendChild(cell);
    }
}

function renderZoneStorageGrid(div, grid, cols, rows, zone) {
    if (!div || cols === 0 || rows === 0) return;
    div.style.gridTemplateColumns = 'repeat(' + cols + ', 42px)';
    div.style.gridTemplateRows = 'repeat(' + rows + ', 42px)';
    div.innerHTML = '';
    const onChange = function() { 
        if (S.phase === 'backpack') { renderBackpackInventory(); updateBackpackValue(); }
        else { renderSearchGrid(S.currentSearchContainer); updateSearchValue(); }
        updateHUD(); updateWeaponUI(); 
    };
    // Empty cells as drop targets
    for (let r = 0; r < rows; r++) { for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div'); cell.className = 'grid-cell empty';
        cell.style.gridColumn = c + 1; cell.style.gridRow = r + 1;
        makeGridDropCell(cell, grid, cols, rows, zone, onChange);
        div.appendChild(cell);
    }}
    // Items on top (same as container rendering)
    if (grid._items) { for (const entry of grid._items) {
        const def = ITEMS[entry.id]; if (!def) continue;
        const el = document.createElement('div');
        el.className = 'grid-item rarity-' + (def.rarity || 'common');
        el.style.position = 'relative';
        el.style.gridColumn = (entry.col + 1) + '/span ' + (def.w || 1);
        el.style.gridRow = (entry.row + 1) + '/span ' + (def.h || 1);
        el.innerHTML = '<div class="gi-icon">' + itemIcon(def) + '</div><div class="gi-name">' + def.name + '</div>';
        el.title = def.name + ' - ₵' + def.value + ' (拖拽移动)';
        el.draggable = true;
        // Add inspect button for red collectibles
        if(isRedCollectible(entry.id)){
            var ib=document.createElement('div');
            ib.className='inspect-red-btn';
            ib.textContent='🔍';
            ib.title='点击检视';
            ib.onclick=function(e){e.stopPropagation();e.preventDefault();manualInspectRed(entry.id);};
            el.appendChild(ib);
        }
        el.ondragstart = function(e) { 
            e.stopPropagation(); 
            el.classList.add('dragging'); 
            // 武器物品使用weapon_item格式，方便武器槽识别
            if (entry.id && entry.id.startsWith('weapon_')) {
                e.dataTransfer.setData('text/plain', 'weapon_item:' + entry.id); 
            } else {
                e.dataTransfer.setData('text/plain', 'item:' + zone + ':' + entry.id + ':' + entry.col + ':' + entry.row); 
            }
            e.dataTransfer.effectAllowed = 'move'; 
        };
        el.ondragend = function() { el.classList.remove('dragging'); };
        // 武器双击装备，其他装备双击装备到角色，普通物品双击移到容器
        if (entry.id && entry.id.startsWith('weapon_')) {
            el.title = def.name + ' - ₵' + def.value + ' (双击装备到主武器1)';
            el.ondblclick = function() { equipWeaponFromBackpack(entry.id, 0); };
        } else if (def.type === 'helmet' || def.type === 'armor' || def.type === 'chestRig' || def.type === 'backpack') {
            el.title = def.name + ' - ₵' + def.value + ' (双击装备到角色)';
            el.ondblclick = function() { equipItemFromBackpack(entry.id, zone, entry.col, entry.row); };
        } else {
            el.title = def.name + ' - ₵' + def.value + ' (双击移到容器)';
            el.ondblclick = function() { moveGridToContainer(grid, cols, entry, zone); };
        }
        div.appendChild(el);
    }}
}

// Interactive grids for search screen (accept drops from container)
function renderInteractiveQuickGrid(div, items, maxSlots, gridType) {
    if (!div) return;
    const cols = Math.min(maxSlots, 6);
    const rows = Math.ceil(maxSlots / cols);
    div.style.gridTemplateColumns = 'repeat(' + cols + ', 42px)';
    div.style.gridTemplateRows = 'repeat(' + rows + ', 42px)';
    div.innerHTML = '';
    for (let i = 0; i < maxSlots; i++) {
        const cell = document.createElement('div');
        cell.style.cssText = 'width:42px;height:42px;background:rgba(0,0,0,0.3);border:1px solid #2a2a2a;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:16px;grid-column:' + ((i % cols) + 1) + ';grid-row:' + (Math.floor(i / cols) + 1) + ';';
        cell.style.cursor = 'pointer';
        // Show existing item
        if (i < items.length && items[i]) {
            const def = ITEMS[items[i]];
            if (def) { cell.innerHTML = itemIcon(def); cell.style.background = 'var(--rarity-bg)'; cell.style.borderColor = 'var(--rarity-border)'; cell.title = def.name + ' - 双击放回容器'; }
        }
        // Double-click to send back to container
        cell.ondblclick = function () {
            if (i < items.length && items[i]) {
                const container = S.currentSearchContainer; if (!container) return;
                const slot = findFreeSlot(container.grid, container.gridW, container.gridH, items[i]);
                if (slot) {
                    const itemId = items[i]; items.splice(i, 1);
                    placeInGrid(container.grid, container.gridW, itemId, slot.col, slot.row);
                    const newEntryD = container.grid._items[container.grid._items.length - 1];
                    container._revealed.push(true);
                    container.items.push({ ...ITEMS[itemId], type: itemId, taken: false, gridEntry: newEntryD });
                    sfxPickup('common');
                    renderSearchGrid(container); updateSearchValue(); updateHUD();
                }
            }
        };
        // Accept drag from container
        setupSearchDropTarget(cell, function (itemType, itemIdx) {
            if (items.length >= maxSlots) return false;
            if (autoEquipLoot(itemType)) return true; // Equipped to character, don't store in slot
            items.push(itemType);
            return true;
        });
        div.appendChild(cell);
    }
}

function renderInteractiveStorageGrid(div, grid, cols, rows, gridType) {
    if (!div || cols === 0 || rows === 0) return;
    div.style.gridTemplateColumns = 'repeat(' + cols + ', 42px)';
    div.style.gridTemplateRows = 'repeat(' + rows + ', 42px)';
    div.innerHTML = '';
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const entry = (grid[r] && grid[r][c]) || null;
            const def = entry ? ITEMS[entry.id] : null;
            const cell = document.createElement('div');
            cell.style.cssText = 'width:42px;height:42px;background:' + (def ? 'var(--rarity-bg)' : 'rgba(0,0,0,0.3)') + ';border:1px solid ' + (def ? 'var(--rarity-border)' : '#2a2a2a') + ';border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:16px;grid-column:' + (c + 1) + ';grid-row:' + (r + 1) + ';';
            cell.style.cursor = 'pointer';
            if (def) { cell.innerHTML = itemIcon(def); cell.title = def.name + ' - 双击放回容器'; }
            // Double-click: send back to container
            if (entry) {
                cell.ondblclick = function () {
                    const cont = S.currentSearchContainer; if (!cont) return;
                    const slot = findFreeSlot(cont.grid, cont.gridW, cont.gridH, entry.id);
                    if (slot) {
                        removeFromGrid(grid, entry);
                        if (gridType === 'backpack') S.lootValue = Math.max(0, S.lootValue - ITEMS[entry.id].value);
                        placeInGrid(cont.grid, cont.gridW, entry.id, slot.col, slot.row);
                        const newEntryE = cont.grid._items[cont.grid._items.length - 1];
                        cont._revealed.push(true);
                        cont.items.push({ ...ITEMS[entry.id], type: entry.id, taken: false, gridEntry: newEntryE });
                        sfxPickup('common');
                        renderSearchGrid(cont); updateSearchValue(); updateHUD();
                    }
                };
            }
            // Accept drop from container
            setupSearchDropTarget(cell, function (itemType, itemIdx) {
                if (gridType === 'secure') {
                    // Secure: manual drag only, can place directly
                    if (!canPlaceInGrid(grid, cols, itemType, c, r)) return false;
                    placeInGrid(grid, cols, itemType, c, r);
                    if (autoEquipLoot(itemType)) {
                        const placed = grid._items[grid._items.length - 1];
                        removeFromGrid(grid, placed);
                    }
                    return true;
                } else {
                    // Backpack: auto-place
                    const slot = findFreeSlot(grid, cols, rows, itemType);
                    if (!slot) return false;
                    placeInGrid(grid, cols, itemType, slot.col, slot.row);
                    if (autoEquipLoot(itemType)) {
                        const placed = grid._items[grid._items.length - 1];
                        removeFromGrid(grid, placed);
                    }
                    return true;
                }
            });
            div.appendChild(cell);
        }
    }
}

function setupSearchDropTarget(cell, onDrop) {
    cell.ondragover = function (e) {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.types.includes('text/plain')) {
            const dt = e.dataTransfer.getData('text/plain');
            if (dt.startsWith('container:')) cell.classList.add('drag-over');
        }
    };
    cell.ondragleave = function () { cell.classList.remove('drag-over'); };
    cell.ondrop = function (e) {
        e.preventDefault(); cell.classList.remove('drag-over');
        const dt = e.dataTransfer.getData('text/plain');
        if (!dt || !dt.startsWith('container:')) return;
        const idx = parseInt(dt.split(':')[1]);
        const container = S.currentSearchContainer; if (!container) return;
        const item = container.items[idx];
        if (!item || item.taken || !container._revealed || !container._revealed[idx]) return;
        const def = ITEMS[item.type]; if (!def) return;
        if (onDrop(item.type, idx)) {
            takeContainerItem(container, item);
            S.lootValue += def.value;
            // autoEquipLoot is handled inside onDrop callbacks so they can clean up placement
            S._lootItems = S._lootItems || []; S._lootItems.push({ id: item.type, name: def.name, value: def.value, rarity: def.rarity });
            sfxPickup(def.rarity);
            renderSearchGrid(container); updateSearchValue(); updateHUD(); updateWeaponUI();
        }
    };
}

function renderStashKeychain(){
    const container=document.getElementById('stashKeychainContainer');if(!container)return;
    container.innerHTML='';
    const header=document.createElement('div');
    header.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:6px;';
    header.innerHTML='<span style="color:#ff9800;font-size:13px;font-weight:bold;">🔑 钥匙链</span><span style="color:#8b949e;font-size:10px;">(仅存放钥匙卡 | 撤离后保留 | 进入游戏随身携带)</span>';
    container.appendChild(header);

    const grid=document.createElement('div');
    grid.style.cssText='display:grid;grid-template-columns:repeat(4,52px);grid-template-rows:52px;gap:4px;';

    for(let i=0;i<4;i++){
        const cell=document.createElement('div');
        cell.className='grid-cell';
        cell.style.cssText='width:52px;height:52px;border:1px dashed #555;border-radius:4px;display:flex;align-items:center;justify-content:center;position:relative;background:#1a1a2e;';
        const kid=P.keychain[i];
        if(kid && ITEMS[kid]){
            const def=ITEMS[kid];
            cell.classList.add('grid-item','rarity-'+(def.rarity||'common'));
            cell.style.border='1px solid '+RARITY[def.rarity].color;
            cell.innerHTML='<div class="gi-icon" style="width:42px;height:42px;">'+itemIcon(def)+'</div><div class="gi-name" style="font-size:7px;position:absolute;bottom:1px;right:2px;background:rgba(0,0,0,0.7);padding:0 3px;border-radius:2px;">×'+P.keyUses[i]+'</div>';
            cell.title=def.name+' - 剩余'+P.keyUses[i]+'次 (拖到仓库取出 | 双击取出)';
            cell.draggable=true;
            cell.ondragstart=function(e){e.dataTransfer.setData('text/plain','stashKeychain:'+i);e.dataTransfer.effectAllowed='move';};
            cell.ondblclick=function(){
                // Move keycard from keychain to stash grid
                var kd=getStashDims();
                var slot=findFreeSlot(P.stashGrid,kd.cols,kd.rows,kid);
                if(slot){
                    placeInGrid(P.stashGrid,kd.cols,kid,slot.col,slot.row);
                    // Preserve keycard uses on the grid entry
                    var newEntry=P.stashGrid._items[P.stashGrid._items.length-1];
                    if(newEntry) newEntry._keyUses=P.keyUses[i];
                    P.keychain[i]=null;P.keyUses[i]=0;
                    savePersistent();renderStashGrid();
                }else{alert('仓库空间不足！');}
            };
        }else{
            cell.innerHTML='<span style="color:#444;font-size:18px;">🔑</span>';
            cell.title='空槽 - 拖入钥匙卡';
        }
        // Allow dropping keycards from stash grid
        cell.ondragover=function(e){e.preventDefault();cell.classList.add('drag-over');};
        cell.ondragleave=function(){cell.classList.remove('drag-over');};
        cell.ondrop=function(e){
            e.preventDefault();cell.classList.remove('drag-over');
            var dt=e.dataTransfer.getData('text/plain');
            if(dt && dt.startsWith('stash:')){
                var idx=parseInt(dt.split(':')[1]);
                var entry=P.stashGrid._items?P.stashGrid._items[idx]:null;
                if(entry && ITEMS[entry.id] && ITEMS[entry.id].type==='keycard'){
                    if(!P.keychain[i]){
                        P.keychain[i]=entry.id;
                        P.keyUses[i]=entry._keyUses||10;
                        removeFromGrid(P.stashGrid,entry);
                        savePersistent();renderStashGrid();
                    }else{alert('该钥匙链位置已被占用！');}
                }
            }
        };
        grid.appendChild(cell);
    }
    container.appendChild(grid);
}

// 仓库批量卖出选中状态
var _stashSelected = new Set();

function renderStashGrid(){
    const container=document.getElementById('stashGridContainer');if(!container)return;
    renderStashKeychain();
    var dims=getStashDims();
    var stashCols=dims.cols,stashRows=dims.rows;
    const colW=58,rowH=58;
    container.innerHTML='';

    // Toolbar with sort button and batch sell
    const toolbar=document.createElement('div');toolbar.style.cssText='margin-bottom:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
    const sortBtn=document.createElement('button');
    sortBtn.textContent='🔧 整理仓库';sortBtn.className='sort-btn';
    sortBtn.onclick=()=>{autoSortGrid(P.stashGrid,stashCols,stashRows);_stashSelected.clear();renderStashGrid();savePersistent();};
    toolbar.appendChild(sortBtn);

    // 批量卖出按钮
    const selectAllBtn=document.createElement('button');
    selectAllBtn.textContent='☑️ 全选';selectAllBtn.className='sort-btn';
    selectAllBtn.style.background='linear-gradient(135deg,#607d8b,#455a64)';
    selectAllBtn.onclick=()=>{
        if(P.stashGrid._items){
            P.stashGrid._items.forEach((e,i)=>_stashSelected.add(i));
        }
        renderStashGrid();
    };
    toolbar.appendChild(selectAllBtn);

    const sellSelectedBtn=document.createElement('button');
    const selectedCount=_stashSelected.size;
    let totalSellValue=0;
    if(P.stashGrid._items){
        _stashSelected.forEach(idx=>{
            const entry=P.stashGrid._items[idx];
            if(entry&&SHOP_PRICES[entry.id]) totalSellValue+=SHOP_PRICES[entry.id].sell;
        });
    }
    sellSelectedBtn.textContent='💰 批量卖出 ('+selectedCount+'件 ₵'+totalSellValue.toLocaleString()+')';
    sellSelectedBtn.className='sort-btn';
    sellSelectedBtn.style.background=selectedCount>0?'linear-gradient(135deg,#f44336,#c62828)':'linear-gradient(135deg,#666,#444)';
    sellSelectedBtn.disabled=selectedCount===0;
    sellSelectedBtn.onclick=()=>{
        if(_stashSelected.size===0)return;
        if(!confirm('确定卖出选中的 '+_stashSelected.size+' 件物品？总计 ₵'+totalSellValue.toLocaleString()))return;
        // 按索引从大到小删除，避免索引错乱
        const indices=Array.from(_stashSelected).sort((a,b)=>b-a);
        indices.forEach(idx=>{
            const entry=P.stashGrid._items?P.stashGrid._items[idx]:null;
            if(entry){
                const sp=SHOP_PRICES[entry.id];
                if(sp){
                    removeFromGrid(P.stashGrid,entry);
                    P.money+=sp.sell;
                }
            }
        });
        _stashSelected.clear();
        savePersistent();updateAllLobbyUI();renderShopTab();renderStashGrid();
        showFloatingMsg('已卖出 '+indices.length+' 件物品，获得 ₵'+totalSellValue.toLocaleString());
    };
    toolbar.appendChild(sellSelectedBtn);

    const clearSelBtn=document.createElement('button');
    clearSelBtn.textContent='❌ 取消选择';clearSelBtn.className='sort-btn';
    clearSelBtn.style.background='linear-gradient(135deg,#795548,#5d4037)';
    clearSelBtn.onclick=()=>{_stashSelected.clear();renderStashGrid();};
    toolbar.appendChild(clearSelBtn);

    const info=document.createElement('span');info.style.cssText='color:#8b949e;font-size:11px;';
    info.textContent='单击选中 | 双击装备 | 拖拽整理 | Lv.'+(P.stashLevel||1)+' '+stashCols+'×'+stashRows;
    toolbar.appendChild(info);
    container.appendChild(toolbar);

    const grid=document.createElement('div');grid.className='stash-grid';
    grid.style.gridTemplateColumns=`repeat(${stashCols},${colW}px)`;
    grid.style.gridTemplateRows=`repeat(${stashRows},${rowH}px)`;

    for(let r=0;r<stashRows;r++){for(let c=0;c<stashCols;c++){
        const cell=document.createElement('div');cell.className='grid-cell empty';
        cell.style.gridColumn=c+1;cell.style.gridRow=r+1;
        cell.ondragover=function(e){e.preventDefault();cell.classList.add('drag-over');e.dataTransfer.dropEffect='move';};
        cell.ondragleave=function(){cell.classList.remove('drag-over');};
        cell.ondrop=function(e){e.preventDefault();cell.classList.remove('drag-over');
            const dt=e.dataTransfer.getData('text/plain');
            if(dt&&dt.startsWith('stashKeychain:')){
                // Drop from keychain to stash grid
                var ki=parseInt(dt.split(':')[1]);
                var kid=P.keychain[ki];
                if(kid && canPlaceInGrid(P.stashGrid,stashCols,kid,c,r,{id:kid,w:1,h:1})){
                    placeInGrid(P.stashGrid,stashCols,kid,c,r);
                    // Preserve keycard uses on the grid entry
                    var newEntry=P.stashGrid._items[P.stashGrid._items.length-1];
                    if(newEntry) newEntry._keyUses=P.keyUses[ki];
                    P.keychain[ki]=null;P.keyUses[ki]=0;
                    savePersistent();renderStashGrid();
                }
            }else if(dt&&dt.startsWith('stash:')){
                const idx=parseInt(dt.split(':')[1]);
                const entry=P.stashGrid._items?P.stashGrid._items[idx]:null;
                if(entry&&canPlaceInGrid(P.stashGrid,stashCols,entry.id,c,r,entry)){
                    var savedKeyUses=entry._keyUses;
                    removeFromGrid(P.stashGrid,entry);
                    placeInGrid(P.stashGrid,stashCols,entry.id,c,r);
                    // Preserve keycard uses
                    if(savedKeyUses!==undefined){
                        var ne=P.stashGrid._items[P.stashGrid._items.length-1];
                        if(ne) ne._keyUses=savedKeyUses;
                    }
                    savePersistent();renderStashGrid();
                }
            }else{
                onDropOnCell('stash',c,r);
            }
        };
        grid.appendChild(cell);
    }}

    if(P.stashGrid._items){P.stashGrid._items.forEach((entry,idx)=>{
        const def=ITEMS[entry.id];if(!def)return;
        const el=document.createElement('div');
        const isSelected=_stashSelected.has(idx);
        el.dataset.itemId=entry.id;
        el.className='grid-item rarity-'+def.rarity+(isSelected?' stash-selected':'');
        if(isSelected){
            el.style.boxShadow='0 0 0 3px #ffeb3b, 0 0 15px rgba(255,235,59,0.6)';
        }
        el.draggable=true;
        el.style.gridColumn=(entry.col+1)+'/span '+def.w;el.style.gridRow=(entry.row+1)+'/span '+def.h;
        // Show keycard uses if applicable
        var usesLabel='';
        if(def.type==='keycard' && entry._keyUses!==undefined){
            usesLabel='<div class="gi-name" style="font-size:7px;position:absolute;bottom:1px;right:2px;background:rgba(0,0,0,0.7);padding:0 3px;border-radius:2px;">×'+entry._keyUses+'</div>';
            el.style.position='relative';
        }
        el.innerHTML=`<div class="gi-icon">${itemIcon(def)}</div><div class="gi-name">${def.name}</div>${usesLabel}`;
        var titleStr=def.name+' - ₵'+def.value+' ['+RARITY[def.rarity].name+'] (单击选中|双击装备|拖拽移动)';
        if(def.type==='keycard' && entry._keyUses!==undefined) titleStr+=' | 剩余'+entry._keyUses+'次';
        el.title=titleStr;
        // 单击选中/取消选中
        el.onclick=function(e){
            e.stopPropagation();
            if(_stashSelected.has(idx)) _stashSelected.delete(idx);
            else _stashSelected.add(idx);
            renderStashGrid();
        };
        el.ondragstart=function(e){el.classList.add('dragging');e.dataTransfer.setData('text/plain','stash:'+idx);e.dataTransfer.effectAllowed='move';};
        el.ondblclick=function(){equipFromStash(entry.id);};
        el.ondragend=function(){el.classList.remove('dragging');onDragEnd();};
        grid.appendChild(el);
    });}
    // Wrap grid in scrollable container for vertical expansion
    const scrollWrap=document.createElement('div');scrollWrap.className='stash-grid-scroll';
    scrollWrap.appendChild(grid);
    container.appendChild(scrollWrap);
}

function renderShopTab(){
    const container=document.getElementById('shopItems');if(!container)return;
    const cats={
        '🔫 主武器(步枪)':['rifle_item','carbine_item','ak_item','hk416_item','battleRifle_item','g36c_item','m4_item','scar_item'],
        '🔫 主武器(冲锋)':['smg_item','pdw_item','mp5_item','p90_item','vector_item','machinePistol_item','compactSMG_item','ump45_item','pp19_item'],
        '🔫 主武器(霰弹)':['shotgun_item','combatShotgun_item','autoShotgun_item','doubleBarrel_item','heavyShotgun_item','m870_item','spas12_item','aa12_item','doublebarrel_item'],
        '🔫 主武器(狙击)':['dmr_item','marksman_item','sniper_item','antiMat_item','mk14_item','psg1_item','awm_item','m24_item','vss_item'],
        '🔫 主武器(机枪)':['lmg_item','mmg_item','hmg_item'],
        '🔫 副武器':['pistol_item','compactPistol_item','hcPistol_item','usp_item','deagle_item','revolver_item','magnum_item','autoPistol_item','burstPistol_item','g18c_item'],
        '🗡️ 近战':['knife_item','baton_item','axe_item','sword_item','machete_item'],
        '🛡️ 护甲':['tier1_armor','tier2_armor','tier3_armor','tier4_armor','tier5_armor','tier6_armor','light_armor','medium_armor','heavy_armor','elite_armor'],
        '⛑️ 头盔':['tier1_helmet','tier2_helmet','tier3_helmet','tier4_helmet','tier5_helmet','tier6_helmet','basic_helmet','adv_helmet','elite_helmet'],
        '🎽 胸挂':['light_rig','basic_rig','tactical_rig','assault_rig','elite_rig','tactical_rig2','heavy_rig'],
        '🎒 背包':['pouch','small_bag','school_bag','medium_bag','hiking_bag','large_bag','assault_bag','military_bag','expedition_bag','gamma_bag'],
        '💊 医疗':['bandage','tourniquet','painkiller','adrenaline','medkit','stimInjector','surgeryKit'],
        '💣 投掷物':['fragGrenade','smokeGrenade','flashbang','molotov'],
        '🔑 钥匙卡':['blueKeycard','purpleKeycard','goldKeycard','redKeycard'],
        '📦 弹药':['pistolAmmo','rifleAmmo','shotgunAmmo','smgAmmo','sniperAmmo','heavyAmmo'],
        '⬜ 杂货':['cash','lighter','bolt','tape','battery','wire','lens','encryptedUsb'],
        '🟦 贵重品':['watch','phone','whiskey','circuit','perfume','confidentialDoc','satellitePhoto','commanderDiary','jade','goldMask'],
        '🟪 收藏品':['gold','gpu','laptop','ivory','crown','cursedIdol'],
        '💎 红藏品':['diamond','relic','red_ring','red_watch','red_necklace','red_tiger','red_vase','red_lion','red_crown','goldenFalcon'],
        '🔴 3×3大红':['red_painting','red_statue','red_scepter','emperorSeal'],
        '⭐ 最稀有':['moonStone','africa_star'],
    };
    // Dynamically add white/blue/purple/gold collectible categories
    if(typeof COLLECTIBLES_CONFIG!=='undefined'){
        var _ocByRarity={common:[],rare:[],epic:[],legendary:[]};
        for(var _ocId in COLLECTIBLES_CONFIG){
            var _oc=COLLECTIBLES_CONFIG[_ocId];
            _ocByRarity[_oc.rarity].push(_ocId);
        }
        if(_ocByRarity.common.length)cats['⬜ 白色藏品']=_ocByRarity.common;
        if(_ocByRarity.rare.length)cats['🔵 蓝色藏品']=_ocByRarity.rare;
        if(_ocByRarity.epic.length)cats['🟣 紫色藏品']=_ocByRarity.epic;
        if(_ocByRarity.legendary.length)cats['🟡 金色藏品']=_ocByRarity.legendary;
    }
    // Dynamically add red collectible sub-categories by grid size
    if(typeof RED_COLLECTIBLES_CONFIG!=='undefined'){
        var _rcBySize={};
        for(var _rcId in RED_COLLECTIBLES_CONFIG){
            var _rc=RED_COLLECTIBLES_CONFIG[_rcId];
            var _key=_rc.w+'×'+_rc.h;
            if(!_rcBySize[_key])_rcBySize[_key]=[];
            _rcBySize[_key].push(_rcId);
        }
        var _sizeOrder=['1×1','1×2','1×3','1×4','2×1','2×2','2×3','3×1','3×2','3×3','3×4','4×2','4×3'];
        for(var _si=0;_si<_sizeOrder.length;_si++){
            var _sz=_sizeOrder[_si];
            if(_rcBySize[_sz])cats['🔴 红藏品 ('+_sz+')']=_rcBySize[_sz];
        }
    }
    let html='';
    // Weapon repair section
    var equippedWeapons=[];
    for(var wi=0;wi<4;wi++){
        var wk=S.weaponSlots[wi];
        if(wk&&wk!=='knife'){
            var dur=getWeaponDurability(wk);
            if(dur<100)equippedWeapons.push({key:wk,slot:wi,dur:dur,name:WEAPONS[wk]?WEAPONS[wk].name:wk});
        }
    }
    // Also check stash for weapons needing repair
    if(P.stashGrid._items){
        var stashWeapons={};
        for(var se of P.stashGrid._items){
            var sd=ITEMS[se.id];
            if(sd&&sd.type==='weapon'&&sd.weapon){
                var sdur=getWeaponDurability(sd.weapon);
                if(sdur<100){
                    if(!stashWeapons[sd.weapon])stashWeapons[sd.weapon]={key:sd.weapon,dur:sdur,name:WEAPONS[sd.weapon]?WEAPONS[sd.weapon].name:sd.weapon,count:0};
                    stashWeapons[sd.weapon].count++;
                }
            }
        }
        for(var swk in stashWeapons){
            equippedWeapons.push(stashWeapons[swk]);
        }
    }
    if(equippedWeapons.length>0){
        html+='<div class="cat-title" style="color:#ff9800;">🔧 武器维修</div><div class="shop-grid">';
        for(var ew of equippedWeapons){
            var repairCost=Math.round((100-ew.dur)*500);
            var durColor=ew.dur>60?'#4caf50':ew.dur>30?'#ff9800':'#f44336';
            var durLabel=ew.slot!==undefined?'[装备槽'+(ew.slot+1)+'] ':'[仓库×'+(ew.count||1)+'] ';
            html+='<div class="shop-item-card" style="border-color:'+durColor+';">'+
                '<div class="shop-icon">🔧</div><div class="shop-name">'+durLabel+ew.name+'</div>'+
                '<div class="shop-rarity" style="color:'+durColor+';">耐久: '+ew.dur.toFixed(1)+'%</div>'+
                '<div style="height:4px;background:#333;border-radius:2px;margin:4px 0;overflow:hidden;">'+
                '<div style="height:100%;width:'+ew.dur+'%;background:'+durColor+';"></div></div>'+
                '<div class="shop-btns"><button class="shop-btn buy" onclick="repairWeapon(\''+ew.key+'\')" '+(P.money<repairCost?'disabled':'')+'>修理 ₵'+repairCost.toLocaleString()+'</button></div>'+
                '</div>';
        }
        html+='</div>';
    }
    for(const[cat,items]of Object.entries(cats)){html+='<div class="cat-title">'+cat+'</div><div class="shop-grid">';
        for(const itemId of items){const def=ITEMS[itemId];const sp=SHOP_PRICES[itemId];if(!sp)continue;const owned=getStashItemCount(itemId);
            html+=`<div class="shop-item-card rarity-${def.rarity}">
                <div class="shop-icon">${itemIcon(def)}</div><div class="shop-name" title="${def.name}">${def.name}</div>
                <div class="shop-rarity">${RARITY[def.rarity].name}</div><div class="shop-owned">拥有: ${owned}</div>
                <div class="shop-btns"><button class="shop-btn buy" onclick="buyItem('${itemId}')" ${P.money<sp.buy?'disabled':''}>买 ₵${sp.buy.toLocaleString()}</button><button class="shop-btn sell" onclick="sellItem('${itemId}')" ${owned<=0?'disabled':''}>卖 ₵${sp.sell.toLocaleString()}</button></div>
            </div>`;
        }
        html+='</div>';
    }
    container.innerHTML=html;
}

// ========== SECTION 16: GAME FLOW ==========
function startGame(){
    if(S.mode==='hard'){if(P.money<CONFIG.hardModeFee){alert('资金不足！需要 ₵'+CONFIG.hardModeFee.toLocaleString());return;}P.money-=CONFIG.hardModeFee;}

    document.getElementById('lobbyScreen').style.display='none';document.getElementById('gameHUD').style.display='block';document.getElementById('clickToPlay').style.display='block';
    const _pb=document.getElementById('pauseBtn');if(_pb)_pb.style.display='block';
    S.phase='playing';P.stats.games++;S.startTime=performance.now()/1000;S.gameTime=CONFIG.gameTime[S.mode]||900;
    // 环境音与特效状态重置
    if (typeof AudioEngine !== 'undefined') {
        try { AudioEngine.startAmbient(); } catch (e) { }
    }
    if (typeof WeaponFX !== 'undefined') WeaponFX.reset();
    // 应用技能效果（必须在设置health/stamina之前）
    applySkillEffects();
    S.health=S.maxHealth;S.armor=0;S.helmet=0;S.lootValue=0;S.containersSearched=0;S.kills=0;S.isExtracting=false;S.extractProgress=0;S.isReloading=false;S.currentWeapon=0;S._velocityY=0;S._lootItems=[];
    S._killStreak=0;S._killStreakTimer=0;S._lastLootValue=0;
    S.stamina=CONFIG.maxStamina;S._staminaExhausted=false;S._staminaRecoverTimer=0;S.isCrouching=false;S._crouchCooldown=false;S._velX=0;S._velZ=0;
    S.bleeding=0;S.fracture=false; // Bleeding & injury system
    S.weaponJammed=false; // Weapon jam state
    S._redCountAtOpen=0; S._redSnapshotAtOpen={}; // Red collectible inspection tracking
    S._pendingRedGroundPickup=false;
    S._mapMarkers=[]; S._fullMapOpen=false; // Map markers & full map state

    // Save equipped loadout before resetting S
    const savedWeapons=[...S.weaponSlots];
    const savedMags=[...S.magAmmo];
    const savedEquip={...S.equipment};
    const savedRigItems=[...(S._rigItems||[])];
    const savedPockets=[...S.pockets];
    const savedSecure=S.secureContainer;
    const savedBackpack=S.backpack;
    const savedBPCols=S.backpackCols;
    const savedBPRows=S.backpackRows;

    // Reset session for new raid
    S.weaponSlots=[null,null,null,'knife'];S.magAmmo=[0,0,0,0];S.reserveAmmo={pistol:0,rifle:0,shotgun:0,smg:0,sniper:0,heavy:0};
    S.currentWeapon=3;S.equipment={armor:null,armorHP:0,helmet:null,helmetHP:0,chestRig:null,backpack:null};
    S.pockets=[];S.maxPockets=5;S._rigItems=[];
    // Load keychain from persistent state
    S.keychain=[...(P.keychain||[null,null,null,null])];
    S.keyUses=[...(P.keyUses||[0,0,0,0])];
    S.secureContainer=initGrid(3);S.secureCols=3;S.secureRows=3;
    S.backpack=initGrid(1);S.backpackCols=0;S.backpackRows=0;
    S.broughtItems=[];

    // Restore equipped gear
    S.weaponSlots=savedWeapons;S.magAmmo=savedMags;
    for(let i=0;i<3;i++){if(!S.weaponSlots[i])S.magAmmo[i]=0;}
    S.equipment=savedEquip;
    if(S.equipment.armor){const ad=ITEMS[S.equipment.armor];if(ad)S.equipment.armorHP=ad.amount;}
    if(S.equipment.helmet){const hd=ITEMS[S.equipment.helmet];if(hd)S.equipment.helmetHP=hd.amount;}
    if(S.equipment.chestRig){const cd=ITEMS[S.equipment.chestRig];if(cd)S.maxPockets=5;}
    if(S.equipment.backpack){const bd=ITEMS[S.equipment.backpack];if(bd){S.backpackCols=bd.bCols;S.backpackRows=bd.bRows;S.backpack=initGrid(bd.bRows);}}
    S._rigItems=savedRigItems;S.pockets=savedPockets;
    S.secureContainer=savedSecure;
    // Only restore backpack if it had items, otherwise keep init
    if(savedBackpack&&savedBackpack._items&&savedBackpack._items.length>0){S.backpack=savedBackpack;S.backpackCols=savedBPCols;S.backpackRows=savedBPRows;}
    if(S.weaponSlots[3]!=='knife')S.weaponSlots[3]='knife'; // Always have knife

    enemies.forEach(e=>scene.remove(e.mesh));clearContainers();particles.forEach(p=>scene.remove(p.mesh));bulletTrails.forEach(b=>{if(b.mesh)scene.remove(b.mesh);});if(extractPoints)extractPoints.forEach(ep=>scene.remove(ep.mesh));
    bossTaskPoints.forEach(tp=>scene.remove(tp.mesh));
    airDrops.forEach(ad=>scene.remove(ad.mesh));
    enemies=[];enemyHitboxes=[];containers=[];particles=[];bulletTrails=[];extractPoints=[];bosses=[];bossTaskPoints=[];airDrops=[];
    // HUD 反馈层重置：新一局的撤离点/空投标记需要重新绑定
    if(typeof HudFeedback!=='undefined')HudFeedback.reset();
    if(typeof PerfManager!=='undefined')PerfManager.resetMinimapLayer();
    S._mapMarkers=[];S._fullMapOpen=false;
    airdropTimer=60+Math.random()*60; // First airdrop in 1-2 minutes
    initKeyBuildings();
    rebuildMapEnvironment();
    // Use map's player spawn
    const sp=MAP_DATA?MAP_DATA.playerSpawn:{x:0,z:12,rot:0};
    playerGroup.position.set(sp.x,0,sp.z);mouseX=sp.rot||0;mouseY=0;weaponGroup.position.set(0,0,0);weaponGroup.rotation.set(0,0,0);
    if (typeof WeaponADS !== 'undefined') {
        WeaponADS.reset();
        const initWt = S.weaponSlots[S.currentWeapon];
        if (initWt) WeaponADS.setWeapon(initWt);
    }
    searchAnimData=null;S._isSearching=false;

    spawnContainers();spawnExtractPoints();spawnEnemies();spawnGroundLoot();
    // 容器合批必须在本帧绘制之前完成：此时 170 个容器的 912 个子网格已经全部建好，
    // 再晚就会被渲染一帧才发现，再早则合并到一半。
    finalizeContainerBatching();
    // Spawn boss task points
    bosses=[];bossTaskPoints=[];
    spawnBossTaskPoints(MAP_DATA);
    updateHUD();updateWeaponUI();updateWeaponModel();savePersistent();

    setTimeout(()=>{if(S.phase==='playing'){document.getElementById('gameCanvas').requestPointerLock();document.getElementById('clickToPlay').style.display='none';}},150);
    accumulator=0;lastTime=performance.now();
}

function endGame(success){
    // 先关闭可能打开的界面（在设置phase之前）
    if (S.phase === 'backpack') closeBackpack();
    if (S.phase === 'searching') closeSearch();
    S.phase='gameover';if(document.pointerLockElement)document.exitPointerLock();
    hideRedInspection(); // Clean up inspection overlay if active
    if (typeof AudioEngine !== 'undefined') { try { AudioEngine.stopAmbient(); } catch (e) { } }
    if (typeof WeaponFX !== 'undefined') WeaponFX.reset();
    // 关闭暂停菜单和设置菜单
    if (typeof GameSettings !== 'undefined') {
        if (typeof GameSettings.closePauseMenu === 'function') GameSettings.closePauseMenu();
        if (typeof GameSettings.closeSettings === 'function') GameSettings.closeSettings();
    }
    // 隐藏丢弃区域
    showDropZones(false);
    // 关闭BOSS扩展面板（任务链/成就/排行榜）
    if (typeof BossExtensions !== 'undefined') {
        if (typeof BossExtensions.closeMissionPanel === 'function') BossExtensions.closeMissionPanel();
        if (typeof BossExtensions.closeAchievementPanel === 'function') BossExtensions.closeAchievementPanel();
        if (typeof BossExtensions.closeLeaderboardPanel === 'function') BossExtensions.closeLeaderboardPanel();
    }
    // 关闭技能树面板
    if (typeof SkillTreeUI !== 'undefined' && typeof SkillTreeUI.close === 'function') {
        SkillTreeUI.close();
    }
    // 清理BOSS相关UI（击杀特写/结算界面/血条/音乐）
    if (typeof BossSystemV2 !== 'undefined' && typeof BossSystemV2.clearBossUI === 'function') {
        BossSystemV2.clearBossUI();
    }
    const survived=Math.floor(performance.now()/1000-S.startTime);
    document.getElementById('gameHUD').style.display='none';document.getElementById('clickToPlay').style.display='none';document.getElementById('extractPrompt').style.display='none';document.getElementById('searchPrompt').style.display='none';document.getElementById('keyBuildingPrompt').style.display='none';
    const _pb2=document.getElementById('pauseBtn');if(_pb2)_pb2.style.display='none';
    // Clean up bleeding/fracture indicators
    stopBleeding();healFracture();
    S._adrenalineTimer=0;S._painkillerTimer=0;
    // Track survive time mission
    trackMission('survive_time',survived);

    // 保存撤离时的物资价值与列表 (后续会被清零, 需提前快照用于结果展示)
    const finalLootValue = S.lootValue;
    const finalLootItems = S._lootItems ? [...S._lootItems] : [];

    const title=document.getElementById('resultTitle'),status=document.getElementById('resultStatus');
    if(success){
        title.textContent='撤离成功';title.className='result-title success';status.textContent='成功撤离';
        P.stats.extracts++;P.stats.totalValue+=S.lootValue;P.money+=S.lootValue;
        trackMission('extract_success',1);
        trackMission('earn_money',S.lootValue);
        if(S.lootValue>=100000)trackMission('extract_value',1);
        // 撤离经验获取：基础50XP + 物资价值×0.1XP
        const extractXP = 50 + Math.floor(S.lootValue * 0.1);
        gainXP(extractXP, '撤离成功');
        // 成就追踪
        trackAchievement('extracts', 1);
        trackAchievement('extract_value', S.lootValue);
        // Return equipped weapons and gear to stash
        for(let i=0;i<3;i++){if(S.weaponSlots[i]){const wid=S.weaponSlots[i];const itemId=Object.keys(ITEMS).find(k=>ITEMS[k].type==='weapon'&&ITEMS[k].weapon===wid);if(itemId)stashOrMail(itemId);}}
        for(const k of['armor','helmet','chestRig','backpack']){if(S.equipment[k])stashOrMail(S.equipment[k]);}
        if(S.backpack._items){for(const entry of[...S.backpack._items])stashOrMail(entry.id);}
        if(S.secureContainer._items){for(const entry of[...S.secureContainer._items])stashOrMail(entry.id);}
        // Save keychain to persistent state (keycards stay in keychain)
        P.keychain=[...S.keychain];
        P.keyUses=[...S.keyUses];
        savePersistent();
        // Clear all session containers (items already moved to stash)
        S.secureContainer=initGrid(3);S.backpack=initGrid(1);S.backpackCols=0;S.backpackRows=0;
        S.weaponSlots=[null,null,null,'knife'];S.magAmmo=[0,0,0,0];
        S.equipment={armor:null,armorHP:0,helmet:null,helmetHP:0,chestRig:null,backpack:null};
        S.pockets=[];S._rigItems=[];S.maxPockets=5;S.lootValue=0;S._lootItems=[];
        S.keychain=[null,null,null,null];S.keyUses=[0,0,0,0];
    }else{
        title.textContent='行动失败';title.className='result-title failed';status.textContent='阵亡';
        // SECURE CONTAINER items survive! Move to stash/mail first
        if(S.secureContainer._items){for(const entry of[...S.secureContainer._items])stashOrMail(entry.id);}
        // Keychain survives death (like secure container) - save to persistent state
        P.keychain=[...S.keychain];
        P.keyUses=[...S.keyUses];
        savePersistent();
        // Clear ALL session containers (equipment LOST, secure items saved to stash)
        S.secureContainer=initGrid(3);S.backpack=initGrid(1);S.backpackCols=0;S.backpackRows=0;
        S.weaponSlots=[null,null,null,'knife'];S.magAmmo=[0,0,0,0];
        S.equipment={armor:null,armorHP:0,helmet:null,helmetHP:0,chestRig:null,backpack:null};
        S.pockets=[];S._rigItems=[];S.maxPockets=5;S.lootValue=0;S._lootItems=[];
        S.keychain=[null,null,null,null];S.keyUses=[0,0,0,0];
    }

    document.getElementById('resultKills').textContent=S.kills;
    document.getElementById('resultTime').textContent=formatTime(survived);
    document.getElementById('resultSearched').textContent=S.containersSearched;
    document.getElementById('resultValue').textContent='₵ '+finalLootValue.toLocaleString();
    renderResultLoot(finalLootItems);
    document.getElementById('resultScreen').style.display='flex';
    savePersistent();updateAllLobbyUI();renderStashGrid();
}

function renderResultLoot(itemsParam){
    const list=document.getElementById('lootList');list.innerHTML='';
    const items=itemsParam||S._lootItems||[];
    const counts={};items.forEach(item=>{if(!counts[item.id])counts[item.id]={name:item.name,value:0,count:0,rarity:item.rarity};counts[item.id].value+=item.value;counts[item.id].count++;});
    var idx=0;
    Object.entries(counts).sort((a,b)=>b[1].value-a[1].value).forEach(([id,c])=>{
        const div=document.createElement('div');div.className='loot-item-row';
        div.style.animationDelay=(idx*0.05)+'s';
        const rarity=RARITY[c.rarity]||RARITY.common;
        var icon=itemIcon({icon:rarities_icon(c.rarity)});
        var rarityName=rarity.name||'';
        div.innerHTML=`<span style="color:${rarity.color};display:flex;align-items:center;gap:4px;"><span class="loot-icon">${icon}</span>${c.name} <span style="opacity:0.5;font-size:10px">${rarityName}</span> x${c.count}</span><span class="loot-val">₵ ${c.value.toLocaleString()}</span>`;
        list.appendChild(div);idx++;
    });
}
function rarities_icon(rarity){
    var icons={common:'📦',uncommon:'📦',rare:'📦',epic:'📦',legendary:'🏆',ultimate:'🔴'};
    return icons[rarity]||'📦';
}

function restartGame(){document.getElementById('resultScreen').style.display='none';startGame();}
function backToLobby(){document.getElementById('resultScreen').style.display='none';document.getElementById('lobbyScreen').style.display='flex';S.phase='lobby';updateAllLobbyUI();}
function pauseGame(){
    if(S.phase!=='playing')return;
    // 使用设置菜单的暂停界面
    if (typeof GameSettings !== 'undefined') {
        GameSettings.openPauseMenu();
    } else {
        if(confirm('游戏已暂停\n\n按确定继续游戏'))document.getElementById('gameCanvas').requestPointerLock();
    }
}

// 脱离卡死：将玩家传送到地图中心安全区域
function unstuckPlayer() {
    if (!playerGroup) return;
    // 使用出生点作为基准，寻找附近的安全位置
    const sp = (MAP_DATA && MAP_DATA.spawns && MAP_DATA.spawns[0]) || { x: 0, z: 12 };
    let safeX = sp.x, safeZ = sp.z;
    let found = false;

    // 从出生点开始，螺旋搜索安全位置（远离建筑物和障碍物）
    for (let radius = 0; radius <= 20 && !found; radius += 2) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            const tx = sp.x + Math.cos(angle) * radius;
            const tz = sp.z + Math.sin(angle) * radius;
            // 检查是否在地图范围内
            const h2 = CONFIG.mapSize / 2 - 5;
            if (Math.abs(tx) > h2 || Math.abs(tz) > h2) continue;
            // 检查是否与建筑物重叠
            let inBuilding = false;
            for (const b of FIXED_BUILDINGS) {
                if (Math.abs(tx - b.x) < b.w / 2 + 1.5 && Math.abs(tz - b.z) < b.d / 2 + 1.5) {
                    inBuilding = true; break;
                }
            }
            if (inBuilding) continue;
            // 检查是否与障碍物重叠
            let blocked = false;
            for (const o of obstacles) {
                if (!o.mesh) continue;
                if (o.isAABB) {
                    if (Math.abs(tx - o.mesh.position.x) < o.halfW + 1 &&
                        Math.abs(tz - o.mesh.position.z) < o.halfD + 1) {
                        blocked = true; break;
                    }
                } else {
                    const dx = tx - o.mesh.position.x, dz = tz - o.mesh.position.z;
                    if (dx*dx + dz*dz < (o.radius + 1) * (o.radius + 1)) {
                        blocked = true; break;
                    }
                }
            }
            if (!blocked) {
                safeX = tx; safeZ = tz;
                found = true;
                break;
            }
        }
    }

    playerGroup.position.set(safeX, 0, safeZ);
    S._velX = 0; S._velZ = 0; S._velocityY = 0;
    S.isCrouching = false;
    console.log('[Unstuck] 玩家已传送至安全区域:', safeX.toFixed(1), safeZ.toFixed(1));
}

// 放弃战斗
function abandonGame() {
    if (S.phase !== 'playing') return;
    S._deathReason = '放弃战斗';
    // 使用标准结算流程，标记为失败但原因是放弃
    endGame(false);
    // 修改结算标题为放弃战斗
    const title=document.getElementById('resultTitle'),status=document.getElementById('resultStatus');
    if(title){title.textContent='行动结束';title.className='result-title failed';}
    if(status)status.textContent='放弃战斗';
}
function formatTime(s){const m=Math.floor(s/60);return m.toString().padStart(2,'0')+':'+Math.floor(s%60).toString().padStart(2,'0');}

// ========== 拖拽丢弃系统 ==========
let _dropZoneLeft = null, _dropZoneRight = null;
function initDropZones() {
    if (_dropZoneLeft) return;
    const createZone = (side) => {
        const zone = document.createElement('div');
        zone.id = 'dropZone-' + side;
        zone.style.cssText = 'position:fixed;top:0;bottom:0;width:120px;z-index:9998;display:flex;align-items:center;justify-content:center;pointer-events:none;transition:background 0.2s;';
        zone.style[side] = '0';
        zone.style.background = 'transparent';
        zone.innerHTML = '<div style="color:rgba(255,80,80,0);font-size:18px;font-weight:bold;text-align:center;transition:color 0.2s;user-select:none;">丢弃<br>区域</div>';
        zone._label = zone.querySelector('div');
        document.body.appendChild(zone);
        return zone;
    };
    _dropZoneLeft = createZone('left');
    _dropZoneRight = createZone('right');

    const handleDragOver = (zone) => (e) => {
        if (S.phase !== 'backpack' && S.phase !== 'searching') return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        zone.style.background = 'rgba(255,50,50,0.5)';
        zone._label.style.color = 'rgba(255,255,255,1)';
    };
    const handleDragLeave = (zone) => () => {
        zone.style.background = 'linear-gradient(to right, rgba(255,50,50,0.25), rgba(255,50,50,0.05))';
        if (zone.id === 'dropZone-right') {
            zone.style.background = 'linear-gradient(to left, rgba(255,50,50,0.25), rgba(255,50,50,0.05))';
        }
        zone._label.style.color = 'rgba(255,80,80,0.85)';
    };
    const handleDrop = (zone) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.style.background = 'linear-gradient(to right, rgba(255,50,50,0.25), rgba(255,50,50,0.05))';
        if (zone.id === 'dropZone-right') {
            zone.style.background = 'linear-gradient(to left, rgba(255,50,50,0.25), rgba(255,50,50,0.05))';
        }
        zone._label.style.color = 'rgba(255,80,80,0.85)';
        handleItemDrop(e);
    };

    [_dropZoneLeft, _dropZoneRight].forEach(zone => {
        zone.addEventListener('dragover', handleDragOver(zone));
        zone.addEventListener('dragleave', handleDragLeave(zone));
        zone.addEventListener('drop', handleDrop(zone));
    });
}

// 显示/隐藏丢弃区域
function showDropZones(show) {
    if (!_dropZoneLeft || !_dropZoneRight) return;
    if (show) {
        _dropZoneLeft.style.background = 'linear-gradient(to right, rgba(255,50,50,0.25), rgba(255,50,50,0.05))';
        _dropZoneLeft.style.borderRight = '2px dashed rgba(255,80,80,0.6)';
        _dropZoneLeft._label.style.color = 'rgba(255,80,80,0.85)';
        _dropZoneLeft.style.pointerEvents = 'auto';
        _dropZoneRight.style.background = 'linear-gradient(to left, rgba(255,50,50,0.25), rgba(255,50,50,0.05))';
        _dropZoneRight.style.borderLeft = '2px dashed rgba(255,80,80,0.6)';
        _dropZoneRight._label.style.color = 'rgba(255,80,80,0.85)';
        _dropZoneRight.style.pointerEvents = 'auto';
    } else {
        _dropZoneLeft.style.background = 'transparent';
        _dropZoneLeft.style.borderRight = 'none';
        _dropZoneLeft._label.style.color = 'rgba(255,80,80,0)';
        _dropZoneLeft.style.pointerEvents = 'none';
        _dropZoneRight.style.background = 'transparent';
        _dropZoneRight.style.borderLeft = 'none';
        _dropZoneRight._label.style.color = 'rgba(255,80,80,0)';
        _dropZoneRight.style.pointerEvents = 'none';
    }
}

function handleItemDrop(e) {
    // 解析拖拽来源并丢弃物品
    let itemType = null;
    let source = null;
    let sourceInfo = {}; // 存储来源详细信息

    // 1. 背包主网格拖拽（dragData）
    if (dragData && dragData.gridType === 'backpack' && dragData.entry) {
        itemType = dragData.entry.id;
        source = 'backpack-grid';
        sourceInfo = { grid: dragData.grid, entry: dragData.entry };
    }

    // 2. dataTransfer 格式解析
    if (!itemType && e.dataTransfer) {
        const dt = e.dataTransfer.getData('text/plain');
        if (dt) {
            const parts = dt.split(':');
            // 格式1: item:container:itemId:col:row （容器/尸体物品）
            if (parts[0] === 'item' && parts[1] === 'container') {
                itemType = parts[2];
                source = 'container';
                sourceInfo = { col: parseInt(parts[3]), row: parseInt(parts[4]) };
            }
            // 格式2: item:zone:itemId:col:row （搜索界面中的背包/安全箱/胸挂区域物品）
            else if (parts[0] === 'item' && parts[1] !== 'container' && parts.length >= 5) {
                itemType = parts[2];
                source = 'player-zone';
                sourceInfo = { zone: parts[1], col: parseInt(parts[3]), row: parseInt(parts[4]) };
            }
            // 格式3: quick:zone:idx （快捷栏/口袋/胸挂/安全箱格子）
            else if (parts[0] === 'quick') {
                const zone = parts[1];
                const idx = parseInt(parts[2]);
                itemType = getQuickSlotItem(zone, idx);
                source = 'quick';
                sourceInfo = { zone, idx };
            }
            // 格式4: backpack:idx （背包主网格，dragData失效时备用）
            else if (parts[0] === 'backpack') {
                const idx = parseInt(parts[1]);
                const entry = S.backpack._items[idx];
                if (entry) {
                    itemType = entry.id;
                    source = 'backpack-grid';
                    sourceInfo = { grid: S.backpack, entry };
                }
            }
            // 格式5: keychain:i （钥匙链）
            else if (parts[0] === 'keychain') {
                const idx = parseInt(parts[1]);
                itemType = S.keychain[idx];
                source = 'keychain';
                sourceInfo = { idx };
            }
            // 格式6: equip:slotType （身上装备拖拽丢弃）
            else if (parts[0] === 'equip') {
                const slotType = parts[1];
                itemType = getEquipItemId(slotType);
                source = 'equipment';
                sourceInfo = { slotType };
            }
            // 格式7: weapon:slotIndex （主武器拖拽丢弃/移动）
            else if (parts[0] === 'weapon') {
                const slotIndex = parseInt(parts[1]);
                const weaponId = S.weaponSlots[slotIndex];
                if (weaponId) {
                    // 确保武器物品定义存在
                    const wDef = WEAPONS[weaponId];
                    const wItemId = 'weapon_' + weaponId;
                    if (wDef && !ITEMS[wItemId]) {
                        ITEMS[wItemId] = { name: wDef.name, icon: wDef.icon, type: 'weapon', rarity: wDef.rarity || 'rare', value: wDef.value || 5000, w: 2, h: 1, weight: wDef.weight || 3 };
                    }
                    itemType = wItemId;
                    source = 'weapon-slot';
                    sourceInfo = { slotIndex };
                }
            }
            // 格式8: weapon_item:itemId （背包中的武器拖拽到武器槽/丢弃）
            else if (parts[0] === 'weapon_item') {
                itemType = parts.slice(1).join(':');
                source = 'weapon-item';
                sourceInfo = { itemId: itemType };
            }
            // 仓库物品不支持丢弃
            else if (parts[0] === 'stash' || parts[0] === 'stashKeychain') {
                return;
            }
        }
    }

    if (!itemType) {
        console.log('[Drop] 无法解析物品类型');
        return;
    }
    const def = ITEMS[itemType];
    if (!def) return;

    let removed = false;

    // 执行移除
    if (source === 'backpack-grid' && sourceInfo.entry) {
        removeFromGrid(sourceInfo.grid, sourceInfo.entry);
        removed = true;
    }
    else if (source === 'container') {
        const container = S.currentSearchContainer;
        if (container && container.grid) {
            // 优先通过 col/row 查找 grid entry
            let entry = container.grid._items.find(en => en.col === sourceInfo.col && en.row === sourceInfo.row);
            // 如果找不到，通过 itemId 查找第一个匹配
            if (!entry) {
                entry = container.grid._items.find(en => en.id === itemType);
            }
            if (entry) {
                removeFromGrid(container.grid, entry);
                removed = true;
                // 同时从 container.items 中移除对应的物品（通过 gridEntry 引用匹配）
                if (container.items) {
                    for (let i = container.items.length - 1; i >= 0; i--) {
                        const it = container.items[i];
                        if (it.gridEntry === entry ||
                            (it.gridEntry && it.gridEntry.col === entry.col && it.gridEntry.row === entry.row && it.type === itemType)) {
                            it.taken = true;
                            container.items.splice(i, 1);
                        }
                    }
                }
                // 同步 _revealed 数组
                if (container._revealed && container._revealed.length > 0) {
                    container._revealed.splice(container._revealed.length - 1, 1);
                }
            } else {
                console.log('[Drop] 容器中未找到匹配的 entry:', sourceInfo, itemType);
            }
        } else {
            console.log('[Drop] 容器或网格不存在:', S.currentSearchContainer);
        }
    }
    else if (source === 'player-zone') {
        // 搜索界面中的玩家背包/安全箱等区域物品
        const zone = sourceInfo.zone;
        let grid = null;
        if (zone === 'backpack') grid = S.backpack;
        else if (zone === 'secure') grid = S.secureContainer;
        else if (zone === 'rig') grid = S._rigGrid || (S.equipment.chestRig ? ITEMS[S.equipment.chestRig].grid : null);
        if (grid && grid._items) {
            // 使用宽松相等比较，防止col/row类型不匹配（数字vs字符串）
            let entry = grid._items.find(en => en.col == sourceInfo.col && en.row == sourceInfo.row);
            if (!entry) entry = grid._items.find(en => en.id === itemType);
            if (entry) {
                removeFromGrid(grid, entry);
                // 从背包移除时减少战利品价值
                if (zone === 'backpack') {
                    const def = ITEMS[itemType];
                    if (def) S.lootValue = Math.max(0, S.lootValue - def.value);
                }
                removed = true;
            } else {
                console.log('[Drop] player-zone未找到匹配物品:', zone, sourceInfo, itemType, '总物品数:', grid._items.length);
            }
        } else {
            console.log('[Drop] player-zone grid不存在或无_items:', zone, grid);
        }
    }
    else if (source === 'quick') {
        removeQuickSlotItem(sourceInfo.zone, sourceInfo.idx);
        removed = true;
    }
    else if (source === 'keychain') {
        S.keychain[sourceInfo.idx] = null;
        S.keyUses[sourceInfo.idx] = 0;
        removed = true;
    }
    else if (source === 'equipment') {
        // 身上装备丢弃
        if (sourceInfo.slotType === 'backpack') {
            // 背包丢弃前检查是否为空
            if (S.backpack && S.backpack._items && S.backpack._items.length > 0) {
                showFloatingMsg('背包不为空，请先清空背包物品再丢弃');
                return;
            }
        }
        clearEquipSlot(sourceInfo.slotType);
        removed = true;
    }
    else if (source === 'weapon-slot') {
        // 主武器槽武器丢弃
        S.weaponSlots[sourceInfo.slotIndex] = null;
        S.magAmmo[sourceInfo.slotIndex] = 0;
        if (S.currentWeapon === sourceInfo.slotIndex) {
            let found = false;
            for (let i = 0; i < S.weaponSlots.length; i++) {
                if (S.weaponSlots[i]) { S.currentWeapon = i; found = true; break; }
            }
            if (!found) S.currentWeapon = 3;
        }
        if (S.weaponSlots[3] !== 'knife') S.weaponSlots[3] = 'knife';
        if (typeof updateWeaponModel === 'function') updateWeaponModel();
        removed = true;
    }
    else if (source === 'weapon-item') {
        // 背包中的武器丢弃
        if (S.backpack && S.backpack._items) {
            const entry = S.backpack._items.find(en => en.id === sourceInfo.itemId);
            if (entry) {
                removeFromGrid(S.backpack, entry);
                const def = ITEMS[sourceInfo.itemId];
                if (def) S.lootValue = Math.max(0, S.lootValue - def.value);
                removed = true;
            }
        }
    }

    if (!removed) {
        console.log('[Drop] 物品移除失败:', source, itemType);
        return;
    }

    // 清空 dragData 防止重复处理
    dragData = null;

    // 在玩家位置生成地面物品
    spawnDroppedItem(itemType);

    console.log('[Drop] 成功丢弃:', itemType, '来源:', source);

    // 刷新UI（实时刷新）
    if (S.phase === 'backpack') {
        renderBackpackInventory();
    }
    if (S.phase === 'searching' && S.currentSearchContainer) {
        // 刷新容器网格（右侧）和玩家背包面板（左侧）
        renderSearchGrid(S.currentSearchContainer);
        renderSearchBackpackPanel();
        updateSearchValue();
    }
    updateHUD();
    updateWeaponUI();
}

function getQuickSlotItem(zone, idx) {
    if (zone === 'pockets') return S.pockets[idx];
    if (zone === 'rig') return (S._rigItems || [])[idx];
    if (zone === 'secure') return (S._secureItems || [])[idx];
    return null;
}
function removeQuickSlotItem(zone, idx) {
    if (zone === 'pockets') S.pockets.splice(idx, 1);
    else if (zone === 'rig') { S._rigItems = S._rigItems || []; S._rigItems.splice(idx, 1); }
    else if (zone === 'secure') { S._secureItems = S._secureItems || []; S._secureItems.splice(idx, 1); }
}

function spawnDroppedItem(itemId) {
    const def = ITEMS[itemId];
    if (!def) return;
    // 在玩家脚下位置生成
    let spx = playerGroup.position.x;
    let spz = playerGroup.position.z;
    // 检查脚下位置是否被阻挡，如果是则在附近寻找安全位置
    let attempts = 0;
    while (attempts < 8) {
        let blocked = false;
        for (const o of obstacles) {
            if (!o.mesh) continue;
            if (o.isAABB) {
                if (Math.abs(spx - o.mesh.position.x) < o.halfW + 0.3 &&
                    Math.abs(spz - o.mesh.position.z) < o.halfD + 0.3) {
                    blocked = true; break;
                }
            } else {
                const dx = spx - o.mesh.position.x, dz = spz - o.mesh.position.z;
                if (dx*dx + dz*dz < (o.radius + 0.3) * (o.radius + 0.3)) {
                    blocked = true; break;
                }
            }
        }
        if (!blocked) break;
        // 偏移一点重新尝试
        const a = Math.random() * Math.PI * 2;
        spx = playerGroup.position.x + Math.cos(a) * 0.8;
        spz = playerGroup.position.z + Math.sin(a) * 0.8;
        attempts++;
    }
    const rarity = def.rarity || 'common';

    const grp = new THREE.Group();
    const baseColor = RARITY[rarity]?.color || '#ffffff';
    const itemMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.15, 0.3),
        new THREE.MeshStandardMaterial({ color: parseInt(baseColor.replace('#','0x'), 16), emissive: parseInt(baseColor.replace('#','0x'), 16), emissiveIntensity: 0.3 })
    );
    itemMesh.position.y = 0.2;
    itemMesh.castShadow = true;
    grp.add(itemMesh);
    // 稀有度光环
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.55, 16),
        new THREE.MeshBasicMaterial({ color: parseInt(baseColor.replace('#','0x'), 16), transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    grp.add(ring);
    grp.userData = { baseY: 0, time: Math.random() * Math.PI * 2 };
    grp.position.set(spx, 0, spz);
    scene.add(grp);

    groundLootItems.push({
        mesh: grp, x: spx, z: spz, itemId,
        name: def.name, value: def.value, icon: def.icon, rarity,
        taken: false, radius: 1.2,
    });
}

// ========== SECTION 17: EVENTS ==========
function setupEvents(){
    initDropZones();
    document.addEventListener('keydown',e=>{keys[e.code]=true;
        // Tab / Escape close backpack/search screen (handled before phase check)
        if(e.code==='Tab'){e.preventDefault();if(S.phase==='searching'){closeSearch();return;}if(S.phase==='backpack'){closeBackpack();return;}if(S._fullMapOpen){toggleFullMap();return;}}
        if(e.code==='Escape'){
            // 先检查技能树面板是否打开，如果打开则关闭
            if (typeof SkillTreeUI !== 'undefined' && SkillTreeUI.isOpen()) { SkillTreeUI.close(); return; }
            // 先检查BOSS扩展面板是否打开，如果打开则关闭
            if (typeof BossExtensions !== 'undefined') {
                if (typeof BossExtensions.isMissionPanelOpen === 'function' && BossExtensions.isMissionPanelOpen()) { BossExtensions.closeMissionPanel(); return; }
                if (typeof BossExtensions.isAchievementPanelOpen === 'function' && BossExtensions.isAchievementPanelOpen()) { BossExtensions.closeAchievementPanel(); return; }
                if (typeof BossExtensions.isLeaderboardPanelOpen === 'function' && BossExtensions.isLeaderboardPanelOpen()) { BossExtensions.closeLeaderboardPanel(); return; }
            }
            if(S.phase==='searching'){closeSearch();return;}else if(S._isSearching){cancelSearchAnim();return;}else if(S.phase==='backpack'){closeBackpack();return;}else if(S.phase==='playing'){pauseGame();return;}
        }
        if(S.phase==='backpack'){if(e.code===getBoundKey('backpack')){closeBackpack();return;}return;}
        if(S.phase!=='playing')return;
        if(e.code===getBoundKey('backpack')){openBackpack();return;}
        if(e.code===getBoundKey('map')){toggleFullMap();return;}
        if(e.code===getBoundKey('reload'))reload();
        if(e.code===getBoundKey('interact'))interact();
        if(e.code===getBoundKey('inspect')&&typeof PlayerAnimation!=='undefined'){PlayerAnimation.toggleInspect();if(typeof AudioEngine!=='undefined')AudioEngine.play('inspect');}
        if(e.code==='KeyP'){try{if(typeof GameSettings!=='undefined'){GameSettings.openPauseMenu();}else{alert('暂停');}}catch(err){alert('暂停错误:'+err.message);}return;}
        if(e.code==='Digit1')switchWeapon(0);if(e.code==='Digit2')switchWeapon(1);if(e.code==='Digit3')switchWeapon(2);if(e.code==='Digit4')switchWeapon(3);
        if(e.code===getBoundKey('useMedkit'))useItem('medkit');
        if(e.code===getBoundKey('useBandage'))useItem('bandage');
        if(e.code===getBoundKey('usePainkiller'))useItem('painkiller');if(e.code==='F10'&&typeof BossExtensions!=='undefined'){BossExtensions.openMissionPanel();}
        if(e.code==='F11'&&typeof BossExtensions!=='undefined'){BossExtensions.openAchievementPanel();}
        if(e.code==='F12'&&typeof BossExtensions!=='undefined'){BossExtensions.openLeaderboardPanel();}
        if(e.code==='KeyK'&&typeof SkillTreeUI!=='undefined'){SkillTreeUI.toggle();}
        if(e.code==='F9'&&typeof BossSystemV2!=='undefined'&&S.phase==='playing'){const bx=playerGroup.position.x+Math.sin(mouseX)*5;const bz=playerGroup.position.z+Math.cos(mouseX)*5;BossSystemV2.createBossV2('forest_hunter',bx,bz);console.log('[测试] 生成BOSS V2: 森林猎手');}
    });
    document.addEventListener('keyup',e=>keys[e.code]=false);
    document.addEventListener('mousedown',e=>{if(e.button===0){isMouseDown=true;if(S.phase==='playing'&&!S._fullMapOpen){const w=S.weaponSlots[S.currentWeapon]?WEAPONS[S.weaponSlots[S.currentWeapon]]:null;if(w&&!w.auto)shoot();}}else if(e.button===2){if(S.phase==='playing'&&!S._fullMapOpen&&typeof WeaponADS!=='undefined'){if(WeaponADS.isHoldToAim()){WeaponADS.startAim();}else{WeaponADS.toggleAim();}}}});
    document.addEventListener('mouseup',e=>{if(e.button===0)isMouseDown=false;else if(e.button===2){if(typeof WeaponADS!=='undefined'&&WeaponADS.isHoldToAim()){WeaponADS.stopAim();}}});
    document.addEventListener('mousemove',e=>{
        if(S.phase!=='playing'||!document.pointerLockElement)return;
        // 读取鼠标灵敏度设置（支持X/Y轴独立调节和Y轴反转）
        let sensX = CONFIG.mouseSensitivity;
        let sensY = CONFIG.mouseSensitivity;
        let invertY = false;
        try {
            if (typeof GameSettings !== 'undefined' && typeof GameSettings.getSettings === 'function') {
                const ms = GameSettings.getSettings().mouse;
                if (ms) {
                    sensX = (ms.sensitivity || 0.002) * (ms.sensitivityX || 1.0);
                    sensY = (ms.sensitivity || 0.002) * (ms.sensitivityY || 1.0);
                    invertY = !!ms.invertY;
                }
            }
        } catch(err) {}
        mouseX -= e.movementX * sensX;
        mouseY -= (invertY ? -e.movementY : e.movementY) * sensY;
        mouseY=Math.max(-Math.PI/2+0.05,Math.min(Math.PI/2-0.05,mouseY));
    });
    // 鼠标滚轮切换武器
    document.addEventListener('wheel',e=>{
        if(S.phase!=='playing'||!document.pointerLockElement||S._fullMapOpen)return;
        // 检查设置中是否启用鼠标滚轮切换武器
        let wheelEnabled = true;
        if(typeof GameSettings !== 'undefined' && typeof GameSettings.getSettings === 'function'){
            const settings = GameSettings.getSettings();
            wheelEnabled = settings.gameplay ? settings.gameplay.wheelSwitchWeapon !== false : true;
        }
        if(!wheelEnabled)return;
        e.preventDefault();
        // 获取所有有武器的槽位（排除空槽）
        const availableSlots = [];
        for(let i=0;i<4;i++){if(S.weaponSlots[i])availableSlots.push(i);}
        if(availableSlots.length<=1)return;
        const currentIdx = availableSlots.indexOf(S.currentWeapon);
        let nextIdx;
        if(e.deltaY>0){
            // 向下滚动：下一把武器
            nextIdx = (currentIdx+1)%availableSlots.length;
        }else{
            // 向上滚动：上一把武器
            nextIdx = (currentIdx-1+availableSlots.length)%availableSlots.length;
        }
        switchWeapon(availableSlots[nextIdx]);
    },{passive:false});
    document.addEventListener('pointerlockchange',()=>{
        if(!document.pointerLockElement&&S.phase==='playing'&&!S._fullMapOpen){
            Object.keys(keys).forEach(k=>keys[k]=false);isMouseDown=false;
            document.getElementById('clickToPlay').style.display='none';
            // 检查是否有其他UI面板打开（技能树、背包、搜索、BOSS扩展面板等）
            let otherPanelOpen = false;
            if (typeof SkillTreeUI !== 'undefined' && SkillTreeUI.isOpen()) otherPanelOpen = true;
            if (S.phase === 'backpack' || S.phase === 'searching') otherPanelOpen = true;
            if (typeof BossExtensions !== 'undefined') {
                if (typeof BossExtensions.isMissionPanelOpen === 'function' && BossExtensions.isMissionPanelOpen()) otherPanelOpen = true;
                if (typeof BossExtensions.isAchievementPanelOpen === 'function' && BossExtensions.isAchievementPanelOpen()) otherPanelOpen = true;
                if (typeof BossExtensions.isLeaderboardPanelOpen === 'function' && BossExtensions.isLeaderboardPanelOpen()) otherPanelOpen = true;
            }
            // 只有在没有其他UI面板打开时，才自动打开暂停菜单
            if (!otherPanelOpen) {
                if (typeof GameSettings !== 'undefined') {
                    GameSettings.openPauseMenu();
                } else {
                    document.getElementById('clickToPlay').style.display='block';
                }
            }
        }
    });
    document.getElementById('gameCanvas').addEventListener('contextmenu',e=>e.preventDefault());
    document.getElementById('gameCanvas').addEventListener('click',()=>{if(S.phase==='playing'&&!document.pointerLockElement&&!S._fullMapOpen){document.getElementById('gameCanvas').requestPointerLock();document.getElementById('clickToPlay').style.display='none';}});
    window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});
}

// ========== SECTION 18: MAIN LOOP ==========
// 主循环内的 DOM 引用与状态缓存：避免每帧 querySelector/getElementById
let _fpsEl = null, _crosshairRing = null, _vigEl = null, _ciEl = null;
let _lastCrossSig = '', _lastVigSig = '', _lastCrouch = null;

function animate(currentTime){
    requestAnimationFrame(animate);
    // 性能诊断：URL 加 ?perfdebug=1 后可在控制台读取 window.__perfFrame
    if (typeof window.__PERF_DEBUG === 'undefined') window.__PERF_DEBUG = /perfdebug/.test(location.search);
    const _dbgT0 = window.__PERF_DEBUG ? performance.now() : 0;
    let frameDt=(currentTime-lastTime)/1000;if(frameDt>CONFIG.MAX_FRAME_DT)frameDt=CONFIG.MAX_FRAME_DT;lastTime=currentTime;

    // FPS计算和显示
    if (typeof _fpsData === 'undefined') {
        window._fpsData = { frames: 0, lastUpdate: currentTime, currentFps: 0 };
    }
    _fpsData.frames++;
    if (currentTime - _fpsData.lastUpdate >= 1000) {
        _fpsData.currentFps = Math.round(_fpsData.frames * 1000 / (currentTime - _fpsData.lastUpdate));
        _fpsData.frames = 0;
        _fpsData.lastUpdate = currentTime;
        // 更新FPS显示（元素只创建一次）
        if (!_fpsEl) _fpsEl = document.getElementById('fpsCounter');
        if (!_fpsEl) {
            _fpsEl = document.createElement('div');
            _fpsEl.id = 'fpsCounter';
            _fpsEl.style.cssText = 'position:fixed;top:10px;left:10px;background:rgba(0,0,0,0.7);color:#00ff00;padding:4px 10px;border-radius:4px;font-size:14px;font-family:monospace;z-index:200;pointer-events:none;display:none;';
            document.body.appendChild(_fpsEl);
        }
        let showFps = false;
        try {
            if (typeof GameSettings !== 'undefined' && typeof GameSettings.getSettings === 'function') {
                showFps = GameSettings.getSettings().gameplay.showFPS === true;
            }
        } catch(e) { reportInitError('animate:showFPS', e); }
        _fpsEl.style.display = showFps ? 'block' : 'none';
        _fpsEl.textContent = 'FPS: ' + _fpsData.currentFps;
    }

    if(S.phase==='playing'){
        // 检查暂停菜单是否打开
        const isPaused = typeof GameSettings !== 'undefined' && GameSettings.isPauseOpen();
        if (!isPaused) {
            accumulator+=frameDt;let updates=0;
            while(accumulator>=CONFIG.FIXED_DT&&updates<10){updatePlayer(CONFIG.FIXED_DT);updateEnemies(CONFIG.FIXED_DT);updateEnemyBullets();updateBulletTrails();updateParticles();updateExtract(CONFIG.FIXED_DT);updateTimer();updateGroundLootAnimation();accumulator-=CONFIG.FIXED_DT;updates++;}
            if(accumulator>CONFIG.FIXED_DT*2)accumulator=0;
        }
        // HUD 分频：文本类 20Hz、小地图 12.5Hz、罗盘 30Hz；数值未变化的写入会被去重
        const _due = (typeof PerfManager !== 'undefined') ? PerfManager.tick(frameDt) : null;
        if (!_due || _due.hud) { updateHUD(); updateWeaponUI(); }
        if (!_due || _due.minimap) updateMinimap();
        if (!_due || _due.compass) updateCompass();
        // 更新武器开镜系统（必须在PlayerAnimation.update之前，先计算偏移）
        if (typeof WeaponADS !== 'undefined') WeaponADS.update(frameDt);
        // 角色动画更新（每帧）
        if (typeof PlayerAnimation !== 'undefined') PlayerAnimation.update(frameDt);
        // BOSS扩展：战场互动物体更新
        if (typeof BossExtensions !== 'undefined') {
            BossExtensions.updateBattleObjects(frameDt);
        }
        updateMarkerGuide();
        if(S._fullMapOpen)drawFullMap();
        // Loot tracker pulse on value change
        if(S._lastLootValue===undefined)S._lastLootValue=S.lootValue;
        if(S.lootValue!==S._lastLootValue){
            S._lastLootValue=S.lootValue;
            pulseLootTracker();
        }
        // 动态准星：随移动扩散，写入前比较，避免每帧触发样式重算
        const speed=Math.abs(S._velX||0)+Math.abs(S._velZ||0);
        if(!_crosshairRing)_crosshairRing=document.querySelector('.crosshair-ring');
        if(_crosshairRing){
            const sz=(18+speed*1.5).toFixed(1);
            const sig=sz+'|'+(0.3+speed*0.02).toFixed(2);
            if(sig!==_lastCrossSig){
                _lastCrossSig=sig;
                _crosshairRing.style.width=sz+'px';
                _crosshairRing.style.height=sz+'px';
                _crosshairRing.style.opacity=0.3+speed*0.02;
            }
        }
        // 低血量暗角：只在跨过阈值时改样式，动画交给 CSS
        if(!_vigEl)_vigEl=document.getElementById('healthVignette');
        if(_vigEl){
            const hpR=S.health/S.maxHealth;
            if(hpR<0.35){
                const sig='on:'+((0.35-hpR)*1.8).toFixed(2);
                if(sig!==_lastVigSig){
                    _lastVigSig=sig;
                    _vigEl.style.opacity=(0.35-hpR)*1.8;
                    _vigEl.style.animation='vignettePulse 1.5s ease-in-out infinite';
                }
            }else if(_lastVigSig!=='off'){
                _lastVigSig='off';
                _vigEl.style.opacity='0';
                _vigEl.style.animation='none';
            }
        }
        // 蹲伏提示
        if(!_ciEl)_ciEl=document.getElementById('crouchIndicator');
        if(_ciEl && _lastCrouch!==S.isCrouching){
            _lastCrouch=S.isCrouching;
            _ciEl.style.opacity=S.isCrouching?'1':'0';
        }
        // 敌人血条朝向：65m 内才更新；3m 内隐藏，避免贴脸时血条占满屏幕
        const _cx=camera.position.x, _cz=camera.position.z;
        for(const e of enemies){
            if(!e.mesh) continue;
            const dx=e.mesh.position.x-_cx, dz=e.mesh.position.z-_cz;
            const d2=dx*dx+dz*dz;
            if(e._hb===undefined) e._hb=e.mesh.getObjectByName('healthBar');
            if(e._hbBg===undefined){
                e._hbBg=null;
                if(e._hb&&e._hb.parent){
                    for(const c of e._hb.parent.children){
                        if(c!==e._hb&&c.isMesh&&Math.abs(c.position.y-2.3)<0.01){e._hbBg=c;break;}
                    }
                }
            }
            const show=d2<=900&&d2>=9&&e.health<e.maxHealth;
            if(e._hb) e._hb.visible=show;
            if(e._hbBg) e._hbBg.visible=show;
            if(show&&e._hb) e._hb.lookAt(camera.position);
            if(show&&e._hbBg) e._hbBg.lookAt(camera.position);
        }
    }
    // 自适应性能守卫
    if (typeof PerformanceGuard !== 'undefined') PerformanceGuard.update(frameDt);
    const _dbgTJs = window.__PERF_DEBUG ? performance.now() : 0;
    // 武器世界特效（弹壳/弹孔/火花/硝烟）
    if (typeof WeaponFX !== 'undefined') WeaponFX.update(frameDt);
    // 渲染：优先走统一管线（天空/IBL/后期），失败时自动回落
    if (typeof RenderPipeline !== 'undefined' && RenderPipeline.isEnabled()) {
        RenderPipeline.render(frameDt);
    } else if (typeof GraphicsEnhancement !== 'undefined' && GraphicsEnhancement.isEnabled()) {
        GraphicsEnhancement.render();
    } else {
        renderer.render(scene,camera);
    }
    if (window.__PERF_DEBUG) {
        const t2 = performance.now();
        window.__perfFrame = {
            js: +(_dbgTJs - _dbgT0).toFixed(2),
            render: +(t2 - _dbgTJs).toFixed(2),
            total: +(t2 - _dbgT0).toFixed(2),
            calls: renderer.info.render.calls,
            level: (typeof PerformanceGuard !== 'undefined' ? PerformanceGuard.getLevel() : -1),
        };
    }
}

function updateBulletTrails(){for(let i=bulletTrails.length-1;i>=0;i--){const bt=bulletTrails[i];if(bt.isBullet)continue;bt.life--;bt.mesh.material.opacity=bt.life/4;if(bt.life<=0){scene.remove(bt.mesh);bulletTrails.splice(i,1);}}}
function updateParticles(){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.mesh.position.add(p.velocity);if(p.type==='hit')p.velocity.y-=0.01;p.life--;p.mesh.material.opacity=p.life/p.maxLife;if(p.type==='flash')p.mesh.scale.setScalar(p.life/p.maxLife);if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1);}}}

// ========== BOOT ==========
// 使用资源预加载管理器启动游戏
if (typeof ResourceLoader !== 'undefined') {
    ResourceLoader.startLoading(() => {
        init();
    });
} else {
    init();
}
