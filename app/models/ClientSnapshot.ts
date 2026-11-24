// models/ClientSnapshot.ts
// Portfolios shared with network advisors (ianus 0.94: /users/network-advisors,
// /advisor/network-clients). A network advisor (found on the open network, Nostr) who accepted the
// investor's request reads nothing of theirs until the investor shares some of their standard
// portfolios: an encrypted copy of them, with their whole transaction history, is then sent after a
// change, at most once a day. The advisor reads it as a network client's portfolios, read only.

// What the investor shares with one network advisor.
interface SnapshotShare {
  portfolioUuids: string[];
  createdAt: string;
  updatedAt: string;
  // When the latest copy went out; null until the first one did.
  lastSentAt: string | null;
  // To send as soon as due (just set, or its portfolios changed): at most once a day.
  pending: boolean;
  // Stopped, its end (the advisor told, the file deleted) not done yet.
  ending: boolean;
  // The last attempt's failure; null after a success.
  lastError: string | null;
}

// A network advisor who accepted the investor, the pair not ended.
interface NetworkAdvisor {
  // Their messages key (lowercase hex) and the same as an npub.
  advisorPubkey: string;
  npub: string;
  // The name their network profile tells; null when none.
  name: string | null;
  acceptedAt: string;
  // The accepted request (GET /users/advisor-requests).
  requestUuid: string;
  // Null while the investor shares nothing with them.
  share: SnapshotShare | null;
}

// A network investor the advisor accepted, the pair not ended, and the snapshot of theirs kept.
interface NetworkClient {
  // Their id here: /advisor/clients/{clientUuid}/portfolios, like a linked client's.
  clientUuid: string;
  pubkey: string;
  npub: string;
  acceptedAt: string;
  requestUuid: string;
  // When the client took the copy kept here ("data as of"); null while none came.
  takenAt: string | null;
  // The portfolios it holds; 0 while none came.
  portfolioCount: number;
  // The client's reference currency (ISO 4217); null while no copy came.
  currency: string | null;
}

export type { SnapshotShare, NetworkAdvisor, NetworkClient };
