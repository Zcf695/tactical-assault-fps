/**
 * tests/harness/tools/perf-baseline.mjs
 * 采集三张地图的渲染/逻辑基线：雾距、js 帧耗时、draw call、对象数、降级级别。
 *
 * 用途：
 *   1) 给「性能门」提供可比较的数字（draw call 预算 ≤600 目标 / ≤900 底线）；
 *   2) 验证 S1-5 的雾距修复是否在运行时真的按地图生效；
 *   3) 验证 S-13 的 _dprFloor 与 S-16 的 __initErrors 通道没有副作用。
 *
 * 用法：
 *   node tests/harness/tools/perf-baseline.mjs
 *   node tests/harness/tools/perf-baseline.mjs --perf=off   # 关掉自动降级，看真实上限
 *
 * 说明：本工具只读、不判定。断言在 cases.mjs 里。
 */
import { startServer, PROJECT_ROOT } from '../server.mjs';
import { openGame } from '../browser.mjs';

const MAPS = ['military_base', 'forest_outpost', 'industrial_port'];
const SAMPLE_FRAMES = 90;

// 透传额外的 query（默认 perfdebug=1 以便读取 window.__perfFrame）
const extraQuery = process.argv.slice(2).filter((a) => a.startsWith('--perf='))
  .map((a) => a.slice(2)).join('&');
const query = 'perfdebug=1' + (extraQuery ? '&' + extraQuery : '');

/** 在页面内执行：采集当前帧的渲染/雾/对象数指标 */
function probeFrame() {
  const out = {
    fogNear: null, fogFar: null,
    calls: null, triangles: null, js: null, render: null, total: null,
    level: null, quality: null, dpr: null, dprFloor: null,
    envChildren: null, sceneChildren: null,
  };
  try {
    if (typeof scene !== 'undefined' && scene && scene.fog) {
      out.fogNear = scene.fog.near;
      out.fogFar = scene.fog.far;
    }
    if (typeof renderer !== 'undefined' && renderer && renderer.info) {
      out.calls = renderer.info.render.calls;
      out.triangles = renderer.info.render.triangles;
    }
    const pf = window.__perfFrame;
    if (pf) { out.js = pf.js; out.render = pf.render; out.total = pf.total; out.level = pf.level; }
    if (typeof PerformanceGuard !== 'undefined') out.level = PerformanceGuard.getLevel();
    if (typeof RenderPipeline !== 'undefined' && RenderPipeline.getStats) {
      const st = RenderPipeline.getStats();
      out.quality = st.quality; out.dpr = st.dpr; out.dprFloor = st.dprFloor;
    }
    if (typeof mapEnvironmentGroup !== 'undefined' && mapEnvironmentGroup) {
      out.envChildren = mapEnvironmentGroup.children.length;
    }
    if (typeof scene !== 'undefined' && scene) out.sceneChildren = scene.children.length;
  } catch (e) {
    out.error = e && e.message ? e.message : String(e);
  }
  return out;
}

