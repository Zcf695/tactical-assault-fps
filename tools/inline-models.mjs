/**
 * tools/inline-models.mjs
 * 把 models/*.glb 转成 models_embedded.js（base64 字符串常量）。
 *
 * 为什么需要这个：
 * 本项目承诺「双击 index.html 就能玩」，但 GLTFLoader 内部走 XMLHttpRequest，
 * 在 file:// 下被 CORS 拦截。拦截是静默的 —— 三个模型全部加载失败，
 * 敌人退化成圆柱，控制台只有三条 CORS 警告，__initErrors 为 0，
 * 玩家看到的是一个「能跑但敌人是柱子」的游戏，而不是一个报错。
 *
 * 为什么不直接用 data: URI：
 * GLTFLoader 对 data URI 的支持依赖它自己的 resolveURL 实现，且 data URI 会把
 * base64 再嵌进一次 URL 解析；实测更容易出解码差异。这里直接给 ArrayBuffer，
 * 走 loader.parse()，与 load() 之后的内部路径完全一致。
 *
 * 用法：
 *   node tools/inline-models.mjs
 *   node tools/inline-models.mjs --check     # 只校验产物是否与源文件同步，不写盘
 *
 * 产物：models_embedded.js（约 7.4MB，只在 file:// 下被动态注入）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'models_embedded.js');

const MODELS = {
  Soldier: 'models/Soldier.glb',
  Xbot: 'models/Xbot.glb',
  RobotExpressive: 'models/RobotExpressive.glb',
};

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');

const parts = [];
let totalBytes = 0;

for (const [name, rel] of Object.entries(MODELS)) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[inline-models] 缺少源文件 ${rel}`);
    process.exit(2);
  }
  const buf = fs.readFileSync(abs);
  // GLB 魔数校验：0x46546C67 = "glTF"。镜像或 git-lfs 占位文件会在这里露馅，
  // 而不是等到运行时 loader 抛一个看不懂的解析错误。
  if (buf.length < 12 || buf.readUInt32LE(0) !== 0x46546c67) {
    console.error(`[inline-models] ${rel} 不是合法 GLB（魔数不符），拒绝内联`);
    process.exit(2);
  }
  totalBytes += buf.length;
  parts.push(`  ${name}: '${buf.toString('base64')}'`);
  console.log(`  ${name.padEnd(16)} ${(buf.length / 1048576).toFixed(2)} MB  → base64 ${(buf.length * 4 / 3 / 1048576).toFixed(2)} MB`);
}

const header = `/**
 * models_embedded.js —— 由 tools/inline-models.mjs 自动生成，请勿手改。
 *
 * 用途：file:// 协议下 browsers 禁止 XMLHttpRequest 读本地文件，
 * GLTFLoader 的 loader.load() 会静默失败、敌人退化成圆柱。
 * 本文件把三个 GLB 以 base64 内嵌，仅在 location.protocol === 'file:' 时
 * 由 game.js 动态注入，http(s) 下不会被请求。
 *
 * 源文件总大小 ${(totalBytes / 1048576).toFixed(2)} MB
 * 重新生成：node tools/inline-models.mjs
 */
window.EMBEDDED_MODELS = {
${parts.join(',\n')}
};
`;

if (checkOnly) {
  if (!fs.existsSync(OUT)) {
    console.error('[inline-models] models_embedded.js 不存在，需要生成');
    process.exit(1);
  }
  const cur = fs.readFileSync(OUT, 'utf8');
  if (cur !== header) {
    console.error('[inline-models] models_embedded.js 与源模型不同步，需要重新生成');
    process.exit(1);
  }
  console.log('[inline-models] 已同步');
  process.exit(0);
}

fs.writeFileSync(OUT, header, 'utf8');
console.log(`[inline-models] 写入 ${path.relative(ROOT, OUT)}  ${(Buffer.byteLength(header) / 1048576).toFixed(2)} MB`);
