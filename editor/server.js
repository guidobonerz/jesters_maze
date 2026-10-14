// server.js - the web editor of Jester's Maze: hands out public/ and keeps the mazes as JSON files
// in a folder (no dependencies: npm start).
//
//   GET    /api/info          {"version": ...}
//   GET    /api/mazes         [{"name", "width", "depth", "levels", "modified"}]
//   GET    /api/mazes/{name}  the maze
//   PUT    /api/mazes/{name}  saves the maze (name: letters, digits, - and _)
//   DELETE /api/mazes/{name}  deletes it
//
// node server.js [--port 3065] [mazes folder]   (PORT, HOST and MAZES work as well)

import { createServer } from 'node:http';
import { readFile, writeFile, readdir, mkdir, rename, rm, stat } from 'node:fs/promises';
import { join, resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = Number(portArg >= 0 ? args.splice(portArg, 2)[1] : process.env.PORT || 3065);
// HOST: this computer only, unless told otherwise
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC = join(here, 'public');
const MAZES = resolve(args[0] || process.env.MAZES || join(here, '..', 'mazes'));
// the version in the header: what git says of the checkout (v1.2.3, v1.2.3-5-gabc1234), else dev
const VERSION = (() => {
  try {
    return execFileSync('git', ['describe', '--tags', '--always'], { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).trim() || 'dev';
  } catch { return 'dev'; }
})();

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff',
};
const VALID_NAME = /^[A-Za-z0-9_-]{1,64}$/;

function send(res, status, body, type) {
  if (body !== undefined && typeof body !== 'string' && !Buffer.isBuffer(body)) { body = JSON.stringify(body); type = MIME['.json']; }
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(body);
}

function readBody(req, limit = 8 << 20) {
  return new Promise((ok, fail) => {
    const parts = [];
    let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { fail(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else parts.push(c); });
    req.on('end', () => ok(Buffer.concat(parts).toString('utf8')));
    req.on('error', fail);
  });
}

function mazeFile(name) {
  if (!VALID_NAME.test(name)) throw Object.assign(new Error('the name may hold letters, digits, - and _ only'), { status: 400 });
  return join(MAZES, `${name}.json`);
}

async function api(req, res, url) {
  const { pathname } = url;
  if (pathname === '/api/info' && req.method === 'GET') return send(res, 200, { version: VERSION });
  if (pathname === '/api/mazes' && req.method === 'GET') {
    const list = [];
    for (const f of await readdir(MAZES)) {
      const name = f.endsWith('.json') ? f.slice(0, -5) : null;
      if (!name || !VALID_NAME.test(name)) continue;
      const file = join(MAZES, f), e = { name, modified: (await stat(file)).mtime };
      try { const m = JSON.parse(await readFile(file, 'utf8')); Object.assign(e, { width: m.width, depth: m.depth, levels: m.levels }); } catch { /* listed without its size */ }
      list.push(e);
    }
    list.sort((a, b) => b.modified - a.modified);
    return send(res, 200, list);
  }
  const m = /^\/api\/mazes\/([^/]+)$/.exec(pathname);
  if (m) {
    const file = mazeFile(decodeURIComponent(m[1]));
    if (req.method === 'GET') {
      try { return send(res, 200, await readFile(file), MIME['.json']); } catch { return send(res, 404, 'no such maze'); }
    }
    if (req.method === 'PUT') {
      const text = await readBody(req);
      let maze;
      try { maze = JSON.parse(text); } catch { /* checked below */ }
      if (!Array.isArray(maze?.cells) || !maze.cells.length) return send(res, 400, 'not a maze');
      // written beside and renamed: a failed write does not destroy the file
      await writeFile(file + '.tmp', text);
      await rename(file + '.tmp', file);
      console.log(`saved ${file}`);
      return send(res, 204);
    }
    if (req.method === 'DELETE') {
      await rm(file, { force: true });
      console.log(`deleted ${file}`);
      return send(res, 204);
    }
  }
  send(res, 404, 'no such route');
}

async function serveStatic(res, pathname) {
  let rest = decodeURIComponent(pathname);
  if (rest.endsWith('/')) rest += 'index.html';
  const file = resolve(PUBLIC, '.' + rest);
  if (!file.startsWith(PUBLIC + sep)) return send(res, 403, 'forbidden');
  try { send(res, 200, await readFile(file), MIME[extname(file)] || 'application/octet-stream'); } catch { send(res, 404, 'not found'); }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else await serveStatic(res, url.pathname);
  } catch (e) {
    send(res, e.status || 500, e.message);
  }
});

await mkdir(MAZES, { recursive: true });
server.listen(PORT, HOST, () => {
  console.log(`Jester's Maze editor: http://localhost:${PORT}`);
  console.log(`mazes: ${MAZES}`);
});
