/**
 * tests/harness/probes.mjs
 * 所有 page.evaluate 片段的单一真相源。
 *
 * 约定：每个导出函数都会被 playwright 序列化后在页面里执行，
 * 因此**必须是自包含的**（只引用页面全局，不引用本模块的其他变量）。
 *
 * 页面全局来自 index.html 里的 classic script 顶层 let/const，
 * 可直接按名访问（已实测）。任何一处不存在都不应抛异常，返回 undefined 让断言去判。
 */

/* ---------- SMK-01 启动与模块就位 ---------- */

export function probeBoot() {
  const safe = (fn, fallback) => {
    try { return fn(); } catch (e) { return fallback; }
  };
  return {
    phase: safe(() => S.phase, null),
    startGameReady: safe(() => typeof startGame === 'function', false),
    loadingScreenDisplay: safe(() => document.getElementById('loadingScreen').style.display, ''),
    defined: {
      RenderPipeline: typeof RenderPipeline !== 'undefined',
      GraphicsEnhancement: typeof GraphicsEnhancement !== 'undefined',
      WorldProps: typeof WorldProps !== 'undefined',
      GameSettings: typeof GameSettings !== 'undefined',
      EnemyAI: typeof EnemyAI !== 'undefined',
      PerformanceGuard: typeof PerformanceGuard !== 'undefined',
      PBRTextures: typeof PBRTextures !== 'undefined',
      ItemIcons: typeof ItemIcons !== 'undefined',
      InspectViewer: typeof InspectViewer !== 'undefined',
      AudioEngine: typeof AudioEngine !== 'undefined',
      WeaponFX: typeof WeaponFX !== 'undefined',
      WeaponADS: typeof WeaponADS !== 'undefined',
      PlayerAnimation: typeof PlayerAnimation !== 'undefined',
      ResourceLoader: typeof ResourceLoader !== 'undefined',
    },
    // 关键：默认 false，init 成功才 true。是「静默未初始化」的指示灯。
    enabled: {
      renderPipeline: safe(() => RenderPipeline.isEnabled(), false),
      graphicsEnhancement: safe(() => GraphicsEnhancement.isEnabled(), false),
      settingsObject: safe(() => typeof GameSettings.getSettings() === 'object', false),
    },
    pbrReady: safe(() => PBRTextures.kinds.filter((k) => PBRTextures.ready(k)), []),
    waterMeshes: safe(() => GraphicsEnhancement.getWaterMeshes().length, -1),
    guardLevel: safe(() => PerformanceGuard.getLevel(), -1),
  };
}

/* ---------- SMK-02 / REG-01 内容量 ---------- */

export function probeContent() {
  const ud = (typeof mapEnvironmentGroup !== 'undefined' && mapEnvironmentGroup && mapEnvironmentGroup.userData) || {};
  const num = (v) => (typeof v === 'number' ? v : -1);
  return {
    mapName: (typeof MAP_DATA !== 'undefined' && MAP_DATA && MAP_DATA.name) || null,
    mapSize: (typeof MAP_DATA !== 'undefined' && MAP_DATA && MAP_DATA.mapSize) || null,
    cfgMapSize: (typeof CONFIG !== 'undefined' && CONFIG.mapSize) || null,
    propsPlaced: Array.isArray(ud.worldPropsPlaced) ? ud.worldPropsPlaced.length : -1,
    propsRejects: ud.worldPropsRejects || null,
    containers: num(typeof containers !== 'undefined' ? containers.length : -1),
    enemies: num(typeof enemies !== 'undefined' ? enemies.length : -1),
    groundLoot: num(typeof groundLootItems !== 'undefined' ? groundLootItems.length : -1),
    extractPoints: num(typeof extractPoints !== 'undefined' ? extractPoints.length : -1),
    obstacles: num(typeof obstacles !== 'undefined' ? obstacles.length : -1),
    sceneChildren: num(typeof scene !== 'undefined' && scene ? scene.children.length : -1),
    envChildren: num(
      typeof mapEnvironmentGroup !== 'undefined' && mapEnvironmentGroup ? mapEnvironmentGroup.children.length : -1,
    ),
  };
}

