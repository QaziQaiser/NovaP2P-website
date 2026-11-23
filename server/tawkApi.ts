import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { db } from './db.ts';
import { verifyAdmin, sendServerError } from './auth.ts';

// ---------------------------------------------------------------------------
// TAWK.TO CHAT HISTORY
// tawk.to sends webhooks (chat:start, chat:end, chat:transcript_created, ticket:create)
// to POST /api/tawk/webhook. We keep a read-only copy so the admin panel can show
// chat history. Replying still happens in the tawk.to dashboard / apps.
// Docs: https://developer.tawk.to/webhooks/
// ---------------------------------------------------------------------------

export const tawkRouter = Router();

const WEBHOOK_SECRET = (process.env.TAWK_WEBHOOK_SECRET || '').trim();
if (!WEBHOOK_SECRET) {
  console.warn('[Tawk] TAWK_WEBHOOK_SECRET is not set. Chat history webhooks are rejected until it is configured.');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS tawk_chats (
    id TEXT PRIMARY KEY,
    visitor_name TEXT NOT NULL DEFAULT '',
    visitor_email TEXT NOT NULL DEFAULT '',
    visitor_city TEXT NOT NULL DEFAULT '',
    visitor_country TEXT NOT NULL DEFAULT '',
    domain TEXT NOT NULL DEFAULT '',
    referrer TEXT NOT NULL DEFAULT '',
    first_message TEXT NOT NULL DEFAULT '',
    agent_names TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'ended'
    message_count INTEGER NOT NULL DEFAULT 0,
    has_transcript INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tawk_chats_started ON tawk_chats(started_at);
  CREATE TABLE IF NOT EXISTS tawk_chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    sender TEXT NOT NULL, -- 'visitor' | 'agent' | 'system'
    sender_name TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'msg',
    body TEXT NOT NULL DEFAULT '',
    attachments TEXT NOT NULL DEFAULT '[]',
    sent_at TEXT NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES tawk_chats(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_tawk_messages_chat ON tawk_chat_messages(chat_id, id);
  CREATE TABLE IF NOT EXISTS tawk_tickets (
    id TEXT PRIMARY KEY,
    human_id INTEGER,
    subject TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    requester_name TEXT NOT NULL DEFAULT '',
    requester_email TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tawk_webhook_events (
    event_id TEXT PRIMARY KEY,
    event TEXT NOT NULL,
    received_at TEXT NOT NULL
  );
`);

const str = (v: unknown, max = 5000): string => (typeof v === 'string' ? v.slice(0, max) : v == null ? '' : String(v).slice(0, max));
const isoOrNow = (v: unknown): string => {
  const d = typeof v === 'string' ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
};

let lastWebhookAt: string | null =
  (db.prepare('SELECT MAX(received_at) AS t FROM tawk_webhook_events').get() as { t: string | null } | undefined)?.t || null;
let lastWebhookError: string | null = null;

function verifySignature(req: Request): boolean {
  const raw: Buffer | undefined = (req as any).rawBody;
  const sig = req.get('x-tawk-signature') || '';
  if (!raw || !sig || !WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac('sha1', WEBHOOK_SECRET).update(raw).digest('hex');
  const a = Buffer.from(sig.trim().toLowerCase());
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const upsertChat = db.prepare(`
  INSERT INTO tawk_chats (id, visitor_name, visitor_email, visitor_city, visitor_country, domain, referrer, first_message, status, started_at, updated_at)
  VALUES (@id, @visitor_name, @visitor_email, @visitor_city, @visitor_country, @domain, @referrer, @first_message, @status, @started_at, @updated_at)
  ON CONFLICT(id) DO UPDATE SET
    visitor_name = CASE WHEN excluded.visitor_name <> '' THEN excluded.visitor_name ELSE tawk_chats.visitor_name END,
    visitor_email = CASE WHEN excluded.visitor_email <> '' THEN excluded.visitor_email ELSE tawk_chats.visitor_email END,
    visitor_city = CASE WHEN excluded.visitor_city <> '' THEN excluded.visitor_city ELSE tawk_chats.visitor_city END,
    visitor_country = CASE WHEN excluded.visitor_country <> '' THEN excluded.visitor_country ELSE tawk_chats.visitor_country END,
    domain = CASE WHEN excluded.domain <> '' THEN excluded.domain ELSE tawk_chats.domain END,
    referrer = CASE WHEN excluded.referrer <> '' THEN excluded.referrer ELSE tawk_chats.referrer END,
    first_message = CASE WHEN tawk_chats.first_message = '' THEN excluded.first_message ELSE tawk_chats.first_message END,
    started_at = MIN(tawk_chats.started_at, excluded.started_at),
    updated_at = excluded.updated_at
`);

function chatBase(id: string, visitor: any, payload: any, time: string) {
  return {
    id,
    visitor_name: str(visitor?.name, 200),
    visitor_email: str(visitor?.email, 200),
    visitor_city: str(visitor?.city, 100),
    visitor_country: str(visitor?.country, 10),
    domain: str(payload?.domain, 300),
    referrer: str(payload?.referrer, 1000),
    first_message: '',
    status: 'active',
    started_at: time,
    updated_at: new Date().toISOString(),
  };
}

const handleEvent = db.transaction((payload: any) => {
  const event = str(payload?.event, 50);
  const time = isoOrNow(payload?.time);

  if (event === 'chat:start') {
    const id = str(payload.chatId, 100);
    if (!id) return;
    upsertChat.run({ ...chatBase(id, payload.visitor, payload, time), first_message: str(payload.message?.text, 1000) });
  } else if (event === 'chat:end') {
    const id = str(payload.chatId, 100);
    if (!id) return;
    upsertChat.run(chatBase(id, payload.visitor, payload, time));
    db.prepare("UPDATE tawk_chats SET status = 'ended', ended_at = COALESCE(ended_at, ?) WHERE id = ?").run(time, id);
  } else if (event === 'chat:transcript_created') {
    const chat = payload.chat || {};
    const id = str(chat.id, 100);
    if (!id) return;
    const messages: any[] = Array.isArray(chat.messages) ? chat.messages : [];
    const firstVisitor = messages.find((m) => m?.sender?.t === 'v');
    const firstTime = messages.length ? isoOrNow(messages[0]?.time) : time;
    const lastTime = messages.length ? isoOrNow(messages[messages.length - 1]?.time) : time;
    upsertChat.run({ ...chatBase(id, chat.visitor, payload, firstTime), first_message: str(firstVisitor?.msg, 1000) });

    // The transcript is the complete record: replace whatever we had
    db.prepare('DELETE FROM tawk_chat_messages WHERE chat_id = ?').run(id);
    const insert = db.prepare(
      'INSERT INTO tawk_chat_messages (chat_id, sender, sender_name, type, body, attachments, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const agents = new Set<string>();
    for (const m of messages.slice(0, 2000)) {
      const t = m?.sender?.t;
      const sender = t === 'a' ? 'agent' : t === 'v' ? 'visitor' : 'system';
      const name = str(m?.sender?.n, 200);
      if (sender === 'agent' && name) agents.add(name);
      const attachments = (Array.isArray(m?.attchs) ? m.attchs : [])
        .map((a: any) => a?.content?.file)
        .filter((f: any) => f && typeof f.url === 'string' && /^https?:\/\//i.test(f.url))
        .map((f: any) => ({ url: str(f.url, 2000), name: str(f.name, 300), mimeType: str(f.mimeType, 100), size: Number(f.size) || 0 }));
      insert.run(id, sender, name, str(m?.type, 30) || 'msg', str(m?.msg, 20000), JSON.stringify(attachments), isoOrNow(m?.time));
    }
    db.prepare(
      "UPDATE tawk_chats SET status = 'ended', has_transcript = 1, message_count = ?, agent_names = ?, ended_at = COALESCE(ended_at, ?) WHERE id = ?"
    ).run(messages.length, [...agents].join(', '), lastTime, id);
  } else if (event === 'ticket:create') {
    const t = payload.ticket || {};
    const id = str(t.id, 100);
    if (!id) return;
    db.prepare(
      `INSERT INTO tawk_tickets (id, human_id, subject, message, requester_name, requester_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`
    ).run(id, Number(t.humanId) || null, str(t.subject, 500), str(t.message, 20000), str(payload.requester?.name, 200), str(payload.requester?.email, 200), time);
  }
});

tawkRouter.post('/webhook', (req: Request, res: Response) => {
  if (!WEBHOOK_SECRET) return res.status(503).json({ error: 'Webhook secret not configured' });
  if (!verifySignature(req)) {
    lastWebhookError = `Rejected a webhook with an invalid signature (${new Date().toISOString()}). Check TAWK_WEBHOOK_SECRET.`;
    console.warn('[Tawk] Webhook rejected: invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  try {
    const eventId = str(req.get('x-hook-event-id'), 200);
    const now = new Date().toISOString();
    if (eventId) {
      const seen = db.prepare('INSERT OR IGNORE INTO tawk_webhook_events (event_id, event, received_at) VALUES (?, ?, ?)').run(eventId, str(req.body?.event, 50), now);
      if (seen.changes === 0) return res.json({ ok: true, duplicate: true });
    }
    handleEvent(req.body);
    lastWebhookAt = now;
    lastWebhookError = null;
    res.json({ ok: true });
  } catch (err) {
    sendServerError(res, err, 'tawk webhook');
  }
});

// ---------------------------------------------------------------------------
// Admin (read-only)
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

tawkRouter.get('/admin/chats', verifyAdmin, (req: Request, res: Response) => {
  try {
    const q = str(req.query.q, 200).trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const where: string[] = [];
    const params: any[] = [];
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
      where.push(
        `(visitor_name LIKE ? ESCAPE '\\' OR visitor_email LIKE ? ESCAPE '\\' OR first_message LIKE ? ESCAPE '\\'
          OR id IN (SELECT chat_id FROM tawk_chat_messages WHERE body LIKE ? ESCAPE '\\'))`
      );
      params.push(like, like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (db.prepare(`SELECT COUNT(*) AS n FROM tawk_chats ${whereSql}`).get(...params) as { n: number }).n;
    const chats = db
      .prepare(`SELECT * FROM tawk_chats ${whereSql} ORDER BY started_at DESC LIMIT ? OFFSET ?`)
      .all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE);

    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const count = (sql: string, ...p: any[]) => (db.prepare(sql).get(...p) as { n: number }).n;
    res.json({
      chats,
      total,
      page,
      pageSize: PAGE_SIZE,
      stats: {
        total: count('SELECT COUNT(*) AS n FROM tawk_chats'),
        last24h: count('SELECT COUNT(*) AS n FROM tawk_chats WHERE started_at >= ?', dayAgo),
        last7d: count('SELECT COUNT(*) AS n FROM tawk_chats WHERE started_at >= ?', weekAgo),
        active: count("SELECT COUNT(*) AS n FROM tawk_chats WHERE status = 'active'"),
        tickets: count('SELECT COUNT(*) AS n FROM tawk_tickets'),
      },
      webhook: { configured: !!WEBHOOK_SECRET, lastReceivedAt: lastWebhookAt, lastError: lastWebhookError },
    });
  } catch (err) {
    sendServerError(res, err, 'tawk admin list');
  }
});

tawkRouter.get('/admin/chats/:id', verifyAdmin, (req: Request, res: Response) => {
  try {
    const chat = db.prepare('SELECT * FROM tawk_chats WHERE id = ?').get(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    const messages = (db.prepare('SELECT * FROM tawk_chat_messages WHERE chat_id = ? ORDER BY id ASC').all(req.params.id) as any[]).map((m) => ({
      ...m,
      attachments: (() => {
        try {
          return JSON.parse(m.attachments);
        } catch {
          return [];
        }
      })(),
    }));
    res.json({ chat, messages });
  } catch (err) {
    sendServerError(res, err, 'tawk admin get');
  }
});

tawkRouter.get('/admin/tickets', verifyAdmin, (_req: Request, res: Response) => {
  try {
    res.json({ tickets: db.prepare('SELECT * FROM tawk_tickets ORDER BY created_at DESC LIMIT 200').all() });
  } catch (err) {
    sendServerError(res, err, 'tawk admin tickets');
  }
});
