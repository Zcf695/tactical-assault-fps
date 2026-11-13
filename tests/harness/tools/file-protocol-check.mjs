/**
 * tests/harness/tools/file-protocol-check.mjs
 * P0 验证：`file://` 双击直开路径是否成立。
 *
 * 质疑点（来自主理人 + 代码审查）：
 *   1. game.js:1907 loadEnemyModels() 用 GLTFLoader.load()，底层是 XHR，
 *      Chrome/Edge 在 file:// 下默认拦截对本地文件的 XHR（CORS）。
 *   2. loader.load() 只传了 onLoad，**没有 onError** → 失败静默。
 *   3. 若三个 GLB 都失败，敌人退化成 ph_placeholder 占位体，且 __initErrors 大概率仍为 0。
 *
 * 用法：node tests/harness/tools/file-protocol-check.mjs [--headless]
 * 输出：证据写到 tests/evidence/<ts>-fileproto/
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const headless = !process.argv.includes('--headful');

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function resolveChrome() {
  if (process.env.QA_CHROME && fs.existsSync(process.env.QA_CHROME)) return process.env.QA_CHROME;
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (fs.existsSync(base)) {
    for (const dir of fs.readdirSync(base)) {
      const c = path.join(base, dir, 'chrome-win64', 'chrome.exe');
      if (dir.startsWith('chromium-') && fs.existsSync(c)) return c;
    }
  }
  return null;
}

const evidenceDir = path.join(ROOT, 'tests', 'evidence', `${stamp()}-fileproto`);
fs.mkdirSync(evidenceDir, { recursive: true });

const exe = resolveChrome();
if (!exe) {
  console.error('找不到 Chromium：设置 QA_CHROME');
  process.exit(2);
}

const fileUrl = pathToFileURL(path.join(ROOT, 'index.html')).href;
console.log(`[file://] ${fileUrl}`);
console.log(`[file://] chromium ${exe}\n`);

// 关键：故意**不加** --allow-file-access-from-files，模拟用户双击
const browser = await chromium.launch({
  executablePath: exe,
  headless,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox', '--mute-audio'],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const consoleLog = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') consoleLog.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => consoleLog.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => {
  const f = r.failure();
  consoleLog.push(`[requestfailed] ${r.url().split('/').pop()} :: ${f ? f.errorText : '?'}`);
});
page.on('dialog', (d) => d.dismiss().catch(() => {}));

const result = {
  url: fileUrl,
  headless,
  booted: false,
  enemyModelKeys: null,
  enemyModelKeyNames: null,
  enemiesTotal: 0,
  placeholderCount: null,
  glbRequestFailed: [],
  consoleErrors: [],
  initErrors: null,
  initErrorSample: [],
  verdict: 'UNKNOWN',
  notes: [],
};

try {
  await page.goto(fileUrl, { waitUntil: 'load', timeout: 90000 });

  // 能否 boot
  try {
    await page.waitForFunction(
      () => typeof RenderPipeline !== 'undefined' && typeof startGame === 'function' && typeof S !== 'undefined',
      { timeout: 60000 },
    );
    result.booted = true;
  } catch (e) {
    result.notes.push('boot 等待超时（页面可能已崩或模块未就位）');
  }

  if (result.booted) {
    await page.waitForTimeout(3500); // 等 GLTF 加载尝试完成
    await page.evaluate(() => {
      try {
        enterLobby('qa_fileproto');
        startGame();
      } catch (e) {
        window.__fileprotoErr = String(e && e.message);
      }
    });
    await page.waitForTimeout(5000); // 等敌人 spawn + 模型挂载窗口

    const probe = await page.evaluate(() => {
      const keys = typeof enemyModels === 'object' && enemyModels ? Object.keys(enemyModels) : [];
      let placeholder = 0;
      let total = 0;
      if (typeof enemies !== 'undefined' && Array.isArray(enemies)) {
        for (const e of enemies) {
          if (!e || !e.mesh) continue;
          total++;
          if (e.mesh.userData && e.mesh.userData.placeholder) placeholder++;
        }
      }
      return {
        enemyModelKeys: keys.length,
        enemyModelKeyNames: keys,
        enemiesTotal: total,
        placeholderCount: placeholder,
        initErrors: window.__initErrors && window.__initErrors.length,
        initErrorSample: window.__initErrors
          ? window.__initErrors.slice(0, 5).map((e) => `${e.where || '?'}: ${String(e.message || e).slice(0, 120)}`)
          : null,
        phase: typeof S !== 'undefined' ? S.phase : null,
        fps: (window._fpsData && window._fpsData.currentFps) || null,
      };
    });

    Object.assign(result, probe);
    await page.screenshot({ path: path.join(evidenceDir, 'fileproto_scene.png') });

    // 近景敌人截图：逐个把玩家摆到敌人正前方 5m 并对准它（forward = (-sin(mouseX),0,-cos(mouseX))）
    const shots = [];
    for (let i = 0; i < Math.min(3, result.enemiesTotal); i++) {
      const info = await page.evaluate((idx) => {
        try {
          const e = enemies[idx];
          if (!e || !e.mesh) return null;
          const m = e.mesh.position;
          const px = m.x + 5, pz = m.z;
          playerGroup.position.set(px, 0, pz);
          const dx = m.x - px, dz = m.z - pz;
          mouseX = Math.atan2(-dx, -dz);
          mouseY = 0.05;
          playerGroup.rotation.y = mouseX;
          camera.rotation.x = mouseY;
          return {
            idx,
            placeholder: !!(e.mesh.userData && e.mesh.userData.placeholder),
            pos: [+m.x.toFixed(1), +m.y.toFixed(1), +m.z.toFixed(1)],
            childCount: e.mesh.children ? e.mesh.children.length : -1,
            names: (e.mesh.children || []).map((c) => c.name).slice(0, 6),
          };
        } catch (err) {
          return { idx, error: String(err && err.message) };
        }
      }, i);
      await page.waitForTimeout(700);
      const file = path.join(evidenceDir, `fileproto_enemy_${i}.png`);
      await page.screenshot({ path: file });
      shots.push({ ...info, file: path.basename(file) });
    }
    result.enemyShots = shots;
    result.enemyStructure = shots[0] || null;
  }

  result.consoleErrors = consoleLog;
  result.glbRequestFailed = consoleLog
    .filter((l) => /glb|models\//i.test(l))
    .map((l) => l.slice(0, 200));

  // 判定
  const glbOk = result.enemyModelKeys === 3;
  const allPlaceholder = result.enemyModelKeys === 0 && result.placeholderCount === result.enemiesTotal;
  if (!result.booted) {
    result.verdict = 'BROKEN_PAGE'; // 页面都没起来
  } else if (glbOk) {
    result.verdict = 'WORKS'; // 双击可玩、模型正常
  } else if (allPlaceholder) {
    result.verdict = 'DEGRADED_SILENT'; // 能玩，但全是占位体、且无报错
  } else {
    result.verdict = 'DEGRADED_PARTIAL'; // 部分加载 / 部分占位
  }

  fs.writeFileSync(path.join(evidenceDir, 'console.log'), consoleLog.join('\n') || '(no error/warning)\n', 'utf8');
  fs.writeFileSync(path.join(evidenceDir, 'fileproto.json'), JSON.stringify(result, null, 2), 'utf8');

  console.log('── 五项实测 ─────────────────────────────────────');
  console.log(`1. enemyModels 键数        : ${result.enemyModelKeys}  ${JSON.stringify(result.enemyModelKeyNames)}`);
  console.log(`2. 敌人占位体              : ${result.placeholderCount}/${result.enemiesTotal}`);
  console.log(`3. GLB/CORS 相关 console   : ${result.glbRequestFailed.length} 条`);
  for (const l of result.glbRequestFailed.slice(0, 4)) console.log(`     ${l}`);
  console.log(`4. window.__initErrors    : ${result.initErrors} 条`);
  for (const l of result.initErrorSample || []) console.log(`     ${l}`);
  console.log(`5. 截图                    : ${path.relative(ROOT, evidenceDir)}/ (scene + enemy_0..2)`);
  console.log(`   敌人结构                : ${JSON.stringify(result.enemyStructure)}`);
  console.log(`\n判定: ${result.verdict}`);
  console.log(`证据: ${path.relative(ROOT, evidenceDir)}`);
} catch (e) {
  result.notes.push(String(e && e.message));
  fs.writeFileSync(path.join(evidenceDir, 'fileproto.json'), JSON.stringify(result, null, 2), 'utf8');
  console.error('实测异常:', e && e.message);
} finally {
  await browser.close().catch(() => {});
}
