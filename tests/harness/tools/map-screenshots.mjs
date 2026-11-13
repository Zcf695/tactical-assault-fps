/**
 * tests/harness/tools/map-screenshots.mjs
 * 采三图观感截图 + 首局/进图后 draw call 对照，供美术与主理人复核。
 *
 * 关键：用 ?perf=off 关闭自动降级，否则截到的是 level 4（无 IBL / 无后期 / dpr 0.55）的
 * 降级画面，无法用于判断美术观感。同时记录当时的 dpr 与 level，避免截图与数字对不上。
 *
 * 用法：node tests/harness/tools/map-screenshots.mjs
 * 输出：tests/evidence/<时间戳>/01..04-*.png + drawcall-report.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { startServer, PROJECT_ROOT } from '../server.mjs';
import { openGame } from '../browser.mjs';

const MAPS = [
  ['military_base', '01-军事禁区'],
  ['forest_outpost', '02-密林禁区'],
  ['industrial_port', '03-港口城市'],
];

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const outDir = path.join(PROJECT_ROOT, 'tests', 'evidence', stamp + '-art');
fs.mkdirSync(outDir, { recursive: true });

// 注意：本工具用 ?perf=off 关闭降级以保证画面可判断，此时后期链开启，
// renderer.info.render.calls 只反映最后一个全屏 pass（读到 1），**不代表真实批次**。
// 所以本文件只负责「观感截图 + 雾距/地面/网格数」，draw call 由 perf-assert.mjs 在
// 门控条件下（?perfdebug=1，level≥1 已关后期）单独采集。
function probe() {
  const info = (typeof renderer !== 'undefined' && renderer.info) ? renderer.info : null;
  const env = (typeof mapEnvironmentGroup !== 'undefined') ? mapEnvironmentGroup : null;
  let visible = 0, total = 0;
  if (env) env.traverse((o) => { if (o.isMesh) { total++; if (o.visible) visible++; } });
  const st = (typeof RenderPipeline !== 'undefined' && RenderPipeline.getStats) ? RenderPipeline.getStats() : {};
  return {
    calls: info ? info.render.calls : null,
    triangles: info ? info.render.triangles : null,
    programs: info && info.programs ? info.programs.length : null,
    fogNear: (typeof scene !== 'undefined' && scene.fog) ? scene.fog.near : null,
    fogFar: (typeof scene !== 'undefined' && scene.fog) ? scene.fog.far : null,
    level: (typeof PerformanceGuard !== 'undefined') ? PerformanceGuard.getLevel() : null,
    dpr: st.dpr != null ? st.dpr : null,
    quality: st.quality != null ? st.quality : null,
    envVisibleMeshes: visible,
    envTotalMeshes: total,
    groundSurface: (typeof MAP_DATA !== 'undefined' && MAP_DATA.theme) ? MAP_DATA.theme.groundSurface : null,
    skyColor: (typeof MAP_DATA !== 'undefined' && MAP_DATA.theme) ? '0x' + Number(MAP_DATA.theme.skyColor).toString(16) : null,
  };
}

/** 连续若干帧取 calls 最大值，避开视锥朝向造成的单帧偶然 */
async function callsMax(page, frames) {
  return page.evaluate((n) => new Promise((resolve) => {
    let max = 0, i = 0;
    function tick() {
      const pf = window.__perfFrame;
      if (pf && typeof pf.calls === 'number' && pf.calls > max) max = pf.calls;
      if (++i >= n) return resolve(max);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }), frames);
}

const server = await startServer(PROJECT_ROOT);
const game = await openGame({ url: `${server.url}/index.html?perf=off&perfdebug=1`, viewport: { width: 1600, height: 900 } });
const report = { capturedAt: new Date().toISOString(), note: 'perf=off：自动降级已关闭，画面为设计态', boot: null, maps: [] };

try {
  const { page } = game;
  await page.waitForFunction(
    () => typeof RenderPipeline !== 'undefined' && RenderPipeline.isEnabled() && typeof startGame === 'function',
    { timeout: 120000 },
  );
  await page.waitForFunction(() => {
    const el = document.getElementById('loadingScreen');
    return el && el.style.display === 'none';
  }, { timeout: 90000 });

  // ---- 首局（尚未进图）：检验 init 阶段是否已补跑合批 ----
  await page.waitForTimeout(2000);
  const bootProbe = await page.evaluate(probe);
  const bootCalls = await callsMax(page, 30);
  report.boot = { ...bootProbe, callsMax: bootCalls };
  await page.screenshot({ path: path.join(outDir, '04-首局-未进图.png') });
  console.log('首局(未进图): calls max=' + bootCalls + ' 可见网格=' + bootProbe.envVisibleMeshes +
              '/' + bootProbe.envTotalMeshes + ' level=' + bootProbe.level + ' dpr=' + bootProbe.dpr);

  // ---- 三图进图后 ----
  for (const [map, name] of MAPS) {
    await page.evaluate((m) => {
      if (typeof enterLobby === 'function') enterLobby('qa_shot');
      selectMap(m);
      startGame();
    }, map);
    await page.waitForFunction(() => typeof S !== 'undefined' && S.phase === 'playing', { timeout: 40000 });
    // 等加载/生成稳定、并让自适应分辨率收敛
    await page.waitForTimeout(4000);
    const p = await page.evaluate(probe);
    const cm = await callsMax(page, 40);
    await page.screenshot({ path: path.join(outDir, name + '.png') });
    report.maps.push({ map, ...p, callsMax: cm });
    console.log(name.padEnd(14) +
      ' fog=' + p.fogNear + '/' + p.fogFar +
      ' 地面=' + p.groundSurface +
      ' sky=' + p.skyColor +
      ' calls max=' + String(cm).padStart(5) +
      ' 可见网格=' + p.envVisibleMeshes + '/' + p.envTotalMeshes +
      ' programs=' + p.programs +
      ' level=' + p.level + ' dpr=' + p.dpr);
  }
} finally {
  fs.writeFileSync(path.join(outDir, 'drawcall-report.json'), JSON.stringify(report, null, 2));
  await game.close();
  await server.close();
}

console.log('\n截图与报告 → ' + outDir);
