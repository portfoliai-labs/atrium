// services/conversationService.ts
import type { ChatMessage, Conversation, MessagePage, ReadReceipt, UnreadCount } from "../models/Conversation";
import { apiFetch } from "./apiClient";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export const conversationService = {
  // GET /conversations — the caller's, the last active first.
  async list(): Promise<Conversation[]> {
    return apiFetch<Conversation[]>("/conversations");
  },

  async unreadCount(): Promise<UnreadCount> {
    return apiFetch<UnreadCount>("/conversations/unread-count");
  },

  // GET /conversations/{uuid}/messages — oldest first; `before` a message for the page before it.
  async messages(conversationUuid: string, before?: string): Promise<MessagePage> {
    const qs = before ? `?before=${encodeURIComponent(before)}` : "";
    return apiFetch<MessagePage>(`/conversations/${conversationUuid}/messages${qs}`);
  },

  // POST /conversations/{uuid}/messages — idempotent by `messageUuid`: a retry with the same one
  // is safe. 409 ConversationClosedError once the relation ended, 422 InvalidMessageError.
  async send(conversationUuid: string, messageUuid: string, text: string): Promise<ChatMessage> {
    return apiFetch<ChatMessage>(`/conversations/${conversationUuid}/messages`, {
      method: "POST",
      body: JSON.stringify({ messageUuid, text }),
    });
  },

  // POST /conversations/{uuid}/read — never back.
  async markRead(conversationUuid: string, messageUuid: string): Promise<ReadReceipt> {
    return apiFetch<ReadReceipt>(`/conversations/${conversationUuid}/read`, {
      method: "POST",
      body: JSON.stringify({ messageUuid }),
    });
  },

  // The live stream's URL, behind a one-time ticket (an EventSource can't send the token).
  async streamUrl(): Promise<string> {
    const { ticket } = await apiFetch<{ ticket: string }>("/conversations/ticket", { method: "POST" });
    return `${API_BASE_URL}/conversations/stream?ticket=${encodeURIComponent(ticket)}`;
  },
};
