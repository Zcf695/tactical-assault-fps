// ============================================================
// 地图: 港口城市 - 深度扩建版 v3 (300x300, 120+建筑)
// 修复: 建筑向外围扩散, 分布范围x±105, z±85
// 水域: 东部海域x>120, 南部海湾z<-105, 内河z>95
// ============================================================
var MAP_DATA_INDUSTRIAL = {
    name: '港口城市',
    // 地图类型：供 WorldProps 地形/道具密度分支使用。取值：military | industrial | forest
    kind: 'industrial',
    desc: '港口工业与城市CBD交融的复合型地图，水域环绕，多层建筑巷战，120+可探索建筑',
    mapSize: 300,
    gameTime: { normal: 1200, hard: 900 },
    enemyCount: { normal: 48, hard: 72 },
    containerCount: { normal: 190, hard: 250 },

    theme: {
        // ===== 以下数值来自 design/art/art-data-tables.md 表 A（定稿），勿自行调整 =====
        // 表 A 派生验收值：uZenith #566a7f (H210 S19 L42) / uHorizon #d9c1a3 (H34 S41 L74)
        //                半球光地面色 #3b3a35    雾距 95-290（三图中最通透，CBD 远景）
        // 注意：groundSurface 'asphalt' 与路面同贴图，路/地靠「贴图平铺差」
        //      （地 5.5 m vs 路 3.2 m）+ WorldProps.addRoadMarkings 的标线区分，不靠颜色对比。
        groundColor: 0x55534c,
        skyColor: 0xbcae9a,
        fogColor: 0xdccdb4,
        fogNear: 95,
        fogFar: 290,
        groundSurface: 'asphalt',
        // 屋顶女儿墙颜色：仓库与厂房多为深灰铁皮
        roofColor: 0x424a55,
        roadColor: 0x4a4a42,
        waterColor: 0x2a6080,
        wallColor: 0x555555,
        coverColors: [0x6a5a4a, 0x5a5a5a, 0x7a6a5a, 0x4a5a6a]
    },

    zones: [
        { name: '主码头', x: 105, z: -35, color: '#4a7a8a', radius: 30 },
        { name: '集装箱港区', x: 105, z: 5, color: '#4a6a7a', radius: 28 },
        { name: '造船厂', x: 105, z: -70, color: '#3a5a6a', radius: 25 },
        { name: '中央CBD', x: 0, z: 0, color: '#6a7a8a', radius: 38 },
        { name: '购物中心', x: -35, z: -35, color: '#7a6a8a', radius: 24 },
        { name: '老城住宅区', x: -95, z: -55, color: '#7a6a5a', radius: 30 },
        { name: '炼油厂', x: 0, z: 85, color: '#5a5a4a', radius: 28 },
        { name: '发电厂', x: -95, z: 30, color: '#5a5a6a', radius: 26 },
        { name: '仓储物流区', x: -65, z: 0, color: '#6a6a5a', radius: 28 },
        { name: '渔村', x: -85, z: 85, color: '#5a8a6a', radius: 24 },
        { name: '中央公园', x: 35, z: 35, color: '#4a8a5a', radius: 20 },
        { name: '医院', x: -35, z: 40, color: '#5a8a7a', radius: 20 },
        { name: '大学城', x: 65, z: 75, color: '#6a7a5a', radius: 24 },
        { name: '地铁站', x: 0, z: -25, color: '#5a5a7a', radius: 16 }
    ],

    waterAreas: [
        { x: 130, z: 0, w: 25, d: 200, name: '东部海域' },
        { x: 30, z: -120, w: 140, d: 20, name: '南部海湾' },
        { x: -20, z: 110, w: 100, d: 10, name: '内河航道' },
        { x: 115, z: 30, w: 10, d: 40, name: '港口池' },
        { x: -100, z: 95, w: 25, d: 12, name: '渔村海湾' }
    ],

    roads: [
        { name: '中央大道', x: 0, z: 0, w: 10, d: 140 },
        { name: '滨海大道', x: 60, z: 0, w: 8, d: 140 },
        { name: '工业大道', x: -50, z: 0, w: 8, d: 130 },
        { name: '东西大街', x: 0, z: 0, w: 150, d: 8 },
        { name: '环城路', x: 0, z: 50, w: 130, d: 6 },
        { name: '南城路', x: 0, z: -55, w: 110, d: 6 },
        { name: '码头路', x: 100, z: -30, w: 25, d: 5 },
        { name: '港区路', x: 100, z: 5, w: 25, d: 5 },
        { name: '造船厂路', x: 100, z: -65, w: 25, d: 5 },
        { name: '炼油厂路', x: 0, z: 80, w: 35, d: 5 },
        { name: '发电厂路', x: -90, z: 25, w: 30, d: 5 },
        { name: '仓储区路', x: -60, z: 0, w: 25, d: 5 },
        { name: '老城街道', x: -90, z: -50, w: 5, d: 40 },
        { name: '学院路', x: 60, z: 70, w: 25, d: 5 },
        { name: '渔村路', x: -80, z: 80, w: 25, d: 4 }
    ],

    buildings: [
        // ===== 主码头区 (10栋, x:95~115, z:-55~-15) =====
        { x: 105, z: -30, w: 20, d: 14, h: 9, color: 0x3a6a7a, name: '码头主楼', landmark: true, keyType: 'blueKeycard' },
        { x: 95, z: -45, w: 10, d: 8, h: 4, color: 0x3a5a6a, name: '渔船仓库' },
        { x: 115, z: -25, w: 8, d: 8, h: 5, color: 0x4a6a7a, name: '调度中心' },
        { x: 110, z: -43, w: 8, d: 6, h: 4, color: 0x4a5a6a, name: '海关检查室' },
        { x: 118, z: -40, w: 6, d: 10, h: 4, color: 0x3a5a6a, name: '冷链仓库' },
        { x: 95, z: -20, w: 6, d: 6, h: 3, color: 0x4a5a5a, name: '码头办公室' },
        { x: 105, z: -53, w: 8, d: 5, h: 3, color: 0x4a5a5a, name: '港口消防站' },
        { x: 98, z: -53, w: 5, d: 5, h: 12, color: 0x5a7a8a, name: '港口灯塔', landmark: true },
        { x: 118, z: -15, w: 6, d: 6, h: 3, color: 0x4a6a7a, name: '保安亭' },
        { x: 100, z: -15, w: 6, d: 5, h: 3, color: 0x4a5a5a, name: '集装箱维修站' },

        // ===== 集装箱港区 (8栋, x:95~115, z:-10~25) =====
        { x: 105, z: 5, w: 14, d: 14, h: 6, color: 0x4a6a7a, name: '集装箱堆场A', landmark: true },
        { x: 115, z: 5, w: 10, d: 10, h: 5, color: 0x3a5a6a, name: '集装箱堆场B' },
        { x: 105, z: 23, w: 10, d: 10, h: 5, color: 0x4a6a7a, name: '集装箱堆场C' },
        { x: 115, z: 23, w: 8, d: 8, h: 4, color: 0x3a5a6a, name: '空箱区' },
        { x: 95, z: 15, w: 6, d: 8, h: 4, color: 0x4a5a6a, name: '堆场办公室' },
        { x: 110, z: 35, w: 8, d: 6, h: 3, color: 0x4a5a5a, name: '叉车车库' },
        { x: 95, z: 30, w: 6, d: 5, h: 3, color: 0x3a5a6a, name: '称重站' },
        { x: 95, z: 0, w: 5, d: 5, h: 3, color: 0x4a6a7a, name: '保安室' },

        // ===== 造船厂 (7栋, x:95~115, z:-80~-60) =====
        { x: 105, z: -70, w: 16, d: 14, h: 7, color: 0x4a6a7a, name: '造船厂主厂房', landmark: true },
        { x: 92, z: -65, w: 8, d: 6, h: 4, color: 0x3a5a6a, name: '船坞A' },
        { x: 118, z: -65, w: 8, d: 6, h: 4, color: 0x3a5a6a, name: '船坞B' },
        { x: 95, z: -80, w: 6, d: 6, h: 3, color: 0x4a5a6a, name: '零件仓库' },
        { x: 112, z: -80, w: 6, d: 5, h: 3, color: 0x4a5a5a, name: '涂装车间' },
        { x: 105, z: -55, w: 8, d: 5, h: 3, color: 0x4a6a7a, name: '设计楼' },
        { x: 92, z: -77, w: 5, d: 5, h: 3, color: 0x3a5a6a, name: '工具间' },

        // ===== 中央CBD (14栋, x:-25~25, z:-20~20) =====
        { x: 0, z: 0, w: 14, d: 14, h: 20, color: 0x5a7a9a, name: '国贸中心', landmark: true, keyType: 'blueKeycard' },
        { x: -20, z: 5, w: 10, d: 10, h: 16, color: 0x6a7a9a, name: '金融大厦A' },
        { x: 20, z: 5, w: 10, d: 10, h: 16, color: 0x6a7a9a, name: '金融大厦B' },
        { x: -10, z: -18, w: 10, d: 8, h: 12, color: 0x5a6a8a, name: '写字楼A' },
        { x: 12, z: -18, w: 10, d: 8, h: 12, color: 0x5a6a8a, name: '写字楼B' },
        { x: -25, z: -8, w: 8, d: 8, h: 10, color: 0x6a7a8a, name: '律师楼' },
        { x: 25, z: -8, w: 8, d: 8, h: 10, color: 0x6a7a8a, name: '会计楼' },
        { x: 0, z: 18, w: 10, d: 6, h: 8, color: 0x5a7a8a, name: '会展中心' },
        { x: -15, z: 18, w: 6, d: 6, h: 6, color: 0x4a6a7a, name: '商务酒店' },
        { x: 15, z: 18, w: 6, d: 6, h: 6, color: 0x4a6a7a, name: '精品酒店' },
        { x: -25, z: 12, w: 6, d: 10, h: 8, color: 0x5a6a7a, name: '保险大楼' },
        { x: 25, z: 12, w: 6, d: 10, h: 8, color: 0x5a6a7a, name: '证券大楼' },
        { x: 0, z: -30, w: 8, d: 6, h: 5, color: 0x4a5a6a, name: '地铁站入口', landmark: true },
        { x: 10, z: -10, w: 6, d: 5, h: 3, color: 0x3a4a5a, name: '地下停车场入口' },

        // ===== 购物中心 (7栋, x:-50~-25, z:-45~-25) =====
        { x: -35, z: -35, w: 16, d: 12, h: 10, color: 0x7a6a8a, name: '城市购物中心', landmark: true, keyType: 'purpleKeycard' },
        { x: -48, z: -30, w: 8, d: 6, h: 5, color: 0x6a5a7a, name: '电器城' },
        { x: -25, z: -43, w: 6, d: 8, h: 4, color: 0x6a5a7a, name: '服装市场' },
        { x: -43, z: -43, w: 6, d: 6, h: 4, color: 0x5a4a6a, name: '美食广场' },
        { x: -23, z: -32, w: 5, d: 6, h: 3, color: 0x6a5a7a, name: '便利店' },
        { x: -50, z: -40, w: 5, d: 5, h: 3, color: 0x5a4a6a, name: '药店' },
        { x: -35, z: -48, w: 8, d: 5, h: 3, color: 0x6a5a7a, name: '电影院' },

        // ===== 老城住宅区 (10栋, x:-110~-80, z:-70~-40) =====
        { x: -95, z: -55, w: 12, d: 12, h: 10, color: 0x7a6a5a, name: '公寓楼A', landmark: true },
        { x: -108, z: -55, w: 10, d: 10, h: 8, color: 0x6a5a4a, name: '公寓楼B' },
        { x: -95, z: -70, w: 10, d: 10, h: 8, color: 0x7a6a5a, name: '公寓楼C' },
        { x: -108, z: -70, w: 8, d: 8, h: 6, color: 0x6a5a4a, name: '公寓楼D' },
        { x: -83, z: -62, w: 6, d: 5, h: 3, color: 0x5a4a3a, name: '社区诊所' },
        { x: -113, z: -60, w: 6, d: 5, h: 3, color: 0x5a4a3a, name: '幼儿园' },
        { x: -90, z: -43, w: 8, d: 5, h: 3, color: 0x6a5a4a, name: '菜市场' },
        { x: -108, z: -43, w: 6, d: 5, h: 3, color: 0x5a4a3a, name: '理发店' },
        { x: -83, z: -73, w: 6, d: 5, h: 3, color: 0x6a5a4a, name: '杂货店' },
        { x: -100, z: -78, w: 5, d: 5, h: 3, color: 0x5a4a3a, name: '修车铺' },

        // ===== 炼油厂 (9栋, x:-15~20, z:70~95) =====
        { x: 0, z: 85, w: 16, d: 12, h: 8, color: 0x5a5a3a, name: '炼油主厂', landmark: true, keyType: 'goldKeycard' },
        { x: 18, z: 80, w: 6, d: 6, h: 4, color: 0x4a5a3a, name: '控制室A' },
        { x: -12, z: 75, w: 6, d: 8, h: 3, color: 0x5a5a4a, name: '变压器房' },
        { x: 12, z: 97, w: 8, d: 6, h: 4, color: 0x4a5a3a, name: '储油罐区' },
        { x: -8, z: 97, w: 6, d: 6, h: 3, color: 0x5a5a4a, name: '泵房' },
        { x: -20, z: 85, w: 5, d: 6, h: 3, color: 0x4a5a3a, name: '化验室' },
        { x: 22, z: 95, w: 5, d: 5, h: 12, color: 0x6a5a4a, name: '炼油烟囱', landmark: true },
        { x: -15, z: 100, w: 6, d: 5, h: 3, color: 0x5a5a4a, name: '维修车间' },
        { x: 5, z: 73, w: 5, d: 5, h: 3, color: 0x4a5a3a, name: '安保室' },

        // ===== 发电厂 (7栋, x:-110~-85, z:15~45) =====
        { x: -95, z: 30, w: 14, d: 12, h: 10, color: 0x5a5a6a, name: '发电主厂房', landmark: true, keyType: 'redKeycard' },
        { x: -82, z: 23, w: 8, d: 8, h: 5, color: 0x4a5a5a, name: '变电站' },
        { x: -108, z: 20, w: 8, d: 8, h: 4, color: 0x4a5a5a, name: '燃料库' },
        { x: -85, z: 43, w: 8, d: 8, h: 14, color: 0x5a6a7a, name: '冷却塔A' },
        { x: -102, z: 43, w: 8, d: 8, h: 14, color: 0x5a6a7a, name: '冷却塔B' },
        { x: -82, z: 37, w: 6, d: 5, h: 3, color: 0x4a5a5a, name: '控制室' },
        { x: -108, z: 35, w: 5, d: 6, h: 3, color: 0x4a5a5a, name: '输煤栈桥' },

        // ===== 仓储物流区 (7栋, x:-80~-55, z:-12~15) =====
        { x: -65, z: 0, w: 18, d: 14, h: 7, color: 0x6a6a5a, name: '大型仓库', landmark: true, keyType: 'purpleKeycard' },
        { x: -50, z: 8, w: 8, d: 8, h: 4, color: 0x5a5a4a, name: '仓库A' },
        { x: -78, z: 8, w: 8, d: 8, h: 4, color: 0x5a5a4a, name: '仓库B' },
        { x: -55, z: -12, w: 6, d: 6, h: 3, color: 0x5a5a5a, name: '物流办公室' },
        { x: -72, z: -12, w: 6, d: 5, h: 3, color: 0x5a5a4a, name: '包装车间' },
        { x: -52, z: 18, w: 5, d: 6, h: 3, color: 0x4a5a4a, name: '叉车车库' },
        { x: -78, z: 18, w: 5, d: 5, h: 3, color: 0x5a5a4a, name: '维修站' },

        // ===== 渔村 (7栋, x:-100~-75, z:75~95) =====
        { x: -85, z: 85, w: 12, d: 10, h: 5, color: 0x5a8a6a, name: '村公所', landmark: true },
        { x: -75, z: 75, w: 6, d: 6, h: 3, color: 0x4a7a5a, name: '渔屋A' },
        { x: -95, z: 75, w: 6, d: 6, h: 3, color: 0x4a7a5a, name: '渔屋B' },
        { x: -75, z: 92, w: 6, d: 5, h: 3, color: 0x3a6a4a, name: '维修店' },
        { x: -95, z: 92, w: 5, d: 5, h: 3, color: 0x4a6a5a, name: '渔具店' },
        { x: -85, z: 98, w: 6, d: 5, h: 3, color: 0x3a5a4a, name: '海鲜市场' },
        { x: -68, z: 85, w: 4, d: 4, h: 6, color: 0x4a7a6a, name: '渔村灯塔' },

        // ===== 中央公园 (5栋, x:25~45, z:25~45) =====
        { x: 35, z: 35, w: 8, d: 6, h: 3, color: 0x4a8a5a, name: '公园管理处' },
        { x: 27, z: 43, w: 6, d: 5, h: 2, color: 0x5a9a6a, name: '咖啡馆' },
        { x: 43, z: 27, w: 5, d: 5, h: 2, color: 0x4a8a5a, name: '公共厕所' },
        { x: 30, z: 27, w: 6, d: 3, h: 2, color: 0x5a9a6a, name: '喷泉广场' },
        { x: 27, z: 30, w: 3, d: 3, h: 5, color: 0x5a9a6a, name: '钟楼' },

        // ===== 医院 (5栋, x:-45~-25, z:30~50) =====
        { x: -35, z: 40, w: 12, d: 10, h: 8, color: 0x5a8a7a, name: '市立医院', landmark: true, keyType: 'redKeycard' },
        { x: -25, z: 33, w: 6, d: 6, h: 4, color: 0x4a7a6a, name: '门诊楼' },
        { x: -45, z: 33, w: 6, d: 6, h: 4, color: 0x4a7a6a, name: '住院楼' },
        { x: -30, z: 50, w: 6, d: 5, h: 3, color: 0x5a8a7a, name: '急诊中心' },
        { x: -43, z: 47, w: 5, d: 5, h: 3, color: 0x4a7a6a, name: '太平间' },

        // ===== 大学城 (7栋, x:50~75, z:65~85) =====
        { x: 65, z: 75, w: 12, d: 10, h: 6, color: 0x6a7a5a, name: '图书馆', landmark: true },
        { x: 55, z: 65, w: 8, d: 8, h: 5, color: 0x5a6a4a, name: '教学楼A' },
        { x: 75, z: 65, w: 8, d: 8, h: 5, color: 0x5a6a4a, name: '教学楼B' },
        { x: 55, z: 82, w: 6, d: 6, h: 4, color: 0x6a7a5a, name: '实验楼' },
        { x: 75, z: 82, w: 6, d: 6, h: 4, color: 0x6a7a5a, name: '计算机楼' },
        { x: 65, z: 60, w: 8, d: 5, h: 3, color: 0x5a6a4a, name: '行政楼' },
        { x: 50, z: 75, w: 5, d: 5, h: 3, color: 0x6a7a5a, name: '食堂' },

        // ===== 全图导航地标 =====
        { x: 0, z: 12, w: 5, d: 5, h: 28, color: 0x7a8a9a, name: '城市电视塔', landmark: true },
        { x: -115, z: -40, w: 4, d: 4, h: 18, color: 0x6a5a4a, name: '老城钟楼', landmark: true },

        // ===== 分散检查站/岗亭 =====
        { x: 55, z: -20, w: 6, d: 5, h: 3, color: 0x4a5a6a, name: '东检查站' },
        { x: -50, z: 15, w: 6, d: 5, h: 3, color: 0x4a5a5a, name: '西岗亭' },
        { x: 10, z: 55, w: 5, d: 6, h: 3, color: 0x5a6a7a, name: '北哨站' },
        { x: -10, z: -50, w: 5, d: 6, h: 3, color: 0x4a5a6a, name: '南哨站' },
        { x: 85, z: 0, w: 5, d: 5, h: 3, color: 0x4a6a7a, name: '港区入口' },
        { x: -80, z: -15, w: 5, d: 5, h: 3, color: 0x5a5a5a, name: '工业区入口' },
        { x: 15, z: -40, w: 5, d: 5, h: 3, color: 0x5a6a7a, name: '地铁站出口' },
        { x: -80, z: -75, w: 5, d: 5, h: 3, color: 0x4a5a6a, name: '老城入口' }
    ],

    coverSpots: [
        { x: 98, z: -30 }, { x: 112, z: -25 }, { x: 105, z: -40 },
        { x: 100, z: 5 }, { x: 112, z: 10 }, { x: 105, z: 20 },
        { x: -8, z: 0 }, { x: 8, z: 0 }, { x: 0, z: -8 },
        { x: -12, z: 8 }, { x: 12, z: 8 }, { x: -18, z: -12 },
        { x: 18, z: -12 }, { x: 0, z: 12 },
        { x: -40, z: -35 }, { x: -30, z: -40 }, { x: -43, z: -30 },
        { x: -100, z: -55 }, { x: -110, z: -60 }, { x: -95, z: -65 },
        { x: -5, z: 85 }, { x: 8, z: 90 }, { x: -10, z: 80 },
        { x: -90, z: 28 }, { x: -100, z: 33 }, { x: -88, z: 23 },
        { x: -58, z: 0 }, { x: -68, z: 5 }, { x: -62, z: 8 },
        { x: 33, z: 33 }, { x: -30, z: 0 }, { x: 0, z: 22 },
        { x: 0, z: -22 }, { x: 45, z: -30 }, { x: -40, z: 40 }
    ],

    extracts: [
        { x: 125, z: -30, name: '码头海路撤离', desc: '海路出口，需要船只' },
        { x: 0, z: 135, name: '北公路撤离', desc: '公路检查站，常规撤离' },
        { x: -135, z: 0, name: '西铁路撤离', desc: '铁路出口，等待列车' },
        { x: 0, z: -135, name: '南高速撤离', desc: '高速公路入口，常规撤离' },
        { x: -95, z: 95, name: '渔村小路撤离', desc: '隐蔽撤离，随机开启' },
        { x: 120, z: 30, name: '港口船坞撤离', desc: '船坞出口，需要船只' },
        { x: -120, z: -80, name: '老城地下撤离', desc: '地下通道，需要钥匙卡' },
        { x: 120, z: -90, name: '造船厂撤离', desc: '船坞出口，常规撤离' }
    ],

    containers: [
        { type: 'weaponBox', x: 100, z: -28 }, { type: 'equipBox', x: 113, z: -28 }, { type: 'ammoBox', x: 105, z: -40 },
        { type: 'supplyBox', x: 117, z: -20 }, { type: 'safe', x: 105, z: -33 }, { type: 'medBox', x: 110, z: -45 },
        { type: 'weaponBox', x: 100, z: 8 }, { type: 'equipBox', x: 113, z: 8 }, { type: 'ammoBox', x: 105, z: 20 },
        { type: 'supplyBox', x: 113, z: 23 }, { type: 'safe', x: 108, z: 15 }, { type: 'medBox', x: 98, z: 18 },
        { type: 'weaponBox', x: -3, z: 0 }, { type: 'equipBox', x: 18, z: 5 }, { type: 'ammoBox', x: -15, z: -8 },
        { type: 'supplyBox', x: 18, z: -12 }, { type: 'safe', x: 0, z: -3 }, { type: 'medBox', x: -23, z: -5 },
        { type: 'weaponBox', x: 22, z: 5 }, { type: 'equipBox', x: -22, z: -5 }, { type: 'ammoBox', x: 8, z: 15 },
        { type: 'supplyBox', x: -8, z: 15 }, { type: 'safe', x: 12, z: -15 }, { type: 'medBox', x: -12, z: -15 },
        { type: 'weaponBox', x: -35, z: -33 }, { type: 'equipBox', x: -45, z: -30 }, { type: 'ammoBox', x: -27, z: -40 },
        { type: 'supplyBox', x: -43, z: -40 }, { type: 'safe', x: -35, z: -38 }, { type: 'medBox', x: -25, z: -33 },
        { type: 'weaponBox', x: -93, z: -53 }, { type: 'equipBox', x: -105, z: -57 }, { type: 'ammoBox', x: -93, z: -68 },
        { type: 'supplyBox', x: -105, z: -68 }, { type: 'safe', x: -95, z: -63 }, { type: 'medBox', x: -85, z: -60 },
        { type: 'weaponBox', x: 0, z: 83 }, { type: 'equipBox', x: 15, z: 78 }, { type: 'ammoBox', x: -10, z: 73 },
        { type: 'supplyBox', x: 10, z: 95 }, { type: 'safe', x: -3, z: 88 }, { type: 'medBox', x: -18, z: 83 },
        { type: 'weaponBox', x: -92, z: 28 }, { type: 'equipBox', x: -82, z: 23 }, { type: 'ammoBox', x: -105, z: 20 },
        { type: 'supplyBox', x: -88, z: 38 }, { type: 'safe', x: -85, z: 32 }, { type: 'medBox', x: -105, z: 32 },
        { type: 'weaponBox', x: -58, z: 0 }, { type: 'equipBox', x: -70, z: 5 }, { type: 'ammoBox', x: -62, z: 8 },
        { type: 'supplyBox', x: -75, z: 8 }, { type: 'safe', x: -65, z: -8 }, { type: 'medBox', x: -52, z: 2 },
        { type: 'weaponBox', x: -82, z: 82 }, { type: 'equipBox', x: -75, z: 78 }, { type: 'ammoBox', x: -93, z: 78 },
        { type: 'supplyBox', x: -78, z: 90 }, { type: 'safe', x: -85, z: 85 }, { type: 'medBox', x: -75, z: 85 },
        { type: 'medBox', x: -33, z: 38 }, { type: 'medBox', x: -25, z: 35 }, { type: 'medBox', x: -43, z: 35 },
        { type: 'supplyBox', x: -30, z: 48 }, { type: 'safe', x: -37, z: 43 }, { type: 'equipBox', x: -25, z: 43 },
        { type: 'weaponBox', x: 63, z: 73 }, { type: 'equipBox', x: 55, z: 68 }, { type: 'ammoBox', x: 73, z: 68 },
        { type: 'supplyBox', x: 58, z: 80 }, { type: 'safe', x: 68, z: 80 }, { type: 'medBox', x: 52, z: 75 },
        { type: 'supplyBox', x: 33, z: 33 }, { type: 'medBox', x: 28, z: 37 },
        { type: 'supplyBox', x: 52, z: -18 }, { type: 'ammoBox', x: -48, z: 13 },
        { type: 'medBox', x: 8, z: 53 }, { type: 'supplyBox', x: -8, z: -48 }
    ],

    hardContainers: [
        { type: 'premiumBox', x: 0, z: 0 }, { type: 'premiumBox', x: 105, z: -30 },
        { type: 'premiumBox', x: -65, z: 0 }, { type: 'premiumBox', x: 0, z: 85 },
        { type: 'premiumBox', x: -95, z: 30 }, { type: 'premiumBox', x: -35, z: -35 },
        { type: 'premiumBox', x: 105, z: 5 }, { type: 'premiumBox', x: -35, z: 40 },
        { type: 'premiumBox', x: 65, z: 75 }, { type: 'premiumBox', x: -95, z: -55 },
        { type: 'safe', x: 8, z: 5 }, { type: 'safe', x: -8, z: -3 },
        { type: 'safe', x: 105, z: -33 }, { type: 'safe', x: 108, z: 15 },
        { type: 'safe', x: -65, z: -8 }, { type: 'safe', x: -3, z: 88 },
        { type: 'safe', x: -85, z: 32 }, { type: 'safe', x: -35, z: -38 },
        { type: 'safe', x: -95, z: -63 }, { type: 'safe', x: 68, z: 80 }
    ],

    groundSpawns: [
        { x: 0, z: 0, rarityWeights: { common: 20, uncommon: 22, rare: 20, epic: 16, legendary: 14, ultimate: 8 } },
        { x: 8, z: 8, rarityWeights: { common: 25, uncommon: 25, rare: 20, epic: 14, legendary: 11, ultimate: 5 } },
        { x: 105, z: -30, rarityWeights: { common: 25, uncommon: 25, rare: 20, epic: 14, legendary: 11, ultimate: 5 } },
        { x: 105, z: 5, rarityWeights: { common: 30, uncommon: 25, rare: 20, epic: 13, legendary: 9, ultimate: 3 } },
        { x: -35, z: -35, rarityWeights: { common: 30, uncommon: 28, rare: 18, epic: 12, legendary: 9, ultimate: 3 } },
        { x: -95, z: -55, rarityWeights: { common: 40, uncommon: 28, rare: 15, epic: 9, legendary: 6, ultimate: 2 } },
        { x: 0, z: 85, rarityWeights: { common: 25, uncommon: 25, rare: 20, epic: 14, legendary: 11, ultimate: 5 } },
        { x: -95, z: 30, rarityWeights: { common: 25, uncommon: 25, rare: 20, epic: 14, legendary: 11, ultimate: 5 } },
        { x: -65, z: 0, rarityWeights: { common: 30, uncommon: 28, rare: 18, epic: 12, legendary: 9, ultimate: 3 } },
        { x: -85, z: 85, rarityWeights: { common: 45, uncommon: 28, rare: 14, epic: 8, legendary: 4, ultimate: 1 } },
        { x: -35, z: 40, rarityWeights: { common: 35, uncommon: 30, rare: 15, epic: 10, legendary: 7, ultimate: 3 } },
        { x: 65, z: 75, rarityWeights: { common: 40, uncommon: 28, rare: 15, epic: 9, legendary: 6, ultimate: 2 } },
        { x: 35, z: 35, rarityWeights: { common: 50, uncommon: 25, rare: 13, epic: 7, legendary: 4, ultimate: 1 } },
        { x: 52, z: -18, rarityWeights: { common: 45, uncommon: 28, rare: 14, epic: 8, legendary: 4, ultimate: 1 } },
        { x: -48, z: 13, rarityWeights: { common: 45, uncommon: 28, rare: 14, epic: 8, legendary: 4, ultimate: 1 } }
    ],

    hardGroundSpawns: [
        { x: 0, z: 0, rarityWeights: { common: 12, uncommon: 16, rare: 22, epic: 20, legendary: 16, ultimate: 14 } },
        { x: 105, z: -30, rarityWeights: { common: 15, uncommon: 18, rare: 22, epic: 20, legendary: 15, ultimate: 10 } },
        { x: -65, z: 0, rarityWeights: { common: 18, uncommon: 20, rare: 22, epic: 18, legendary: 14, ultimate: 8 } },
        { x: 0, z: 85, rarityWeights: { common: 15, uncommon: 18, rare: 22, epic: 20, legendary: 15, ultimate: 10 } },
        { x: -95, z: 30, rarityWeights: { common: 15, uncommon: 18, rare: 22, epic: 20, legendary: 15, ultimate: 10 } },
        { x: -35, z: -35, rarityWeights: { common: 20, uncommon: 22, rare: 20, epic: 16, legendary: 14, ultimate: 8 } },
        { x: 105, z: 5, rarityWeights: { common: 20, uncommon: 22, rare: 20, epic: 16, legendary: 14, ultimate: 8 } },
        { x: -35, z: 40, rarityWeights: { common: 22, uncommon: 22, rare: 20, epic: 16, legendary: 13, ultimate: 7 } },
        { x: 65, z: 75, rarityWeights: { common: 25, uncommon: 25, rare: 20, epic: 14, legendary: 11, ultimate: 5 } },
        { x: -95, z: -55, rarityWeights: { common: 25, uncommon: 25, rare: 20, epic: 14, legendary: 11, ultimate: 5 } }
    ],

    trees: [
        { x: 30, z: 30 }, { x: 40, z: 40 }, { x: 25, z: 40 }, { x: 45, z: 30 },
        { x: 33, z: 25 }, { x: 40, z: 47 }, { x: 25, z: 47 }, { x: 47, z: 40 },
        { x: 57, z: 68 }, { x: 73, z: 68 }, { x: 60, z: 85 }, { x: 70, z: 85 },
        { x: -75, z: 80 }, { x: -95, z: 80 }, { x: -78, z: 95 }, { x: -92, z: 95 },
        { x: -88, z: -48 }, { x: -113, z: -55 }, { x: -93, z: -78 }, { x: -108, z: -72 },
        { x: 50, z: 8 }, { x: -48, z: -8 }, { x: 8, z: 48 }, { x: -8, z: -38 },
        { x: -18, z: 95 }, { x: 18, z: 92 }, { x: -28, z: 78 },
        { x: -108, z: 18 }, { x: -108, z: 43 }, { x: -78, z: 48 },
        { x: 92, z: -53 }, { x: 115, z: -53 }, { x: 98, z: 2 },
        { x: 97, z: -77 }, { x: 115, z: -77 },
        { x: 0, z: 30 }, { x: 0, z: -30 }, { x: 30, z: 0 }, { x: -30, z: 0 },
        { x: 15, z: 15 }, { x: -15, z: -15 }, { x: 15, z: -15 }, { x: -15, z: 15 },
        { x: 50, z: 15 }, { x: -50, z: -15 }, { x: 50, z: -15 }, { x: -50, z: 15 },
        { x: 8, z: 55 }, { x: -8, z: -55 }, { x: 8, z: -55 }, { x: -8, z: 55 }
    ],

    props: [
        { type: 'barrel', x: 98, z: -33 }, { type: 'crate', x: 113, z: -23 },
        { type: 'barrel', x: 108, z: -43 }, { type: 'crate', x: 98, z: -20 },
        { type: 'crate', x: 98, z: 12 }, { type: 'crate', x: 113, z: 22 },
        { type: 'barrel', x: 108, z: 32 }, { type: 'barrel', x: 113, z: 12 },
        { type: 'barricade', x: 8, z: -3 }, { type: 'barricade', x: -8, z: 3 },
        { type: 'crate', x: 18, z: 0 }, { type: 'barrel', x: -18, z: 0 },
        { type: 'crate', x: -40, z: -32 }, { type: 'barrel', x: -28, z: -43 },
        { type: 'barrel', x: -98, z: -53 }, { type: 'crate', x: -108, z: -63 },
        { type: 'barricade', x: -92, z: -62 }, { type: 'barrel', x: -108, z: -53 },
        { type: 'barrel', x: 3, z: 83 }, { type: 'barrel', x: -8, z: 90 },
        { type: 'crate', x: 12, z: 95 }, { type: 'barrel', x: -15, z: 83 },
        { type: 'barrel', x: -92, z: 25 }, { type: 'crate', x: -100, z: 37 },
        { type: 'barrel', x: -85, z: 33 }, { type: 'crate', x: -105, z: 23 },
        { type: 'crate', x: -58, z: 2 }, { type: 'crate', x: -72, z: 8 },
        { type: 'barrel', x: -65, z: -8 }, { type: 'barrel', x: -75, z: 2 },
        { type: 'barrel', x: -80, z: 82 }, { type: 'crate', x: -88, z: 90 },
        { type: 'crate', x: 58, z: 68 }, { type: 'barrel', x: 68, z: 78 },
        { type: 'barricade', x: 52, z: -15 }, { type: 'barricade', x: -48, z: 10 },
        { type: 'barricade', x: 8, z: 50 }, { type: 'barricade', x: -8, z: -45 }
    ],

    playerSpawn: { x: 0, z: -130, rot: 3.141592653589793 },
};
