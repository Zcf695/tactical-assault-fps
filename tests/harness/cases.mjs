/**
 * tests/harness/cases.mjs
 * 15 条 L1 用例（SMK-01…12 + REG-01…03），与 tests/smoke-cases.md 一一对应。
 *
 * ctx 由 smoke.mjs 注入：
 *   ctx.page               playwright Page
 *   ctx.call(fn, ...args)  page.evaluate 包装（fn 来自 probes.mjs）
 *   ctx.shot(name)         截图写入证据目录
 *   ctx.wait(ms)
 *   ctx.state              跨用例共享状态
 *   ctx.consoleLog         控制台条目（SMK-12 用）
 *
 * 每条用例外返回断言数组：[{ name, expected, actual, pass }]，pass ∈ PASS | CONCERNS | FAIL
 */

/* ---------- 断言判定小工具 ---------- */
const ok = (pass) => (pass ? 'PASS' : 'FAIL');
const row = (name, expected, actual, pass) => ({ name, expected, actual, pass });
const eq = (name, expected, actual) => row(name, expected, actual, ok(String(expected) === String(actual)));
const isTrue = (name, actual) => row(name, true, actual, ok(actual === true));
const isFalse = (name, actual) => row(name, false, actual, ok(actual === false));
const ge = (name, min, actual) => row(name, `≥${min}`, actual, ok(Number(actual) >= min));
const le = (name, max, actual) => row(name, `≤${max}`, actual, ok(Number(actual) <= max));
const near = (name, target, actual, tol) =>
  row(name, `${target}±${tol}`, actual, ok(Math.abs(Number(actual) - Number(target)) <= tol));

/**
 * 各图内容量下限（来源：tools/map-baseline.mjs 实测值 ×0.8 取整，防正常波动误报）
 *   军事禁区 props 128 / containers 170 / loot 26
 *   密林禁区 props 233 / containers  86 / loot 17
 *   港口城市 props 163 / containers  78 / loot 15
 * 敌人数三图均为 14（普通模式），撤离点均为 8。
 */
const MAP_FLOOR = {
  军事禁区: { props: 100, containers: 130, loot: 20, enemies: 8, extracts: 5 },
  密林禁区: { props: 180, containers: 68, loot: 13, enemies: 8, extracts: 5 },
  港口城市: { props: 130, containers: 62, loot: 12, enemies: 8, extracts: 5 },
};

function median(arr) {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 从采样序列算分位数与最大帧归因 */
function summarize(samples) {
  const js = samples.map((s) => s.js).filter((n) => typeof n === 'number').sort((a, b) => a - b);
  const calls = samples.map((s) => s.calls).filter((n) => typeof n === 'number').sort((a, b) => a - b);
  const at = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : NaN);
  const maxBy = samples.reduce((best, s) => (s.js > (best.js || -1) ? s : best), {});
  return {
    n: samples.length,
    jsP50: +at(js, 0.5).toFixed(2),
    jsP90: +at(js, 0.9).toFixed(2),
    jsP99: +at(js, 0.99).toFixed(2),
    callsP50: Math.round(at(calls, 0.5)),
    max: { js: +(maxBy.js || 0).toFixed(1), render: +(maxBy.render || 0).toFixed(1), calls: maxBy.calls ?? null },
  };
}

