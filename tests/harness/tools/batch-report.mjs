/**
 * tests/harness/tools/batch-report.mjs
 * 合批现状诊断：统计 mapEnvironmentGroup 的网格数、材质数、可合批分组数。
 *
 * 用途：回答「统一建筑 palette 后 draw call 能降到多少」——给出的是分组基数，
 * 而不是拍一个数字。判定逻辑与 world_polish.batchStatic 保持一致（材质签名 + 阴影标志）。
 *
 * 用法：node tests/harness/tools/batch-report.mjs [mapName]
 */
import { startServer, PROJECT_ROOT } from '../server.mjs';
import { openGame } from '../browser.mjs';

const MAP = process.argv[2] || 'military_base';

function probeBatches() {
  if (typeof mapEnvironmentGroup === 'undefined' || !mapEnvironmentGroup) return { error: 'no mapEnvironmentGroup' };

  // 与 world_polish._materialKey 同构的粗签名：颜色/贴图/透明/双面/粗糙/金属
  const sig = (m) => {
    if (!m) return 'none';
    const hex = m.color ? m.color.getHexString() : '-';
    return [
      'c' + hex,
      'map:' + (m.map ? m.map.uuid.slice(0, 6) : '0'),
      'n:' + (m.normalMap ? '1' : '0'),
      't:' + (m.transparent ? ('1/' + (m.opacity == null ? 1 : m.opacity).toFixed(2)) : '0'),
      's:' + (m.side || 0),
      'r:' + (m.roughness == null ? '-' : m.roughness.toFixed(2)),
      'm:' + (m.metalness == null ? '-' : m.metalness.toFixed(2)),
    ].join('|');
  };

  const buckets = new Map();
  let meshes = 0, instanced = 0, transparent = 0, noBatch = 0;
  const matIds = new Set();
  const surfaceCount = {};

  mapEnvironmentGroup.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isInstancedMesh) { instanced++; return; }
    if (!o.visible) return;
    if (o.userData && o.userData.noBatch) { noBatch++; return; }
    const mat = o.material;
    if (!mat) return;
    if (Array.isArray(mat)) return;
    matIds.add(mat.uuid);
    if (mat.transparent || mat.depthWrite === false) { transparent++; return; }
    meshes++;
    const s = (o.userData && o.userData.surface) || '(none)';
    surfaceCount[s] = (surfaceCount[s] || 0) + 1;
    const key = sig(mat) + '|sh' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });

  const sizes = [...buckets.values()].sort((a, b) => b - a);
  const mergeable = sizes.filter((n) => n >= 2);
  return {
    meshes, instanced, transparent, noBatch,
    uniqueMaterials: matIds.size,
    batchGroups: buckets.size,
    groupsWith2plus: mergeable.length,
    groupsWith2plusMeshes: mergeable.reduce((a, b) => a + b, 0),
    singletonGroups: sizes.filter((n) => n === 1).length,
    top10: sizes.slice(0, 10),
    surfaceCount: Object.fromEntries(Object.entries(surfaceCount).sort((a, b) => b[1] - a[1]).slice(0, 12)),
    drawCallsNow: typeof renderer !== 'undefined' && renderer.info ? renderer.info.render.calls : null,
  };
}

const server = await startServer(PROJECT_ROOT);
const game = await openGame({ url: `${server.url}/index.html?perfdebug=1` });
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
  await page.evaluate((m) => {
    if (typeof enterLobby === 'function') enterLobby('qa_batch');
    selectMap(m);
    startGame();
  }, MAP);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.phase === 'playing', { timeout: 30000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(probeBatches);
  console.log('=== ' + MAP + ' 合批诊断 ===');
  console.log(JSON.stringify(r, null, 2));
} finally {
  await game.close();
  await server.close();
}
