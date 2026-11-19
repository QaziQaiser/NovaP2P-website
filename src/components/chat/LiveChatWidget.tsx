import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, X, Send, Loader2, Headphones, RotateCcw, ShieldCheck } from 'lucide-react';
import { chatApi, ChatApiError, type ChatConversationState, type ChatMessage } from '../../services/chatApi';

const SESSION_KEY = 'nova_live_chat_session';
const PROFILE_KEY = 'nova_live_chat_profile';
const SEEN_KEY = 'nova_live_chat_seen';

interface ChatSession {
  id: string;
  token: string;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) */
  }
}

/** Illustrated avatar for "Sara", the support persona (inline SVG, no external image). */
function SaraAvatar({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`sara-bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FCE7F3" />
          <stop offset="1" stopColor="#DBE7FF" />
        </linearGradient>
        <clipPath id={`sara-clip-${uid}`}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#sara-bg-${uid})`} />
      <g clipPath={`url(#sara-clip-${uid})`}>
        {/* hair (back) */}
        <path d="M15 31c0-12 7.5-20 17-20s17 8 17 20v15c0 4-2.5 6-6 6H21c-3.5 0-6-2-6-6z" fill="#4A2F27" />
        {/* shoulders */}
        <path d="M8 66c1.5-11 10.5-16 24-16s22.5 5 24 16z" fill="#4F7DF3" />
        <path d="M26 50l6 6 6-6" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
        {/* neck */}
        <rect x="27.5" y="40" width="9" height="11" rx="3.5" fill="#E9B394" />
        {/* face */}
        <ellipse cx="32" cy="30.5" rx="10.5" ry="12.5" fill="#F5CBAE" />
        {/* fringe */}
        <path d="M21 29.5c-.5-9.5 4.5-15.5 11-15.5 7 0 12 5.5 11.5 14-6-.5-10.5-3.5-12.5-8-2 4.5-5 8-10 9.5z" fill="#4A2F27" />
        {/* eyes, brows, smile, cheeks */}
        <circle cx="27.8" cy="31.5" r="1.3" fill="#3A2420" />
        <circle cx="36.2" cy="31.5" r="1.3" fill="#3A2420" />
        <path d="M25.8 28.3q2-1.2 4 0M34.2 28.3q2-1.2 4 0" fill="none" stroke="#4A2F27" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M28.8 36.2q3.2 2.6 6.4 0" fill="none" stroke="#C0605A" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="25.5" cy="35" r="2" fill="#F39BA6" opacity="0.35" />
        <circle cx="38.5" cy="35" r="2" fill="#F39BA6" opacity="0.35" />
        {/* headset */}
        <path d="M19.5 31a12.5 12.5 0 0 1 25 0" fill="none" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
        <rect x="17" y="28.5" width="4.5" height="8" rx="2.2" fill="#1F2937" />
        <rect x="42.5" y="28.5" width="4.5" height="8" rx="2.2" fill="#1F2937" />
        <path d="M19.5 36.5q1 5.5 8 5.5" fill="none" stroke="#1F2937" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="28" cy="42" r="1.4" fill="#1F2937" />
      </g>
    </svg>
  );
}

