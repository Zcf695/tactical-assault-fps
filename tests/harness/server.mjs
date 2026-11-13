/**
 * tests/harness/server.mjs
 * 自包含静态服务：不依赖项目外任何工具，缺失资源会点名（不再静默 404）。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(HERE, '../..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * 启动静态服务。
 * @returns {Promise<{url:string, port:number, close:()=>Promise<void>, missing:string[]}>}
 */
export async function startServer(root = PROJECT_ROOT) {
  const missing = [];

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(String(req.url).split('?')[0]);
    const rel = urlPath === '/' ? '/index.html' : urlPath;
    const abs = path.join(root, rel);

    // 目录穿越保护
    if (!abs.startsWith(root)) {
      res.statusCode = 403;
      return res.end('forbidden');
    }

    fs.readFile(abs, (err, data) => {
      if (err) {
        missing.push(rel);
        res.statusCode = 404;
        return res.end(`not found: ${rel}`);
      }
      res.setHeader('Content-Type', MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.end(data);
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const port = server.address().port;
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    missing,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
