"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCheck, Loader2, Lock, MessagesSquare, Send } from "lucide-react";
import { conversationService } from "../../services/conversationService";
import { ApiError } from "../../services/apiClient";
import { useUser } from "../../context/UserContext";
import type { ChatMessage, Conversation, ConversationEvent, Participant } from "../../models/Conversation";

const SERIF = { fontFamily: "'Playfair Display', Georgia, serif" };
const CARD_CLASS = "bg-white rounded-4xl border border-[rgba(196,154,60,0.2)] shadow-sm";
// colloquium's limit on a message's text.
const MESSAGE_MAX_LENGTH = 4000;

/**
 * MESSAGES — the chat between an advisor and each of their clients (colloquium, through ianus).
 * A conversation opens when the advisor takes the client on (an accepted request's message is its
 * first) and closes, read-only, when the relation ends; nothing in it is ever deleted. New
 * messages, the other party's reads and a conversation opening or closing arrive live (SSE).
 */
export function MessagesSection() {
  const { user } = useUser();
  const me = user?.uuid ?? "";
  const isAdvisor = user?.role === "ADVISOR";

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const current = conversations.find((c) => c.conversationUuid === selected) ?? null;

  // Bumped to read the conversations again (one opened or closed).
  const [version, setVersion] = useState(0);
  const loadConversations = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let current = true;
    conversationService.list()
      .then((found) => { if (current) setConversations(found); })
      .catch((err) => {
        console.error(err);
        if (current) setError("We couldn't load your conversations. Please try again.");
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [version]);

  // Marks the conversation read up to the message, and clears its unread count here.
  const markRead = useCallback((conversationUuid: string, messageUuid: string) => {
    setConversations((list) => list.map((c) => (c.conversationUuid === conversationUuid ? { ...c, unreadCount: 0 } : c)));
    conversationService.markRead(conversationUuid, messageUuid).catch((err) => console.error(err));
  }, []);

  const open = useCallback(async (conversationUuid: string) => {
    selectedRef.current = conversationUuid;
    setSelected(conversationUuid);
    setMessages([]);
    setHasMore(false);
    setError(null);
    setLoadingThread(true);
    try {
      const page = await conversationService.messages(conversationUuid);
      if (selectedRef.current !== conversationUuid) return;
      setMessages(page.messages);
      setHasMore(page.hasMore);
      const last = page.messages[page.messages.length - 1];
      if (last) markRead(conversationUuid, last.messageUuid);
    } catch (err) {
      console.error(err);
      setError("We couldn't load this conversation. Please try again.");
    } finally {
      setLoadingThread(false);
    }
  }, [markRead]);

  const loadEarlier = async () => {
    if (!selected || messages.length === 0) return;
    try {
      const page = await conversationService.messages(selected, messages[0].messageUuid);
      setMessages((shown) => [...page.messages, ...shown]);
      setHasMore(page.hasMore);
    } catch (err) {
      console.error(err);
      setError("We couldn't load the earlier messages. Please try again.");
    }
  };

  // A message, in the thread when it is the open conversation's, and in the list.
  const received = useCallback((message: ChatMessage) => {
    const isOpen = selectedRef.current === message.conversationUuid;
    if (isOpen) {
      setMessages((shown) => (shown.some((m) => m.messageUuid === message.messageUuid) ? shown : [...shown, message]));
      if (message.senderUuid !== me) markRead(message.conversationUuid, message.messageUuid);
    }
    setConversations((list) => {
      const found = list.find((c) => c.conversationUuid === message.conversationUuid);
      if (!found) return list;
      if (found.lastMessage?.messageUuid === message.messageUuid) return list;
      const unread = !isOpen && message.senderUuid !== me ? found.unreadCount + 1 : found.unreadCount;
      const updated = { ...found, lastMessage: message, unreadCount: unread };
      return [updated, ...list.filter((c) => c !== found)];
    });
  }, [me, markRead]);

  // The live stream: reconnects (with a new ticket) after an error, until the section closes.
  useEffect(() => {
    if (!me) return;
    let closed = false;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      try {
        const url = await conversationService.streamUrl();
        if (closed) return;
        source = new EventSource(url);
        source.onmessage = (raw) => {
          const event = JSON.parse(raw.data) as ConversationEvent;
          if (event.type === "message_sent") {
            received(event.message);
          } else if (event.type === "read") {
            if (event.receipt.readerUuid === me) return;
            setConversations((list) => list.map((c) => (
              c.conversationUuid === event.receipt.conversationUuid ? { ...c, counterpartRead: event.receipt } : c
            )));
          } else {
            loadConversations();
          }
        };
        source.onerror = () => {
          source?.close();
          if (!closed) retry = setTimeout(connect, 5000);
        };
      } catch (err) {
        console.error(err);
        if (!closed) retry = setTimeout(connect, 15000);
      }
    };
    connect();
    const handleUnauthorized = () => { closed = true; source?.close(); };
    window.addEventListener("auth-unauthorized", handleUnauthorized);
    return () => {
      closed = true;
      source?.close();
      if (retry) clearTimeout(retry);
      window.removeEventListener("auth-unauthorized", handleUnauthorized);
    };
  }, [me, received, loadConversations]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, selected]);

  const send = async () => {
    const text = draft.trim();
    if (!current || !text || sending) return;
    setSending(true);
    setError(null);
    try {
      received(await conversationService.send(current.conversationUuid, crypto.randomUUID(), text));
      setDraft("");
    } catch (err) {
      console.error(err);
      if (err instanceof ApiError && err.errorType === "ConversationClosedError") {
        setError("This conversation is closed: you can read it, but no longer write in it.");
        loadConversations();
      } else {
        setError(err instanceof ApiError ? err.message : "Your message wasn't sent. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  // The last of my messages the other party has read up to, if any.
  const seenUpTo = (() => {
    const read = current?.counterpartRead?.lastReadMessageUuid;
    const index = read ? messages.findIndex((m) => m.messageUuid === read) : -1;
    for (let i = index; i >= 0; i--) if (messages[i].senderUuid === me) return messages[i].messageUuid;
    return null;
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-[#C49A3C]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-[#1c1917] tracking-tight flex items-center gap-2.5" style={SERIF}>
          <MessagesSquare className="w-6 h-6 text-[#C49A3C]" />
          Messages
        </h2>
        <p className="text-sm text-[#78716c] mt-1">
          {isAdvisor
            ? "Your conversations with your clients. One opens with each client you take on."
            : "Your conversation with your advisor. It opens once an advisor accepts your request."}
        </p>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm font-semibold text-red-700 bg-red-50 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      {conversations.length === 0 ? (
        <p className={`${CARD_CLASS} p-6 md:p-8 text-sm text-[#78716c]`}>
          {isAdvisor
            ? "No conversations yet: accept a request, or add a client, to start one."
            : "No conversations yet. Find an advisor and send them a request: once they accept, you can write to each other here."}
        </p>
      ) : (
        <div className={`${CARD_CLASS} overflow-hidden grid md:grid-cols-[18rem_1fr] min-h-[32rem]`}>
          <ul className={`${selected ? "hidden md:block" : ""} border-r border-[rgba(196,154,60,0.15)] overflow-y-auto max-h-[40rem]`}>
            {conversations.map((conversation) => {
              const active = conversation.conversationUuid === selected;
              return (
                <li key={conversation.conversationUuid}>
                  <button
                    onClick={() => open(conversation.conversationUuid)}
                    className={`w-full text-left px-5 py-4 border-b border-[rgba(196,154,60,0.1)] transition-colors ${
                      active ? "bg-[#F7F5EF]" : "hover:bg-[#FBFAF6]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#1c1917] truncate">{fullName(conversation.counterpart)}</span>
                      {conversation.unreadCount > 0 && (
                        <span className="text-xs font-bold bg-[#C49A3C] text-white rounded-full px-2 py-0.5 leading-none">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#78716c] truncate mt-1">
                      {conversation.status === "closed" && <Lock className="inline w-3 h-3 mr-1 -mt-0.5" />}
                      {conversation.lastMessage
                        ? `${conversation.lastMessage.senderUuid === me ? "You: " : ""}${conversation.lastMessage.text}`
                        : "No messages yet"}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>

          {current ? (
            <div className="flex flex-col max-h-[40rem]">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(196,154,60,0.15)]">
                <button onClick={() => { selectedRef.current = null; setSelected(null); }} className="md:hidden text-[#78716c]">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <p className="font-bold text-[#1c1917]">{fullName(current.counterpart)}</p>
                  <p className="text-xs text-[#78716c]">{current.counterpart.role === "advisor" ? "Your advisor" : "Your client"}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-[#FBFAF6]">
                {loadingThread && <Loader2 className="w-5 h-5 animate-spin text-[#C49A3C] mx-auto" />}
                {hasMore && (
                  <button onClick={loadEarlier} className="block mx-auto text-xs font-semibold text-[#C49A3C] hover:underline">
                    Load earlier messages
                  </button>
                )}
                {messages.map((message) => {
                  const mine = message.senderUuid === me;
                  return (
                    <div key={message.messageUuid} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                      {message.advisorRequestUuid && (
                        <span className="text-[11px] uppercase tracking-wide text-[#a8a29e] mb-1">Sent with the request</span>
                      )}
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line ${
                        mine ? "bg-[#1c1917] text-white" : "bg-white border border-[rgba(196,154,60,0.2)] text-[#1c1917]"
                      }`}>
                        {message.text}
                      </div>
                      <span className="text-[11px] text-[#a8a29e] mt-1 flex items-center gap-1">
                        {formatTime(message.sentAt)}
                        {message.messageUuid === seenUpTo && <><CheckCheck className="w-3 h-3" /> Seen</>}
                      </span>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {current.status === "closed" ? (
                <p className="flex items-center gap-2 px-5 py-4 text-sm text-[#78716c] border-t border-[rgba(196,154,60,0.15)]">
                  <Lock className="w-4 h-4" /> This conversation is closed: the advisory relationship ended. You can still read it.
                </p>
              ) : (
                <div className="flex items-end gap-3 px-5 py-4 border-t border-[rgba(196,154,60,0.15)]">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                    }}
                    maxLength={MESSAGE_MAX_LENGTH}
                    rows={2}
                    placeholder="Write a message…"
                    className="flex-1 resize-none rounded-2xl border border-[rgba(196,154,60,0.3)] px-4 py-2.5 text-sm focus:outline-none focus:border-[#C49A3C]"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !draft.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#C49A3C] hover:bg-[#b08930] disabled:opacity-50 transition-colors"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden md:flex items-center justify-center text-sm text-[#78716c]">Choose a conversation.</div>
          )}
        </div>
      )}
    </div>
  );
}

function fullName(participant: Participant): string {
  const name = [participant.firstName, participant.lastName].filter(Boolean).join(" ");
  return name || (participant.role === "advisor" ? "Your advisor" : "A client");
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
