// ============================================================
// 战术突击 - 搜打撤 v4.0
// Delta Force style tactical FPS with grid-based inventory
// ============================================================

// ========== SECTION 1: RARITY & CONFIG ==========
const RARITY = {
    common:    { name: '普通',  color: '#9e9e9e', bg: '#3a3a3a', border: '#555' },
    uncommon:  { name: '精良',  color: '#4caf50', bg: '#1a3a1a', border: '#3a7a3a' },
    rare:      { name: '稀有',  color: '#2196f3', bg: '#1a2a3a', border: '#3a5a8a' },
    epic:      { name: '史诗',  color: '#9c27b0', bg: '#221a32', border: '#6a3a8a' },
    legendary: { name: '传说',  color: '#ff9800', bg: '#32281a', border: '#8a6a3a' },
    ultimate:  { name: '终极',  color: '#f44336', bg: '#321a1a', border: '#8a3a3a' },
};

const CONFIG = {
    mapSize: 110,
    gameTime: { normal: 900, hard: 600 },
    extractTime: 8,
    maxEnemies: 14,
    maxParticles: 50,
    playerSpeed: 8,
    sprintMultiplier: 1.65,
    crouchSpeedMultiplier: 0.45,
    mouseSensitivity: 0.002,
    hardModeFee: 200000,
    FIXED_DT: 1 / 60,
    MAX_FRAME_DT: 0.1,
    // Stamina
    maxStamina: 100,
    staminaDrainPerSec: 30,    // Drain when sprinting
    staminaRegenPerSec: 18,     // Regen when not sprinting
    staminaExhaustedPenalty: 1.5, // Seconds recovery when depleted
    // Grid dimensions
    STASH_COLS: 10, STASH_ROWS: 8,
    BACKPACK_COLS: 6, BACKPACK_ROWS: 4,
};

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
    blueKeycard:   { name: '蓝色钥匙卡', value: 80000,  icon: '💳', type: 'keycard', keyLevel: 1, rarity: 'uncommon', w:1, h:1 },
    purpleKeycard: { name: '紫色钥匙卡', value: 250000, icon: '💳', type: 'keycard', keyLevel: 2, rarity: 'rare', w:1, h:1 },
    redKeycard:    { name: '红色钥匙卡', value: 800000, icon: '💳', type: 'keycard', keyLevel: 3, rarity: 'epic', w:1, h:1 },
    blackKeycard:  { name: '黑色钥匙卡', value: 2000000,icon: '💳', type: 'keycard', keyLevel: 4, rarity: 'legendary', w:1, h:1 },

    // === Expanded Armor (6 tiers: Type I to Type VI) ===
    tier1_armor:   { name: 'I级防弹衣',  value: 15000,  icon: '🦺', type: 'armor', amount: 30,  rarity: 'common', w:2, h:2 },
    tier2_armor:   { name: 'II级防弹衣', value: 40000,  icon: '🦺', type: 'armor', amount: 60,  rarity: 'uncommon', w:2, h:2 },
    tier3_armor:   { name: 'III级防弹衣',value: 120000, icon: '🦺', type: 'armor', amount: 100, rarity: 'rare', w:2, h:2 },
    tier4_armor:   { name: 'IV级防弹衣', value: 300000, icon: '🦺', type: 'armor', amount: 140, rarity: 'epic', w:2, h:2 },
    tier5_armor:   { name: 'V级防弹衣',  value: 600000, icon: '🦺', type: 'armor', amount: 180, rarity: 'legendary', w:3, h:2 },
    tier6_armor:   { name: 'VI级防弹衣', value: 1200000,icon: '🦺', type: 'armor', amount: 220, rarity: 'ultimate', w:3, h:3 },

    // === Expanded Helmets (5 tiers) ===
    tier1_helmet:  { name: 'I级头盔',   value: 5000,   icon: '⛑️', type: 'helmet', amount: 15, rarity: 'common', w:1, h:1 },
    tier2_helmet:  { name: 'II级头盔',  value: 20000,  icon: '⛑️', type: 'helmet', amount: 35, rarity: 'uncommon', w:1, h:1 },
    tier3_helmet:  { name: 'III级头盔', value: 80000,  icon: '⛑️', type: 'helmet', amount: 55, rarity: 'rare', w:2, h:1 },
    tier4_helmet:  { name: 'IV级头盔',  value: 250000, icon: '⛑️', type: 'helmet', amount: 75, rarity: 'epic', w:2, h:2 },
    tier5_helmet:  { name: 'V级头盔',   value: 600000, icon: '⛑️', type: 'helmet', amount: 100, rarity: 'legendary', w:2, h:2 },

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

const CONTAINER_TYPES = {
    // Loot tables: more duplicates = higher probability.
    // Ultimate items appear once; common/uncommon/rare/epic duplicated for higher drop rates.
    weaponBox:  { name: '武器箱', icon: '🔫', color: 0x3a5a3a, shape: 'long',   w:5, h:3,
        items:['pistolAmmo','pistolAmmo','rifleAmmo','rifleAmmo','rifleAmmo','shotgunAmmo','shotgunAmmo','pistol_item','pistol_item','magnum_item','smg_item','rifle_item','shotgun_item','dmr_item'],
        min:2, max:4, searchTime:1.5 },
    medBox:     { name: '医疗箱', icon: '💊', color: 0xeeeeee, shape: 'cube',   w:4, h:2,
        items:['bandage','bandage','bandage','bandage','painkiller','painkiller','painkiller','medkit','medkit','medkit','whiskey'],
        min:2, max:5, searchTime:1.2 },
    equipBox:   { name: '装备箱', icon: '🛡️', color: 0x3a4a5a, shape: 'tall',   w:5, h:3,
        items:['light_armor','light_armor','medium_armor','medium_armor','heavy_armor','basic_helmet','basic_helmet','adv_helmet','adv_helmet','basic_rig','tactical_rig','small_bag','small_bag','medium_bag','gpu','laptop','watch','phone'],
        min:1, max:3, searchTime:1.5 },
    supplyBox:  { name: '物资箱', icon: '📦', color: 0x8b6914, shape: 'crate',  w:5, h:3,
        items:['lighter','lighter','bolt','bolt','tape','tape','battery','battery','wire','lens','bandage','bandage','painkiller','pistolAmmo','rifleAmmo','cash','cash','cash','gold','perfume'],
        min:2, max:4, searchTime:1.0 },
    ammoBox:    { name: '弹药箱', icon: '📦', color: 0x5a3030, shape: 'small',  w:3, h:2,
        items:['pistolAmmo','pistolAmmo','pistolAmmo','rifleAmmo','rifleAmmo','rifleAmmo','shotgunAmmo','shotgunAmmo','bolt','tape'],
        min:2, max:5, searchTime:0.8 },
    safe:       { name: '保险箱', icon: '🔐', color: 0x4a4a3a, shape: 'safe',   w:5, h:4,
        items:['cash','cash','cash','cash','gold','gold','gold','watch','watch','phone','phone','whiskey','whiskey','circuit','circuit','gpu','gpu','ivory','ivory','diamond','relic','red_ring','red_watch','red_necklace','red_tiger','red_vase','africa_star'],
        min:1, max:2, searchTime:2.5 },
    premiumBox: { name: '高级物资箱', icon: '✨', color: 0xffd700, shape: 'premium', w:6, h:5,
        items:['gold','gold','gold','gpu','gpu','gpu','laptop','laptop','laptop','ivory','ivory','ivory','circuit','circuit','circuit','perfume','perfume','perfume','whiskey','whiskey','diamond','relic','red_ring','red_necklace','red_tiger','red_vase','red_lion','red_crown','red_painting','red_statue','red_scepter','africa_star','rifle_w'],
        min:2, max:3, searchTime:3.0 },
};

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
    tier4_helmet:{buy:250000,sell:212500}, tier5_helmet:{buy:600000,sell:510000},
    // Medical expanded
    surgeryKit:{buy:80000,sell:68000}, adrenaline:{buy:45000,sell:38250}, tourniquet:{buy:15000,sell:12750}, stimInjector:{buy:60000,sell:51000},
    // Throwables
    fragGrenade:{buy:35000,sell:29750}, smokeGrenade:{buy:25000,sell:21250}, flashbang:{buy:30000,sell:25500}, molotov:{buy:20000,sell:17000},
    // Keycards
    blueKeycard:{buy:80000,sell:68000}, purpleKeycard:{buy:250000,sell:212500}, redKeycard:{buy:800000,sell:680000}, blackKeycard:{buy:2000000,sell:1700000},
    // Collectibles expanded
    jade:{buy:250000,sell:212500}, goldMask:{buy:380000,sell:323000},
    crown:{buy:800000,sell:680000}, cursedIdol:{buy:650000,sell:552500},
    goldenFalcon:{buy:1500000,sell:1275000}, emperorSeal:{buy:2500000,sell:2125000}, moonStone:{buy:3500000,sell:2975000},
    encryptedUsb:{buy:120000,sell:102000}, confidentialDoc:{buy:280000,sell:238000},
    satellitePhoto:{buy:450000,sell:382500}, commanderDiary:{buy:600000,sell:510000},
};

// ========== SECTION 3: AUDIO SYSTEM ==========
let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; audioCtx = new AC(); }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function playTone(freq, duration, type, vol, glideTo) {
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        if (glideTo) osc.frequency.linearRampToValueAtTime(glideTo, ctx.currentTime + duration);
        gain.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration);
    } catch(e) {}
}

