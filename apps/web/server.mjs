import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = join(process.cwd(), 'apps/web/public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') {
    urlPath = '/index.html';
  }

  const filePath = join(PUBLIC_DIR, urlPath);

  // Security: Prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Strict offline-first CSP headers
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self';"
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    const content = readFileSync(filePath);
    res.writeHead(200);
    res.end(content);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
======================================================================
  வழித்துணை (Vazhithunai) – Web Guardian & Practice Simulator Running
  URL: http://localhost:${PORT}
  Network: http://127.0.0.1:${PORT}
  100% Offline Mode Enforced via CSP
======================================================================
  `);
});

