/**
 * tests/harness/tools/perf-trace.mjs
 * 逐帧 JS 耗时追踪，用于定位「单帧尖峰」到底出在哪一段（事故③ 的排查方法论）。
 *
 * 用法：node tests/harness/tools/perf-trace.mjs [采样秒数]
 */
import { startServer, PROJECT_ROOT } from '../server.mjs';
import { openGame } from '../browser.mjs';
import { probeFrame } from '../probes.mjs';

const SECONDS = Number(process.argv[2] || 20);

const server = await startServer(PROJECT_ROOT);
const game = await openGame({ url: `${server.url}/index.html?perfdebug=1` });

try {
  const { page } = game;
  await page.waitForFunction(
    () => typeof RenderPipeline !== 'undefined' && RenderPipeline.isEnabled() && typeof startGame === 'function',
    { timeout: 90000 },
  );
  await page.waitForFunction(
    () => {
      const el = document.getElementById('loadingScreen');
      return el && el.style.display === 'none';
    },
    { timeout: 60000 },
  );

  const t0 = Date.now();
  await page.evaluate(() => {
    enterLobby('qa_trace');
    startGame();
  });
  console.log(`startGame 调用完成 +${Date.now() - t0}ms\n`);

  const samples = [];
  const end = Date.now() + SECONDS * 1000;
  while (Date.now() < end) {
    const f = await page.evaluate(probeFrame);
    if (f.frame) samples.push({ t: Date.now() - t0, ...f.frame, calls: f.calls, enemies: f.enemies });
    await new Promise((r) => setTimeout(r, 100));
  }

  const js = samples.map((s) => s.js).sort((a, b) => a - b);
  const q = (p) => js[Math.min(js.length - 1, Math.floor(js.length * p))];
  console.log(`样本 ${samples.length} 个 / ${SECONDS}s`);
  console.log(`js  p50=${q(0.5).toFixed(1)}  p90=${q(0.9).toFixed(1)}  p99=${q(0.99).toFixed(1)}  max=${js[js.length - 1].toFixed(1)}`);

  const spikes = samples.filter((s) => s.js > 33);
  console.log(`\n超过 33ms 的帧：${spikes.length} 个`);
  for (const s of spikes.slice(0, 15)) {
    console.log(`  +${s.t}ms  js=${s.js}  render=${s.render}  calls=${s.calls}  level=${s.level}`);
  }

  // 前 15 秒的逐点走势（每 5 个点打一行）
  console.log('\n走势（每 500ms 一点，单位 ms）：');
  const line = [];
  for (let i = 0; i < samples.length; i += 5) {
    const chunk = samples.slice(i, i + 5);
    const avg = (chunk.reduce((a, s) => a + s.js, 0) / chunk.length).toFixed(1);
    line.push(`${avg}`);
  }
  console.log(line.join(' '));
} finally {
  await game.close();
  await server.close();
}