/* ---------- REG-02 地面 UV 平铺 ---------- */

export function probeGroundUV(designTile) {
  const g = mapEnvironmentGroup && mapEnvironmentGroup.children && mapEnvironmentGroup.children[0];
  if (!g || !g.geometry || !g.geometry.attributes || !g.geometry.attributes.uv) {
    return { found: false };
  }
  const uv = g.geometry.attributes.uv;
  let lo = Infinity;
  let hi = -Infinity;
  let loY = Infinity;
  let hiY = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    const x = uv.getX(i);
    const y = uv.getY(i);
    if (x < lo) lo = x;
    if (x > hi) hi = x;
    if (y < loY) loY = y;
    if (y > hiY) hiY = y;
  }
  const mapSize = (typeof MAP_DATA !== 'undefined' && MAP_DATA && MAP_DATA.mapSize) || CONFIG.mapSize;
  return {
    found: true,
    geoType: g.geometry.type,
    spanX: +(hi - lo).toFixed(2),
    spanY: +(hiY - loY).toFixed(2),
    mapSize,
    designTile,
    expectedSpan: +(mapSize / designTile).toFixed(2),
    effectiveTile: +((hi - lo) > 0 ? mapSize / (hi - lo) : 0).toFixed(2),
    locked: !!g.geometry.userData._pbrUV,
    hasMap: !!(g.material && g.material.map),
    pbrLockedCount: (() => {
      let n = 0;
      mapEnvironmentGroup.traverse((o) => {
        if (o.geometry && o.geometry.userData && o.geometry.userData._pbrUV) n++;
      });
      return n;
    })(),
  };
}

/* ---------- SMK-03 射击与换弹 ---------- */

export function setupWeaponForCombat() {
  S.weaponSlots = ['rifle', 'pistol', 'shotgun', 'knife'];
  S.magAmmo = [30, 15, 8, 0];
  S._rigItems = ['rifleAmmo', 'rifleAmmo'];
  S.currentWeapon = 0;
  S.isReloading = false;
  S.weaponJammed = false;
  S._isSearching = false;
  updateWeaponModel();
  updateWeaponUI();
  // 必须同步 ADS 系统，否则 _currentScope 仍指向匕首，startAim() 会静默 return
  try {
    if (typeof WeaponADS !== 'undefined') WeaponADS.setWeapon('rifle');
  } catch (e) {}
  const adsScope = (() => {
    try {
      WeaponADS.startAim();
      const before = WeaponADS.getAimProgress();
      WeaponADS.stopAim();
      return { aimReachable: true, progressAtStart: before };
    } catch (e) {
      return { aimReachable: false, error: String(e && e.message) };
    }
  })();
  return { mag: S.magAmmo[0], rig: S._rigItems.length, weapon: S.weaponSlots[0], adsScope };
}

/** 打 n 发（每次清掉射速节流，保证扣弹数确定）。返回打完后的状态。 */
export function fireShots(n) {
  let fired = 0;
  for (let i = 0; i < n; i++) {
    const before = S.magAmmo[S.currentWeapon];
    S.lastShot = -1e9; // 绕过 fireRate 节流，避免「少扣弹」的伪失败
    shoot();
    if (S.magAmmo[S.currentWeapon] < before) fired++;
  }
  return { fired, mag: S.magAmmo[S.currentWeapon] };
}

/** 空仓射击（触发自动换弹）。 */
export function fireOnEmptyMag() {
  S.magAmmo[S.currentWeapon] = 0;
  S.lastShot = -1e9;
  shoot();
  return {
    isReloading: !!S.isReloading,
    mag: S.magAmmo[S.currentWeapon],
    rigLeft: (S._rigItems || []).filter((i) => i === 'rifleAmmo').length,
  };
}

