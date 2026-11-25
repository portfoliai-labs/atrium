// models/Sync.ts
// Matches ianus' /v1/sync bodies (api/dto/sync.py, speculum's links/v1): camelCase, times as ISO
// 8601 UTC. A storage is written as tabella keeps it: `kind`, then the kind's fields.

export type WebDavStorage = { kind: "webdav"; url: string; username: string; password: string };
// `region` empty: us-east-1; `prefix` empty: the bucket's root.
export type S3Storage = {
  kind: "s3"; endpoint: string; region: string; bucket: string; prefix: string; accessKey: string; secretKey: string;
};
export type SyncStorage = WebDavStorage | S3Storage;

export interface SyncLink {
  kind: "webdav" | "s3";
  // Where the storage is, without credentials.
  label: string;
  // This server's device id in the set.
  device: string;
  linkedAt: string;
  // The last time everything recorded was uploaded; null before the first.
  syncedAt: string | null;
  lastError: string | null;
  // This server's changes not uploaded yet.
  pending: number;
  // The other devices' changes not applied here yet, and the latest reason one wasn't.
  waiting: number;
  waitingError: string | null;
}

export interface SyncStatus {
  // Null while sync is off.
  link: SyncLink | null;
}

// Which of the user's Nostr keys: the network's (their identity: what they publish, applaud, follow
// with) or the private messages'.
export type SyncKeyPurpose = "network" | "messages";

export interface SyncPublicKey {
  // Lowercase hex, and the same in bech32 ("npub1...").
  pubkey: string;
  npub: string;
}

// One of the user's Nostr keys in their sync set, as this server holds it (ianus' /v1/sync/keys).
export interface SyncSharedKey {
  purpose: SyncKeyPurpose;
  // This server's key is the set's: the user's other devices sign with it too.
  shared: boolean;
  // This server's own key; null while it has none yet.
  own: SyncPublicKey | null;
  // The set's key, not taken because this server's was already used; null when none.
  offered: SyncPublicKey | null;
}
