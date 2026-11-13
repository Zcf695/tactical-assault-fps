/**
 * tests/perf-assert.mjs
 * 性能断言（需要 Chromium + headless SwiftShader）。
 *
 * 由 tests/map-differences.mjs 在末尾以子进程调用；也可独立运行：
 *   node tests/perf-assert.mjs
 *   node tests/map-differences.mjs --fast     # 跳本文件，纯 Node 秒级
 *
 * ── 质量门（主理人裁定；阈值见下）────────────────────────
 *  | 指标                    | 门控                                        |
 *  |-------------------------|---------------------------------------------|
 *  | draw calls              | 目标 ≤300 · >600 CONCERNS · >900 FAIL        |
 *  | 首局 draw calls         | 必须与进图后同量级（≤ 进图后 × 1.3）           |
 *  | 三角形数 / programs     | 确定性指标，入门：programs ≤ 40               |
 *  | 可见网格数              | 确定性指标，入门：≤ 400（合批生效的判据）       |
 *  | __initErrors            | 必须为 0                                     |
 *
 *  ⚠️ js 帧耗时**不入质量门**，只打印。原因（实测）：同提交同机器两次跑差 5–10 倍
 *     （密林 4.8 → 9.5ms、港口 5.4 → 11ms），headless SwiftShader 与主线程抢核。
 *     它只能用于「同次运行内的相对比较」。真机帧率走 tests/strategy.md §8.1.1 的人工采样口径。
 *
 *  反过来说：draw calls / programs / 可见网格数 是确定性的——同一份代码重跑必然一致，
 *  所以它们才可以当门。这是本轮把 js 换出门、把这三个指标换进门的理由。
 *
 * 退出码：0 = PASS / CONCERNS；1 = FAIL
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const asUrl = (p) => pathToFileURL(p).href;

const { startServer } = await import(asUrl(path.join(ROOT, 'tests/harness/server.mjs')));
const { openGame } = await import(asUrl(path.join(ROOT, 'tests/harness/browser.mjs')));

const MAPS = ['military_base', 'forest_outpost', 'industrial_port'];
const FRAMES = 60;
const FRAMES_BOOT = 30;

// 门控阈值
const CALLS_TARGET = 300;    // 目标线
const CALLS_CONCERNS = 600;  // 超过记 CONCERNS
const CALLS_FAIL = 900;      // 超过记 FAIL
const PROGRAMS_MAX = 40;
const VISIBLE_MESH_MAX = 400;
const BOOT_RATIO_MAX = 1.3;  // 首局 calls ≤ 进图后 calls × 1.3

let failed = 0;
let concerns = 0;

function line(level, label, actual, note) {
  if (level === 'FAIL') failed++;
  if (level === 'CONCERNS') concerns++;
  const mark = level === 'PASS' ? '✓' : (level === 'CONCERNS' ? '~' : '✗');
  console.log('  ' + mark + ' [' + level.padEnd(8) + '] ' + label.padEnd(36) +
    String(actual).padStart(9) + (note ? '   ' + note : ''));
}

/** 连续采样 N 帧后取统计量 */
async function sampleFrames(page, frames) {
  return page.evaluate((n) => new Promise((resolve) => {
    const samples = [];
    let i = 0;
    function tick() {
      const pf = window.__perfFrame;
      if (pf) samples.push({ js: pf.js, render: pf.render, total: pf.total });
      if (++i >= n) {
        const nums = (k) => samples.map((s) => s[k]).filter((v) => typeof v === 'number');
        const stat = (arr) => {
          if (!arr.length) return { med: null, max: null, p90: null };
          const s = [...arr].sort((a, b) => a - b);
          return {
            med: +s[Math.floor(s.length / 2)].toFixed(1),
            max: +s[s.length - 1].toFixed(1),
            p90: +s[Math.floor(s.length * 0.9)].toFixed(1),
          };
        };
        return resolve({
          n: samples.length,
          js: stat(nums('js')),
          render: stat(nums('render')),
        });
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }), frames);
}

/**
 * 采集「场景 draw call」——这是本门控唯一可用的口径。
 *
 * 为什么不能直接读 renderer.info.render.calls：
 *   开启 EffectComposer 时，每次 pass 都会 reset info，所以 animate() 末尾读到的是
 *   **最后一个全屏 pass** 的 calls（实测 1，首局甚至读到 122 这种无意义数）。
 * 做法：临时 setPostEnabled(false)，在纯 forward 渲染下采 N 帧取最大值，再恢复。
 *   这样既保留了阴影 pass（真实成本的大头），又不受后期链干扰，且**与降级级别无关**（确定性）。
 * 这个口径与 QA 侧 1050–1103 的基线可比。
 */
async function sampleSceneDrawCalls(page, frames) {
  return page.evaluate((n) => new Promise((resolve) => {
    const prev = (typeof RenderPipeline !== 'undefined' && RenderPipeline.getStats)
      ? RenderPipeline.getStats().post : true;
    if (typeof RenderPipeline !== 'undefined' && RenderPipeline.setPostEnabled) {
      RenderPipeline.setPostEnabled(false);
    }
    let max = 0, min = Infinity, i = 0;
    function tick() {
      const info = (typeof renderer !== 'undefined' && renderer.info) ? renderer.info : null;
      if (info && typeof info.render.calls === 'number') {
        if (info.render.calls > max) max = info.render.calls;
        if (info.render.calls < min) min = info.render.calls;
      }
      if (++i >= n) {
        if (typeof RenderPipeline !== 'undefined' && RenderPipeline.setPostEnabled) {
          RenderPipeline.setPostEnabled(prev);
        }
        return resolve({ callsMax: max, callsMin: min === Infinity ? 0 : min, samples: n });
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }), frames);
}

/** 一次性确定性指标快照（不取统计量，因为它们本来就稳定） */
async function snapshotDeterministic(page) {
  return page.evaluate(() => {
    const env = (typeof mapEnvironmentGroup !== 'undefined') ? mapEnvironmentGroup : null;
    let visibleMeshes = 0, totalMeshes = 0, instanced = 0;
    if (env) {
      env.traverse((o) => {
        if (o.isInstancedMesh) { instanced++; return; }
        if (o.isMesh) { totalMeshes++; if (o.visible) visibleMeshes++; }
      });
    }
    const info = (typeof renderer !== 'undefined' && renderer.info) ? renderer.info : null;
    return {
      callsSnapshot: info ? info.render.calls : null, // 注意：后期链开启时无意义，仅诊断用
      triangles: info ? info.render.triangles : null,
      programs: info && info.programs ? info.programs.length : null,
      geometries: info ? info.memory.geometries : null,
      textures: info ? info.memory.textures : null,
      visibleMeshes, totalMeshes, instanced,
      initErrors: (window.__initErrors || []).length,
    };
  });
}

const server = await startServer(ROOT);
const game = await openGame({ url: `${server.url}/index.html?perfdebug=1` });
const rows = [];
let bootRow = null;
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
  await page.waitForTimeout(1500);

  // ---- 首局（尚未进入任何一局）的 draw call：检验 init 阶段是否已补跑合批 ----
  const bootSamples = await sampleFrames(page, FRAMES_BOOT);
  const bootCalls = await sampleSceneDrawCalls(page, FRAMES_BOOT);
  bootRow = { js: bootSamples.js, ...bootCalls, ...(await snapshotDeterministic(page)) };

  for (const map of MAPS) {
    await page.evaluate((m) => {
      if (typeof enterLobby === 'function') enterLobby('perf_assert');
      selectMap(m);
      startGame();
    }, map);
    await page.waitForFunction(() => typeof S !== 'undefined' && S.phase === 'playing', { timeout: 30000 });
    await page.waitForTimeout(3200); // 等降级守卫完成预热采样，避免测到未稳定档位
    const s = await sampleFrames(page, FRAMES);
    const dc = await sampleSceneDrawCalls(page, FRAMES);
    const det = await snapshotDeterministic(page);
    rows.push({ map, ...s, ...dc, ...det });
  }
} finally {
  await game.close();
  await server.close();
}

// ---------- 打印 ----------
console.log('\n  map                calls(最大) calls(最小)  三角形  programs  可见网格  总网格');
console.log('  ' + '首局(未进图)'.padEnd(18) + String(bootRow.callsMax).padStart(10) + String(bootRow.callsMin).padStart(11) +
  String(bootRow.triangles ?? '-').padStart(9) + String(bootRow.programs ?? '-').padStart(10) +
  String(bootRow.visibleMeshes ?? '-').padStart(10) + String(bootRow.totalMeshes ?? '-').padStart(9));
for (const r of rows) {
  console.log('  ' + r.map.padEnd(18) +
    String(r.callsMax).padStart(10) + String(r.callsMin).padStart(11) +
    String(r.triangles).padStart(9) + String(r.programs).padStart(10) +
    String(r.visibleMeshes).padStart(10) + String(r.totalMeshes).padStart(9));
}

// ---------- 断言 ----------
console.log('\n  —— 质量门（确定性指标）——');

// 1) 首局 draw call：必须与进图后同量级
{
  const inRaid = Math.max(...rows.map((r) => (r.callsMax == null ? 0 : r.callsMax)));
  const boot = bootRow.callsMax;
  const ratio = (boot != null && inRaid > 0) ? boot / inRaid : null;
  line(ratio != null && ratio <= BOOT_RATIO_MAX ? 'PASS' : 'FAIL',
    '首局 calls ≤ 进图后 × ' + BOOT_RATIO_MAX, boot,
    '进图后 ' + inRaid + (ratio != null ? '，比值 ' + ratio.toFixed(2) : '') +
    '（未合批时约为进图后的 3.4 倍）');
}

// 2) 三图 draw call 门控
for (const r of rows) {
  const v = r.callsMax;
  let lvl = 'PASS';
  let note = '';
  if (v > CALLS_FAIL) { lvl = 'FAIL'; note = '> ' + CALLS_FAIL + '，超出底线'; }
  else if (v > CALLS_CONCERNS) { lvl = 'CONCERNS'; note = '> ' + CALLS_CONCERNS + '，未达标（目标 ' + CALLS_TARGET + '）'; }
  else if (v > CALLS_TARGET) { lvl = 'CONCERNS'; note = '> 目标 ' + CALLS_TARGET + '，在底线内'; }
  line(lvl, r.map + ' draw calls (max)', v, note);
}

// 3) programs（着色器程序数，确定性）
for (const r of rows) {
  line(r.programs <= PROGRAMS_MAX ? 'PASS' : 'FAIL', r.map + ' programs ≤ ' + PROGRAMS_MAX, r.programs,
    r.programs > PROGRAMS_MAX ? '材质/材质变体过多，合批或材质复用失效' : '');
}

// 4) 可见网格数（合批是否生效的判据，确定性）
for (const r of rows) {
  line(r.visibleMeshes <= VISIBLE_MESH_MAX ? 'PASS' : 'FAIL',
    r.map + ' 可见网格 ≤ ' + VISIBLE_MESH_MAX, r.visibleMeshes,
    '总网格 ' + r.totalMeshes + '（未合批时会接近总数）');
}

// 5) 诊断通道必须干净
{
  const worst = Math.max(0, bootRow.initErrors, ...rows.map((r) => r.initErrors));
  line(worst === 0 ? 'PASS' : 'FAIL', 'window.__initErrors 为空', worst + ' 条',
    worst ? '有被吞掉的异常，控制台执行 window.__initErrors 查看' : '');
}

// ---------- 参考值（不入质量门）----------
console.log('\n  —— 参考值，不入质量门 ——');
console.log('  js 帧耗时仅作同次运行内的相对比较；跨运行差 5–10 倍属已知环境噪声。');
console.log('  真机帧率走人工采样口径（tests/strategy.md §8.1.1）。');
for (const r of rows) {
  console.log('  ' + r.map.padEnd(19) + 'js 中位 ' + String(r.js.med).padStart(5) + 'ms   ' +
    'p90 ' + String(r.js.p90).padStart(6) + 'ms   max ' + String(r.js.max).padStart(7) + 'ms');
}

console.log('\n  ' + (failed === 0
  ? (concerns === 0 ? 'PERF PASS' : 'PERF PASS（含 ' + concerns + ' 项 CONCERNS）')
  : 'PERF FAIL（' + failed + ' 项）'));
process.exit(failed === 0 ? 0 : 1);
