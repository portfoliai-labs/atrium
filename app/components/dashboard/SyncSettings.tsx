// components/dashboard/SyncSettings.tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { AlertTriangle, Check, Cloud, Copy, KeyRound, Link2, Loader2, LifeBuoy, PowerOff, RefreshCw, Smartphone } from "lucide-react";
import { accountKey, useAccountQuery } from "../../hooks/useAccountQuery";
import { ApiError } from "../../services/apiClient";
import { syncService } from "../../services/syncService";
import type { SyncLink, SyncStatus, SyncStorage } from "../../models/Sync";

// How often the status is read again while the tab is open: speculum pulls every minute.
const STATUS_POLL_MS = 10_000;

const inputClass = "w-full px-4 py-3 bg-[#F7F5EF] border border-[rgba(196,154,60,0.2)] rounded-xl text-sm font-medium text-[#1c1917] outline-none focus:ring-2 focus:ring-[#C49A3C]/40";
const labelClass = "block text-[10px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5";
const buttonClass = "flex items-center gap-2 px-5 py-2.5 bg-[#1c1917] text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#C49A3C] transition-colors disabled:opacity-50";
const secondaryButtonClass = "flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[rgba(196,154,60,0.3)] text-xs font-bold uppercase tracking-wider text-[#57534e] hover:border-[#C49A3C] hover:text-[#1c1917] disabled:opacity-50";

