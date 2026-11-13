/**
 * tests/harness/tools/art-baseline.mjs
 * 美术基准图采集（修复前 / 修复后 可复现对比）
 *
 * 解决的问题：
 * 美术侧的改动（道具 envMapIntensity 1.0 → 0.12、地面贴图种类、天空/雾配色）
 * 只有在「同一机位、同一档位、IBL 开启」下拍的两张图才有对比价值。
 * 修复一旦落地，"修复前"就永远拍不到了——所以本脚本必须能在任一时点冻结一份基线。
 *
 * 纪律（与 harness/README 一致）：
 * - 强制 ?perf=off 起手：只有这个档位 IBL 是开的，否则 envMapIntensity 差异被 scene.environment=null 完全掩盖
 * - 关掉动态分辨率：否则两次运行的 DPR 可能不同，截图不可比
 * - 关掉 HUD，保留 3D 视角模型（视角模型也是美术资产）
 * - 敌人移到远处（parkEnemiesAway）：避免随机站位造成的差异被误读成美术变化
 *
 * 用法：
 *   node tests/harness/tools/art-baseline.mjs --tag=before
 *   node tests/harness/tools/art-baseline.mjs --tag=after
 *   node tests/harness/tools/art-baseline.mjs --tag=before --headful --only=military_base
 *
 * 产出：tests/evidence/art/<tag>-<YYYYMMDD-HHmmss>/
 *   （必须在 art/ 角色子目录下 —— 直接写 tests/evidence/ 根会被 QA 的证据解析器
 *     当成一次冒烟运行读进去，且它会报「缺 smoke.json」而不是报「这是美术目录」。）
 *   <map>_近景.png     俯角 35°，看地面纹理与近处道具反射
 *   <map>_远景.png     俯角 3°，看大气/雾/天空/地图身份
 *   measure.json       每个机位的实测数值（相机世界坐标、雾、IBL、材质 envMapIntensity 分布、draw call）
 *   README.txt         复现命令与已知不可比项
 */

import fs from 'node:fs';
import path from 'node:path';
import { startServer, PROJECT_ROOT } from '../server.mjs';
import { openGame, resolveChromePath } from '../browser.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const flag = (k) => args.includes(`--${k}`);
const headful = flag('headful');
const tag = arg('tag', 'before');
const only = arg('only', '');
const settleFrames = parseInt(arg('frames', '24'), 10);

const MAPS = ['military_base', 'forest_outpost', 'industrial_port'];
const MAP_LABEL = {
  military_base: '军事禁区',
  forest_outpost: '密林禁区',
  industrial_port: '港口城市',
};

