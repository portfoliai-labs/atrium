// services/syncService.ts
import type { SyncLink, SyncStatus, SyncStorage } from "../models/Sync";
import { apiFetch } from "./apiClient";

// Errors come back as ApiError with the backend's `error_type`: InvalidStorageError,
// InvalidPairingCodeError, WrongRecoveryCodeError (422); StorageInUseError, StorageEmptyError,
// NoRecoveryFileError, NotLinkedError (409); StorageUnreachableError (503).
export const syncService = {
  async status(): Promise<SyncStatus> {
    return apiFetch<SyncStatus>("/v1/sync");
  },

  // Starts a new sync set in the storage's empty folder.
  async link(storage: SyncStorage): Promise<SyncLink> {
    return apiFetch<SyncLink>("/v1/sync/link", { method: "POST", body: JSON.stringify({ storage }) });
  },

  // Joins the set a device's pairing code names.
  async join(code: string): Promise<SyncLink> {
    return apiFetch<SyncLink>("/v1/sync/join", { method: "POST", body: JSON.stringify({ code }) });
  },

  // Joins the set in the storage with its recovery code (the 12 words).
  async recover(storage: SyncStorage, code: string): Promise<SyncLink> {
    return apiFetch<SyncLink>("/v1/sync/recover", { method: "POST", body: JSON.stringify({ storage, code }) });
  },

  // The code (a QR) a phone joins with: it holds the set's key and the storage's credentials.
  async pairingCode(): Promise<string> {
    return (await apiFetch<{ code: string }>("/v1/sync/pairing-code", { cache: "no-store" })).code;
  },

  // A new recovery code, replacing the older one: its 12 words, shown once.
  async createRecoveryCode(): Promise<string> {
    return (await apiFetch<{ code: string }>("/v1/sync/recovery-code", { method: "POST" })).code;
  },

  // Turns sync off here: the storage's folder and the phones' copies stay.
  async unlink(): Promise<void> {
    await apiFetch("/v1/sync", { method: "DELETE" });
  },
};