export function doReload() {
  S.isReloading = false; // 允许显式 reload（自动换弹可能仍在进行）
  S.magAmmo[S.currentWeapon] = 5;
  reload();
  return {
    isReloading: !!S.isReloading,
    mag: S.magAmmo[S.currentWeapon],
    rigLeft: (S._rigItems || []).filter((i) => i === 'rifleAmmo').length,
  };
}

export function readReloadState() {
  return { isReloading: !!S.isReloading, mag: S.magAmmo[S.currentWeapon] };
}

export function fireOnceAfterReload() {
  S.lastShot = -1e9;
  const before = S.magAmmo[S.currentWeapon];
  shoot();
  return { before, after: S.magAmmo[S.currentWeapon] };
}

/* ---------- SMK-04 开镜 ADS ---------- */

export function adsStart() {
  const fov0 = camera.fov;
  WeaponADS.startAim();
  return { fov0 };
}

export function adsRead() {
  return { progress: +WeaponADS.getAimProgress().toFixed(3), fov: +camera.fov.toFixed(2) };
}

export function adsStopAndRead() {
  WeaponADS.stopAim();
  return true;
}

/* ---------- SMK-05 拾取 ---------- */

export function pickupFirstLoot() {
  const gl = groundLootItems.find((g) => !g.taken);
  if (!gl) return { found: false };
  const def = ITEMS[gl.itemId] || {};
  const before = S.lootValue;
  const gridBefore = {
    backpack: (S.backpack && S.backpack._items ? S.backpack._items.length : 0),
    secure: (S.secureContainer && S.secureContainer._items ? S.secureContainer._items.length : 0),
    keychain: (S.keychain || []).filter(Boolean).length,
  };
  pickupGroundLoot(gl);
  const gridAfter = {
    backpack: (S.backpack && S.backpack._items ? S.backpack._items.length : 0),
    secure: (S.secureContainer && S.secureContainer._items ? S.secureContainer._items.length : 0),
    keychain: (S.keychain || []).filter(Boolean).length,
  };
  return {
    found: true,
    itemId: gl.itemId,
    name: def.name || null,
    defValue: typeof def.value === 'number' ? def.value : -1,
    taken: !!gl.taken,
    lootBefore: before,
    lootAfter: S.lootValue,
    delta: S.lootValue - before,
    inLootList: (S._lootItems || []).some((i) => i.id === gl.itemId),
    gridBefore,
    gridAfter,
    gridGained:
      gridAfter.backpack + gridAfter.secure + gridAfter.keychain -
      (gridBefore.backpack + gridBefore.secure + gridBefore.keychain),
  };
}

/* ---------- SMK-06 背包 ---------- */

export function backpackOpen() {
  openBackpack();
  const el = document.getElementById('backpackScreen');
  return {
    phase: S.phase,
    display: el ? getComputedStyle(el).display : '',
    // 注意：局内背包渲染到 bpBackpackGrid / bpRigGrid / bpPocketGrid / bpCharSlots，
    // backpackGrid/rigGrid/pocketGrid 属于搜索界面，别搞混（首轮就是这么错的）
    backpackCells: (document.getElementById('bpBackpackGrid') || { children: [] }).children.length,
    rigCells: (document.getElementById('bpRigGrid') || { children: [] }).children.length,
    pocketCells: (document.getElementById('bpPocketGrid') || { children: [] }).children.length,
    charSlots: (document.getElementById('bpCharSlots') || { children: [] }).children.length,
    weightText: (document.getElementById('bpWeight') || {}).textContent || '',
    // 胸挂/背包未装备时对应网格本就不渲染（0 个子节点是正确行为，不是缺陷）
    equipment: {
      chestRig: (S.equipment && S.equipment.chestRig) || null,
      backpack: (S.equipment && S.equipment.backpack) || null,
    },
    backpackCols: S.backpackCols,
  };
}

