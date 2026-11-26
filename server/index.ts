// Load .env before any module reads process.env (SWAP_ADMIN_KEY, SMTP_*, DATA_DIR, ...)
import 'dotenv/config';
import express from 'express';
import { apiRouter } from './api.ts';
import { affiliateRouter } from './affiliateApi.ts';
import { chatRouter } from './chatApi.ts';
import { startChatEmailSync } from './chatEmailSync.ts';
import { tawkRouter } from './tawkApi.ts';
import { rateLimit } from './auth.ts';

export const apiApp = express();
// Hostinger serves the app behind a reverse proxy; trust it so req.ip is the real client IP
apiApp.set('trust proxy', 1);
// Keep the raw body: tawk.to webhooks are signed over the exact bytes sent
apiApp.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { (req as any).rawBody = buf; } }));

// Throttle write endpoints (reads such as dashboards and campaign info are not limited)
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
const sensitiveLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
// tawk.to webhooks are signed and retried by tawk.to, so they skip the per-IP write limit
apiApp.use((req, res, next) =>
  (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') && req.path !== '/tawk/webhook' ? writeLimiter(req, res, next) : next()
);
apiApp.use(['/swap/admin/login', '/affiliate/apply', '/affiliate/review-action', '/affiliate/payout/request', '/swap/rewards/request'], (req, res, next) =>
  req.method === 'POST' ? sensitiveLimiter(req, res, next) : next()
);

apiApp.use('/swap', apiRouter);
apiApp.use('/affiliate', affiliateRouter);
// tawk.to chat history: webhook receiver + read-only admin endpoints
apiApp.use('/tawk', tawkRouter);
// Live chat now runs on tawk.to. The old in-house chat API and its email sync are kept but
// disabled unless LEGACY_LIVE_CHAT=true is set.
if (process.env.LEGACY_LIVE_CHAT === 'true') {
  apiApp.use('/chat', chatRouter);
  // Phase 2: email replies to live chat notifications are synced from the support mailbox
  startChatEmailSync();
}

// server.js reads the admin-set commission rates for the SEO FAQ text
export { getAffiliateRates } from './affiliateApi.ts';

export default apiApp;
