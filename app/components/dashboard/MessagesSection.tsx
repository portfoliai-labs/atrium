"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCheck, Loader2, Lock, MessagesSquare, Send, Sparkles, Trash2 } from "lucide-react";
import { conversationService } from "../../services/conversationService";
import { ApiError } from "../../services/apiClient";
import { useUser } from "../../context/UserContext";
import { usePortfolio } from "../../context/PortfolioContext";
import { useWallets } from "../../context/WalletsContext";
import type {
  ActionBlock, AnswerPiece, AssistantAction, AssistantConversation, ChatMessage, Conversation, ConversationEvent,
  Participant,
} from "../../models/Conversation";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import { readAiChatView } from "../../lib/dashboardNav";
import { ConfirmDialog } from "./ConfirmDialog";
import { ActionCard } from "./assistant/ActionCard";
import {
  Answer, Draft, Question, QUESTION_MAX_LENGTH, answerFailedText, askErrorText, withAction, withPiece,
} from "./assistant/AssistantMessage";

const SERIF = { fontFamily: "'Playfair Display', Georgia, serif" };
const CARD_CLASS = "bg-white rounded-4xl border border-[rgba(196,154,60,0.2)] shadow-sm";
// colloquium's limit on a message's text.
const MESSAGE_MAX_LENGTH = 4000;

// The chat open: with a person (an advisor or a client), or with the AI (one of the list's, or a
// new one, not opened on the server until asked in).
type Selected = { kind: "people" | "ai"; uuid: string };

type Row =
  | { kind: "people"; conversation: Conversation; at: number }
  | { kind: "ai"; conversation: AssistantConversation; at: number };

/**
 * MESSAGES — every chat in one list, the last active first: the ones between an advisor and each
 * of their clients (colloquium, through ianus), and the user's with the AI assistant, on their own
 * data (kind assistant; not a demo account's), started from the list's first row
 * (New chat with the assistant), the top bar's ✨ or a widget's (AiHelpButton): a new one open, see
 * readAiChatView. Both kinds look alike.
 * - With a person: opens when the advisor takes the client on (an accepted request's message is
 *   its first) and closes, read-only, when the relation ends; nothing in it is ever deleted.
 * - With the AI: opened under a uuid made here, on its first question. The answer is written live
 *   on the stream, piece by piece, then arrives whole; every answer is marked as the AI's (AI Act,
 *   art. 50). Its title is the AI's, after the first answer; its deletion is final.
 * New messages, the other party's reads and changes to the chats arrive live (SSE).
 */
