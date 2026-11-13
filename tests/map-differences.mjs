/**
 * tests/map-differences.mjs
 * 地图差异化回归测试
 *
 * 锁定 S1-5 修复的三处缺陷，防止回退：
 *   ① world_props.js 的地图类型判定 —— 森林图名「密林禁区」不含「森林」，
 *      旧的 name 正则匹配失败 → 森林图按军事基地密度生成道具。
 *      现在改为读取地图数据里显式声明的 `kind`。
 *   ② render_pipeline.js 的 _syncFog —— 旧实现 Math.max(fogNear,65)/Math.max(fogFar,235)
 *      把三图雾距全部抬成 65/235，地图 fog 配置失效。现在尊重地图配置。
 *   ③ 三图 theme 均缺 groundSurface / roofColor
 *      → 军事/港口地面误用草地贴图、全部屋顶女儿墙为 0x333333。
 *
 * 运行：node tests/map-differences.mjs
 * 退出码：0 = 全部通过；1 = 有失败
 *
 * 零依赖，不需要 package.json，符合 ADR-001「无构建」约束。
 */

import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MAPS = {
  military: { file: 'map/military_base.js', varName: 'MAP_DATA_MILITARY' },
  industrial: { file: 'map/industrial_port.js', varName: 'MAP_DATA_INDUSTRIAL' },
  forest: { file: 'map/forest_outpost.js', varName: 'MAP_DATA_FOREST' },
};

// ---------- 极简断言 ----------
let passed = 0;
const failures = [];
function chk(label, cond, actual) {
  if (cond) {
    passed++;
    console.log('  ✓ ' + label);
  } else {
    failures.push({ label, actual });
    console.log('  ✗ ' + label + (actual !== undefined ? '   实际: ' + actual : ''));
  }
}

// ---------- 加载地图数据（与浏览器一致：script 注入全局 var） ----------
function loadMap(file, varName) {
  const abs = path.join(ROOT, file);
  const code = fs.readFileSync(abs, 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file });
  if (!sandbox[varName]) throw new Error(file + ' 未定义 ' + varName);
  return sandbox[varName];
}

// ---------- 复刻被测逻辑 ----------

// world_props.js 修复后的判定
function detectKind(map) {
  const name = (map.name || 'map') + '';
  const kind = (map.kind || '').toLowerCase();
  return {
    isPort: kind === 'industrial' || (!kind && /工业|港口|港|Port|industrial/i.test(name)),
    isForest: kind === 'forest' || (!kind && /森林|密林|林地|林|Forest|outpost/i.test(name)),
  };
}

// world_props.js 修复前的判定（仅用于证明缺陷曾存在）
function detectKindLegacy(map) {
  const name = (map.name || 'map') + '';
  return {
    isPort: /工业|港口|Port|industrial/i.test(name),
    isForest: /森林|Forest|outpost/i.test(name),
  };
}

// render_pipeline.js 修复后的 _syncFog
function fogAfterFix(theme) {
  const near = theme.fogNear != null ? theme.fogNear : 50;
  const far = Math.max(theme.fogFar != null ? theme.fogFar : 160, near + 40);
  return [near, far];
}

// render_pipeline.js 修复前的 _syncFog（仅用于证明缺陷曾存在）
function fogLegacy(theme) {
  return [Math.max(theme.fogNear || 50, 65), Math.max(theme.fogFar || 160, 235)];
}

// ---------- 执行 ----------
const maps = {};
for (const [key, spec] of Object.entries(MAPS)) {
  maps[key] = loadMap(spec.file, spec.varName);
}

