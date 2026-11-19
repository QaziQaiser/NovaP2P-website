import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { db } from './db.ts';
import { verifyAdmin, rateLimit, safeEqual, sendServerError } from './auth.ts';
import { sendMail, escapeHtml, ADMIN_EMAIL } from './notifications.ts';
import { CHAT_SYSTEM_PROMPT, HANDOFF_MARKER } from './chatKnowledge.ts';

// ---------------------------------------------------------------------------
// LIVE CHAT: visitor <-> AI assistant (Gemini) <-> support team
// ---------------------------------------------------------------------------

export const chatRouter = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    token_hash TEXT NOT NULL,
    visitor_name TEXT NOT NULL,
    visitor_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    ai_enabled INTEGER NOT NULL DEFAULT 1,
    human_requested INTEGER NOT NULL DEFAULT 0,
    admin_unread INTEGER NOT NULL DEFAULT 0,
    ai_day TEXT,
    ai_count INTEGER NOT NULL DEFAULT 0,
    last_admin_alert_at INTEGER NOT NULL DEFAULT 0,
    page_url TEXT,
    ip TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id, id);
  CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated ON chat_conversations(updated_at);
  CREATE TABLE IF NOT EXISTS chat_ai_usage (
    day TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
  );
`);

type Sender = 'visitor' | 'ai' | 'admin' | 'system';

export interface ConversationRow {
  id: string;
  code: string;
  token_hash: string;
  visitor_name: string;
  visitor_email: string;
  status: string;
  ai_enabled: number;
  human_requested: number;
  admin_unread: number;
  ai_day: string | null;
  ai_count: number;
  last_admin_alert_at: number;
  page_url: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: number;
  conversation_id: string;
  sender: Sender;
  body: string;
  created_at: string;
}

const MAX_MESSAGE_LENGTH = 2000;
const AI_PER_CONVERSATION_DAILY = Number(process.env.CHAT_AI_PER_CHAT_DAILY_LIMIT || 40);
const AI_GLOBAL_DAILY = Number(process.env.CHAT_AI_DAILY_LIMIT || 1000);
const ADMIN_ALERT_THROTTLE_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// GEMINI (server-side only: the API key never reaches the browser)
// ---------------------------------------------------------------------------

// Tolerate a key pasted with surrounding quotes in the hosting panel
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']+|["']+$/g, '').trim();
const AI_CONFIGURED = !!GEMINI_API_KEY && GEMINI_API_KEY !== 'MY_GEMINI_API_KEY';
const GEMINI_API_BASE = (process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
// Tried in order; the next model is used when one is unavailable or out of free quota.
const GEMINI_MODELS = Array.from(
  new Set([(process.env.GEMINI_MODEL || '').trim(), 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'].filter(Boolean))
);

if (!AI_CONFIGURED) {
  console.warn('[Chat] GEMINI_API_KEY is not set. Live chat works, but messages go to the support team without AI answers.');
} else {
  console.log(`[Chat] AI assistant enabled (models: ${GEMINI_MODELS.join(', ')}).`);
}

// Last AI outcome, shown in the admin Live Chat tab so problems (bad key, quota, region) are visible without server logs
const aiStatus: { lastSuccessAt: string | null; lastErrorAt: string | null; lastError: string | null } = {
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
};

function recordAiError(message: string) {
  aiStatus.lastError = message.slice(0, 400);
  aiStatus.lastErrorAt = new Date().toISOString();
  console.warn(`[Chat] ${message}`);
}

function explainGeminiError(status: number, body: string): string {
  let msg = body;
  try {
    msg = JSON.parse(body)?.error?.message || body;
  } catch {
    /* not JSON */
  }
  msg = String(msg).replace(/\s+/g, ' ').trim().slice(0, 250);
  if (/api key not valid|API_KEY_INVALID|permission|unauthori[sz]ed/i.test(msg) || status === 401 || status === 403)
    return `Gemini rejected the API key (${status}): ${msg} - check GEMINI_API_KEY on the server.`;
  if (/location is not supported/i.test(msg)) return `Gemini is not available from the server's region (${status}): ${msg}`;
  if (status === 429) return `Gemini free quota / rate limit reached (429): ${msg}`;
  return `Gemini error (${status}): ${msg}`;
}

