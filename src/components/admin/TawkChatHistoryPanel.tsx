import React, { useCallback, useEffect, useState } from 'react';
import {
  MessageCircle,
  Loader2,
  Headphones,
  User,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Mail,
  Search,
  ExternalLink,
  Paperclip,
  Ticket,
  CheckCircle,
} from 'lucide-react';

// Read-only history of tawk.to chats, filled by tawk.to webhooks (server/tawkApi.ts).
// Replying happens in the tawk.to dashboard or apps.

const API_BASE = '/api/tawk';
const TAWK_DASHBOARD_URL = 'https://dashboard.tawk.to/';
const WEBHOOK_URL = 'https://novap2p.com/api/tawk/webhook';

interface TawkChat {
  id: string;
  visitor_name: string;
  visitor_email: string;
  visitor_city: string;
  visitor_country: string;
  domain: string;
  referrer: string;
  first_message: string;
  agent_names: string;
  status: 'active' | 'ended';
  message_count: number;
  has_transcript: number;
  started_at: string;
  ended_at: string | null;
}

interface TawkMessage {
  id: number;
  sender: 'visitor' | 'agent' | 'system';
  sender_name: string;
  type: string;
  body: string;
  attachments: { url: string; name: string; mimeType: string; size: number }[];
  sent_at: string;
}

interface TawkTicket {
  id: string;
  human_id: number | null;
  subject: string;
  message: string;
  requester_name: string;
  requester_email: string;
  created_at: string;
}

interface ListResponse {
  chats: TawkChat[];
  total: number;
  page: number;
  pageSize: number;
  stats: { total: number; last24h: number; last7d: number; active: number; tickets: number };
  webhook: { configured: boolean; lastReceivedAt: string | null; lastError: string | null };
}

const formatDateTime = (iso: string | null) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

