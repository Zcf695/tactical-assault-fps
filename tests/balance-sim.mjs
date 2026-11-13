#!/usr/bin/env node
/**
 * tests/balance-sim.mjs
 * 经济平衡模拟与验收工具
 *
 * 用途：它是 FIX-05 / FIX-06 / FIX-07 的**验收工具**。
 *       「改完价格没人能证明改对了」——这个脚本就是那个证明。
 *
 * 运行：
 *   node tests/balance-sim.mjs                        # 输出三张表（修复后模型，默认参数）
 *   node tests/balance-sim.mjs --state=current         # 输出当前代码的实测值（未修复）
 *   node tests/balance-sim.mjs --loot-scale=0.30       # 敏感性扫描
 *   node tests/balance-sim.mjs --check                 # 断言目标值，超标则 exit 1
 *   node tests/balance-sim.mjs --json                  # 机器可读输出（CI 用）
 *
 * 命令行参数（全部可选）：
 *   --state=current|fixed   模型状态，默认 fixed
 *   --loot-scale=0.27       战利品估值系数（FIX-07），默认 0.27
 *   --price-scale=0.625     零售价系数（FIX-07），默认 0.625（即 ÷1.6）
 *   --survival=t1,t2,t3     三档存活率，默认 0.45,0.60,0.80
 *   --boxes=20              单局搜索容器数，默认 20
 *   --bag=中背包             指定背包名做单局模拟，默认「中背包」
 *   --runs=3000             蒙特卡洛次数，默认 3000
 *   --seed=42               随机种子（保证可复现），默认 42
 *   --json                  输出 JSON
 *   --check                 断言模式（exit 1 表示不达标）
 *
 * 零依赖，不需要 package.json，符合 ADR-001「无构建」约束。
 */

import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ============================================================
// 一、可调参数与模型常量
// ============================================================

const DEFAULT_OPTS = {
  state: 'fixed',          // current | fixed
  lootScale: 0.27,         // FIX-07
  priceScale: 0.625,       // FIX-07（÷1.6）
  survival: [0.45, 0.60, 0.80],
  boxes: 20,
  bagName: '中背包',
  runs: 3000,
  seed: 42,
  json: false,
  check: false,
};

// ---- FIX-05：头奖独立掷骰概率（每箱）----
const JACKPOT = { safe: 0.002, premiumBox: 0.004 };
const JACKPOT_ID = 'africa_star';

// ---- FIX-06：红藏品稀有掷骰 ----
// 触发概率 + 三档权重（T3入门 <₵100万 / T2中档 ₵100–500万 / T1顶级 ≥₵500万）
const RED_ROLL = {
  safe:       { p: 0.08, w: [0.78, 0.19, 0.03] },
  premiumBox: { p: 0.15, w: [0.72, 0.24, 0.04] },
};
const RED_TIER_BOUNDS = [1e6, 5e6]; // [T3<1e6 ≤ T2 <5e6 ≤ T1]

/**
 * 手写进最字面量的红藏品（**不是** concat 注入的）。
 * FIX-06 的「fixed」模型会移除 concat 注入项，但必须保留这些手写项，
 * 因为它们是 safe / premiumBox 的原始设计定位。
 *
 * 快照来源：game.js 的 CONTAINER_TYPES.safe.items / premiumBox.items 字面量。
 * 若有人改动了那里的字面量，本脚本的 self-check 会报警（见 verifyLiteralReds）。
 */
const HANDWRITTEN_REDS = {
  safe: ['red_ring', 'red_watch', 'red_necklace', 'red_tiger', 'red_vase'],
  premiumBox: ['red_ring', 'red_necklace', 'red_tiger', 'red_vase', 'red_lion',
               'red_crown', 'red_painting', 'red_statue', 'red_scepter'],
};

// ---- 背包（格数用于装箱约束）----
const BAGS = [
  { name: '无背包', cells: 9,   note: '仅安全箱 3×3' },
  { name: '小背包', cells: 12 },
  { name: '中背包', cells: 20 },
  { name: '大背包', cells: 30 },
  { name: '伽马包', cells: 56 },
];

