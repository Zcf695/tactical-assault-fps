// ============================================================
// 地图: 军事禁区 - 深度扩建版 (300x300, 120+建筑)
// 设计理念: 高密度战术空间 + 多层级探索路径 + 环境叙事
// 核心区: 围墙要塞  缓冲区: 功能集群  边境区: 隐藏探索
// ============================================================
var MAP_DATA_MILITARY = {
    name: '军事禁区',
    // 地图类型：供 WorldProps 地形/道具密度分支使用。
    // 必须显式声明 —— 曾因 world_props 用 /森林|Forest|outpost/ 匹配 name
    // 而「密林禁区」全部匹配失败，导致森林图按军事基地密度生成道具。
    // 取值与 S.currentMapType 一致：military | industrial | forest
    kind: 'military',
    desc: '高密度战术空间，围墙要塞+功能集群+隐藏探索点，120+可进入建筑，多条迂回路径',
    mapSize: 300,
    gameTime: { normal: 1200, hard: 900 },
    enemyCount: { normal: 50, hard: 75 },
    containerCount: { normal: 200, hard: 260 },

    theme: {
        // ===== 以下数值来自 design/art/art-data-tables.md 表 A（定稿），勿自行调整 =====
        // 表 A 派生验收值：uZenith #2a5b90 (H211 S55 L37) / uHorizon #b6ac9b (H36 S16 L66)
        //                半球光地面色 #344237    天顶饱和度 55（三图中最高，深蓝基调）
        groundColor: 0x4a5f4f,
        skyColor: 0x4a86c8,
        fogColor: 0xa8aca8,
        fogNear: 80,
        fogFar: 260,
        // 地面 PBR 贴图种类（PBRTextures 的 kind）：军事基地以砾石/训练场为主
        // 缺省时 game.js:getGroundSurface 与 graphics_enhancement 都会退回 'grass'
        groundSurface: 'gravel',
        // 屋顶女儿墙颜色（楼顶 PBR 贴图会遮住屋面板，此色主要影响女儿墙与降级回退路径）
        roofColor: 0x555a52,
        roadColor: 0x555545,
        wallColor: 0x5a5a52,
        coverColors: [0x6a5a4a, 0x5a5a5a, 0x7a6a5a, 0x4a5a4a]
    },

    // ========== 14个功能区域 ==========
    zones: [
        // 核心区
        { name: '指挥要塞', x: 0, z: 0, color: '#8a3a3a', radius: 45, desc: '围墙环绕，最高价值，精英守卫' },
        { name: '中央弹药库', x: 35, z: -15, color: '#7a5a3a', radius: 20, desc: '武器弹药集中' },
        { name: '情报中心', x: -30, z: 20, color: '#5a5a8a', radius: 20, desc: '电子设备与加密文档' },
        // 缓冲区
        { name: '工业区', x: -75, z: -50, color: '#6a6a5a', radius: 40, desc: '武器装备刷新，铸造车间' },
        { name: '住宅区', x: 75, z: -50, color: '#7a6a5a', radius: 38, desc: '医疗物资，多层公寓' },
        { name: '港口码头', x: 85, z: 55, color: '#5a7a8a', radius: 38, desc: '混合物资，海路撤离' },
        { name: '医疗营地', x: -65, z: 65, color: '#5a8a7a', radius: 35, desc: '医疗物资集中' },
        { name: '空军基地', x: 0, z: -85, color: '#5a6a7a', radius: 42, desc: '高价值，开阔跑道' },
        { name: '雷达站', x: -95, z: 15, color: '#5a5a6a', radius: 30, desc: '电子设备和武器' },
        // 边境区
        { name: '地下设施', x: -115, z: -90, color: '#3a3a4a', radius: 32, desc: '高风险高回报，紫色钥匙卡' },
        { name: '废弃村庄', x: 115, z: -80, color: '#6a5a4a', radius: 35, desc: '隐蔽搜刮，适合新手' },
        { name: '水库大坝', x: 105, z: 95, color: '#4a7a8a', radius: 35, desc: '医疗+电子，制高点' },
        { name: '发电站', x: -105, z: 95, color: '#7a6a3a', radius: 38, desc: '武器+装备，烟囱地标' },
        { name: '训练靶场', x: 0, z: 115, color: '#5a7a5a', radius: 32, desc: '弹药+武器，开阔地形' }
    ],

    // ========== 路径系统 ==========
    roads: [
        // 主环路
        { name: '内环公路', x: 0, z: 0, w: 8, d: 110 },
        // 放射主干道
        { name: '北向大道', x: 0, z: 60, w: 8, d: 120 },
        { name: '南向大道', x: 0, z: -60, w: 8, d: 120 },
        { name: '西向大道', x: -60, z: 0, w: 8, d: 120 },
        { name: '东向大道', x: 60, z: 0, w: 8, d: 120 },
        // 对角线道路
        { name: '西北路', x: -55, z: -55, w: 6, d: 90 },
        { name: '东南路', x: 55, z: 55, w: 6, d: 90 },
        { name: '东北路', x: 55, z: -55, w: 6, d: 90 },
        { name: '西南路', x: -55, z: 55, w: 6, d: 90 },
        // 区域内部道路
        { name: '工业区环路', x: -75, z: -50, w: 50, d: 5 },
        { name: '住宅区街道', x: 75, z: -50, w: 5, d: 55 },
        { name: '港口大道', x: 85, z: 55, w: 5, d: 55 },
        { name: '机场跑道', x: 0, z: -85, w: 80, d: 6 },
        { name: '机场滑行道', x: 0, z: -100, w: 6, d: 45 },
        { name: '雷达站路', x: -95, z: 15, w: 40, d: 5 },
        { name: '靶场路', x: 0, z: 115, w: 45, d: 5 },
        { name: '发电站路', x: -105, z: 95, w: 40, d: 5 },
        { name: '水库路', x: 105, z: 95, w: 40, d: 5 },
        { name: '村庄路', x: 115, z: -80, w: 35, d: 5 },
        { name: '地下设施路', x: -115, z: -90, w: 30, d: 5 },
        // 核心区内部道路
        { name: '要塞内部路', x: 0, z: 0, w: 35, d: 4 }
    ],

    // ========== 水域 ==========
    waterAreas: [
        { x: 85, z: 75, w: 55, d: 35, name: '港口海域' },
        { x: 105, z: 105, w: 50, d: 25, name: '水库' },
        { x: -25, z: 125, w: 70, d: 20, name: '北侧河流' }
    ],

    // ========== 120+建筑 ==========
    buildings: [
        // ===== 核心区: 围墙要塞 (28栋) =====
        // 主建筑
        { x: 0, z: 0, w: 26, d: 22, h: 12, color: 0x4a6578, name: '指挥中心', landmark: true, keyType: 'blueKeycard' },
        { x: 0, z: -22, w: 16, d: 6, h: 4, color: 0x5a6a6a, name: '要塞正门' },
        { x: 18, z: -15, w: 8, d: 10, h: 5, color: 0x5a6a6a, name: '东门哨卡' },
        { x: -18, z: -15, w: 8, d: 10, h: 5, color: 0x4a5a6a, name: '西门哨卡' },
        // 弹药库区
        { x: 30, z: -10, w: 10, d: 12, h: 5, color: 0x6a5a4a, name: '弹药库A' },
        { x: 42, z: -10, w: 10, d: 12, h: 5, color: 0x6a5a4a, name: '弹药库B' },
        { x: 36, z: 5, w: 8, d: 6, h: 4, color: 0x5a5a5a, name: '引信库' },
        // 情报中心区
        { x: -28, z: 15, w: 12, d: 10, h: 6, color: 0x5a5a7a, name: '情报大楼', landmark: true },
        { x: -40, z: 15, w: 8, d: 8, h: 4, color: 0x4a5a6a, name: '密码室' },
        { x: -34, z: 28, w: 6, d: 8, h: 4, color: 0x5a5a5a, name: '通信站' },
        // 兵营区
        { x: -15, z: -25, w: 14, d: 8, h: 5, color: 0x5a6a5a, name: '兵营A' },
        { x: 15, z: -25, w: 14, d: 8, h: 5, color: 0x5a6a5a, name: '兵营B' },
        { x: 0, z: -30, w: 10, d: 6, h: 4, color: 0x6a5a5a, name: '食堂' },
        { x: -25, z: -28, w: 6, d: 6, h: 3, color: 0x5a5a5a, name: '洗衣房' },
        { x: 25, z: -28, w: 6, d: 6, h: 3, color: 0x5a5a5a, name: '澡堂' },
        // 车库与维修
        { x: -30, z: -5, w: 10, d: 8, h: 5, color: 0x5a5a5a, name: '装甲车车库' },
        { x: 30, z: 15, w: 8, d: 10, h: 4, color: 0x4a5a5a, name: '维修车间' },
        // 训练场
        { x: 0, z: 25, w: 20, d: 4, h: 1, color: 0x4a5a4a, name: '障碍训练场' },
        { x: -20, z: 25, w: 6, d: 6, h: 3, color: 0x5a6a5a, name: '体能训练房' },
        // 哨塔(制高点)
        { x: -38, z: -20, w: 5, d: 5, h: 14, color: 0x5a5a5a, name: '西北哨塔', landmark: true },
        { x: 38, z: -20, w: 5, d: 5, h: 14, color: 0x5a5a5a, name: '东北哨塔', landmark: true },
        // 围墙(用细长Box模拟)
        { x: 0, z: -38, w: 80, d: 1, h: 4, color: 0x6a6a6a, name: '南围墙' },
        { x: -42, z: 0, w: 1, d: 76, h: 4, color: 0x6a6a6a, name: '西围墙' },
        { x: 42, z: 0, w: 1, d: 76, h: 4, color: 0x6a6a6a, name: '东围墙' },
        { x: 0, z: 38, w: 80, d: 1, h: 4, color: 0x6a6a6a, name: '北围墙' },

        // ===== 工业区 (12栋) =====
        { x: -75, z: -45, w: 24, d: 20, h: 9, color: 0x6a6a5a, name: '主工厂', landmark: true, keyType: 'purpleKeycard' },
        { x: -58, z: -55, w: 10, d: 12, h: 5, color: 0x6a6a5a, name: '工具间' },
        { x: -90, z: -40, w: 12, d: 10, h: 5, color: 0x5a5a5a, name: '铸造车间' },
        { x: -65, z: -30, w: 10, d: 8, h: 4, color: 0x6a5a5a, name: '仓库A' },
        { x: -85, z: -60, w: 8, d: 8, h: 4, color: 0x5a5a5a, name: '仓库B' },
        { x: -70, z: -65, w: 6, d: 6, h: 12, color: 0x7a6a5a, name: '工业区烟囱', landmark: true },
        { x: -95, z: -50, w: 8, d: 6, h: 4, color: 0x5a6a6a, name: '变电站' },
        { x: -60, z: -40, w: 6, d: 6, h: 3, color: 0x5a5a5a, name: '零件库' },
        { x: -80, z: -30, w: 8, d: 6, h: 4, color: 0x6a5a5a, name: '废料处理站' },
        { x: -95, z: -65, w: 10, d: 8, h: 4, color: 0x5a5a5a, name: '原料仓库' },
        { x: -65, z: -55, w: 4, d: 4, h: 6, color: 0x6a6a6a, name: '水塔' },
        { x: -88, z: -30, w: 6, d: 8, h: 3, color: 0x5a5a5a, name: '维修站' },

        // ===== 住宅区 (12栋) =====
        { x: 70, z: -55, w: 18, d: 16, h: 8, color: 0x8a7a6a, name: '公寓楼A', landmark: true },
        { x: 90, z: -55, w: 14, d: 14, h: 7, color: 0x7a6a5a, name: '公寓楼B' },
        { x: 80, z: -40, w: 10, d: 8, h: 4, color: 0x6a5a5a, name: '社区诊所' },
        { x: 60, z: -45, w: 8, d: 8, h: 4, color: 0x7a5a5a, name: '理发店' },
        { x: 95, z: -40, w: 10, d: 8, h: 4, color: 0x6a5a5a, name: '洗衣店' },
        { x: 75, z: -70, w: 14, d: 10, h: 5, color: 0x7a6a5a, name: '超市' },
        { x: 60, z: -65, w: 8, d: 6, h: 4, color: 0x6a5a5a, name: '面包房' },
        { x: 95, z: -65, w: 8, d: 6, h: 4, color: 0x5a5a5a, name: '邮局' },
        { x: 80, z: -30, w: 12, d: 8, h: 4, color: 0x6a6a5a, name: '停车场' },
        { x: 65, z: -30, w: 6, d: 6, h: 3, color: 0x5a5a5a, name: '门卫室' },
        { x: 95, z: -30, w: 6, d: 6, h: 3, color: 0x5a5a5a, name: '配电室' },
        { x: 75, z: -78, w: 8, d: 6, h: 3, color: 0x6a5a5a, name: '垃圾站' },

        // ===== 港口 (12栋) =====
        { x: 75, z: 45, w: 22, d: 18, h: 8, color: 0x5a7a7a, name: '码头仓库', landmark: true, keyType: 'goldKeycard' },
        { x: 95, z: 55, w: 12, d: 16, h: 6, color: 0x5a6a6a, name: '集装箱区A' },
        { x: 95, z: 75, w: 12, d: 16, h: 6, color: 0x5a6a6a, name: '集装箱区B' },
        { x: 60, z: 60, w: 10, d: 10, h: 5, color: 0x4a5a6a, name: '港务控制室' },
        { x: 65, z: 40, w: 8, d: 8, h: 4, color: 0x4a5a5a, name: '保安室' },
        { x: 80, z: 70, w: 10, d: 8, h: 5, color: 0x5a6a7a, name: '冷库' },
        { x: 100, z: 40, w: 8, d: 10, h: 4, color: 0x5a5a6a, name: '船坞' },
        { x: 70, z: 80, w: 6, d: 6, h: 12, color: 0x4a6a7a, name: '港口灯塔', landmark: true },
        { x: 90, z: 35, w: 8, d: 6, h: 4, color: 0x5a5a5a, name: '维修站' },
        { x: 60, z: 75, w: 8, d: 8, h: 4, color: 0x5a6a6a, name: '渔具仓库' },
        { x: 105, z: 60, w: 6, d: 8, h: 4, color: 0x4a5a5a, name: '海关检查室' },
        { x: 85, z: 30, w: 10, d: 6, h: 3, color: 0x5a5a5a, name: '停车场' },

        // ===== 医疗营地 (10栋) =====
        { x: -60, z: 55, w: 18, d: 16, h: 7, color: 0x5a8a7a, name: '野战医院', landmark: true, keyType: 'redKeycard' },
        { x: -45, z: 65, w: 10, d: 10, h: 5, color: 0x4a5a5a, name: '病房楼A' },
        { x: -75, z: 65, w: 10, d: 10, h: 5, color: 0x4a5a5a, name: '病房楼B' },
        { x: -50, z: 45, w: 8, d: 8, h: 4, color: 0x5a6a5a, name: '药房' },
        { x: -70, z: 45, w: 8, d: 6, h: 4, color: 0x4a5a5a, name: '手术室' },
        { x: -55, z: 75, w: 6, d: 8, h: 3, color: 0x5a5a5a, name: '停尸房' },
        { x: -75, z: 50, w: 6, d: 6, h: 3, color: 0x5a6a6a, name: '隔离病房' },
        { x: -45, z: 55, w: 6, d: 6, h: 3, color: 0x5a5a5a, name: '行政楼' },
        { x: -65, z: 78, w: 10, d: 6, h: 3, color: 0x5a5a5a, name: '救护车停车场' },
        { x: -80, z: 58, w: 6, d: 6, h: 3, color: 0x4a5a5a, name: '血液库' },

        // ===== 空军基地 (12栋) =====
        { x: 0, z: -75, w: 22, d: 18, h: 8, color: 0x4a5a6a, name: '主机库', landmark: true },
        { x: -25, z: -85, w: 12, d: 10, h: 5, color: 0x5a5a6a, name: '维修车间' },
        { x: 25, z: -85, w: 10, d: 10, h: 5, color: 0x4a5a5a, name: '油料库' },
        { x: 0, z: -98, w: 14, d: 8, h: 6, color: 0x5a6a7a, name: '塔台', landmark: true },
        { x: -15, z: -98, w: 8, d: 6, h: 4, color: 0x5a5a5a, name: '空中交通管制室' },
        { x: 15, z: -98, w: 8, d: 6, h: 4, color: 0x5a5a5a, name: '气象站' },
        { x: -35, z: -75, w: 8, d: 8, h: 4, color: 0x4a5a5a, name: '武器挂载站' },
        { x: 35, z: -75, w: 8, d: 8, h: 4, color: 0x4a5a5a, name: '飞行员待命室' },
        { x: -30, z: -95, w: 6, d: 6, h: 8, color: 0x5a6a6a, name: '防空炮A' },
        { x: 30, z: -95, w: 6, d: 6, h: 8, color: 0x5a6a6a, name: '防空炮B' },
        { x: 0, z: -65, w: 16, d: 4, h: 1, color: 0x4a5a4a, name: '直升机坪' },
        { x: -20, z: -65, w: 6, d: 6, h: 3, color: 0x5a5a5a, name: '机场消防站' },

        // ===== 雷达站 (8栋) =====
        { x: -95, z: 15, w: 18, d: 16, h: 8, color: 0x5a5a7a, name: '雷达站主楼', landmark: true },
        { x: -80, z: 15, w: 10, d: 12, h: 5, color: 0x4a5a5a, name: '设备仓库' },
        { x: -105, z: 5, w: 12, d: 12, h: 10, color: 0x5a5a7a, name: '雷达天线', landmark: true },
        { x: -105, z: 25, w: 8, d: 8, h: 5, color: 0x5a5a5a, name: '发电机房' },
        { x: -85, z: 28, w: 6, d: 8, h: 4, color: 0x4a5a5a, name: '通信塔' },
        { x: -110, z: 15, w: 6, d: 6, h: 3, color: 0x5a5a5a, name: '配电室' },
        { x: -85, z: 5, w: 6, d: 6, h: 3, color: 0x5a5a5a, name: '值班室' },
        { x: -100, z: 35, w: 8, d: 6, h: 4, color: 0x4a5a5a, name: '信号分析室' },

        // ===== 地下设施 (8栋) =====
        { x: -115, z: -85, w: 16, d: 14, h: 6, color: 0x3a3a4a, name: '地下设施主入口', landmark: true, keyType: 'purpleKeycard' },
        { x: -100, z: -95, w: 10, d: 8, h: 4, color: 0x4a4a5a, name: '通风机房A' },
        { x: -130, z: -85, w: 10, d: 8, h: 4, color: 0x4a4a5a, name: '通风机房B' },
        { x: -115, z: -100, w: 8, d: 6, h: 4, color: 0x3a3a4a, name: '侧入口A' },
        { x: -115, z: -70, w: 8, d: 6, h: 4, color: 0x3a3a4a, name: '侧入口B' },
        { x: -105, z: -78, w: 6, d: 6, h: 3, color: 0x4a4a5a, name: '控制室' },
        { x: -125, z: -95, w: 6, d: 6, h: 3, color: 0x4a4a5a, name: '仓库' },
        { x: -108, z: -88, w: 4, d: 4, h: 8, color: 0x5a5a6a, name: '通风塔' },

        // ===== 废弃村庄 (10栋) =====
        { x: 115, z: -75, w: 12, d: 12, h: 8, color: 0x7a6a5a, name: '村庄教堂', landmark: true },
        { x: 105, z: -85, w: 10, d: 10, h: 5, color: 0x6a5a4a, name: '农舍A' },
        { x: 125, z: -85, w: 10, d: 10, h: 5, color: 0x6a5a4a, name: '农舍B' },
        { x: 110, z: -65, w: 8, d: 8, h: 4, color: 0x5a4a3a, name: '谷仓' },
        { x: 120, z: -65, w: 6, d: 6, h: 3, color: 0x6a5a4a, name: '铁匠铺' },
        { x: 100, z: -75, w: 8, d: 6, h: 4, color: 0x5a5a4a, name: '村庄学校' },
        { x: 130, z: -75, w: 6, d: 6, h: 3, color: 0x6a5a5a, name: '诊所' },
        { x: 115, z: -95, w: 10, d: 6, h: 3, color: 0x5a4a3a, name: '马厩' },
        { x: 105, z: -95, w: 4, d: 4, h: 6, color: 0x7a6a5a, name: '水井' },
        { x: 125, z: -95, w: 6, d: 6, h: 3, color: 0x5a5a4a, name: '仓库' },

        // ===== 水库大坝 (8栋) =====
        { x: 100, z: 85, w: 16, d: 12, h: 7, color: 0x4a7a8a, name: '水泵站', landmark: true },
        { x: 90, z: 100, w: 10, d: 8, h: 5, color: 0x5a8a9a, name: '净水车间' },
        { x: 115, z: 90, w: 8, d: 6, h: 4, color: 0x4a6a7a, name: '值班室' },
        { x: 95, z: 75, w: 8, d: 8, h: 4, color: 0x5a7a8a, name: '设备间' },
        { x: 110, z: 105, w: 6, d: 6, h: 3, color: 0x4a6a7a, name: '化验室' },
        { x: 120, z: 80, w: 6, d: 8, h: 4, color: 0x5a7a8a, name: '泄洪控制室' },
        { x: 85, z: 90, w: 6, d: 6, h: 3, color: 0x4a6a7a, name: '配电室' },
        { x: 105, z: 70, w: 8, d: 4, h: 3, color: 0x5a7a8a, name: '停车场' },

        // ===== 发电站 (10栋) =====
        { x: -100, z: 85, w: 22, d: 18, h: 10, color: 0x7a6a3a, name: '主发电站', landmark: true },
        { x: -85, z: 95, w: 12, d: 10, h: 6, color: 0x6a5a3a, name: '变电站' },
        { x: -115, z: 75, w: 10, d: 10, h: 5, color: 0x5a5a3a, name: '燃料库' },
        { x: -90, z: 105, w: 8, d: 8, h: 18, color: 0x6a5a5a, name: '烟囱', landmark: true },
        { x: -110, z: 100, w: 10, d: 10, h: 12, color: 0x5a6a7a, name: '冷却塔A' },
        { x: -120, z: 90, w: 10, d: 10, h: 12, color: 0x5a6a7a, name: '冷却塔B' },
        { x: -85, z: 75, w: 8, d: 6, h: 4, color: 0x5a5a5a, name: '维修车间' },
        { x: -105, z: 70, w: 6, d: 6, h: 3, color: 0x5a5a3a, name: '控制室' },
        { x: -125, z: 80, w: 6, d: 8, h: 4, color: 0x5a5a5a, name: '输煤栈桥' },
        { x: -90, z: 110, w: 8, d: 6, h: 3, color: 0x5a5a5a, name: '灰渣处理站' },

        // ===== 训练靶场 (8栋) =====
        { x: 0, z: 105, w: 16, d: 12, h: 6, color: 0x5a7a5a, name: '靶场主楼', landmark: true },
        { x: -18, z: 115, w: 10, d: 8, h: 4, color: 0x4a6a4a, name: '军械库' },
        { x: 18, z: 115, w: 10, d: 8, h: 4, color: 0x4a6a4a, name: '弹药补给点' },
        { x: -10, z: 125, w: 8, d: 4, h: 3, color: 0x5a6a5a, name: '靶棚A' },
        { x: 10, z: 125, w: 8, d: 4, h: 3, color: 0x5a6a5a, name: '靶棚B' },
        { x: 0, z: 95, w: 12, d: 6, h: 3, color: 0x4a6a4a, name: '装备领取处' },
        { x: -20, z: 105, w: 6, d: 6, h: 3, color: 0x5a6a5a, name: '教官室' },
        { x: 20, z: 105, w: 6, d: 6, h: 3, color: 0x5a6a5a, name: '医疗站' },

        // ===== 全图导航地标 =====
        { x: 0, z: 35, w: 6, d: 6, h: 28, color: 0x8a8a8a, name: '中央水塔', landmark: true },
        { x: 115, z: -65, w: 5, d: 5, h: 20, color: 0x7a6a5a, name: '教堂尖塔', landmark: true },

        // ===== 分散检查站/岗亭 =====
        { x: 45, z: -5, w: 8, d: 6, h: 4, color: 0x5a5a5a, name: '东检查站' },
        { x: -45, z: 5, w: 8, d: 6, h: 4, color: 0x4a5a5a, name: '西岗亭' },
        { x: 5, z: 45, w: 6, d: 8, h: 3, color: 0x5a6a7a, name: '北哨站' },
        { x: -5, z: -45, w: 6, d: 8, h: 3, color: 0x4a5a6a, name: '南哨站' },
        { x: 55, z: 25, w: 6, d: 6, h: 3, color: 0x5a5a6a, name: '巡逻站A' },
        { x: -55, z: -25, w: 6, d: 6, h: 3, color: 0x4a5a5a, name: '巡逻站B' },
        { x: 50, z: -30, w: 6, d: 6, h: 3, color: 0x5a5a5a, name: '临时营地' },
        { x: -50, z: 30, w: 6, d: 6, h: 3, color: 0x4a5a5a, name: '补给站' }
    ],

    // ========== 掩体/障碍物点 ==========
    coverSpots: [
        // 核心区
        { x: 10, z: -10 }, { x: -10, z: 10 }, { x: 15, z: 5 }, { x: -15, z: -5 },
        { x: 25, z: -20 }, { x: -25, z: 20 }, { x: 0, z: -15 }, { x: 0, z: 15 },
        { x: 35, z: 0 }, { x: -35, z: 0 }, { x: 20, z: 20 }, { x: -20, z: -20 },
        // 工业区
        { x: -65, z: -40 }, { x: -85, z: -50 }, { x: -70, z: -60 },
        { x: -55, z: -50 }, { x: -90, z: -55 }, { x: -75, z: -35 },
        // 住宅区
        { x: 65, z: -50 }, { x: 85, z: -60 }, { x: 75, z: -40 },
        { x: 60, z: -60 }, { x: 90, z: -45 }, { x: 70, z: -70 },
        // 港口
        { x: 70, z: 50 }, { x: 90, z: 60 }, { x: 100, z: 50 },
        { x: 65, z: 65 }, { x: 85, z: 40 }, { x: 95, z: 70 },
        // 医疗区
        { x: -55, z: 50 }, { x: -70, z: 60 }, { x: -50, z: 65 },
        { x: -65, z: 45 }, { x: -75, z: 55 },
        // 机场
        { x: -15, z: -70 }, { x: 15, z: -80 }, { x: -30, z: -90 },
        { x: 30, z: -90 }, { x: 0, z: -65 }, { x: -20, z: -75 },
        // 雷达站
        { x: -90, z: 10 }, { x: -100, z: 20 }, { x: -85, z: 20 },
        // 边境区
        { x: -110, z: -80 }, { x: -120, z: -95 }, { x: -105, z: -90 },
        { x: 110, z: -70 }, { x: 120, z: -85 }, { x: 105, z: -80 },
        { x: 100, z: 80 }, { x: 110, z: 95 }, { x: 95, z: 90 },
        { x: -95, z: 80 }, { x: -110, z: 95 }, { x: -100, z: 75 },
        { x: 0, z: 100 }, { x: -15, z: 115 }, { x: 15, z: 115 },
        // 道路旁
        { x: 55, z: 0 }, { x: -55, z: 0 }, { x: 0, z: 55 }, { x: 0, z: -55 },
        { x: 40, z: 40 }, { x: -40, z: -40 }, { x: 40, z: -40 }, { x: -40, z: 40 }
    ],

    // ========== 8个撤离点 ==========
    extracts: [
        { x: 0, z: 145, name: '北撤离点', desc: '直升机坪，常规撤离' },
        { x: 0, z: -145, name: '南撤离点', desc: '跑道尽头，常规撤离' },
        { x: 145, z: 0, name: '东撤离点', desc: '公路检查站，常规撤离' },
        { x: -145, z: 0, name: '西撤离点', desc: '边境通道，常规撤离' },
        { x: 135, z: 75, name: '港口海路撤离', desc: '海路出口，需要船只' },
        { x: -135, z: -135, name: '地下通道撤离', desc: '隐蔽撤离，需要紫色钥匙卡' },
        { x: 135, z: -125, name: '村庄小路撤离', desc: '隐蔽撤离，随机开启' },
        { x: -135, z: 125, name: '发电站铁路撤离', desc: '铁路出口，等待列车' }
    ],

    // ========== 容器分布(按区域密度) ==========
    containers: [
        // 核心区(高价值密集)
        { type: 'weaponBox', x: 5, z: 5 }, { type: 'equipBox', x: -8, z: 8 }, { type: 'ammoBox', x: 12, z: -5 },
        { type: 'supplyBox', x: -10, z: -8 }, { type: 'safe', x: 5, z: 15 }, { type: 'medBox', x: -5, z: 18 },
        { type: 'weaponBox', x: 25, z: -12 }, { type: 'equipBox', x: -25, z: 10 }, { type: 'ammoBox', x: 35, z: -10 },
        { type: 'supplyBox', x: -15, z: -15 }, { type: 'safe', x: 10, z: -20 }, { type: 'medBox', x: -12, z: 18 },
        { type: 'weaponBox', x: -30, z: 15 }, { type: 'equipBox', x: -38, z: 15 }, { type: 'ammoBox', x: 0, z: -25 },
        { type: 'supplyBox', x: 0, z: 25 }, { type: 'safe', x: -28, z: 25 }, { type: 'medBox', x: 15, z: -25 },
        { type: 'weaponBox', x: -20, z: -25 }, { type: 'equipBox', x: 20, z: -25 }, { type: 'ammoBox', x: -30, z: -5 },
        { type: 'supplyBox', x: 30, z: 15 }, { type: 'safe', x: -35, z: -20 }, { type: 'medBox', x: 35, z: -20 },

        // 工业区
        { type: 'weaponBox', x: -70, z: -40 }, { type: 'equipBox', x: -80, z: -50 }, { type: 'ammoBox', x: -90, z: -45 },
        { type: 'supplyBox', x: -65, z: -55 }, { type: 'safe', x: -75, z: -35 }, { type: 'medBox', x: -55, z: -60 },
        { type: 'weaponBox', x: -85, z: -35 }, { type: 'equipBox', x: -55, z: -45 }, { type: 'ammoBox', x: -75, z: -60 },
        { type: 'supplyBox', x: -95, z: -55 }, { type: 'safe', x: -65, z: -50 }, { type: 'medBox', x: -80, z: -40 },
        { type: 'weaponBox', x: -95, z: -65 }, { type: 'equipBox', x: -60, z: -65 }, { type: 'ammoBox', x: -88, z: -30 },

        // 住宅区
        { type: 'weaponBox', x: 65, z: -50 }, { type: 'equipBox', x: 80, z: -60 }, { type: 'ammoBox', x: 90, z: -45 },
        { type: 'supplyBox', x: 60, z: -55 }, { type: 'safe', x: 75, z: -45 }, { type: 'medBox', x: 55, z: -48 },
        { type: 'weaponBox', x: 90, z: -50 }, { type: 'equipBox', x: 65, z: -65 }, { type: 'ammoBox', x: 80, z: -40 },
        { type: 'supplyBox', x: 55, z: -60 }, { type: 'safe', x: 85, z: -60 }, { type: 'medBox', x: 75, z: -55 },
        { type: 'weaponBox', x: 75, z: -70 }, { type: 'equipBox', x: 60, z: -40 }, { type: 'ammoBox', x: 95, z: -65 },

        // 港口
        { type: 'weaponBox', x: 70, z: 40 }, { type: 'equipBox', x: 90, z: 50 }, { type: 'ammoBox', x: 80, z: 60 },
        { type: 'supplyBox', x: 65, z: 55 }, { type: 'safe', x: 80, z: 45 }, { type: 'medBox', x: 95, z: 55 },
        { type: 'weaponBox', x: 95, z: 45 }, { type: 'equipBox', x: 70, z: 65 }, { type: 'ammoBox', x: 90, z: 70 },
        { type: 'supplyBox', x: 60, z: 60 }, { type: 'safe', x: 75, z: 50 }, { type: 'medBox', x: 100, z: 50 },
        { type: 'weaponBox', x: 85, z: 35 }, { type: 'equipBox', x: 65, z: 70 }, { type: 'ammoBox', x: 100, z: 65 },

        // 医疗区
        { type: 'weaponBox', x: -55, z: 50 }, { type: 'equipBox', x: -70, z: 60 }, { type: 'ammoBox', x: -55, z: 70 },
        { type: 'supplyBox', x: -45, z: 55 }, { type: 'safe', x: -60, z: 50 }, { type: 'medBox', x: -50, z: 60 },
        { type: 'weaponBox', x: -75, z: 55 }, { type: 'equipBox', x: -45, z: 65 }, { type: 'ammoBox', x: -65, z: 45 },
        { type: 'supplyBox', x: -55, z: 75 }, { type: 'safe', x: -50, z: 55 }, { type: 'medBox', x: -75, z: 65 },
        { type: 'weaponBox', x: -65, z: 75 }, { type: 'equipBox', x: -80, z: 50 }, { type: 'ammoBox', x: -45, z: 75 },

        // 机场
        { type: 'weaponBox', x: -5, z: -70 }, { type: 'equipBox', x: 15, z: -80 }, { type: 'ammoBox', x: -20, z: -85 },
        { type: 'supplyBox', x: 5, z: -75 }, { type: 'safe', x: 0, z: -95 }, { type: 'medBox', x: 20, z: -75 },
        { type: 'weaponBox', x: 25, z: -80 }, { type: 'equipBox', x: -25, z: -75 }, { type: 'ammoBox', x: 5, z: -90 },
        { type: 'supplyBox', x: -15, z: -90 }, { type: 'safe', x: 15, z: -85 }, { type: 'medBox', x: -5, z: -85 },
        { type: 'weaponBox', x: -35, z: -75 }, { type: 'equipBox', x: 35, z: -75 }, { type: 'ammoBox', x: 0, z: -65 },

        // 雷达站
        { type: 'weaponBox', x: -90, z: 10 }, { type: 'equipBox', x: -100, z: 20 }, { type: 'ammoBox', x: -85, z: 20 },
        { type: 'supplyBox', x: -100, z: 5 }, { type: 'safe', x: -90, z: 20 }, { type: 'medBox', x: -105, z: 15 },
        { type: 'weaponBox', x: -105, z: 30 }, { type: 'equipBox', x: -80, z: 25 }, { type: 'ammoBox', x: -110, z: 10 },

        // 地下设施(高价值)
        { type: 'weaponBox', x: -110, z: -80 }, { type: 'equipBox', x: -120, z: -90 }, { type: 'ammoBox', x: -105, z: -95 },
        { type: 'supplyBox', x: -115, z: -85 }, { type: 'safe', x: -110, z: -90 }, { type: 'medBox', x: -125, z: -85 },
        { type: 'weaponBox', x: -125, z: -95 }, { type: 'equipBox', x: -100, z: -85 }, { type: 'ammoBox', x: -115, z: -75 },
        { type: 'supplyBox', x: -130, z: -80 }, { type: 'safe', x: -108, z: -88 }, { type: 'medBox', x: -120, z: -75 },

        // 废弃村庄
        { type: 'weaponBox', x: 110, z: -75 }, { type: 'equipBox', x: 120, z: -85 }, { type: 'ammoBox', x: 105, z: -80 },
        { type: 'supplyBox', x: 115, z: -70 }, { type: 'safe', x: 110, z: -85 }, { type: 'medBox', x: 125, z: -75 },
        { type: 'weaponBox', x: 100, z: -85 }, { type: 'equipBox', x: 130, z: -75 }, { type: 'ammoBox', x: 115, z: -95 },
        { type: 'supplyBox', x: 105, z: -70 }, { type: 'safe', x: 120, z: -65 }, { type: 'medBox', x: 100, z: -75 },

        // 水库
        { type: 'weaponBox', x: 100, z: 80 }, { type: 'equipBox', x: 110, z: 90 }, { type: 'ammoBox', x: 95, z: 95 },
        { type: 'supplyBox', x: 105, z: 85 }, { type: 'safe', x: 100, z: 90 }, { type: 'medBox', x: 115, z: 80 },
        { type: 'weaponBox', x: 90, z: 100 }, { type: 'equipBox', x: 120, z: 85 }, { type: 'ammoBox', x: 110, z: 100 },

        // 发电站
        { type: 'weaponBox', x: -100, z: 80 }, { type: 'equipBox', x: -110, z: 90 }, { type: 'ammoBox', x: -95, z: 95 },
        { type: 'supplyBox', x: -105, z: 85 }, { type: 'safe', x: -100, z: 90 }, { type: 'medBox', x: -115, z: 80 },
        { type: 'weaponBox', x: -85, z: 95 }, { type: 'equipBox', x: -120, z: 85 }, { type: 'ammoBox', x: -110, z: 100 },
        { type: 'supplyBox', x: -90, z: 75 }, { type: 'safe', x: -115, z: 95 }, { type: 'medBox', x: -85, z: 85 },

        // 靶场
        { type: 'weaponBox', x: 0, z: 100 }, { type: 'equipBox', x: -15, z: 110 }, { type: 'ammoBox', x: 15, z: 115 },
        { type: 'supplyBox', x: 5, z: 105 }, { type: 'safe', x: 0, z: 110 }, { type: 'medBox', x: -20, z: 105 },
        { type: 'weaponBox', x: 20, z: 105 }, { type: 'equipBox', x: -20, z: 115 }, { type: 'ammoBox', x: 10, z: 120 },

        // 道路旁分散点
        { type: 'supplyBox', x: 45, z: 0 }, { type: 'ammoBox', x: -45, z: 0 },
        { type: 'medBox', x: 0, z: 50 }, { type: 'supplyBox', x: 0, z: -50 },
        { type: 'weaponBox', x: 40, z: 40 }, { type: 'equipBox', x: -40, z: -40 },
        { type: 'ammoBox', x: 40, z: -40 }, { type: 'medBox', x: -40, z: 40 }
    ],

    // ========== 高价值容器(高危模式) ==========
    hardContainers: [
        { type: 'premiumBox', x: 5, z: 5 }, { type: 'premiumBox', x: -28, z: 15 },
        { type: 'premiumBox', x: -75, z: -45 }, { type: 'premiumBox', x: 75, z: -50 },
        { type: 'premiumBox', x: 80, z: 50 }, { type: 'premiumBox', x: -60, z: 55 },
        { type: 'premiumBox', x: 0, z: -80 }, { type: 'premiumBox', x: -95, z: 15 },
        { type: 'premiumBox', x: -110, z: -85 }, { type: 'premiumBox', x: 115, z: -80 },
        { type: 'premiumBox', x: 105, z: 85 }, { type: 'premiumBox', x: -105, z: 85 },
        { type: 'premiumBox', x: 0, z: 105 },
        { type: 'safe', x: 10, z: 0 }, { type: 'safe', x: -15, z: 5 },
        { type: 'safe', x: -70, z: -40 }, { type: 'safe', x: 80, z: -55 },
        { type: 'safe', x: 85, z: 55 }, { type: 'safe', x: -55, z: 60 },
        { type: 'safe', x: 5, z: -85 }, { type: 'safe', x: -90, z: 20 },
        { type: 'safe', x: -115, z: -90 }, { type: 'safe', x: 110, z: -75 },
        { type: 'safe', x: 100, z: 90 }, { type: 'safe', x: -100, z: 90 },
        { type: 'safe', x: 5, z: 110 }
    ],

    // ========== 地面物资点 ==========
    groundSpawns: [
        // 核心区
        { x: 5, z: -5, rarityWeights: { common: 20, uncommon: 25, rare: 22, epic: 16, legendary: 12, ultimate: 5 } },
        { x: -10, z: 10, rarityWeights: { common: 25, uncommon: 25, rare: 20, epic: 14, legendary: 11, ultimate: 5 } },
        { x: 20, z: 0, rarityWeights: { common: 30, uncommon: 25, rare: 18, epic: 13, legendary: 9, ultimate: 5 } },
        { x: -25, z: -10, rarityWeights: { common: 28, uncommon: 25, rare: 20, epic: 13, legendary: 9, ultimate: 5 } },
        // 工业区
        { x: -70, z: -45, rarityWeights: { common: 25, uncommon: 28, rare: 20, epic: 13, legendary: 9, ultimate: 5 } },
        { x: -85, z: -50, rarityWeights: { common: 30, uncommon: 25, rare: 20, epic: 13, legendary: 8, ultimate: 4 } },
        // 住宅区
        { x: 75, z: -55, rarityWeights: { common: 35, uncommon: 28, rare: 16, epic: 10, legendary: 8, ultimate: 3 } },
        { x: 65, z: -45, rarityWeights: { common: 40, uncommon: 25, rare: 15, epic: 10, legendary: 7, ultimate: 3 } },
        // 港口
        { x: 80, z: 50, rarityWeights: { common: 30, uncommon: 28, rare: 18, epic: 12, legendary: 8, ultimate: 4 } },
        { x: 90, z: 60, rarityWeights: { common: 35, uncommon: 25, rare: 18, epic: 11, legendary: 8, ultimate: 3 } },
        // 医疗区
        { x: -60, z: 55, rarityWeights: { common: 35, uncommon: 30, rare: 15, epic: 10, legendary: 7, ultimate: 3 } },
        { x: -70, z: 65, rarityWeights: { common: 40, uncommon: 25, rare: 16, epic: 10, legendary: 6, ultimate: 3 } },
        // 机场
        { x: 0, z: -80, rarityWeights: { common: 25, uncommon: 25, rare: 20, epic: 14, legendary: 10, ultimate: 6 } },
        { x: -20, z: -90, rarityWeights: { common: 30, uncommon: 25, rare: 18, epic: 13, legendary: 9, ultimate: 5 } },
        // 雷达站
        { x: -95, z: 15, rarityWeights: { common: 25, uncommon: 25, rare: 20, epic: 14, legendary: 10, ultimate: 6 } },
        // 地下设施(最高价值)
        { x: -110, z: -85, rarityWeights: { common: 10, uncommon: 18, rare: 22, epic: 22, legendary: 18, ultimate: 10 } },
        { x: -120, z: -95, rarityWeights: { common: 8, uncommon: 15, rare: 22, epic: 23, legendary: 19, ultimate: 13 } },
        // 废弃村庄
        { x: 115, z: -80, rarityWeights: { common: 40, uncommon: 28, rare: 15, epic: 9, legendary: 5, ultimate: 3 } },
        { x: 125, z: -75, rarityWeights: { common: 45, uncommon: 25, rare: 14, epic: 8, legendary: 5, ultimate: 3 } },
        // 水库
        { x: 105, z: 85, rarityWeights: { common: 35, uncommon: 28, rare: 16, epic: 10, legendary: 7, ultimate: 4 } },
        // 发电站
        { x: -105, z: 85, rarityWeights: { common: 30, uncommon: 28, rare: 18, epic: 12, legendary: 8, ultimate: 4 } },
        // 靶场
        { x: 0, z: 105, rarityWeights: { common: 35, uncommon: 28, rare: 16, epic: 10, legendary: 8, ultimate: 3 } },
        // 道路旁
        { x: 50, z: 0, rarityWeights: { common: 45, uncommon: 25, rare: 14, epic: 8, legendary: 5, ultimate: 3 } },
        { x: -50, z: 0, rarityWeights: { common: 45, uncommon: 25, rare: 14, epic: 8, legendary: 5, ultimate: 3 } },
        { x: 0, z: 55, rarityWeights: { common: 40, uncommon: 28, rare: 15, epic: 9, legendary: 5, ultimate: 3 } },
        { x: 0, z: -55, rarityWeights: { common: 40, uncommon: 28, rare: 15, epic: 9, legendary: 5, ultimate: 3 } }
    ],

    hardGroundSpawns: [
        { x: 0, z: 0, rarityWeights: { common: 12, uncommon: 18, rare: 22, epic: 20, legendary: 16, ultimate: 12 } },
        { x: -75, z: -45, rarityWeights: { common: 18, uncommon: 20, rare: 22, epic: 18, legendary: 14, ultimate: 8 } },
        { x: 75, z: -50, rarityWeights: { common: 18, uncommon: 20, rare: 22, epic: 18, legendary: 14, ultimate: 8 } },
        { x: 80, z: 50, rarityWeights: { common: 20, uncommon: 22, rare: 20, epic: 16, legendary: 14, ultimate: 8 } },
        { x: -60, z: 55, rarityWeights: { common: 22, uncommon: 22, rare: 20, epic: 16, legendary: 13, ultimate: 7 } },
        { x: 0, z: -80, rarityWeights: { common: 15, uncommon: 18, rare: 22, epic: 20, legendary: 15, ultimate: 10 } },
        { x: -95, z: 15, rarityWeights: { common: 15, uncommon: 18, rare: 22, epic: 20, legendary: 15, ultimate: 10 } },
        { x: -110, z: -85, rarityWeights: { common: 5, uncommon: 12, rare: 20, epic: 23, legendary: 22, ultimate: 18 } },
        { x: -105, z: 85, rarityWeights: { common: 18, uncommon: 20, rare: 20, epic: 18, legendary: 14, ultimate: 10 } },
        { x: 0, z: 105, rarityWeights: { common: 20, uncommon: 22, rare: 20, epic: 16, legendary: 14, ultimate: 8 } }
    ],

    // ========== 树木/植被 ==========
    trees: [
        // 边境森林带
        { x: -140, z: -50 }, { x: -145, z: -30 }, { x: -135, z: -70 },
        { x: 140, z: 50 }, { x: 145, z: 30 }, { x: 135, z: 70 },
        { x: -50, z: 140 }, { x: -30, z: 145 }, { x: -70, z: 135 },
        { x: 50, z: -140 }, { x: 30, z: -145 }, { x: 70, z: -135 },
        // 水库周边
        { x: 85, z: 110 }, { x: 120, z: 110 }, { x: 95, z: 120 },
        // 村庄周边
        { x: 100, z: -95 }, { x: 135, z: -95 }, { x: 130, z: -65 },
        // 靶场周边
        { x: -25, z: 130 }, { x: 25, z: 130 }, { x: -30, z: 105 }, { x: 30, z: 105 },
        // 工业区隔离带
        { x: -55, z: -70 }, { x: -100, z: -35 }, { x: -105, z: -70 },
        // 雷达站周边
        { x: -115, z: 0 }, { x: -115, z: 35 }, { x: -80, z: 35 },
        // 地下设施周边
        { x: -130, z: -75 }, { x: -100, z: -105 }, { x: -135, z: -100 },
        // 港口周边
        { x: 60, z: 75 }, { x: 110, z: 35 },
        // 医疗区周边
        { x: -45, z: 75 }, { x: -80, z: 45 },
        // 机场周边
        { x: -40, z: -100 }, { x: 40, z: -100 }, { x: -45, z: -65 }, { x: 45, z: -65 }
    ],

    // ========== 装饰物(环境叙事) ==========
    props: [
        // 核心区防御工事
        { type: 'barricade', x: 12, z: -28 }, { type: 'barricade', x: -12, z: -28 },
        { type: 'barricade', x: 0, z: -35 }, { type: 'sandbag', x: 20, z: -20 },
        { type: 'sandbag', x: -20, z: -20 }, { type: 'crate', x: 25, z: 0 },
        { type: 'crate', x: -25, z: 0 }, { type: 'barrel', x: 30, z: -5 },
        { type: 'barrel', x: -30, z: 5 },
        // 检查站路障
        { type: 'barricade', x: 40, z: -8 }, { type: 'barricade', x: -40, z: 8 },
        { type: 'barricade', x: 8, z: 40 }, { type: 'barricade', x: -8, z: -40 },
        // 工业区
        { type: 'barrel', x: -60, z: -35 }, { type: 'barrel', x: -90, z: -55 },
        { type: 'crate', x: -75, z: -35 }, { type: 'crate', x: -65, z: -65 },
        { type: 'barrel', x: -85, z: -65 }, { type: 'crate', x: -55, z: -55 },
        // 住宅区
        { type: 'crate', x: 65, z: -65 }, { type: 'barrel', x: 90, z: -40 },
        { type: 'crate', x: 80, z: -75 }, { type: 'barrel', x: 60, z: -50 },
        // 港口
        { type: 'crate', x: 95, z: 40 }, { type: 'crate', x: 65, z: 65 },
        { type: 'barrel', x: 85, z: 70 }, { type: 'barrel', x: 70, z: 35 },
        { type: 'crate', x: 100, z: 60 }, { type: 'crate', x: 75, z: 75 },
        // 机场
        { type: 'barricade', x: -35, z: -70 }, { type: 'barricade', x: 35, z: -70 },
        { type: 'crate', x: -25, z: -95 }, { type: 'crate', x: 25, z: -95 },
        { type: 'barrel', x: -15, z: -65 }, { type: 'barrel', x: 15, z: -65 },
        // 村庄
        { type: 'barrel', x: 105, z: -70 }, { type: 'crate', x: 130, z: -90 },
        { type: 'barricade', x: 120, z: -65 }, { type: 'crate', x: 110, z: -95 },
        // 发电站
        { type: 'barrel', x: -95, z: 75 }, { type: 'crate', x: -120, z: 100 },
        { type: 'barrel', x: -110, z: 70 }, { type: 'crate', x: -85, z: 105 },
        // 靶场
        { type: 'barricade', x: -20, z: 100 }, { type: 'barricade', x: 20, z: 100 },
        { type: 'crate', x: 0, z: 125 }, { type: 'barrel', x: -10, z: 120 },
        { type: 'barrel', x: 10, z: 120 },
        // 地下设施
        { type: 'barrel', x: -105, z: -80 }, { type: 'crate', x: -125, z: -85 },
        { type: 'barricade', x: -115, z: -75 },
        // 水库
        { type: 'barrel', x: 95, z: 80 }, { type: 'crate', x: 115, z: 95 },
        // 雷达站
        { type: 'crate', x: -85, z: 10 }, { type: 'barrel', x: -105, z: 25 },
        // 医疗区
        { type: 'crate', x: -50, z: 50 }, { type: 'barrel', x: -70, z: 70 }
    ],

    // 玩家出生点(南侧入口)
    playerSpawn: { x: 0, z: -135, rot: 3.141592653589793 },
};
