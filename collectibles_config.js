// ============================================================
// 收藏品配置文件 — 白/蓝/紫/金档
// ============================================================
// rarity 对应:
//   白色 → common    (普通)
//   蓝色 → rare      (稀有)
//   紫色 → epic      (史诗)
//   金色 → legendary (传说)
//
// 文件夹名 a×b = a行 × b列 → h=a, w=b
// icon: 图片加载失败时的 emoji 备选
// img:  图片路径 (相对于 index.html)
// ============================================================

const COLLECTIBLES_CONFIG = {

    // ========== 白色收藏品 (common, 6件) ==========
    wc_tape:        { name: '布基胶带',     rarity: 'common',    w: 1, h: 1, value: 5000,  img: '收藏品/白色/1×1/布基胶带.png',     icon: '🩹' },
    wc_brush:       { name: '油漆刷',       rarity: 'common',    w: 1, h: 1, value: 4000,  img: '收藏品/白色/1×1/油漆刷.png',       icon: '🖌️' },
    wc_matches:     { name: '火柴',         rarity: 'common',    w: 1, h: 1, value: 3000,  img: '收藏品/白色/1×1/火柴.png',         icon: '🔥' },
    wc_toolkit:    { name: '精密工具组',   rarity: 'common',    w: 1, h: 1, value: 12000, img: '收藏品/白色/1×1/精密工具组.png',   icon: '🧰' },
    wc_watertape:  { name: '防水胶布',     rarity: 'common',    w: 1, h: 1, value: 6000,  img: '收藏品/白色/1×1/防水胶布.png',     icon: '🩹' },
    wc_toothpaste: { name: '含氟牙膏',     rarity: 'common',    w: 1, h: 2, value: 8000,  img: '收藏品/白色/2×1/含氟牙膏.png',     icon: '🪥' },

    // ========== 蓝色收藏品 (rare, 19件) ==========
    bc_lowfuel:     { name: '低级燃料',     rarity: 'rare',      w: 1, h: 1, value: 18000, img: '收藏品/蓝色/1×1/低级燃料.png',     icon: '⛽' },
    bc_fuelbottle:  { name: '便携燃料瓶',   rarity: 'rare',      w: 1, h: 1, value: 22000, img: '收藏品/蓝色/1×1/便携燃料瓶.png',   icon: '🛢️' },
    bc_milpower:    { name: '军用移动电源', rarity: 'rare',      w: 1, h: 1, value: 45000, img: '收藏品/蓝色/1×1/军用移动电源.png', icon: '🔋' },
    bc_camera:      { name: '摄像头',       rarity: 'rare',      w: 1, h: 1, value: 28000, img: '收藏品/蓝色/1×1/摄像头.png',       icon: '📷' },
    bc_relay:       { name: '继电器',       rarity: 'rare',      w: 1, h: 1, value: 20000, img: '收藏品/蓝色/1×1/继电器.png',       icon: '🔌' },
    bc_socket:      { name: '转换插座',     rarity: 'rare',      w: 1, h: 1, value: 15000, img: '收藏品/蓝色/1×1/转换插座.png',     icon: '🔌' },
    bc_badge:       { name: '部队饰章',     rarity: 'rare',      w: 1, h: 1, value: 35000, img: '收藏品/蓝色/1×1/部队饰章.png',     icon: '🎖️' },
    bc_thermogun:   { name: '额温枪',       rarity: 'rare',      w: 1, h: 1, value: 30000, img: '收藏品/蓝色/1×1/额温枪.png',       icon: '🌡️' },
    bc_caliper:     { name: '高精数显卡尺', rarity: 'rare',      w: 1, h: 1, value: 40000, img: '收藏品/蓝色/1×1/高精数显卡尺.png', icon: '📏' },
    bc_drill:       { name: '无线便携电钻', rarity: 'rare',      w: 2, h: 1, value: 50000, img: '收藏品/蓝色/1×2/无线便携电钻.png', icon: '🪛' },
    bc_gunparts:    { name: '枪械零件',     rarity: 'rare',      w: 2, h: 1, value: 35000, img: '收藏品/蓝色/1×2/枪械零件.png',     icon: '🔩' },
    bc_aramid:      { name: '芳纶纤维',     rarity: 'rare',      w: 2, h: 1, value: 42000, img: '收藏品/蓝色/1×2/芳纶纤维.png',     icon: '🧵' },
    bc_stethoscope: { name: '听诊器',       rarity: 'rare',      w: 1, h: 2, value: 25000, img: '收藏品/蓝色/2×1/听诊器.png',       icon: '🩺' },
    bc_gunpowder:   { name: '火药',         rarity: 'rare',      w: 1, h: 2, value: 30000, img: '收藏品/蓝色/2×1/火药.png',         icon: '💨' },
    bc_paintbucket: { name: '一桶油漆',     rarity: 'rare',      w: 2, h: 2, value: 45000, img: '收藏品/蓝色/2×2/一桶油漆.png',     icon: '🪣' },
    bc_breachhammer:{ name: '机械破障锤',   rarity: 'rare',      w: 2, h: 2, value: 55000, img: '收藏品/蓝色/2×2/机械破障锤.png',   icon: '🔨' },
    bc_lcdscreen:   { name: '液晶显示屏',   rarity: 'rare',      w: 2, h: 2, value: 48000, img: '收藏品/蓝色/2×2/液晶显示屏.png',   icon: '📺' },
    bc_gastank:     { name: '燃气罐',       rarity: 'rare',      w: 2, h: 2, value: 38000, img: '收藏品/蓝色/2×2/燃气罐.png',       icon: '🛢️' },
    bc_cement:      { name: '一包水泥',     rarity: 'rare',      w: 2, h: 3, value: 35000, img: '收藏品/蓝色/3×2/一包水泥.png',     icon: '🧱' },

    // ========== 紫色收藏品 (epic, 16件) ==========
    pc_controller:  { name: 'GS5 手柄',     rarity: 'epic',      w: 1, h: 1, value: 120000, img: '收藏品/紫色/1×1/GS5 手柄.png',     icon: '🎮' },
    pc_ram:         { name: '内存条',       rarity: 'epic',      w: 1, h: 1, value: 95000,  img: '收藏品/紫色/1×1/内存条.png',       icon: '💾' },
    pc_ssd:         { name: '固态硬盘',     rarity: 'epic',      w: 1, h: 1, value: 110000, img: '收藏品/紫色/1×1/固态硬盘.png',     icon: '💾' },
    pc_jammer:      { name: '电子干扰器',   rarity: 'epic',      w: 1, h: 1, value: 180000, img: '收藏品/紫色/1×1/电子干扰器.png',   icon: '📡' },
    pc_polyfiber:   { name: '聚乙烯纤维',   rarity: 'epic',      w: 1, h: 1, value: 85000,  img: '收藏品/紫色/1×1/聚乙烯纤维.png',   icon: '🧵' },
    pc_vhs:         { name: '袖珍录像带',   rarity: 'epic',      w: 1, h: 1, value: 100000, img: '收藏品/紫色/1×1/袖珍录像带.png',   icon: '📼' },
    pc_warmer:      { name: '输液加温器',   rarity: 'epic',      w: 1, h: 1, value: 90000,  img: '收藏品/紫色/1×1/输液加温器.png',   icon: '🏥' },
    pc_spypen:      { name: '间谍笔',       rarity: 'epic',      w: 1, h: 1, value: 150000, img: '收藏品/紫色/1×1/间谍笔.png',       icon: '🖊️' },
    pc_highfuel:    { name: '高级燃料',     rarity: 'epic',      w: 1, h: 1, value: 130000, img: '收藏品/紫色/1×1/高级燃料.png',     icon: '⛽' },
    pc_hifi:        { name: 'HIFI声卡',     rarity: 'epic',      w: 2, h: 1, value: 160000, img: '收藏品/紫色/1×2/HIFI声卡.png',     icon: '🎵' },
    pc_radio:       { name: '收音机',       rarity: 'epic',      w: 2, h: 1, value: 80000,  img: '收藏品/紫色/1×2/收音机.png',       icon: '📻' },
    pc_specialsteel:{ name: '特种钢',       rarity: 'epic',      w: 2, h: 1, value: 140000, img: '收藏品/紫色/1×2/特种钢.png',       icon: '🔩' },
    pc_waterskin:   { name: '阿萨拉风情水壶', rarity: 'epic',    w: 1, h: 2, value: 100000, img: '收藏品/紫色/2×1/阿萨拉风情水壶.png', icon: '🚰' },
    pc_crusher:     { name: '高出力粉碎钳', rarity: 'epic',      w: 1, h: 2, value: 170000, img: '收藏品/紫色/2×1/高出力粉碎钳.png', icon: '🔧' },
    pc_motherboard: { name: 'ASOS电脑主板', rarity: 'epic',      w: 2, h: 2, value: 200000, img: '收藏品/紫色/2×2/ASOS电脑主板.png', icon: '🖥️' },
    pc_handsaw:     { name: '自旋型手锯',   rarity: 'epic',      w: 2, h: 2, value: 130000, img: '收藏品/紫色/2×2/自旋型手锯.png',   icon: '🪚' },

    // ========== 金色收藏品 (legendary, 49件) ==========
    gc_piratecoin:  { name: '亮闪闪的海盗金币', rarity: 'legendary', w: 1, h: 1, value: 250000, img: '收藏品/金色/1×1/亮闪闪的海盗金币.png', icon: '🪙' },
    gc_award:       { name: '优秀雇员奖杯',   rarity: 'legendary', w: 1, h: 1, value: 200000, img: '收藏品/金色/1×1/优秀雇员奖杯.png',   icon: '🏆' },
    gc_defib:       { name: '体内除颤器',     rarity: 'legendary', w: 1, h: 1, value: 350000, img: '收藏品/金色/1×1/体内除颤器.png',     icon: '⚡' },
    gc_milpass:     { name: '军事通行证',     rarity: 'legendary', w: 1, h: 1, value: 400000, img: '收藏品/金色/1×1/军事通行证.png',     icon: '📄' },
    gc_milnet:      { name: '军用网络模块',   rarity: 'legendary', w: 1, h: 1, value: 320000, img: '收藏品/金色/1×1/军用网络模块.png',   icon: '🌐' },
    gc_medal:       { name: '功绩勋章',       rarity: 'legendary', w: 1, h: 1, value: 380000, img: '收藏品/金色/1×1/功绩勋章.png',       icon: '🎖️' },
    gc_ring:        { name: '卫队金扳指',     rarity: 'legendary', w: 1, h: 1, value: 280000, img: '收藏品/金色/1×1/卫队金扳指.png',     icon: '💍' },
    gc_coffee:      { name: '咖啡',           rarity: 'legendary', w: 1, h: 1, value: 150000, img: '收藏品/金色/1×1/咖啡.png',           icon: '☕' },
    gc_solidfuel:   { name: '固体燃料',       rarity: 'legendary', w: 1, h: 1, value: 220000, img: '收藏品/金色/1×1/固体燃料.png',       icon: '🔥' },
    gc_cube:        { name: '心灵感应.魔方',  rarity: 'legendary', w: 1, h: 1, value: 450000, img: '收藏品/金色/1×1/心灵感应.魔方.png',  icon: '🧊' },
    gc_lighter:     { name: '纯金打火机',     rarity: 'legendary', w: 1, h: 1, value: 180000, img: '收藏品/金色/1×1/纯金打火机.png',     icon: '🔥' },
    gc_brainctrl:   { name: '脑机控制端子',   rarity: 'legendary', w: 1, h: 1, value: 420000, img: '收藏品/金色/1×1/脑机控制端子.png',   icon: '🧠' },
    gc_oximeter:    { name: '血氧仪',         rarity: 'legendary', w: 1, h: 1, value: 300000, img: '收藏品/金色/1×1/血氧仪.png',         icon: '🩺' },
    gc_blueprint:   { name: '资料：设计图纸',  rarity: 'legendary', w: 1, h: 1, value: 500000, img: '收藏品/金色/1×1/资料：设计图纸.png',  icon: '📐' },
    gc_goldpen:     { name: '金笔',           rarity: 'legendary', w: 1, h: 1, value: 200000, img: '收藏品/金色/1×1/金笔.png',           icon: '🖊️' },
    gc_winecup:     { name: '阿萨拉特色酒杯', rarity: 'legendary', w: 1, h: 1, value: 160000, img: '收藏品/金色/1×1/阿萨拉特色酒杯.png', icon: '🥂' },
    gc_multimeter:  { name: '陆军万用表',     rarity: 'legendary', w: 1, h: 1, value: 260000, img: '收藏品/金色/1×1/陆军万用表.png',     icon: '📊' },
    gc_fastssd:     { name: '高速固态硬盘',   rarity: 'legendary', w: 1, h: 1, value: 350000, img: '收藏品/金色/1×1/高速固态硬盘.png',   icon: '💾' },
    gc_ballistic:   { name: '军用弹道计算机', rarity: 'legendary', w: 2, h: 1, value: 450000, img: '收藏品/金色/1×2/军用弹道计算机.png', icon: '💻' },
    gc_crossbow:    { name: '赛伊德的手弩',   rarity: 'legendary', w: 2, h: 1, value: 380000, img: '收藏品/金色/1×2/赛伊德的手弩.png',   icon: '🏹' },
    gc_goggles:     { name: '飞行员眼镜',     rarity: 'legendary', w: 2, h: 1, value: 280000, img: '收藏品/金色/1×2/飞行员眼镜.png',     icon: '🥽' },
    gc_mapcase:     { name: '军用地图匣',     rarity: 'legendary', w: 3, h: 1, value: 550000, img: '收藏品/金色/1×3/军用地图匣.png',     icon: '🗺️' },
    gc_fuelrod:     { name: '微型燃料棒',     rarity: 'legendary', w: 3, h: 1, value: 600000, img: '收藏品/金色/1×3/微型燃料棒.png',     icon: '☢️' },
    gc_crown:       { name: '珠宝头冠',       rarity: 'legendary', w: 3, h: 1, value: 700000, img: '收藏品/金色/1×3/珠宝头冠.png',       icon: '👑' },
    gc_perfuel:     { name: '高性能燃油',     rarity: 'legendary', w: 3, h: 1, value: 480000, img: '收藏品/金色/1×3/高性能燃油.png',     icon: '⛽' },
    gc_tequila:     { name: '“蓝宝石”龙舌兰', rarity: 'legendary', w: 1, h: 2, value: 220000, img: '收藏品/金色/2×1/“蓝宝石”龙舌兰.png', icon: '🍾' },
    gc_landeng:     { name: '兰小登',         rarity: 'legendary', w: 1, h: 2, value: 180000, img: '收藏品/金色/2×1/兰小登.png',         icon: '🎭' },
    gc_satphone:    { name: '卫星电话',       rarity: 'legendary', w: 1, h: 2, value: 350000, img: '收藏品/金色/2×1/卫星电话.png',       icon: '📞' },
    gc_secretfile:  { name: '哈夫克机密档案', rarity: 'legendary', w: 1, h: 2, value: 450000, img: '收藏品/金色/2×1/哈夫克机密档案.png', icon: '📁' },
    gc_stent:       { name: '心脏支架',       rarity: 'legendary', w: 1, h: 2, value: 400000, img: '收藏品/金色/2×1/心脏支架.png',       icon: '❤️' },
    gc_larafig:     { name: '手办：劳拉',     rarity: 'legendary', w: 1, h: 2, value: 200000, img: '收藏品/金色/2×1/手办：劳拉.png',     icon: '🎭' },
    gc_lazhai:      { name: '拉小宅',         rarity: 'legendary', w: 1, h: 2, value: 170000, img: '收藏品/金色/2×1/拉小宅.png',         icon: '🎭' },
    gc_breacher:    { name: '液压破门器',     rarity: 'legendary', w: 1, h: 2, value: 320000, img: '收藏品/金色/2×1/液压破门器.png',     icon: '🚪' },
    gc_coffeebox:   { name: '盒装挂耳咖啡',   rarity: 'legendary', w: 1, h: 2, value: 150000, img: '收藏品/金色/2×1/盒装挂耳咖啡.png',   icon: '☕' },
    gc_uvlamp:      { name: '紫外线灯',       rarity: 'legendary', w: 1, h: 2, value: 250000, img: '收藏品/金色/2×1/紫外线灯.png',       icon: '💡' },
    gc_pottery:     { name: '荷美尔陶俑',     rarity: 'legendary', w: 1, h: 2, value: 280000, img: '收藏品/金色/2×1/荷美尔陶俑.png',     icon: '🏺' },
    gc_scorebook:   { name: '雷斯的乐谱本',   rarity: 'legendary', w: 1, h: 2, value: 230000, img: '收藏品/金色/2×1/雷斯的乐谱本.png',   icon: '🎼' },
    gc_luna:        { name: '露小娜',         rarity: 'legendary', w: 1, h: 2, value: 170000, img: '收藏品/金色/2×1/露小娜.png',         icon: '🎭' },
    gc_maidan:      { name: '麦小蛋',         rarity: 'legendary', w: 1, h: 2, value: 170000, img: '收藏品/金色/2×1/麦小蛋.png',         icon: '🎭' },
    gc_isotope:     { name: '便携式同位素识别仪', rarity: 'legendary', w: 2, h: 2, value: 550000, img: '收藏品/金色/2×2/便携式同位素识别仪.png', icon: '📡' },
    gc_satcom:      { name: '军用卫星通讯仪', rarity: 'legendary', w: 2, h: 2, value: 600000, img: '收藏品/金色/2×2/军用卫星通讯仪.png', icon: '🛰️' },
    gc_binoculars:  { name: '军用望远镜',     rarity: 'legendary', w: 2, h: 2, value: 500000, img: '收藏品/金色/2×2/军用望远镜.png',     icon: '🔭' },
    gc_camera_pro:  { name: '单反相机',       rarity: 'legendary', w: 2, h: 2, value: 450000, img: '收藏品/金色/2×2/单反相机.png',       icon: '📷' },
    gc_bigradio:    { name: '大型电台',       rarity: 'legendary', w: 2, h: 2, value: 480000, img: '收藏品/金色/2×2/大型电台.png',       icon: '📻' },
    gc_clock:       { name: '座钟',           rarity: 'legendary', w: 2, h: 2, value: 400000, img: '收藏品/金色/2×2/座钟.png',           icon: '🕰️' },
    gc_jewelry:     { name: '本地特色首饰',   rarity: 'legendary', w: 3, h: 2, value: 650000, img: '收藏品/金色/2×3/本地特色首饰.png',   icon: '💎' },
    gc_dronebee:    { name: '机械工蜂模型',   rarity: 'legendary', w: 3, h: 2, value: 700000, img: '收藏品/金色/2×3/机械工蜂模型.png',   icon: '🐝' },
    gc_bulletparts: { name: '高级子弹生产零件', rarity: 'legendary', w: 3, h: 2, value: 750000, img: '收藏品/金色/2×3/高级子弹生产零件.png', icon: '🔩' },
    gc_arrayserv:   { name: '阵列服务器',     rarity: 'legendary', w: 4, h: 3, value: 800000, img: '收藏品/金色/3×4/阵列服务器.png',     icon: '🗄️' },
};