export function backpackClose() {
  closeBackpack();
  const el = document.getElementById('backpackScreen');
  return { phase: S.phase, display: el ? getComputedStyle(el).display : '' };
}

/* ---------- SMK-07 搜索容器 ---------- */

export function searchOpen() {
  const c = (typeof containers !== 'undefined' ? containers : []).find((x) => x && x.items && x.items.length > 0);
  if (!c) return { found: false };
  const searchedBefore = S.containersSearched;
  openSearch(c);
  const el = document.getElementById('searchScreen');
  const grid = document.getElementById('containerGrid');
  return {
    found: true,
    name: c.name,
    phase: S.phase,
    display: el ? getComputedStyle(el).display : '',
    searchedBefore,
    searchedAfter: S.containersSearched,
    cells: grid ? grid.children.length : -1,
    expectCells: (c.gridW || 0) * (c.gridH || 0),
    itemCount: c.items.length,
    revealedAll: Array.isArray(c._revealed) ? c._revealed.every(Boolean) : false,
  };
}

export function searchRevealState() {
  const c = S.currentSearchContainer;
  if (!c) return { alive: false };
  return {
    alive: true,
    revealed: Array.isArray(c._revealed) ? c._revealed.filter(Boolean).length : -1,
    total: Array.isArray(c._revealed) ? c._revealed.length : -1,
    all: Array.isArray(c._revealed) ? c._revealed.every(Boolean) : false,
    cells: (document.getElementById('containerGrid') || { children: [] }).children.length,
    gridCells: (document.getElementById('containerGrid') || { querySelectorAll: () => [] }).querySelectorAll('.grid-cell')
      .length,
    childClasses: Array.from((document.getElementById('containerGrid') || { children: [] }).children).map(
      (el) => el.className,
    ),
    gridW: c.gridW,
    gridH: c.gridH,
    expectCells: (c.gridW || 0) * (c.gridH || 0),
  };
}

export function searchClose() {
  closeSearch();
  const el = document.getElementById('searchScreen');
  return { phase: S.phase, display: el ? getComputedStyle(el).display : '' };
}

/* ---------- SMK-08 3D 检视器 ---------- */

export function inspectOpen(itemId) {
  InspectViewer.open(itemId);
  const root = document.getElementById('ivRoot');
  const poly = document.getElementById('ivPoly');
  const name = document.getElementById('ivName');
  const def = ITEMS[itemId] || {};
  const redOverlay = document.getElementById('redInspectionOverlay');
  return {
    isOpen: InspectViewer.isOpen(),
    rootClass: root ? root.className : '',
    rootVisible: root ? getComputedStyle(root).display !== 'none' : false,
    nameText: name ? name.textContent : '',
    expectName: def.name || '',
    polyText: poly ? poly.textContent : '',
    // 红卡检视是另一套叠加层，会额外占用一个 WebGL 上下文；用于诊断「检视器打不开」
    redOverlayDisplay: redOverlay ? getComputedStyle(redOverlay).display : 'none',
    webglContexts: (() => {
      try {
        return document.querySelectorAll('canvas').length;
      } catch (e) {
        return -1;
      }
    })(),
  };
}

export function inspectState() {
  const root = document.getElementById('ivRoot');
  const poly = document.getElementById('ivPoly');
  const name = document.getElementById('ivName');
  return {
    isOpen: InspectViewer.isOpen(),
    rootClass: root ? root.className : '',
    rootVisible: root ? getComputedStyle(root).display !== 'none' : false,
    nameText: name ? name.textContent : '',
    polyText: poly ? poly.textContent : '',
  };
}

export function inspectClose() {
  InspectViewer.close();
  return { isOpen: InspectViewer.isOpen(), phase: S.phase };
}