/** 连续采样 N 帧后取中位数，避开首帧抖动 */
async function sampleStable(page, frames) {
  await page.evaluate((n) => {
    window.__samples = [];
    return new Promise((resolve) => {
      let i = 0;
      function tick() {
        const pf = window.__perfFrame;
        if (pf) window.__samples.push({ ...pf });
        if (++i >= n) return resolve();
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }, frames);
  return page.evaluate(() => {
    const s = window.__samples || [];
    const med = (key) => {
      const v = s.map((x) => x[key]).filter((x) => typeof x === 'number').sort((a, b) => a - b);
      return v.length ? v[Math.floor(v.length / 2)] : null;
    };
    const mx = (key) => {
      const v = s.map((x) => x[key]).filter((x) => typeof x === 'number');
      return v.length ? Math.max(...v) : null;
    };
    return { n: s.length, jsMed: med('js'), renderMed: med('render'), callsMax: mx('calls'), callsMed: med('calls') };
  });
}

const server = await startServer(PROJECT_ROOT);
const game = await openGame({ url: `${server.url}/index.html?${query}` });

try {
  const { page } = game;
  await page.waitForFunction(
    () => typeof RenderPipeline !== 'undefined' && RenderPipeline.isEnabled() && typeof startGame === 'function',
    { timeout: 90000 },
  );
  await page.waitForFunction(() => {
    const el = document.getElementById('loadingScreen');
    return el && el.style.display === 'none';
  }, { timeout: 60000 });

  // 启动健康检查：S-16 通道必须存在且为空
  const boot = await page.evaluate(() => ({
    initErrors: (window.__initErrors || []).map((e) => ({ where: e.where, message: e.message, fatal: e.fatal })),
    modules: (window.__qa && window.__qa.modules) || null,
    hasSwallowedAlias: !!(window.__qa && window.__qa.swallowed),
  }));
  console.log('=== 启动健康检查 ===');
  console.log('  __initErrors 条数 : ' + boot.initErrors.length);
  console.log('  __qa.swallowed 别名: ' + boot.hasSwallowedAlias);
  if (boot.initErrors.length) console.log('  ' + JSON.stringify(boot.initErrors, null, 2));
  if (boot.modules) console.log('  模块就位: ' + JSON.stringify(boot.modules));

  const rows = [];
  for (const map of MAPS) {
    // 先 selectMap 再 startGame：两次 rebuildMapEnvironment 都在 GraphicsEnhancement 就绪之后，
    // 因此这里测到的是「静态合批已生效」的稳态 draw call（不是首局未合批的偏高值）。
    await page.evaluate((m) => {
      if (typeof enterLobby === 'function') enterLobby('qa_perf');
      selectMap(m);
      startGame();
    }, map);
    await page.waitForFunction(() => typeof S !== 'undefined' && S.phase === 'playing', { timeout: 30000 });
    await page.waitForTimeout(3200); // 等降级守卫完成预热采样，避免测到未稳定的档位
    const frame = await page.evaluate(probeFrame);
    const s = await sampleStable(page, SAMPLE_FRAMES);
    rows.push({ map, ...frame, ...s });
  }

  console.log('\n=== 三图渲染基线（headless SwiftShader） ===');
  const pad = (v, n) => String(v == null ? '-' : v).padEnd(n);
  console.log(
    pad('map', 17) + pad('fog', 10) + pad('jsMed', 8) + pad('renderMed', 10) +
    pad('calls', 8) + pad('tris', 10) + pad('lvl', 5) + pad('dpr', 7) + pad('floor', 7) + pad('env', 6),
  );
  for (const r of rows) {
    console.log(
      pad(r.map, 17) +
      pad((r.fogNear == null ? '-' : r.fogNear + '/' + r.fogFar), 10) +
      pad(r.jsMed, 8) + pad(r.renderMed, 10) +
      pad(r.callsMax, 8) + pad(r.triangles, 10) + pad(r.level, 5) +
      pad(r.dpr, 7) + pad(r.dprFloor, 7) + pad(r.envChildren, 6),
    );
  }

  console.log('\n=== 雾距判定（S1-5 ② 运行时验证） ===');
  const EXPECT = { military_base: [55, 205], forest_outpost: [45, 195], industrial_port: [65, 235] };
  let fogOk = 0;
  for (const r of rows) {
    const [en, ef] = EXPECT[r.map];
    const ok = r.fogNear === en && r.fogFar === ef;
    if (ok) fogOk++;
    console.log('  ' + (ok ? '✓' : '✗') + ' ' + r.map.padEnd(17) +
      '实测 ' + r.fogNear + '/' + r.fogFar + '  期望 ' + en + '/' + ef);
  }
  console.log('  → ' + fogOk + '/3 生效');

  console.log('\nJSON:\n' + JSON.stringify(rows, null, 2));
} finally {
  await game.close();
  await server.close();
}