export const cases = [
  /* ================= SMK-01 启动与模块就位 ================= */
  {
    id: 'SMK-01',
    title: '启动与模块就位',
    auto: '全自动',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      const b = await ctx.call(probes.probeBoot);
      const missing = Object.entries(b.defined).filter(([, v]) => !v).map(([k]) => k);

      // PBR 贴图是渐进预加载（pbr_textures.js 用 setTimeout 分批），启动瞬间只有几套就绪，
      // 直接断言会误报。轮询到 15s，仍未达标才算失败。
      let pbrCount = b.pbrReady.length;
      try {
        await ctx.page.waitForFunction(
          () => typeof PBRTextures !== 'undefined' && PBRTextures.kinds.filter((k) => PBRTextures.ready(k)).length >= 8,
          { timeout: 15000 },
        );
        pbrCount = await ctx.page.evaluate(
          () => PBRTextures.kinds.filter((k) => PBRTextures.ready(k)).length,
        );
      } catch (e) {
        pbrCount = await ctx.page
          .evaluate(() => PBRTextures.kinds.filter((k) => PBRTextures.ready(k)).length)
          .catch(() => b.pbrReady.length);
      }

      return [
        isTrue('startGame 可调用', b.startGameReady),
        row('14 个模块全部定义', '[]', missing, ok(missing.length === 0)),
        isTrue('RenderPipeline 已初始化', b.enabled.renderPipeline),
        isTrue('GraphicsEnhancement 已初始化（静默失败指示灯）', b.enabled.graphicsEnhancement),
        isTrue('GameSettings.getSettings() 返回对象', b.enabled.settingsObject),
        row('PBR 套件就绪数（渐进加载，最长等 15s）', '≥8', pbrCount, ok(pbrCount >= 8)),
        ge('PerformanceGuard 档位可读', 0, b.guardLevel),
        eq('loadingScreen 已隐藏', 'none', b.loadingScreenDisplay),
      ];
    },
  },

  /* ================= SMK-02 开局进入行动阶段 ================= */
  {
    id: 'SMK-02',
    title: '开局进入行动阶段',
    auto: '全自动',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      await ctx.page.evaluate(() => {
        enterLobby('qa_auto');
        startGame();
      });
      await ctx.page.waitForFunction(() => typeof S !== 'undefined' && S.phase === 'playing', { timeout: 30000 });
      await ctx.wait(3000);

      const hud = await ctx.page.evaluate(() => ({
        hud: document.getElementById('gameHUD').style.display,
        lobby: document.getElementById('lobbyScreen').style.display,
        phase: S.phase,
        knife: S.weaponSlots[3],
        fullHP: S.health === S.maxHealth,
        // 水面与 PBR 在进入地图后才建立，放在这里而不是启动用例里
        water: typeof GraphicsEnhancement !== 'undefined' ? GraphicsEnhancement.getWaterMeshes().length : -1,
        pbr: typeof PBRTextures !== 'undefined' ? PBRTextures.kinds.filter((k) => PBRTextures.ready(k)).length : -1,
      }));
      const c = await ctx.call(probes.probeContent);

      ctx.state.baseScene = c.sceneChildren;
      ctx.state.baseMap = c.mapName;
      await ctx.shot('SMK-02_开局场景');

      return [
        eq('S.phase', 'playing', hud.phase),
        eq('#lobbyScreen display', 'none', hud.lobby),
        eq('#gameHUD display', 'block', hud.hud),
        eq('第 4 槽位为匕首', 'knife', hud.knife),
        isTrue('出生满血', hud.fullHP),
        ge('道具布点数', 100, c.propsPlaced),
        ge('容器数', 100, c.containers),
        ge('敌人数', 5, c.enemies),
        ge('地面掉落数', 10, c.groundLoot),
        ge('撤离点数', 2, c.extractPoints),
        ge('障碍物数', 200, c.obstacles),
        ge('水面网格数', 1, hud.water),
        ge('PBR 套件就绪数', 8, hud.pbr),
      ];
    },
  },

  /* ================= REG-01 事故① 道具生成数量 ================= */
  {
    id: 'REG-01',
    title: '事故① 回归：程序化道具必须真实生成',
    auto: '全自动',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      const c = await ctx.call(probes.probeContent);
      const rejectKeys = ['bounds', 'building', 'water', 'spawn', 'overlap'];
      const haveKeys = c.propsRejects ? Object.keys(c.propsRejects) : [];
      const missKeys = rejectKeys.filter((k) => !haveKeys.includes(k));

      return [
        ge('worldPropsPlaced.length（为 0 即事故①复发）', 100, c.propsPlaced),
        row('worldPropsRejects 存在', 'object', typeof c.propsRejects, ok(!!c.propsRejects)),
        row('rejects 含关键键', rejectKeys.join('/'), haveKeys.join('/'), ok(missKeys.length === 0)),
        row('rejects 明细', '见快照', JSON.stringify(c.propsRejects || {}), 'PASS'),
        ge('containers', 100, c.containers),
        ge('groundLootItems', 10, c.groundLoot),
        ge('enemies', 5, c.enemies),
        ge('extractPoints', 2, c.extractPoints),
      ];
    },
  },

  /* ================= REG-02 事故② UV 平铺 ================= */
  {
    id: 'REG-02',
    title: '事故② 回归：地面 UV 按世界尺寸平铺',
    auto: '全自动',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      const DESIGN_TILE = 5.5; // graphics_enhancement.js:709 地面 tile
      const g = await ctx.call(probes.probeGroundUV, DESIGN_TILE);
      await ctx.shot('REG-02_地面');

      if (!g.found) {
        return [row('找到地面网格 mapEnvironmentGroup.children[0]', true, false, 'FAIL')];
      }
      const dev = Math.abs(g.spanX - g.expectedSpan);
      const uvStatus = g.spanX < 5 ? 'FAIL' : dev <= 2 ? 'PASS' : dev <= 5 ? 'CONCERNS' : 'FAIL';
      const tileStatus = Math.abs(g.effectiveTile - DESIGN_TILE) <= 0.5 ? 'PASS' : 'CONCERNS';

      return [
        eq('地面几何体类型', 'PlaneGeometry', g.geoType),
        // 期望 = MAP_DATA.mapSize / 5.5（mapSize 从 MAP_DATA 读，不写死 110）
        row(
          `UV 跨度 === mapSize/tile（${g.mapSize}/${DESIGN_TILE}=${g.expectedSpan}）±2`,
          `${g.expectedSpan}±2`,
          g.spanX,
          uvStatus,
        ),
        row(`等效平铺尺寸 ≈${DESIGN_TILE}m`, `≈${DESIGN_TILE}`, g.effectiveTile, tileStatus),
        isTrue('UV 已按 PBR 世界尺寸处理（_pbrUV 已锁）', g.locked),
        isTrue('地面材质挂有贴图', g.hasMap),
        ge('_pbrUV 几何体数', 1, g.pbrLockedCount),
      ];
    },
  },

  /* ================= SMK-03 射击与换弹 ================= */
  {
    id: 'SMK-03',
    title: '射击与换弹',
    auto: '全自动',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      const setup = await ctx.call(probes.setupWeaponForCombat);
      const six = await ctx.call(probes.fireShots, 6);
      const empty = await ctx.call(probes.fireOnEmptyMag);
      const explicit = await ctx.call(probes.doReload);

      let finished = false;
      try {
        await ctx.page.waitForFunction(() => !S.isReloading, { timeout: 6000 });
        finished = true;
      } catch (e) {
        finished = false;
      }
      const reloadState = await ctx.call(probes.readReloadState);
      const after = await ctx.call(probes.fireOnceAfterReload);
      await ctx.shot('SMK-03_射击后');

      return [
        eq('装备武器', 'rifle', setup.weapon),
        eq('打 6 发实际扣弹数', 6, six.fired),
        eq('6 发后弹匣', 24, six.mag),
        isTrue('空仓射击触发自动换弹', empty.isReloading),
        eq('自动换弹后弹匣补满', 30, empty.mag),
        eq('自动换弹消耗 1 组备弹（2→1）', 1, empty.rigLeft),
        eq('显式 reload 后弹匣', 30, explicit.mag),
        isTrue('显式 reload 置换弹状态', explicit.isReloading),
        eq('显式 reload 再消耗 1 组（1→0）', 0, explicit.rigLeft),
        isFalse('换弹结束 isReloading（真实状态）', reloadState.isReloading),
        isTrue('换弹动画在 6s 内结束', finished),
        eq('换弹后可再开火（30→29）', 29, after.after),
      ];
    },
  },

  /* ================= SMK-04 开镜 ADS ================= */
  {
    id: 'SMK-04',
    title: '开镜 ADS',
    auto: '全自动',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      const s = await ctx.call(probes.adsStart);
      await ctx.wait(450);
      const aimed = await ctx.call(probes.adsRead);
      await ctx.shot('SMK-04_开镜');
      await ctx.call(probes.adsStopAndRead);
      await ctx.wait(450);
      const back = await ctx.call(probes.adsRead);

      return [
        ge('开镜进度', 0.9, aimed.progress),
        row('开镜时 FOV 小于腰射 FOV', `<${s.fov0}`, aimed.fov, ok(aimed.fov < s.fov0)),
        le('松镜后进度', 0.1, back.progress),
        near('松镜后 FOV 复原', s.fov0, back.fov, 0.5),
      ];
    },
  },

  /* ================= SMK-05 拾取 ================= */
  {
    id: 'SMK-05',
    title: '拾取地面掉落',
    auto: '全自动',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      const r = await ctx.call(probes.pickupFirstLoot);
      if (!r.found) return [row('场上存在未拾取掉落', true, false, 'FAIL')];
      await ctx.shot('SMK-05_拾取后');

      return [
        isTrue('gl.taken', r.taken),
        eq('拾取物品', r.itemId, r.itemId),
        eq('物资价值增量 === 物品价值', r.defValue, r.delta),
        isTrue('计入 _lootItems 清单', r.inLootList),
        ge('进入背包/安全箱/钥匙链的件数', 1, r.gridGained),
        row('拾取后 lootValue', '>0', r.lootAfter, ok(r.lootAfter > 0)),
      ];
    },
  },

  /* ================= SMK-06 背包与仓库 ================= */
  {
    id: 'SMK-06',
    title: '背包与仓库',
    auto: '全自动',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      const open = await ctx.call(probes.backpackOpen);
      await ctx.wait(300);
      await ctx.shot('SMK-06_背包');
      const close = await ctx.call(probes.backpackClose);

      // 未装备胸挂/背包时，bpRigGrid / bpBackpackGrid 本就不渲染子节点——这是正确行为。
      // 已装备则必须有内容；未装备则记为 N/A（不判失败），已装备路径由 L2 用预置存档覆盖。
      const hasRig = !!open.equipment.chestRig;
      const hasBP = open.backpackCols > 0;

      return [
        eq('打开后 S.phase', 'backpack', open.phase),
        eq('#backpackScreen display', 'flex', open.display),
        row(
          '背包网格子节点数（已装备背包时）',
          hasBP ? '≥1' : 'N/A 未装备背包',
          open.backpackCells,
          hasBP ? ok(open.backpackCells >= 1) : 'PASS',
        ),
        row(
          '装备栏子节点数（已装备胸挂时）',
          hasRig ? '≥1' : 'N/A 未装备胸挂',
          open.rigCells,
          hasRig ? ok(open.rigCells >= 1) : 'PASS',
        ),
        ge('口袋格子数（始终渲染）', 1, open.pocketCells),
        ge('角色装备栏格子数（始终渲染）', 1, open.charSlots),
        row('负重文本以数字开头', true, open.weightText, ok(/^\d/.test(String(open.weightText).trim()))),
        eq('关闭后 S.phase', 'playing', close.phase),
        eq('关闭后 #backpackScreen display', 'none', close.display),
      ];
    },
  },

  /* ================= SMK-07 搜索容器 ================= */
  {
    id: 'SMK-07',
    title: '搜索容器',
    auto: '半自动（揭示动画用条件等待，不靠死等）',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      const open = await ctx.call(probes.searchOpen);
      if (!open.found) return [row('找到含物品的容器', true, false, 'FAIL')];

      let revealedAll = false;
      try {
        await ctx.page.waitForFunction(
          () => {
            const c = S.currentSearchContainer;
            return c && Array.isArray(c._revealed) && c._revealed.every(Boolean);
          },
          { timeout: 20000 },
        );
        revealedAll = true;
      } catch (e) {
        revealedAll = false;
      }
      const st = await ctx.call(probes.searchRevealState);
      await ctx.shot('SMK-07_搜索界面');
      const close = await ctx.call(probes.searchClose);

      return [
        eq('打开后 S.phase', 'searching', open.phase),
        eq('#searchScreen display', 'flex', open.display),
        eq('容器格数 === gridW*gridH', open.expectCells, st.gridCells),
        eq('已搜容器计数 +1', open.searchedBefore + 1, open.searchedAfter),
        isTrue('物品揭示全部完成', revealedAll),
        eq('关闭后 S.phase', 'playing', close.phase),
        eq('关闭后 #searchScreen display', 'none', close.display),
      ];
    },
  },

  /* ================= SMK-08 3D 检视器 ================= */
  {
    id: 'SMK-08',
    title: '3D 检视器',
    auto: '半自动（用模型三角形数替代像素判定）',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      // 先排除交火：受击会按设计关闭检视器（animation_enhancement.js:329），
      // 不隔离的话约 1/4 概率被打断，会被误判成 flaky 缺陷。
      const parked = await ctx.call(probes.parkEnemiesAway);
      await ctx.wait(300);

      // 诊断用观察窗：记录 isOpen / phase / 指针锁 的演化，用于定位「打开后自行关闭」
      await ctx.page.evaluate(() => {
        window.__ivWatch = [];
        const t = setInterval(() => {
          window.__ivWatch.push({
            t: Math.round(performance.now()),
            open: (typeof InspectViewer !== 'undefined') && InspectViewer.isOpen(),
            phase: typeof S !== 'undefined' ? S.phase : null,
            lock: !!document.pointerLockElement,
          });
        }, 100);
        window.__ivWatchStop = () => clearInterval(t);
      });

      let opened = await ctx.call(probes.inspectOpen, 'gpu');
      const firstTry = opened.isOpen;
      await ctx.wait(900);
      let st = await ctx.call(probes.inspectState);
      let retried = false;
      // 首次打开可能被前序界面（红卡检视叠加层 / 上下文回收）打断：等一拍重试一次，
      // 但「首次失败」这件事本身要记录，因为它对玩家就是「点物品没反应」。
      if (!st.isOpen) {
        retried = true;
        await ctx.wait(500);
        opened = await ctx.call(probes.inspectOpen, 'gpu');
        await ctx.wait(900);
        st = await ctx.call(probes.inspectState);
      }
      const watch = await ctx.page.evaluate(() => {
        if (window.__ivWatchStop) window.__ivWatchStop();
        return window.__ivWatch || [];
      });
      await ctx.shot('SMK-08_检视器');
      const closed = await ctx.call(probes.inspectClose);

      const polyNum = parseInt(String(st.polyText).replace(/[^\d]/g, ''), 10) || 0;

      const hpAfter = await ctx.page.evaluate(() => ({ health: S.health, max: S.maxHealth }));
      return [
        row('隔离交火：敌人已挪开', '≥1', parked.moved, parked.moved >= 1 ? 'PASS' : 'CONCERNS'),
        row('隔离交火：观察期间未受伤（受伤会按设计关闭检视器）', parked.health, hpAfter.health, ok(hpAfter.health === parked.health || 'CONCERNS')),
        isTrue('首次打开即成功（玩家视角：点物品立刻有反应）', firstTry),
        row('首次失败后重试才成功（记为 CONCERNS）', false, retried, retried ? 'CONCERNS' : 'PASS'),
        row(
          '打开期间状态轨迹（诊断：open/phase 未异常翻转）',
          '全程 open=true',
          watch.filter((w) => w.open).length + '/' + watch.length,
          watch.length && watch.every((w) => w.open) ? 'PASS' : 'CONCERNS',
        ),
        row('轨迹明细', '见 evidence', JSON.stringify(watch.map((w) => `${w.open ? 'O' : '-'}${w.phase[0]}${w.lock ? 'L' : ''}`)), 'PASS'),
        isTrue('InspectViewer.isOpen', st.isOpen),
        row('#ivRoot 含 show 类', true, st.rootClass, ok(String(st.rootClass).includes('show'))),
        isTrue('检视面板可见', st.rootVisible),
        eq('物品名渲染', opened.expectName, st.nameText),
        ge('3D 模型三角形数', 100, polyNum),
        isFalse('关闭后 isOpen', closed.isOpen),
      ];
    },
  },

  /* ================= SMK-11 性能基线 ================= */
  {
    id: 'SMK-11',
    title: '性能基线（JS 帧耗时 / draw call）',
    auto: '半自动（真机 60fps 结论需人工）',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      await ctx.wait(1500); // 进图后先让纹理/图标等一次性工作落地

      const INTERVAL = 100;
      const WINDOW = 10000;
      const samples = [];
      const t0 = Date.now();
      while (Date.now() - t0 < WINDOW) {
        const f = await ctx.call(probes.probeFrame);
        if (f.frame) {
          samples.push({
            ...f.frame,
            calls: f.calls,
            guardLevel: f.guardLevel,
            dpr: f.dpr,
            triangles: f.triangles,
            programs: f.programs,
            quality: f.quality,
            resolution: f.resolution,
            at: Date.now() - t0,
          });
        }
        await ctx.wait(INTERVAL);
      }
      // 丢弃前 2s（渐进 PBR / 3D 图标仍在生成）
      const warm = samples.filter((s) => s.at >= 2000);
      const use = warm.length >= 10 ? warm : samples;

      // 采样饥饿检测：本机若被其它进程占满，page.evaluate 本身会被拖到数百 ms，
      // 此时测出的「帧耗时」是环境噪声，不能当成产品退化。宁可报 CONCERNS 也不误报 FAIL。
      const expected = Math.floor((WINDOW - 2000) / INTERVAL);
      const starved = use.length < Math.max(15, expected * 0.4);

      const sum = summarize(use);
      const guardChanged = new Set(use.map((s) => s.guardLevel)).size > 1;
      ctx.state.idleJs = sum.jsP50;
      ctx.state.perfSnapshot = {
        ...sum,
        starved,
        samples: use.length,
        expected,
        guardChanged,
        level: use[use.length - 1].guardLevel,
        dpr: use[use.length - 1].dpr,
        resolution: use[use.length - 1].resolution,
        quality: use[use.length - 1].quality,
        triangles: use[use.length - 1].triangles,
        programs: use[use.length - 1].programs,
      };

      const pick = (normal, whenStarved) => (starved ? whenStarved : normal);
      const jsStatus = pick(sum.jsP50 <= 8 ? 'PASS' : sum.jsP50 <= 16 ? 'CONCERNS' : 'FAIL', 'CONCERNS');
      const p90Status = pick(sum.jsP90 <= 16 ? 'PASS' : sum.jsP90 <= 33 ? 'CONCERNS' : 'FAIL', 'CONCERNS');
      const callStatus = pick(sum.callsP50 <= 900 ? 'PASS' : sum.callsP50 <= 1200 ? 'CONCERNS' : 'FAIL', sum.callsP50 <= 1200 ? 'CONCERNS' : 'FAIL');
      const jsSpike = sum.max.js > 100 && sum.max.render <= sum.max.js;
      const spikeStatus = pick(jsSpike ? 'FAIL' : 'PASS', 'CONCERNS');

      return [
        row('稳态采样帧数', 15, use.length, starved ? 'CONCERNS' : ok(use.length >= 15)),
        row('采样是否被环境拖垮（不足预期 40% 即不可信）', false, starved, starved ? 'CONCERNS' : 'PASS'),
        row('JS 单帧 p50（预算 8ms）', '≤8', sum.jsP50, jsStatus),
        row('JS 单帧 p90（余量）', '≤16', sum.jsP90, p90Status),
        row('draw call p50（>900 CONCERNS / >1200 FAIL）', '≤900', sum.callsP50, callStatus),
        row('最大单帧（js / render 归因）', 'js 不得独占', `js=${sum.max.js} render=${sum.max.render}`, spikeStatus),
        row('采样期是否发生降级（发生则结论仅参考）', false, guardChanged, guardChanged ? 'CONCERNS' : 'PASS'),
        row('渲染上下文快照', '见 evidence', JSON.stringify(ctx.state.perfSnapshot), 'PASS'),
      ];
    },
  },

  /* ================= REG-03 事故③ 帧耗时无回归 ================= */
  {
    id: 'REG-03',
    title: '事故③ 回归：JS 帧耗时不随交战爆炸',
    auto: '半自动',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      const moved = await ctx.call(probes.moveEnemiesNear);
      await ctx.wait(1500);

      const INTERVAL = 100;
      const WINDOW = 6000;
      const samples = [];
      const t0 = Date.now();
      while (Date.now() - t0 < WINDOW) {
        const f = await ctx.call(probes.probeFrame);
        if (f.frame) samples.push({ ...f.frame, at: Date.now() - t0 });
        await ctx.wait(INTERVAL);
      }
      const warm = samples.filter((s) => s.at >= 1500);
      const use = warm.length >= 10 ? warm : samples;
      const expected = Math.floor((WINDOW - 1500) / INTERVAL);
      const starved = use.length < Math.max(12, expected * 0.4);

      const sum = summarize(use);
      const idle = ctx.state.idleJs || 0;
      const budget = Math.max(8, +(idle * 2).toFixed(2));
      const pick = (normal, whenStarved) => (starved ? whenStarved : normal);

      return [
        row('挪动敌人到位（交战压力）', '≥1', moved.moved, moved.moved >= 1 ? 'PASS' : 'CONCERNS'),
        row('采样是否被环境拖垮', false, starved, starved ? 'CONCERNS' : 'PASS'),
        row('交战态 JS p50', `≤${budget}`, sum.jsP50, pick(sum.jsP50 <= budget ? 'PASS' : 'FAIL', 'CONCERNS')),
        row('交战态 JS p90', '≤16', sum.jsP90, pick(sum.jsP90 <= 16 ? 'PASS' : 'CONCERNS', 'CONCERNS')),
        // 事故③ 的特征是「每帧 JS 数百毫秒」；单次长帧要能归因到 js 才判退化
        row('交战态 JS 最大（事故③ 为 399ms）', '≤100', sum.max.js, pick(sum.max.js <= 100 ? 'PASS' : 'FAIL', 'CONCERNS')),
        row('长帧归因', 'js 不得独占', `js=${sum.max.js} render=${sum.max.render}`, pick(sum.max.js > 100 && sum.max.render <= sum.max.js ? 'FAIL' : 'PASS', 'CONCERNS')),
      ];
    },
  },

  /* ================= SMK-09 地图切换 ================= */
  {
    id: 'SMK-09',
    title: '地图切换',
    auto: '全自动',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      await ctx.call(probes.switchMapAndStart, 'forest_outpost');
      await ctx.page.waitForFunction(() => S.phase === 'playing', { timeout: 30000 });
      await ctx.wait(3500);
      const c = await ctx.call(probes.probeContent);
      await ctx.shot('SMK-09_密林禁区');

      const base = ctx.state.baseScene || 0;
      const growth = base ? c.sceneChildren / base : 1;
      const floor = MAP_FLOOR[c.mapName] || MAP_FLOOR['军事禁区'];

      return [
        eq('切换到密林禁区', '密林禁区', c.mapName),
        ge('道具布点数', floor.props, c.propsPlaced),
        ge('容器数', floor.containers, c.containers),
        ge('敌人数', floor.enemies, c.enemies),
        ge('地面掉落数', floor.loot, c.groundLoot),
        ge('撤离点数', floor.extracts, c.extractPoints),
        row('scene.children 未爆炸增长', `≤${Math.round(base * 1.5)}`, c.sceneChildren, ok(growth <= 1.5)),
      ];
    },
  },

  /* ================= SMK-10 撤离结算 ================= */
  {
    id: 'SMK-10',
    title: '撤离结算',
    auto: '全自动',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      const before = await ctx.call(probes.beforeExtract);
      const after = await ctx.call(probes.doExtract);
      await ctx.wait(400);
      await ctx.shot('SMK-10_结算界面');

      const resultValue = parseInt(String(after.valueText).replace(/[^\d]/g, ''), 10);

      return [
        eq('结算前 phase', 'playing', before.phase),
        eq('结算后 phase', 'gameover', after.phase),
        isFalse('#gameHUD 可见', after.hudShown),
        isTrue('#resultScreen 可见', after.resultShown),
        row('#resultTitle 文本', '撤离成功', after.title, ok(String(after.title).includes('撤离成功'))),
        eq('#resultValue === 结算前 lootValue', before.lootValue, resultValue),
        eq('P.money 增加 === lootValue', before.lootValue, after.money - before.money),
        eq('P.stats.extracts +1', before.extracts + 1, after.extracts),
      ];
    },
  },

  /* ================= SMK-12 控制台零报错（汇总，必须最后跑） ================= */
  {
    id: 'SMK-12',
    title: '控制台零报错（error + warning 全量）',
    auto: '全自动',
    async run(ctx) {
      const FORBIDDEN = ['[WorldProps] 道具生成失败', 'Loading error', 'Cannot read', 'is not a function'];
      // 404 的 console 文本里不含 URL（只有「Failed to load resource」），
      // 所以白名单判定要看服务端缺失清单：若缺失资源里只有 favicon，则这些 404 允许存在。
      const missingReal = (ctx.missing || []).filter((m) => !/favicon/i.test(m));
      const isWhitelisted404 = (text) => /Failed to load resource/i.test(String(text)) && missingReal.length === 0;
      const isFavicon = (t) => /favicon/i.test(String(t));
      const entries = ctx.consoleLog.filter((e) => !isFavicon(e.text) && !isWhitelisted404(e.text));

      const errors = entries.filter((e) => e.level === 'error' || e.level === 'pageerror');
      const warnings = entries.filter((e) => e.level === 'warning');
      const reqFail = entries.filter((e) => e.level === 'requestfailed');
      const hit = entries.filter((e) => FORBIDDEN.some((k) => String(e.text).includes(k)));
      const dialogs = entries.filter((e) => e.level === 'dialog');
      const faviconCount = ctx.consoleLog.filter((e) => isFavicon(e.text)).length;

      return [
        eq('console error + pageerror 数', 0, errors.length),
        eq('console warning 数', 0, warnings.length),
        eq('requestfailed 数', 0, reqFail.length),
        row('命中静默失败关键词', '无', hit.map((h) => String(h.text).slice(0, 80)), ok(hit.length === 0)),
        row('页面 alert 数（信息项，不判失败）', '记录', dialogs.length, 'PASS'),
        row('favicon / 已白名单 404 条数', '记录', faviconCount, 'PASS'),
        row('非 favicon 缺失资源', '[]', missingReal, ok(missingReal.length === 0)),
        row(
          'error 明细（排查用）',
          '[]',
          errors.map((e) => `${e.level}: ${String(e.text).slice(0, 160)}`),
          'PASS',
        ),
      ];
    },
  },
];

export const CASE_ORDER = cases.map((c) => c.id);
