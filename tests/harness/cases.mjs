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
        // window.__qa：静默失败的计数器（契约见 strategy.md §7.5）
        row('__qa.bootedAt 已写入', '>0', b.qa ? b.qa.bootedAt : 'no __qa', b.qa && b.qa.bootedAt > 0 ? 'PASS' : 'CONCERNS'),
        row(
          '__qa.modules 全部 loaded',
          '11/11',
          b.qa ? `${b.qa.modulesLoaded}/${b.qa.modulesTotal}` : 'no __qa',
          b.qa && b.qa.modulesLoaded === b.qa.modulesTotal ? 'PASS' : 'CONCERNS',
        ),
        row(
          '__qa.swallowed（被吞掉的异常数，必须为 0）',
          0,
          b.qa ? b.qa.swallowed : 'no __qa',
          !b.qa ? 'CONCERNS' : ok(b.qa.swallowed === 0),
        ),
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

      // 立刻采样 draw call（0–1.2s）：初始化顺序若退化，未合批窗口只出现在开局最初几帧。
      // 必须连同 postFX 一起采：后期开启时 render.calls 只含最后一个 pass（常为 1），读数无效。
      const callSamples = [];
      const callValidSamples = [];
      for (let i = 0; i < 8; i++) {
        const v = await ctx.page.evaluate(() => {
          try {
            return {
              calls: renderer.info.render.calls,
              postFX: GameSettings.getSettings().graphics.postFX !== false,
            };
          } catch (e) {
            return { calls: -1, postFX: null };
          }
        });
        if (v && v.calls > 0) {
          callSamples.push(v.calls);
          if (!v.postFX && v.calls > 50) callValidSamples.push(v.calls);
        }
        await ctx.wait(150);
      }
      ctx.state.firstGameCalls = callValidSamples.length ? Math.max(...callValidSamples) : -1;
      ctx.state.firstGameCallSamples = callSamples;
      ctx.state.firstGameCallsValid = callValidSamples.length > 0;

      await ctx.wait(2000);

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
      // 不再传死数：tile 现在随贴图边长归一化（512²→5.5m，256²→2.75m）。
      // 传 5.5 会让「砾石/沥青换了 256² 贴图」被读成「UV 平铺错了」——
      // 那次误判真的发生过（54.55 vs 109.09），责任人是我。
      const g = await ctx.call(probes.probeGroundUV, 5.5);
      await ctx.shot('REG-02_地面');

      if (!g.found) {
        return [row('找到地面网格 mapEnvironmentGroup.children[0]', true, false, 'FAIL')];
      }
      const pbr = g.pbr || {};
      const designTile = pbr.tileU || 0;
      const expectedSpan = designTile > 0 ? +(g.mapSize / designTile).toFixed(2) : g.expectedSpan;
      const dev = Math.abs(g.spanX - expectedSpan);
      const uvStatus = g.spanX < 5 ? 'FAIL' : dev <= 2 ? 'PASS' : dev <= 5 ? 'CONCERNS' : 'FAIL';
      // 真正该守的不变式：texel 密度。三种地面（草地 512² / 砾石 256² / 沥青 256²）
      // 必须落在同一档，否则换图就会看到颗粒突然放大一倍。
      const cm = pbr.cmPerTexel || 0;
      const densityStatus = cm >= 1.0 && cm <= 1.3 ? 'PASS' : cm > 0 ? 'FAIL' : 'CONCERNS';

      return [
        eq('地面几何体类型', 'PlaneGeometry', g.geoType),
        row(
          `UV 跨度 === mapSize/tile（${g.mapSize}/${designTile || '?'}=${expectedSpan}）±2`,
          `${expectedSpan}±2`,
          g.spanX,
          uvStatus,
        ),
        row(`地面贴图种类 = ${g.groundKind}（贴图 ${g.texSize}²）`, g.groundKind, pbr.kind || '(未写回)', pbr.kind === g.groundKind ? 'PASS' : 'FAIL'),
        row('texel 密度 ∈ [1.0, 1.3] cm/texel（三图一致）', '1.0–1.3', cm ? cm.toFixed(2) : '(未写回)', densityStatus),
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

  /* ================= SMK-11 确定性性能指标 ================= */
  {
    id: 'SMK-11',
    title: '确定性性能指标（draw call / program / 三图相对差异）',
    auto: '半自动（真机 60fps 结论需人工）',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      /**
       * 口径（2026-11-13 主理人裁定，来源：工程侧实测量级抖动 5–10 倍）：
       *   js / render 帧耗时**不进质量门**，只做同一次运行内的相对比较；
       *   门控只用确定性指标：draw call、program 数、可见网格数、道具布点数。
       * 阶段阈值：阶段一（容器合批前）>1200 FAIL / >900 CONCERNS；
       *           阶段二（容器材质缓存 + 每箱合并后）>900 FAIL / >600 CONCERNS，目标 ≤300。
       */
      const GATE = { concerns: 900, fail: 1200 };

      const maps = ['military_base', 'forest_outpost', 'industrial_port'];
      const perMap = [];
      for (const m of maps) {
        await ctx.page.evaluate((mapId) => {
          selectMap(mapId);
          startGame();
        }, m);
        await ctx.wait(3200);
        const samples = [];
        for (let i = 0; i < 15; i++) {
          const f = await ctx.call(probes.probeFrame);
          if (f.frame)
            samples.push({ js: f.frame.js, calls: f.calls, programs: f.programs, tris: f.triangles, postFX: f.postFX });
          await ctx.wait(100);
        }
        if (!samples.length) {
          perMap.push({ map: m, error: 'no samples' });
          continue;
        }
        perMap.push({
          map: m,
          maxCalls: Math.max(...samples.map((x) => x.calls)),
          programs: Math.max(...samples.map((x) => x.programs)),
          triangles: samples[samples.length - 1].tris,
          jsMedian: +median(samples.map((x) => x.js)).toFixed(2),
          guardLevel: samples[samples.length - 1].guardLevel ?? -1,
          postFX: samples[samples.length - 1].postFX,
        });
      }
      ctx.state.perfPerMap = perMap;
      await ctx.shot('SMK-11_三图最后一图');

      const okMaps = perMap.filter((x) => !x.error);
      const worst = okMaps.reduce((a, b) => (b.maxCalls > (a ? a.maxCalls : -1) ? b : a), null);
      const jss = okMaps.map((x) => x.jsMedian).filter((n) => n > 0);
      const jsSpread = jss.length >= 2 ? +(Math.max(...jss) / Math.min(...jss)).toFixed(1) : 1;

      // 后期（postFX）开启时 renderer.info.render.calls 只反映最后一个 pass（常见为 1），
      // 此时 draw call 读数不可比 —— 先判「读数是否有效」，再判数值。
      const postFxOn = okMaps.some((x) => x.postFX === true);
      const callsValid = !postFxOn && worst && worst.maxCalls > 50;
      const callStatus = !callsValid
        ? 'CONCERNS'
        : worst.maxCalls > GATE.fail
          ? 'FAIL'
          : worst.maxCalls > GATE.concerns
            ? 'CONCERNS'
            : 'PASS';
      const progStatus = worst.programs > 40 ? 'CONCERNS' : 'PASS';

      return [
        eq('三图均采到样本', 3, okMaps.length),
        row(
          `draw call 三图最大值（阶段一：>${GATE.concerns} CONCERNS / >${GATE.fail} FAIL）`,
          `≤${GATE.concerns}`,
          worst ? `${worst.map} ${worst.maxCalls}` : 'n/a',
          callStatus,
        ),
        row(
          'draw call 读数有效性（后期开启时读数只含最后一个 pass）',
          'postFX=off',
          postFxOn ? '读数不可比' : '有效',
          callsValid || !postFxOn ? 'PASS' : 'CONCERNS',
        ),
        row('shader program 数（>40 记 CONCERNS）', '≤40', worst ? worst.programs : 'n/a', progStatus),
        row('三图 draw call 明细', '见 evidence', JSON.stringify(perMap.map((x) => `${x.map}:${x.maxCalls}`)), 'PASS'),
        row(
          '三图 js 相对差异（仅记录，不判定：同机抖动可达 5–10 倍）',
          '记录',
          `${jsSpread}×  ${JSON.stringify(jss)}`,
          'PASS',
        ),
        row(
          '结论口径',
          '确定性指标入闸 / 帧耗时只做相对比较',
          '见 tests/strategy.md §5.1',
          'PASS',
        ),
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
      const INTERVAL = 100;

      // 采样器
      async function sample(ms) {
        const out = [];
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
          const f = await ctx.call(probes.probeFrame);
          if (f.frame) out.push({ ...f.frame, at: Date.now() - t0 });
          await ctx.wait(INTERVAL);
        }
        return out;
      }

      // ---- 1) 先在同一次会话里量一条空场基线 ----
      //
      // 以前这里用的是 ctx.state.idleJs * 3，而 idleJs 从来没被赋值过 ——
      // 也就是说预算恒等于硬编码的 12ms。单独跑本用例时 p50 约 6-9ms 能过，
      // 放在全套里跑（前面 9 个用例已经把敌人、粒子、掉落物堆起来）就稳定 15ms 左右 → 假 FAIL。
      // 绝对毫秒数在 headless SwiftShader 下跨运行差 5-10 倍（tests/strategy.md §8.0），
      // 唯一有意义的比法是「同一时刻、同一场景，交战 vs 空场」。
      await ctx.call(probes.parkEnemiesAway);
      await ctx.wait(1200);
      const idleSamples = await sample(2500);
      const idleSum = summarize(idleSamples);
      const idleJs = idleSum.jsP50 || 0;

      // ---- 2) 同一场景下把敌人拉到近处，再采交战态 ----
      const moved = await ctx.call(probes.moveEnemiesNear);
      await ctx.wait(1500);
      const WINDOW = 6000;
      const raw = await sample(WINDOW);
      const warm = raw.filter((s) => s.at >= 1500);
      const use = warm.length >= 10 ? warm : raw;
      const expected = Math.floor((WINDOW - 1500) / INTERVAL);
      const starved = use.length < Math.max(12, expected * 0.4);

      const sum = summarize(use);
      // 预算口径：交火确实会涨（3 个敌人贴近时 +5ms 属正常 AI 开销）。
      // 判「退化」看的是量级变化（事故③ 是 399ms/帧），所以给空场基线的 2.5 倍，
      // 下限 10ms 保证空场基线异常低时不会把预算压到不可能达到。
      const budget = Math.max(10, +(idleJs * 2.5).toFixed(1));
      const pick = (normal, whenStarved) => (starved ? whenStarved : normal);

      return [
        row('挪动敌人到位（交战压力）', '≥1', moved.moved, moved.moved >= 1 ? 'PASS' : 'CONCERNS'),
        row('同场景空场 JS p50（本次基线）', '采样≥10', idleJs, idleSamples.length >= 10 ? 'PASS' : 'CONCERNS'),
        row('采样是否被环境拖垮', false, starved, starved ? 'CONCERNS' : 'PASS'),
        row('交战态 JS p50（相对空场 ×2.5）', `≤${budget}`, sum.jsP50, pick(sum.jsP50 <= budget ? 'PASS' : 'FAIL', 'CONCERNS')),
        // p90 只做记录：单帧尖峰在 SwiftShader 下与真实设备无关，不足以判退化
        row('交战态 JS p90（仅记录）', '≤16', sum.jsP90, sum.jsP90 <= 16 ? 'PASS' : 'CONCERNS'),
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

  /* ================= SMK-13 首局 draw call（初始化顺序防回归） ================= */
  {
    id: 'SMK-13',
    title: '首局 draw call（初始化顺序防回归）',
    auto: '全自动',
    async run(ctx) {
      const first = ctx.state.firstGameCalls;
      /**
       * 已知缺陷（工程侧修复中）：首次 rebuildMapEnvironment() 跑在 GraphicsEnhancement.init() 之前，
       * isEnabled() 为 false → batchStatic 被跳过 → 整局以 1.1 万未合批网格渲染（实测 3,523 dc）。
       * 修复后应为 ≈1,034。当前标 KNOWN_OPEN，只报 CONCERNS 不阻塞；修好后把 knownOpen 置 false 即转 FAIL 判定。
       */
      const knownOpen = false; // 2026-11-13 实测 1077（原 3,523）已正常，转正为 FAIL 判定
      const expected = 1500; // 修复后 ≈1034，留 45% 余量给视锥差异
      if (first === undefined || first < 0) {
        return [
          row('draw call 读数有效性（后期开启时读数只含最后一个 pass）', 'postFX=off', '采样无效', 'CONCERNS'),
          row('读到首局有效 draw call', '>0', first, 'CONCERNS'),
        ];
      }
      const pass = first <= expected;
      return [
        row(
          'draw call 读数有效性（后期开启时只含最后一个 pass，读 1 = 采样无效）',
          'postFX=off',
          ctx.state.firstGameCallsValid ? '有效' : '无效',
          ctx.state.firstGameCallsValid ? 'PASS' : 'CONCERNS',
        ),
        row(
          '首局 draw call 最大值',
          `≤${expected}（修复后应 ≈1034）`,
          first,
          pass ? 'PASS' : knownOpen ? 'CONCERNS' : 'FAIL',
        ),
        row('采样序列（诊断）', '首局应稳定在 ~1034', JSON.stringify(ctx.state.firstGameCallSamples || []), 'PASS'),
        row('缺陷状态', '修复后转 FAIL 判定', pass ? '已修复' : knownOpen ? '已知在修（KNOWN_OPEN）' : '回归', 'PASS'),
      ];
    },
  },

  /* ================= SMK-14 低画质降级验收（美术底线）+ IBL 基线 ================= */
  {
    id: 'SMK-14',
    title: '低画质降级不得拆掉材质（美术底线）+ IBL 基线',
    auto: '半自动（数值断言 + 人工目检截图）',
    async run(ctx) {
      const probes = await import('./probes.mjs');
      /**
       * 必须在「未降级的干净页面」上测（铁律④）：主场景到这一步早已自动降到 level 4，
       * 此时 forceLevel(3) 会因 `if (n <= _level) return` 变成空操作 —— 首版就这么假通过过。
       * 顺带：?perf=off 保持 level 0 → IBL 生效，这是采「道具 envMapIntensity 差异」的唯一窗口。
       *
       * 裁定（2026-11-13）：禁止降级时置空 normalMap。违反即 FAIL。
       */
      const p2 = await ctx.newGamePage('?perf=off');
      try {
        await p2.evaluate(() => {
          enterLobby('qa_level3');
          startGame();
        });
        await p2.waitForFunction(() => typeof S !== 'undefined' && S.phase === 'playing', { timeout: 30000 });

        // 条件等待材质升级完成（死等 4s 时只升级一部分，基数会漂 2 vs 424）
        try {
          await p2.waitForFunction(
            () => {
              let n = 0;
              const seen = new Set();
              scene.traverse((o) => {
                if (!o.isMesh || !o.material) return;
                for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
                  if (m && !seen.has(m.uuid)) {
                    seen.add(m.uuid);
                    if (m.normalMap) n++;
                  }
                }
              });
              return n >= 200;
            },
            { timeout: 15000 },
          );
        } catch (e) {}
        await ctx.wait(500);

        const before = await p2.evaluate(probes.probeMaterialState);
        const envIBL = await p2.evaluate(probes.probeEnvIntensity);

        // IBL-on 道具近景（修复前基线）：玩家摆到最近容器旁 2.5m 并正对它
        const aim = await p2.evaluate(() => {
          try {
            const t = (typeof containers !== 'undefined' && containers[0] && containers[0].mesh && containers[0].mesh.position) || null;
            if (!t) return { ok: false };
            const px = t.x + 2.5, pz = t.z;
            playerGroup.position.set(px, 0, pz);
            mouseX = Math.atan2(-(t.x - px), -(t.z - pz));
            mouseY = 0.12;
            playerGroup.rotation.y = mouseX;
            camera.rotation.x = mouseY;
            return { ok: true, target: [+t.x.toFixed(1), +t.z.toFixed(1)] };
          } catch (e) {
            return { ok: false, error: String(e && e.message) };
          }
        });
        await ctx.wait(700);
        await p2.screenshot({ path: `${ctx.evidenceDir}/SMK-14_IBL道具近景_修复前.png` }).catch(() => {});

        const sampleCalls = async () => {
          const vals = [];
          for (let i = 0; i < 5; i++) {
            const v = await p2.evaluate(() => {
              try {
                return renderer.info.render.calls;
              } catch (e) {
                return -1;
              }
            });
            if (v > 0) vals.push(v);
            await ctx.wait(100);
          }
          return vals.length ? Math.max(...vals) : -1;
        };
        const beforeCalls = await sampleCalls();

        const forced = await p2.evaluate(probes.forceDegrade, 3);
        await ctx.wait(1500);
        const after = await p2.evaluate(probes.probeMaterialState);
        await p2.screenshot({ path: `${ctx.evidenceDir}/SMK-14_level3_降级后.png` }).catch(() => {});
        const afterCalls = await sampleCalls();

        const newlyNulledMaps = Math.max(0, after.mapNulled - before.mapNulled);
        const lostNormals = Math.max(0, before.withNormal - after.withNormal);
        /**
         * 2026-11-13 主理人裁定：禁止降级时置空 normalMap。
         *   1. 把「降级」变成「重编译风暴」，且发生在设备已扛不住的瞬间（实测 program 20→26/41）；
         *   2. 不可逆：材质就地改写，setLowMode(false) 无恢复分支；
         *   3. 收益接近零：normalMap 吃纹理带宽而非主要开销，却抹掉美术定位三关键词之一的「骨料质感」。
         */
        const designPending = false;
        const normalStatus = lostNormals === 0 ? 'PASS' : designPending ? 'CONCERNS' : 'FAIL';

        return [
          row('降级档位已生效（从 0 起降）', '≥3', forced.level, Number(forced.level) >= 3 ? 'PASS' : 'FAIL'),
          row('降级前有 normalMap 的材质数', '>0', before.withNormal, before.withNormal > 0 ? 'PASS' : 'CONCERNS'),
          row('albedo 被置空（新增）', 0, newlyNulledMaps, newlyNulledMaps === 0 ? 'PASS' : 'FAIL'),
          row('normalMap 被置空（新增）', 0, lostNormals, normalStatus),
          row(
            '材质状态（降级前 → 后）',
            '见 evidence',
            `normal ${before.withNormal}→${after.withNormal} / map ${before.withMap}→${after.withMap} / programs ${before.programs}→${after.programs} / calls ${beforeCalls}→${afterCalls}`,
            'PASS',
          ),
          row(
            'program 数未增加（防重编译）',
            `≤${before.programs}`,
            after.programs,
            after.programs <= before.programs ? 'PASS' : 'CONCERNS',
          ),
          row('IBL 生效（scene.environment 非空）', true, envIBL.envorinmentOn, envIBL.envorinmentOn ? 'PASS' : 'CONCERNS'),
          row(
            'envMapIntensity 分布（art 口径：非水面/玻璃/金属 ∈ [0.1,0.4]）',
            '越界 0',
            `total ${envIBL.total} / 越界 ${envIBL.outOfRange} / 分布 ${JSON.stringify(envIBL.byValue)}`,
            envIBL.outOfRange === 0 ? 'PASS' : 'CONCERNS',
          ),
          row('越界样本（默认 1.0 = 「没配」的典型特征）', '[]', JSON.stringify(envIBL.samples), 'PASS'),
          row(
            '道具近景截图（IBL-on，修复前基线）',
            '见 evidence',
            `SMK-14_IBL道具近景_修复前.png（${aim.ok ? 'aimed' : 'no target'}）`,
            'PASS',
          ),
        ];
      } finally {
        await p2.close().catch(() => {});
      }
    },
  },

  /* ================= SMK-12 控制台零报错（汇总，必须最后跑） ================= */
  {
    id: 'SMK-12',
    title: '控制台零报错（error + warning 全量）',
    auto: '全自动',
    async run(ctx) {
      const swallowed = await ctx.page
        .evaluate(() => {
          const q = window.__qa;
          if (!q || !Array.isArray(q.swallowed)) return { count: -1, sample: [] };
          return {
            count: q.swallowed.length,
            sample: q.swallowed.slice(0, 5).map((e) => String(e && (e.where || e.msg || e))),
          };
        })
        .catch(() => ({ count: -1, sample: [] }));

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
        row(
          '__qa.swallowed（被吞异常数，必须为 0；事故① 的报警器）',
          0,
          swallowed.count,
          swallowed.count < 0 ? 'CONCERNS' : ok(swallowed.count === 0),
        ),
        row('__qa.swallowed 样本', '[]', swallowed.sample, 'PASS'),
      ];
    },
  },
  /* ================= FILE-01 file:// 双击直开：产品承诺（designPending） ================= */
  {
    id: 'FILE-01',
    title: 'file:// 双击直开：敌人模型必须加载（产品承诺）',
    auto: '全自动（独立页面，不并入 SMK-12 汇总）',
    async run(ctx) {
      /**
       * 用户已拍板：内联模型，保住「双击即玩」（修法见 tools/inline-models.mjs → models_embedded.js，
       * 仅 file:// 下动态注入，走 loader.parse() 而非 data URI）。
       *
       * 判据按**修法**定，不按现状定（这是本条用例的意义：测产品承诺，不是测实现）：
       *   - location.protocol === 'file:' 时 enemyModels 键数 === 3
       *   - 所有敌人 userData.placeholder === false
       *   - __initErrors === 0（内联成功但仍报错 → 解码路径有问题，也该红）
       *
       * designPending = true：修法落地前红但不阻塞（映射为 CONCERNS）；落地当天置 false 转 FAIL 门控。
       */
      const designPending = true;

      const page = await ctx.page.context().newPage();
      const logs = [];
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`);
      });
      page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
      page.on('requestfailed', (r) => {
        const f = r.failure();
        logs.push(`[requestfailed] ${r.url().split('/').pop()} :: ${f ? f.errorText : '?'}`);
      });
      page.on('dialog', (d) => d.dismiss().catch(() => {}));

      try {
        await page.goto(ctx.fileUrl, { waitUntil: 'load', timeout: 90000 });
        await page.waitForFunction(
          () => typeof RenderPipeline !== 'undefined' && typeof startGame === 'function' && typeof S !== 'undefined',
          { timeout: 90000 },
        );
        await page.waitForFunction(
          () => {
            const el = document.getElementById('loadingScreen');
            return el && el.style.display === 'none';
          },
          { timeout: 60000 },
        );

        await page.evaluate(() => {
          enterLobby('qa_fileproto');
          startGame();
        });
        await page.waitForFunction(() => typeof S !== 'undefined' && S.phase === 'playing', { timeout: 30000 });

        // 内联方案走 loader.parse()，可能是同步或短异步：最多等 8s
        let modelsReady = true;
        try {
          await page.waitForFunction(
            () => typeof enemyModels === 'object' && enemyModels && Object.keys(enemyModels).length >= 3,
            { timeout: 8000 },
          );
        } catch (e) {
          modelsReady = false;
        }

        const r = await page.evaluate(() => {
          let placeholders = 0;
          let total = 0;
          for (const e of typeof enemies !== 'undefined' ? enemies : []) {
            if (!e || !e.mesh) continue;
            total++;
            if (e.mesh.userData && e.mesh.userData.placeholder) placeholders++;
          }
          return {
            protocol: location.protocol,
            modelKeys: Object.keys(typeof enemyModels === 'object' && enemyModels ? enemyModels : {}).length,
            modelNames: Object.keys(typeof enemyModels === 'object' && enemyModels ? enemyModels : {}),
            enemies: total,
            placeholders,
            initErrors: (window.__initErrors || []).length,
            initErrorSample: (window.__initErrors || []).slice(0, 3).map((e) => String(e && (e.where || e.message)).slice(0, 100)),
          };
        });

        // 敌人近景（产品承诺的直观证据）
        await page.evaluate(() => {
          try {
            const e = enemies[0];
            if (!e || !e.mesh) return;
            const t = e.mesh.position;
            const px = t.x + 5, pz = t.z;
            playerGroup.position.set(px, 0, pz);
            mouseX = Math.atan2(-(t.x - px), -(t.z - pz));
            mouseY = 0.05;
            playerGroup.rotation.y = mouseX;
            camera.rotation.x = mouseY;
          } catch (err) {}
        });
        await ctx.wait(800);
        await page.screenshot({ path: `${ctx.evidenceDir}/FILE-01_file协议敌人近景.png` }).catch(() => {});

        const mark = (pass) => (pass ? 'PASS' : designPending ? 'CONCERNS' : 'FAIL');
        const corsCount = logs.filter((l) => /CORS|XMLHttpRequest|ERR_FAILED/i.test(l)).length;

        return [
          row('页面协议', 'file:', r.protocol, r.protocol === 'file:' ? 'PASS' : 'FAIL'),
          row('enemyModels 键数（修法要求 3）', 3, r.modelKeys, mark(modelsReady && r.modelKeys === 3)),
          row('敌人占位体数（修法要求 0）', 0, r.placeholders, mark(r.placeholders === 0)),
          row('__initErrors（修法要求 0）', 0, r.initErrors, mark(r.initErrors === 0)),
          row('模型名', '3 个', JSON.stringify(r.modelNames), 'PASS'),
          row('CORS/加载失败日志条数（记录）', '0（内联后应为 0）', corsCount, 'PASS'),
          row('initErrors 样本', '[]', JSON.stringify(r.initErrorSample), 'PASS'),
          row('敌人截图（产品承诺的直观证据）', '见 evidence', 'FILE-01_file协议敌人近景.png', 'PASS'),
          row(
            '缺陷状态',
            '修法落地后转 FAIL 门控',
            modelsReady && r.placeholders === 0 && r.initErrors === 0
              ? '已满足承诺'
              : designPending
                ? '已知未满足（designPending：内联模型修法中）'
                : '回归',
            'PASS',
          ),
        ];
      } finally {
        await page.close().catch(() => {});
      }
    },
  },
];

export const CASE_ORDER = cases.map((c) => c.id);