/* ---------- SMK-08 前置：把敌人挪开，隔离「受击自动关闭检视器」 ---------- */
/**
 * animation_enhancement.js:329 onPlayerHit() 会在玩家受伤时**按设计**关闭 3D 检视器。
 * 测检视器本身时必须先排除交火干扰，否则 1/4 概率被打断，会被误判成 flaky 缺陷。
 * 返回被挪走的敌人数与玩家当前血量，便于断言「确实没有挨打」。
 */
export function parkEnemiesAway() {
  const p = playerGroup.position;
  let moved = 0;
  for (const e of enemies) {
    if (!e || !e.mesh || !e.mesh.position) continue;
    // 丢到玩家 60m 外、地图边缘方向，且保持原有高度
    e.mesh.position.set(p.x + 240, e.mesh.position.y, p.z + 240);
    moved++;
  }
  return { moved, health: S.health, maxHealth: S.maxHealth };
}

/* ---------- SMK-11 / REG-03 性能 ---------- */

export function probeFrame() {
  const f = window.__perfFrame || null;
  let calls = null;
  let programs = null;
  let triangles = null;
  try {
    calls = renderer.info.render.calls;
    triangles = renderer.info.render.triangles;
    programs = renderer.info.programs ? renderer.info.programs.length : null;
  } catch (e) {}
  return {
    frame: f,
    calls,
    triangles,
    programs,
    guardLevel: typeof PerformanceGuard !== 'undefined' ? PerformanceGuard.getLevel() : -1,
    dpr: typeof renderer !== 'undefined' ? renderer.getPixelRatio() : -1,
    resolution: typeof renderer !== 'undefined' ? [renderer.domElement.width, renderer.domElement.height] : null,
    quality:
      typeof GameSettings !== 'undefined' && GameSettings.getSettings
        ? GameSettings.getSettings().graphics.quality
        : null,
    enemies: typeof enemies !== 'undefined' ? enemies.length : -1,
  };
}

/** 把 3 个敌人挪到玩家 12m 内，制造交战压力（用于 REG-03）。 */
export function moveEnemiesNear() {
  try {
    const p = playerGroup.position;
    let moved = 0;
    for (const e of enemies) {
      if (moved >= 3) break;
      if (!e || !e.mesh || !e.mesh.position) continue;
      const a = Math.random() * Math.PI * 2;
      e.mesh.position.set(p.x + Math.cos(a) * 12, e.mesh.position.y, p.z + Math.sin(a) * 12);
      moved++;
    }
    return { moved };
  } catch (e) {
    return { moved: 0, error: String(e && e.message ? e.message : e) };
  }
}

/* ---------- SMK-09 地图切换 ---------- */

export function switchMapAndStart(mapId) {
  const before = {
    mapName: (MAP_DATA && MAP_DATA.name) || null,
    sceneChildren: scene ? scene.children.length : -1,
  };
  selectMap(mapId);
  startGame();
  return { before, mapId };
}

/* ---------- SMK-10 撤离结算 ---------- */

export function beforeExtract() {
  return {
    money: P.money,
    lootValue: S.lootValue,
    extracts: P.stats.extracts,
    phase: S.phase,
  };
}

export function doExtract() {
  endGame(true);
  const txt = (id) => (document.getElementById(id) || {}).textContent || '';
  const shown = (id) => {
    const el = document.getElementById(id);
    return el ? getComputedStyle(el).display !== 'none' : false;
  };
  return {
    phase: S.phase,
    money: P.money,
    extracts: P.stats.extracts,
    hudShown: shown('gameHUD'),
    resultShown: shown('resultScreen'),
    title: txt('resultTitle'),
    valueText: txt('resultValue'),
    kills: txt('resultKills'),
  };
}

/* ---------- window.__qa 契约快照（未实现时回退合成） ---------- */

export function probeQaHook() {
  if (typeof window.__qa !== 'undefined' && window.__qa) {
    return { source: 'window.__qa', qa: window.__qa };
  }
  return { source: 'composed-fallback', qa: null };
}