/** Renders message text with clickable links (full URLs and site paths like /become-partner). No HTML is injected. */
function MessageText({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  // No regex lookbehind: older iOS Safari cannot parse it
  const parts = text.split(/(https?:\/\/[^\s)]+|\/[a-z][a-z0-9-]*(?:\/[a-z0-9-]+)*)/gi);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (/^https?:\/\//i.test(part)) {
          const clean = part.replace(/[.,!?]+$/, '');
          return (
            <React.Fragment key={i}>
              <a href={clean} target="_blank" rel="noopener noreferrer" className="underline break-all">
                {clean}
              </a>
              {part.slice(clean.length)}
            </React.Fragment>
          );
        }
        const prev = i > 0 ? parts[i - 1] : '';
        // Site path such as /become-partner, only when it starts a word (not "and/or")
        if (i % 2 === 1 && /^\/[a-z]/i.test(part) && (prev === '' || /[\s(]$/.test(prev))) {
          return (
            <Link key={i} to={part} onClick={onNavigate} className="underline">
              {part}
            </Link>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export const LiveChatWidget: React.FC = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<ChatSession | null>(() => readJson<ChatSession>(SESSION_KEY));
  const [conversation, setConversation] = useState<ChatConversationState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<ChatMessage | null>(null);
  const [seenId, setSeenId] = useState<number>(() => readJson<number>(SEEN_KEY) || 0);

  const savedProfile = useMemo(() => readJson<{ name: string; email: string }>(PROFILE_KEY), []);
  const [name, setName] = useState(savedProfile?.name || '');
  const [email, setEmail] = useState(savedProfile?.email || '');
  const [firstMessage, setFirstMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const [draft, setDraft] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const next = [...prev, ...incoming.filter((m) => !known.has(m.id))].sort((a, b) => a.id - b.id);
      lastIdRef.current = next.length ? next[next.length - 1].id : 0;
      return next;
    });
  }, []);

  const resetSession = useCallback(() => {
    writeJson(SESSION_KEY, null);
    writeJson(SEEN_KEY, null);
    setSession(null);
    setConversation(null);
    setMessages([]);
    setSeenId(0);
    lastIdRef.current = 0;
  }, []);

  // Open automatically from the "Open Live Chat" email link (?chat=open)
  useEffect(() => {
    if (new URLSearchParams(location.search).get('chat') === 'open') setIsOpen(true);
  }, [location.search]);

  // Load and poll the conversation: fast while open, slow while closed (for the unread badge)
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const res = await chatApi.getMessages(session.id, session.token, lastIdRef.current);
          if (cancelled) return;
          setConversation(res.conversation);
          mergeMessages(res.messages);
        } catch (err) {
          if (!cancelled && err instanceof ChatApiError && err.status === 404) {
            resetSession();
            return;
          }
        }
      }
      if (!cancelled) timer = setTimeout(poll, isOpen ? 4000 : 20000);
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [session, isOpen, mergeMessages, resetSession]);

  // Mark messages as seen while the window is open
  useEffect(() => {
    if (!isOpen || !messages.length) return;
    const maxId = messages[messages.length - 1].id;
    if (maxId > seenId) {
      setSeenId(maxId);
      writeJson(SEEN_KEY, maxId);
    }
  }, [isOpen, messages, seenId]);

  // Keep the newest message in view
  useEffect(() => {
    if (isOpen && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [isOpen, messages.length, pending, isSending]);

  const unread = messages.filter((m) => m.id > seenId && m.sender === 'admin').length;

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (trimmedName.length < 2) return setError('Please enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) return setError('Please enter a valid email address.');
    try {
      setIsStarting(true);
      const res = await chatApi.start({
        name: trimmedName,
        email: trimmedEmail,
        message: firstMessage.trim() || undefined,
        website: honeypot,
        pageUrl: window.location.href,
      });
      const next = { id: res.conversationId, token: res.token };
      writeJson(SESSION_KEY, next);
      writeJson(PROFILE_KEY, { name: trimmedName, email: trimmedEmail });
      lastIdRef.current = 0;
      setMessages([]);
      mergeMessages(res.messages);
      setConversation(res.conversation);
      setSession(next);
      setFirstMessage('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err: any) {
      setError(err?.message || 'Unable to start the chat. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || !session || isSending) return;
    setError(null);
    setDraft('');
    // Show the visitor's message straight away (kept apart from server messages until confirmed)
    setPending({ id: -1, sender: 'visitor', body, createdAt: new Date().toISOString() });
    try {
      setIsSending(true);
      const res = await chatApi.send(session.id, session.token, body);
      setPending(null);
      mergeMessages(res.messages);
      setConversation(res.conversation);
    } catch (err: any) {
      setPending(null);
      setDraft(body);
      if (err instanceof ChatApiError && err.status === 404) resetSession();
      setError(err?.message || 'Message not sent. Please try again.');
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleHandoff = async () => {
    if (!session) return;
    try {
      const res = await chatApi.handoff(session.id, session.token);
      mergeMessages(res.messages);
      setConversation(res.conversation);
    } catch (err: any) {
      setError(err?.message || 'Please try again.');
    }
  };

  const handleNewChat = () => {
    if (window.confirm('Start a new conversation? The current chat will be closed on this device.')) resetSession();
  };

  const showTyping = isSending && (conversation?.aiEnabled ?? false);
  // The "Talk to a real person" button sits under the first greeting message
  const greetingId = messages.find((m) => m.sender === 'ai')?.id;
  const canRequestHuman = !!session && !conversation?.humanRequested && !conversation?.agentJoined;

  return (
    <>
      {/* Floating chat button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Close live chat' : 'Open live chat'}
        className={`fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-primary hover:bg-primary-dark text-white shadow-xl shadow-primary/30 flex items-center justify-center transition-all cursor-pointer ${
          isOpen ? 'hidden sm:flex' : 'flex'
        }`}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={26} />}
        {!isOpen && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
            {unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="NovaP2P live chat"
          className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-5 z-[60] sm:w-[380px] sm:h-[600px] sm:max-h-[calc(100vh-7.5rem)] bg-white sm:rounded-2xl shadow-2xl sm:border border-gray-200 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary-dark text-white px-4 py-3.5 flex items-center gap-3 shrink-0">
            <div className="relative shrink-0">
              <SaraAvatar className="w-11 h-11 rounded-full ring-2 ring-white/70 shadow-md" />
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[16px] leading-tight">Sara</p>
              <p className="text-xs text-white/85 truncate">Support Team · Online</p>
            </div>
            {session && (
              <button
                type="button"
                onClick={handleNewChat}
                aria-label="Start a new chat"
                title="Start a new chat"
                className="p-2 rounded-full hover:bg-white/15 transition-colors cursor-pointer"
              >
                <RotateCcw size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close live chat"
              className="p-2 rounded-full hover:bg-white/15 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {!session ? (
            /* Start form */
            <form onSubmit={handleStart} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 bg-gray-50/60">
              <div>
                <h3 className="text-lg font-bold text-secondary">Hi there 👋</h3>
                <p className="text-sm text-gray-600 mt-1">
                  I'm Sara from the NovaP2P Support Team. Tell me who you are and ask your question, I usually reply in seconds.
                </p>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-gray-700">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  required
                  autoComplete="name"
                  placeholder="Your name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-gray-700">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={160}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-gray-700">
                  Message <span className="font-normal text-gray-400">(optional)</span>
                </span>
                <textarea
                  value={firstMessage}
                  onChange={(e) => setFirstMessage(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="How can we help?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-[15px] text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </label>
              {/* Honeypot: hidden from people, filled by bots */}
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] w-px h-px opacity-0"
              />
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
              <button
                type="submit"
                disabled={isStarting}
                className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isStarting ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
                {isStarting ? 'Starting chat...' : 'Start Chat'}
              </button>
              <p className="text-xs text-gray-500 flex items-start gap-1.5">
                <ShieldCheck size={14} className="shrink-0 mt-0.5 text-accent" />
                <span>
                  We will never ask for your seed phrase or private key. See our{' '}
                  <Link to="/privacy-policy" onClick={() => setIsOpen(false)} className="underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </p>
            </form>
          ) : (
            <>
              {/* Conversation */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/60">
                {(pending ? [...messages, pending] : messages).map((m) =>
                  m.sender === 'system' ? (
                    <div key={m.id} className="text-center">
                      <span className="inline-block text-xs text-gray-600 bg-white border border-gray-200 rounded-full px-3 py-1.5 max-w-full">{m.body}</span>
                    </div>
                  ) : (
                    <div key={m.id} className={`flex ${m.sender === 'visitor' ? 'justify-end' : 'justify-start'} gap-2`}>
                      {m.sender === 'admin' && (
                        <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-0.5 bg-accent/15 text-accent">
                          <Headphones size={15} />
                        </div>
                      )}
                      {m.sender === 'ai' && <SaraAvatar className="w-7 h-7 rounded-full shrink-0 mt-0.5" />}
                      <div className={`max-w-[80%] flex flex-col ${m.sender === 'visitor' ? 'items-end' : 'items-start'}`}>
                        {m.sender === 'admin' && <span className="text-[11px] font-semibold text-accent mb-0.5">Support Team</span>}
                        <div
                          className={`px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
                            m.sender === 'visitor'
                              ? 'bg-primary text-white rounded-br-md'
                              : m.sender === 'admin'
                                ? 'bg-white border border-accent/30 text-gray-800 rounded-bl-md'
                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                          }`}
                        >
                          <MessageText text={m.body} onNavigate={() => setIsOpen(false)} />
                          {m.id === greetingId && canRequestHuman && (
                            <button
                              type="button"
                              onClick={handleHandoff}
                              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:brightness-105 transition-all cursor-pointer"
                            >
                              <Headphones size={15} /> Talk to a Human
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1">{formatTime(m.createdAt)}</span>
                      </div>
                    </div>
                  )
                )}
                {showTyping && (
                  <div className="flex justify-start gap-2">
                    <SaraAvatar className="w-7 h-7 rounded-full shrink-0" />
                    <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white border border-gray-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                    </div>
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className="border-t border-gray-200 bg-white px-3 pt-2 pb-3 shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
                <form onSubmit={handleSend} className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    rows={1}
                    maxLength={2000}
                    placeholder="Type your message..."
                    className="flex-1 max-h-32 min-h-[44px] px-3.5 py-2.5 rounded-xl border border-gray-300 text-[15px] text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || isSending}
                    aria-label="Send message"
                    className="w-11 h-11 shrink-0 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-50 text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default LiveChatWidget;
