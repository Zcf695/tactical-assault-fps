// ============================================================
// 地图: 密林禁区 - 深度扩建版 v3 (300x300, 120+建筑)
// 修复: 建筑向外围扩散, 分布范围x±105, z±95
// 水域: 中央河流x15-25, 北部支流z>85, 东部溪流x>90
// ============================================================
var MAP_DATA_FOREST = {
    name: '密林禁区',
    // 地图类型：供 WorldProps 地形/道具密度分支使用。取值：military | industrial | forest
    // 注意：name「密林禁区」不含「森林」二字，故不能靠 name 正则判定类型。
    kind: 'forest',
    desc: '广阔密林中的前哨网络与隐藏设施，河流贯穿，洞穴系统，长距离交火，120+可探索点',
    mapSize: 300,
    gameTime: { normal: 1200, hard: 900 },
    enemyCount: { normal: 42, hard: 65 },
    containerCount: { normal: 180, hard: 240 },

    theme: {
        // ===== 以下数值来自 design/art/art-data-tables.md 表 A（定稿），勿自行调整 =====
        // 表 A 派生验收值：uZenith #45778d (H198 S35 L41) / uHorizon #b0b9a3 (H84 S13 L68)
        //                半球光地面色 #214022    雾距 40-175（三图中最闷，密林潜行基调）
        groundColor: 0x2f5c30,
        skyColor: 0x8fd0c0,
        fogColor: 0x9ec0b4,
        fogNear: 40,
        fogFar: 175,
        // 地面 PBR 贴图种类：密林以草地为底
        groundSurface: 'grass',
        // 屋顶女儿墙颜色：哨站/研究站为苔绿偏暗的金属顶
        roofColor: 0x36402f,
        roadColor: 0x4a4538,
        waterColor: 0x2a7a9a,
        treeColor: 0x1a5a1a,
        wallColor: 0x4a5a4a,
        coverColors: [0x6a5a3a, 0x4a5a4a, 0x5a6a45, 0x3a4a3a]
    },

    zones: [
        { name: '中央哨站', x: 0, z: 0, color: '#3a7a4a', radius: 32 },
        { name: '河畔营地', x: 85, z: 40, color: '#4a8a6a', radius: 26 },
        { name: '山脊哨塔', x: 0, z: -95, color: '#3a6a3a', radius: 24 },
        { name: '西山谷哨所', x: -95, z: -30, color: '#3a7a5a', radius: 26 },
        { name: '废弃研究站', x: -85, z: 65, color: '#5a5a6a', radius: 28 },
        { name: '地下洞穴系统', x: 75, z: -55, color: '#2a3a2a', radius: 26 },
        { name: '隐秘营地', x: 105, z: 50, color: '#4a6a3a', radius: 22 },
        { name: '密林深处', x: -75, z: -75, color: '#2a6a2a', radius: 28 },
        { name: '东部农场', x: 95, z: -65, color: '#5a7a4a', radius: 24 },
        { name: '南部沼泽', x: 30, z: 95, color: '#2a6a4a', radius: 24 },
        { name: '北部伐木场', x: -40, z: -95, color: '#4a5a3a', radius: 24 },
        { name: '瀑布峡谷', x: 30, z: -40, color: '#3a7a8a', radius: 20 },
        { name: '古树神庙', x: -30, z: 75, color: '#5a4a3a', radius: 20 },
        { name: '废弃矿井', x: 75, z: 20, color: '#4a4a4a', radius: 22 }
    ],

    waterAreas: [
        { x: 20, z: 0, w: 8, d: 150, name: '中央河流' },
        { x: -25, z: 90, w: 50, d: 8, name: '北部支流' },
        { x: 95, z: 0, w: 8, d: 60, name: '东部溪流' },
        { x: 30, z: -43, w: 12, d: 8, name: '瀑布水潭' },
        { x: 30, z: 110, w: 40, d: 15, name: '南部沼泽水域' },
        { x: -60, z: 30, w: 10, d: 30, name: '山谷湖泊' }
    ],

    roads: [
        { name: '中央林道', x: 0, z: -30, w: 5, d: 120 },
        { name: '东西巡逻路', x: -25, z: 15, w: 110, d: 5 },
        { name: '东部农场路', x: 80, z: -50, w: 5, d: 55 },
        { name: '北部伐木路', x: -40, z: -70, w: 60, d: 4 },
        { name: '南部沼泽路', x: 20, z: 75, w: 40, d: 4 },
        { name: '研究站小径', x: -75, z: 55, w: 4, d: 35 },
        { name: '洞穴入口路', x: 70, z: -45, w: 4, d: 30 },
        { name: '隐秘营地步道', x: 95, z: 40, w: 4, d: 30 },
        { name: '瀑布峡谷路', x: 25, z: -30, w: 4, d: 25 },
        { name: '古树神庙路', x: -25, z: 65, w: 4, d: 25 },
        { name: '废弃矿井路', x: 70, z: 10, w: 4, d: 25 },
        { name: '猎人小径', x: -65, z: -65, w: 3, d: 30 },
        { name: '农场便道', x: 90, z: -75, w: 3, d: 25 }
    ],

    buildings: [
        // ===== 中央哨站 (10栋, x:-25~25, z:-15~20) =====
        { x: 0, z: 0, w: 12, d: 12, h: 6, color: 0x4a6a4a, name: '主哨站', landmark: true, keyType: 'blueKeycard' },
        { x: -18, z: 5, w: 7, d: 7, h: 4, color: 0x3a5a3a, name: '兵营A' },
        { x: 18, z: 5, w: 7, d: 7, h: 4, color: 0x3a5a3a, name: '兵营B' },
        { x: -12, z: -15, w: 8, d: 5, h: 4, color: 0x4a5a4a, name: '弹药库' },
        { x: 12, z: -15, w: 7, d: 5, h: 3, color: 0x4a5a4a, name: '军械库' },
        { x: 0, z: 18, w: 8, d: 5, h: 3, color: 0x3a5a4a, name: '食堂' },
        { x: -22, z: -5, w: 5, d: 5, h: 3, color: 0x4a5a4a, name: '医务室' },
        { x: 22, z: -5, w: 5, d: 5, h: 3, color: 0x4a5a4a, name: '通讯室' },
        { x: -8, z: 18, w: 5, d: 5, h: 3, color: 0x3a5a3a, name: '洗衣房' },
        { x: 12, z: 18, w: 5, d: 5, h: 3, color: 0x3a5a3a, name: '澡堂' },

        // ===== 河畔营地 (8栋, x:75~100, z:30~55) =====
        { x: 85, z: 40, w: 10, d: 10, h: 5, color: 0x4a7a5a, name: '河边哨所', landmark: true, keyType: 'purpleKeycard' },
        { x: 98, z: 45, w: 6, d: 8, h: 4, color: 0x4a6a5a, name: '瞭望台' },
        { x: 78, z: 53, w: 6, d: 6, h: 3, color: 0x3a5a4a, name: '码头' },
        { x: 95, z: 30, w: 6, d: 5, h: 3, color: 0x4a6a5a, name: '仓库' },
        { x: 75, z: 33, w: 5, d: 5, h: 3, color: 0x3a5a4a, name: '工具棚' },
        { x: 90, z: 55, w: 5, d: 5, h: 3, color: 0x4a6a5a, name: '渔船库' },
        { x: 75, z: 47, w: 5, d: 4, h: 2, color: 0x3a5a4a, name: '维修间' },
        { x: 100, z: 37, w: 5, d: 5, h: 3, color: 0x4a6a5a, name: '保安室' },

        // ===== 山脊哨塔 (7栋, x:-15~20, z:-105~-85) =====
        { x: 0, z: -95, w: 10, d: 8, h: 5, color: 0x3a5a3a, name: '山脊哨塔', landmark: true },
        { x: -8, z: -90, w: 6, d: 8, h: 4, color: 0x4a4a3a, name: '弹药地堡' },
        { x: -15, z: -100, w: 6, d: 6, h: 3, color: 0x4a5a3a, name: '气象站' },
        { x: 18, z: -100, w: 5, d: 5, h: 3, color: 0x3a5a3a, name: '通讯站' },
        { x: 0, z: -107, w: 5, d: 5, h: 14, color: 0x5a7a5a, name: '山脊瞭望塔', landmark: true },
        { x: -10, z: -83, w: 5, d: 5, h: 3, color: 0x4a5a4a, name: '补给站' },
        { x: 12, z: -83, w: 5, d: 5, h: 3, color: 0x4a5a4a, name: '医疗站' },

        // ===== 西山谷哨所 (8栋, x:-110~-80, z:-40~-20) =====
        { x: -95, z: -30, w: 10, d: 10, h: 5, color: 0x3a6a4a, name: '山谷哨所', landmark: true, keyType: 'redKeycard' },
        { x: -83, z: -25, w: 6, d: 6, h: 4, color: 0x3a5a4a, name: '兵营' },
        { x: -107, z: -25, w: 6, d: 6, h: 4, color: 0x3a5a4a, name: '仓库' },
        { x: -87, z: -43, w: 6, d: 5, h: 3, color: 0x4a5a4a, name: '弹药库' },
        { x: -103, z: -43, w: 5, d: 5, h: 3, color: 0x4a5a4a, name: '医务室' },
        { x: -83, z: -37, w: 5, d: 5, h: 3, color: 0x3a5a3a, name: '通讯室' },
        { x: -110, z: -37, w: 4, d: 4, h: 9, color: 0x5a7a5a, name: '山谷哨塔' },
        { x: -95, z: -17, w: 6, d: 4, h: 2, color: 0x4a6a5a, name: '车库' },

        // ===== 废弃研究站 (9栋, x:-100~-70, z:55~75) =====
        { x: -85, z: 65, w: 14, d: 12, h: 7, color: 0x5a5a6a, name: '研究主楼', landmark: true, keyType: 'goldKeycard' },
        { x: -70, z: 60, w: 8, d: 8, h: 4, color: 0x4a4a5a, name: '实验室A' },
        { x: -100, z: 60, w: 8, d: 8, h: 4, color: 0x4a4a5a, name: '实验室B' },
        { x: -72, z: 75, w: 6, d: 6, h: 3, color: 0x5a5a6a, name: '数据中心' },
        { x: -98, z: 75, w: 6, d: 6, h: 3, color: 0x5a5a6a, name: '样本库' },
        { x: -85, z: 50, w: 8, d: 5, h: 3, color: 0x4a4a5a, name: '行政楼' },
        { x: -70, z: 70, w: 5, d: 5, h: 3, color: 0x5a5a6a, name: '发电机房' },
        { x: -100, z: 70, w: 5, d: 5, h: 3, color: 0x5a5a6a, name: '冷却站' },
        { x: -85, z: 80, w: 6, d: 5, h: 3, color: 0x4a4a5a, name: '废料处理' },

        // ===== 地下洞穴系统 (7栋, x:63~87, z:-65~-45) =====
        { x: 75, z: -55, w: 8, d: 8, h: 4, color: 0x2a3a2a, name: '洞穴主入口', landmark: true },
        { x: 65, z: -47, w: 5, d: 5, h: 3, color: 0x3a4a3a, name: '洞穴侧入口A' },
        { x: 85, z: -47, w: 5, d: 5, h: 3, color: 0x3a4a3a, name: '洞穴侧入口B' },
        { x: 67, z: -63, w: 6, d: 5, h: 3, color: 0x2a3a2a, name: '通风井A' },
        { x: 83, z: -63, w: 6, d: 5, h: 3, color: 0x2a3a2a, name: '通风井B' },
        { x: 75, z: -40, w: 5, d: 5, h: 3, color: 0x3a4a3a, name: '洞穴营地' },
        { x: 63, z: -57, w: 4, d: 4, h: 3, color: 0x2a3a2a, name: '秘密出口' },

        // ===== 隐秘营地 (7栋, x:95~115, z:40~60) =====
        { x: 105, z: 50, w: 8, d: 8, h: 4, color: 0x4a6a3a, name: '营地指挥所', landmark: true, keyType: 'goldKeycard' },
        { x: 95, z: 45, w: 5, d: 5, h: 3, color: 0x3a5a2a, name: '帐篷A' },
        { x: 115, z: 45, w: 5, d: 5, h: 3, color: 0x3a5a2a, name: '帐篷B' },
        { x: 98, z: 60, w: 6, d: 5, h: 3, color: 0x4a6a3a, name: '仓库' },
        { x: 112, z: 60, w: 5, d: 5, h: 3, color: 0x3a5a2a, name: '武器库' },
        { x: 95, z: 55, w: 5, d: 4, h: 2, color: 0x4a6a3a, name: '篝火区' },
        { x: 115, z: 55, w: 4, d: 4, h: 3, color: 0x3a5a2a, name: '瞭望哨' },

        // ===== 密林深处 (8栋, x:-90~-60, z:-85~-65) =====
        { x: -75, z: -75, w: 8, d: 8, h: 4, color: 0x2a4a2a, name: '猎人营地', landmark: true },
        { x: -85, z: -63, w: 6, d: 5, h: 3, color: 0x2a3a2a, name: '伐木场' },
        { x: -88, z: -80, w: 5, d: 5, h: 3, color: 0x4a4a3a, name: '工具棚' },
        { x: -65, z: -70, w: 5, d: 5, h: 3, color: 0x2a4a2a, name: '猎人小屋A' },
        { x: -90, z: -70, w: 5, d: 5, h: 3, color: 0x2a4a2a, name: '猎人小屋B' },
        { x: -70, z: -87, w: 6, d: 5, h: 3, color: 0x3a5a3a, name: '野味处理站' },
        { x: -82, z: -87, w: 5, d: 4, h: 2, color: 0x4a4a3a, name: '兽皮晾晒场' },
        { x: -62, z: -80, w: 4, d: 4, h: 7, color: 0x3a5a3a, name: '瞭望树屋' },

        // ===== 东部农场 (7栋, x:85~108, z:-75~-55) =====
        { x: 95, z: -65, w: 10, d: 10, h: 5, color: 0x5a7a5a, name: '农场主屋', landmark: true, keyType: 'goldKeycard' },
        { x: 85, z: -52, w: 6, d: 6, h: 4, color: 0x4a6a4a, name: '谷仓' },
        { x: 105, z: -52, w: 6, d: 5, h: 3, color: 0x5a7a5a, name: '马厩' },
        { x: 88, z: -75, w: 6, d: 5, h: 3, color: 0x4a6a4a, name: '农具库' },
        { x: 102, z: -75, w: 5, d: 5, h: 3, color: 0x5a7a5a, name: '鸡舍' },
        { x: 85, z: -68, w: 5, d: 4, h: 2, color: 0x4a6a4a, name: '水井' },
        { x: 105, z: -68, w: 4, d: 4, h: 3, color: 0x5a7a5a, name: '温室' },

        // ===== 南部沼泽 (7栋, x:17~43, z:85~105) =====
        { x: 30, z: 95, w: 8, d: 8, h: 4, color: 0x3a5a4a, name: '沼泽小屋', landmark: true },
        { x: 20, z: 88, w: 5, d: 5, h: 3, color: 0x2a4a3a, name: '渔屋A' },
        { x: 40, z: 88, w: 5, d: 5, h: 3, color: 0x2a4a3a, name: '渔屋B' },
        { x: 23, z: 103, w: 6, d: 4, h: 2, color: 0x3a5a4a, name: '码头' },
        { x: 37, z: 103, w: 5, d: 4, h: 2, color: 0x2a4a3a, name: '船坞' },
        { x: 17, z: 95, w: 4, d: 4, h: 3, color: 0x3a5a4a, name: '诱饵站' },
        { x: 43, z: 95, w: 4, d: 4, h: 3, color: 0x2a4a3a, name: '芦苇棚' },

        // ===== 北部伐木场 (7栋, x:-55~-25, z:-105~-85) =====
        { x: -40, z: -95, w: 10, d: 10, h: 5, color: 0x4a5a3a, name: '伐木场主楼', landmark: true },
        { x: -53, z: -85, w: 6, d: 6, h: 3, color: 0x4a5a4a, name: '电锯房' },
        { x: -27, z: -98, w: 6, d: 8, h: 3, color: 0x3a4a2a, name: '运输车棚' },
        { x: -53, z: -100, w: 6, d: 5, h: 3, color: 0x4a5a3a, name: '木材仓库' },
        { x: -27, z: -85, w: 5, d: 5, h: 3, color: 0x4a5a4a, name: '维修间' },
        { x: -45, z: -88, w: 5, d: 4, h: 2, color: 0x3a4a2a, name: '锯木台' },
        { x: -35, z: -105, w: 4, d: 4, h: 3, color: 0x4a5a3a, name: '工具棚' },

        // ===== 瀑布峡谷 (5栋, x:20~40, z:-50~-30) =====
        { x: 30, z: -40, w: 6, d: 5, h: 3, color: 0x3a7a8a, name: '观景台', landmark: true },
        { x: 22, z: -32, w: 5, d: 5, h: 3, color: 0x4a6a5a, name: '峡谷哨所' },
        { x: 38, z: -50, w: 5, d: 4, h: 2, color: 0x3a7a8a, name: '水潭码头' },
        { x: 20, z: -47, w: 4, d: 4, h: 3, color: 0x4a6a5a, name: '隐蔽营地' },
        { x: 40, z: -32, w: 4, d: 4, h: 3, color: 0x3a7a8a, name: '瀑布小屋' },

        // ===== 古树神庙 (5栋, x:-40~-20, z:68~82) =====
        { x: -30, z: 75, w: 8, d: 8, h: 5, color: 0x5a4a3a, name: '神庙主殿', landmark: true },
        { x: -20, z: 68, w: 5, d: 5, h: 3, color: 0x4a3a2a, name: '侧殿A' },
        { x: -40, z: 68, w: 5, d: 5, h: 3, color: 0x4a3a2a, name: '侧殿B' },
        { x: -25, z: 82, w: 5, d: 4, h: 2, color: 0x5a4a3a, name: '祭坛' },
        { x: -35, z: 82, w: 4, d: 4, h: 3, color: 0x4a3a2a, name: '藏宝室' },

        // ===== 废弃矿井 (7栋, x:65~85, z:10~30) =====
        { x: 75, z: 20, w: 8, d: 8, h: 4, color: 0x4a4a4a, name: '矿井主入口', landmark: true },
        { x: 65, z: 15, w: 5, d: 5, h: 3, color: 0x3a3a3a, name: '矿井侧入口' },
        { x: 85, z: 15, w: 5, d: 5, h: 3, color: 0x3a3a3a, name: '通风井' },
        { x: 70, z: 32, w: 6, d: 5, h: 3, color: 0x4a4a4a, name: '选矿厂' },
        { x: 82, z: 32, w: 5, d: 5, h: 3, color: 0x3a3a3a, name: '矿石仓库' },
        { x: 65, z: 25, w: 5, d: 5, h: 3, color: 0x4a4a4a, name: '矿工宿舍' },
        { x: 85, z: 25, w: 5, d: 5, h: 3, color: 0x3a3a3a, name: '配电室' },

        // ===== 全图导航地标 =====
        { x: 0, z: -115, w: 4, d: 4, h: 18, color: 0x5a7a5a, name: '全图瞭望塔', landmark: true },
        { x: -115, z: 10, w: 3, d: 3, h: 12, color: 0x4a6a4a, name: '西部信号塔', landmark: true },
        { x: -30, z: 65, w: 3, d: 3, h: 10, color: 0x3a5a3a, name: '古树', landmark: true },

        // ===== 分散检查站/岗亭 =====
        { x: 30, z: -25, w: 5, d: 5, h: 3, color: 0x4a5a4a, name: '巡逻站A' },
        { x: -35, z: 10, w: 5, d: 5, h: 3, color: 0x3a5a3a, name: '检查站A' },
        { x: -15, z: 40, w: 5, d: 5, h: 3, color: 0x4a4a3a, name: '休息站' },
        { x: 40, z: -55, w: 4, d: 4, h: 3, color: 0x4a5a4a, name: '临时营地A' },
        { x: -35, z: 50, w: 4, d: 4, h: 3, color: 0x3a5a3a, name: '林间哨所' },
        { x: 55, z: 10, w: 4, d: 4, h: 3, color: 0x4a5a4a, name: '巡逻站B' },
        { x: -10, z: -50, w: 4, d: 4, h: 3, color: 0x3a5a3a, name: '检查站B' },
        { x: 20, z: 60, w: 4, d: 4, h: 3, color: 0x4a4a3a, name: '临时营地B' }
    ],

    coverSpots: [
        { x: -8, z: 0 }, { x: 8, z: 0 }, { x: 0, z: -8 },
        { x: -12, z: 8 }, { x: 12, z: 8 }, { x: 0, z: 8 },
        { x: 80, z: 40 }, { x: 92, z: 45 }, { x: 85, z: 35 },
        { x: 0, z: -90 }, { x: -8, z: -95 }, { x: 8, z: -95 },
        { x: -90, z: -30 }, { x: -100, z: -35 }, { x: -88, z: -38 },
        { x: -80, z: 65 }, { x: -90, z: 70 }, { x: -82, z: 60 },
        { x: 70, z: -52 }, { x: 80, z: -48 }, { x: 75, z: -58 },
        { x: 100, z: 48 }, { x: 110, z: 45 }, { x: 105, z: 55 },
        { x: -70, z: -72 }, { x: -80, z: -78 }, { x: -72, z: -68 },
        { x: 90, z: -62 }, { x: 100, z: -68 }, { x: 95, z: -72 },
        { x: 25, z: 92 }, { x: 35, z: 90 }, { x: 30, z: 98 },
        { x: -35, z: -92 }, { x: -45, z: -98 }, { x: -38, z: -88 },
        { x: 25, z: -38 }, { x: 35, z: -35 }, { x: 30, z: -45 },
        { x: -25, z: 72 }, { x: -35, z: 77 }, { x: -28, z: 68 },
        { x: 70, z: 18 }, { x: 80, z: 23 }, { x: 73, z: 13 },
        { x: 25, z: 0 }, { x: -25, z: 0 }, { x: 0, z: 25 },
        { x: 0, z: -25 }, { x: 50, z: -20 }, { x: -50, z: 30 }
    ],

    extracts: [
        { x: 0, z: 135, name: '北林道撤离', desc: '林道出口，常规撤离' },
        { x: -135, z: 0, name: '西山口撤离', desc: '山谷出口，常规撤离' },
        { x: 135, z: 0, name: '东农场撤离', desc: '农场道路，常规撤离' },
        { x: 0, z: -135, name: '南山脊撤离', desc: '山脊小路，常规撤离' },
        { x: 75, z: -55, name: '洞穴地下撤离', desc: '洞穴系统出口，需要钥匙卡' },
        { x: 95, z: 60, name: '河畔码头撤离', desc: '河边码头，需要船只' },
        { x: -100, z: 75, name: '研究站秘密撤离', desc: '研究站地下通道，随机开启' },
        { x: 120, z: 55, name: '隐秘营地撤离', desc: '走私者路线，需要钥匙卡' }
    ],

    containers: [
        { type: 'weaponBox', x: -3, z: 0 }, { type: 'equipBox', x: 15, z: 5 }, { type: 'ammoBox', x: -10, z: -10 },
        { type: 'supplyBox', x: 10, z: -12 }, { type: 'safe', x: 0, z: -3 }, { type: 'medBox', x: -20, z: -5 },
        { type: 'weaponBox', x: 83, z: 38 }, { type: 'equipBox', x: 95, z: 43 }, { type: 'ammoBox', x: 78, z: 48 },
        { type: 'supplyBox', x: 93, z: 33 }, { type: 'safe', x: 87, z: 42 }, { type: 'medBox', x: 77, z: 35 },
        { type: 'weaponBox', x: 0, z: -93 }, { type: 'equipBox', x: -8, z: -88 }, { type: 'ammoBox', x: -12, z: -98 },
        { type: 'supplyBox', x: 15, z: -98 }, { type: 'safe', x: 0, z: -88 }, { type: 'medBox', x: 10, z: -85 },
        { type: 'weaponBox', x: -93, z: -28 }, { type: 'equipBox', x: -83, z: -25 }, { type: 'ammoBox', x: -105, z: -25 },
        { type: 'supplyBox', x: -87, z: -40 }, { type: 'safe', x: -97, z: -33 }, { type: 'medBox', x: -100, z: -38 },
        { type: 'weaponBox', x: -83, z: 63 }, { type: 'equipBox', x: -70, z: 60 }, { type: 'ammoBox', x: -98, z: 60 },
        { type: 'supplyBox', x: -72, z: 73 }, { type: 'safe', x: -85, z: 68 }, { type: 'medBox', x: -95, z: 73 },
        { type: 'weaponBox', x: 73, z: -53 }, { type: 'equipBox', x: 65, z: -48 }, { type: 'ammoBox', x: 83, z: -48 },
        { type: 'supplyBox', x: 67, z: -60 }, { type: 'safe', x: 77, z: -55 }, { type: 'medBox', x: 75, z: -42 },
        { type: 'weaponBox', x: 103, z: 48 }, { type: 'equipBox', x: 95, z: 45 }, { type: 'ammoBox', x: 113, z: 45 },
        { type: 'supplyBox', x: 98, z: 58 }, { type: 'safe', x: 105, z: 52 }, { type: 'medBox', x: 95, z: 55 },
        { type: 'weaponBox', x: -73, z: -73 }, { type: 'equipBox', x: -83, z: -65 }, { type: 'ammoBox', x: -85, z: -78 },
        { type: 'supplyBox', x: -65, z: -68 }, { type: 'safe', x: -75, z: -78 }, { type: 'medBox', x: -88, z: -73 },
        { type: 'weaponBox', x: 93, z: -63 }, { type: 'equipBox', x: 85, z: -55 }, { type: 'ammoBox', x: 103, z: -55 },
        { type: 'supplyBox', x: 88, z: -73 }, { type: 'safe', x: 95, z: -68 }, { type: 'medBox', x: 85, z: -68 },
        { type: 'weaponBox', x: 28, z: 93 }, { type: 'equipBox', x: 20, z: 88 }, { type: 'ammoBox', x: 38, z: 88 },
        { type: 'supplyBox', x: 23, z: 100 }, { type: 'safe', x: 33, z: 98 }, { type: 'medBox', x: 17, z: 93 },
        { type: 'weaponBox', x: -38, z: -93 }, { type: 'equipBox', x: -50, z: -85 }, { type: 'ammoBox', x: -27, z: -95 },
        { type: 'supplyBox', x: -50, z: -98 }, { type: 'safe', x: -40, z: -98 }, { type: 'medBox', x: -27, z: -85 },
        { type: 'weaponBox', x: 28, z: -38 }, { type: 'equipBox', x: 22, z: -32 }, { type: 'ammoBox', x: 38, z: -48 },
        { type: 'supplyBox', x: 20, z: -45 }, { type: 'safe', x: 38, z: -32 },
        { type: 'weaponBox', x: -28, z: 73 }, { type: 'equipBox', x: -20, z: 68 }, { type: 'ammoBox', x: -38, z: 68 },
        { type: 'supplyBox', x: -25, z: 80 }, { type: 'safe', x: -33, z: 80 },
        { type: 'weaponBox', x: 73, z: 18 }, { type: 'equipBox', x: 65, z: 15 }, { type: 'ammoBox', x: 83, z: 15 },
        { type: 'supplyBox', x: 70, z: 30 }, { type: 'safe', x: 80, z: 30 }, { type: 'medBox', x: 65, z: 23 },
        { type: 'supplyBox', x: 28, z: -23 }, { type: 'ammoBox', x: -33, z: 8 },
        { type: 'medBox', x: -13, z: 38 }, { type: 'supplyBox', x: 38, z: -53 }
    ],

    hardContainers: [
        { type: 'premiumBox', x: 0, z: 0 }, { type: 'premiumBox', x: 85, z: 40 },
        { type: 'premiumBox', x: -95, z: -30 }, { type: 'premiumBox', x: -85, z: 65 },
        { type: 'premiumBox', x: 75, z: -55 }, { type: 'premiumBox', x: 105, z: 50 },
        { type: 'premiumBox', x: 0, z: -95 }, { type: 'premiumBox', x: 95, z: -65 },
        { type: 'premiumBox', x: 30, z: 95 }, { type: 'premiumBox', x: -40, z: -95 },
        { type: 'premiumBox', x: 30, z: -40 }, { type: 'premiumBox', x: -30, z: 75 },
        { type: 'premiumBox', x: 75, z: 20 }, { type: 'premiumBox', x: -75, z: -75 },
        { type: 'safe', x: 8, z: 5 }, { type: 'safe', x: -8, z: -3 },
        { type: 'safe', x: 87, z: 42 }, { type: 'safe', x: -97, z: -33 },
        { type: 'safe', x: -85, z: 68 }, { type: 'safe', x: 77, z: -55 },
        { type: 'safe', x: 105, z: 52 }, { type: 'safe', x: -75, z: -78 },
        { type: 'safe', x: 95, z: -68 }, { type: 'safe', x: 33, z: 98 },
        { type: 'safe', x: -40, z: -98 }, { type: 'safe', x: 80, z: 30 }
    ],

    groundSpawns: [
        { x: 0, z: 0, rarityWeights: { common: 20, uncommon: 22, rare: 20, epic: 16, legendary: 14, ultimate: 8 } },
        { x: 8, z: 8, rarityWeights: { common: 25, uncommon: 25, rare: 20, epic: 14, legendary: 11, ultimate: 5 } },
        { x: 85, z: 40, rarityWeights: { common: 25, uncommon: 25, rare: 20, epic: 14, legendary: 11, ultimate: 5 } },
        { x: 0, z: -95, rarityWeights: { common: 30, uncommon: 25, rare: 20, epic: 13, legendary: 9, ultimate: 3 } },
        { x: -95, z: -30, rarityWeights: { common: 25, uncommon: 25, rare: 20, epic: 14, legendary: 11, ultimate: 5 } },
        { x: -85, z: 65, rarityWeights: { common: 15, uncommon: 18, rare: 22, epic: 20, legendary: 15, ultimate: 10 } },
        { x: 75, z: -55, rarityWeights: { common: 20, uncommon: 22, rare: 22, epic: 16, legendary: 13, ultimate: 7 } },
        { x: 105, z: 50, rarityWeights: { common: 25, uncommon: 25, rare: 20, epic: 14, legendary: 11, ultimate: 5 } },
        { x: -75, z: -75, rarityWeights: { common: 35, uncommon: 28, rare: 18, epic: 10, legendary: 7, ultimate: 2 } },
        { x: 95, z: -65, rarityWeights: { common: 45, uncommon: 28, rare: 14, epic: 8, legendary: 4, ultimate: 1 } },
        { x: 30, z: 95, rarityWeights: { common: 40, uncommon: 28, rare: 15, epic: 9, legendary: 6, ultimate: 2 } },
        { x: -40, z: -95, rarityWeights: { common: 35, uncommon: 28, rare: 18, epic: 10, legendary: 7, ultimate: 2 } },
        { x: 30, z: -40, rarityWeights: { common: 30, uncommon: 28, rare: 18, epic: 12, legendary: 9, ultimate: 3 } },
        { x: -30, z: 75, rarityWeights: { common: 25, uncommon: 25, rare: 20, epic: 14, legendary: 11, ultimate: 5 } },
        { x: 75, z: 20, rarityWeights: { common: 30, uncommon: 28, rare: 18, epic: 12, legendary: 9, ultimate: 3 } },
        { x: 28, z: -23, rarityWeights: { common: 45, uncommon: 28, rare: 14, epic: 8, legendary: 4, ultimate: 1 } },
        { x: -33, z: 8, rarityWeights: { common: 45, uncommon: 28, rare: 14, epic: 8, legendary: 4, ultimate: 1 } }
    ],

    hardGroundSpawns: [
        { x: 0, z: 0, rarityWeights: { common: 12, uncommon: 16, rare: 22, epic: 20, legendary: 16, ultimate: 14 } },
        { x: 85, z: 40, rarityWeights: { common: 15, uncommon: 18, rare: 22, epic: 20, legendary: 15, ultimate: 10 } },
        { x: -95, z: -30, rarityWeights: { common: 15, uncommon: 18, rare: 22, epic: 20, legendary: 15, ultimate: 10 } },
        { x: -85, z: 65, rarityWeights: { common: 8, uncommon: 12, rare: 20, epic: 24, legendary: 20, ultimate: 16 } },
        { x: 75, z: -55, rarityWeights: { common: 12, uncommon: 16, rare: 22, epic: 20, legendary: 16, ultimate: 14 } },
        { x: 105, z: 50, rarityWeights: { common: 15, uncommon: 18, rare: 22, epic: 20, legendary: 15, ultimate: 10 } },
        { x: 0, z: -95, rarityWeights: { common: 18, uncommon: 20, rare: 22, epic: 18, legendary: 14, ultimate: 8 } },
        { x: 95, z: -65, rarityWeights: { common: 20, uncommon: 22, rare: 20, epic: 16, legendary: 14, ultimate: 8 } },
        { x: 30, z: 95, rarityWeights: { common: 20, uncommon: 22, rare: 20, epic: 16, legendary: 14, ultimate: 8 } },
        { x: -40, z: -95, rarityWeights: { common: 20, uncommon: 22, rare: 20, epic: 16, legendary: 14, ultimate: 8 } },
        { x: 30, z: -40, rarityWeights: { common: 22, uncommon: 22, rare: 20, epic: 16, legendary: 13, ultimate: 7 } },
        { x: -30, z: 75, rarityWeights: { common: 18, uncommon: 20, rare: 22, epic: 18, legendary: 14, ultimate: 8 } },
        { x: 75, z: 20, rarityWeights: { common: 20, uncommon: 22, rare: 20, epic: 16, legendary: 14, ultimate: 8 } }
    ],

    trees: [
        { x: -20, z: -8 }, { x: 20, z: -8 }, { x: -15, z: 15 }, { x: 15, z: 15 },
        { x: -10, z: -18 }, { x: 10, z: -18 }, { x: -25, z: 2 }, { x: 25, z: 2 },
        { x: 75, z: 33 }, { x: 98, z: 33 }, { x: 78, z: 55 }, { x: 98, z: 55 },
        { x: 72, z: 43 }, { x: 103, z: 47 }, { x: 82, z: 58 }, { x: 92, z: 58 },
        { x: -10, z: -88 }, { x: 10, z: -88 }, { x: -15, z: -105 }, { x: 15, z: -105 },
        { x: -83, z: -23 }, { x: -107, z: -23 }, { x: -83, z: -43 }, { x: -107, z: -43 },
        { x: -78, z: -18 }, { x: -112, z: -48 }, { x: -78, z: -38 }, { x: -112, z: -33 },
        { x: -73, z: 58 }, { x: -97, z: 58 }, { x: -73, z: 78 }, { x: -97, z: 78 },
        { x: -68, z: 68 }, { x: -103, z: 73 }, { x: -78, z: 83 }, { x: -92, z: 83 },
        { x: 65, z: -48 }, { x: 85, z: -48 }, { x: 65, z: -63 }, { x: 85, z: -63 },
        { x: 95, z: 43 }, { x: 115, z: 43 }, { x: 95, z: 63 }, { x: 115, z: 63 },
        { x: -65, z: -68 }, { x: -85, z: -68 }, { x: -65, z: -83 }, { x: -85, z: -83 },
        { x: -60, z: -78 }, { x: -90, z: -83 }, { x: -68, z: -88 }, { x: -82, z: -73 },
        { x: 85, z: -58 }, { x: 105, z: -58 }, { x: 85, z: -73 }, { x: 105, z: -73 },
        { x: 20, z: 88 }, { x: 40, z: 88 }, { x: 20, z: 103 }, { x: 40, z: 103 },
        { x: -45, z: -88 }, { x: -25, z: -88 }, { x: -45, z: -103 }, { x: -25, z: -103 },
        { x: 22, z: -32 }, { x: 38, z: -32 }, { x: 22, z: -48 }, { x: 38, z: -48 },
        { x: -35, z: 68 }, { x: -25, z: 68 }, { x: -35, z: 83 }, { x: -25, z: 83 },
        { x: 65, z: 13 }, { x: 85, z: 13 }, { x: 65, z: 28 }, { x: 85, z: 28 },
        { x: 0, z: 30 }, { x: 0, z: -30 }, { x: 30, z: 0 }, { x: -30, z: 0 },
        { x: 15, z: 15 }, { x: -15, z: -15 }, { x: 15, z: -15 }, { x: -15, z: 15 },
        { x: 50, z: 15 }, { x: -50, z: -15 }, { x: 50, z: -15 }, { x: -50, z: 15 },
        { x: 8, z: 55 }, { x: -8, z: -55 }, { x: 8, z: -55 }, { x: -8, z: 55 }
    ],

    props: [
        { type: 'crate', x: -5, z: -3 }, { type: 'barrel', x: 12, z: 2 },
        { type: 'barrel', x: 80, z: 38 }, { type: 'crate', x: 92, z: 43 },
        { type: 'crate', x: 2, z: -93 }, { type: 'barrel', x: -8, z: -95 },
        { type: 'barrel', x: -90, z: -28 }, { type: 'crate', x: -100, z: -35 },
        { type: 'barricade', x: -85, z: -38 }, { type: 'barrel', x: -105, z: -33 },
        { type: 'barrel', x: -80, z: 63 }, { type: 'crate', x: -90, z: 70 },
        { type: 'barrel', x: -72, z: 73 }, { type: 'crate', x: -95, z: 68 },
        { type: 'crate', x: 68, z: -50 }, { type: 'barrel', x: 78, z: -58 },
        { type: 'crate', x: 98, z: 48 }, { type: 'barrel', x: 108, z: 58 },
        { type: 'barrel', x: -70, z: -73 }, { type: 'crate', x: -80, z: -78 },
        { type: 'crate', x: 88, z: -63 }, { type: 'barrel', x: 98, z: -70 },
        { type: 'barrel', x: 23, z: 93 }, { type: 'crate', x: 33, z: 98 },
        { type: 'crate', x: -35, z: -93 }, { type: 'barrel', x: -45, z: -98 },
        { type: 'crate', x: 25, z: -35 }, { type: 'barrel', x: 35, z: -43 },
        { type: 'crate', x: -23, z: 73 }, { type: 'barrel', x: -33, z: 78 },
        { type: 'crate', x: 68, z: 18 }, { type: 'barrel', x: 78, z: 25 },
        { type: 'barricade', x: 28, z: -20 }, { type: 'barricade', x: -30, z: 8 },
        { type: 'barricade', x: -10, z: 38 }, { type: 'barricade', x: 35, z: -50 }
    ],

    playerSpawn: { x: 0, z: -130, rot: 3.141592653589793 },
};
