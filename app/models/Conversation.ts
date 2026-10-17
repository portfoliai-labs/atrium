// models/Conversation.ts
// Aligned with ianus' /v1/conversations (colloquium's chat between an advisor and each client), camelCase.

export type ParticipantRole = "advisor" | "client";

// open: the advisor and the client are linked, both write; closed: the relation ended, both read.
export type ConversationStatus = "open" | "closed";

export interface Participant {
  userUuid: string;
  role: ParticipantRole;
  // Null when the account has none (or no longer exists).
  firstName: string | null;
  lastName: string | null;
  profilePicture: string | null;
}

export interface ChatMessage {
  messageUuid: string;
  conversationUuid: string;
  senderUuid: string;
  text: string;
  sentAt: string;
  // Set on the message the investor sent with their request: the conversation's first.
  advisorRequestUuid: string | null;
}

export interface ReadReceipt {
  conversationUuid: string;
  readerUuid: string;
  lastReadMessageUuid: string;
  readAt: string;
}

export interface Conversation {
  conversationUuid: string;
  status: ConversationStatus;
  // The caller's part in it.
  role: ParticipantRole;
  counterpart: Participant;
  lastMessage: ChatMessage | null;
  // The other party's messages the caller hasn't read.
  unreadCount: number;
  // How far the other party has read; null until they first read it.
  counterpartRead: ReadReceipt | null;
  createdAt: string;
  closedAt: string | null;
}

export interface MessagePage {
  // Oldest first.
  messages: ChatMessage[];
  // Whether older messages precede the page.
  hasMore: boolean;
}

export interface UnreadCount {
  unreadMessages: number;
  unreadConversations: number;
}

// One event of the live stream (GET /conversations/stream): its `type` names which field is set.
export type ConversationEvent =
  | { type: "message_sent"; message: ChatMessage }
  | { type: "read"; receipt: ReadReceipt }
  | { type: "conversation_changed"; conversationUuid: string; status: ConversationStatus };
