/**
 * tests/harness/browser.mjs
 * Chromium 解析与启动 + 控制台全量捕获（error 与 warning 都要，事故① 只留 warn）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const LAUNCH_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox',
  '--autoplay-policy=no-user-gesture-required',
  '--mute-audio',
  '--disable-dev-shm-usage',
];

/** 找一个可用的 Chromium/Chrome 可执行文件；找不到返回 null。 */
export function resolveChromePath() {
  const explicit = process.env.QA_CHROME;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const bases = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'),
    process.env.HOME && path.join(process.env.HOME, '.cache', 'ms-playwright'),
    process.env.USERPROFILE && path.join(process.env.USERPROFILE, 'AppData', 'Local', 'ms-playwright'),
  ].filter(Boolean);

  const candidates = [];
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    for (const dir of fs.readdirSync(base)) {
      // 优先完整 chrome（headless_shell 不支持全部截图能力）
      if (dir.startsWith('chromium-')) {
        candidates.push(path.join(base, dir, 'chrome-win64', 'chrome.exe'));
        candidates.push(path.join(base, dir, 'chrome-linux', 'chrome'));
        candidates.push(path.join(base, dir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'));
      }
    }
  }
  // 兜底：系统安装的 Chrome / Edge
  candidates.push(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  );

  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

/**
 * 启动浏览器并打开游戏页面，注册控制台/页面错误/请求失败捕获。
 * @returns {Promise<{browser, page, consoleLog, close}>}
 */
export async function openGame({ url, headful = false, viewport = { width: 1440, height: 810 } }) {
  const executablePath = resolveChromePath();
  if (!executablePath) {
    const err = new Error(
      '找不到 Chromium 可执行文件。请设置环境变量 QA_CHROME 指向 chrome.exe，或安装 ms-playwright 浏览器缓存。',
    );
    err.code = 'ENO_BROWSER';
    throw err;
  }

  const browser = await chromium.launch({
    executablePath,
    headless: !headful,
    args: LAUNCH_ARGS,
  });

  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  const consoleLog = [];
  const t0 = Date.now();
  const push = (level, text) => consoleLog.push({ t: Date.now() - t0, level, text });

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') push(type, msg.text());
  });
  page.on('pageerror', (err) => push('pageerror', err && err.message ? err.message : String(err)));
  page.on('requestfailed', (req) => {
    const f = req.failure();
    push('requestfailed', `${req.url()} :: ${f ? f.errorText : 'unknown'}`);
  });
  // 关键：页面里的 alert() 会挂住自动化，统一 dismiss
  page.on('dialog', (d) => {
    push('dialog', `${d.type()}: ${d.message()}`);
    d.dismiss().catch(() => {});
  });

  await page.goto(url, { waitUntil: 'load', timeout: 90000 });

  return {
    browser,
    page,
    consoleLog,
    executablePath,
    close: async () => {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}