function playNoise(duration, vol) {
    try {
        const ctx = getAudioCtx();
        const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
        const src = ctx.createBufferSource(); src.buffer = buf;
        const gain = ctx.createGain(); gain.gain.setValueAtTime(vol || 0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 0.5;
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        src.start(ctx.currentTime); src.stop(ctx.currentTime + duration);
    } catch(e) {}
}

function sfxShoot() { playNoise(0.08, 0.06); playTone(80, 0.06, 'sawtooth', 0.06); }
function sfxHit() { playTone(200, 0.05, 'square', 0.04, 80); }
function sfxHeadshot() { playTone(600, 0.08, 'square', 0.06, 200); playTone(800, 0.06, 'sine', 0.04); }
function sfxReload() { playTone(300, 0.1, 'triangle', 0.04); setTimeout(() => playTone(500, 0.08, 'triangle', 0.04), 100); }
function sfxPickup(rarity) {
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
function sfxFootstep(isSprinting, isCrouching) {
    const vol = isSprinting ? 0.025 : (isCrouching ? 0.006 : 0.015);
    const freq = isSprinting ? 180 : (isCrouching ? 80 : 120);
    playNoise(0.04, vol);
    playTone(freq, 0.03, 'square', vol * 0.3);
}
function sfxKillEnemy() { playTone(120, 0.1, 'sawtooth', 0.05, 60); playNoise(0.1, 0.03); }
function sfxPlayerDeath() { playTone(60, 0.5, 'sawtooth', 0.08, 20); playNoise(0.3, 0.06); }
let _stepTimer = 0;

// ========== SECTION 4: GRID HELPERS ==========
function canPlaceInGrid(grid, cols, itemId, col, row) {
    const def = ITEMS[itemId];
    if (!def) return false;
    if (col < 0 || row < 0 || col + def.w > cols || row + def.h > (grid.rows || CONFIG.BACKPACK_ROWS)) return false;
    for (let r = row; r < row + def.h; r++) {
        for (let c = col; c < col + def.w; c++) {
            if (grid[r] && grid[r][c]) return false;
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
    removeFromGrid(grid, entry);
    return placeInGrid(grid, cols, entry.id, newCol, newRow);
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
        if (slot) placeInGrid(grid, cols, entry.id, slot.col, slot.row);
        else failed.push(entry);
    }
    // Restore failed items to their original positions
    for (const entry of failed) {
        const orig = originalPositions.find(o => o.id === entry.id);
        if (orig && canPlaceInGrid(grid, cols, entry.id, orig.col, orig.row)) {
            placeInGrid(grid, cols, entry.id, orig.col, orig.row);
        } else {
            const slot = findFreeSlot(grid, cols, maxRows, entry.id);
            if (slot) placeInGrid(grid, cols, entry.id, slot.col, slot.row);
        }
    }
}

// Global drag handlers (exposed for HTML ondrag* attributes)
function onDragStart(gridType, entryIdx) {
    let grid, cols, maxRows, entry;
    if (gridType === 'stash') {
        grid = P.stashGrid; cols = CONFIG.STASH_COLS; maxRows = CONFIG.STASH_ROWS;
        entry = grid._items[entryIdx];
    } else if (gridType === 'backpack') {
        grid = S.backpack; cols = S.backpackCols; maxRows = S.backpackRows;
        entry = grid._items[entryIdx];
    } else return;
    if (!entry) return;
    dragData = { grid, cols, maxRows, entry, gridType };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', gridType + ':' + entryIdx);
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

        const rarity = weightedRandom(sp.rarityWeights || { common: 50, uncommon: 25, rare: 15, epic: 7, legendary: 2.5, ultimate: 0.5 });
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

        // Orb / item icon
        const orb = new THREE.Mesh(
            new THREE.SphereGeometry(isHighValue ? 0.18 : 0.12, 8, 8),
            new THREE.MeshStandardMaterial({
                color: glowColor,
                emissive: glowColor,
                emissiveIntensity: isHighValue ? 0.5 : 0.2,
                metalness: 0.3, roughness: 0.5
            })
        );
        orb.position.y = 0.1;
        grp.add(orb);

        // Pulsating animation data
        grp.userData = { baseY: 0, time: Math.random() * Math.PI * 2 };

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

function updateGroundLootAnimation() {
    const now = performance.now() / 1000;
    for (const gl of groundLootItems) {
        if (gl.taken || !gl.mesh) continue;
        gl.mesh.userData.time += 0.03;
        gl.mesh.position.y = Math.sin(gl.mesh.userData.time) * 0.08;
        gl.mesh.rotation.y += 0.01;
    }
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
    if (gl.mesh) scene.remove(gl.mesh);
    S.lootValue += def.value;
    S._lootItems = S._lootItems || [];
    S._lootItems.push({ id: gl.itemId, name: def.name, value: def.value, rarity: def.rarity });
    sfxPickup(def.rarity);
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
            items.forEach(entry => { if (ITEMS[entry.id]) placeInGrid(grid, CONFIG.STASH_COLS, entry.id, entry.col, entry.row); });
            P.stashGrid = grid;
            P.mailItems = loaded.mailItems || [];
            P.stats = loaded.stats || { kills: 0, extracts: 0, totalValue: 0, games: 0 };
            P.missions = loaded.missions;
            P.xp = loaded.xp || 0;
        } catch(e) { /* use defaults */ }
    }
    initOrRefreshMissions();
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
        money: 1000000,
        stashGrid: g,
        mailItems: [], // Unlimited overflow storage
        stats: { kills: 0, extracts: 0, totalValue: 0, games: 0 },
        missions: { daily: [], weekly: [], faction: [] },
        xp: 0,
        _version: 4,
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
            _version: 4,
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
    } catch(e) {}
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
let particles = [];
let containers = [];
let obstacles = [];
let extractPoints = [];
let bulletTrails = [];
let mapEnvironmentGroup = null;

const keys = {};
let mouseX = 0, mouseY = 0;
let isMouseDown = false;
let accumulator = 0, lastTime = 0;

function init() {
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

    setupLights();
    rebuildMapEnvironment();
    setupEvents();
    // Hide lobby until login
    document.getElementById('lobbyScreen').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    lastTime = performance.now();
    animate(lastTime);
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
}

function applyMapTheme() {
    const theme = (MAP_DATA && MAP_DATA.theme) || {};
    const skyColor = theme.skyColor ?? 0x1a1a2e;
    const fogColor = theme.fogColor ?? skyColor;
    scene.background = new THREE.Color(skyColor);
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
        env.add(patch);
    }

    const roadMat = new THREE.MeshStandardMaterial({ color: theme.roadColor ?? 0x3a3a32, roughness: 0.92 });
    for (const road of ((MAP_DATA && MAP_DATA.roads) || [])) {
        const rd = new THREE.Mesh(new THREE.BoxGeometry(road.w, 0.04, road.d), roadMat);
        rd.position.set(road.x, 0.02, road.z);
        rd.receiveShadow = true;
        env.add(rd);
    }

    for (const w of ((MAP_DATA && MAP_DATA.waterAreas) || [])) {
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
        env.add(water);
        obstacles.push({ mesh: water, isAABB: true, halfW: w.w / 2, halfD: w.d / 2, isWater: true });
    }

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: theme.treeColor ?? 0x2a5a2a, roughness: 0.85 });
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
        env.add(tree);
    }

    const wallMat = new THREE.MeshStandardMaterial({ color: theme.wallColor ?? 0x3d3d3d, roughness: 0.8 });
    const half = CONFIG.mapSize / 2, h = 6;
    [[0, h / 2, -half, CONFIG.mapSize, h, 0.5], [0, h / 2, half, CONFIG.mapSize, h, 0.5], [half, h / 2, 0, 0.5, h, CONFIG.mapSize], [-half, h / 2, 0, 0.5, h, CONFIG.mapSize]].forEach(w => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w[3], w[4], w[5]), wallMat);
        wall.position.set(w[0], w[1], w[2]);
        wall.receiveShadow = wall.castShadow = true;
        env.add(wall);
    });

    for (const b of FIXED_BUILDINGS) {
        const grp = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.7 }));
        body.position.y = b.h / 2;
        body.castShadow = body.receiveShadow = true;
        grp.add(body);
        const roofColor = b.roofColor ?? (theme.roofColor ?? 0x333333);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.6, 0.25, b.d + 0.6), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.5 }));
        roof.position.y = b.h + 0.12;
        roof.castShadow = true;
        grp.add(roof);
        if (b.landmark) {
            const sign = new THREE.Mesh(
                new THREE.CylinderGeometry(0.2, 0.2, 1.2, 6),
                new THREE.MeshStandardMaterial({ color: 0xff9800, emissive: 0x331100, emissiveIntensity: 0.4 })
            );
            sign.position.y = b.h + 0.8;
            grp.add(sign);
        }
        grp.position.set(b.x, 0, b.z);
        env.add(grp);
        obstacles.push({ mesh: grp, isAABB: true, halfW: b.w / 2, halfD: b.d / 2 });
    }

    for (const p of ((MAP_DATA && MAP_DATA.props) || [])) {
        const prop = new THREE.Group();
        if (p.type === 'container') {
            const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 6), new THREE.MeshStandardMaterial({ color: p.color ?? 0x4a6a5a, roughness: 0.6, metalness: 0.3 }));
            box.position.y = 1.2;
            box.castShadow = box.receiveShadow = true;
            prop.add(box);
            obstacles.push({ mesh: prop, isAABB: true, halfW: 1.2, halfD: 3 });
        } else if (p.type === 'barrel') {
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1.0, 8), new THREE.MeshStandardMaterial({ color: p.color ?? 0x6a4a2a, roughness: 0.7 }));
            barrel.position.y = 0.5;
            barrel.castShadow = true;
            prop.add(barrel);
            obstacles.push({ mesh: prop, radius: 0.5 });
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
        env.add(cov);
        obstacles.push({ mesh: cov, radius: gi === 2 ? 1.6 : 1.2 });
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
    if(S.phase!=='playing'||S._isSearching)return;
    playerGroup.rotation.y=mouseX; camera.rotation.x=mouseY;

    let mx=0,mz=0;
    if(keys['KeyW'])mz-=1;
    if(keys['KeyS'])mz+=1;
    if(keys['KeyA'])mx-=1;
    if(keys['KeyD'])mx+=1;
    if(mx||mz){const l=Math.sqrt(mx*mx+mz*mz);mx/=l;mz/=l;}

    // Crouch toggle (C key)
    if(keys['KeyC']&&!S._crouchCooldown){
        S.isCrouching=!S.isCrouching; S._crouchCooldown=true;
        setTimeout(()=>S._crouchCooldown=false,300);
    }
    const targetCamY=S.isCrouching?1.0:1.7;
    camera.position.y+=(targetCamY-camera.position.y)*12*dt;

    // Sprint: requires stamina > 0 and not crouching
    const isSprinting=(keys['ShiftLeft']||keys['ShiftRight'])&&!S.isCrouching&&S.stamina>0&&!S._staminaExhausted;
    let speed=CONFIG.playerSpeed*dt;
    if(isSprinting)speed*=CONFIG.sprintMultiplier;
    else if(S.isCrouching)speed*=CONFIG.crouchSpeedMultiplier;

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
    for(const o of obstacles){
        if(o.isAABB){
            const hw=o.halfW+0.5, hd=o.halfD+0.5;
            const ox=o.mesh.position.x, oz=o.mesh.position.z;
            if(nx>ox-hw&&nx<ox+hw&&nz>oz-hd&&nz<oz+hd){blocked=true;break;}
        }else{
            const dx=nx-o.mesh.position.x,dz=nz-o.mesh.position.z;
            if(dx*dx+dz*dz<(o.radius+0.5)*(o.radius+0.5)){blocked=true;break;}
        }
    }
    if(!blocked){playerGroup.position.x=nx;playerGroup.position.z=nz;}
    else{S._velX=0;S._velZ=0;}

    // Jump (higher when not crouching)
    const onGround=playerGroup.position.y<=0.01;
    if(keys['Space']&&onGround&&!S.isCrouching){S._velocityY=0.18;}
    S._velocityY-=0.012; playerGroup.position.y+=S._velocityY;
    if(playerGroup.position.y<=0){playerGroup.position.y=0;S._velocityY=0;}

    // Weapon bob
    const speedNorm=Math.abs(S._velX)+Math.abs(S._velZ);
    const bobFreq=(isSprinting?0.022:0.014)*(S.isCrouching?0.5:1);
    if(mx||mz){weaponGroup.position.y=Math.sin(performance.now()*bobFreq)*(isSprinting?0.014:0.006)*(S.isCrouching?0.6:1);}
    else weaponGroup.position.y*=0.9;

    // Footstep sounds
    if(mx||mz){
        const stepInterval=isSprinting?0.32:(S.isCrouching?0.7:0.45);
        _stepTimer+=dt;
        if(_stepTimer>=stepInterval){_stepTimer=0;sfxFootstep(isSprinting,S.isCrouching);}
    }else _stepTimer=0;

    const w=S.weaponSlots[S.currentWeapon]?WEAPONS[S.weaponSlots[S.currentWeapon]]:null;
    if(w&&w.auto&&isMouseDown&&S.phase==='playing')shoot();

    checkNearbyContainers();
    checkNearbyGroundLoot();
    checkExtractZone();
}

function damagePlayer(raw){
    let amt=raw;
    // Helmet absorbs
    if(S.equipment.helmetHP>0){const a=Math.min(S.equipment.helmetHP,amt*0.4);S.equipment.helmetHP-=a;amt-=a;
        if(S.equipment.helmetHP<=0){S.equipment.helmetHP=0;/* helmet broken */}}
    // Armor absorbs
    if(S.equipment.armorHP>0){const a=Math.min(S.equipment.armorHP,amt*0.6);S.equipment.armorHP-=a;amt-=a;
        if(S.equipment.armorHP<=0){S.equipment.armorHP=0;S.equipment.armor=null;/* armor broken */}}
    S.health-=amt; updateHUD();
    const ov=document.getElementById('damageOverlay');ov.style.opacity='1';setTimeout(()=>ov.style.opacity='0',120);
    if(S.health<=0){S.health=0;sfxPlayerDeath();endGame(false);}
}

function useItem(type){
    if(S.phase!=='playing')return;
    // Check pockets first
    const pIdx=S.pockets.indexOf(type);
    if(pIdx>=0){S.pockets.splice(pIdx,1);S.health=Math.min(S.maxHealth,S.health+ITEMS[type].amount);updateHUD();sfxUseItem();return;}
    // Check backpack
    if(S.backpack._items){const eIdx=S.backpack._items.findIndex(e=>e.id===type);
        if(eIdx>=0){const e=S.backpack._items[eIdx];removeFromGrid(S.backpack,e);S.lootValue=Math.max(0,S.lootValue-ITEMS[type].value);
            S.health=Math.min(S.maxHealth,S.health+ITEMS[type].amount);updateHUD();sfxUseItem();return;}}
}

// ========== SECTION 9: WEAPONS (RAYCASTER) ==========
function shoot(){
    if(S.isReloading||S._isSearching)return;
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
            e.health-=weapon.damage;createHitEffect(hits[0].point,0xff4444,5);
            updateEnemyHealthBar(e);if(e.health<=0)killEnemy(e);
        }
        weaponGroup.position.z+=0.05;setTimeout(()=>weaponGroup.position.z=0,60);
        return;
    }

    if(S.magAmmo[S.currentWeapon]<=0){reload();return;}
    S.lastShot=now;S.magAmmo[S.currentWeapon]--;updateWeaponUI();
    sfxShoot();

    const pellets=weapon.pellets||1;
    let mwp=null;
    for(let i=0;i<pellets;i++){
        const origin=new THREE.Vector3();camera.getWorldPosition(origin);
        const dir=new THREE.Vector3();camera.getWorldDirection(dir);
        if(weapon.spread>0){dir.x+=(Math.random()-0.5)*weapon.spread*2;dir.y+=(Math.random()-0.5)*weapon.spread*2;dir.normalize();}

        playerRaycaster.set(origin,dir);playerRaycaster.far=weapon.range;
        const eh=playerRaycaster.intersectObjects(enemyHitboxes,false);
        const oh=playerRaycaster.intersectObjects(obstacles.map(o=>o.mesh),true);

        let hitEnemy=null,hitPoint=null;
        if(eh.length>0){const no=oh.length>0?oh[0].distance:Infinity;
            if(eh[0].distance<no){hitEnemy=eh[0].object.userData.enemy;hitPoint=eh[0].point.clone();
                let hs=false;let obj=eh[0].object;
                while(obj){if(obj.userData&&obj.userData.isHead){hs=true;break;}obj=obj.parent;}
                const dmg=hs?weapon.damage*2.5:weapon.damage;hitEnemy.health-=dmg;
                createHitEffect(hitPoint,hs?0xffff00:0xff4444,hs?8:5);
                if(hs)sfxHeadshot();else sfxHit();
                updateEnemyHealthBar(hitEnemy);
                if(hitEnemy.health<=0){killEnemy(hitEnemy);if(hs)trackMission('kill_headshot',1);}
            }else if(oh.length>0){hitPoint=oh[0].point.clone();createHitEffect(hitPoint,0xcccccc,3);}
        }else if(oh.length>0){hitPoint=oh[0].point.clone();createHitEffect(hitPoint,0xcccccc,3);}

        const trailEnd=hitPoint||origin.clone().add(dir.clone().multiplyScalar(weapon.range));
        createBulletTrail(origin.clone(),trailEnd);
        if(i===0)mwp=origin.clone();
    }
    if(mwp)createMuzzleFlash(mwp);
    weaponGroup.position.z+=0.03;weaponGroup.rotation.x+=0.02;
    setTimeout(()=>{weaponGroup.position.z=0;weaponGroup.rotation.x=0;},40);
    alertEnemies(playerGroup.position,35);
}