// ---- 三档配装（FIX-07 §1.1）----
const KITS = [
  { tier: 'T1', label: '入门', items: ['tier1_armor', 'tier1_helmet', 'small_bag', 'basic_rig', 'pistol_item', 'smg_item'] },
  { tier: 'T2', label: '进阶', items: ['tier3_armor', 'tier3_helmet', 'medium_bag', 'tactical_rig', 'rifle_item', 'smg_item'] },
  { tier: 'T3', label: '顶级', items: ['tier6_armor', 'tier6_helmet', 'gamma_bag', 'heavy_rig', 'hmg_item', 'antiMat_item', 'rifle_item'] },
];

// ---- 军事禁区容器配比（容器数实测 170）----
const MILITARY_MIX = {
  weaponBox: 29, equipBox: 29, ammoBox: 29,
  supplyBox: 29, safe: 28, medBox: 26,
};

// ---- 验收目标（来自 design/gdd/04-balance-fixes.md §1）----
// 这些是「修复后模型」应有的值，即 --state=fixed 的输出。
// 工程侧实施 FIX-05/06/07 之后，--state=current 应当收敛到同一组数——这才是真正的验收。
const TARGETS = {
  kitCost: { T1: 206200, T2: 456400, T3: 4000100 },
  raidsToT3: { min: 8, max: 15 },
  boxEV: {
    ammoBox: 8658, medBox: 19213, supplyBox: 19231, equipBox: 61519,
    weaponBox: 81915, safe: 193421, premiumBox: 319663,
  },
  boxEVTolerance: 0.05,     // ±5%（目标即模型自洽值，应收敛而非区间）
  soloRaidGross: 878564,    // 中背包 20 箱
  soloRaidTolerance: 0.15,
};

// ============================================================
// 二、命令行解析
// ============================================================

function parseArgs(argv) {
  const o = { ...DEFAULT_OPTS, survival: [...DEFAULT_OPTS.survival] };
  for (const raw of argv.slice(2)) {
    if (raw === '--json') { o.json = true; continue; }
    if (raw === '--check') { o.check = true; continue; }
    if (raw === '--help' || raw === '-h') { printHelp(); process.exit(0); }
    const m = /^--([\w-]+)=(.*)$/.exec(raw);
    if (!m) { console.error('未知参数: ' + raw + '（--help 查看用法）'); process.exit(2); }
    const [, k, v] = m;
    switch (k) {
      case 'state':      o.state = v; break;
      case 'loot-scale': o.lootScale = Number(v); break;
      case 'price-scale':o.priceScale = Number(v); break;
      case 'survival':   o.survival = v.split(',').map(Number); break;
      case 'boxes':      o.boxes = Number(v); break;
      case 'bag':        o.bagName = v; break;
      case 'runs':       o.runs = Number(v); break;
      case 'seed':       o.seed = Number(v); break;
      default: console.error('未知参数: --' + k); process.exit(2);
    }
  }
  if (!['current', 'fixed'].includes(o.state)) {
    console.error('--state 必须是 current 或 fixed'); process.exit(2);
  }
  if (o.survival.length !== 3 || o.survival.some(n => !(n > 0 && n <= 1))) {
    console.error('--survival 需要三个 0~1 之间的值，如 --survival=0.45,0.60,0.80'); process.exit(2);
  }
  if (o.runs < 100) { console.error('--runs 至少 100'); process.exit(2); }
  return o;
}

function printHelp() {
  console.log([
    '用法: node tests/balance-sim.mjs [选项]',
    '',
    '  --state=current|fixed   模型状态，默认 fixed',
    '  --loot-scale=N          战利品估值系数，默认 0.27',
    '  --price-scale=N         零售价系数，默认 0.625',
    '  --survival=a,b,c        三档存活率，默认 0.45,0.60,0.80',
    '  --boxes=N               单局搜索容器数，默认 20',
    '  --bag=NAME              单局模拟用的背包，默认 中背包',
    '  --runs=N                蒙特卡洛次数，默认 3000',
    '  --seed=N                随机种子，默认 42',
    '  --json                  机器可读输出',
    '  --check                 断言目标值（exit 1 = 不达标）',
  ].join('\n'));
}

