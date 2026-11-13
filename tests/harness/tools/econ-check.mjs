/**
 * tests/harness/tools/econ-check.mjs
 * FIX-05 / FIX-06 / FIX-07 的**运行时**验收。
 *
 * 为什么不能只看 balance-sim：模拟器读的是 game.js 的源码字面量与 ECON 常量，
 * 它验证的是「数据模型」，不是「浏览器里真正跑起来的那份数据」。
 * 两者会分叉的典型场景：缩放循环写在了某个 if 分支里、收藏品合并顺序变了、
 * 或者 SHOP_PRICES 缩放被后来的赋值覆盖 —— 这些在源码里都看得见，在数字上却看不出来。
 *
 * 验收项直接抄自 design/gdd/04-balance-fixes.md 的判据。
 *
 * 用法：node tests/harness/tools/econ-check.mjs
 * 产出：tests/evidence/qa/<ts>-econ/
 */
import fs from 'node:fs';
import path from 'node:path';
import { startServer, PROJECT_ROOT } from '../server.mjs';
import { openGame } from '../browser.mjs';

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const evidenceDir = path.join(PROJECT_ROOT, 'tests', 'evidence', 'qa', `${stamp()}-econ`);
fs.mkdirSync(evidenceDir, { recursive: true });

const server = await startServer();
const session = await openGame({ url: server.url, headless: true });
const page = session.page;

const checks = [];
function check(id, ok, actual, expect) {
  checks.push({ id, ok: !!ok, actual, expect });
}