function reload(){
    if(S.isReloading)return;const wt=S.weaponSlots[S.currentWeapon];if(!wt)return;
    const weapon=WEAPONS[wt];if(weapon.isMelee)return;
    if(S.magAmmo[S.currentWeapon]>=weapon.magSize)return;
    // Find ammo in quick slots (rig/pockets) first
    const AMMO_ITEM_MAP = { pistol:'pistolAmmo', rifle:'rifleAmmo', shotgun:'shotgunAmmo', smg:'smgAmmo', sniper:'sniperAmmo', heavy:'heavyAmmo' };
    const ammoId = AMMO_ITEM_MAP[weapon.ammo] || null;
    if(!ammoId)return;
    const rigItems = S._rigItems || [];
    const ammoInRig = rigItems.filter(i=>i===ammoId).length;
    const ammoInPocket = S.pockets.filter(i=>i===ammoId).length;
    if(ammoInRig+ammoInPocket<=0)return;
    // Consume from rig first, then pockets
    if(ammoInRig>0){const ri=rigItems.indexOf(ammoId);if(ri>=0)rigItems.splice(ri,1);}
    else{const pi=S.pockets.indexOf(ammoId);if(pi>=0)S.pockets.splice(pi,1);}
    S.isReloading=true;weaponGroup.rotation.x=-0.3;sfxReload();
    const need=weapon.magSize-S.magAmmo[S.currentWeapon];
    S.magAmmo[S.currentWeapon]+=need; // Full reload from quick slot ammo
    setTimeout(()=>{S.isReloading=false;weaponGroup.rotation.x=0;updateWeaponUI();},weapon.reloadTime*1000);
}

function switchWeapon(slot){if(slot<0||slot>3||!S.weaponSlots[slot]||S.isReloading)return;S.currentWeapon=slot;updateWeaponModel();updateWeaponUI();}

function updateWeaponModel(){
    while(weaponGroup.children.length>0)weaponGroup.remove(weaponGroup.children[0]);
    const wt=S.weaponSlots[S.currentWeapon];if(!wt)return;
    const w=WEAPONS[wt];
    if(w.isMelee){
        // Knife model
        const blade=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.15,0.01),new THREE.MeshStandardMaterial({color:0xcccccc,metalness:0.9}));
        blade.position.set(0.2,-0.2,-0.3);weaponGroup.add(blade);
        const handle=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.07,0.03),new THREE.MeshStandardMaterial({color:0x5a3a1a,roughness:0.8}));
        handle.position.set(0.2,-0.32,-0.3);weaponGroup.add(handle);
        return;
    }
    const mat=new THREE.MeshStandardMaterial({color:0x2a2a2a,metalness:0.7,roughness:0.3});
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.1,0.38),mat);body.position.set(0.22,-0.25,-0.38);weaponGroup.add(body);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,0.22,6),new THREE.MeshStandardMaterial({color:0x1a1a1a,metalness:0.85}));barrel.rotation.x=Math.PI/2;barrel.position.set(0.22,-0.22,-0.68);weaponGroup.add(barrel);
    const grip=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.13,0.07),new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:0.7}));grip.position.set(0.22,-0.38,-0.27);weaponGroup.add(grip);
    const mag=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.1,0.05),new THREE.MeshStandardMaterial({color:0x333,metalness:0.5}));mag.position.set(0.22,-0.32,-0.33);weaponGroup.add(mag);
}

function createBulletTrail(from,to){const pts=[from,to];const geo=new THREE.BufferGeometry().setFromPoints(pts);const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xffcc44,transparent:true,opacity:0.6}));scene.add(line);bulletTrails.push({mesh:line,life:4});}
function createMuzzleFlash(pos){const f=new THREE.Mesh(new THREE.SphereGeometry(0.08,6,6),new THREE.MeshBasicMaterial({color:0xffcc00,transparent:true,opacity:1}));f.position.copy(pos);scene.add(f);particles.push({mesh:f,velocity:new THREE.Vector3(),life:3,maxLife:3,type:'flash'});}
function createHitEffect(pos,color,cnt){cnt=Math.min(cnt||4,CONFIG.maxParticles-particles.length);for(let i=0;i<cnt;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(0.04,4,4),new THREE.MeshBasicMaterial({color,transparent:true,opacity:1}));p.position.copy(pos);scene.add(p);particles.push({mesh:p,velocity:new THREE.Vector3((Math.random()-0.5)*0.2,Math.random()*0.2,(Math.random()-0.5)*0.2),life:15,maxLife:15,type:'hit'});}}

// ========== SECTION 10: ENEMIES ==========
function spawnEnemies(){const ec=CONFIG.enemyCount||{normal:7,hard:11};const c=S.mode==='hard'?ec.hard:ec.normal;for(let i=0;i<c;i++)createEnemy();}
function createEnemy(){
    if(enemies.length>=CONFIG.maxEnemies)return;
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
    const grp=new THREE.Group();
    // Level-based visual distinction
    const lvlColors = [
        { body: 0x8b4513, head: 0xa0522d }, // Lv1: Brown (scout)
        { body: 0x5a6a3a, head: 0x6a7a4a }, // Lv2: Olive green (rifleman)
        { body: 0x8b0000, head: 0xc0392b }, // Lv3: Dark red (commander)
    ];
    const elv=S.mode==='hard'?(Math.random()<0.25?3:Math.random()<0.55?2:1):(Math.random()<0.12?2:1);
    const lc=lvlColors[Math.min(elv-1,2)];
    const body=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.45,1.3,8),new THREE.MeshStandardMaterial({color:lc.body,roughness:0.7}));body.position.y=0.95;body.castShadow=true;body.name='body';grp.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.28,8,8),new THREE.MeshStandardMaterial({color:lc.head,roughness:0.5}));head.position.y=1.9;head.castShadow=true;head.name='head';head.userData.isHead=true;grp.add(head);
    // Level shoulder patches
    if(elv>=2){for(let sx of[-0.38,0.38]){const patch=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.05,0.08),new THREE.MeshBasicMaterial({color:elv===3?0xff4444:0xffaa00}));patch.position.set(sx,1.3,0);grp.add(patch);}}
    const hb=new THREE.Mesh(new THREE.SphereGeometry(0.9,8,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0}));hb.position.y=1.3;hb.name='hitbox';grp.add(hb);
    const hbBg=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.08),new THREE.MeshBasicMaterial({color:0x333,side:THREE.DoubleSide}));hbBg.position.y=2.5;grp.add(hbBg);
    const hbFill=new THREE.Mesh(new THREE.PlaneGeometry(0.86,0.06),new THREE.MeshBasicMaterial({color:0x00ff00,side:THREE.DoubleSide}));hbFill.position.y=2.5;hbFill.position.z=0.01;hbFill.name='healthBar';grp.add(hbFill);
    grp.position.set(x,0,z);scene.add(grp);
    const e={mesh:grp,health:45+elv*15,maxHealth:45+elv*15,speed:elv===3?5:elv===2?4.5:4,damage:elv===3?14:elv===2?10:7,attackRange:elv===3?22:18,attackCd:elv===3?1.2:1.6,lastAttack:0,state:'patrol',patrolTarget:{x:x+(Math.random()-0.5)*30,z:z+(Math.random()-0.5)*30},alertTimer:0,lostSightTimer:0,enemyLevel:elv,lootGenerated:false,lootItems:[]};
    enemies.push(e);enemyHitboxes.push(hb);hb.userData.enemy=e;
}

function updateEnemies(dt){
    const now=performance.now()/1000;
    for(let i=enemies.length-1;i>=0;i--){
        const e=enemies[i];const dx=playerGroup.position.x-e.mesh.position.x,dz=playerGroup.position.z-e.mesh.position.z,dist=Math.sqrt(dx*dx+dz*dz);
        if(dist<28&&hasLineOfSight(e,playerGroup.position)){e.state='chase';e.alertTimer=4;e.lostSightTimer=0;}
        else if(e.alertTimer>0){e.alertTimer-=dt;e.state='chase';}
        else if(e.lostSightTimer>5){e.state='patrol';e.lostSightTimer=0;}
        else if(dist>=30&&e.state!=='chase'){e.state='patrol';e.alertTimer=0;}

        if(e.state==='chase'||e.state==='attack'){
            if(dist>e.attackRange*0.75){const sp=e.speed*dt;let nx=e.mesh.position.x+dx/dist*sp;let nz=e.mesh.position.z+dz/dist*sp;
                // Building collision for enemies
                let eBlocked=false;
                for(const o of obstacles){if(o.isAABB){const hw=o.halfW+0.6,hd=o.halfD+0.6,ox=o.mesh.position.x,oz=o.mesh.position.z;if(nx>ox-hw&&nx<ox+hw&&nz>oz-hd&&nz<oz+hd){eBlocked=true;break;}}}
                if(!eBlocked){e.mesh.position.x=nx;e.mesh.position.z=nz;}
            }
            e.mesh.rotation.y=Math.atan2(dx,dz);
            if(dist<e.attackRange&&now-e.lastAttack>e.attackCd&&hasLineOfSight(e,playerGroup.position)){e.lastAttack=now;e.state='attack';enemyShoot(e);}
        }else{
            const tdx=e.patrolTarget.x-e.mesh.position.x,tdz=e.patrolTarget.z-e.mesh.position.z,td=Math.sqrt(tdx*tdx+tdz*tdz);
            if(td<2)e.patrolTarget={x:e.mesh.position.x+(Math.random()-0.5)*30,z:e.mesh.position.z+(Math.random()-0.5)*30};
            else{const sp=e.speed*0.4*dt;e.mesh.position.x+=tdx/td*sp;e.mesh.position.z+=tdz/td*sp;e.mesh.rotation.y=Math.atan2(tdx,tdz);}
        }
        const hb2=CONFIG.mapSize/2-4;e.mesh.position.x=Math.max(-hb2,Math.min(hb2,e.mesh.position.x));e.mesh.position.z=Math.max(-hb2,Math.min(hb2,e.mesh.position.z));
        const hbF=e.mesh.getObjectByName('healthBar');if(hbF)hbF.lookAt(camera.position);
    }
}

function enemyShoot(e){
    const o=new THREE.Vector3(e.mesh.position.x,1.4,e.mesh.position.z);
    const d=new THREE.Vector3(playerGroup.position.x-o.x,1.7-o.y,playerGroup.position.z-o.z).normalize();
    d.x+=(Math.random()-0.5)*0.08;d.y+=(Math.random()-0.5)*0.08;d.normalize();
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
    // Only use weapon keys that actually exist in WEAPONS
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
        if (ITEMS[sw+'_item']) items.push({ id: sw+'_item', taken: false });
        const ammoCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < ammoCount; i++) items.push({ id: 'pistolAmmo', taken: false });
        for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) items.push({ id: commonLoot[Math.floor(Math.random() * commonLoot.length)], taken: false });
        items.push({ id: medItems[Math.floor(Math.random() * medItems.length)], taken: false });
    } else if (lv === 2) {
        // Rifleman - SMG/shotgun + armor + medium loot
        const pw = primaryGuns[Math.floor(Math.random() * primaryGuns.length)];
        if (ITEMS[pw+'_item']) items.push({ id: pw+'_item', taken: false });
        else items.push({ id: 'mp5_item', taken: false });
        const sw = secondaryGuns[Math.floor(Math.random() * secondaryGuns.length)];
        if (ITEMS[sw+'_item']) items.push({ id: sw+'_item', taken: false });
        // Ammo
        const weaponDef = WEAPONS[pw];
        const ammoType = weaponDef ? weaponDef.ammo + 'Ammo' : 'rifleAmmo';
        const secAmmoType = 'pistolAmmo';
        if (ITEMS[ammoType]) for (let i = 0; i < 3; i++) items.push({ id: ammoType, taken: false });
        for (let i = 0; i < 2; i++) items.push({ id: secAmmoType, taken: false });
        // Armor
        if (Math.random() < 0.4) items.push({ id: armorItems[Math.floor(Math.random() * armorItems.length)], taken: false });
        // Loot
        for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
            items.push({ id: (Math.random() < 0.3 ? rareLoot : commonLoot)[Math.floor(Math.random() * ((Math.random() < 0.3 ? rareLoot : commonLoot).length))], taken: false });
        }
        items.push({ id: medItems[Math.floor(Math.random() * medItems.length)], taken: false });
        items.push({ id: medItems[Math.floor(Math.random() * medItems.length)], taken: false });
    } else {
        // Commander - high tier weapon + full gear
        const hw = highValueGuns[Math.floor(Math.random() * highValueGuns.length)];
        if (ITEMS[hw+'_item']) items.push({ id: hw+'_item', taken: false });
        else items.push({ id: 'hk416_item', taken: false }); // Fallback to HK416
        // Secondary (higher tier)
        const hwDef = WEAPONS[hw];
        const ammoType = hwDef ? hwDef.ammo + 'Ammo' : 'rifleAmmo';
        if (ITEMS[ammoType]) for (let i = 0; i < 5; i++) items.push({ id: ammoType, taken: false });
        for (let i = 0; i < 4; i++) items.push({ id: 'pistolAmmo', taken: false });
        // Full armor
        items.push({ id: 'tier4_armor', taken: false });
        if (Math.random() < 0.5) items.push({ id: 'tier4_helmet', taken: false });
        // High value loot
        for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
            items.push({ id: rareLoot[Math.floor(Math.random() * rareLoot.length)], taken: false });
        }
        items.push({ id: 'surgeryKit', taken: false });
        items.push({ id: 'adrenaline', taken: false });
        if (Math.random() < 0.2) items.push({ id: 'gpu', taken: false });
        if (Math.random() < 0.1) items.push({ id: 'diamond', taken: false });
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
    
    // Build container data
    const gridW = 4, gridH = Math.min(2 + level, 4);
    const grid = initGrid(gridH);
    for (const li of (lootItems || [])) {
        const def = ITEMS[li.id];
        if (!def) continue;
        const slot = findFreeSlot(grid, gridW, gridH, li.id);
        if (slot) placeInGrid(grid, gridW, li.id, slot.col, slot.row);
    }
    const ci = grid._items || [];
    const items = ci.map(e => ({ ...ITEMS[e.id], type: e.id, taken: false, gridEntry: e }));
    const container = {
        mesh: grp, type: 'enemyLoot', name: '敌人物资盒', icon: '📦',
        x, z, items, grid, gridW, gridH,
        searchTime: 0.8, searched: false, isEnemyLoot: true,
    };
    containers.push(container);
}