// ============================================================
// 三、确定性随机（mulberry32）—— 保证 CI 可复现
// ============================================================

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// 四、从 game.js / 配置文件提取数据（不执行整个 game.js）
// ============================================================

/**
 * 从源码中按大括号配平提取一个对象/数组字面量，用 vm 求值为纯数据。
 * 会跳过字符串与行注释中的括号，避免误配平。
 */
function extractLiteral(src, marker, filename) {
  const at = src.indexOf(marker);
  if (at < 0) throw new Error(filename + ' 中找不到 ' + marker);
  let i = src.indexOf('{', at);
  const arrAt = src.indexOf('[', at);
  if (arrAt >= 0 && arrAt < i) i = arrAt;
  if (i < 0) throw new Error(marker + ' 之后没有 { 或 [');

  const open = src[i];
  const close = open === '{' ? '}' : ']';
  let depth = 0, j = i, inStr = null, inLine = false, inBlock = false;

  for (; j < src.length; j++) {
    const c = src[j], prev = src[j - 1], next = src[j + 1];

    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '*' && next === '/') { inBlock = false; j++; } continue; }
    if (inStr) {
      if (c === '\\') { j++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && next === '/') { inLine = true; j++; continue; }
    if (c === '/' && next === '*') { inBlock = true; j++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }

    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) { j++; break; }
    }
  }
  const literal = src.slice(i, j);
  return vm.runInNewContext('(' + literal + ')', Object.create(null), { timeout: 5000 });
}

function loadData() {
  const gameSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
  const ccSrc = fs.readFileSync(path.join(ROOT, 'collectibles_config.js'), 'utf8');
  const rcSrc = fs.readFileSync(path.join(ROOT, 'red_collectibles_config.js'), 'utf8');

  const ITEMS = extractLiteral(gameSrc, 'const ITEMS = {', 'game.js');
  const SHOP_PRICES = extractLiteral(gameSrc, 'const SHOP_PRICES = {', 'game.js');
  const CONTAINER_TYPES = extractLiteral(gameSrc, 'const CONTAINER_TYPES = {', 'game.js');
  const CC = extractLiteral(ccSrc, 'COLLECTIBLES_CONFIG', 'collectibles_config.js');
  const RC = extractLiteral(rcSrc, 'RED_COLLECTIBLES_CONFIG', 'red_collectibles_config.js');

  // 检测 game.js 里是否仍存在「红藏品全量 concat」（FIX-06 未修时的特征）
  const hasRedConcat = /CONTAINER_TYPES\.(safe|premiumBox)\.items\s*=\s*CONTAINER_TYPES\.\1\.items\.concat\(\s*_rcIds\s*\)/.test(gameSrc);

  return { ITEMS, SHOP_PRICES, CONTAINER_TYPES, CC, RC, hasRedConcat, gameSrc };
}

// ============================================================
// 五、构建模型（current / fixed）
// ============================================================

