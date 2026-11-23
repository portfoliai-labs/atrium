// components/dashboard/NetworkIdentitySettings.tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, Download, Globe, KeyRound, Loader2, Upload } from "lucide-react";
import { accountKey, useAccountQuery } from "../../hooks/useAccountQuery";
import { ApiError } from "../../services/apiClient";
import { networkService } from "../../services/journalService";
import type { NetworkIdentity, NetworkKeyExport } from "../../models/Journal";

// pons' bound (NIP-49's password): shorter is PasswordTooShortError.
const PASSWORD_MIN = 8;

const inputClass = "w-full px-4 py-3 bg-[#F7F5EF] border border-[rgba(196,154,60,0.2)] rounded-xl text-sm font-medium text-[#1c1917] outline-none focus:ring-2 focus:ring-[#C49A3C]/40";
const labelClass = "block text-[10px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5";
const buttonClass = "flex items-center gap-2 px-5 py-2.5 bg-[#1c1917] text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#C49A3C] transition-colors disabled:opacity-50";

function errorText(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    if (err.errorType === "PasswordTooShortError") return `The password needs at least ${PASSWORD_MIN} characters.`;
    if (err.errorType === "KeyNotDecryptedError") return "That key couldn't be opened: check the password, and that it's an ncryptsec.";
    if (err.errorType === "KeyTakenError") return "Another account on this instance already uses that key.";
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the text stays on screen to copy by hand */ }
  };
  return (
    <button type="button" onClick={() => void copy()} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[rgba(196,154,60,0.3)] text-xs font-bold text-[#57534e] hover:border-[#C49A3C] hover:text-[#1c1917]">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : label}
    </button>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm space-y-5">
      <div className="flex items-center gap-3 border-b border-[rgba(196,154,60,0.15)] pb-4">
        <div className="p-2.5 bg-[#F7F5EF] text-[#C49A3C] rounded-xl">{icon}</div>
        <span className="font-bold text-sm text-[#1c1917]">{title}</span>
      </div>
      {children}
    </div>
  );
}

// What tells one key from the other on the page.
interface KeyCopy {
  // The cache's key.
  id: string;
  fileName: string;
  title: string;
  intro: string;
  publicKeyHint: string;
  none: string;
  exportHint: string;
  exportWarning: string;
  importWarning: string;
  importedText: string;
  read: () => Promise<NetworkIdentity>;
  exportKey: (password: string) => Promise<NetworkKeyExport>;
  importKey: (ncryptsec: string, password: string) => Promise<NetworkIdentity>;
}

const JOURNAL_KEY: KeyCopy = {
  id: "network-identity",
  fileName: "portfoliai-nostr-key.ncryptsec.txt",
  title: "Journal key",
  intro: "What you publish in the Journal goes out to the network (Nostr), signed with a key of yours that this instance keeps. "
    + "Others follow you, on any instance or Nostr app, by your public key (npub).",
  publicKeyHint: "The npub others follow you by.",
  none: "You don't have one yet: it's made the first time you publish, follow someone or export it.",
  exportHint: "Your secret key, encrypted with a password you choose, to sign in to another Nostr app or instance as yourself.",
  exportWarning: "Keep it safe, with its password: whoever has both can publish as you. Nobody, not even this instance, can recover the password.",
  importWarning: "The key you import replaces your current one: from then on you publish and follow as it. What you already published "
    + "stays on the network, signed with the old key; export it first if you want to keep it.",
  importedText: "Imported: this is your Journal key now.",
  read: () => networkService.identity(),
  exportKey: (password) => networkService.exportKey(password),
  importKey: (ncryptsec, password) => networkService.importKey(ncryptsec, password),
};

const MESSAGES_KEY: KeyCopy = {
  id: "network-messages-identity",
  fileName: "portfoliai-nostr-messages-key.ncryptsec.txt",
  title: "Messages key",
  intro: "A different key from the Journal's, kept apart so your articles and your private conversations can't be linked: "
    + "it encrypts your private messages with advisors and investors on the network (requests and chats), and an advisor's "
    + "profile on the network is published with it.",
  publicKeyHint: "The npub advisors and investors on the network reach you by.",
  none: "You don't have one yet: it's made the first time you write to someone on the network, publish your advisor profile or export it.",
  exportHint: "Your messages secret key, encrypted with a password you choose, to read and write the same conversations from the app "
    + "on your phone or another instance.",
  exportWarning: "Keep it safe, with its password: whoever has both can read your private messages and write as you. Nobody, not even "
    + "this instance, can recover the password.",
  importWarning: "The key you import replaces your current messages key: what was sent to it is read again here. The messages kept for "
    + "the key it replaces no longer open; export it first if you want to keep it.",
  importedText: "Imported: this is your messages key now.",
  read: () => networkService.messagesIdentity(),
  exportKey: (password) => networkService.exportMessagesKey(password),
  importKey: (ncryptsec, password) => networkService.importMessagesKey(ncryptsec, password),
};

/**
 * NETWORK — the user's two keys on the network (Nostr, kept by pons), each with its npub, its
 * secret key taken out encrypted with a password (an ncryptsec, for another Nostr app or
 * instance) or one brought in from elsewhere in place of it: the Journal's (articles, strategies,
 * follows) and the private messages' (requests and chats with the network's advisors and
 * investors, an advisor's network profile).
 */
