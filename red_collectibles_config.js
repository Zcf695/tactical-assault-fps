// ============================================================
// 红色收藏品配置文件 — 价格定义
// ============================================================
// 文件夹名 a×b 表示该物品在背包网格中占 a行 × b列
// 对应游戏内: h = a (高/行), w = b (宽/列)
//
// 修改 value 值即可调整价格:
//   buy  = value          (购买价)
//   sell = value × 0.85   (出售价，自动计算)
//
// icon: 图片加载失败时的 emoji 备选
// img:  图片路径 (相对于 index.html)
// ============================================================

const RED_COLLECTIBLES_CONFIG = {

    // ===== 1×1 网格 (17件) — 小型贵重品 =====
    rc_caviar:           { name: '“钻石”鱼子酱',   w: 1, h: 1, value: 350000,  img: '收藏品/红色/1×1/“钻石”鱼子酱.png',    icon: '🥫' },
    rc_mechwatch:        { name: '名贵机械表',     w: 1, h: 1, value: 420000,  img: '收藏品/红色/1×1/名贵机械表.png',       icon: '⌚' },
    rc_mirror:           { name: '吴彦祖之镜',     w: 1, h: 1, value: 380000,  img: '收藏品/红色/1×1/吴彦祖之镜.png',       icon: '🪞' },
    rc_labdata:          { name: '实验数据',       w: 1, h: 1, value: 550000,  img: '收藏品/红色/1×1/实验数据.png',         icon: '📋' },
    rc_pureoriginium:    { name: '至纯源石',       w: 1, h: 1, value: 680000,  img: '收藏品/红色/1×1/至纯源石.png',         icon: '💎' },
    rc_quantumstorage:   { name: '量子存储',       w: 1, h: 1, value: 720000,  img: '收藏品/红色/1×1/量子存储.png',         icon: '💾' },
    rc_africaheart:      { name: '非洲之心',       w: 1, h: 1, value:13145200,  img: '收藏品/红色/1×1/非洲之心.png',         icon: '❤️' },
    rc_alphadata:        { name: 'Alpha脑机实验数据-渡鸦', w: 1, h: 1, value: 450000, img: '收藏品/红色/1×1/Alpha脑机实验数据-渡鸦.png', icon: '📡' },
    rc_braveproof:       { name: '勇者之证',       w: 1, h: 1, value: 400000,  img: '收藏品/红色/1×1/勇者之证.png',         icon: '🏅' },
    rc_locator:           { name: '定位接收器',     w: 1, h: 1, value: 520000,  img: '收藏品/红色/1×1/定位接收器.png',       icon: '📡' },
    rc_starsensor:       { name: '恒星敏感器',     w: 1, h: 1, value: 580000,  img: '收藏品/红色/1×1/恒星敏感器.png',       icon: '🔭' },
    rc_oceantear:        { name: '海洋之泪',       w: 1, h: 1, value: 650000,  img: '收藏品/红色/1×1/海洋之泪.png',         icon: '💧' },
    rc_colorbirdegg:     { name: '炫彩鸟蛋',       w: 1, h: 1, value: 380000,  img: '收藏品/红色/1×1/炫彩鸟蛋.png',         icon: '🥚' },
    rc_electronicshackle:{ name: '电子脚镣',       w: 1, h: 1, value: 350000,  img: '收藏品/红色/1×1/电子脚镣.png',         icon: '⛓️' },
    rc_ultrasoniccutter: { name: '超声波切割刀',   w: 1, h: 1, value: 420000,  img: '收藏品/红色/1×1/超声波切割刀.png',     icon: '🔪' },
    rc_giltcard:         { name: '鎏金卡牌',       w: 1, h: 1, value: 480000,  img: '收藏品/红色/1×1/鎏金卡牌.png',         icon: '🃏' },
    rc_goldbirdegg:      { name: '黄金鸟蛋',       w: 1, h: 1, value: 550000,  img: '收藏品/红色/1×1/黄金鸟蛋.png',         icon: '🥚' },

    // ===== 1×2 网格 (6件) — 横向中型 =====
    rc_terminal:         { name: '军用控制终端',   w: 2, h: 1, value: 900000,  img: '收藏品/红色/1×2/军用控制终端.png',     icon: '🖥️' },
    rc_gpu2:             { name: '显卡',          w: 2, h: 1, value: 750000,  img: '收藏品/红色/1×2/显卡.png',            icon: '🖥️' },
    rc_fossil:           { name: '棘龙爪化石',     w: 2, h: 1, value: 1100000, img: '收藏品/红色/1×2/棘龙爪化石.png',       icon: '🦴' },
    rc_koiking:          { name: '红鲤王',         w: 2, h: 1, value: 580000,  img: '收藏品/红色/1×2/红鲤王.png',          icon: '🐟' },
    rc_drone12:          { name: '无人机',         w: 2, h: 1, value: 680000,  img: '收藏品/红色/1×2/无人机.png',          icon: '🛩️' },
    rc_prisonmap:        { name: '潮汐监狱地图-4', w: 2, h: 1, value: 850000,  img: '收藏品/红色/1×2/潮汐监狱地图-4.png',   icon: '🗺️' },

    // ===== 1×3 网格 (1件) =====
    rc_laser:            { name: '飞秒激光器',     w: 3, h: 1, value: 1500000, img: '收藏品/红色/1×3/飞秒激光器.png',       icon: '🔦' },

    // ===== 1×4 网格 (1件) =====
    rc_shotgun_display:  { name: '滑膛枪展品',     w: 4, h: 1, value: 2000000, img: '收藏品/红色/1×4/滑膛枪展品.png',       icon: '🔫' },

    // ===== 2×1 网格 (13件) — 纵向中型 =====
    rc_goldbar:          { name: '万足金条',       w: 1, h: 2, value: 850000,  img: '收藏品/红色/2×1/万足金条.png',         icon: '🥇' },
    rc_champagne:        { name: '奥莉薇娅香槟',   w: 1, h: 2, value: 480000,  img: '收藏品/红色/2×1/奥莉薇娅香槟.png',     icon: '🍾' },
    rc_amiya:            { name: '手办-阿米娅（近卫）', w: 1, h: 2, value: 620000, img: '收藏品/红色/2×1/手办-阿米娅（近卫）.png', icon: '🎭' },
    rc_lara:             { name: '手办：劳拉（崛起)', w: 1, h: 2, value: 680000, img: '收藏品/红色/2×1/手办：劳拉（崛起).png',  icon: '🎭' },
    rc_egg_black:        { name: '炫彩乌小蛋',     w: 1, h: 2, value: 420000,  img: '收藏品/红色/2×1/炫彩乌小蛋.png',       icon: '🥚' },
    rc_egg_wheat:        { name: '炫彩麦小蛋',     w: 1, h: 2, value: 420000,  img: '收藏品/红色/2×1/炫彩麦小蛋.png',       icon: '🥚' },
    rc_kenbarrel:        { name: '肯小桶',         w: 1, h: 2, value: 380000,  img: '收藏品/红色/2×1/肯小桶.png',           icon: '🛢️' },
    rc_pocketwatch:      { name: '赛伊德的怀表',   w: 1, h: 2, value: 750000,  img: '收藏品/红色/2×1/赛伊德的怀表.png',     icon: '⌚' },
    rc_coffee:           { name: '高级咖啡豆',     w: 1, h: 2, value: 350000,  img: '收藏品/红色/2×1/高级咖啡豆.png',      icon: '☕' },
    rc_egg_circle:       { name: '炫彩克小圈',     w: 1, h: 2, value: 420000,  img: '收藏品/红色/2×1/炫彩克小圈.png',       icon: '🟡' },
    rc_egg_blue:         { name: '炫彩兰小登',     w: 1, h: 2, value: 420000,  img: '收藏品/红色/2×1/炫彩兰小登.png',       icon: '🔵' },
    rc_egg_orange:       { name: '炫彩威小龙',     w: 1, h: 2, value: 420000,  img: '收藏品/红色/2×1/炫彩威小龙.png',       icon: '🟠' },
    rc_egg_purple:       { name: '炫彩露小娜',     w: 1, h: 2, value: 420000,  img: '收藏品/红色/2×1/炫彩露小娜.png',       icon: '🟣' },

    // ===== 2×2 网格 (18件) — 中型藏品 =====
    rc_antenna:          { name: 'G.T.I卫星通信天线', w: 2, h: 2, value: 1200000, img: '收藏品/红色/2×2/G.T.I卫星通信天线.png', icon: '📡' },
    rc_roundsquare:      { name: '“天圆地方”',     w: 2, h: 2, value: 1600000, img: '收藏品/红色/2×2/“天圆地方”.png',       icon: '🏮' },
    rc_tortoise:         { name: '乙巳玄武',       w: 2, h: 2, value: 1400000, img: '收藏品/红色/2×2/乙巳玄武.png',         icon: '🐢' },
    rc_drone:            { name: '军用无人机',     w: 2, h: 2, value: 1800000, img: '收藏品/红色/2×2/军用无人机.png',       icon: '🛩️' },
    rc_radio:            { name: '军用电台',       w: 2, h: 2, value: 950000,  img: '收藏品/红色/2×2/军用电台.png',         icon: '📻' },
    rc_ventilator:       { name: '呼吸机',         w: 2, h: 2, value: 1100000, img: '收藏品/红色/2×2/呼吸机.png',           icon: '🫁' },
    rc_camera:           { name: '摄影机',         w: 2, h: 2, value: 880000,  img: '收藏品/红色/2×2/摄影机.png',           icon: '🎥' },
    rc_soccer:           { name: '炫彩足球',       w: 2, h: 2, value: 780000,  img: '收藏品/红色/2×2/炫彩足球.png',         icon: '⚽' },
    rc_takeoff:          { name: '马上起飞',       w: 2, h: 2, value: 1300000, img: '收藏品/红色/2×2/马上起飞.png',         icon: '✈️' },
    rc_goldgazelle:      { name: '黄金瞪羚',       w: 2, h: 2, value: 2000000, img: '收藏品/红色/2×2/黄金瞪羚.png',         icon: '🦌' },
    rc_sixbullet:        { name: '“六”级弹',       w: 2, h: 2, value: 900000,  img: '收藏品/红色/2×2/“六”级弹.png',         icon: '🔫' },
    rc_lifesupport:      { name: '便携式生命支持系统', w: 2, h: 2, value: 1100000, img: '收藏品/红色/2×2/便携式生命支持系统.png', icon: '🫁' },
    rc_behemoth:         { name: '巨兽机甲',       w: 2, h: 2, value: 1500000, img: '收藏品/红色/2×2/巨兽机甲.png',         icon: '🤖' },
    rc_sealedaudio:      { name: '已封存音源',     w: 2, h: 2, value: 850000,  img: '收藏品/红色/2×2/已封存音源.png',       icon: '🎵' },
    rc_transport:        { name: '马上转运',       w: 2, h: 2, value: 1300000, img: '收藏品/红色/2×2/马上转运.png',         icon: '🚁' },
    rc_gastank:          { name: '高能瓦斯罐',     w: 2, h: 2, value: 950000,  img: '收藏品/红色/2×2/高能瓦斯罐.png',       icon: '🔥' },
    rc_goldcrocodile:    { name: '黄金鳄鱼头雕像', w: 2, h: 2, value: 1800000, img: '收藏品/红色/2×2/黄金鳄鱼头雕像.png',   icon: '🐊' },
    rc_goldnest:         { name: '黄金鸟窝',       w: 2, h: 2, value: 1400000, img: '收藏品/红色/2×2/黄金鸟窝.png',         icon: '🪺' },

    // ===== 2×3 网格 (7件) — 大型设备 =====
    rc_cloudarray:       { name: '云存储阵列',     w: 3, h: 2, value: 2200000, img: '收藏品/红色/2×3/云存储阵列.png',       icon: '💾' },
    rc_infoterminal:     { name: '军用信息终端',   w: 3, h: 2, value: 2500000, img: '收藏品/红色/2×3/军用信息终端.png',     icon: '🖥️' },
    rc_artillery:        { name: '军用炮弹',       w: 3, h: 2, value: 1800000, img: '收藏品/红色/2×3/军用炮弹.png',         icon: '💣' },
    rc_ifvmodel:         { name: '步战车模型',     w: 3, h: 2, value: 1600000, img: '收藏品/红色/2×3/步战车模型.png',       icon: '🚙' },
    rc_laptop2:          { name: '笔记本电脑',     w: 3, h: 2, value: 1500000, img: '收藏品/红色/2×3/笔记本电脑.png',       icon: '💻' },
    rc_armorbattery:     { name: '装甲车电池',     w: 3, h: 2, value: 1400000, img: '收藏品/红色/2×3/装甲车电池.png',       icon: '🔋' },
    rc_flightrecorder:   { name: '飞行记录仪',     w: 3, h: 2, value: 1900000, img: '收藏品/红色/2×3/飞行记录仪.png',       icon: '📋' },

    // ===== 3×1 网格 (1件) — 横向大型 =====
    rc_worldcuptrophy:   { name: '烽火世界杯纪念奖杯', w: 1, h: 3, value: 1200000, img: '收藏品/红色/3×1/烽火世界杯纪念奖杯.png', icon: '🏆' },

    // ===== 3×2 网格 (5件) — 纵向大型 =====
    rc_claudius:         { name: '克劳迪乌斯半身像', w: 2, h: 3, value: 2300000, img: '收藏品/红色/3×2/克劳迪乌斯半身像.png', icon: '🗿' },
    rc_medrobot:         { name: '医疗机械人',     w: 2, h: 3, value: 2100000, img: '收藏品/红色/3×2/医疗机械人.png',       icon: '🤖' },
    rc_vacuum:           { name: '强力吸尘器',     w: 2, h: 3, value: 1500000, img: '收藏品/红色/3×2/强力吸尘器.png',       icon: '🧹' },
    rc_aed:              { name: '自动体外除颤器', w: 2, h: 3, value: 1800000, img: '收藏品/红色/3×2/自动体外除颤器.png',   icon: '⚡' },
    rc_phonograph:       { name: '雷斯的留声机',   w: 2, h: 3, value: 2500000, img: '收藏品/红色/3×2/雷斯的留声机.png',     icon: '🎵' },

    // ===== 3×3 网格 (15件) — 大型珍贵藏品 =====
    rc_ecmo:             { name: 'ECMO',           w: 3, h: 3, value: 3000000, img: '收藏品/红色/3×3/ECMO.png',             icon: '🫀' },
    rc_zongheng:         { name: '“纵横”',         w: 3, h: 3, value: 3500000, img: '收藏品/红色/3×3/“纵横”.png',           icon: '🐲' },
    rc_crown2:           { name: '万金泪冠',       w: 3, h: 3, value: 3800000, img: '收藏品/红色/3×3/万金泪冠.png',         icon: '👑' },
    rc_tankmodel:        { name: '主战坦克模型',   w: 3, h: 3, value: 2800000, img: '收藏品/红色/3×3/主战坦克模型.png',     icon: '🚜' },
    rc_radar:            { name: '便携军用雷达',   w: 3, h: 3, value: 3200000, img: '收藏品/红色/3×3/便携军用雷达.png',     icon: '📡' },
    rc_respirator:       { name: '复苏呼吸机',     w: 3, h: 3, value: 2700000, img: '收藏品/红色/3×3/复苏呼吸机.png',       icon: '🫁' },
    rc_carbonplate:      { name: '强化碳纤维板',   w: 3, h: 3, value: 2400000, img: '收藏品/红色/3×3/强化碳纤维板.png',     icon: '🧱' },
    rc_reactor:          { name: '微型反应炉',     w: 3, h: 3, value: 4500000, img: '收藏品/红色/3×3/微型反应炉.png',       icon: '⚛️' },
    rc_robotvac:         { name: '扫拖一体机器人', w: 3, h: 3, value: 2200000, img: '收藏品/红色/3×3/扫拖一体机器人.png',   icon: '🤖' },
    rc_superserver:      { name: '曼德尔超算单元', w: 3, h: 3, value: 5000000, img: '收藏品/红色/3×3/曼德尔超算单元.png',   icon: '🧮' },
    rc_topserver:        { name: '绝密服务器',     w: 3, h: 3, value: 4200000, img: '收藏品/红色/3×3/绝密服务器.png',       icon: '🗄️' },
    rc_typewriter:       { name: '“雷明顿”打字机', w: 3, h: 3, value: 2800000, img: '收藏品/红色/3×3/“雷明顿”打字机.png',   icon: '⌨️' },
    rc_impressionistart: { name: '印象派名画',     w: 3, h: 3, value: 3200000, img: '收藏品/红色/3×3/印象派名画.png',       icon: '🖼️' },
    rc_reactorcoolant:   { name: '反应堆冷却核心', w: 3, h: 3, value: 3800000, img: '收藏品/红色/3×3/反应堆冷却核心.png',   icon: '⚛️' },
    rc_fusionunit:       { name: '试制聚变供能单元', w: 3, h: 3, value: 4200000, img: '收藏品/红色/3×3/试制聚变供能单元.png', icon: '🔬' },

    // ===== 3×4 网格 (2件) — 超大型 =====
    rc_powerbattery:     { name: '动力电池组',     w: 4, h: 3, value: 3500000, img: '收藏品/红色/3×4/动力电池组.png',       icon: '🔋' },
    rc_diskarray:        { name: '高速磁盘阵列',   w: 4, h: 3, value: 4200000, img: '收藏品/红色/3×4/高速磁盘阵列.png',     icon: '💾' },

    // ===== 4×2 网格 (3件) =====
    rc_rangefinder:      { name: '测距仪',         w: 2, h: 4, value: 2500000, img: '收藏品/红色/4×2/测距仪.png',           icon: '🔭' },
    rc_famousporcelain:  { name: '名窑瓷器',       w: 2, h: 4, value: 2200000, img: '收藏品/红色/4×2/名窑瓷器.png',         icon: '🏺' },
    rc_uraniumsample:    { name: '浓缩铀样本',     w: 2, h: 4, value: 2800000, img: '收藏品/红色/4×2/浓缩铀样本.png',       icon: '☢️' },

    // ===== 4×3 网格 (4件) — 最大型藏品 =====
    rc_bladeserver:      { name: '刀片服务器',     w: 3, h: 4, value: 4800000, img: '收藏品/红色/4×3/刀片服务器.png',       icon: '🗄️' },
    rc_rocketfuel:       { name: '火箭燃料',       w: 3, h: 4, value: 5500000, img: '收藏品/红色/4×3/火箭燃料.png',         icon: '🚀' },
    rc_darkstarfuel:     { name: '暗星燃料单元',   w: 3, h: 4, value: 5000000, img: '收藏品/红色/4×3/暗星燃料单元.png',     icon: '🌟' },
    rc_buoyancycomp:     { name: '浮力补偿设备',   w: 3, h: 4, value: 4800000, img: '收藏品/红色/4×3/浮力补偿设备.png',     icon: '⚓' },
};
