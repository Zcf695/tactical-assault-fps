/**
 * tests/harness/tools/container-batch-check.mjs
 * 容器合批的验收：数字降了不等于东西还在。
 *
 * 合批的典型静默事故：
 *   1. 原网格 visible=false 但合并网格没生成 → draw call 掉了，箱子也消失；
 *   2. 合并时矩阵没有正确叠加 → 箱子整体位移/悬空，但数量看着都对；
 *   3. 光圈 InstancedMesh 被视锥剔除 → 只在看向地图中心时才出现。
 *
 * 所以本脚本不靠「看着像」判断，而是比对**包围盒不变式**：
 *   merge 前后，容器全部子网格的世界包围盒 与 合并网格的世界包围盒，必须逐轴重合。
 * 视觉图只作为人工复核用的附加证据。
 *
 * 用法：node tests/harness/tools/container-batch-check.mjs [mapName]
 * 产出：tests/evidence/qa/<ts>-ctnbatch/
 */
import fs from 'node:fs';
import path from 'node:path';
import { startServer, PROJECT_ROOT } from '../server.mjs';
import { openGame } from '../browser.mjs';

const MAP = process.argv[2] || 'military_base';

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const evidenceDir = path.join(PROJECT_ROOT, 'tests', 'evidence', 'qa', `${stamp()}-ctnbatch`);
fs.mkdirSync(evidenceDir, { recursive: true });

const server = await startServer();
const session = await openGame({ url: server.url, headless: true });
const page = session.page;

const result = { map: MAP, verdict: 'UNKNOWN' };

try {
  await page.evaluate((map) => {
    if (typeof selectMap === 'function') selectMap(map);
    enterLobby('qa_ctnbatch');
    startGame();
  }, MAP);
  await page.waitForTimeout(4500);

  const probe = await page.evaluate(() => {
    const tmp = new THREE.Box3();
    const out = {
      containerCount: 0,
      originalMeshCount: 0,
      mergedMeshCount: 0,
      glowInstances: 0,
      drawCalls: null,
      bboxOrig: null,
      bboxMerged: null,
      maxAxisDeviation: null,
    };
    if (typeof containers === 'undefined' || !containers) return out;
    out.containerCount = containers.length;

    // 原始子网格（合批后 visible=false，但仍留在场景里，包围盒照样能算）
    const unionOrig = new THREE.Box3();
    unionOrig.makeEmpty();
    for (const c of containers) {
      if (!c.mesh) continue;
      c.mesh.updateWorldMatrix(true, true);
      c.mesh.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh) return;
        out.originalMeshCount++;
        if (!o.geometry) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        unionOrig.union(tmp);
      });
    }

    const unionMerged = new THREE.Box3();
    unionMerged.makeEmpty();
    if (typeof containerGroup !== 'undefined' && containerGroup) {
      containerGroup.updateWorldMatrix(true, true);
      containerGroup.traverse((o) => {
        if (o.userData && o.userData.isContainerGlow) { out.glowInstances++; return; }
        if (!o.isMesh || o.isInstancedMesh) return;
        if (!(o.userData && o.userData.isBatchedStatic)) return;
        out.mergedMeshCount++;
        if (!o.geometry) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        unionMerged.union(tmp);
      });
    }

    const fmt = (b) => (b.isEmpty() ? null : {
      min: [+b.min.x.toFixed(3), +b.min.y.toFixed(3), +b.min.z.toFixed(3)],
      max: [+b.max.x.toFixed(3), +b.max.y.toFixed(3), +b.max.z.toFixed(3)],
    });
    out.bboxOrig = fmt(unionOrig);
    out.bboxMerged = fmt(unionMerged);
    if (out.bboxOrig && out.bboxMerged) {
      const d = [
        Math.abs(unionOrig.min.x - unionMerged.min.x), Math.abs(unionOrig.min.y - unionMerged.min.y), Math.abs(unionOrig.min.z - unionMerged.min.z),
        Math.abs(unionOrig.max.x - unionMerged.max.x), Math.abs(unionOrig.max.y - unionMerged.max.y), Math.abs(unionOrig.max.z - unionMerged.max.z),
      ];
      out.maxAxisDeviation = +Math.max(...d).toFixed(4);
    }

    if (typeof renderer !== 'undefined' && renderer && renderer.info) out.drawCalls = renderer.info.render.calls;
    return out;
  });

  result.probe = probe;

  // 光圈实例的落点必须逐个对上容器坐标。
  // 这是「光圈没丢」的最强证据 —— 比看图可靠，因为看图只能看到画面里恰好出现的几个。
  const glowCheck = await page.evaluate(() => {
    const insts = [];
    if (typeof containerGroup !== 'undefined' && containerGroup) {
      containerGroup.traverse((o) => {
        if (o.isInstancedMesh && o.userData && o.userData.isContainerGlow) insts.push(o);
      });
    }
    const taken = [];
    const m = new THREE.Matrix4();
    const v = new THREE.Vector3();
    for (const inst of insts) {
      for (let i = 0; i < inst.count; i++) {
        inst.getMatrixAt(i, m);
        v.setFromMatrixPosition(m);
        taken.push({ x: +v.x.toFixed(2), z: +v.z.toFixed(2) });
      }
    }
    // 与容器坐标做匹配：每个容器必须能找到一个位置相符的光圈
    let matched = 0;
    const pool = taken.slice();
    for (const c of (typeof containers !== 'undefined' ? containers : [])) {
      const i = pool.findIndex((t) => Math.abs(t.x - c.x) < 0.01 && Math.abs(t.z - c.z) < 0.01);
      if (i >= 0) { pool.splice(i, 1); matched++; }
    }
    return { instancedMeshes: insts.length, instances: taken.length, matchedToContainers: matched };
  });
  result.glowCheck = glowCheck;

  // 一张能看懂的画面：站到离出生点最近的容器前 6m，俯角控制在第一人称允许范围内
  await page.evaluate(() => {
    let best = null, bd = Infinity;
    for (const c of (typeof containers !== 'undefined' ? containers : [])) {
      const d = (c.x - 0) ** 2 + (c.z - 12) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return;
    const px = best.x, pz = best.z + 6;
    playerGroup.position.set(px, 0, pz);
    const dx = best.x - px, dz = best.z - pz;
    mouseX = Math.atan2(-dx, -dz);
    mouseY = -0.22;
    playerGroup.rotation.y = mouseX;
    camera.rotation.x = mouseY;
  });
  await page.waitForTimeout(1200);
  const shot = path.join(evidenceDir, 'nearest_container.png');
  await page.screenshot({ path: shot });
  result.nearestContainerShot = path.basename(shot);

  // 判定：包围盒必须重合（< 0.02m），且合并批次/光圈都非空
  const dev = probe.maxAxisDeviation;
  const gc = result.glowCheck;
  const glowOk = gc && gc.instances === probe.containerCount && gc.matchedToContainers === probe.containerCount;
  const ok = dev != null && dev < 0.02 && probe.mergedMeshCount > 0 && probe.containerCount > 0 && glowOk;
  result.verdict = ok ? 'OK' : 'REGRESSION';

  fs.writeFileSync(path.join(evidenceDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
  console.log(`\n判定: ${result.verdict}`);
  console.log(`证据: ${path.relative(PROJECT_ROOT, evidenceDir)}`);
} catch (e) {
  console.error('执行失败:', e && e.message);
  process.exitCode = 2;
} finally {
  await session.close();
  await server.close();
}