export function NetworkIdentitySettings() {
  return (
    <div className="space-y-12">
      <NetworkKey copy={JOURNAL_KEY} />
      <NetworkKey copy={MESSAGES_KEY} />
    </div>
  );
}

function NetworkKey({ copy }: { copy: KeyCopy }) {
  const queryClient = useQueryClient();
  const identity = useAccountQuery([copy.id], copy.read);
  const setIdentity = (next: NetworkIdentity) => queryClient.setQueryData(accountKey(copy.id), next);

  const [exportPassword, setExportPassword] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [ncryptsec, setNcryptsec] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const exportKey = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const result = await copy.exportKey(exportPassword);
      setExported(result.ncryptsec);
      setExportPassword("");
      setIdentity({ pubkey: result.pubkey, npub: result.npub });
    } catch (err) {
      setExportError(errorText(err, "The key couldn't be exported."));
    } finally {
      setExporting(false);
    }
  };

  const download = (text: string) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    link.download = copy.fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importKey = async () => {
    setImporting(true);
    setImportError(null);
    setImported(false);
    try {
      setIdentity(await copy.importKey(ncryptsec.trim(), importPassword));
      setNcryptsec("");
      setImportPassword("");
      setExported(null);
      setImported(true);
    } catch (err) {
      setImportError(errorText(err, "The key couldn't be imported."));
    } finally {
      setImporting(false);
    }
  };

  const npub = identity.data?.npub;
  return (
    <section className="space-y-6">
      <div className="space-y-1.5">
        <h3 className="font-bold text-lg text-[#1c1917]">{copy.title}</h3>
        <p className="text-[13px] text-[#78716c] leading-relaxed max-w-3xl">{copy.intro}</p>
      </div>

      <Card icon={<Globe className="w-5 h-5" />} title="Your public key">
        <p className="text-[13px] text-[#78716c] leading-relaxed">{copy.publicKeyHint}</p>
        {identity.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-[#C49A3C]" />
        ) : identity.isError ? (
          <p className="text-sm font-medium text-rose-600">{errorText(identity.error, "Your identity couldn't be read.")}</p>
        ) : npub ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <code className="min-w-0 flex-1 break-all rounded-xl bg-[#F7F5EF] px-4 py-3 text-xs text-[#1c1917]">{npub}</code>
            <CopyButton text={npub} label="Copy" />
          </div>
        ) : (
          <p className="text-sm text-[#78716c]">{copy.none}</p>
        )}
      </Card>

      <Card icon={<KeyRound className="w-5 h-5" />} title="Export your key">
        <p className="text-[13px] text-[#78716c] leading-relaxed">{copy.exportHint}</p>
        {exported ? (
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {copy.exportWarning}
            </p>
            <code className="block break-all rounded-xl bg-[#F7F5EF] px-4 py-3 text-xs text-[#1c1917]">{exported}</code>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={exported} label="Copy" />
              <button type="button" onClick={() => download(exported)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[rgba(196,154,60,0.3)] text-xs font-bold text-[#57534e] hover:border-[#C49A3C] hover:text-[#1c1917]">
                <Download className="h-3.5 w-3.5" /> Download
              </button>
              <button type="button" onClick={() => setExported(null)} className="px-3 py-2 text-xs font-bold text-[#78716c] hover:text-[#1c1917]">Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void exportKey(); }} className="flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="block flex-1">
              <span className={labelClass}>Password (at least {PASSWORD_MIN} characters)</span>
              <input type="password" autoComplete="new-password" value={exportPassword} onChange={(e) => setExportPassword(e.target.value)} className={inputClass} />
            </label>
            <button type="submit" disabled={exporting || exportPassword.length < PASSWORD_MIN} className={buttonClass}>
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />} Export
            </button>
          </form>
        )}
        {exportError && <p className="text-xs font-medium text-rose-600">{exportError}</p>}
      </Card>

      <Card icon={<Upload className="w-5 h-5" />} title="Import a key">
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          {copy.importWarning}
        </p>
        <form onSubmit={(e) => { e.preventDefault(); void importKey(); }} className="space-y-3">
          <label className="block">
            <span className={labelClass}>Encrypted key (ncryptsec1…)</span>
            <input value={ncryptsec} onChange={(e) => setNcryptsec(e.target.value)} spellCheck={false} autoComplete="off" className={`${inputClass} font-mono`} />
          </label>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="block flex-1">
              <span className={labelClass}>Its password</span>
              <input type="password" autoComplete="off" value={importPassword} onChange={(e) => setImportPassword(e.target.value)} className={inputClass} />
            </label>
            <button type="submit" disabled={importing || !ncryptsec.trim() || !importPassword} className={buttonClass}>
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Replace my key
            </button>
          </div>
        </form>
        {importError && <p className="text-xs font-medium text-rose-600">{importError}</p>}
        {imported && <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700"><Check className="h-3.5 w-3.5" /> {copy.importedText}</p>}
      </Card>
    </section>
  );
}
