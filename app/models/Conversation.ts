// models/Conversation.ts
// Aligned with ianus' /v1/conversations, camelCase: colloquium's chat between an advisor and each
// client (kind advisor_client), and the user's chats with the AI assistant (kind assistant).

export type ConversationKind = "advisor_client" | "assistant";

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

export interface ChartSeries {
  label: string;
  // A currency's ISO code, "%", or "" for a plain number.
  unit: string;
  // One per `x`; null where there's no value (a gap, never 0).
  values: (number | null)[];
}

export interface ChartBlock {
  type: "chart";
  chartType: "line" | "bar" | "stacked_bar" | "area" | "pie";
  title: string;
  x: string[];
  series: ChartSeries[];
}

export interface TableBlock {
  type: "table";
  title: string;
  // `unit` as a chart series'.
  columns: { label: string; unit: string }[];
  rows: (string | number | boolean | null)[][];
}

// Markdown in an answer, plain text from a person.
export interface TextBlock {
  type: "text";
  text: string;
}

// proposed → running (confirmed) → done or failed; proposed → cancelled, or expired once
// `expiresAt` passed unconfirmed.
export type ActionState = "proposed" | "running" | "done" | "failed" | "cancelled" | "expired";

// An action the assistant proposed (a report asked for): the model proposes, the user confirms,
// the domain acts. As it is now: its state changes arrive as `action_changed`.
export interface AssistantAction {
  // What the confirm and cancel routes name it by.
  actionId: string;
  // The tool as the platform names it (e.g. "scriba_request_report").
  tool: string;
  title: string;
  // What it would do, in the order a person reads it (e.g. "Portfolio": "Pension").
  details: { label: string; value: string }[];
  state: ActionState;
  // The domain's reason (e.g. "REPORT_ALREADY_EXISTS"), "JOB_FAILED"; null unless failed.
  failureReason: string | null;
  // What the user reads about the failure, when the domain wrote one.
  failureMessage: string | null;
  // The report it made, once done.
  documentId: string | null;
  // The route giving the report's download link (GET → { url }), once done.
  downloadPath: string | null;
  proposedAt: string;
  expiresAt: string;
}

export interface ActionBlock extends AssistantAction {
  type: "action";
}

export type MessageBlock = TextBlock | ChartBlock | TableBlock | ActionBlock;

// How an answer ended: answered; cut short; answered with what it could read. Null on a person's.
export type AnswerStop = "answered" | "cut_short" | "out_of_reads";

export interface ChatMessage {
  messageUuid: string;
  conversationUuid: string;
  // Null on the AI's answers.
  senderUuid: string | null;
  // The text blocks joined: for previews.
  text: string;
  // What to render, in order.
  blocks: MessageBlock[];
  answerStop: AnswerStop | null;
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
  kind: "advisor_client";
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

// A chat with the AI assistant: no read receipts, never unread.
export interface AssistantConversation {
  conversationUuid: string;
  kind: "assistant";
  // Null until the first answer.
  title: string | null;
  // Whether the AI is writing an answer.
  answering: boolean;
  counterpart: { role: "assistant"; userUuid: null };
  lastMessage: ChatMessage | null;
  createdAt: string;
}

// A piece of an answer being written: text to append, a status to show meanwhile (not part of
// the answer), or a chart or table to add.
export type AnswerPiece =
  | { type: "text"; text: string }
  | { type: "progress"; tool: string; title?: string }
  | { type: "chart"; chart: ChartBlock }
  | { type: "table"; table: TableBlock }
  | { type: "action"; action: AssistantAction };

// One event of the live stream (GET /conversations/stream): its `type` names which fields are set.
// Both kinds' events arrive on it; null fields are left out. New types may come: ignore them.
export type ConversationEvent =
  | { type: "message_sent"; message: ChatMessage }
  | { type: "read"; receipt: ReadReceipt }
  | { type: "conversation_changed"; conversationUuid: string; kind?: ConversationKind; status?: ConversationStatus; title?: string; answering?: boolean }
  | { type: "conversation_deleted"; conversationUuid: string }
  | { type: "answer_piece"; conversationUuid: string; messageUuid: string; piece: AnswerPiece }
  | { type: "answer_failed"; conversationUuid: string; messageUuid: string; reason?: string }
  // An action changed (confirmed, done, failed...): it replaces the answer's block of the same actionId.
  | { type: "action_changed"; conversationUuid: string; messageUuid: string; action: AssistantAction };