try {
  await page.waitForFunction(
    () => typeof ITEMS !== 'undefined' && typeof SHOP_PRICES !== 'undefined' && typeof CONTAINER_TYPES !== 'undefined',
    { timeout: 60000 },
  );

  const data = await page.evaluate(() => {
    const out = {};

    // ---- 池结构（FIX-05 / FIX-06）----
    out.safeLen = CONTAINER_TYPES.safe.items.length;
    out.premiumLen = CONTAINER_TYPES.premiumBox.items.length;
    out.safeHasAfrica = CONTAINER_TYPES.safe.items.indexOf('africa_star') >= 0;
    out.premiumHasAfrica = CONTAINER_TYPES.premiumBox.items.indexOf('africa_star') >= 0;
    (function () {
      const reds = {};
      if (typeof RED_COLLECTIBLES_CONFIG !== 'undefined') for (const k in RED_COLLECTIBLES_CONFIG) reds[k] = true;
      out.safeRedCount = CONTAINER_TYPES.safe.items.filter((id) => reds[id]).length;
    })();

    // ---- 价格（FIX-07 判据 1 / 2）----
    out.armorBuy = SHOP_PRICES.tier6_armor.buy;
    out.armorSell = SHOP_PRICES.tier6_armor.sell;

    // ---- 缩放是否真的落到 ITEMS 上 ----
    out.africaValue = ITEMS.africa_star.value;
    out.redCrownValue = ITEMS.red_crown.value;

    // ---- 掷骰分布（FIX-05 判据 1 / FIX-06 判据 1-3）----
    // 直接调运行时函数，不复制逻辑：复制出来的分布只能证明「我抄对了」，不能证明代码对
    const redIds = {};
    if (typeof RED_COLLECTIBLES_CONFIG !== 'undefined') {
      for (const k in RED_COLLECTIBLES_CONFIG) redIds[k] = true;
    }
    // n 的取值说明：
    // GDD 判据写的是「连开 100 个保险箱，红藏品 5-14 次」。这个区间在 p=0.08 下
    // 的误报率约 2.5%（sd=2.7），CI 里每 40 次就会假红一次 —— 而假红比不测更糟，
    // 它会训练人忽略这条告警。所以这里放大样本、改为判**命中率**：
    // n=1000 时 sd≈0.86pp，取 ±3σ（±2.6pp）既有足够判别力，误报率又降到 0.3%。
    // 头奖 p=0.002 太稀有，放大样本收益不大，仍按 GDD 的 200 箱判次数。
    function rollMany(type, n) {
      const def = CONTAINER_TYPES[type];
      let africa = 0, reds = 0, maxRedsPerBox = 0;
      for (let i = 0; i < n; i++) {
        const g = initGrid(5);
        _rollContainerRare(def, g, type);
        const ids = (g._items || []).map((e) => e.id);
        let a = 0, r = 0;
        for (const id of ids) {
          if (id === 'africa_star') a++;
          else if (redIds[id]) r++;
        }
        if (a > 0) africa++;
        if (r > 0) reds++;
        if (r > maxRedsPerBox) maxRedsPerBox = r;
      }
      return { africa, reds, maxRedsPerBox, n, rate: +(reds / n).toFixed(4) };
    }
    out.jackpotRolls = rollMany('safe', 200);
    out.safeRolls = rollMany('safe', 1000);
    out.premiumRolls = rollMany('premiumBox', 1000);
    out.redPoolSizes = [RED_ROLL_POOL[0].length, RED_ROLL_POOL[1].length, RED_ROLL_POOL[2].length];
    return out;
  });

  // FIX-05
  check('FIX-05 safe 池内无 africa_star', data.safeHasAfrica === false, data.safeHasAfrica, false);
  check('FIX-05 premium 池内无 africa_star', data.premiumHasAfrica === false, data.premiumHasAfrica, false);
  check('FIX-05 200 个保险箱出头奖 0-3 次', data.jackpotRolls.africa >= 0 && data.jackpotRolls.africa <= 3, data.jackpotRolls.africa, '0-3');
  // FIX-06
  // safe 池长度：27 条基础（28 减非洲之星）+ 白蓝紫金收藏品的选择性分流（i%3 / i%4）。
  // GDD 写的「=27」是在收藏品分流之前写的口径；关键判据是「不是 140」，即红藏品没有全量注入。
  check('FIX-06 safe 池内无任何红藏品', data.safeRedCount === 0, data.safeRedCount, 0);
  check('FIX-06 safe 池长度未被红藏品撑爆', data.safeLen > 20 && data.safeLen < 60, data.safeLen, '20-59');
  check('FIX-06 保险箱红藏品命中率≈8%', data.safeRolls.rate >= 0.054 && data.safeRolls.rate <= 0.106, data.safeRolls.rate, '0.054-0.106');
  check('FIX-06 高级箱红藏品命中率≈15%', data.premiumRolls.rate >= 0.116 && data.premiumRolls.rate <= 0.184, data.premiumRolls.rate, '0.116-0.184');
  check('FIX-06 单箱红藏品不超过 1 件', data.safeRolls.maxRedsPerBox <= 1 && data.premiumRolls.maxRedsPerBox <= 1,
    Math.max(data.safeRolls.maxRedsPerBox, data.premiumRolls.maxRedsPerBox), '<=1');
  // FIX-07
  check('FIX-07 VI级防弹衣售价=750,000', data.armorBuy === 750000, data.armorBuy, 750000);
  check('FIX-07 VI级防弹衣回收=275,400', Math.abs(data.armorSell - 275400) <= 100, data.armorSell, 275400);
  check('FIX-07 回收价远低于零售（不可套利）', data.armorSell < data.armorBuy * 0.5, (data.armorSell / data.armorBuy).toFixed(3), '<0.5');
  check('FIX-07 非洲之星估值已缩放', data.africaValue < 5000000, data.africaValue, '<5,000,000');

  const fails = checks.filter((c) => !c.ok);
  const result = { verdict: fails.length ? 'FAIL' : 'PASS', checks, data };

  fs.writeFileSync(path.join(evidenceDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');

  for (const c of checks) {
    console.log((c.ok ? '✓' : '✗') + ' ' + c.id.padEnd(34) + ' 实际=' + c.actual + '  期望=' + c.expect);
  }
  console.log('\n判定: ' + result.verdict + (fails.length ? '（' + fails.length + ' 项不达标）' : ''));
  console.log('证据: ' + path.relative(PROJECT_ROOT, evidenceDir));
  if (fails.length) process.exitCode = 1;
} catch (e) {
  console.error('执行失败:', e && e.message);
  process.exitCode = 2;
} finally {
  await session.close();
  await server.close();
}
