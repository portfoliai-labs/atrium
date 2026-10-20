// services/conversationService.ts
import type { AssistantConversation, ChatMessage, Conversation, MessagePage, ReadReceipt, UnreadCount } from "../models/Conversation";
import { apiFetch } from "./apiClient";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export const conversationService = {
  // GET /conversations?kind=advisor_client — the caller's with their advisor or clients, the last
  // active first.
  async list(): Promise<Conversation[]> {
    return apiFetch<Conversation[]>("/v1/conversations?kind=advisor_client");
  },

  // GET /conversations?kind=assistant — the caller's chats with the AI, the last active first.
  async listAssistant(): Promise<AssistantConversation[]> {
    return apiFetch<AssistantConversation[]>("/v1/conversations?kind=assistant");
  },

  // POST /conversations — opens a chat with the AI under a uuid of ours: a retry with the same
  // one is safe. 403 ReadOnlyAccountError for a demo account.
  async openAssistant(conversationUuid: string): Promise<AssistantConversation> {
    return apiFetch<AssistantConversation>("/v1/conversations", {
      method: "POST",
      body: JSON.stringify({ conversationUuid, kind: "assistant" }),
    });
  },

  // DELETE /conversations/{uuid} — final: its messages go with it.
  async remove(conversationUuid: string): Promise<void> {
    return apiFetch<void>(`/v1/conversations/${conversationUuid}`, { method: "DELETE" });
  },

  async unreadCount(): Promise<UnreadCount> {
    return apiFetch<UnreadCount>("/v1/conversations/unread-count");
  },

  // GET /conversations/{uuid}/messages — oldest first; `before` a message for the page before it.
  async messages(conversationUuid: string, before?: string): Promise<MessagePage> {
    const qs = before ? `?before=${encodeURIComponent(before)}` : "";
    return apiFetch<MessagePage>(`/v1/conversations/${conversationUuid}/messages${qs}`);
  },

  // POST /conversations/{uuid}/messages — idempotent by `messageUuid`: a retry with the same one
  // is safe. 409 ConversationClosedError once the relation ended, 422 InvalidMessageError.
  async send(conversationUuid: string, messageUuid: string, text: string): Promise<ChatMessage> {
    return apiFetch<ChatMessage>(`/v1/conversations/${conversationUuid}/messages`, {
      method: "POST",
      body: JSON.stringify({ messageUuid, text }),
    });
  },

  // POST /conversations/{uuid}/messages, to the AI — returns the question, stored; the answer
  // arrives on the stream. 409 AnswerInProgressError while it's still answering the last.
  async ask(conversationUuid: string, messageUuid: string, text: string): Promise<ChatMessage> {
    return apiFetch<ChatMessage>(`/v1/conversations/${conversationUuid}/messages`, {
      method: "POST",
      body: JSON.stringify({ messageUuid, text, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
  },

  // POST /conversations/{uuid}/read — never back. Not for a chat with the AI (409).
  async markRead(conversationUuid: string, messageUuid: string): Promise<ReadReceipt> {
    return apiFetch<ReadReceipt>(`/v1/conversations/${conversationUuid}/read`, {
      method: "POST",
      body: JSON.stringify({ messageUuid }),
    });
  },

  // The live stream's URL, behind a one-time ticket (an EventSource can't send the token).
  async streamUrl(): Promise<string> {
    const { ticket } = await apiFetch<{ ticket: string }>("/v1/conversations/ticket", { method: "POST" });
    return `${API_BASE_URL}/v1/conversations/stream?ticket=${encodeURIComponent(ticket)}`;
  },
};
