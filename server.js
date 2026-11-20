import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';
import https from 'https';
import apiApp from './server/dist-server.js';
import { renderSeoHead, SITE_ORIGIN } from './server/seo-pages.js';

// Process crash guards to prevent container restart
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught exception in server process:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled promise rejection:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Behind Hostinger's reverse proxy: use the real client IP for logging and rate limiting
app.set('trust proxy', 1);

// SEO: one canonical host. www.novap2p.com/* -> https://novap2p.com/* (same path).
// http -> https is already done by Hostinger in front of this app.
app.use((req, res, next) => {
  if (req.hostname === 'www.novap2p.com') {
    return res.redirect(301, SITE_ORIGIN + req.originalUrl);
  }
  next();
});

// 0. Blog reverse proxy: novap2p.com/blog/* -> WordPress on the blog subdomain.
//    Only requests under /blog are touched; every other route continues below
//    unchanged. Mounted before express.json() so request bodies (logins,
//    uploads, admin saves) stream to WordPress untouched.
const BLOG_UPSTREAM = new URL(process.env.BLOG_UPSTREAM || 'https://blog.novap2p.com');
const BLOG_PUBLIC_ORIGIN = (process.env.BLOG_PUBLIC_ORIGIN || 'https://novap2p.com').replace(/\/+$/, '');
const BLOG_PROXY_SECRET = process.env.BLOG_PROXY_SECRET || '1';
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host',
]);
const upstreamOriginRe = new RegExp(
  '^https?://' + BLOG_UPSTREAM.host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  'i'
);

function proxyBlog(req, res) {
  // Guard: if the upstream ever points back at this app, fail fast instead of looping
  if (req.headers['x-nova-blog-proxy']) {
    res.status(508).send('Blog proxy loop detected');
    return;
  }

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers[key] = value;
  }
  headers.host = BLOG_UPSTREAM.host;
  headers['x-forwarded-host'] = new URL(BLOG_PUBLIC_ORIGIN).host;
  headers['x-forwarded-proto'] = 'https';
  headers['x-forwarded-for'] = req.headers['x-forwarded-for'] || req.ip || '';
  headers['x-real-ip'] = req.ip || '';
  headers['x-nova-blog-proxy'] = BLOG_PROXY_SECRET;

  const client = BLOG_UPSTREAM.protocol === 'https:' ? https : http;
  const upstreamReq = client.request(
    {
      protocol: BLOG_UPSTREAM.protocol,
      hostname: BLOG_UPSTREAM.hostname,
      port: BLOG_UPSTREAM.port || undefined,
      servername: BLOG_UPSTREAM.hostname,
      method: req.method,
      path: req.originalUrl,
      headers,
      timeout: 120000,
    },
    (upRes) => {
      const outHeaders = {};
      for (const [key, value] of Object.entries(upRes.headers)) {
        const k = key.toLowerCase();
        if (HOP_BY_HOP.has(k)) continue;
        if (k === 'location' && typeof value === 'string') {
          outHeaders[key] = value.replace(upstreamOriginRe, BLOG_PUBLIC_ORIGIN);
        } else if (k === 'set-cookie') {
          // Drop any Domain= so cookies bind to novap2p.com (path stays /blog/...)
          const cookies = Array.isArray(value) ? value : [value];
          outHeaders[key] = cookies.map((c) => c.replace(/;\s*domain=[^;]*/gi, ''));
        } else {
          outHeaders[key] = value;
        }
      }
      res.writeHead(upRes.statusCode || 502, outHeaders);
      upRes.pipe(res);
    }
  );

  upstreamReq.on('timeout', () => upstreamReq.destroy(new Error('Upstream timeout')));
  upstreamReq.on('error', (err) => {
    console.error('[Nova Server] Blog proxy error:', err.message);
    if (!res.headersSent) {
      res.status(502).send('The blog is temporarily unavailable. Please try again shortly.');
    } else {
      res.destroy();
    }
  });
  req.on('aborted', () => upstreamReq.destroy());

  req.pipe(upstreamReq);
}

app.use((req, res, next) => {
  if (req.path === '/blog') {
    const qs = req.originalUrl.slice(req.originalUrl.indexOf('/blog') + 5);
    return res.redirect(301, '/blog/' + qs);
  }
  if (req.path.startsWith('/blog/')) return proxyBlog(req, res);
  next();
});

app.use(express.json());

// 1. Health check endpoints for Hostinger container & proxy probes
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/ping', (req, res) => res.status(200).send('pong'));

// 2. Mount API router
if (apiApp) {
  app.use('/api', apiApp);
  console.log('[Nova Server] /api routes mounted successfully.');
} else {
  console.warn('[Nova Server] Running without /api backend router.');
}

// SEO: /faq was an exact duplicate of /help-center.
app.get(['/faq', '/faq/'], (req, res) => {
  const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  res.redirect(301, '/help-center' + qs);
});

// 3. Static frontend build
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  // index: false so "/" also goes through the page handler below and gets its SEO tags
  app.use(express.static(distDir, { index: false }));
  console.log('[Nova Server] Serving static files from dist directory.');
} else {
  console.warn('[Nova Server] Warning: dist directory not found at startup.');
}

// 4. Fallback to index.html for client-side routing.
//    Each page gets its own title / description / canonical / robots / OG / JSON-LD
//    in the HTML itself, so search engines see separate pages without running JS.
const SEO_BLOCK_RE = /<!-- SEO:START[\s\S]*?<!-- SEO:END -->/;
let indexHtmlCache = null;
function readIndexHtml(indexPath) {
  const mtime = fs.statSync(indexPath).mtimeMs;
  if (!indexHtmlCache || indexHtmlCache.mtime !== mtime) {
    indexHtmlCache = { mtime, html: fs.readFileSync(indexPath, 'utf8') };
  }
  return indexHtmlCache.html;
}

app.get('*', (req, res) => {
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    try {
      const html = readIndexHtml(indexPath);
      if (SEO_BLOCK_RE.test(html)) {
        const head = renderSeoHead(req.path, distDir);
        res.set('Cache-Control', 'no-cache');
        return res.type('html').send(html.replace(SEO_BLOCK_RE, () => head.trimStart()));
      }
    } catch (err) {
      console.error('[Nova Server] SEO head injection failed, serving plain index.html:', err);
    }
    res.sendFile(indexPath);
  } else {
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NovaP2P - Launching</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0a0b14; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { text-align: center; max-width: 480px; padding: 40px; border-radius: 24px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
          h1 { color: #8b5cf6; margin-bottom: 8px; }
          p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>NovaP2P Initializing</h1>
          <p>The application is compiling its static bundle. Please refresh this page in a moment.</p>
        </div>
      </body>
      </html>
    `);
  }
});

// 5. Port configuration (Standard Hostinger dynamic port binding)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[Nova Server] Production server is LIVE and listening on port ${PORT}`);
  console.log(`[Nova Server] Node version: ${process.version}`);
  console.log(`[Nova Server] Environment: ${process.env.NODE_ENV || 'production'}`);
});

export default app;
