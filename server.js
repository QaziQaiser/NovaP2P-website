import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiApp } from './server/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Mount Swap Campaign API endpoints under /api
app.use('/api', apiApp);

// Static frontend build
app.use(express.static(path.join(__dirname, 'dist')));

// Client-side routing fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NovaP2P Production Server running on port ${PORT}`));
