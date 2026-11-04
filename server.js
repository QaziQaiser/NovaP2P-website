import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Process crash guards to prevent container restart / 503
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught exception in server process:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled promise rejection:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// 1. Health check endpoints for Hostinger container & proxy probes
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/ping', (req, res) => res.status(200).send('pong'));

// 2. Import API router safely
let apiApp;
try {
  const distServerPath = path.join(__dirname, 'server/dist-server.js');
  if (fs.existsSync(distServerPath)) {
    console.log('[Nova Server] Loading pre-compiled API from server/dist-server.js...');
    const mod = await import('./server/dist-server.js');
    apiApp = mod.apiApp || mod.default;
  } else {
    console.log('[Nova Server] Loading TypeScript API from server/index.ts...');
    const mod = await import('./server/index.ts');
    apiApp = mod.apiApp || mod.default;
  }
} catch (err) {
  console.error('[Nova Server] Warning: Failed to load API router:', err);
}

if (apiApp) {
  app.use('/api', apiApp);
  console.log('[Nova Server] /api routes mounted successfully.');
} else {
  console.warn('[Nova Server] Running without /api backend router.');
}

// 3. Static frontend build
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  console.log('[Nova Server] Serving static files from dist directory.');
} else {
  console.warn('[Nova Server] Warning: dist directory not found at startup.');
}

// 4. Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
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
