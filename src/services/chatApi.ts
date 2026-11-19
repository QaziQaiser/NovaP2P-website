export type ChatSender = 'visitor' | 'ai' | 'admin' | 'system';

export interface ChatMessage {
  id: number;
  sender: ChatSender;
  body: string;
  createdAt: string;
}

export interface ChatConversationState {
  id: string;
  code: string;
  name: string;
  status: 'open' | 'closed';
  aiEnabled: boolean;
  humanRequested: boolean;
  agentJoined: boolean;
}

export interface AdminChatSummary {
  id: string;
  code: string;
  visitor_name: string;
  visitor_email: string;
  status: 'open' | 'closed';
  ai_enabled: number;
  human_requested: number;
  admin_unread: number;
  page_url: string | null;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_sender: ChatSender | null;
  message_count: number;
}

export interface AiStatus {
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

const API_BASE = '/api/chat';

export class ChatApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ChatApiError((data as any)?.error || 'Something went wrong. Please try again.', res.status);
  return data as T;
}

export const chatApi = {
  start: (payload: { name: string; email: string; message?: string; website?: string; pageUrl?: string }) =>
    requestJson<{ conversationId: string; token: string; conversation: ChatConversationState; messages: ChatMessage[] }>(`${API_BASE}/start`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMessages: (id: string, token: string, after = 0) =>
    requestJson<{ conversation: ChatConversationState; messages: ChatMessage[] }>(
      `${API_BASE}/conversations/${encodeURIComponent(id)}/messages?after=${after}`,
      { headers: { 'x-chat-token': token } }
    ),

  send: (id: string, token: string, body: string) =>
    requestJson<{ conversation: ChatConversationState; messages: ChatMessage[] }>(`${API_BASE}/conversations/${encodeURIComponent(id)}/messages`, {
      method: 'POST',
      headers: { 'x-chat-token': token },
      body: JSON.stringify({ body }),
    }),

  handoff: (id: string, token: string) =>
    requestJson<{ conversation: ChatConversationState; messages: ChatMessage[] }>(`${API_BASE}/conversations/${encodeURIComponent(id)}/handoff`, {
      method: 'POST',
      headers: { 'x-chat-token': token },
    }),

  // Admin (x-admin-key)
  adminList: (adminKey: string) =>
    requestJson<{ aiConfigured: boolean; aiStatus?: AiStatus; conversations: AdminChatSummary[] }>(`${API_BASE}/admin/conversations`, {
      headers: { 'x-admin-key': adminKey },
    }),

  adminGet: (adminKey: string, id: string) =>
    requestJson<{ conversation: AdminChatSummary; messages: ChatMessage[] }>(`${API_BASE}/admin/conversations/${encodeURIComponent(id)}`, {
      headers: { 'x-admin-key': adminKey },
    }),

  adminReply: (adminKey: string, id: string, body: string) =>
    requestJson<{ message: ChatMessage; visitorEmailed: boolean }>(`${API_BASE}/admin/conversations/${encodeURIComponent(id)}/reply`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: JSON.stringify({ body }),
    }),

  adminSettings: (adminKey: string, id: string, settings: { aiEnabled?: boolean; status?: 'open' | 'closed' }) =>
    requestJson<{ conversation: AdminChatSummary }>(`${API_BASE}/admin/conversations/${encodeURIComponent(id)}/settings`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: JSON.stringify(settings),
    }),
};