function errorText(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    switch (err.errorType) {
      case "InvalidStorageError": return err.message || "Some of the storage's details are missing or wrong.";
      case "StorageInUseError": return "That folder already holds a sync set: join it with a code from one of your devices, or pick an empty folder.";
      case "StorageEmptyError": return "The code's folder holds no sync set any more.";
      case "StorageUnreachableError": return `The storage couldn't be reached: ${err.message}`;
      case "InvalidPairingCodeError": return "That isn't a pairing code: copy it again from the device's Sync screen.";
      case "NoRecoveryFileError": return "That folder has no recovery file: no device made a recovery code for it.";
      case "WrongRecoveryCodeError": return "Those words don't open the folder's recovery file: check them, and that it's the latest code.";
      case "NotLinkedError": return "Sync is off.";
    }
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

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 leading-relaxed">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

function Failure({ text }: { text: string | null }) {
  return text ? <p className="text-sm font-medium text-rose-600">{text}</p> : null;
}

const EMPTY_WEBDAV: SyncStorage = { kind: "webdav", url: "", username: "", password: "" };
const EMPTY_S3: SyncStorage = { kind: "s3", endpoint: "", region: "", bucket: "", prefix: "", accessKey: "", secretKey: "" };

/** A storage's details, as tabella asks them: a WebDAV folder or an S3 bucket. */
function StorageFields({ value, onChange }: { value: SyncStorage; onChange: (next: SyncStorage) => void }) {
  const field = (name: string, label: string, current: string, set: (v: string) => SyncStorage, props: { type?: string; placeholder?: string } = {}) => (
    <div>
      <label htmlFor={`sync-${name}`} className={labelClass}>{label}</label>
      <input
        id={`sync-${name}`} className={inputClass} value={current} autoComplete="off" spellCheck={false}
        type={props.type ?? "text"} placeholder={props.placeholder} onChange={(e) => onChange(set(e.target.value))}
      />
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="inline-flex gap-1 p-1 bg-[#F7F5EF] rounded-full border border-[rgba(196,154,60,0.2)]">
        {(["webdav", "s3"] as const).map((kind) => (
          <button
            key={kind} type="button" onClick={() => value.kind !== kind && onChange(kind === "webdav" ? EMPTY_WEBDAV : EMPTY_S3)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider ${value.kind === kind ? "bg-[#1c1917] text-white" : "text-[#78716c] hover:text-[#1c1917]"}`}
          >
            {kind === "webdav" ? "WebDAV" : "S3"}
          </button>
        ))}
      </div>
      {value.kind === "webdav" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {field("url", "Folder URL", value.url, (url) => ({ ...value, url }), { placeholder: "https://cloud.example.com/remote.php/dav/files/you/" })}
          </div>
          {field("username", "Username", value.username, (username) => ({ ...value, username }))}
          {field("password", "Password (an app password is best)", value.password, (password) => ({ ...value, password }), { type: "password" })}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {field("endpoint", "Endpoint", value.endpoint, (endpoint) => ({ ...value, endpoint }), { placeholder: "https://s3.eu-west-1.amazonaws.com" })}
          {field("region", "Region (optional)", value.region, (region) => ({ ...value, region }), { placeholder: "us-east-1" })}
          {field("bucket", "Bucket", value.bucket, (bucket) => ({ ...value, bucket }))}
          {field("prefix", "Prefix (optional)", value.prefix, (prefix) => ({ ...value, prefix }))}
          {field("access-key", "Access key", value.accessKey, (accessKey) => ({ ...value, accessKey }))}
          {field("secret-key", "Secret key", value.secretKey, (secretKey) => ({ ...value, secretKey }), { type: "password" })}
        </div>
      )}
      <p className="text-[12px] text-[#a8a29e]">
        Write the address as your phones reach it: they get it, with the credentials, when they pair. The sync goes in a
        <code className="mx-1">portfoliai-sync</code>folder inside it.
      </p>
    </div>
  );
}

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : "not yet";
}

/** Sync off: start a set in an empty folder, join one with a device's code, or recover one. */
function Unlinked({ onLinked }: { onLinked: (link: SyncLink) => void }) {
  const [storage, setStorage] = useState<SyncStorage>(EMPTY_WEBDAV);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [recoverStorage, setRecoverStorage] = useState<SyncStorage>(EMPTY_WEBDAV);
  const [words, setWords] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [recoverError, setRecoverError] = useState<string | null>(null);

  const start = async () => {
    setStarting(true);
    setStartError(null);
    try {
      onLinked(await syncService.link(storage));
    } catch (err) {
      setStartError(errorText(err, "Sync couldn't start."));
    } finally {
      setStarting(false);
    }
  };

  const join = async () => {
    setJoining(true);
    setJoinError(null);
    try {
      onLinked(await syncService.join(code.trim()));
    } catch (err) {
      setJoinError(errorText(err, "The set couldn't be joined."));
    } finally {
      setJoining(false);
    }
  };

  const recover = async () => {
    setRecovering(true);
    setRecoverError(null);
    try {
      onLinked(await syncService.recover(recoverStorage, words));
    } catch (err) {
      setRecoverError(errorText(err, "The set couldn't be recovered."));
    } finally {
      setRecovering(false);
    }
  };

  return (
    <>
      <Card icon={<Cloud className="w-5 h-5" />} title="Start syncing">
        <p className="text-[13px] text-[#78716c]">In an empty folder of your storage: this server becomes your set&apos;s first device; your phones join it with its code.</p>
        <StorageFields value={storage} onChange={setStorage} />
        <Failure text={startError} />
        <button type="button" className={buttonClass} disabled={starting} onClick={() => void start()}>
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />} Start
        </button>
      </Card>

      <Card icon={<Link2 className="w-5 h-5" />} title="Join with a pairing code">
        <p className="text-[13px] text-[#78716c]">Your phone already syncs? In its Sync screen, show the pairing code and paste its text here.</p>
        <textarea
          className={`${inputClass} font-mono text-xs min-h-24`} value={code} spellCheck={false} autoComplete="off"
          aria-label="Pairing code" onChange={(e) => setCode(e.target.value)}
        />
        <Failure text={joinError} />
        <button type="button" className={buttonClass} disabled={joining || !code.trim()} onClick={() => void join()}>
          {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Join
        </button>
      </Card>

      <Card icon={<LifeBuoy className="w-5 h-5" />} title="Recover with your recovery code">
        <p className="text-[13px] text-[#78716c]">Every device of your set lost? The set&apos;s storage, and the 12 words you wrote down.</p>
        <StorageFields value={recoverStorage} onChange={setRecoverStorage} />
        <div>
          <label htmlFor="sync-words" className={labelClass}>Recovery code</label>
          <textarea
            id="sync-words" className={`${inputClass} min-h-20`} value={words} spellCheck={false} autoComplete="off"
            onChange={(e) => setWords(e.target.value)}
          />
        </div>
        <Failure text={recoverError} />
        <button type="button" className={buttonClass} disabled={recovering || !words.trim()} onClick={() => void recover()}>
          {recovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <LifeBuoy className="h-4 w-4" />} Recover
        </button>
      </Card>
    </>
  );
}

/** Sync on: how it goes, pairing a phone, the recovery code, turning it off. */
function Linked({ link, onUnlinked }: { link: SyncLink; onUnlinked: () => void }) {
  const [pairingAsked, setPairingAsked] = useState(false);
  const [pairing, setPairing] = useState<string | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);

  const [recoveryAsked, setRecoveryAsked] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const [offAsked, setOffAsked] = useState(false);
  const [offBusy, setOffBusy] = useState(false);
  const [offError, setOffError] = useState<string | null>(null);

  const showPairing = async () => {
    setPairingBusy(true);
    setPairingError(null);
    try {
      setPairing(await syncService.pairingCode());
    } catch (err) {
      setPairingError(errorText(err, "The pairing code couldn't be read."));
    } finally {
      setPairingBusy(false);
    }
  };

  const makeRecovery = async () => {
    setRecoveryBusy(true);
    setRecoveryError(null);
    try {
      setRecovery(await syncService.createRecoveryCode());
      setRecoveryAsked(false);
    } catch (err) {
      setRecoveryError(errorText(err, "The recovery code couldn't be made."));
    } finally {
      setRecoveryBusy(false);
    }
  };

  const turnOff = async () => {
    setOffBusy(true);
    setOffError(null);
    try {
      await syncService.unlink();
      onUnlinked();
    } catch (err) {
      setOffError(errorText(err, "Sync couldn't be turned off."));
      setOffBusy(false);
    }
  };

  const hidePairing = () => {
    setPairing(null);
    setPairingAsked(false);
  };

  return (
    <>
      <Card icon={<RefreshCw className="w-5 h-5" />} title="Sync is on">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
          <div className="sm:col-span-2 min-w-0">
            <dt className={labelClass}>{link.kind === "webdav" ? "WebDAV folder" : "S3 bucket"}</dt>
            <dd className="break-all font-medium text-[#1c1917]">{link.label}</dd>
          </div>
          <div><dt className={labelClass}>Last upload</dt><dd className="font-medium text-[#1c1917]">{when(link.syncedAt)}</dd></div>
          <div><dt className={labelClass}>Linked</dt><dd className="font-medium text-[#1c1917]">{when(link.linkedAt)}</dd></div>
          <div><dt className={labelClass}>Waiting to upload</dt><dd className="font-medium text-[#1c1917]">{link.pending}</dd></div>
          <div><dt className={labelClass}>Waiting to apply here</dt><dd className="font-medium text-[#1c1917]">{link.waiting}</dd></div>
          <div className="sm:col-span-2"><dt className={labelClass}>This server&apos;s device</dt><dd className="font-mono text-xs text-[#78716c] break-all">{link.device}</dd></div>
        </dl>
        {link.lastError && <Failure text={`The last sync failed: ${link.lastError}`} />}
        {link.waitingError && <Failure text={`A change from another device couldn't be applied: ${link.waitingError}`} />}
      </Card>

      <Card icon={<Smartphone className="w-5 h-5" />} title="Add a phone">
        <p className="text-[13px] text-[#78716c]">In tabella, open Settings → Sync → Join, and scan this server&apos;s pairing code.</p>
        {pairing ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-5">
              <div className="shrink-0 self-start rounded-xl bg-white p-3 border border-[#EEE9DD]">
                <QRCodeSVG value={pairing} size={220} level="M" />
              </div>
              <div className="min-w-0 space-y-3">
                <code className="block max-h-32 overflow-auto break-all rounded-xl bg-[#F7F5EF] px-4 py-3 text-[11px] text-[#1c1917]">{pairing}</code>
                <CopyButton text={pairing} label="Copy the code" />
              </div>
            </div>
            <button type="button" className={secondaryButtonClass} onClick={hidePairing}>Hide</button>
          </div>
        ) : pairingAsked ? (
          <div className="space-y-4">
            <Warning>
              The code holds your set&apos;s key <strong>and the storage&apos;s credentials</strong>: whoever scans it, or sees it on
              your screen, reads everything you sync. Show it only to your own devices, with nobody looking.
            </Warning>
            <Failure text={pairingError} />
            <div className="flex flex-wrap gap-3">
              <button type="button" className={buttonClass} disabled={pairingBusy} onClick={() => void showPairing()}>
                {pairingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />} Show the code
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => setPairingAsked(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className={buttonClass} onClick={() => setPairingAsked(true)}>
            <Smartphone className="h-4 w-4" /> Pair a phone
          </button>
        )}
      </Card>

      <Card icon={<KeyRound className="w-5 h-5" />} title="Recovery code">
        <p className="text-[13px] text-[#78716c]">
          12 words that open your set again if every device is lost. Nobody can recover it without them, us included.
        </p>
        {recovery ? (
          <div className="space-y-4">
            <Warning>Write these words down now and keep them somewhere safe: they won&apos;t be shown again.</Warning>
            <ol className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {recovery.split(" ").map((word, i) => (
                <li key={i} className="rounded-xl bg-[#F7F5EF] px-3 py-2 text-sm font-medium text-[#1c1917]">
                  <span className="mr-2 text-[11px] text-[#a8a29e]">{i + 1}.</span>{word}
                </li>
              ))}
            </ol>
            <button type="button" className={buttonClass} onClick={() => setRecovery(null)}>
              <Check className="h-4 w-4" /> I wrote them down
            </button>
          </div>
        ) : recoveryAsked ? (
          <div className="space-y-4">
            <Warning>A new code replaces the one made before, on any device: the older words stop working.</Warning>
            <Failure text={recoveryError} />
            <div className="flex flex-wrap gap-3">
              <button type="button" className={buttonClass} disabled={recoveryBusy} onClick={() => void makeRecovery()}>
                {recoveryBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Make a new code
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => setRecoveryAsked(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className={buttonClass} onClick={() => setRecoveryAsked(true)}>
            <KeyRound className="h-4 w-4" /> Make a recovery code
          </button>
        )}
      </Card>

      <Card icon={<PowerOff className="w-5 h-5" />} title="Turn sync off">
        <p className="text-[13px] text-[#78716c]">
          This server stops syncing. Your data stays here, in the storage&apos;s folder and on your phones.
        </p>
        <Failure text={offError} />
        {offAsked ? (
          <div className="flex flex-wrap gap-3">
            <button type="button" className={`${buttonClass} bg-rose-600 hover:bg-rose-700`} disabled={offBusy} onClick={() => void turnOff()}>
              {offBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />} Turn off
            </button>
            <button type="button" className={secondaryButtonClass} onClick={() => setOffAsked(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className={secondaryButtonClass} onClick={() => setOffAsked(true)}>
            <PowerOff className="h-4 w-4" /> Turn sync off
          </button>
        )}
      </Card>
    </>
  );
}

/**
 * SYNC — this server as one of the user's devices in their own sync set (speculum): their data
 * in a WebDAV folder or S3 bucket of theirs, encrypted with a key only their devices hold, so
 * what they enter here reaches tabella on their phones and back.
 */
export function SyncSettings() {
  const queryClient = useQueryClient();
  const status = useAccountQuery(["sync"], () => syncService.status(), { pollMs: STATUS_POLL_MS });
  const setStatus = (next: SyncStatus) => queryClient.setQueryData(accountKey("sync"), next);

  return (
    <div className="space-y-8">
      <p className="text-[13px] text-[#78716c] leading-relaxed max-w-3xl">
        Keep your portfolios on your phones too, without anyone hosting them: your devices sync through a storage of yours (a
        WebDAV folder such as Nextcloud, or an S3 bucket), and everything there is encrypted with a key only your devices hold.
      </p>
      {status.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-[#C49A3C]" />
      ) : status.isError ? (
        <Failure text={errorText(status.error, "Sync's status couldn't be read.")} />
      ) : status.data?.link ? (
        <Linked link={status.data.link} onUnlinked={() => setStatus({ link: null })} />
      ) : (
        <Unlinked onLinked={(link) => setStatus({ link })} />
      )}
    </div>
  );
}