async function callGemini(history: { role: 'user' | 'model'; text: string }[]): Promise<string | null> {
  if (!AI_CONFIGURED || !history.length) return null;
  for (const model of GEMINI_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(`${GEMINI_API_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: CHAT_SYSTEM_PROMPT }] },
          contents: history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024,
            // Thinking off on 2.5 models for fast chat replies
            ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const message = explainGeminiError(response.status, await response.text().catch(() => ''));
        recordAiError(`[${model}] ${message}`);
        // A bad key or unsupported region fails the same way on every model
        if (/rejected the API key|server's region/.test(message)) return null;
        continue;
      }
      const data: any = await response.json();
      const text = (data?.candidates?.[0]?.content?.parts || [])
        .map((p: any) => (p?.thought ? '' : p?.text || ''))
        .join('')
        .trim();
      if (text) {
        aiStatus.lastSuccessAt = new Date().toISOString();
        return text;
      }
      recordAiError(`[${model}] Gemini returned no text (finishReason: ${data?.candidates?.[0]?.finishReason || 'n/a'}).`);
    } catch (err: any) {
      recordAiError(`[${model}] Could not reach Gemini: ${err?.name === 'AbortError' ? 'timeout after 25s' : err?.message || err}`);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Plain-text cleanup: the chat window shows text, not markdown. */
function cleanAiText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*\*\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4000);
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

function getSiteOrigin(req: Request): string {
  const configured = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\//.test(configured)) return configured;
  const host = req.get('host');
  return host ? `${req.protocol}://${host}` : 'https://novap2p.com';
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  // Strip control characters (keep newlines and tabs)
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

export const getConversationByCode = (code: string) =>
  db.prepare('SELECT * FROM chat_conversations WHERE code = ?').get(code.toUpperCase()) as ConversationRow | undefined;

const getConversation = (id: string) => db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(id) as ConversationRow | undefined;

function getMessages(conversationId: string, afterId = 0): MessageRow[] {
  return db
    .prepare('SELECT id, conversation_id, sender, body, created_at FROM chat_messages WHERE conversation_id = ? AND id > ? ORDER BY id ASC')
    .all(conversationId, afterId) as MessageRow[];
}

export function addMessage(conversationId: string, sender: Sender, body: string): MessageRow {
  const createdAt = nowIso();
  const result = db.prepare('INSERT INTO chat_messages (conversation_id, sender, body, created_at) VALUES (?, ?, ?, ?)').run(conversationId, sender, body, createdAt);
  db.prepare(
    `UPDATE chat_conversations SET updated_at = ?${sender === 'visitor' ? ', admin_unread = admin_unread + 1' : ''} WHERE id = ?`
  ).run(createdAt, conversationId);
  return { id: Number(result.lastInsertRowid), conversation_id: conversationId, sender, body, created_at: createdAt };
}

const publicMessage = (m: MessageRow) => ({ id: m.id, sender: m.sender, body: m.body, createdAt: m.created_at });

function publicState(conv: ConversationRow) {
  const agentJoined = !!db.prepare("SELECT 1 FROM chat_messages WHERE conversation_id = ? AND sender = 'admin' LIMIT 1").get(conv.id);
  return {
    id: conv.id,
    code: conv.code,
    name: conv.visitor_name,
    status: conv.status,
    aiEnabled: !!conv.ai_enabled && AI_CONFIGURED,
    humanRequested: !!conv.human_requested,
    agentJoined,
  };
}

/** Visitor access: the per-conversation secret is kept only in the visitor's browser (hash stored here). */
function authorizeVisitor(req: Request, res: Response): ConversationRow | null {
  const conv = getConversation(String(req.params.id || ''));
  const token = req.get('x-chat-token') || '';
  if (!conv || !token || !safeEqual(hashToken(token), conv.token_hash)) {
    res.status(404).json({ error: 'Conversation not found.' });
    return null;
  }
  return conv;
}

// ---------------------------------------------------------------------------
// EMAILS
// ---------------------------------------------------------------------------

const SENDER_LABEL: Record<Sender, string> = { visitor: 'Visitor', ai: 'Nova Assistant (AI)', admin: 'Support Team', system: 'System' };

function transcriptText(messages: MessageRow[]): string {
  return messages.map((m) => `[${m.created_at.slice(0, 16).replace('T', ' ')} UTC] ${m.sender === 'visitor' ? 'Visitor' : SENDER_LABEL[m.sender]}:\n${m.body}`).join('\n\n');
}

function transcriptHtml(messages: MessageRow[]): string {
  return messages
    .map((m) => {
      const bg = m.sender === 'visitor' ? '#eef3ff' : m.sender === 'admin' ? '#ecfdf5' : '#f8fafc';
      return `<tr><td style="padding:6px 0;"><div style="background:${bg};border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;">
        <div style="font-size:12px;font-weight:700;color:#374151;">${escapeHtml(SENDER_LABEL[m.sender])} <span style="font-weight:400;color:#9ca3af;">&middot; ${escapeHtml(m.created_at.slice(0, 16).replace('T', ' '))} UTC</span></div>
        <div style="font-size:14px;line-height:1.55;color:#111827;white-space:pre-wrap;margin-top:4px;">${escapeHtml(m.body)}</div>
      </div></td></tr>`;
    })
    .join('');
}

function emailShell(title: string, intro: string, bodyRows: string, button?: { href: string; label: string }): string {
  const btn = button
    ? `<tr><td align="center" style="padding:18px 0 4px;"><a href="${escapeHtml(button.href)}" style="display:inline-block;background:#4F7DF3;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 22px;border-radius:10px;">${escapeHtml(button.label)}</a></td></tr>`
    : '';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr><td style="background:#4F7DF3;padding:18px 22px;color:#ffffff;font-size:18px;font-weight:800;">${escapeHtml(title)}</td></tr>
    <tr><td style="padding:20px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:14px;line-height:1.6;color:#374151;padding-bottom:8px;">${intro}</td></tr>
      ${bodyRows}
      ${btn}
    </table></td></tr>
    <tr><td style="padding:14px 22px;background:#f9fafb;color:#9ca3af;font-size:12px;">NovaP2P Live Chat &middot; novap2p.com</td></tr>
  </table></td></tr></table></body></html>`;
}

/** Email reply sync state (updated by chatEmailSync.ts), shown in the admin Live Chat tab. */
export const emailSyncStatus: { enabled: boolean; lastRunAt: string | null; lastOkAt: string | null; lastError: string | null; imported: number } = {
  enabled: false,
  lastRunAt: null,
  lastOkAt: null,
  lastError: null,
  imported: 0,
};

/** Marks emails sent by the chat system itself so the mailbox sync never imports them as replies. */
export const CHAT_EMAIL_HEADER = 'X-Nova-Chat';

/** Public site origin for links in emails sent outside a request (email sync). */
export function defaultSiteOrigin(): string {
  const configured = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(configured) ? configured : 'https://novap2p.com';
}

function adminChatUrl(origin: string, conv: ConversationRow) {
  return `${origin}/swap-admin?tab=livechat&chat=${encodeURIComponent(conv.id)}`;
}

function sendAdminChatEmail(req: Request, conv: ConversationRow, kind: 'new' | 'handoff' | 'message') {
  const origin = getSiteOrigin(req);
  const messages = getMessages(conv.id).slice(-30);
  const heading =
    kind === 'new' ? 'New Live Chat' : kind === 'handoff' ? 'Live Chat: Support Requested' : 'Live Chat: New Visitor Message';
  const subject = `${heading} - ${conv.visitor_name} [NovaChat #${conv.code}]`;
  const info = `<b>Name:</b> ${escapeHtml(conv.visitor_name)}<br><b>Email:</b> ${escapeHtml(conv.visitor_email)}<br><b>Chat ID:</b> #${escapeHtml(conv.code)}${
    conv.page_url ? `<br><b>Page:</b> ${escapeHtml(conv.page_url)}` : ''
  }${kind === 'handoff' ? '<br><br><b style="color:#dc2626;">The visitor needs a support team member.</b>' : ''}<br><br><span style="color:#2563eb;"><b>Reply to this email</b> to answer the visitor (write above the quoted text). Your reply is added to the live chat and emailed to the visitor automatically within about a minute.</span>`;
  const text = [
    `${heading.toUpperCase()} [NovaChat #${conv.code}]`,
    `Name: ${conv.visitor_name}`,
    `Email: ${conv.visitor_email}`,
    conv.page_url ? `Page: ${conv.page_url}` : '',
    kind === 'handoff' ? 'The visitor needs a support team member.' : '',
    '',
    `Reply to this email to answer ${conv.visitor_name} (write above the quoted text). Your reply is added to the live chat and emailed to the visitor automatically within about a minute.`,
    `Or reply in the admin panel: ${adminChatUrl(origin, conv)}`,
    '',
    'Conversation:',
    transcriptText(messages),
  ]
    .filter((l) => l !== null)
    .join('\n');
  db.prepare('UPDATE chat_conversations SET last_admin_alert_at = ? WHERE id = ?').run(Date.now(), conv.id);
  sendMail({
    to: ADMIN_EMAIL,
    subject,
    text,
    html: emailShell(heading, info, transcriptHtml(messages), { href: adminChatUrl(origin, conv), label: 'Reply in Admin Panel' }),
    // Replies come back to the support mailbox; the email sync posts them to the chat and emails the visitor a clean copy
    replyTo: ADMIN_EMAIL,
    headers: { [CHAT_EMAIL_HEADER]: 'admin-notification' },
  }).catch(() => {});
}

export async function sendVisitorReplyEmail(origin: string, conv: ConversationRow, reply: string): Promise<boolean> {
  const chatUrl = `${origin}/?chat=open`;
  const intro = `Hi ${escapeHtml(conv.visitor_name)},<br><br>Our support team replied to your live chat on NovaP2P:`;
  const row = `<tr><td style="padding:6px 0;"><div style="background:#ecfdf5;border:1px solid #d1fae5;border-radius:10px;padding:12px 14px;font-size:14px;line-height:1.6;color:#111827;white-space:pre-wrap;">${escapeHtml(reply)}</div></td></tr>
    <tr><td style="font-size:13px;color:#6b7280;padding-top:10px;">You can reply to this email or continue the conversation in the chat window on our website.</td></tr>`;
  const result = await sendMail({
    to: conv.visitor_email,
    subject: `Reply from NovaP2P Support [NovaChat #${conv.code}]`,
    text: `Hi ${conv.visitor_name},\n\nOur support team replied to your live chat on NovaP2P:\n\n${reply}\n\nYou can reply to this email or continue the conversation on our website: ${chatUrl}\n\nNovaP2P Support`,
    html: emailShell('NovaP2P Support', intro, row, { href: chatUrl, label: 'Open Live Chat' }),
    replyTo: ADMIN_EMAIL,
    headers: { [CHAT_EMAIL_HEADER]: 'support-reply' },
  });
  return result.sent;
}

// ---------------------------------------------------------------------------
// AI REPLIES AND HANDOFF
// ---------------------------------------------------------------------------

function buildHistory(conversationId: string) {
  const rows = getMessages(conversationId).filter((m) => m.sender !== 'system').slice(-24);
  const history: { role: 'user' | 'model'; text: string }[] = [];
  for (const m of rows) {
    const role = m.sender === 'visitor' ? 'user' : 'model';
    const text = m.sender === 'admin' ? `(Reply from a NovaP2P support team member) ${m.body}` : m.body;
    const last = history[history.length - 1];
    if (last && last.role === role) last.text += `\n\n${text}`;
    else history.push({ role, text });
  }
  while (history.length && history[0].role !== 'user') history.shift();
  return history;
}

/** Marks the chat as needing a human, tells the visitor, and emails the support team. Returns the notice message. */
function requestHuman(req: Request, conv: ConversationRow): MessageRow | null {
  if (conv.human_requested) return null;
  db.prepare('UPDATE chat_conversations SET human_requested = 1 WHERE id = ?').run(conv.id);
  const notice = addMessage(
    conv.id,
    'system',
    `Our support team has been notified and will reply here as soon as possible. A copy of the reply will also be sent to ${conv.visitor_email}.`
  );
  sendAdminChatEmail(req, { ...conv, human_requested: 1 }, 'handoff');
  return notice;
}

function reserveAiQuota(conv: ConversationRow): boolean {
  const day = today();
  const usage = db.prepare('SELECT count FROM chat_ai_usage WHERE day = ?').get(day) as { count: number } | undefined;
  if ((usage?.count || 0) >= AI_GLOBAL_DAILY) return false;
  const convCount = conv.ai_day === day ? conv.ai_count : 0;
  if (convCount >= AI_PER_CONVERSATION_DAILY) return false;
  db.prepare('INSERT INTO chat_ai_usage (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1').run(day);
  db.prepare('UPDATE chat_conversations SET ai_day = ?, ai_count = ? WHERE id = ?').run(day, convCount + 1, conv.id);
  return true;
}

/** Produces the assistant's response to the latest visitor message (AI answer, or handoff to the team). */
async function respondToVisitor(req: Request, conversationId: string): Promise<MessageRow[]> {
  const conv = getConversation(conversationId);
  if (!conv) return [];
  const out: MessageRow[] = [];

  if (!conv.ai_enabled || !AI_CONFIGURED) {
    // Human mode: no AI. Make sure the team knows about the message.
    const notice = requestHuman(req, conv);
    if (notice) out.push(notice);
    else if (Date.now() - (conv.last_admin_alert_at || 0) > ADMIN_ALERT_THROTTLE_MS) sendAdminChatEmail(req, conv, 'message');
    return out;
  }

  const text = reserveAiQuota(conv) ? await callGemini(buildHistory(conv.id)) : null;
  if (!text) {
    const notice = requestHuman(req, conv);
    if (notice) out.push(notice);
    else if (Date.now() - (conv.last_admin_alert_at || 0) > ADMIN_ALERT_THROTTLE_MS) sendAdminChatEmail(req, conv, 'message');
    return out;
  }

  const wantsHuman = text.includes(HANDOFF_MARKER);
  const reply = cleanAiText(text.split(HANDOFF_MARKER).join(''));
  // A support member may have taken over while the AI was answering; drop the AI reply in that case.
  const fresh = getConversation(conv.id);
  if (!fresh || !fresh.ai_enabled) return out;
  if (reply) out.push(addMessage(conv.id, 'ai', reply));
  if (wantsHuman) {
    const notice = requestHuman(req, fresh);
    if (notice) out.push(notice);
  } else if (fresh.human_requested && Date.now() - (fresh.last_admin_alert_at || 0) > ADMIN_ALERT_THROTTLE_MS) {
    sendAdminChatEmail(req, fresh, 'message');
  }
  return out;
}

// ---------------------------------------------------------------------------
// VISITOR ENDPOINTS
// ---------------------------------------------------------------------------

const startLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5 });
const messageLimiter = rateLimit({ windowMs: 60 * 1000, max: 12 });

chatRouter.get('/config', (_req, res) => {
  res.json({ aiEnabled: AI_CONFIGURED });
});

chatRouter.post('/start', startLimiter, async (req, res) => {
  try {
    // Honeypot field: real visitors never see or fill it
    if (cleanText(req.body?.website, 200)) return res.status(400).json({ error: 'Unable to start chat.' });

    const name = cleanText(req.body?.name, 80);
    const email = cleanText(req.body?.email, 160).toLowerCase();
    const message = cleanText(req.body?.message, MAX_MESSAGE_LENGTH);
    const pageUrl = cleanText(req.body?.pageUrl, 300);
    if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

    const id = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('hex');
    let code = '';
    for (let i = 0; i < 5 && !code; i++) {
      const candidate = crypto.randomBytes(3).toString('hex').toUpperCase();
      if (!db.prepare('SELECT 1 FROM chat_conversations WHERE code = ?').get(candidate)) code = candidate;
    }
    if (!code) code = crypto.randomBytes(5).toString('hex').toUpperCase();
    const createdAt = nowIso();
    db.prepare(
      `INSERT INTO chat_conversations (id, code, token_hash, visitor_name, visitor_email, ai_enabled, page_url, ip, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, code, hashToken(token), name, email, AI_CONFIGURED ? 1 : 0, pageUrl || null, req.ip || null, createdAt, createdAt);

    const firstName = name.split(/\s+/)[0];
    addMessage(
      id,
      'ai',
      AI_CONFIGURED
        ? `Hi ${firstName}! I'm Sara from the NovaP2P Support Team. Ask me anything about Nova Swap, the Genesis rewards, or the Partner and BDM programs. How can I help you today?`
        : `Hi ${firstName}! Thanks for contacting NovaP2P. Send us your question and our support team will reply here and by email.`
    );

    if (message) {
      addMessage(id, 'visitor', message);
      await respondToVisitor(req, id);
    }

    const conv = getConversation(id)!;
    // Notify the team about the new chat (handoff emails are sent separately when needed)
    if (!conv.human_requested) sendAdminChatEmail(req, conv, 'new');

    res.json({ conversationId: id, token, conversation: publicState(conv), messages: getMessages(id).map(publicMessage) });
  } catch (err) {
    sendServerError(res, err, 'chat start');
  }
});

chatRouter.get('/conversations/:id/messages', (req, res) => {
  try {
    const conv = authorizeVisitor(req, res);
    if (!conv) return;
    const after = Math.max(0, Number(req.query.after) || 0);
    res.json({ conversation: publicState(conv), messages: getMessages(conv.id, after).map(publicMessage) });
  } catch (err) {
    sendServerError(res, err, 'chat messages');
  }
});

chatRouter.post('/conversations/:id/messages', messageLimiter, async (req, res) => {
  try {
    const conv = authorizeVisitor(req, res);
    if (!conv) return;
    const body = cleanText(req.body?.body, MAX_MESSAGE_LENGTH);
    if (!body) return res.status(400).json({ error: 'Message is empty.' });
    if (conv.status !== 'open') db.prepare("UPDATE chat_conversations SET status = 'open' WHERE id = ?").run(conv.id);
    const visitorMessage = addMessage(conv.id, 'visitor', body);
    const replies = await respondToVisitor(req, conv.id);
    const fresh = getConversation(conv.id)!;
    res.json({ conversation: publicState(fresh), messages: [visitorMessage, ...replies].map(publicMessage) });
  } catch (err) {
    sendServerError(res, err, 'chat send');
  }
});

chatRouter.post('/conversations/:id/handoff', messageLimiter, (req, res) => {
  try {
    const conv = authorizeVisitor(req, res);
    if (!conv) return;
    const notice = requestHuman(req, conv);
    const fresh = getConversation(conv.id)!;
    res.json({ conversation: publicState(fresh), messages: notice ? [publicMessage(notice)] : [] });
  } catch (err) {
    sendServerError(res, err, 'chat handoff');
  }
});

// ---------------------------------------------------------------------------
// ADMIN ENDPOINTS (x-admin-key)
// ---------------------------------------------------------------------------

chatRouter.get('/admin/conversations', verifyAdmin, (_req, res) => {
  try {
    const rows = db
      .prepare(
        `SELECT c.id, c.code, c.visitor_name, c.visitor_email, c.status, c.ai_enabled, c.human_requested, c.admin_unread, c.page_url, c.created_at, c.updated_at,
                (SELECT body FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
                (SELECT sender FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_sender,
                (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id) AS message_count
         FROM chat_conversations c ORDER BY c.updated_at DESC LIMIT 300`
      )
      .all();
    res.json({ aiConfigured: AI_CONFIGURED, aiStatus, emailSync: emailSyncStatus, conversations: rows });
  } catch (err) {
    sendServerError(res, err, 'chat admin list');
  }
});

chatRouter.get('/admin/conversations/:id', verifyAdmin, (req, res) => {
  try {
    const conv = getConversation(String(req.params.id));
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    db.prepare('UPDATE chat_conversations SET admin_unread = 0 WHERE id = ?').run(conv.id);
    const { token_hash, ...safe } = conv;
    res.json({ conversation: { ...safe, admin_unread: 0 }, messages: getMessages(conv.id).map(publicMessage) });
  } catch (err) {
    sendServerError(res, err, 'chat admin detail');
  }
});

chatRouter.post('/admin/conversations/:id/reply', verifyAdmin, async (req, res) => {
  try {
    const conv = getConversation(String(req.params.id));
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    const body = cleanText(req.body?.body, 5000);
    if (!body) return res.status(400).json({ error: 'Reply is empty.' });
    // A human has taken over: pause the AI so it does not talk over the support team.
    db.prepare("UPDATE chat_conversations SET ai_enabled = 0, admin_unread = 0, status = 'open' WHERE id = ?").run(conv.id);
    const message = addMessage(conv.id, 'admin', body);
    const emailed = await sendVisitorReplyEmail(getSiteOrigin(req), conv, body);
    res.json({ message: publicMessage(message), visitorEmailed: emailed });
  } catch (err) {
    sendServerError(res, err, 'chat admin reply');
  }
});

chatRouter.post('/admin/conversations/:id/settings', verifyAdmin, (req, res) => {
  try {
    const conv = getConversation(String(req.params.id));
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    if (typeof req.body?.aiEnabled === 'boolean') {
      db.prepare('UPDATE chat_conversations SET ai_enabled = ? WHERE id = ?').run(req.body.aiEnabled ? 1 : 0, conv.id);
    }
    if (req.body?.status === 'open' || req.body?.status === 'closed') {
      db.prepare('UPDATE chat_conversations SET status = ? WHERE id = ?').run(req.body.status, conv.id);
      if (req.body.status === 'closed' && conv.status !== 'closed') {
        addMessage(conv.id, 'system', 'This conversation was marked as resolved by our support team. Send a message any time to reopen it.');
      }
    }
    const fresh = getConversation(conv.id)!;
    const { token_hash, ...safe } = fresh;
    res.json({ conversation: safe });
  } catch (err) {
    sendServerError(res, err, 'chat admin settings');
  }
});