function buildModel(data, opts) {
  const { ITEMS, SHOP_PRICES, CONTAINER_TYPES, CC, RC, hasRedConcat } = data;

  // 深拷贝，避免污染源数据
  const items = JSON.parse(JSON.stringify(ITEMS));
  const prices = JSON.parse(JSON.stringify(SHOP_PRICES));
  const pools = JSON.parse(JSON.stringify(CONTAINER_TYPES));

  // ---- 补入收藏品（对齐 game.js 的合并逻辑）----
  for (const id in RC) {
    items[id] = { name: RC[id].name, value: RC[id].value, type: 'valuable', rarity: 'ultimate', w: RC[id].w || 1, h: RC[id].h || 1, _red: true };
    prices[id] = { buy: RC[id].value, sell: Math.floor(RC[id].value * 0.85) };
  }
  for (const id in CC) {
    items[id] = { name: CC[id].name, value: CC[id].value, type: 'valuable', rarity: CC[id].rarity, w: CC[id].w || 1, h: CC[id].h || 1 };
    prices[id] = { buy: CC[id].value, sell: Math.floor(CC[id].value * 0.85) };
  }
  const redIds = Object.keys(RC);

  // ---- 红藏品分档（FIX-06 用）----
  const tier = (id) => {
    const v = RC[id].value;
    return v < RED_TIER_BOUNDS[0] ? 0 : (v < RED_TIER_BOUNDS[1] ? 1 : 2);
  };
  const redByTier = [[], [], []];
  for (const id of redIds) redByTier[tier(id)].push(id);

  let lootScale, priceScale;
  let useJackpot = false, useRedRoll = false;

  if (opts.state === 'current') {
    // 当前代码的实测：应用 game.js 运行时的 concat 行为
    lootScale = 1;
    priceScale = 1;
    if (hasRedConcat) {
      pools.safe.items = pools.safe.items.concat(redIds);
      pools.premiumBox.items = pools.premiumBox.items.concat(redIds);
    }
    // 白蓝紫金的分流（若代码里已有，则已经在 CONTAINER_TYPES 字面量之外——
    // 这里同样复刻，保证 current 与浏览器一致）
    const wc = [], bc = [], pc = [], gc = [];
    for (const id in CC) {
      const r = CC[id].rarity;
      if (r === 'common') wc.push(id);
      else if (r === 'rare') bc.push(id);
      else if (r === 'epic') pc.push(id);
      else if (r === 'legendary') gc.push(id);
    }
    pools.supplyBox.items = pools.supplyBox.items.concat(wc.filter((_, i) => i % 3 === 0));
    pools.equipBox.items = pools.equipBox.items.concat(bc.filter((_, i) => i % 3 === 0));
    pools.equipBox.items = pools.equipBox.items.concat(pc.filter((_, i) => i % 4 === 0));
    pools.safe.items = pools.safe.items.concat(pc.filter((_, i) => i % 3 === 0));
    pools.safe.items = pools.safe.items.concat(gc.filter((_, i) => i % 4 === 0));
    pools.premiumBox.items = pools.premiumBox.items.concat(gc.filter((_, i) => i % 3 === 0));
  } else {
    // fixed：FIX-05 + FIX-06 + FIX-07 全部生效
    lootScale = opts.lootScale;
    priceScale = opts.priceScale;
    useJackpot = true;
    useRedRoll = true;

    // FIX-05：把非洲之星移出常规池
    for (const t of ['safe', 'premiumBox']) {
      pools[t].items = pools[t].items.filter((id) => id !== JACKPOT_ID);
    }
    // FIX-06：把 concat 注入的红藏品剔除，只保留手写项
    for (const t of ['safe', 'premiumBox']) {
      const allow = new Set(HANDWRITTEN_REDS[t]);
      const seen = new Set();
      pools[t].items = pools[t].items.filter((id) => {
        if (!redIds.includes(id)) return true;
        if (!allow.has(id)) return false;          // concat 注入项 → 剔除
        if (seen.has(id)) return true;             // 字面量重复出现 → 保留
        seen.add(id);
        return true;
      });
    }
    // 白蓝紫金分流保持不变（工程侧已按 i%3 / i%4 做过，与 current 一致）
    const wc = [], bc = [], pc = [], gc = [];
    for (const id in CC) {
      const r = CC[id].rarity;
      if (r === 'common') wc.push(id);
      else if (r === 'rare') bc.push(id);
      else if (r === 'epic') pc.push(id);
      else if (r === 'legendary') gc.push(id);
    }
    pools.supplyBox.items = pools.supplyBox.items.concat(wc.filter((_, i) => i % 3 === 0));
    pools.equipBox.items = pools.equipBox.items.concat(bc.filter((_, i) => i % 3 === 0));
    pools.equipBox.items = pools.equipBox.items.concat(pc.filter((_, i) => i % 4 === 0));
    pools.safe.items = pools.safe.items.concat(pc.filter((_, i) => i % 3 === 0));
    pools.safe.items = pools.safe.items.concat(gc.filter((_, i) => i % 4 === 0));
    pools.premiumBox.items = pools.premiumBox.items.concat(gc.filter((_, i) => i % 3 === 0));
  }

  // ---- 价值函数 ----
  const rawValue = (id) => (items[id] ? items[id].value : 0);
  const lootValue = (id) => Math.round(rawValue(id) * lootScale);
  const priceOf = (id) => {
    if (!prices[id]) return 0;
    return Math.round((prices[id].buy * priceScale) / 100) * 100;
  };
  // 重量（复刻 getItemWeight）
  const weight = (id) => {
    const d = items[id]; if (!d) return 0.1;
    const w = d.w || 1, h = d.h || 1;
    let b = w * h * 0.3;
    if (d.type === 'weapon') b += 0.8;
    if (d.type === 'ammo') b = w * h * 0.1;
    if (d.type === 'armor' || d.type === 'helmet') b += 0.5;
    if (d.type === 'backpack') b += 0.5;  // DF-12：应为 type 而非 subType
    return Math.round(b * 10) / 10;
  };
  const cellsOf = (id) => {
    const d = items[id]; if (!d) return 1;
    return (d.w || 1) * (d.h || 1);
  };

  return {
    items, pools, opts, lootScale, priceScale, useJackpot, useRedRoll,
    redIds, redByTier, rawValue, lootValue, priceOf, weight, cellsOf,
  };
}

