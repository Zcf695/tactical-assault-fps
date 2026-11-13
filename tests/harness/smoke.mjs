/**
 * tests/harness/smoke.mjs — L1 冒烟测试运行器
 *
 * 用法：
 *   node tests/harness/smoke.mjs                 # 无头，跑全部 15 条
 *   node tests/harness/smoke.mjs --headful       # 有头（观察用）
 *   node tests/harness/smoke.mjs --only=SMK-03   # 只跑指定用例（可逗号分隔）
 *
 * 退出码（可直接用于门控）：
 *   0 = 没有 FAIL（CONCERNS 不阻塞，但会显著打印）
 *   1 = 有用例 FAIL
 *   2 = 环境起不来（服务/浏览器/游戏未 boot）
 *
 * 证据：tests/evidence/<YYYYMMDD-HHmmss>/ 下
 *   run.json          本次汇总（机器可读）
 *   <ID>.json         每条用例的断言明细（期望/实际/判定）
 *   <ID>_<名称>.png   截图
 *   console.log       控制台 error+warning 全量
 *   qa-snapshot.json  window.__qa 快照（契约未实现时给出合成快照）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startServer, PROJECT_ROOT } from './server.mjs';
import { openGame, resolveChromePath } from './browser.mjs';
import { cases } from './cases.mjs';
import { probeBoot, probeContent, probeFrame, probeQaHook } from './probes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const headful = argv.includes('--headful');
const onlyArg = argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()) : null;
// 门控自检：故意让指定用例失败，用来验证「失败真的会让退出码变 1」。
// 不测测试本身，等于不知道警报器会不会响。
// 单用例超时：SMK-14 要开第二个页面（冷启动 15–25s），45s 在负载机上不够
const CASE_TIMEOUT_MS = Number(process.env.QA_CASE_TIMEOUT_MS || 90000);
const faultArg = argv.find((a) => a.startsWith('--fault-inject='));
const faultInject = faultArg ? faultArg.slice('--fault-inject='.length).split(',').map((s) => s.trim()) : [];

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(
    d.getSeconds(),
  )}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function worstStatus(assertions) {
  if (assertions.some((a) => a.pass === 'FAIL')) return 'FAIL';
  if (assertions.some((a) => a.pass === 'CONCERNS')) return 'CONCERNS';
  return 'PASS';
}

function fmt(v) {
  if (typeof v === 'string') return v.length > 120 ? v.slice(0, 120) + '…' : v;
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s.length > 160 ? s.slice(0, 160) + '…' : s;
  }
  return String(v);
}

async function main() {
  const runId = stamp();
  const evidenceDir = path.join(PROJECT_ROOT, 'tests', 'evidence', runId);
  fs.mkdirSync(evidenceDir, { recursive: true });

  const t0 = Date.now();

  // --only 模式下自动补前置：除 SMK-01 外，所有用例都要求已经进入行动阶段（SMK-02）。
  // 否则会把「没开局」误报成用例失败——测试依赖必须显式化，不能靠记忆。
  const needsGameplay = (id) => id !== 'SMK-01' && id !== 'SMK-02';
  let selected;
  const setupIds = [];
  if (only) {
    selected = cases.filter((c) => only.includes(c.id));
    if (selected.some((c) => needsGameplay(c.id)) && !only.includes('SMK-02')) {
      setupIds.push('SMK-02');
      selected = [cases.find((c) => c.id === 'SMK-02'), ...selected];
    }
  } else {
    selected = cases;
  }

  let server = null;
  let game = null;

  try {
    server = await startServer(PROJECT_ROOT);
    console.log(`[env] 静态服务 ${server.url}  (root=${PROJECT_ROOT})`);
    console.log(`[env] chromium ${resolveChromePath()}`);
    console.log(`[env] headless=${!headful}  evidence=${path.relative(PROJECT_ROOT, evidenceDir)}`);
    console.log('');

    game = await openGame({ url: `${server.url}/index.html?perfdebug=1`, headful });
    const { page } = game;

    // 启动门槛：模块必须真正 init 完成（不是「已定义」）
    await page.waitForFunction(
      () =>
        typeof RenderPipeline !== 'undefined' &&
        RenderPipeline.isEnabled() &&
        typeof startGame === 'function' &&
        typeof S !== 'undefined',
      { timeout: 90000 },
    );
    await page.waitForFunction(
      () => {
        const el = document.getElementById('loadingScreen');
        return el && el.style.display === 'none';
      },
      { timeout: 60000 },
    );

    const results = [];
    const sharedState = {}; // 跨用例共享（SMK-02→SMK-09 的 scene.children 基线、SMK-11→REG-03 的空场 JS）
    let shotSeq = 0;

    for (const c of selected) {
      const ctx = {
        page,
        consoleLog: game.consoleLog,
        missing: server.missing,
        state: sharedState,
        baseUrl: `${server.url}/index.html`,
        evidenceDir,
        wait: sleep,
        call: (fn, ...args) => page.evaluate(fn, ...args),
        // 需要「干净页面」的用例用这个（例如要在未降级的画质档上验证降级行为）
        newGamePage: async (query = '') => {
          const p2 = await page.context().newPage();
          p2.on('console', (m) => {
            const t = m.type();
            if (t === 'error' || t === 'warning') game.consoleLog.push({ t: 0, level: t, text: m.text() });
          });
          p2.on('pageerror', (e) => game.consoleLog.push({ t: 0, level: 'pageerror', text: e.message }));
          p2.on('dialog', (d) => d.dismiss().catch(() => {}));
          await p2.goto(`${server.url}/index.html${query}`, { waitUntil: 'load', timeout: 90000 });
          await p2.waitForFunction(
            () => typeof RenderPipeline !== 'undefined' && typeof startGame === 'function' && typeof S !== 'undefined',
            { timeout: 90000 },
          );
          return p2;
        },
        shot: async (name) => {
          shotSeq++;
          const file = path.join(evidenceDir, `${name}.png`);
          try {
            await page.screenshot({ path: file });
          } catch (e) {
            /* 截图失败不影响判定 */
          }
        },
      };

      const started = Date.now();
      let assertions = [];
      let error = null;
      try {
        // 单用例硬超时，避免某条卡住把整轮拖死
        assertions = await Promise.race([
          c.run(ctx),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`用例超时 ${CASE_TIMEOUT_MS}ms（可用 QA_CASE_TIMEOUT_MS 调整）`)), CASE_TIMEOUT_MS),
          ),
        ]);
      } catch (e) {
        error = e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e);
        assertions = [{ name: '用例执行未抛异常', expected: 'no throw', actual: error, pass: 'FAIL' }];
      }
      const durationMs = Date.now() - started;
      const isSetup = setupIds.includes(c.id);
      let verdict = error ? 'FAIL' : worstStatus(assertions);
      if (faultInject.includes(c.id)) {
        faultInject.includes(c.id);
        assertions = [
          ...assertions,
          { name: '门控自检（--fault-inject）', expected: '正常', actual: '强制失败', pass: 'FAIL' },
        ];
        verdict = 'FAIL';
      }

      results.push({ id: c.id, title: c.title, auto: c.auto, verdict, durationMs, assertions, error, setup: isSetup });

      fs.writeFileSync(
        path.join(evidenceDir, `${c.id}.json`),
        JSON.stringify({ id: c.id, title: c.title, verdict, durationMs, assertions, error }, null, 2),
        'utf8',
      );

      const mark = verdict === 'PASS' ? '✔' : verdict === 'CONCERNS' ? '!' : '✘';
      console.log(`${mark} ${c.id} ${c.title}  (${durationMs}ms)  ${verdict}${isSetup ? '  [前置]' : ''}`);

      if (verdict !== 'PASS') {
        for (const a of assertions.filter((x) => x.pass !== 'PASS')) {
          console.log(`     - [${a.pass}] ${a.name}：期望 ${fmt(a.expected)}，实际 ${fmt(a.actual)}`);
        }
        if (error) console.log(`     - 异常：${error}`);
      }
    }

    /* ---------- 汇总证据 ---------- */
    const boot = await page.evaluate(probeBoot).catch(() => null);
    const content = await page.evaluate(probeContent).catch(() => null);
    const frame = await page.evaluate(probeFrame).catch(() => null);
    const qa = await page.evaluate(probeQaHook).catch(() => null);

    fs.writeFileSync(
      path.join(evidenceDir, 'console.log'),
      game.consoleLog.map((e) => `[+${e.t}ms][${e.level}] ${e.text}`).join('\n') || '(no error / warning)\n',
      'utf8',
    );

    fs.writeFileSync(
      path.join(evidenceDir, 'qa-snapshot.json'),
      JSON.stringify(
        {
          contract: 'window.__qa（tests/strategy.md §7.5 定义；当前实现状态见 source 字段）',
          source: qa ? qa.source : 'unavailable',
          qa: qa ? qa.qa : null,
          composedFallback: qa && qa.source === 'composed-fallback' ? { boot, content, frame } : null,
          capturedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      'utf8',
    );

    const counted = results.filter((r) => !r.setup);
    const failed = counted.filter((r) => r.verdict === 'FAIL');
    const concerns = counted.filter((r) => r.verdict === 'CONCERNS');
    const passed = counted.filter((r) => r.verdict === 'PASS');
    const totalMs = Date.now() - t0;

    const run = {
      runId,
      durationMs: totalMs,
      env: {
        headless: !headful,
        chromium: resolveChromePath(),
        viewport: '1440x810',
        url: '/index.html?perfdebug=1',
      },
      summary: { total: counted.length, passed: passed.length, concerns: concerns.length, failed: failed.length, setup: results.filter((r) => r.setup).map((r) => `${r.id}:${r.verdict}`) },
      cases: results.map((r) => ({
        id: r.id,
        title: r.title,
        verdict: r.verdict,
        durationMs: r.durationMs,
        failed: r.assertions.filter((a) => a.pass !== 'PASS'),
      })),
      console: { total: game.consoleLog.length, entries: game.consoleLog.slice(0, 50) },
      perf: frame ? { frame: frame.frame, calls: frame.calls, guardLevel: frame.guardLevel, dpr: frame.dpr } : null,
      missingResources: server.missing,
    };
    fs.writeFileSync(path.join(evidenceDir, 'run.json'), JSON.stringify(run, null, 2), 'utf8');

    console.log('');
    console.log('──────────────────────────────────────────────────────────');
    console.log(
      `总计 ${counted.length} 条：PASS ${passed.length} / CONCERNS ${concerns.length} / FAIL ${failed.length}   ` +
        `耗时 ${(totalMs / 1000).toFixed(1)}s`,
    );
    if (concerns.length) {
      console.log(`CONCERNS（不阻塞合并，但需记录）：${concerns.map((r) => r.id).join(', ')}`);
      for (const r of concerns) {
        for (const a of r.assertions.filter((x) => x.pass === 'CONCERNS')) {
          console.log(`   ! ${r.id} ${a.name}：期望 ${fmt(a.expected)}，实际 ${fmt(a.actual)}`);
        }
      }
    }
    if (failed.length) {
      console.log(`FAIL：${failed.map((r) => r.id).join(', ')}`);
    }
    if (server.missing.length) {
      const real = server.missing.filter((m) => !/favicon/i.test(m));
      if (real.length) console.log(`缺失资源：${[...new Set(real)].join(', ')}`);
    }
    console.log(`证据目录：${path.relative(PROJECT_ROOT, evidenceDir)}`);
    console.log('──────────────────────────────────────────────────────────');

    return failed.length > 0 ? 1 : 0;
  } catch (e) {
    console.error('');
    console.error('✘ 环境起不来（退出码 2）：', e && e.message ? e.message : e);
    if (e && e.code === 'ENO_BROWSER') {
      console.error('  提示：设置 QA_CHROME 指向 chrome.exe，或在 tests/harness 下安装 ms-playwright 浏览器。');
    }
    return 2;
  } finally {
    if (game) await game.close().catch(() => {});
    if (server) await server.close().catch(() => {});
  }
}

main().then((code) => process.exit(code));
