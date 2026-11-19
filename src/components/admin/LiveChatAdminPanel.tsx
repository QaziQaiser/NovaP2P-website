import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Loader2, Bot, Headphones, User, ArrowLeft, RefreshCw, CheckCircle, AlertTriangle, Mail } from 'lucide-react';
import { chatApi, type AdminChatSummary, type AiStatus, type ChatMessage, type EmailSyncStatus } from '../../services/chatApi';

interface LiveChatAdminPanelProps {
  adminKey: string;
  initialChatId?: string | null;
}

const formatDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

export const LiveChatAdminPanel: React.FC<LiveChatAdminPanelProps> = ({ adminKey, initialChatId }) => {
  const [conversations, setConversations] = useState<AdminChatSummary[]>([]);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [emailSync, setEmailSync] = useState<EmailSyncStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialChatId || null);
  const [selected, setSelected] = useState<AdminChatSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [filter, setFilter] = useState<'all' | 'needs_reply' | 'open' | 'closed'>('all');
  const [reply, setReply] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(
    async (showSpinner = false) => {
      try {
        if (showSpinner) setIsLoadingList(true);
        const res = await chatApi.adminList(adminKey);
        setConversations(res.conversations || []);
        setAiConfigured(res.aiConfigured);
        setAiStatus(res.aiStatus || null);
        setEmailSync(res.emailSync || null);
      } catch (err: any) {
        setError(err.message || 'Failed to load conversations');
      } finally {
        setIsLoadingList(false);
      }
    },
    [adminKey]
  );

  const loadConversation = useCallback(
    async (id: string) => {
      try {
        const res = await chatApi.adminGet(adminKey, id);
        setSelected(res.conversation);
        setMessages(res.messages || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load conversation');
      }
    },
    [adminKey]
  );

  // Conversation list: refresh every 10 seconds
  useEffect(() => {
    loadList(true);
    const t = setInterval(() => document.visibilityState === 'visible' && loadList(), 10000);
    return () => clearInterval(t);
  }, [loadList]);

  // Open conversation: refresh every 5 seconds
  useEffect(() => {
    if (!selectedId) return;
    loadConversation(selectedId);
    const t = setInterval(() => document.visibilityState === 'visible' && loadConversation(selectedId), 5000);
    return () => clearInterval(t);
  }, [selectedId, loadConversation]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, selectedId]);

  const openConversation = (id: string) => {
    setNotice(null);
    setError(null);
    setReply('');
    setMessages([]);
    setSelected(null);
    setSelectedId(id);
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !reply.trim()) return;
    try {
      setIsSending(true);
      setError(null);
      const res = await chatApi.adminReply(adminKey, selectedId, reply.trim());
      setMessages((prev) => [...prev, res.message]);
      setReply('');
      setNotice(
        res.visitorEmailed
          ? { ok: true, text: `Reply sent in the chat and emailed to ${selected?.visitor_email}. AI is paused for this chat.` }
          : { ok: false, text: 'Reply sent in the chat, but the email copy could not be delivered (check SMTP settings). AI is paused for this chat.' }
      );
      loadConversation(selectedId);
      loadList();
    } catch (err: any) {
      setError(err.message || 'Failed to send reply');
    } finally {
      setIsSending(false);
    }
  };

  const updateSettings = async (settings: { aiEnabled?: boolean; status?: 'open' | 'closed' }) => {
    if (!selectedId) return;
    try {
      setError(null);
      await chatApi.adminSettings(adminKey, selectedId, settings);
      loadConversation(selectedId);
      loadList();
    } catch (err: any) {
      setError(err.message || 'Failed to update conversation');
    }
  };

  const filtered = conversations.filter((c) => {
    if (filter === 'needs_reply') return c.status === 'open' && (c.admin_unread > 0 || c.human_requested === 1) && c.last_sender !== 'admin';
    if (filter === 'open') return c.status === 'open';
    if (filter === 'closed') return c.status === 'closed';
    return true;
  });
  const needsReplyCount = conversations.filter((c) => c.status === 'open' && (c.admin_unread > 0 || c.human_requested === 1) && c.last_sender !== 'admin').length;

  const senderStyle = (m: ChatMessage) =>
    m.sender === 'admin'
      ? 'bg-primary text-white rounded-br-md'
      : m.sender === 'visitor'
        ? 'bg-slate-800 text-slate-100 rounded-bl-md'
        : 'bg-slate-900 border border-slate-700 text-slate-300 rounded-bl-md';

  return (
    <div className="space-y-4">
      {!aiConfigured && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          <span>AI answers are off: GEMINI_API_KEY is not set on the server. Visitors can still chat and every message reaches you here.</span>
        </div>
      )}
      {aiConfigured && aiStatus?.lastError && (!aiStatus.lastSuccessAt || (aiStatus.lastErrorAt || '') > aiStatus.lastSuccessAt) && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span className="break-words min-w-0">
            The AI could not answer the last message ({aiStatus.lastErrorAt ? formatDateTime(aiStatus.lastErrorAt) : ''}), so the chat was handed to the support team.
            <br />
            <span className="text-red-200/90">{aiStatus.lastError}</span>
          </span>
        </div>
      )}
      {emailSync?.enabled && emailSync.lastError && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span className="break-words min-w-0">Email reply sync problem: {emailSync.lastError} Replies from the admin panel still work.</span>
        </div>
      )}
      {notice && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
            notice.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          {notice.ok ? <CheckCircle size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* Conversation list */}
        <div className={`bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden flex flex-col lg:h-[640px] ${selectedId ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-800 space-y-3">
            {emailSync && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Mail size={12} className={emailSync.enabled && !emailSync.lastError ? 'text-emerald-400' : 'text-slate-600'} />
                {emailSync.enabled
                  ? `Email replies sync: ${emailSync.lastError ? 'error' : 'active'}${emailSync.lastOkAt ? ` · checked ${formatDateTime(emailSync.lastOkAt)}` : ''}`
                  : 'Email replies sync: off (set SMTP_PASS on the server)'}
              </p>
            )}
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold flex items-center gap-2">
                <MessageCircle size={18} className="text-primary" /> Live Chats
              </h3>
              <button
                onClick={() => loadList(true)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                aria-label="Refresh conversations"
              >
                <RefreshCw size={14} className={isLoadingList ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['all', 'All'],
                  ['needs_reply', `Needs reply${needsReplyCount ? ` (${needsReplyCount})` : ''}`],
                  ['open', 'Open'],
                  ['closed', 'Resolved'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                    filter === id ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[60vh] lg:max-h-none">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">No conversations yet.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-800/70 hover:bg-slate-800/60 transition-colors cursor-pointer ${
                    selectedId === c.id ? 'bg-slate-800/80' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white truncate">{c.visitor_name}</span>
                    <span className="text-[10px] text-slate-500 shrink-0">{formatDateTime(c.updated_at)}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{c.visitor_email}</p>
                  <p className="text-xs text-slate-400 truncate mt-1">
                    {c.last_sender === 'admin' ? 'You: ' : c.last_sender === 'ai' ? 'AI: ' : ''}
                    {c.last_message || ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {c.admin_unread > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold text-[10px]">{c.admin_unread} new</span>
                    )}
                    {c.human_requested === 1 && c.status === 'open' && (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-semibold text-[10px]">Human requested</span>
                    )}
                    {c.status === 'closed' && (
                      <span className="px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 font-semibold text-[10px]">Resolved</span>
                    )}
                    <span className="text-[10px] text-slate-600">#{c.code}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Conversation detail */}
        <div className={`bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden flex-col h-[70vh] lg:h-[640px] ${selectedId ? 'flex' : 'hidden lg:flex'}`}>
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm gap-2 p-6 text-center">
              <MessageCircle size={32} className="text-slate-700" />
              Select a conversation to read and reply.
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-slate-800 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setSelectedId(null)}
                  className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-300 cursor-pointer"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold truncate">{selected?.visitor_name || '...'}</p>
                  <a href={selected ? `mailto:${selected.visitor_email}` : undefined} className="text-xs text-primary inline-flex items-center gap-1 break-all">
                    <Mail size={12} /> {selected?.visitor_email}
                  </a>
                  {selected?.page_url && <p className="text-[11px] text-slate-500 truncate">From: {selected.page_url}</p>}
                </div>
                {selected && (
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => updateSettings({ aiEnabled: !selected.ai_enabled })}
                      disabled={!aiConfigured}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                        selected.ai_enabled ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                      title="When on, the AI assistant answers the visitor"
                    >
                      <Bot size={14} /> AI {selected.ai_enabled ? 'On' : 'Off'}
                    </button>
                    <button
                      onClick={() => updateSettings({ status: selected.status === 'closed' ? 'open' : 'closed' })}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:text-white cursor-pointer"
                    >
                      {selected.status === 'closed' ? 'Reopen' : 'Mark resolved'}
                    </button>
                  </div>
                )}
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) =>
                  m.sender === 'system' ? (
                    <p key={m.id} className="text-center text-[11px] text-slate-500 italic px-4">
                      {m.body}
                    </p>
                  ) : (
                    <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] flex flex-col ${m.sender === 'admin' ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1">
                          {m.sender === 'admin' ? <Headphones size={11} /> : m.sender === 'ai' ? <Bot size={11} /> : <User size={11} />}
                          {m.sender === 'admin' ? 'Support Team' : m.sender === 'ai' ? 'AI Assistant' : selected?.visitor_name || 'Visitor'} · {formatDateTime(m.createdAt)}
                        </span>
                        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${senderStyle(m)}`}>{m.body}</div>
                      </div>
                    </div>
                  )
                )}
              </div>

              <form onSubmit={handleReply} className="p-3 border-t border-slate-800 flex items-end gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply(e as any);
                  }}
                  rows={2}
                  maxLength={5000}
                  placeholder="Type your reply (shown in the chat and emailed to the visitor). Ctrl+Enter to send."
                  className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={isSending || !reply.trim()}
                  aria-label="Send reply"
                  className="h-11 px-4 rounded-2xl bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