// ============================================================
// 六、单箱掷骰
// ============================================================

function rollBox(model, type, rnd) {
  const c = model.pools[type];
  if (!c) return [];
  const n = c.min + Math.floor(rnd() * (c.max - c.min + 1));
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(c.items[Math.floor(rnd() * c.items.length)]);
  }
  if (model.useRedRoll) {
    const rr = RED_ROLL[type];
    if (rr && rnd() < rr.p) {
      const r = rnd();
      const [w0, w1] = rr.w;
      const t = r < w0 ? 0 : (r < w0 + w1 ? 1 : 2);
      const pool = model.redByTier[t];
      out.push(pool[Math.floor(rnd() * pool.length)]);
    }
  }
  if (model.useJackpot && JACKPOT[type] && rnd() < JACKPOT[type]) {
    out.push(JACKPOT_ID);
  }
  return out;
}

// ============================================================
// 七、装箱（价值密度贪心，受重量 + 格数双约束）
// ============================================================

function packValue(model, ids, maxKg, maxCells) {
  const cand = ids
    .filter((id) => model.items[id])
    .map((id) => ({
      v: model.lootValue(id),
      w: model.weight(id),
      c: model.cellsOf(id),
    }))
    .map((o) => ({ ...o, d: o.v / Math.max(o.w, 0.01) }))
    .sort((a, b) => b.d - a.d);

  let kg = 0, cells = 0, val = 0, cnt = 0;
  for (const o of cand) {
    if (kg + o.w <= maxKg && cells + o.c <= maxCells) {
      kg += o.w; cells += o.c; val += o.v; cnt++;
    }
  }
  return { val, kg, cells, cnt };
}

// ============================================================
// 八、模拟
// ============================================================

function meanBoxEV(model, type, runs, rnd) {
  let total = 0;
  for (let r = 0; r < runs; r++) {
    for (const id of rollBox(model, type, rnd)) total += model.lootValue(id);
  }
  return total / runs;
}

function simRaid(model, opts, bagCells, rnd) {
  const mixArr = [];
  for (const [t, n] of Object.entries(MILITARY_MIX)) {
    for (let i = 0; i < n; i++) mixArr.push(t);
  }
  let total = 0;
  for (let r = 0; r < opts.runs; r++) {
    const ids = [];
    for (let b = 0; b < opts.boxes; b++) {
      ids.push(...rollBox(model, mixArr[Math.floor(rnd() * mixArr.length)], rnd));
    }
    total += packValue(model, ids, 70, bagCells).val;
  }
  return total / opts.runs;
}

// ============================================================
// 九、输出
// ============================================================

const fmt = (n) => '₵' + Math.round(n).toLocaleString('en-US');
const pct = (n) => (n * 100).toFixed(1) + '%';

