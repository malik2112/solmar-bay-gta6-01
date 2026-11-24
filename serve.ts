// SOLMAR BAY — tiny static file server for local play and screenshots.
// Serves this repo's root (game/ at /game/, screenshots at /screenshots/).
//   node serve.ts [port]        (default 8901, or $PORT)

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 8901);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.md': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    // Health endpoint for the screenshot driver and monitors.
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, game: 'solmar-bay', time: new Date().toISOString() }));
      return;
    }
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/game/index.html';
    const file = join(here, path);
    if (!file.startsWith(here) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    // HEAD answers with headers only, same as GET minus the body.
    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
        'content-length': statSync(file).size,
      });
      res.end();
      return;
    }
    console.log(`${new Date().toISOString()} ${req.method} ${url.pathname}`);
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(readFileSync(file));
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(String(err && err.message ? err.message : err));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`SOLMAR BAY serving ${here} at http://127.0.0.1:${port}/game/index.html`);
});