function killEnemy(e, headshot){
    createHitEffect(new THREE.Vector3(e.mesh.position.x,1.3,e.mesh.position.z),0xff0000,10);
    sfxKillEnemy();
    // Generate and spawn enemy loot box
    if(!e.lootGenerated)generateEnemyLoot(e);
    spawnEnemyLootBox(e.mesh.position.x, e.mesh.position.z, e.lootItems, e.enemyLevel);
    // Stats
    S.kills++;P.stats.kills++;addKillFeed();
    trackMission('kill_any', 1);
    const ei=enemies.indexOf(e);if(ei>=0)enemies.splice(ei,1);
    const hi=enemyHitboxes.findIndex(h=>h.userData.enemy===e);if(hi>=0)enemyHitboxes.splice(hi,1);
    scene.remove(e.mesh);
    setTimeout(()=>{if(S.phase==='playing')createEnemy();},5000+Math.random()*4000);
}
function alertEnemies(pos,r){for(const e of enemies){const dx=e.mesh.position.x-pos.x,dz=e.mesh.position.z-pos.z;if(dx*dx+dz*dz<r*r){e.state='chase';e.alertTimer=3;}}}
function hasLineOfSight(enemy,tp){const o=new THREE.Vector3(enemy.mesh.position.x,1.5,enemy.mesh.position.z);const d=tp.clone().sub(o).normalize();const dist=o.distanceTo(tp);enemyRaycaster.set(o,d);enemyRaycaster.far=dist;const h=enemyRaycaster.intersectObjects(obstacles.map(o=>o.mesh),true);return h.length===0||h[0].distance>dist-0.5;}

function updateEnemyBullets(){
    for(let i=bulletTrails.length-1;i>=0;i--){const bt=bulletTrails[i];if(!bt.isBullet)continue;bt.life--;const bd=bt.bulletData;bd.pos.add(bd.velocity);if(bt.mesh)bt.mesh.position.copy(bd.pos);
        const dx=bd.pos.x-playerGroup.position.x,dz=bd.pos.z-playerGroup.position.z,dy=bd.pos.y-1.7;
        if(dx*dx+dz*dz+dy*dy<0.7){damagePlayer(bd.damage);createHitEffect(bd.pos.clone(),0xff0000,3);scene.remove(bt.mesh);bulletTrails.splice(i,1);continue;}
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
    const placedPositions = []; // Track where containers have been placed
    for (const pos of positions) {
        let cx=pos.x, cz=pos.z;
        // Push container outside building footprints if overlapping
        for (const b of FIXED_BUILDINGS) {
            const bx=b.x, bz=b.z, hw=b.w/2, hd=b.d/2;
            if (cx>bx-hw&&cx<bx+hw&&cz>bz-hd&&cz<bz+hd) {
                const distToLeft=cx-(bx-hw), distToRight=(bx+hw)-cx;
                const distToTop=cz-(bz-hd), distToBottom=(bz+hd)-cz;
                const minH=Math.min(distToLeft,distToRight), minV=Math.min(distToTop,distToBottom);
                if(minH<minV){
                    cx=(distToLeft<distToRight)?(bx-hw-2):(bx+hw+2);
                }else{
                    cz=(distToTop<distToBottom)?(bz-hd-2):(bz+hd+2);
                }
            }
        }
        if (isPointBlockedByMap(cx, cz, 0.5)) {
            const w = ((MAP_DATA && MAP_DATA.waterAreas) || []).find(wa =>
                cx > wa.x - wa.w / 2 && cx < wa.x + wa.w / 2 && cz > wa.z - wa.d / 2 && cz < wa.z + wa.d / 2
            );
            if (w) {
                const dx = cx - w.x, dz = cz - w.z;
                if (Math.abs(dx) / w.w > Math.abs(dz) / w.d) cx = w.x + (dx > 0 ? 1 : -1) * (w.w / 2 + 2);
                else cz = w.z + (dz > 0 ? 1 : -1) * (w.d / 2 + 2);
            }
        }
        // Check overlap with already-placed containers
        let adjusted=false;
        for (const pp of placedPositions) {
            const dx=cx-pp.x, dz=cz-pp.z;
            if (Math.abs(dx)<MIN_CONTAINER_DIST&&Math.abs(dz)<MIN_CONTAINER_DIST) {
                // Push away from the existing container
                const dist=Math.sqrt(dx*dx+dz*dz);
                if (dist<0.01) { cx+=MIN_CONTAINER_DIST; cz+=0; }
                else {
                    const pushDist=MIN_CONTAINER_DIST-dist;
                    const nx=dx/dist, nz=dz/dist;
                    cx+=nx*pushDist; cz+=nz*pushDist;
                }
                adjusted=true;
            }
        }
        placedPositions.push({x:cx, z:cz});
        createContainer(pos.type, cx, cz);
    }
}

function createContainer(type, x, z){
    const def = CONTAINER_TYPES[type];
    const grp = new THREE.Group();

    // Different 3D models based on container shape
    const shape = def.shape || 'crate';

    if (shape === 'long') {
        // Weapon box: long rectangular military crate (green)
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.9), new THREE.MeshStandardMaterial({color:def.color, roughness:0.6, metalness:0.2}));
        body.position.y=0.3; body.castShadow=body.receiveShadow=true; grp.add(body);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.1, 0.95), new THREE.MeshStandardMaterial({color:0x2a4a2a, roughness:0.5}));
        lid.position.y=0.65; grp.add(lid);
        // Ammo marking stripe
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 0.1), new THREE.MeshBasicMaterial({color:0xffcc00}));
        stripe.position.set(0, 0.61, 0.45); grp.add(stripe);
        // Latches
        for (let lx of [-0.7, 0, 0.7]) {
            const latch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.08), new THREE.MeshStandardMaterial({color:0x999999, metalness:0.8}));
            latch.position.set(lx, 0.62, 0.47); grp.add(latch);
        }
    } else if (shape === 'cube') {
        // Medical box: white cube with red cross
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.9), new THREE.MeshStandardMaterial({color:def.color, roughness:0.4, metalness:0.1}));
        body.position.y=0.45; body.castShadow=body.receiveShadow=true; grp.add(body);
        // Red cross on top
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 0.7), new THREE.MeshBasicMaterial({color:0xff0000}));
        crossH.position.set(0, 0.91, 0); grp.add(crossH);
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.25), new THREE.MeshBasicMaterial({color:0xff0000}));
        crossV.position.set(0, 0.91, 0); grp.add(crossV);
        // Handle
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), new THREE.MeshStandardMaterial({color:0xcccccc, metalness:0.6}));
        handle.rotation.x = Math.PI/2; handle.position.set(0, 0.92, 0); grp.add(handle);
    } else if (shape === 'tall') {
        // Equipment case: dark gray tall Pelican-style case
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.7), new THREE.MeshStandardMaterial({color:def.color, roughness:0.3, metalness:0.5}));
        body.position.y=0.55; body.castShadow=body.receiveShadow=true; grp.add(body);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.72), new THREE.MeshStandardMaterial({color:0x222222, metalness:0.7}));
        trim.position.y=0.02; grp.add(trim);
        // Corner protectors
        for (let cx of [-0.42, 0.42]) { for (let cz of [-0.32, 0.32]) {
            const cp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshStandardMaterial({color:0x333333, metalness:0.8}));
            cp.position.set(cx, 0.04, cz); grp.add(cp);
        }}
    } else if (shape === 'safe') {
        // Safe/lockbox: small metal box with gold trim (high value indicator)
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshStandardMaterial({color:0x3a3a3a, roughness:0.2, metalness:0.8}));
        body.position.y=0.35; body.castShadow=true; grp.add(body);
        // Gold trim
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, 0.75), new THREE.MeshStandardMaterial({color:0xffd700, roughness:0.3, metalness:0.9, emissive:0x332200, emissiveIntensity:0.3}));
        trim.position.y=0.04; grp.add(trim);
        // Dial
        const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16), new THREE.MeshStandardMaterial({color:0xffd700, metalness:0.9}));
        dial.position.set(0.25, 0.35, 0.35); grp.add(dial);
        // Keyhole
        const keyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8), new THREE.MeshBasicMaterial({color:0x111111}));
        keyhole.position.set(0, 0.35, 0.35); grp.add(keyhole);
    } else if (shape === 'small') {
        // Ammo box: small red/brown metal box
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), new THREE.MeshStandardMaterial({color:def.color, roughness:0.5, metalness:0.4}));
        body.position.y=0.25; body.castShadow=body.receiveShadow=true; grp.add(body);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.08, 0.64), new THREE.MeshStandardMaterial({color:0x4a2020, roughness:0.3, metalness:0.5}));
        lid.position.y=0.53; grp.add(lid);
    } else if (shape === 'premium') {
        // Premium box: glowing gold crate
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.0), new THREE.MeshStandardMaterial({color:0x4a3a1a, roughness:0.3, metalness:0.6}));
        body.position.y=0.5; body.castShadow=true; grp.add(body);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.12, 1.04), new THREE.MeshStandardMaterial({color:0xffd700, roughness:0.2, metalness:0.9, emissive:0x332200, emissiveIntensity:0.4}));
        lid.position.y=1.04; grp.add(lid);
        // Corner gems
        for (let gx of [-0.55, 0.55]) { for (let gz of [-0.35, 0.35]) {
            const gem = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({color:0xff4444}));
            gem.position.set(gx, 0.52, gz); grp.add(gem);
        }}
    } else {
        // Supply crate: standard wooden crate
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), new THREE.MeshStandardMaterial({color:def.color, roughness:0.7, metalness:0.1}));
        body.position.y=0.45; body.castShadow=body.receiveShadow=true; grp.add(body);
        // Wood plank lines
        for (let py of [0.3, 0.45, 0.6]) {
            const plank = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.02, 0.82), new THREE.MeshStandardMaterial({color:0x6a4a14, roughness:0.6}));
            plank.position.y=py; grp.add(plank);
        }
    }

    // Glow ring (all containers) - color indicates value tier
    const glowColor = (shape === 'safe' || shape === 'premium') ? 0xffd700 : (shape === 'tall' || shape === 'long') ? 0x4a90d9 : 0x888888;
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 16), new THREE.MeshBasicMaterial({color:glowColor, transparent:true, opacity:0.3+(shape==='premium'?0.2:0)+(shape==='safe'?0.15:0), side:THREE.DoubleSide}));
    glow.rotation.x = -Math.PI/2; glow.position.y = 0.03; grp.add(glow);

    grp.position.set(x, 0, z); scene.add(grp);

    const cnt = def.min + Math.floor(Math.random()*(def.max-def.min+1));
    const containerGrid = initGrid(def.h||3);
    for (let i=0; i<cnt; i++) {
        const it = def.items[Math.floor(Math.random()*def.items.length)];
        const slot = findFreeSlot(containerGrid, def.w||5, def.h||3, it);
        if (slot) placeInGrid(containerGrid, def.w||5, it, slot.col, slot.row);
    }
    const ci = containerGrid._items || [];
    const items = ci.map(e => ({...ITEMS[e.id], type:e.id, taken:false, gridEntry:e}));

    containers.push({mesh:grp, type, name:def.name, icon:def.icon, x, z, items, grid:containerGrid, gridW:def.w||5, gridH:def.h||3, searchTime:def.searchTime||1.5, searched:false});
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
    searchAnimData = { container, progress: 0, duration: 0.5 };
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
        const overlay = document.getElementById('searchProgressOverlay');
        if (overlay) overlay.style.display = 'none';
        sfxSearchComplete();
        if (document.pointerLockElement) document.exitPointerLock();
        if (!container.searched) { container.searched = true; S.containersSearched++; trackMission('search_containers',1); }

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