// 机位定义：同一机位在 before/after 两次运行里必须完全一致
// pitch 用弧度；近景 -35° = -0.6109，远景 -3° = -0.0524
const POSES = [
  { key: '近景', pitch: -0.6109, note: '俯角35° 看地面纹理 + 近处道具反射' },
  { key: '远景', pitch: -0.0524, note: '俯角3° 看大气/雾/天空/地图身份' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

async function main() {
  const targets = only ? only.split(',').map((s) => s.trim()) : MAPS;
  const evidenceDir = path.join(PROJECT_ROOT, 'tests', 'evidence', 'art', `${tag}-${stamp()}`);
  fs.mkdirSync(evidenceDir, { recursive: true });

  const server = await startServer(PROJECT_ROOT);
  console.log(`[env] 静态服务 ${server.url}`);
  console.log(`[env] chromium ${resolveChromePath()}`);
  console.log(`[env] tag=${tag}  headless=${!headful}  evidence=${path.relative(PROJECT_ROOT, evidenceDir)}`);
  console.log('');

  const game = await openGame({ url: `${server.url}/index.html?perf=off&perfdebug=1`, headful });
  const { page } = game;
  const measures = [];

  try {
    // 启动门槛：模块真正 init 完成
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

    // 档位固定：关动态分辨率，否则两次运行 DPR 不同、截图不可比
    await page.evaluate(() => {
      try {
        if (typeof RenderPipeline !== 'undefined' && RenderPipeline.setDynamicResolution) {
          RenderPipeline.setDynamicResolution(false);
        }
      } catch (e) { /* 不影响采集 */ }
      // 过登录 + 进大厅：boot 后停在 loginScreen，不进去就只会拍到登录框
      try {
        if (typeof enterLobby === 'function') enterLobby('art-baseline');
      } catch (e) { /* 已有存档走别的分支也没关系 */ }
      // 隐藏所有 DOM 遮挡层（保留 3D 视角模型——它也是美术资产）
      const hide = [
        'loginScreen', 'lobbyScreen', 'clickToPlay', 'gameHUD', 'crosshair',
        'hitMarker', 'damageArcs', 'compassBar', 'pauseBtn',
        'extractPrompt', 'searchPrompt', 'keyBuildingPrompt', 'loadingScreen',
      ];
      hide.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    });

    for (const mapId of targets) {
      console.log(`[map] ${mapId} (${MAP_LABEL[mapId] || ''})`);

      await page.evaluate((id) => {
        // startGame 会把 gameHUD / clickToPlay 重新显示，这里再压一次
        selectMap(id);
        startGame();
        ['clickToPlay', 'gameHUD', 'pauseBtn', 'extractPrompt', 'searchPrompt', 'keyBuildingPrompt'].forEach((k) => {
          const el = document.getElementById(k);
          if (el) el.style.display = 'none';
        });
      }, mapId);

      // 等进入 playing
      await page.waitForFunction(() => typeof S !== 'undefined' && S.phase === 'playing', { timeout: 30000 });
      // 敌人挪走：避免随机站位污染美术对比
      await page.evaluate(() => {
        try {
          if (typeof enemies !== 'undefined' && enemies.length) {
            for (const e of enemies) {
              if (e.mesh) e.mesh.position.set(240, 0, 240);
              e.state = 'dead';
            }
          }
        } catch (e) { /* 无视 */ }
      });
      await sleep(400);

      for (const pose of POSES) {
        // 固定机位：位置取出生点，朝向取出生朝向，俯角按机位表
        const applied = await page.evaluate((pitch) => {
          playerGroup.position.set(playerGroup.position.x, 0, playerGroup.position.z);
          mouseY = pitch;
          // 等视角生效
          playerGroup.rotation.y = mouseX;
          camera.rotation.x = mouseY;
          return {
            spawn: { x: +playerGroup.position.x.toFixed(3), z: +playerGroup.position.z.toFixed(3) },
            yaw: +mouseX.toFixed(4),
            pitch: +mouseY.toFixed(4),
          };
        }, pose.pitch);

        // 等若干帧渲染稳定
        await page.evaluate(
          (n) =>
            new Promise((res) => {
              let i = 0;
              const step = () => (++i >= n ? res() : requestAnimationFrame(step));
              requestAnimationFrame(step);
            }),
          settleFrames,
        );

        const measure = await page.evaluate(() => {
          const out = {
            fog: null,
            ibl: null,
            cameraY: null,
            dpr: null,
            drawCallsLastPass_UNRELIABLE: null,
            programs: null,
            materials: null,
            envHigh: [],
            envBySurface: {},
            ground: null,
          };
          try {
            if (scene.fog) {
              out.fog = {
                near: +scene.fog.near.toFixed(1),
                far: +scene.fog.far.toFixed(1),
                color: '#' + scene.fog.color.getHexString(),
              };
            }
            out.ibl = scene.environment ? 'on' : 'off';
            out.cameraY = +camera.getWorldPosition(new THREE.Vector3()).y.toFixed(3);
            out.dpr = +renderer.getPixelRatio().toFixed(3);
            // 注意：开启后期后 renderer.info.render.calls 只统计最后一个 pass，
            // 这个字段不可用于判定 draw call。精确值由质量侧 SMK-11 在 postFX=off 档位把关。
            out.drawCallsLastPass_UNRELIABLE = renderer.info.render.calls;
            out.programs = renderer.info.programs ? renderer.info.programs.length : null;
            out.materials = renderer.info.memory.materials;

            // envMapIntensity 分布：扣掉水面/玻璃/金属白名单，看有多少材质超出 [0.1, 0.4]
            scene.traverse(function (o) {
              if (!o.isMesh || !o.material) return;
              const list = Array.isArray(o.material) ? o.material : [o.material];
              for (const m of list) {
                if (!m || !m.isMeshStandardMaterial) continue;
                if (m.transparent && m.opacity < 0.95) continue; // 水面/玻璃近似排除
                const v = m.envMapIntensity;
                if (v == null) continue;
                if (v > 0.4) {
                  const s = (o.userData && o.userData.surface) || o.userData.propType || 'untagged';
                  out.envBySurface[s] = out.envBySurface[s] || { count: 0, value: v };
                  out.envBySurface[s].count++;
                  if (out.envHigh.length < 12) {
                    out.envHigh.push({ surface: s, value: v, color: '#' + m.color.getHexString() });
                  }
                }
              }
            });

            // 地面：记录贴图种类、实际 tile（从 UV 反解）、材质色、envMapIntensity
            let g = null;
            scene.traverse(function (o) {
              if (!g && o.isMesh && o.userData && o.userData.surface === 'ground') g = o;
            });
            if (g) {
              let tile = null;
              try {
                const geo = g.geometry;
                const uv = geo.attributes.uv;
                let lo = Infinity, hi = -Infinity;
                for (let i = 0; i < uv.count; i++) {
                  const u = uv.getX(i);
                  if (u < lo) lo = u;
                  if (u > hi) hi = u;
                }
                tile = +(geo.parameters.width / (hi - lo)).toFixed(3);
              } catch (e) { /* 反解失败就留 null */ }
              out.ground = {
                kind: (g.geometry.userData && g.geometry.userData._pbrGeoKind) || null,
                tileFromUV: tile,
                mapSize: (g.geometry.parameters && g.geometry.parameters.width) || null,
                color: g.material && g.material.color ? '#' + g.material.color.getHexString() : null,
                envMapIntensity: g.material ? g.material.envMapIntensity : null,
              };
            }
          } catch (e) {
            out.error = String(e && e.message ? e.message : e);
          }
          return out;
        });

        const name = `${mapId}_${pose.key}`;
        const file = path.join(evidenceDir, `${name}.png`);
        try {
          await page.screenshot({ path: file });
          console.log(`  ✓ ${name}  (${pose.note})`);
        } catch (e) {
          console.log(`  ✗ ${name} 截图失败: ${e.message}`);
        }

        measures.push({
          map: mapId,
          mapLabel: MAP_LABEL[mapId] || '',
          pose: pose.key,
          poseNote: pose.note,
          poseApplied: applied,
          shot: path.basename(file),
          measure,
        });
      }
    }
  } finally {
    fs.writeFileSync(
      path.join(evidenceDir, 'measure.json'),
      JSON.stringify({ tag, at: new Date().toISOString(), headless: !headful, poses: POSES, shots: measures }, null, 2),
    );
    fs.writeFileSync(
      path.join(evidenceDir, 'README.txt'),
      [
        `美术基准图基线 tag=${tag}`,
        '',
        '复现命令（同一命令在修复前后各跑一次，即可得到可比的两组图）：',
        `  node tests/harness/tools/art-baseline.mjs --tag=${tag}`,
        '',
        '固定条件（两次运行必须一致，改任何一项都会让对比失效）：',
        '  - URL           index.html?perf=off&perfdebug=1   ← perf=off 是唯一 IBL 开启且不降级的档位',
        '  - 动态分辨率    RenderPipeline.setDynamicResolution(false)',
        '  - HUD           gameHUD / crosshair / hitMarker / damageArcs / compassBar 全部 display:none',
        '  - 敌人          enemies 全部移到 (240,240) 并置 dead',
        '  - 机位          近景 pitch=-0.6109 (-35°)；远景 pitch=-0.0524 (-3°)；位置=出生点',
        '  - 视口          1440x810',
        '',
        '已知不可比项（别拿这两处判成败）：',
        '  1. 云层会漂移 —— sky shader 的 uTime 随帧推进，两次运行的云形不同。',
        '     判断大气/雾/地平线可以，别做像素级 diff。',
        '  2. 地面散落战利品是随机生成的，前景可能多出一个物品。',
        '  3. 视角模型（武器）的摆臂相位随帧数走，枪身姿态会有 1-2px 差异。',
        '',
        '该看什么：',
        '  - 近景：地面纹素颗粒是否清晰、近处道具（沙袋/路障/集装箱）是否与地面亮度同档、',
        '          有没有「道具比地面亮一截」的贴纸感（= envMapIntensity 1.0 未修的特征）',
        '  - 远景：天空/地平线色温、雾的远近、屋顶颜色、地表质感，三张地图应当一眼可辨',
      ].join('\n'),
    );
    if (game) await game.close();
    await server.close();
  }

  console.log('');
  console.log(`完成：${measures.length} 张 → ${path.relative(PROJECT_ROOT, evidenceDir)}`);
}

main().catch((e) => {
  console.error('[art-baseline] 失败：', e && e.stack ? e.stack : e);
  process.exit(1);
});