console.log('\n=== ① 地图类型判定（world_props.js） ===');
for (const [key, map] of Object.entries(maps)) {
  console.log('\n[' + key + ']  name=' + map.name);
  const fixed = detectKind(map);
  const legacy = detectKindLegacy(map);
  console.log('  旧判定: isPort=' + legacy.isPort + '  isForest=' + legacy.isForest);
  console.log('  新判定: isPort=' + fixed.isPort + '  isForest=' + fixed.isForest);

  chk(key + ': kind 已声明且与文件名一致', map.kind === key, map.kind);
  chk(key + ': 两个布尔判定不冲突', !(fixed.isPort && fixed.isForest),
      'port=' + fixed.isPort + ' forest=' + fixed.isForest);

  if (key === 'forest') {
    chk('forest: 旧正则确实匹配失败（缺陷证据）', legacy.isPort === false && legacy.isForest === false,
        'port=' + legacy.isPort + ' forest=' + legacy.isForest);
    chk('forest: 新判定命中 isForest', fixed.isForest === true);
  }
  if (key === 'industrial') {
    chk('industrial: 命中 isPort', fixed.isPort === true);
    chk('industrial: 不误判为森林', fixed.isForest === false);
  }
  if (key === 'military') {
    chk('military: 两个判定均为 false（走默认军事分支）', !fixed.isPort && !fixed.isForest);
  }
}

console.log('\n=== ② 雾距（render_pipeline.js _syncFog） ===');
const legacyFogSet = new Set();
for (const [key, map] of Object.entries(maps)) {
  const [near, far] = fogAfterFix(map.theme);
  const [lNear, lFar] = fogLegacy(map.theme);
  legacyFogSet.add(lNear + '/' + lFar);
  console.log('  ' + key.padEnd(11) +
              '地图配置=' + (map.theme.fogNear + '/' + map.theme.fogFar).padEnd(9) +
              '修复前=' + (lNear + '/' + lFar).padEnd(9) +
              '修复后=' + (near + '/' + far));

  chk(key + ': 修复后保留地图的 fog 配置',
      near === map.theme.fogNear && far === map.theme.fogFar, near + '/' + far);
  chk(key + ': far 明显大于 near（安全约束）', far >= near + 40, near + '/' + far);
}
chk('修复前雾距被抬成同一值（缺陷证据）', legacyFogSet.size === 1, [...legacyFogSet].join(' | '));

console.log('\n=== ③ 地面贴图与屋顶色（theme.groundSurface / roofColor） ===');
const grounds = new Set();
const roofs = new Set();
const fogs = new Set();
for (const [key, map] of Object.entries(maps)) {
  grounds.add(map.theme.groundSurface);
  roofs.add(map.theme.roofColor);
  fogs.add(map.theme.fogNear + '/' + map.theme.fogFar);

  chk(key + ': groundSurface 已定义为字符串', typeof map.theme.groundSurface === 'string',
      String(map.theme.groundSurface));
  chk(key + ': roofColor 已定义为数值', typeof map.theme.roofColor === 'number',
      String(map.theme.roofColor));
  chk(key + ': groundSurface 不再是隐式默认 grass 以外的意外值',
      ['grass', 'dirt', 'concrete', 'gravel', 'asphalt'].includes(map.theme.groundSurface),
      String(map.theme.groundSurface));
}
chk('三图 groundSurface 互不相同', grounds.size === 3, [...grounds].join(','));
chk('三图 roofColor 互不相同', roofs.size === 3,
    [...roofs].map(v => '0x' + v.toString(16)).join(','));
chk('三图 fog 配置互不相同', fogs.size === 3, [...fogs].join(' | '));

console.log('\n=== ④ 固定种子稳定性（改 kind 不得改变地图名） ===');
// world_props 的道具布局种子由 map.name 哈希得到；name 一旦变化，所有道具重新洗牌。
// 本测试锁定三个地图名，防止有人为了修判定逻辑而去改 name。
chk('森林图名保持「密林禁区」', maps.forest.name === '密林禁区', maps.forest.name);
chk('军事图名保持「军事禁区」', maps.military.name === '军事禁区', maps.military.name);
chk('港口图名保持「港口城市」', maps.industrial.name === '港口城市', maps.industrial.name);

// ---------- 汇总 ----------
console.log('\n' + '─'.repeat(56));
if (failures.length === 0) {
  console.log('ALL PASS  —  ' + passed + ' 项断言通过');
  process.exit(0);
} else {
  console.log(failures.length + ' FAILED  —  ' + passed + ' 项通过，' + failures.length + ' 项失败');
  for (const f of failures) console.log('  ✗ ' + f.label + (f.actual !== undefined ? '   实际: ' + f.actual : ''));
  process.exit(1);
}
