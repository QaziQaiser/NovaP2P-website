import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Import API router
let apiApp;
try {
  if (fs.existsSync(path.join(__dirname, 'server/dist-server.js'))) {
    const mod = await import('./server/dist-server.js');
    apiApp = mod.apiApp || mod.default;
  } else {
    const mod = await import('./server/index.ts');
    apiApp = mod.apiApp || mod.default;
  }
} catch (err) {
  console.error('Error loading API router:', err);
}

if (apiApp) {
  app.use('/api', apiApp);
}

// Static frontend build
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NovaP2P Production Server running on port ${PORT}`));