function checkNearbyContainers(){
    let nearest=null,nd=2.8*2.8;
    for(const c of containers){const dx=playerGroup.position.x-c.x,dz=playerGroup.position.z-c.z,d=dx*dx+dz*dz;if(d<nd){nd=d;nearest=c;}}
    const prompt=document.getElementById('searchPrompt');
    if(nearest){prompt.style.display='block';document.getElementById('promptTitle').textContent=nearest.name+(nearest.searched?' (已搜索)':'');}
    else prompt.style.display='none';
}

function interact(){
    if(S.phase!=='playing')return;
    // Check ground loot first (immediate pickup)
    const nearGL = checkNearbyGroundLoot();
    if (nearGL) { pickupGroundLoot(nearGL); return; }
    // Check extraction
    if(extractPoints&&extractPoints.length>0&&!S.isExtracting){
        for(const ep of extractPoints){const dx=playerGroup.position.x-ep.x,dz=playerGroup.position.z-ep.z;if(dx*dx+dz*dz<ep.radius*ep.radius){startExtraction();return;}}
    }
    // Check containers - open directly (per-item reveal in grid)
    let nearest=null,nd=2.8*2.8;
    for(const c of containers){const dx=playerGroup.position.x-c.x,dz=playerGroup.position.z-c.z,d=dx*dx+dz*dz;if(d<nd){nd=d;nearest=c;}}
    if(nearest)openSearch(nearest);
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
    if(document.pointerLockElement)document.exitPointerLock();
    if(!container.searched){container.searched=true;S.containersSearched++;}

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
    const colW=60,rowH=60;
    cGrid.style.gridTemplateColumns=`repeat(${container.gridW},${colW}px)`;
    cGrid.style.gridTemplateRows=`repeat(${container.gridH},${rowH}px)`;

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
            el.innerHTML=`<div class="search-content" style="display:flex;flex-direction:column;align-items:center;width:100%;height:100%;justify-content:center;"><div class="gi-icon">${def.icon}</div><div class="gi-name">${def.name}</div><div class="gi-value">₵${def.value}</div></div>`;
            el.title='双击或拖拽拾取';
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
    if(ct){ct.style.display='flex';ct.querySelector('.gi-icon').textContent=def.icon;ct.querySelector('.gi-name').textContent=def.name;ct.querySelector('.gi-value').textContent='₵'+def.value;}

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
        if(!S.equipment.chestRig){S.equipment.chestRig=type;S.maxPockets=5+def.slots;return true;}
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
                    cell.textContent = def.icon;
                    cell.title = def.name + ' - 双击放回容器';
                    cell.style.cursor = 'pointer';
                    cell.ondblclick = function () {
                        // Move from backpack/secure to container
                        const container2 = S.currentSearchContainer;
                        if (!container2) return;
                        const slot = findFreeSlot(container2.grid, container2.gridW, container2.gridH, entry.id);
                        if (slot) {
                            removeFromGrid(grid, entry);
                            if (gridType === 'backpack') S.lootValue = Math.max(0, S.lootValue - def.value);
                            placeInGrid(container2.grid, container2.gridW, entry.id, slot.col, slot.row);
                            container2._revealed.push(true);
                            container2.items.push({ ...def, type: entry.id, taken: false, gridEntry: { col: slot.col, row: slot.row, id: entry.id } });
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
    const colW=56,rowH=56;
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
                        item.taken=true;
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
                            item.taken=true;placeInGrid(S.backpack,S.backpackCols,item.type,dropCol,dropRow);
                            S.lootValue+=def.value;
                            if(autoEquipLoot(item.type)){const placed=S.backpack._items[S.backpack._items.length-1];removeFromGrid(S.backpack,placed);}
                            S._lootItems=S._lootItems||[];S._lootItems.push({id:item.type,name:def.name,value:def.value,rarity:def.rarity});
                            sfxPickup(def.rarity);
                            // Put displaced item back in container
                            removeFromGrid(container.grid,item.gridEntry);
                            placeInGrid(container.grid,container.gridW,existing.id,item.gridEntry.col,item.gridEntry.row);
                            container._revealed.push(true);
                            container.items.push({...exDef,type:existing.id,taken:false,gridEntry:{col:item.gridEntry.col,row:item.gridEntry.row,id:existing.id}});
                        }else{
                            // Try secure container
                            const ss=findFreeSlot(S.secureContainer,S.secureCols,S.secureRows,item.type);
                            if(ss){item.taken=true;placeInGrid(S.secureContainer,S.secureCols,item.type,ss.col,ss.row);S.lootValue+=def.value;
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
        el.draggable=true;
        el.style.gridColumn=(entry.col+1)+'/span '+def.w;el.style.gridRow=(entry.row+1)+'/span '+def.h;
        el.innerHTML=`<div class="gi-icon">${def.icon}</div><div class="gi-name">${def.name}</div><div class="gi-value">₵${def.value}</div>`;
        el.title='双击移回容器 | 拖拽整理 | 右键丢弃';
        el.ondblclick=function(){
            // Move backpack item back to container
            const container=S.currentSearchContainer;
            if(!container)return;
            const slot=findFreeSlot(container.grid,container.gridW,container.gridH,entry.id);
            if(slot){
                removeFromGrid(S.backpack,entry);S.lootValue=Math.max(0,S.lootValue-def.value);
                if(S._lootItems){const li=S._lootItems.findIndex(l=>l.id===entry.id);if(li>=0)S._lootItems.splice(li,1);}
                placeInGrid(container.grid,container.gridW,entry.id,slot.col,slot.row);
                container._revealed.push(true);
                container.items.push({...def,type:entry.id,taken:false,gridEntry:{col:slot.col,row:slot.row,id:entry.id}});
                renderSearchGrid(container);updateSearchValue();updateHUD();updateWeaponUI();
            }
        };
        el.ondragstart=function(e){onDragStart('backpack',idx);el.classList.add('dragging');};
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
            item.taken = true;
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

    // Auto-place: backpack first, then secure container
    let slot=findFreeSlot(S.backpack,S.backpackCols,S.backpackRows,item.type);
    let tg=S.backpack,tc=S.backpackCols,tr=S.backpackRows;
    if(!slot){slot=findFreeSlot(S.secureContainer,S.secureCols,S.secureRows,item.type);tg=S.secureContainer;tc=S.secureCols;tr=S.secureRows;}
    if(!slot){alert('背包和安全箱都已满！');return;}

    item.taken=true;
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
    document.getElementById('searchScreen').style.display='none';
    document.getElementById('searchProgressOverlay').style.display='none';
    document.getElementById('gameCanvas').requestPointerLock();
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
        extractPoints.push({mesh:grp, x:ep.x, z:ep.z, name:ep.name, desc:ep.desc, radius:3.5});
    }
}

function checkExtractZone(){
    if (!extractPoints || extractPoints.length === 0) return;
    let nearest = null, nearestDist = Infinity;
    for (const ep of extractPoints) {
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
function getStashItemCount(itemId){if(!P.stashGrid._items)return 0;return P.stashGrid._items.filter(e=>e.id===itemId).length;}
function canAfford(price){return P.money>=price;}

function buyItem(itemId){
    const sp=SHOP_PRICES[itemId];if(!sp||!canAfford(sp.buy))return false;
    const slot=findFreeSlot(P.stashGrid,CONFIG.STASH_COLS,CONFIG.STASH_ROWS,itemId);
    if(!slot){alert('仓库空间不足！');return false;}
    P.money-=sp.buy;placeInGrid(P.stashGrid,CONFIG.STASH_COLS,itemId,slot.col,slot.row);
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
    document.getElementById('healthFill').style.width=(S.health/S.maxHealth*100)+'%';document.getElementById('healthValue').textContent=Math.ceil(S.health);
    const armorHP=S.equipment.armorHP||0;const maxArmor=S.equipment.armor?ITEMS[S.equipment.armor].amount:100;
    document.getElementById('armorFill').style.width=(armorHP/maxArmor*100)+'%';document.getElementById('armorValue').textContent=Math.ceil(armorHP);
    document.getElementById('staminaFill').style.width=(S.stamina/CONFIG.maxStamina*100)+'%';document.getElementById('staminaValue').textContent=Math.ceil(S.stamina);
    // Stamina bar turns red when exhausted
    const sf=document.getElementById('staminaFill');
    if(S._staminaExhausted) sf.style.background='linear-gradient(90deg,#f44336,#e57373)';
    else if(S.stamina<30) sf.style.background='linear-gradient(90deg,#ff9800,#ffb74d)';
    else sf.style.background='linear-gradient(90deg,#4caf50,#81c784)';
    // Show pocket counts
    const pMeds=S.pockets.filter(p=>p==='medkit').length;const pBand=S.pockets.filter(p=>p==='bandage').length;const pPain=S.pockets.filter(p=>p==='painkiller').length;
    // Quick slot counts (rig + pockets)
    const rigM=S._rigItems||[];const allQuick=[...rigM,...S.pockets];
    document.getElementById('medkitCount').textContent=allQuick.filter(i=>i==='medkit').length;
    document.getElementById('bandageCount').textContent=allQuick.filter(i=>i==='bandage').length;
    document.getElementById('painkillerCount').textContent=allQuick.filter(i=>i==='painkiller').length;
    document.getElementById('grenadeCount').textContent='0';
}

function updateWeaponUI(){
    for(let i=0;i<4;i++){const slot=document.getElementById('weaponSlot'+(i+1));
        if(S.weaponSlots[i]){slot.classList.add('has-weapon');slot.querySelector('.weapon-icon').textContent=WEAPONS[S.weaponSlots[i]].icon;slot.querySelector('.weapon-name').textContent=WEAPONS[S.weaponSlots[i]].name;}
        else{slot.classList.remove('has-weapon');slot.querySelector('.weapon-icon').textContent='—';slot.querySelector('.weapon-name').textContent='空';}
        slot.classList.toggle('active',i===S.currentWeapon);
    }
    const w=S.weaponSlots[S.currentWeapon]?WEAPONS[S.weaponSlots[S.currentWeapon]]:null;
    if(w&&!w.isMelee){document.getElementById('magAmmo').textContent=S.magAmmo[S.currentWeapon];document.getElementById('reserveAmmo').textContent=S.reserveAmmo[w.ammo]||0;document.getElementById('ammoType').textContent=w.name;}
    else if(w&&w.isMelee){document.getElementById('magAmmo').textContent='∞';document.getElementById('reserveAmmo').textContent='—';document.getElementById('ammoType').textContent='匕首';}
    else{document.getElementById('magAmmo').textContent='-';document.getElementById('reserveAmmo').textContent='-';document.getElementById('ammoType').textContent='无武器';}
}

function updateTimer(){
    if(S.phase!=='playing')return;const elapsed=performance.now()/1000-S.startTime,remain=Math.max(0,S.gameTime-elapsed);
    const m=Math.floor(remain/60),s=Math.floor(remain%60);
    const disp=document.getElementById('timerDisplay');disp.textContent=m.toString().padStart(2,'0')+':'+s.toString().padStart(2,'0');disp.classList.toggle('warning',remain<60);
    if(remain<=0)endGame(false);
    // Track survive_time every ~1s
    S._surviveTimer=(S._surviveTimer||0)+1;
    if(S._surviveTimer>=60){S._surviveTimer=0;trackMission('survive_time',1);}
}

function addKillFeed(){const feed=document.getElementById('killFeed');const div=document.createElement('div');div.className='kill-item';div.textContent='击杀 敌人 '+(S.kills);feed.appendChild(div);setTimeout(()=>div.remove(),3000);}

function updateMinimap(){
    const canvas=document.getElementById('minimapCanvas');if(!canvas)return;
    const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,scale=w/CONFIG.mapSize;
    const px=playerGroup.position.x,pz=playerGroup.position.z;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(0,0,0,0.5)';ctx.beginPath();ctx.arc(w/2,h/2,w/2-1,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.beginPath();ctx.arc(w/2,h/2,w/2-2,0,Math.PI*2);ctx.clip();
    for(const wa of ((MAP_DATA&&MAP_DATA.waterAreas)||[])){
        ctx.fillStyle='rgba(26,74,106,0.55)';
        ctx.fillRect(w/2+(wa.x-wa.w/2-px)*scale,h/2+(wa.z-wa.d/2-pz)*scale,wa.w*scale,wa.d*scale);
    }
    for(const b of FIXED_BUILDINGS){
        ctx.fillStyle='rgba(80,80,80,0.75)';
        ctx.fillRect(w/2+(b.x-b.w/2-px)*scale,h/2+(b.z-b.d/2-pz)*scale,b.w*scale,b.d*scale);
    }
    for(const zone of MAP_ZONES){
        ctx.strokeStyle=zone.color||'#666';ctx.lineWidth=1;ctx.globalAlpha=0.35;
        const zx=w/2+(zone.x-px)*scale,zy=h/2+(zone.z-pz)*scale,r=(zone.radius||14)*scale;
        ctx.beginPath();ctx.arc(zx,zy,r,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
    }
    ctx.fillStyle='#ff4444';for(const e of enemies){const ex=w/2+(e.mesh.position.x-px)*scale,ey=h/2+(e.mesh.position.z-pz)*scale;ctx.beginPath();ctx.arc(ex,ey,2.5,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#4a90d9';for(const c of containers){const cx=w/2+(c.x-px)*scale,cy=h/2+(c.z-pz)*scale;ctx.fillRect(cx-1,cy-1,2,2);}
    // Ground loot markers (color-coded by rarity)
    for(const gl of groundLootItems){if(gl.taken)continue;const gx=w/2+(gl.x-px)*scale,gy=h/2+(gl.z-pz)*scale;ctx.fillStyle=RARITY[gl.rarity]?.color||'#fff';ctx.beginPath();ctx.arc(gx,gy,2.5,0,Math.PI*2);ctx.fill();}
    if(extractPoints&&extractPoints.length>0){for(const ep of extractPoints){ctx.fillStyle='#ff9800';const ex=w/2+(ep.x-px)*scale,ey=h/2+(ep.z-pz)*scale;ctx.beginPath();ctx.arc(ex,ey,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ff9800';ctx.lineWidth=1;ctx.stroke();}}
    ctx.restore();
    ctx.fillStyle='#4caf50';ctx.beginPath();const pa=w/2,py=h/2;const angle=mouseX-Math.PI/2;ctx.moveTo(pa+Math.cos(angle)*6,py+Math.sin(angle)*6);ctx.lineTo(pa+Math.cos(angle+2.5)*4,py+Math.sin(angle+2.5)*4);ctx.lineTo(pa+Math.cos(angle-2.5)*4,py+Math.sin(angle-2.5)*4);ctx.closePath();ctx.fill();
}

// ========== SECTION 15: LOBBY UI ==========
function switchLobbyTab(tab){
    const tabs=['action','loadout','inventory','shop','missions','stats','mail'];
    document.querySelectorAll('.lobby-menu li').forEach((li,i)=>li.classList.toggle('active',tabs[i]===tab));
    document.querySelectorAll('.lobby-section').forEach(s=>s.classList.remove('active'));
    document.getElementById('tab-'+tab).classList.add('active');
    if(tab==='inventory'){renderAllInventory();renderStashGrid();}
    if(tab==='shop')renderShopTab();
    if(tab==='mail')renderMailTab();
    if(tab==='missions')renderMissionTab(currentMissionTab||'daily');
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
    const s = findFreeSlot(P.stashGrid, CONFIG.STASH_COLS, CONFIG.STASH_ROWS, itemId);
    if (s) { placeInGrid(P.stashGrid, CONFIG.STASH_COLS, itemId, s.col, s.row); return true; }
    P.mailItems = P.mailItems || []; P.mailItems.push(itemId); return false;
}

function updateAllLobbyUI(){
    document.getElementById('lobbyMoney').textContent=P.money.toLocaleString();
    document.getElementById('statKills').textContent=P.stats.kills;
    document.getElementById('statExtracts').textContent=P.stats.extracts;
    document.getElementById('statValue').textContent='₵'+P.stats.totalValue.toLocaleString();
    document.getElementById('statGames').textContent=P.stats.games;
    let sv=0;if(P.stashGrid._items)for(const e of P.stashGrid._items){const def=ITEMS[e.id];if(def)sv+=def.value;}
    const svEl=document.getElementById('stashValue');if(svEl)svEl.textContent=sv.toLocaleString();
    const svSidebar=document.getElementById('stashValueSidebar');if(svSidebar)svSidebar.textContent=sv.toLocaleString();
    // Mail badge
    const mb=document.getElementById('mailBadge');if(mb){const mc=(P.mailItems||[]).length;mb.textContent=mc;mb.style.display=mc>0?'inline':'none';}
}

function renderMailTab(){
    const container=document.getElementById('mailItems');if(!container)return;
    const items=P.mailItems||[];
    if(items.length===0){container.innerHTML='<p style="color:#8b949e;">📭 邮箱为空</p>';return;}
    let h='<div class="inv-grid">';
    for(let i=0;i<items.length;i++){
        const def=ITEMS[items[i]];if(!def)continue;
        h+='<div class="inv-item rarity-'+def.rarity+'" style="cursor:pointer;" title="双击领取到仓库" ondblclick="claimMailItem('+i+')">'+def.icon+'<div class="item-name">'+def.name+'</div></div>';
    }
    h+='</div>';
    container.innerHTML=h;
}

function claimMailItem(idx){
    const items=P.mailItems||[];if(idx>=items.length)return;
    const itemId=items[idx];
    const s=findFreeSlot(P.stashGrid,CONFIG.STASH_COLS,CONFIG.STASH_ROWS,itemId);
    if(!s){alert('仓库空间不足！');return;}
    placeInGrid(P.stashGrid,CONFIG.STASH_COLS,itemId,s.col,s.row);
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
};
const MISSION_REWARDS = { daily: { money: 50000 }, weekly: { money: 300000 }, faction: { money: 1000000 } };
const MISSION_POOL = {
    daily: [
        { type: 'kill_any', target: 8 }, { type: 'kill_headshot', target: 3 },
        { type: 'extract_success', target: 2 }, { type: 'search_containers', target: 10 },
        { type: 'earn_money', target: 200000 },
    ],
    weekly: [
        { type: 'kill_any', target: 30 }, { type: 'extract_success', target: 5 },
        { type: 'survive_time', target: 1800 }, { type: 'extract_value', target: 1 },
    ],
    faction: [
        { type: 'kill_any', target: 50, desc: '击杀50名敌人' },
        { type: 'earn_money', target: 1000000, desc: '累计带出₵1,000,000' },
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
                <div style="color:#6e7681;font-size:10px;">奖励: ₵${reward.money}</div></div>
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
    P.money += reward.money; P.xp = (P.xp||0) + (tab==='faction'?2000:tab==='weekly'?500:100);
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
    if (slotType === 'chestRig' && def.type === 'chestRig') { S.equipment.chestRig = itemId; S.maxPockets = 5 + def.slots; return true; }
    if (slotType === 'backpack' && def.type === 'backpack') { S.equipment.backpack = itemId; S.backpackCols = def.bCols; S.backpackRows = def.bRows; S.backpack = initGrid(def.bRows); return true; }
    return false;
}

function clearEquipSlot(slotType) {
    if (slotType === 'primary1') { S.weaponSlots[0] = null; S.magAmmo[0] = 0; }
    else if (slotType === 'primary2') { S.weaponSlots[1] = null; S.magAmmo[1] = 0; }
    else if (slotType === 'secondary') { S.weaponSlots[2] = null; S.magAmmo[2] = 0; }
    else if (slotType === 'armor') { S.equipment.armor = null; S.equipment.armorHP = 0; }
    else if (slotType === 'helmet') { S.equipment.helmet = null; S.equipment.helmetHP = 0; }
    else if (slotType === 'chestRig') { S.equipment.chestRig = null; S.maxPockets = 5; }
    else if (slotType === 'backpack') { S.equipment.backpack = null; S.backpackCols = 0; S.backpackRows = 0; S.backpack = initGrid(1); }
}

function handleEquipDrop(slotType, e) {
    const dt = e.dataTransfer.getData('text/plain');
    if (!dt || !dt.startsWith('stash:')) return;
    const entryIdx = parseInt(dt.split(':')[1]);
    if (isNaN(entryIdx) || !P.stashGrid._items || entryIdx >= P.stashGrid._items.length) return;
    const entry = P.stashGrid._items[entryIdx];
    if (!entry) return;
    const existingId = getEquipItemId(slotType);
    if (existingId) { const s = findFreeSlot(P.stashGrid, CONFIG.STASH_COLS, CONFIG.STASH_ROWS, existingId); if (!s) { alert('仓库空间不足！'); return; } placeInGrid(P.stashGrid, CONFIG.STASH_COLS, existingId, s.col, s.row); clearEquipSlot(slotType); }
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
    if (existingId) { const s = findFreeSlot(P.stashGrid, CONFIG.STASH_COLS, CONFIG.STASH_ROWS, existingId); if (!s) { alert('仓库空间不足！'); return; } placeInGrid(P.stashGrid, CONFIG.STASH_COLS, existingId, s.col, s.row); clearEquipSlot(slotType); }
    const entry = P.stashGrid._items ? P.stashGrid._items.find(e => e.id === itemId) : null;
    if (!entry) return;
    if (setEquipItem(slotType, itemId)) { removeFromGrid(P.stashGrid, entry); }
    savePersistent(); renderAllInventory(); renderStashGrid(); updateAllLobbyUI();
}

function unequipItem(slotType) {
    const itemId = getEquipItemId(slotType); if (!itemId) return;
    const s = findFreeSlot(P.stashGrid, CONFIG.STASH_COLS, CONFIG.STASH_ROWS, itemId); if (!s) { alert('仓库空间不足！'); return; }
    placeInGrid(P.stashGrid, CONFIG.STASH_COLS, itemId, s.col, s.row); clearEquipSlot(slotType);
    savePersistent(); renderAllInventory(); renderStashGrid(); updateAllLobbyUI();
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
        if (def) { cell.classList.add('equipped', 'rarity-' + (def.rarity || 'common')); cell.style.fontSize = '22px'; cell.textContent = def.icon; cell.title = def.name + ' - 右键卸下'; }
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
    if (wd) { let tw = 0; for (const e of (P.stashGrid._items || [])) { const d = ITEMS[e.id]; if (d) tw += d.w * d.h; } wd.textContent = '负重 ' + tw + '/70 kg'; }
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
    div.style.gridTemplateColumns = 'repeat(' + cols + ', 36px)';
    div.style.gridTemplateRows = 'repeat(' + rows + ', 36px)';
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
                cell.innerHTML = '<div class="gi-icon">' + def.icon + '</div><div class="gi-name">' + def.name + '</div>';
                cell.title = def.name + ' (双击卸回仓库)';
                cell.ondblclick = function() {
                    const s = findFreeSlot(P.stashGrid, CONFIG.STASH_COLS, CONFIG.STASH_ROWS, items[i]);
                    if (s) { placeInGrid(P.stashGrid, CONFIG.STASH_COLS, items[i], s.col, s.row); items.splice(i, 1); savePersistent(); renderAllInventory(); renderStashGrid(); updateAllLobbyUI(); }
                };
            }
        }
        div.appendChild(cell);
    }
}

function renderStorageGrid(divId, countId, grid, cols, rows) {
    const div = document.getElementById(divId); if (!div) return;
    const count = document.getElementById(countId); if (count) count.textContent = (grid._items ? grid._items.length : 0) + '/' + (cols * rows);
    div.style.gridTemplateColumns = 'repeat(' + cols + ', 34px)';
    div.style.gridTemplateRows = 'repeat(' + rows + ', 34px)';
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
        el.innerHTML = '<div class="gi-icon">' + def.icon + '</div><div class="gi-name">' + def.name + '</div>';
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
    return w;
}

const MAX_CARRY_WEIGHT = 70;

function canItemFitZone(itemType, zone) {
    const def = ITEMS[itemType]; if (!def) return false;
    if (zone === 'rig') {
        // 胸挂: 仅1×1物品 (单格快捷槽)
        if (def.w !== 1 || def.h !== 1) return false;
        return def.type !== 'armor' && def.type !== 'helmet' && def.type !== 'chestRig' && def.type !== 'backpack';
    }
    if (zone === 'pocket') {
        // 口袋: 仅1×1物品
        if (def.w !== 1 || def.h !== 1) return false;
        return def.type !== 'armor' && def.type !== 'helmet' && def.type !== 'chestRig' && def.type !== 'backpack';
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
        if (getTotalCarryWeight() + itemWt > MAX_CARRY_WEIGHT) {
            alert('负重超限！当前总重 ' + getTotalCarryWeight() + 'kg，物品 ' + itemWt + 'kg，上限 ' + MAX_CARRY_WEIGHT + 'kg');
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
            item.taken = true;
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
            if (def) { cell.classList.add('equipped', 'rarity-' + (def.rarity || 'common')); cell.textContent = def.icon; cell.title = def.name; }
            else { cell.textContent = sl.icon; cell.style.opacity = '0.35'; cell.title = sl.type; }
            if (sl.type === 'armor' && S.equipment.armorHP > 0) cell.textContent += ' ' + S.equipment.armorHP;
            charGrid.appendChild(cell);
        }
    }
    // Primary weapons display
    const p1 = document.getElementById('searchPrimary1');
    if (p1) { const w = S.weaponSlots[0] ? WEAPONS[S.weaponSlots[0]] : null; p1.innerHTML = w ? w.icon + ' ' + w.name : '主武器1'; p1.style.color = w ? '#fff' : '#555'; p1.style.fontSize = w ? '14px' : '10px'; }
    const p2 = document.getElementById('searchPrimary2');
    if (p2) { const w = S.weaponSlots[1] ? WEAPONS[S.weaponSlots[1]] : null; p2.innerHTML = w ? w.icon + ' ' + w.name : '主武器2'; p2.style.color = w ? '#fff' : '#555'; p2.style.fontSize = w ? '14px' : '10px'; }

    // === Carry-in grids with zone-based drop handlers ===
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
        if (getTotalCarryWeight() + getItemWeight(itemType) > MAX_CARRY_WEIGHT) { alert('负重超限！'); return false; }
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
            foundItem.taken = true;
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

    if (dt.startsWith('item:') || dt.startsWith('zone:') || dt.startsWith('quick:')) {
        // Cross-zone moves: item:srcZone:id:col:row or zone:srcZone:ref or quick:srcZone:idx
        const parts = dt.split(':');
        let srcZone, itemType, srcCol, srcRow, itemInfo;
        if (dt.startsWith('item:')) {
            srcZone = parts[1]; itemType = parts[2]; srcCol = parseInt(parts[3]); srcRow = parseInt(parts[4]);
        } else if (dt.startsWith('quick:')) {
            srcZone = parts[1]; const srcIdx = parseInt(parts[2]);
            itemType = srcZone === 'rig' ? (S._rigItems || [])[srcIdx] : S.pockets[srcIdx];
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
            if (getTotalCarryWeight() - getItemWeight(itemType) + getItemWeight(itemType) > MAX_CARRY_WEIGHT) { alert('负重超限！'); return false; }
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
            }
            placeInGrid(container.grid, container.gridW, itemType, slot.col, slot.row);
            container._revealed.push(true);
            container.items.push({ ...def, type: itemType, taken: false, gridEntry: { col: slot.col, row: slot.row, id: itemType } });
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
            if (getTotalCarryWeight() + getItemWeight(itemType) > MAX_CARRY_WEIGHT) { alert('负重超限！'); return; }
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
    container._revealed.push(true);
    container.items.push({ ...def, type: itemType, taken: false, gridEntry: { col: slot.col, row: slot.row, id: itemType } });
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
    container._revealed.push(true);
    container.items.push({ ...def, type: entry.id, taken: false, gridEntry: { col: slot.col, row: slot.row, id: entry.id } });
    sfxPickup('common');
    renderSearchGrid(container); updateSearchValue(); updateHUD(); updateWeaponUI();
}

function renderZoneQuickGrid(div, items, maxSlots, zone) {
    if (!div) return;
    const cols = Math.min(maxSlots, 6); const rows = Math.ceil(maxSlots / cols);
    div.style.gridTemplateColumns = 'repeat(' + cols + ', 36px)';
    div.style.gridTemplateRows = 'repeat(' + rows + ', 36px)';
    div.innerHTML = '';
    for (let i = 0; i < maxSlots; i++) {
        const cell = document.createElement('div'); cell.className = 'grid-cell empty';
        cell.style.gridColumn = (i % cols) + 1; cell.style.gridRow = Math.floor(i / cols) + 1;
        const onChange = function() { renderSearchGrid(S.currentSearchContainer); updateSearchValue(); updateHUD(); updateWeaponUI(); };
        makeQuickDropCell(cell, zone, i, onChange);
        if (i < items.length && items[i]) {
            const def = ITEMS[items[i]];
            if (def) {
                cell.classList.remove('empty');
                cell.classList.add('grid-item', 'rarity-' + (def.rarity || 'common'));
                cell.innerHTML = '<div class="gi-icon">' + def.icon + '</div><div class="gi-name">' + def.name + '</div>';
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
    div.style.gridTemplateColumns = 'repeat(' + cols + ', 34px)';
    div.style.gridTemplateRows = 'repeat(' + rows + ', 34px)';
    div.innerHTML = '';
    const onChange = function() { renderSearchGrid(S.currentSearchContainer); updateSearchValue(); updateHUD(); updateWeaponUI(); };
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
        el.style.gridColumn = (entry.col + 1) + '/span ' + (def.w || 1);
        el.style.gridRow = (entry.row + 1) + '/span ' + (def.h || 1);
        el.innerHTML = '<div class="gi-icon">' + def.icon + '</div><div class="gi-name">' + def.name + '</div>';
        el.title = def.name + ' - ₵' + def.value + ' (拖拽移动)';
        el.draggable = true;
        el.ondragstart = function(e) { e.stopPropagation(); el.classList.add('dragging'); e.dataTransfer.setData('text/plain', 'item:' + zone + ':' + entry.id + ':' + entry.col + ':' + entry.row); e.dataTransfer.effectAllowed = 'move'; };
        el.ondragend = function() { el.classList.remove('dragging'); };
        el.ondblclick = function() { moveGridToContainer(grid, cols, entry, zone); };
        div.appendChild(el);
    }}
}

// Interactive grids for search screen (accept drops from container)
function renderInteractiveQuickGrid(div, items, maxSlots, gridType) {
    if (!div) return;
    const cols = Math.min(maxSlots, 6);
    const rows = Math.ceil(maxSlots / cols);
    div.style.gridTemplateColumns = 'repeat(' + cols + ', 36px)';
    div.style.gridTemplateRows = 'repeat(' + rows + ', 36px)';
    div.innerHTML = '';
    for (let i = 0; i < maxSlots; i++) {
        const cell = document.createElement('div');
        cell.style.cssText = 'width:36px;height:36px;background:rgba(0,0,0,0.3);border:1px solid #2a2a2a;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:16px;grid-column:' + ((i % cols) + 1) + ';grid-row:' + (Math.floor(i / cols) + 1) + ';';
        cell.style.cursor = 'pointer';
        // Show existing item
        if (i < items.length && items[i]) {
            const def = ITEMS[items[i]];
            if (def) { cell.textContent = def.icon; cell.style.background = 'var(--rarity-bg)'; cell.style.borderColor = 'var(--rarity-border)'; cell.title = def.name + ' - 双击放回容器'; }
        }
        // Double-click to send back to container
        cell.ondblclick = function () {
            if (i < items.length && items[i]) {
                const container = S.currentSearchContainer; if (!container) return;
                const slot = findFreeSlot(container.grid, container.gridW, container.gridH, items[i]);
                if (slot) {
                    const itemId = items[i]; items.splice(i, 1);
                    placeInGrid(container.grid, container.gridW, itemId, slot.col, slot.row);
                    container._revealed.push(true);
                    container.items.push({ ...ITEMS[itemId], type: itemId, taken: false, gridEntry: { col: slot.col, row: slot.row, id: itemId }, gridEntry: { col: slot.col, row: slot.row } });
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
    div.style.gridTemplateColumns = 'repeat(' + cols + ', 34px)';
    div.style.gridTemplateRows = 'repeat(' + rows + ', 34px)';
    div.innerHTML = '';
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const entry = (grid[r] && grid[r][c]) || null;
            const def = entry ? ITEMS[entry.id] : null;
            const cell = document.createElement('div');
            cell.style.cssText = 'width:34px;height:34px;background:' + (def ? 'var(--rarity-bg)' : 'rgba(0,0,0,0.3)') + ';border:1px solid ' + (def ? 'var(--rarity-border)' : '#2a2a2a') + ';border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:16px;grid-column:' + (c + 1) + ';grid-row:' + (r + 1) + ';';
            cell.style.cursor = 'pointer';
            if (def) { cell.textContent = def.icon; cell.title = def.name + ' - 双击放回容器'; }
            // Double-click: send back to container
            if (entry) {
                cell.ondblclick = function () {
                    const cont = S.currentSearchContainer; if (!cont) return;
                    const slot = findFreeSlot(cont.grid, cont.gridW, cont.gridH, entry.id);
                    if (slot) {
                        removeFromGrid(grid, entry);
                        if (gridType === 'backpack') S.lootValue = Math.max(0, S.lootValue - ITEMS[entry.id].value);
                        placeInGrid(cont.grid, cont.gridW, entry.id, slot.col, slot.row);
                        cont._revealed.push(true);
                        cont.items.push({ ...ITEMS[entry.id], type: entry.id, taken: false, gridEntry: { col: slot.col, row: slot.row, id: entry.id } });
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
            item.taken = true;
            S.lootValue += def.value;
            // autoEquipLoot is handled inside onDrop callbacks so they can clean up placement
            S._lootItems = S._lootItems || []; S._lootItems.push({ id: item.type, name: def.name, value: def.value, rarity: def.rarity });
            sfxPickup(def.rarity);
            renderSearchGrid(container); updateSearchValue(); updateHUD(); updateWeaponUI();
        }
    };
}

function renderStashGrid(){
    const container=document.getElementById('stashGridContainer');if(!container)return;
    const colW=58,rowH=58;
    container.innerHTML='';

    // Toolbar with sort button
    const toolbar=document.createElement('div');toolbar.style.cssText='margin-bottom:10px;display:flex;gap:8px;align-items:center;';
    const sortBtn=document.createElement('button');
    sortBtn.textContent='🔧 整理仓库';sortBtn.className='sort-btn';
    sortBtn.onclick=()=>{autoSortGrid(P.stashGrid,CONFIG.STASH_COLS,CONFIG.STASH_ROWS);renderStashGrid();savePersistent();};
    toolbar.appendChild(sortBtn);
    const info=document.createElement('span');info.style.cssText='color:#8b949e;font-size:11px;';info.textContent='拖动物品整理 | 整理按钮自动排序';
    toolbar.appendChild(info);
    container.appendChild(toolbar);

    const grid=document.createElement('div');grid.className='stash-grid';
    grid.style.gridTemplateColumns=`repeat(${CONFIG.STASH_COLS},${colW}px)`;
    grid.style.gridTemplateRows=`repeat(${CONFIG.STASH_ROWS},${rowH}px)`;

    for(let r=0;r<CONFIG.STASH_ROWS;r++){for(let c=0;c<CONFIG.STASH_COLS;c++){
        const cell=document.createElement('div');cell.className='grid-cell empty';
        cell.style.gridColumn=c+1;cell.style.gridRow=r+1;
        cell.ondragover=function(e){e.preventDefault();cell.classList.add('drag-over');e.dataTransfer.dropEffect='move';};
        cell.ondragleave=function(){cell.classList.remove('drag-over');};
        cell.ondrop=function(e){e.preventDefault();cell.classList.remove('drag-over');
            const dt=e.dataTransfer.getData('text/plain');
            if(dt&&dt.startsWith('stash:')){
                const idx=parseInt(dt.split(':')[1]);
                const entry=P.stashGrid._items?P.stashGrid._items[idx]:null;
                if(entry&&canPlaceInGrid(P.stashGrid,CONFIG.STASH_COLS,entry.id,c,r,entry)){
                    removeFromGrid(P.stashGrid,entry);
                    placeInGrid(P.stashGrid,CONFIG.STASH_COLS,entry.id,c,r);
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
        el.className='grid-item rarity-'+def.rarity;
        el.draggable=true;
        el.style.gridColumn=(entry.col+1)+'/span '+def.w;el.style.gridRow=(entry.row+1)+'/span '+def.h;
        el.innerHTML=`<div class="gi-icon">${def.icon}</div><div class="gi-name">${def.name}</div>`;
        el.title=def.name+' - ₵'+def.value+' ['+RARITY[def.rarity].name+'] (拖拽移动)';
        el.ondragstart=function(e){el.classList.add('dragging');e.dataTransfer.setData('text/plain','stash:'+idx);e.dataTransfer.effectAllowed='move';};
        el.ondblclick=function(){equipFromStash(entry.id);};
        el.ondragend=function(){el.classList.remove('dragging');onDragEnd();};
        grid.appendChild(el);
    });}
    container.appendChild(grid);
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
        '⛑️ 头盔':['tier1_helmet','tier2_helmet','tier3_helmet','tier4_helmet','tier5_helmet','basic_helmet','adv_helmet','elite_helmet'],
        '🎽 胸挂':['light_rig','basic_rig','tactical_rig','assault_rig','elite_rig','tactical_rig2','heavy_rig'],
        '🎒 背包':['pouch','small_bag','school_bag','medium_bag','hiking_bag','large_bag','assault_bag','military_bag','expedition_bag','gamma_bag'],
        '💊 医疗':['bandage','tourniquet','painkiller','adrenaline','medkit','stimInjector','surgeryKit'],
        '💣 投掷物':['fragGrenade','smokeGrenade','flashbang','molotov'],
        '🔑 钥匙卡':['blueKeycard','purpleKeycard','redKeycard','blackKeycard'],
        '📦 弹药':['pistolAmmo','rifleAmmo','shotgunAmmo','smgAmmo','sniperAmmo','heavyAmmo'],
        '⬜ 杂货':['cash','lighter','bolt','tape','battery','wire','lens','encryptedUsb'],
        '🟦 贵重品':['watch','phone','whiskey','circuit','perfume','confidentialDoc','satellitePhoto','commanderDiary','jade','goldMask'],
        '🟪 收藏品':['gold','gpu','laptop','ivory','crown','cursedIdol'],
        '💎 红藏品':['diamond','relic','red_ring','red_watch','red_necklace','red_tiger','red_vase','red_lion','red_crown','goldenFalcon'],
        '🔴 3×3大红':['red_painting','red_statue','red_scepter','emperorSeal'],
        '⭐ 最稀有':['moonStone','africa_star'],
    };
    let html='';
    for(const[cat,items]of Object.entries(cats)){html+='<div class="cat-title">'+cat+'</div><div class="shop-grid">';
        for(const itemId of items){const def=ITEMS[itemId];const sp=SHOP_PRICES[itemId];if(!sp)continue;const owned=getStashItemCount(itemId);
            html+=`<div class="shop-item-card rarity-${def.rarity}">
                <div class="shop-icon">${def.icon}</div><div class="shop-name">${def.name}</div>
                <div class="shop-rarity">${RARITY[def.rarity].name}</div><div class="shop-owned">拥有: ${owned}</div>
                <div class="shop-btns"><button class="shop-btn buy" onclick="buyItem('${itemId}')" ${P.money<sp.buy?'disabled':''}>买 ₵${sp.buy}</button><button class="shop-btn sell" onclick="sellItem('${itemId}')" ${owned<=0?'disabled':''}>卖 ₵${sp.sell}</button></div>
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
    S.phase='playing';P.stats.games++;S.startTime=performance.now()/1000;S.gameTime=CONFIG.gameTime[S.mode]||900;
    S.health=S.maxHealth;S.armor=0;S.helmet=0;S.lootValue=0;S.containersSearched=0;S.kills=0;S.isExtracting=false;S.extractProgress=0;S.isReloading=false;S.currentWeapon=0;S._velocityY=0;S._lootItems=[];
    S.stamina=CONFIG.maxStamina;S._staminaExhausted=false;S._staminaRecoverTimer=0;S.isCrouching=false;S._crouchCooldown=false;S._velX=0;S._velZ=0;

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
    S.secureContainer=initGrid(3);S.secureCols=3;S.secureRows=3;
    S.backpack=initGrid(1);S.backpackCols=0;S.backpackRows=0;
    S.broughtItems=[];

    // Restore equipped gear
    S.weaponSlots=savedWeapons;S.magAmmo=savedMags;
    for(let i=0;i<3;i++){if(!S.weaponSlots[i])S.magAmmo[i]=0;}
    S.equipment=savedEquip;
    if(S.equipment.armor){const ad=ITEMS[S.equipment.armor];if(ad)S.equipment.armorHP=ad.amount;}
    if(S.equipment.helmet){const hd=ITEMS[S.equipment.helmet];if(hd)S.equipment.helmetHP=hd.amount;}
    if(S.equipment.chestRig){const cd=ITEMS[S.equipment.chestRig];if(cd)S.maxPockets=5+cd.slots;}
    if(S.equipment.backpack){const bd=ITEMS[S.equipment.backpack];if(bd){S.backpackCols=bd.bCols;S.backpackRows=bd.bRows;S.backpack=initGrid(bd.bRows);}}
    S._rigItems=savedRigItems;S.pockets=savedPockets;
    S.secureContainer=savedSecure;
    // Only restore backpack if it had items, otherwise keep init
    if(savedBackpack&&savedBackpack._items&&savedBackpack._items.length>0){S.backpack=savedBackpack;S.backpackCols=savedBPCols;S.backpackRows=savedBPRows;}
    if(S.weaponSlots[3]!=='knife')S.weaponSlots[3]='knife'; // Always have knife

    enemies.forEach(e=>scene.remove(e.mesh));containers.forEach(c=>scene.remove(c.mesh));particles.forEach(p=>scene.remove(p.mesh));bulletTrails.forEach(b=>{if(b.mesh)scene.remove(b.mesh);});if(extractPoints)extractPoints.forEach(ep=>scene.remove(ep.mesh));
    enemies=[];enemyHitboxes=[];containers=[];particles=[];bulletTrails=[];extractPoints=[];
    rebuildMapEnvironment();
    // Use map's player spawn
    const sp=MAP_DATA?MAP_DATA.playerSpawn:{x:0,z:12,rot:0};
    playerGroup.position.set(sp.x,0,sp.z);mouseX=sp.rot||0;mouseY=0;weaponGroup.position.set(0,0,0);weaponGroup.rotation.set(0,0,0);
    searchAnimData=null;S._isSearching=false;

    spawnContainers();spawnExtractPoints();spawnEnemies();spawnGroundLoot();
    updateHUD();updateWeaponUI();updateWeaponModel();savePersistent();

    setTimeout(()=>{if(S.phase==='playing'){document.getElementById('gameCanvas').requestPointerLock();document.getElementById('clickToPlay').style.display='none';}},150);
    accumulator=0;lastTime=performance.now();
}

function endGame(success){
    S.phase='gameover';if(document.pointerLockElement)document.exitPointerLock();
    const survived=Math.floor(performance.now()/1000-S.startTime);
    document.getElementById('gameHUD').style.display='none';document.getElementById('clickToPlay').style.display='none';document.getElementById('extractPrompt').style.display='none';document.getElementById('searchPrompt').style.display='none';

    const title=document.getElementById('resultTitle'),status=document.getElementById('resultStatus');
    if(success){
        title.textContent='撤离成功';title.className='result-title success';status.textContent='成功撤离';
        P.stats.extracts++;P.stats.totalValue+=S.lootValue;P.money+=S.lootValue;
        trackMission('extract_success',1);
        trackMission('earn_money',S.lootValue);
        if(S.lootValue>=100000)trackMission('extract_value',1);
        // Return equipped weapons and gear to stash
        for(let i=0;i<3;i++){if(S.weaponSlots[i]){const wid=S.weaponSlots[i];const itemId=Object.keys(ITEMS).find(k=>ITEMS[k].type==='weapon'&&ITEMS[k].weapon===wid);if(itemId)stashOrMail(itemId);}}
        for(const k of['armor','helmet','chestRig','backpack']){if(S.equipment[k])stashOrMail(S.equipment[k]);}
        if(S.backpack._items){for(const entry of[...S.backpack._items])stashOrMail(entry.id);}
        if(S.secureContainer._items){for(const entry of[...S.secureContainer._items])stashOrMail(entry.id);}
        // Clear all session containers (items already moved to stash)
        S.secureContainer=initGrid(3);S.backpack=initGrid(1);S.backpackCols=0;S.backpackRows=0;
        S.weaponSlots=[null,null,null,'knife'];S.magAmmo=[0,0,0,0];
        S.equipment={armor:null,armorHP:0,helmet:null,helmetHP:0,chestRig:null,backpack:null};
        S.pockets=[];S._rigItems=[];S.maxPockets=5;S.lootValue=0;S._lootItems=[];
    }else{
        title.textContent='行动失败';title.className='result-title failed';status.textContent='阵亡';
        // SECURE CONTAINER items survive! Move to stash/mail first
        if(S.secureContainer._items){for(const entry of[...S.secureContainer._items])stashOrMail(entry.id);}
        // Clear ALL session containers (equipment LOST, secure items saved to stash)
        S.secureContainer=initGrid(3);S.backpack=initGrid(1);S.backpackCols=0;S.backpackRows=0;
        S.weaponSlots=[null,null,null,'knife'];S.magAmmo=[0,0,0,0];
        S.equipment={armor:null,armorHP:0,helmet:null,helmetHP:0,chestRig:null,backpack:null};
        S.pockets=[];S._rigItems=[];S.maxPockets=5;S.lootValue=0;S._lootItems=[];
    }

    document.getElementById('resultKills').textContent=S.kills;
    document.getElementById('resultTime').textContent=formatTime(survived);
    document.getElementById('resultSearched').textContent=S.containersSearched;
    document.getElementById('resultValue').textContent='₵ '+S.lootValue.toLocaleString();
    renderResultLoot();
    document.getElementById('resultScreen').style.display='flex';
    savePersistent();updateAllLobbyUI();renderStashGrid();
}

function renderResultLoot(){
    const list=document.getElementById('lootList');list.innerHTML='';
    const items=S._lootItems||[];
    const counts={};items.forEach(item=>{if(!counts[item.id])counts[item.id]={name:item.name,value:0,count:0,rarity:item.rarity};counts[item.id].value+=item.value;counts[item.id].count++;});
    Object.entries(counts).forEach(([id,c])=>{const div=document.createElement('div');div.className='loot-item-row';
        const rarity=RARITY[c.rarity]||RARITY.common;
        div.innerHTML=`<span style="color:${rarity.color}">${c.name} x${c.count}</span><span class="loot-val">₵ ${c.value}</span>`;list.appendChild(div);});
}

function restartGame(){document.getElementById('resultScreen').style.display='none';startGame();}
function backToLobby(){document.getElementById('resultScreen').style.display='none';document.getElementById('lobbyScreen').style.display='flex';S.phase='lobby';updateAllLobbyUI();}
function pauseGame(){if(S.phase!=='playing')return;if(confirm('游戏已暂停\n\n按确定继续游戏'))document.getElementById('gameCanvas').requestPointerLock();}
function formatTime(s){const m=Math.floor(s/60);return m.toString().padStart(2,'0')+':'+Math.floor(s%60).toString().padStart(2,'0');}

// ========== SECTION 17: EVENTS ==========
function setupEvents(){
    document.addEventListener('keydown',e=>{keys[e.code]=true;
        // Tab / Escape close backpack/search screen (handled before phase check)
        if(e.code==='Tab'){e.preventDefault();if(S.phase==='searching'){closeSearch();return;}}
        if(e.code==='Escape'){if(S.phase==='searching'){closeSearch();return;}else if(S._isSearching){cancelSearchAnim();return;}else if(S.phase==='playing'){pauseGame();return;}}
        if(S.phase!=='playing')return;
        if(e.code==='KeyR')reload();if(e.code==='KeyF')interact();
        if(e.code==='Digit1')switchWeapon(0);if(e.code==='Digit2')switchWeapon(1);if(e.code==='Digit3')switchWeapon(2);if(e.code==='Digit4')switchWeapon(3);
        if(e.code==='Digit5')useItem('medkit');if(e.code==='Digit6')useItem('bandage');if(e.code==='Digit7')useItem('painkiller');
    });
    document.addEventListener('keyup',e=>keys[e.code]=false);
    document.addEventListener('mousedown',e=>{if(e.button===0){isMouseDown=true;if(S.phase==='playing'){const w=S.weaponSlots[S.currentWeapon]?WEAPONS[S.weaponSlots[S.currentWeapon]]:null;if(w&&!w.auto)shoot();}}});
    document.addEventListener('mouseup',e=>{if(e.button===0)isMouseDown=false;});
    document.addEventListener('mousemove',e=>{if(S.phase!=='playing'||!document.pointerLockElement)return;mouseX-=e.movementX*CONFIG.mouseSensitivity;mouseY-=e.movementY*CONFIG.mouseSensitivity;mouseY=Math.max(-Math.PI/2+0.05,Math.min(Math.PI/2-0.05,mouseY));});
    document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&S.phase==='playing'){Object.keys(keys).forEach(k=>keys[k]=false);isMouseDown=false;document.getElementById('clickToPlay').style.display='block';}});
    document.getElementById('gameCanvas').addEventListener('click',()=>{if(S.phase==='playing'&&!document.pointerLockElement){document.getElementById('gameCanvas').requestPointerLock();document.getElementById('clickToPlay').style.display='none';}});
    window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});
}

// ========== SECTION 18: MAIN LOOP ==========
function animate(currentTime){
    requestAnimationFrame(animate);
    let frameDt=(currentTime-lastTime)/1000;if(frameDt>CONFIG.MAX_FRAME_DT)frameDt=CONFIG.MAX_FRAME_DT;lastTime=currentTime;

    if(S.phase==='playing'){
        accumulator+=frameDt;let updates=0;
        while(accumulator>=CONFIG.FIXED_DT&&updates<10){updatePlayer(CONFIG.FIXED_DT);updateEnemies(CONFIG.FIXED_DT);updateEnemyBullets();updateBulletTrails();updateParticles();updateExtract(CONFIG.FIXED_DT);updateTimer();updateGroundLootAnimation();accumulator-=CONFIG.FIXED_DT;updates++;}
        if(accumulator>CONFIG.FIXED_DT*2)accumulator=0;
        updateHUD();updateWeaponUI();updateMinimap();
        // Dynamic crosshair (widens when moving/sprinting)
        const speed=Math.abs(S._velX||0)+Math.abs(S._velZ||0);
        const ring=document.querySelector('.crosshair-ring');
        if(ring){const sz=18+speed*1.5;ring.style.width=sz+'px';ring.style.height=sz+'px';ring.style.opacity=0.3+speed*0.02;}
        // Low health vignette
        const vig=document.getElementById('healthVignette');
        if(vig)vig.style.opacity=Math.max(0,(1-S.health/S.maxHealth)*0.7);
        // Crouch indicator
        const ci=document.getElementById('crouchIndicator');
        if(ci)ci.style.opacity=S.isCrouching?'1':'0';
    }
    renderer.render(scene,camera);
}

function updateBulletTrails(){for(let i=bulletTrails.length-1;i>=0;i--){const bt=bulletTrails[i];if(bt.isBullet)continue;bt.life--;bt.mesh.material.opacity=bt.life/4;if(bt.life<=0){scene.remove(bt.mesh);bulletTrails.splice(i,1);}}}
function updateParticles(){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.mesh.position.add(p.velocity);if(p.type==='hit')p.velocity.y-=0.01;p.life--;p.mesh.material.opacity=p.life/p.maxLife;if(p.type==='flash')p.mesh.scale.setScalar(p.life/p.maxLife);if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1);}}}

// ========== BOOT ==========
init();