export function MessagesSection() {
  const { user, isDemo } = useUser();
  const me = user?.uuid ?? "";
  const isAdvisor = user?.role === "ADVISOR";

  const [people, setPeople] = useState<Conversation[]>([]);
  const [chats, setChats] = useState<AssistantConversation[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [loadingChats, setLoadingChats] = useState(!isDemo);
  // Opened on a new AI chat (the top bar's AI button, or a widget's, with its question).
  const [opening] = useState(() => (isDemo ? null : readAiChatView(readDashboardEntry()?.view)));
  const [selected, setSelected] = useState<Selected | null>(() => (opening ? { kind: "ai", uuid: crypto.randomUUID() } : null));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  // The AI's answers being written, by chat.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AssistantConversation | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const selectedRef = useRef<Selected | null>(selected);
  // The chats listed, by kind, for the stream.
  const peopleRef = useRef<Set<string>>(new Set());
  const chatsRef = useRef<Set<string>>(new Set());
  // The question last sent and its uuid: sending it again (after a failure) is a retry, safe.
  const pendingRef = useRef<{ conversationUuid: string; text: string; messageUuid: string } | null>(null);
  // The AI chats whose answer failed while their question was being sent: not answering after all.
  const failedRef = useRef<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { peopleRef.current = new Set(people.map((c) => c.conversationUuid)); }, [people]);
  useEffect(() => { chatsRef.current = new Set(chats.map((c) => c.conversationUuid)); }, [chats]);

  // A new AI chat from the top bar or a widget is opened once: going back here shows the list.
  useEffect(() => {
    const entry = readDashboardEntry();
    if (entry?.section === "messages" && entry.view !== undefined) pushDashboardEntry({ section: "messages" }, true);
  }, []);

  // Bumped to read each list again.
  const [peopleVersion, setPeopleVersion] = useState(0);
  const [chatsVersion, setChatsVersion] = useState(0);
  const loadPeople = useCallback(() => setPeopleVersion((v) => v + 1), []);
  const loadChats = useCallback(() => setChatsVersion((v) => v + 1), []);

  useEffect(() => {
    let live = true;
    conversationService.list()
      .then((found) => { if (live) setPeople(found); })
      .catch((err) => {
        console.error(err);
        if (live) setError("We couldn't load your conversations. Please try again.");
      })
      .finally(() => { if (live) setLoadingPeople(false); });
    return () => { live = false; };
  }, [peopleVersion]);

  useEffect(() => {
    if (isDemo) return;
    let live = true;
    conversationService.listAssistant()
      .then((found) => { if (live) setChats(found); })
      .catch((err) => {
        console.error(err);
        if (live) setError("We couldn't load your chats with the assistant. Please try again.");
      })
      .finally(() => { if (live) setLoadingChats(false); });
    return () => { live = false; };
  }, [chatsVersion, isDemo]);

  // Marks the conversation read up to the message, and clears its unread count here.
  const markRead = useCallback((conversationUuid: string, messageUuid: string) => {
    setPeople((list) => list.map((c) => (c.conversationUuid === conversationUuid ? { ...c, unreadCount: 0 } : c)));
    conversationService.markRead(conversationUuid, messageUuid).catch((err) => console.error(err));
  }, []);

  const patchChat = useCallback((conversationUuid: string, change: Partial<AssistantConversation>) => {
    setChats((list) => list.map((c) => (c.conversationUuid === conversationUuid ? { ...c, ...change } : c)));
  }, []);

  const dropDraft = useCallback((conversationUuid: string) => {
    setDrafts((all) => {
      if (!(conversationUuid in all)) return all;
      const rest = { ...all };
      delete rest[conversationUuid];
      return rest;
    });
  }, []);

  const applyPiece = useCallback((conversationUuid: string, messageUuid: string, piece: AnswerPiece) => {
    setDrafts((all) => {
      const next = withPiece(all[conversationUuid], messageUuid, piece);
      return next && next !== all[conversationUuid] ? { ...all, [conversationUuid]: next } : all;
    });
  }, []);

  // An action as it is now (the user's click, or `action_changed`): in place of its block, in the
  // open chat's answers or in the answer being written.
  const applyAction = useCallback((conversationUuid: string, action: AssistantAction) => {
    if (selectedRef.current?.uuid === conversationUuid) {
      setMessages((shown) => shown.map((message) => {
        const blocks = withAction(message.blocks, action);
        return blocks === message.blocks ? message : { ...message, blocks };
      }));
    }
    setDrafts((all) => {
      const draft = all[conversationUuid];
      if (!draft) return all;
      const blocks = withAction(draft.blocks, action);
      return blocks === draft.blocks ? all : { ...all, [conversationUuid]: { ...draft, blocks } };
    });
  }, []);

  const loadThread = useCallback(async (chat: Selected) => {
    setLoadingThread(true);
    try {
      const page = await conversationService.messages(chat.uuid);
      if (selectedRef.current?.uuid !== chat.uuid) return;
      setMessages(page.messages);
      setHasMore(page.hasMore);
      const last = page.messages[page.messages.length - 1];
      if (chat.kind === "people" && last) markRead(chat.uuid, last.messageUuid);
    } catch (err) {
      console.error(err);
      if (selectedRef.current?.uuid === chat.uuid) setError("We couldn't load this conversation. Please try again.");
    } finally {
      if (selectedRef.current?.uuid === chat.uuid) setLoadingThread(false);
    }
  }, [markRead]);

  const select = (chat: Selected | null) => {
    selectedRef.current = chat;
    setSelected(chat);
    setMessages([]);
    setHasMore(false);
    setError(null);
    setLoadingThread(false);
    setText("");
  };

  const open = (chat: Selected) => {
    select(chat);
    loadThread(chat);
  };

  const newAiChat = () => select({ kind: "ai", uuid: crypto.randomUUID() });

  const loadEarlier = async () => {
    if (!selected || messages.length === 0) return;
    try {
      const page = await conversationService.messages(selected.uuid, messages[0].messageUuid);
      setMessages((shown) => [...page.messages, ...shown]);
      setHasMore(page.hasMore);
    } catch (err) {
      console.error(err);
      setError("We couldn't load the earlier messages. Please try again.");
    }
  };

  // A message with a person: in the thread when its conversation is open (read, then), and its
  // conversation's last in the list (moved first).
  const receivedFromPerson = useCallback((message: ChatMessage) => {
    const isOpen = selectedRef.current?.uuid === message.conversationUuid;
    if (isOpen) {
      setMessages((shown) => withMessage(shown, message));
      if (message.senderUuid !== me) markRead(message.conversationUuid, message.messageUuid);
    }
    setPeople((list) => {
      const found = list.find((c) => c.conversationUuid === message.conversationUuid);
      if (!found) return list;
      if (found.lastMessage?.messageUuid === message.messageUuid) return list;
      const unread = !isOpen && message.senderUuid !== me ? found.unreadCount + 1 : found.unreadCount;
      const updated = { ...found, lastMessage: message, unreadCount: unread };
      return [updated, ...list.filter((c) => c !== found)];
    });
  }, [me, markRead]);

  // A message with the AI, likewise. A question, the latest, means an answer is on its way; an
  // answer, that it's done.
  const receivedFromAi = useCallback((message: ChatMessage) => {
    if (selectedRef.current?.uuid === message.conversationUuid) setMessages((shown) => withMessage(shown, message));
    const isAnswer = message.senderUuid === null;
    if (isAnswer) dropDraft(message.conversationUuid);
    setChats((list) => {
      const found = list.find((c) => c.conversationUuid === message.conversationUuid);
      if (!found) return list;
      const newer = !found.lastMessage || found.lastMessage.sentAt <= message.sentAt;
      const answering = isAnswer ? false : newer || found.answering;
      const updated = { ...found, answering, lastMessage: newer ? message : found.lastMessage };
      return [updated, ...list.filter((c) => c !== found)];
    });
  }, [dropDraft]);

  // The live stream, both kinds' events on it. Reconnects with a new ticket after an error; once
  // back, reads the lists and the open chat again, for what was missed meanwhile.
  useEffect(() => {
    if (!me) return;
    let closed = false;
    let connectedBefore = false;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const handle = (event: ConversationEvent) => {
      const isPerson = (uuid: string) => peopleRef.current.has(uuid);
      const isChat = (uuid: string) => chatsRef.current.has(uuid);
      switch (event.type) {
        case "message_sent": {
          // The stream leaves null fields out: an answer comes without its senderUuid.
          const message: ChatMessage = {
            ...event.message,
            senderUuid: event.message.senderUuid ?? null,
            blocks: event.message.blocks ?? [],
            answerStop: event.message.answerStop ?? null,
            advisorRequestUuid: event.message.advisorRequestUuid ?? null,
          };
          if (isPerson(message.conversationUuid)) receivedFromPerson(message);
          else if (isChat(message.conversationUuid)) receivedFromAi(message);
          // An answer in an AI chat opened elsewhere: it's listed now.
          else if (message.senderUuid === null && !isDemo) loadChats();
          return;
        }
        case "read":
          if (event.receipt.readerUuid === me || !isPerson(event.receipt.conversationUuid)) return;
          setPeople((list) => list.map((c) => (
            c.conversationUuid === event.receipt.conversationUuid ? { ...c, counterpartRead: event.receipt } : c
          )));
          return;
        case "conversation_changed":
          if (isPerson(event.conversationUuid)) {
            loadPeople();
          } else if (isChat(event.conversationUuid)) {
            const change: Partial<AssistantConversation> = {};
            if (event.title !== undefined) change.title = event.title;
            if (event.answering !== undefined) change.answering = event.answering;
            patchChat(event.conversationUuid, change);
          } else if (event.kind === "assistant" || event.title !== undefined) {
            if (!isDemo) loadChats();
          } else {
            // A conversation with a person opening.
            loadPeople();
          }
          return;
        case "conversation_deleted":
          if (!isChat(event.conversationUuid)) return;
          setChats((list) => list.filter((c) => c.conversationUuid !== event.conversationUuid));
          dropDraft(event.conversationUuid);
          if (selectedRef.current?.uuid === event.conversationUuid) {
            selectedRef.current = null;
            setSelected(null);
            setError("This chat was deleted.");
          }
          return;
        case "answer_piece":
          if (!isChat(event.conversationUuid) || !event.piece) return;
          applyPiece(event.conversationUuid, event.messageUuid, event.piece);
          return;
        case "action_changed":
          if (!isChat(event.conversationUuid) || !event.action) return;
          applyAction(event.conversationUuid, event.action);
          return;
        case "answer_failed":
          if (!isChat(event.conversationUuid)) return;
          failedRef.current.add(event.conversationUuid);
          dropDraft(event.conversationUuid);
          patchChat(event.conversationUuid, { answering: false });
          if (selectedRef.current?.uuid === event.conversationUuid) setError(answerFailedText(event.reason));
          return;
        default:
          // Types this page doesn't know.
          return;
      }
    };

    const connect = async () => {
      try {
        const url = await conversationService.streamUrl();
        if (closed) return;
        source = new EventSource(url);
        source.onopen = () => {
          if (connectedBefore) {
            loadPeople();
            if (!isDemo) loadChats();
            const open = selectedRef.current;
            if (open && (peopleRef.current.has(open.uuid) || chatsRef.current.has(open.uuid))) loadThread(open);
          }
          connectedBefore = true;
        };
        source.onmessage = (raw) => {
          let event: ConversationEvent;
          try { event = JSON.parse(raw.data) as ConversationEvent; } catch { return; }
          handle(event);
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
  }, [me, isDemo, receivedFromPerson, receivedFromAi, applyPiece, applyAction, dropDraft, patchChat, loadPeople, loadChats, loadThread]);

  const isAi = selected?.kind === "ai";
  // An answer's action, as a card the user confirms or cancels in this chat.
  const renderAction = (action: ActionBlock, writing = false) => selected && (
    <ActionCard
      action={action} conversationUuid={selected.uuid} writing={writing}
      onChange={(next) => applyAction(selected.uuid, next)}
    />
  );
  const person = selected?.kind === "people" ? people.find((c) => c.conversationUuid === selected.uuid) ?? null : null;
  const chat = isAi ? chats.find((c) => c.conversationUuid === selected.uuid) ?? null : null;
  const draft = isAi ? drafts[selected.uuid] ?? null : null;
  const answering = !!draft || !!chat?.answering;

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, selected, draft]);

  const sendToPerson = async () => {
    const message = text.trim();
    if (!person || !message || sending) return;
    setSending(true);
    setError(null);
    try {
      receivedFromPerson(await conversationService.send(person.conversationUuid, crypto.randomUUID(), message));
      setText("");
    } catch (err) {
      console.error(err);
      if (err instanceof ApiError && err.errorType === "ConversationClosedError") {
        setError("This conversation is closed: you can read it, but no longer write in it.");
        loadPeople();
      } else {
        setError(err instanceof ApiError ? err.message : "Your message wasn't sent. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  const ask = async (asked = text) => {
    const question = asked.trim();
    if (!selected || selected.kind !== "ai" || !question || sending || answering) return;
    const conversationUuid = selected.uuid;
    const pending = pendingRef.current;
    const messageUuid = pending && pending.conversationUuid === conversationUuid && pending.text === question
      ? pending.messageUuid
      : crypto.randomUUID();
    pendingRef.current = { conversationUuid, text: question, messageUuid };
    setSending(true);
    setError(null);
    failedRef.current.delete(conversationUuid);
    try {
      // A new chat is opened first (safe to repeat: the uuid is ours).
      if (!chatsRef.current.has(conversationUuid)) {
        const opened = await conversationService.openAssistant(conversationUuid);
        chatsRef.current.add(conversationUuid);
        setChats((list) => (list.some((c) => c.conversationUuid === conversationUuid) ? list : [opened, ...list]));
      }
      const stored = await conversationService.ask(conversationUuid, messageUuid, question);
      receivedFromAi(stored);
      if (failedRef.current.has(conversationUuid)) patchChat(conversationUuid, { answering: false });
      pendingRef.current = null;
      if (selectedRef.current?.uuid === conversationUuid) setText("");
    } catch (err) {
      console.error(err);
      setError(askErrorText(err));
      if (err instanceof ApiError) {
        if (err.errorType === "AnswerInProgressError") patchChat(conversationUuid, { answering: true });
        if (err.errorType === "ConversationNotFoundError") { loadChats(); select(null); }
        // Someone else's uuid, unlikely as it is: this chat under a new one.
        if (err.errorType === "ConversationUuidTakenError") newAiChat();
      }
    } finally {
      setSending(false);
    }
  };

  const send = () => (isAi ? ask() : sendToPerson());
  const suggestions = useSuggestions();

  // A widget's question, sent once the chats are known (StrictMode's second run sends nothing).
  const askedRef = useRef(false);
  useEffect(() => {
    if (!opening?.question || loadingChats || askedRef.current) return;
    askedRef.current = true;
    ask(opening.question);
    // Once, with the question it opened on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingChats]);

  const confirmDelete = async () => {
    if (!deleting) return;
    const { conversationUuid } = deleting;
    setDeletingBusy(true);
    setDeleteError(null);
    try {
      await conversationService.remove(conversationUuid);
      setChats((list) => list.filter((c) => c.conversationUuid !== conversationUuid));
      dropDraft(conversationUuid);
      if (selectedRef.current?.uuid === conversationUuid) select(null);
      setDeleting(null);
    } catch (err) {
      console.error(err);
      if (err instanceof ApiError && err.errorType === "ConversationNotFoundError") {
        setChats((list) => list.filter((c) => c.conversationUuid !== conversationUuid));
        if (selectedRef.current?.uuid === conversationUuid) select(null);
        setDeleting(null);
      } else {
        setDeleteError("We couldn't delete this chat. Please try again.");
      }
    } finally {
      setDeletingBusy(false);
    }
  };

  // The last of my messages the other party has read up to, if any.
  const seenUpTo = (() => {
    const read = person?.counterpartRead?.lastReadMessageUuid;
    const index = read ? messages.findIndex((m) => m.messageUuid === read) : -1;
    for (let i = index; i >= 0; i--) if (messages[i].senderUuid === me) return messages[i].messageUuid;
    return null;
  })();

  if (loadingPeople || loadingChats) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-[#C49A3C]" />
      </div>
    );
  }

  const rows: Row[] = [
    ...people.map((conversation) => ({
      kind: "people" as const, conversation, at: Date.parse(conversation.lastMessage?.sentAt ?? conversation.createdAt),
    })),
    ...chats.map((conversation) => ({
      kind: "ai" as const, conversation, at: Date.parse(conversation.lastMessage?.sentAt ?? conversation.createdAt),
    })),
  ].sort((a, b) => b.at - a.at);
  const isNewChat = isAi && !chat;

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
          {!isDemo && " You can also ask the AI assistant about your own data."}
        </p>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm font-semibold text-red-700 bg-red-50 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      {rows.length === 0 && isDemo ? (
        <p className={`${CARD_CLASS} p-6 md:p-8 text-sm text-[#78716c]`}>
          {isAdvisor
            ? "No conversations yet: accept a request, or add a client, to start one."
            : "No conversations yet. Find an advisor and send them a request: once they accept, you can write to each other here."}
        </p>
      ) : (
        <div className={`${CARD_CLASS} overflow-hidden grid md:grid-cols-[18rem_1fr] min-h-[32rem]`}>
          <ul className={`${selected ? "hidden md:block" : ""} border-r border-[rgba(196,154,60,0.15)] overflow-y-auto max-h-[40rem]`}>
            {/* Always first: a new chat with the AI (lit while it's the one open, not yet asked in). */}
            {!isDemo && (
              <li>
                <button
                  onClick={newAiChat}
                  className={`w-full flex items-center gap-2 px-5 py-4 border-b border-[rgba(196,154,60,0.1)] text-left transition-colors ${
                    isNewChat ? "bg-[#F7F5EF]" : "hover:bg-[#FBFAF6]"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#C49A3C]" />
                  <span className="font-bold text-[#1c1917] truncate">New chat with the assistant</span>
                </button>
              </li>
            )}
            {rows.map((row) => {
              const active = row.conversation.conversationUuid === selected?.uuid;
              if (row.kind === "people") {
                const conversation = row.conversation;
                return (
                  <li key={conversation.conversationUuid}>
                    <button
                      onClick={() => open({ kind: "people", uuid: conversation.conversationUuid })}
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
              }
              const conversation = row.conversation;
              return (
                <li key={conversation.conversationUuid} className="group relative border-b border-[rgba(196,154,60,0.1)]">
                  <button
                    onClick={() => open({ kind: "ai", uuid: conversation.conversationUuid })}
                    className={`w-full text-left pl-5 pr-12 py-4 transition-colors ${active ? "bg-[#F7F5EF]" : "hover:bg-[#FBFAF6]"}`}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#C49A3C]" />
                      <span className="font-bold text-[#1c1917] truncate">{conversation.title ?? "New chat"}</span>
                    </span>
                    <span className="block text-xs text-[#78716c] truncate mt-1">
                      {conversation.answering
                        ? "The assistant is writing…"
                        : conversation.lastMessage
                          ? `${conversation.lastMessage.senderUuid === null ? "" : "You: "}${conversation.lastMessage.text}`
                          : "No messages yet"}
                    </span>
                  </button>
                  <button
                    onClick={() => { setDeleteError(null); setDeleting(conversation); }}
                    title="Delete this chat"
                    aria-label="Delete this chat"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-[#857e78] hover:text-rose-600 hover:bg-rose-50 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>

          {selected && (person || isAi) ? (
            <div className="flex flex-col max-h-[40rem] min-w-0">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(196,154,60,0.15)]">
                <button onClick={() => select(null)} className="md:hidden text-[#78716c]" aria-label="Back to your conversations">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {person ? (
                  <div>
                    <p className="font-bold text-[#1c1917]">{fullName(person.counterpart)}</p>
                    <p className="text-xs text-[#78716c]">{person.counterpart.role === "advisor" ? "Your advisor" : "Your client"}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#1c1917] truncate">{chat?.title ?? "New chat"}</p>
                      <p className="text-xs text-[#78716c] truncate">AI assistant · Its answers are written by AI: check what matters before acting on it.</p>
                    </div>
                    {chat && (
                      <button
                        onClick={() => { setDeleteError(null); setDeleting(chat); }}
                        title="Delete this chat"
                        aria-label="Delete this chat"
                        className="p-2 rounded-lg text-[#857e78] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-[#FBFAF6]">
                {loadingThread && <Loader2 className="w-5 h-5 animate-spin text-[#C49A3C] mx-auto" />}
                {hasMore && (
                  <button onClick={loadEarlier} className="block mx-auto text-xs font-semibold text-[#C49A3C] hover:underline">
                    Load earlier messages
                  </button>
                )}
                {isNewChat && messages.length === 0 && (
                  <p className="text-sm text-[#78716c] text-center py-10">
                    Ask about your portfolios, wallets or spending: the assistant reads your data to answer.
                  </p>
                )}
                {messages.map((message) => {
                  if (isAi) {
                    return message.senderUuid === null
                      ? <Answer key={message.messageUuid} blocks={message.blocks} sentAt={message.sentAt} stop={message.answerStop} renderAction={renderAction} />
                      : <Question key={message.messageUuid} message={message} />;
                  }
                  const mine = message.senderUuid === me;
                  return (
                    <div key={message.messageUuid} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                      {message.advisorRequestUuid && (
                        <span className="text-[11px] uppercase tracking-wide text-[#857e78] mb-1">Sent with the request</span>
                      )}
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line ${
                        mine ? "bg-[#1c1917] text-white" : "bg-white border border-[rgba(196,154,60,0.2)] text-[#1c1917]"
                      }`}>
                        {message.text}
                      </div>
                      <span className="text-[11px] text-[#857e78] mt-1 flex items-center gap-1">
                        {formatTime(message.sentAt)}
                        {message.messageUuid === seenUpTo && <><CheckCheck className="w-3 h-3" /> Seen</>}
                      </span>
                    </div>
                  );
                })}
                {draft ? (
                  <Answer blocks={draft.blocks} progress={draft.progress} writing renderAction={(action) => renderAction(action, true)} />
                ) : chat?.answering ? (
                  <Answer blocks={[]} writing />
                ) : null}
                <div ref={bottomRef} />
              </div>

              {/* A new chat's first question, a click away: sent as it is. */}
              {isNewChat && messages.length === 0 && !answering && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 px-5 pt-3 bg-[#FBFAF6]">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void ask(s)}
                      disabled={sending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[rgba(196,154,60,0.35)] bg-white text-xs font-semibold text-[#57534e] hover:border-[#C49A3C] hover:text-[#1c1917] transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="w-3 h-3 text-[#C49A3C]" />
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {person?.status === "closed" ? (
                <p className="flex items-center gap-2 px-5 py-4 text-sm text-[#78716c] border-t border-[rgba(196,154,60,0.15)]">
                  <Lock className="w-4 h-4" /> This conversation is closed: the advisory relationship ended. You can still read it.
                </p>
              ) : (
                <div className="flex items-end gap-3 px-5 py-4 border-t border-[rgba(196,154,60,0.15)]">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                    }}
                    maxLength={isAi ? QUESTION_MAX_LENGTH : MESSAGE_MAX_LENGTH}
                    rows={2}
                    disabled={isAi && answering}
                    placeholder={isAi ? (answering ? "The assistant is writing…" : "Ask the assistant…") : "Write a message…"}
                    className="flex-1 resize-none rounded-2xl border border-[rgba(196,154,60,0.3)] px-4 py-2.5 text-sm focus:outline-none focus:border-[#C49A3C] disabled:bg-[#F7F5EF] disabled:text-[#857e78]"
                  />
                  <button
                    onClick={send}
                    disabled={sending || (isAi && answering) || !text.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white bg-[#C49A3C] hover:bg-[#b08930] disabled:opacity-50 transition-colors"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {isAi ? "Ask" : "Send"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden md:flex items-center justify-center text-sm text-[#78716c]">Choose a conversation.</div>
          )}
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this chat?"
          description={`"${deleting.title ?? "New chat"}" and all its messages will be deleted for good. This can't be undone.`}
          confirming={deletingBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

/**
 * What a new chat with the assistant offers to ask first, as the user's data allows: the investments
 * (and, with two portfolios or more, comparing them), and with wallets the savings and the spending.
 */
function useSuggestions(): string[] {
  const { portfolios } = usePortfolio();
  const { wallets, available } = useWallets();
  const real = portfolios.filter((p) => !p.isVirtual && !p.isAggregate);
  const hasWallets = available && wallets.some((w) => !w.archived);
  return [
    ...(real.length > 0 ? ["How are my investments doing?"] : []),
    ...(real.length > 1 ? ["Compare my portfolios"] : []),
    ...(hasWallets ? ["How are my savings going?", "Where did my money go this month?"] : []),
    ...(real.length > 0 ? ["Is my portfolio too concentrated?"] : []),
  ];
}

// The thread with the message in it, once, in the order they were sent.
function withMessage(shown: ChatMessage[], message: ChatMessage): ChatMessage[] {
  if (shown.some((m) => m.messageUuid === message.messageUuid)) return shown;
  const at = shown.findIndex((m) => m.sentAt > message.sentAt);
  return at < 0 ? [...shown, message] : [...shown.slice(0, at), message, ...shown.slice(at)];
}

function fullName(participant: Participant): string {
  const name = [participant.firstName, participant.lastName].filter(Boolean).join(" ");
  return name || (participant.role === "advisor" ? "Your advisor" : "A client");
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
