// Load .env before any module reads process.env (SWAP_ADMIN_KEY, SMTP_*, DATA_DIR, ...)
import 'dotenv/config';
import express from 'express';
import { apiRouter } from './api.ts';
import { affiliateRouter } from './affiliateApi.ts';
import { chatRouter } from './chatApi.ts';
import { startChatEmailSync } from './chatEmailSync.ts';
import { rateLimit } from './auth.ts';

export const apiApp = express();
// Hostinger serves the app behind a reverse proxy; trust it so req.ip is the real client IP
apiApp.set('trust proxy', 1);
apiApp.use(express.json({ limit: '1mb' }));

// Throttle write endpoints (reads such as dashboards and campaign info are not limited)
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
const sensitiveLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
apiApp.use((req, res, next) => (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE' ? writeLimiter(req, res, next) : next()));
apiApp.use(['/swap/admin/login', '/affiliate/apply', '/affiliate/review-action', '/affiliate/payout/request', '/swap/rewards/request'], (req, res, next) =>
  req.method === 'POST' ? sensitiveLimiter(req, res, next) : next()
);

apiApp.use('/swap', apiRouter);
apiApp.use('/affiliate', affiliateRouter);
// Live chat now runs on tawk.to. The old in-house chat API and its email sync are kept but
// disabled unless LEGACY_LIVE_CHAT=true is set.
if (process.env.LEGACY_LIVE_CHAT === 'true') {
  apiApp.use('/chat', chatRouter);
  // Phase 2: email replies to live chat notifications are synced from the support mailbox
  startChatEmailSync();
}

export default apiApp;
