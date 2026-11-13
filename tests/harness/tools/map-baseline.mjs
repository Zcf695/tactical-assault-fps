/**
 * tests/harness/tools/map-baseline.mjs
 * 采集三张地图的内容量基线，用于维护用例阈值（不是门控，不改判定）。
 *
 * 用法：node tests/harness/tools/map-baseline.mjs
 */
import { startServer, PROJECT_ROOT } from '../server.mjs';
import { openGame } from '../browser.mjs';
import { probeContent, probeGroundUV } from '../probes.mjs';

const MAPS = ['military_base', 'forest_outpost', 'industrial_port'];

const server = await startServer(PROJECT_ROOT);
const game = await openGame({ url: `${server.url}/index.html` });

try {
  const { page } = game;
  await page.waitForFunction(
    () =>
      typeof RenderPipeline !== 'undefined' && RenderPipeline.isEnabled() && typeof startGame === 'function',
    { timeout: 90000 },
  );
  await page.waitForFunction(() => {
    const el = document.getElementById('loadingScreen');
    return el && el.style.display === 'none';
  }, { timeout: 60000 });

  const out = [];
  for (const map of MAPS) {
    await page.evaluate((m) => {
      if (typeof enterLobby === 'function') enterLobby('qa_baseline');
      selectMap(m);
      startGame();
    }, map);
    await page.waitForFunction(() => typeof S !== 'undefined' && S.phase === 'playing', { timeout: 30000 });
    await page.waitForTimeout(3500);
    const c = await page.evaluate(probeContent);
    const uv = await page.evaluate(probeGroundUV, 5.5);
    out.push({ map, ...c, groundUV: { spanX: uv.spanX, expectedSpan: uv.expectedSpan, effectiveTile: uv.effectiveTile } });
    console.log(
      `${map.padEnd(16)} name=${String(c.mapName).padEnd(8)} props=${String(c.propsPlaced).padStart(4)} ` +
        `containers=${String(c.containers).padStart(4)} enemies=${String(c.enemies).padStart(3)} ` +
        `loot=${String(c.groundLoot).padStart(3)} extracts=${String(c.extractPoints).padStart(2)} ` +
        `obstacles=${String(c.obstacles).padStart(4)} uvSpan=${uv.spanX}`,
    );
  }
  console.log('\nJSON:\n' + JSON.stringify(out, null, 2));
} finally {
  await game.close();
  await server.close();
}
