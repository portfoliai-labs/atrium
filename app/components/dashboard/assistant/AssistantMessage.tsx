"use client";

import { Loader2, Sparkles } from "lucide-react";
import { ApiError } from "../../../services/apiClient";
import type { ActionBlock, AnswerPiece, AnswerStop, AssistantAction, ChatMessage, MessageBlock } from "../../../models/Conversation";
import { MessageBlocks } from "./AnswerBlocks";

// The longest question the server takes.
export const QUESTION_MAX_LENGTH = 4000;

// An answer being written: its blocks so far, and what the AI is reading meanwhile.
export type Draft = { messageUuid: string; blocks: MessageBlock[]; progress: string | null };

const STOP_NOTES: Partial<Record<AnswerStop, string>> = {
  cut_short: "The answer was cut short.",
  out_of_reads: "Answered with what it could read.",
};

const FAILURES: Record<string, string> = {
  AI_PROVIDER_UNAVAILABLE: "The assistant's AI service is unavailable right now.",
  TOOLS_UNAVAILABLE: "The assistant couldn't read your data right now.",
  MODEL_NOT_CONFIGURED: "The assistant isn't set up yet.",
  ASSISTANT_UNAVAILABLE: "The assistant is unavailable right now.",
};

// The draft with the piece in it, or the same draft when the piece is of a kind not known here.
export function withPiece(before: Draft | undefined, messageUuid: string, piece: AnswerPiece): Draft | undefined {
  const draft: Draft = before?.messageUuid === messageUuid ? before : { messageUuid, blocks: [], progress: null };
  let blocks = draft.blocks;
  let progress: string | null = null;
  if (piece.type === "text") {
    const last = blocks[blocks.length - 1];
    blocks = last?.type === "text"
      ? [...blocks.slice(0, -1), { type: "text", text: last.text + piece.text }]
      : [...blocks, { type: "text", text: piece.text }];
  } else if (piece.type === "progress") {
    progress = piece.title ? `Reading: ${piece.title}…` : "Reading your data…";
  } else if (piece.type === "chart" && piece.chart) {
    blocks = [...blocks, { ...piece.chart, type: "chart" }];
  } else if (piece.type === "table" && piece.table) {
    blocks = [...blocks, { ...piece.table, type: "table" }];
  } else if (piece.type === "action" && piece.action) {
    blocks = [...blocks, actionBlock(piece.action)];
  } else {
    return before;
  }
  return { messageUuid, blocks, progress };
}

// The blocks with the action in place of the one of the same actionId; the same blocks when
// none is (so a caller can tell nothing changed).
export function withAction(blocks: MessageBlock[], action: AssistantAction): MessageBlock[] {
  if (!blocks.some((block) => block.type === "action" && block.actionId === action.actionId)) return blocks;
  return blocks.map((block) => (block.type === "action" && block.actionId === action.actionId ? actionBlock(action) : block));
}

// The stream leaves null fields out: an action from it fills them back.
function actionBlock(action: AssistantAction): ActionBlock {
  return {
    ...action, type: "action", details: action.details ?? [], failureReason: action.failureReason ?? null,
    failureMessage: action.failureMessage ?? null, documentId: action.documentId ?? null,
    downloadPath: action.downloadPath ?? null,
  };
}

export function answerFailedText(reason: string | undefined): string {
  return `${FAILURES[reason ?? ""] ?? "The assistant couldn't answer."} Nothing was saved: you can ask again.`;
}

export function askErrorText(err: unknown): string {
  if (!(err instanceof ApiError)) return "Your question wasn't sent. Please try again.";
  switch (err.errorType) {
    case "AnswerInProgressError": return "The assistant is still answering: wait for it to finish, then ask again.";
    case "InvalidMessageError": return `Your question can't be sent: up to ${QUESTION_MAX_LENGTH.toLocaleString()} characters.`;
    case "ConversationNotFoundError": return "This chat no longer exists.";
    case "ConversationUuidTakenError": return "This chat couldn't be started. Please ask again.";
    case "ReadOnlyAccountError": return "This is a demo account: the assistant isn't available on it.";
    default: return err.message || "Your question wasn't sent. Please try again.";
  }
}

// The user's question to the AI: as any message of theirs in Messages.
export function Question({ message }: { message: ChatMessage }) {
  return (
    <div className="flex flex-col items-end">
      <div className="max-w-[85%] rounded-3xl px-4 py-2.5 text-sm whitespace-pre-line bg-[#1c1917] text-white">{message.text}</div>
      <span className="text-[11px] text-[#78716c] mt-1">{formatTime(message.sentAt)}</span>
    </div>
  );
}

// An answer, marked as written by AI (AI Act, art. 50): whole, or being written (with what it's
// reading meanwhile). Not a bubble: the thread's whole width, its charts and tables with room.
export function Answer({ blocks, sentAt, stop, progress, writing = false, renderAction }: {
  blocks: MessageBlock[];
  sentAt?: string;
  stop?: AnswerStop | null;
  progress?: string | null;
  writing?: boolean;
  renderAction?: (action: ActionBlock) => React.ReactNode;
}) {
  const note = stop ? STOP_NOTES[stop] : undefined;
  return (
    <div className="flex gap-3">
      <span className="w-7 h-7 rounded-full bg-[#C49A3C]/10 text-[#C49A3C] flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-[#1c1917] space-y-3">
          {blocks.length > 0 && <MessageBlocks blocks={blocks} markdown renderAction={renderAction} />}
          {writing && (
            <p className="flex items-center gap-2 text-xs text-[#78716c]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C49A3C]" />
              {progress ?? (blocks.length > 0 ? "Writing…" : "The assistant is writing…")}
            </p>
          )}
          {note && <p className="text-xs italic text-[#78716c]">{note}</p>}
        </div>
        <span className="text-[11px] text-[#78716c] mt-1.5 flex items-center gap-1">
          {sentAt && <>{formatTime(sentAt)} ·</>} Written by AI
        </span>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