async function getJson<T>(url: string, adminKey: string): Promise<T> {
  const res = await fetch(url, { headers: { 'x-admin-key': adminKey } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || 'Something went wrong. Please try again.');
  return data as T;
}

const visitorLabel = (c: TawkChat) => c.visitor_name || c.visitor_email || 'Visitor';
const placeOf = (c: TawkChat) => [c.visitor_city, c.visitor_country].filter(Boolean).join(', ');

export const TawkChatHistoryPanel: React.FC<{ adminKey: string }> = ({ adminKey }) => {
  const [view, setView] = useState<'chats' | 'tickets'>('chats');
  const [list, setList] = useState<ListResponse | null>(null);
  const [tickets, setTickets] = useState<TawkTicket[]>([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ chat: TawkChat; messages: TawkMessage[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set('q', search);
      const [res, t] = await Promise.all([
        getJson<ListResponse>(`${API_BASE}/admin/chats?${params}`, adminKey),
        getJson<{ tickets: TawkTicket[] }>(`${API_BASE}/admin/tickets`, adminKey),
      ]);
      setList(res);
      setTickets(t.tickets || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load chat history.');
    } finally {
      setIsLoading(false);
    }
  }, [adminKey, page, search]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setIsLoadingDetail(true);
    getJson<{ chat: TawkChat; messages: TawkMessage[] }>(`${API_BASE}/admin/chats/${encodeURIComponent(selectedId)}`, adminKey)
      .then((d) => !cancelled && setDetail(d))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load the chat.'))
      .finally(() => !cancelled && setIsLoadingDetail(false));
    return () => {
      cancelled = true;
    };
  }, [selectedId, adminKey]);

  const stats = list?.stats;
  const webhook = list?.webhook;
  const totalPages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;
  const needsSetup = webhook && (!webhook.configured || !webhook.lastReceivedAt);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <MessageCircle size={20} className="text-primary" /> Chat History
          </h2>
          <p className="text-xs text-slate-500">A read-only copy of your tawk.to chats. Reply to visitors in tawk.to.</p>
        </div>
        <a
          href={TAWK_DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold inline-flex items-center gap-2"
        >
          Open tawk.to Dashboard <ExternalLink size={14} />
        </a>
      </div>

      {/* Setup / status */}
      {webhook && !webhook.configured && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
          <p className="font-bold flex items-center gap-2">
            <AlertTriangle size={16} /> Chat history is not connected yet
          </p>
          <ol className="list-decimal ml-5 space-y-1 text-amber-100/90">
            <li>
              In tawk.to, open <b>Administration → Settings → Webhooks</b> and click <b>Create Webhook</b>.
            </li>
            <li>
              Endpoint URL: <code className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-100 break-all">{WEBHOOK_URL}</code>
            </li>
            <li>Tick all events: Chat Start, Chat End, Chat Transcript Created, Ticket Create. Save it.</li>
            <li>
              Copy the webhook's <b>Secret Key</b> and add it on Hostinger as the environment variable <code className="px-1.5 py-0.5 rounded bg-slate-900">TAWK_WEBHOOK_SECRET</code>, then redeploy.
            </li>
          </ol>
        </div>
      )}
      {webhook?.configured && !webhook.lastReceivedAt && (
        <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-200 text-xs font-medium flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            Webhook secret is set, but no chats have arrived yet. Make sure the tawk.to webhook points to{' '}
            <code className="px-1 rounded bg-slate-900 break-all">{WEBHOOK_URL}</code>. A chat shows here once it ends and tawk.to sends the transcript.
          </span>
        </div>
      )}
      {webhook?.lastError && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span className="break-words min-w-0">{webhook.lastError}</span>
        </div>
      )}
      {webhook?.configured && webhook.lastReceivedAt && !webhook.lastError && !needsSetup && (
        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <CheckCircle size={12} className="text-emerald-400" /> Connected to tawk.to · last update {formatDateTime(webhook.lastReceivedAt)}
        </p>
      )}
      {error && (
        <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            ['Total chats', stats.total],
            ['Last 24 hours', stats.last24h],
            ['Last 7 days', stats.last7d],
            ['In progress', stats.active],
            ['Offline messages', stats.tickets],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-extrabold text-white mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* View switch */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['chats', `Chats${stats ? ` (${stats.total})` : ''}`],
            ['tickets', `Offline messages${stats ? ` (${stats.tickets})` : ''}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
              view === id ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'tickets' ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden">
          {tickets.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No offline messages yet. When nobody is online, visitors can leave a message in the widget and it shows here.
            </p>
          ) : (
            tickets.map((t) => (
              <div key={t.id} className="p-4 border-b border-slate-800/70 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white flex items-center gap-2">
                    <Ticket size={14} className="text-primary" />
                    {t.subject || '(no subject)'}
                    {t.human_id != null && <span className="text-[10px] text-slate-500">#{t.human_id}</span>}
                  </span>
                  <span className="text-[11px] text-slate-500">{formatDateTime(t.created_at)}</span>
                </div>
                <p className="text-xs text-slate-400">
                  {t.requester_name}
                  {t.requester_email && (
                    <a href={`mailto:${t.requester_email}`} className="text-primary ml-2 inline-flex items-center gap-1 break-all">
                      <Mail size={11} /> {t.requester_email}
                    </a>
                  )}
                </p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">{t.message}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
          {/* Chat list */}
          <div className={`bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden flex-col lg:h-[640px] ${selectedId ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-800 space-y-3">
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(1);
                  setSearch(query.trim());
                }}
              >
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700">
                  <Search size={14} className="text-slate-500 shrink-0" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, email or message"
                    className="bg-transparent text-sm text-white placeholder:text-slate-500 outline-none w-full min-w-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={load}
                  className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                  aria-label="Refresh chats"
                >
                  <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </form>
              {search && (
                <p className="text-[11px] text-slate-500">
                  {list?.total ?? 0} result(s) for "{search}"{' '}
                  <button
                    onClick={() => {
                      setQuery('');
                      setSearch('');
                      setPage(1);
                    }}
                    className="text-primary cursor-pointer"
                  >
                    Clear
                  </button>
                </p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto max-h-[60vh] lg:max-h-none">
              {!list ? (
                <div className="p-6 flex justify-center text-slate-500">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : list.chats.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">{search ? 'No chats match your search.' : 'No chats yet.'}</p>
              ) : (
                list.chats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-800/70 hover:bg-slate-800/60 transition-colors cursor-pointer ${
                      selectedId === c.id ? 'bg-slate-800/80' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white truncate">{visitorLabel(c)}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{formatDateTime(c.started_at)}</span>
                    </div>
                    {c.visitor_email && c.visitor_name && <p className="text-xs text-slate-500 truncate">{c.visitor_email}</p>}
                    <p className="text-xs text-slate-400 truncate mt-1">{c.first_message || '(no message text)'}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {c.status === 'active' ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold text-[10px]">In progress</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 font-semibold text-[10px]">Ended</span>
                      )}
                      {c.message_count > 0 && <span className="text-[10px] text-slate-500">{c.message_count} messages</span>}
                      {placeOf(c) && <span className="text-[10px] text-slate-600">{placeOf(c)}</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
            {list && totalPages > 1 && (
              <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Transcript */}
          <div className={`bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden flex-col h-[70vh] lg:h-[640px] ${selectedId ? 'flex' : 'hidden lg:flex'}`}>
            {!selectedId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm gap-2 p-6 text-center">
                <MessageCircle size={32} className="text-slate-700" />
                Select a chat to read the conversation.
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-slate-800 flex items-start gap-3">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-300 cursor-pointer"
                    aria-label="Back to chats"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-white font-bold truncate">{detail ? visitorLabel(detail.chat) : '...'}</p>
                    {detail?.chat.visitor_email && (
                      <a href={`mailto:${detail.chat.visitor_email}`} className="text-xs text-primary inline-flex items-center gap-1 break-all">
                        <Mail size={12} /> {detail.chat.visitor_email}
                      </a>
                    )}
                    {detail && (
                      <p className="text-[11px] text-slate-500">
                        {formatDateTime(detail.chat.started_at)}
                        {detail.chat.ended_at ? ` – ${formatTime(detail.chat.ended_at)}` : ' · in progress'}
                        {placeOf(detail.chat) ? ` · ${placeOf(detail.chat)}` : ''}
                        {detail.chat.agent_names ? ` · Agent: ${detail.chat.agent_names}` : ''}
                      </p>
                    )}
                    {detail?.chat.referrer && <p className="text-[11px] text-slate-500 truncate">From: {detail.chat.referrer}</p>}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {isLoadingDetail && !detail ? (
                    <div className="flex justify-center text-slate-500">
                      <Loader2 size={20} className="animate-spin" />
                    </div>
                  ) : detail && detail.messages.length === 0 ? (
                    <div className="text-center text-sm text-slate-500 space-y-2 pt-6">
                      <p>The full transcript arrives from tawk.to after the chat ends.</p>
                      {detail.chat.first_message && (
                        <p className="text-slate-400">
                          First message: <span className="italic">"{detail.chat.first_message}"</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    detail?.messages.map((m) =>
                      m.sender === 'system' ? (
                        <p key={m.id} className="text-center text-[11px] text-slate-500 italic px-4 whitespace-pre-wrap break-words">
                          {m.body}
                        </p>
                      ) : (
                        <div key={m.id} className={`flex ${m.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] flex flex-col ${m.sender === 'agent' ? 'items-end' : 'items-start'}`}>
                            <span className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1">
                              {m.sender === 'agent' ? <Headphones size={11} /> : <User size={11} />}
                              {m.sender === 'agent' ? m.sender_name || 'Support Team' : visitorLabel(detail.chat)} · {formatTime(m.sent_at)}
                            </span>
                            {m.body && (
                              <div
                                className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                                  m.sender === 'agent' ? 'bg-primary text-white rounded-br-md' : 'bg-slate-800 text-slate-100 rounded-bl-md'
                                }`}
                              >
                                {m.body}
                              </div>
                            )}
                            {m.attachments.map((a) => (
                              <a
                                key={a.url}
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 text-xs text-primary inline-flex items-center gap-1 break-all"
                              >
                                <Paperclip size={12} /> {a.name || 'Attachment'}
                              </a>
                            ))}
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