function printTable(title, headers, rows, aligns) {
  console.log('\n' + title);
  const all = [headers, ...rows];
  const widths = headers.map((_, i) =>
    Math.max(...all.map((r) => String(r[i]).length))
  );
  const pad = (s, i) => {
    s = String(s);
    return aligns && aligns[i] === 'l' ? s.padEnd(widths[i]) : s.padStart(widths[i]);
  };
  console.log(headers.map((h, i) => pad(h, i)).join('  '));
  console.log(widths.map((w) => '─'.repeat(w)).join('  '));
  for (const r of rows) console.log(r.map((c, i) => pad(c, i)).join('  '));
}

function main() {
  const opts = parseArgs(process.argv);
  const data = loadData();
  const model = buildModel(data, opts);
  const rnd = mulberry32(opts.seed);
  const bag = BAGS.find((b) => b.name === opts.bagName) || BAGS.find((b) => b.name === '中背包');

  const report = {
    meta: {
      state: opts.state,
      lootScale: opts.lootScale,
      priceScale: opts.priceScale,
      survival: opts.survival,
      boxes: opts.boxes,
      bag: bag.name,
      runs: opts.runs,
      seed: opts.seed,
      redConcatDetected: data.hasRedConcat,
    },
    boxEV: {},
    kitCost: {},
    raidGross: null,
    net: {},
    raidsToNext: {},
    checks: [],
  };

  // ---- 表 1：容器期望价值 ----
  for (const type of Object.keys(model.pools)) {
    report.boxEV[type] = meanBoxEV(model, type, Math.min(opts.runs, 20000), rnd);
  }

  // ---- 表 2：三档配装成本 ----
  for (const k of KITS) {
    report.kitCost[k.tier] = k.items.reduce((a, id) => a + model.priceOf(id), 0);
  }

  // ---- 表 3：单局产出与所需局数 ----
  report.raidGross = simRaid(model, opts, bag.cells, rnd);

  // 各档位在其对应背包下的带出（用于净收益）
  const bagByTier = { T1: 12, T2: 20, T3: 56 };
  const grossByTier = {};
  for (const k of KITS) {
    grossByTier[k.tier] = simRaid(model, opts, bagByTier[k.tier], rnd);
  }

  for (let i = 0; i < 3; i++) {
    const k = KITS[i];
    const sv = opts.survival[i];
    const gross = grossByTier[k.tier];
    const net = sv * gross - (1 - sv) * report.kitCost[k.tier];
    report.net[k.tier] = net;
    const nextTier = KITS[i + 1];
    report.raidsToNext[k.tier] = nextTier
      ? (net > 0 ? report.kitCost[nextTier.tier] / net : Infinity)
      : null;
  }

  // ---- 验收断言 ----
  const tol = TARGETS.boxEVTolerance;
  for (const [type, target] of Object.entries(TARGETS.boxEV)) {
    if (report.boxEV[type] === undefined) continue;
    const actual = report.boxEV[type];
    const ok = Math.abs(actual - target) / target <= tol;
    report.checks.push({
      id: 'boxEV:' + type, ok, actual: Math.round(actual), target,
      rule: '±' + pct(tol),
    });
  }
  for (const k of KITS) {
    const target = TARGETS.kitCost[k.tier];
    const actual = report.kitCost[k.tier];
    const ok = Math.abs(actual - target) / target <= 0.05;
    report.checks.push({
      id: 'kitCost:' + k.tier, ok, actual, target, rule: '±5%',
    });
  }
  {
    const r = report.raidsToNext.T2; // T2 → T3 的所需局数
    const ok = Number.isFinite(r) && r >= TARGETS.raidsToT3.min && r <= TARGETS.raidsToT3.max;
    report.checks.push({
      id: 'raidsToT3', ok,
      actual: Number.isFinite(r) ? Number(r.toFixed(1)) : Infinity,
      target: TARGETS.raidsToT3.min + '–' + TARGETS.raidsToT3.max + ' 局',
      rule: '区间',
    });
  }

  // ---- 输出 ----
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const modeLabel = opts.state === 'fixed'
      ? '修复后模型（FIX-05 + FIX-06 + FIX-07）'
      : '当前代码实测（未修复）';
    console.log('');
    console.log('═'.repeat(62));
    console.log('  战术突击 · 经济平衡模拟');
    console.log('  ' + modeLabel);
    console.log('═'.repeat(62));
    if (opts.state === 'current' && data.hasRedConcat) {
      console.log('  ⚠ 检测到红藏品全量 concat（FIX-06 未修复）');
      console.log('  ⚠ 检测到 FIX-05/06/07 未应用，以下为「现状」基线');
    }

    printTable('【表 1】容器期望价值（每箱）',
      ['容器', '池大小', '期望价值', '目标值', '偏差'],
      Object.keys(model.pools).map((t) => {
        const ev = report.boxEV[t];
        const target = TARGETS.boxEV[t];
        const dev = target ? ((ev - target) / target) : null;
        return [
          t,
          model.pools[t].items.length,
          fmt(ev),
          target ? fmt(target) : '—',
          dev === null ? '—' : (dev >= 0 ? '+' : '') + pct(dev),
        ];
      }),
      ['l', 'r', 'r', 'r', 'r']);

    printTable('【表 2】三档配装成本',
      ['档位', '构成', '成本', '目标值', '偏差'],
      KITS.map((k) => {
        const c = report.kitCost[k.tier];
        const target = TARGETS.kitCost[k.tier];
        const dev = (c - target) / target;
        return [
          k.tier, k.label,
          fmt(c), fmt(target),
          (dev >= 0 ? '+' : '') + pct(dev),
        ];
      }),
      ['l', 'l', 'r', 'r', 'r']);

    const raidRows = KITS.map((k, i) => {
      const gross = i === 0 ? simRaid(model, { ...opts, runs: Math.min(opts.runs, 1500) }, bagByTier[k.tier], rnd) : grossByTier[k.tier];
      const net = report.net[k.tier];
      const next = KITS[i + 1];
      const raids = report.raidsToNext[k.tier];
      return [
        k.tier,
        pct(opts.survival[i]),
        fmt(gross),
        fmt(report.kitCost[k.tier]),
        fmt(net),
        !next ? '—' : (Number.isFinite(raids) ? raids.toFixed(1) + ' 局' : '净收益为负'),
      ];
    });

    printTable('【表 3】净收益与升级所需局数',
      ['档位', '存活率', '成功带出', '配装成本', '净收益/局', '升到下一档'],
      raidRows,
      ['l', 'r', 'r', 'r', 'r', 'r']);

    console.log('\n  单局带出（' + bag.name + ' ' + bag.cells + ' 格，' + opts.boxes + ' 箱，负重 70kg）：'
      + fmt(report.raidGross));
    console.log('  净收益公式： net = survival × gross − (1 − survival) × kitCost');
    console.log('  随机种子 seed=' + opts.seed + '（同种子结果可复现）');

    // ---- 验收结果 ----
    const fails = report.checks.filter((c) => !c.ok);
    console.log('\n验收断言（' + (report.checks.length - fails.length) + '/' + report.checks.length + ' 通过）');
    for (const c of report.checks) {
      console.log('  ' + (c.ok ? '✓' : '✗') + ' ' + c.id.padEnd(18)
        + ' 实际=' + (typeof c.actual === 'number' ? c.actual.toLocaleString('en-US') : c.actual)
        + '  目标=' + (typeof c.target === 'number' ? c.target.toLocaleString('en-US') : c.target)
        + '  ' + (c.ok ? '' : '(' + c.rule + ')'));
    }
    if (opts.state === 'current') {
      console.log('\n  注：--state=current 时以上断言预期大量失败——那正是「未修复」的证据。');
    }
  }

  if (opts.check) {
    const fails = report.checks.filter((c) => !c.ok);
    if (fails.length) {
      if (!opts.json) console.log('\nCHECK FAILED — ' + fails.length + ' 项不达标');
      process.exit(1);
    }
    if (!opts.json) console.log('\nALL CHECK PASS');
    process.exit(0);
  }
}

main();
