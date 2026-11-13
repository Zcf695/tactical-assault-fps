/**
 * tests/harness/tools/fatal-overlay-check.mjs
 * 验证 S-11 方案 B / S-16 的验收判据：
 *   「人为让 enemy_ai.js 加载失败后，玩家能看到明确的错误层，而不是在 3 FPS 里猜」。
 *
 * 实现方式：用 Playwright 的 route 拦截把 enemy_ai.js 的请求 abort 掉，
 * 不需要真的重命名任何文件（避免污染工作区、避免忘记改回来）。
 *
 * 用法：node tests/harness/tools/fatal-overlay-check.mjs
 * 退出码：0 = 判据满足；1 = 不满足
 */
import { startServer, PROJECT_ROOT } from '../server.mjs';
import { openGame } from '../browser.mjs';

const BLOCK = 'enemy_ai.js';

const server = await startServer(PROJECT_ROOT);
const game = await openGame({ url: `${server.url}/index.html` });

let failures = 0;
const chk = (label, cond, actual) => {
  if (cond) console.log('  ✓ ' + label);
  else { console.log('  ✗ ' + label + (actual !== undefined ? '   实际: ' + actual : '')); failures++; }
};

try {
  const { page } = game;

  // 在页面开始加载前拦截：必须在 goto 之前挂 route，但 openGame 里已经 goto 了，
  // 因此这里 reload 一次，让拦截生效。
  await page.route('**/' + BLOCK, (route) => route.abort());
  await page.reload({ waitUntil: 'load', timeout: 90000 });

  // 等错误层出现（不依赖 init 是否跑完 —— 这正是判据的核心）
  let appeared = false;
  try {
    await page.waitForSelector('#fatalOverlay', { timeout: 45000 });
    appeared = true;
  } catch (e) { appeared = false; }

  chk('enemy_ai.js 被拦截后出现 #fatalOverlay', appeared);

  if (appeared) {
    const info = await page.evaluate(() => {
      const el = document.getElementById('fatalOverlay');
      const text = el ? el.innerText : '';
      const z = el ? getComputedStyle(el).zIndex : null;
      const disp = el ? getComputedStyle(el).display : null;
      return {
        text,
        zIndex: z,
        display: disp,
        mentionsEnemyAI: /EnemyAI/.test(text),
        mentionsModule: /关键模块未加载/.test(text),
        mentionsFile: /enemy_ai\.js/.test(text),
        mentionsFix: /index\.html/.test(text),
        initErrors: (window.__initErrors || []).map((e) => ({ where: e.where, message: e.message, fatal: e.fatal })),
        phase: typeof S !== 'undefined' ? S.phase : null,
        startedPlaying: (typeof S !== 'undefined') && S.phase === 'playing',
      };
    });

    chk('错误层文案提到 EnemyAI', info.mentionsEnemyAI);
    chk('错误层文案标题正确（关键模块未加载）', info.mentionsModule);
    chk('错误层给出了文件名 enemy_ai.js', info.mentionsFile);
    chk('错误层给出了排查指引（index.html）', info.mentionsFix);
    chk('错误层在最上层（z-index > 300）', Number(info.zIndex) > 300, info.zIndex);
    chk('错误层可见（display 非 none）', info.display !== 'none', info.display);
    chk('__initErrors 记录了一条 fatal', info.initErrors.some((e) => e.fatal === true && /EnemyAI/.test(e.message)),
      JSON.stringify(info.initErrors));
    chk('游戏未进入 playing（不能带着 3 FPS 继续跑）', info.startedPlaying === false, info.phase);

    console.log('\n  错误层正文预览：\n' + String(info.text).split('\n').slice(0, 8).map((l) => '    ' + l).join('\n'));
  }

  // 反向验证：正常加载时不应出现错误层
  await page.unroute('**/' + BLOCK);
  await page.reload({ waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => typeof startGame === 'function', { timeout: 90000 });
  await page.waitForTimeout(4000);
  const normal = await page.evaluate(() => ({
    hasOverlay: !!document.getElementById('fatalOverlay'),
    initErrors: (window.__initErrors || []).length,
    enemyAI: typeof EnemyAI !== 'undefined',
  }));
  console.log('\n=== 反向验证（正常加载） ===');
  chk('正常加载时不出现 #fatalOverlay', normal.hasOverlay === false);
  chk('正常加载时 EnemyAI 已就位', normal.enemyAI === true);
  chk('正常加载时 __initErrors 为空', normal.initErrors === 0, normal.initErrors);
} finally {
  await game.close();
  await server.close();
}

console.log('\n' + (failures === 0 ? 'PASS — S-11 验收判据满足' : failures + ' 项失败'));
process.exit(failures === 0 ? 0 : 1);
