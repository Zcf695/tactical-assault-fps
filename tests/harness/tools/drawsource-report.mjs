/**
 * tests/harness/tools/drawsource-report.mjs
 * 拆解 draw call 来源：场景环境 vs 容器 vs 敌人 vs 掉落物 vs 武器/玩家 vs 阴影 pass。
 *
 * 用途：回答「合批整改能把 draw call 从 1050 降到多少」——
 * 必须先知道这 1050 里各项占比，否则「统一建筑 palette」可能优化了不到 10%。
 *
 * 用法：node tests/harness/tools/drawsource-report.mjs [mapName]
 */
import { startServer, PROJECT_ROOT } from '../server.mjs';
import { openGame } from '../browser.mjs';

const MAP = process.argv[2] || 'military_base';

function probeSources() {
  if (typeof scene === 'undefined' || !scene) return { error: 'no scene' };

  const isDescendantOf = (o, root) => {
    let p = o;
    while (p) { if (p === root) return true; p = p.parent; }
    return false;
  };

  // 建立「根节点 -> 归属分类」映射
  const owners = [];
  const push = (root, label) => { if (root) owners.push([root, label]); };
  push(typeof mapEnvironmentGroup !== 'undefined' ? mapEnvironmentGroup : null, 'env');
  if (typeof containers !== 'undefined' && containers) containers.forEach((c) => push(c.mesh, 'container'));
  if (typeof enemies !== 'undefined' && enemies) enemies.forEach((e) => push(e.mesh, 'enemy'));
  if (typeof bosses !== 'undefined' && bosses) bosses.forEach((b) => push(b.mesh, 'boss'));
  if (typeof groundLootItems !== 'undefined' && groundLootItems) groundLootItems.forEach((g) => push(g.mesh || g, 'loot'));
  if (typeof extractPoints !== 'undefined' && extractPoints) extractPoints.forEach((e) => push(e.mesh, 'extract'));
  push(typeof weaponGroup !== 'undefined' ? weaponGroup : null, 'weapon');
  push(typeof playerGroup !== 'undefined' ? playerGroup : null, 'player');

  const counts = {};
  const meshCounts = {};
  let totalMeshes = 0;
  let outside = 0;

  scene.traverse((o) => {
    if (!o.isMesh && !o.isPoints && !o.isSprite && !o.isLine) return;
    totalMeshes++;
    let label = 'other';
    for (const [root, name] of owners) {
      if (root && isDescendantOf(o, root)) { label = name; break; }
    }
    if (label === 'other') outside++;
    counts[label] = (counts[label] || 0) + 1;
    if (o.isMesh) meshCounts[label] = (meshCounts[label] || 0) + 1;
  });

  const info = (typeof renderer !== 'undefined' && renderer.info) ? renderer.info : null;
  return {
    drawCalls: info ? info.render.calls : null,
    triangles: info ? info.render.triangles : null,
    programs: info ? (info.programs ? info.programs.length : null) : null,
    textures: info ? info.memory.textures : null,
    geometries: info ? info.memory.geometries : null,
    totalRenderables: totalMeshes,
    unaccounted: outside,
    byCategory: Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1])),
    // 关键：看容器与敌人各有多少个 sub-mesh（决定是否值得合并）
    groupSizes: (() => {
      const g = {};
      if (typeof containers !== 'undefined' && containers && containers.length) {
        const n = containers.reduce((acc, c) => {
          let k = 0; if (c.mesh) c.mesh.traverse((o) => { if (o.isMesh) k++; });
          return acc + k;
        }, 0);
        g.containerAvgMesh = +(n / containers.length).toFixed(2);
        g.containerTotalMesh = n;
        g.containerCount = containers.length;
      }
      if (typeof enemies !== 'undefined' && enemies && enemies.length) {
        const n = enemies.reduce((acc, e) => {
          let k = 0; if (e.mesh) e.mesh.traverse((o) => { if (o.isMesh) k++; });
          return acc + k;
        }, 0);
        g.enemyAvgMesh = +(n / enemies.length).toFixed(2);
        g.enemyTotalMesh = n;
        g.enemyCount = enemies.length;
      }
      if (typeof groundLootItems !== 'undefined' && groundLootItems) g.lootCount = groundLootItems.length;
      return g;
    })(),
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
    if (typeof enterLobby === 'function') enterLobby('qa_src');
    selectMap(m);
    startGame();
  }, MAP);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.phase === 'playing', { timeout: 30000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(probeSources);
  console.log('=== ' + MAP + ' draw call 来源拆解 ===');
  console.log(JSON.stringify(r, null, 2));
} finally {
  await game.close();
  await server.close();
}
