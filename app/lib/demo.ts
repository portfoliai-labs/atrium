// lib/demo.ts
//
// DEMO ACCOUNTS — accounts on the DEMO subscription tier (`subscription_tier` on the profile),
// used to show the product (on staging) without letting anyone change it. A demo account:
// - sees, on the regular dashboard, the previews of what's coming (components/preview): the
//   roadmap's features on sample data, not tied to real data, which no other account sees;
// - is read-only: apiFetch refuses every request that would change something (see
//   `isBlockedForDemo`), and the pages disable the controls that would send one.
// This is the frontend's half only: the backend must refuse a demo account's writes too, since
// anything in the browser can be bypassed.

import type { UserProfile } from "../models/User";

export const DEMO_READ_ONLY_MESSAGE = "This is a demo account: changes are disabled.";

export const isDemoUser = (user: Pick<UserProfile, "subscription_tier"> | null | undefined) => user?.subscription_tier === "DEMO";

// Set by UserContext once it knows who's signed in; read by apiFetch on every request.
let readOnly = false;
export const setDemoReadOnly = (value: boolean) => {
  readOnly = value;
};

// Writes a demo account can't do without: accepting the legal documents (LegalGate won't let
// anyone past without it). The notification stream's ticket isn't here: useNotifications never
// asks for one on a demo account.
const ALLOWED_WRITES: { method: string; path: RegExp }[] = [
  { method: "POST", path: /^\/v1\/legal\/acceptances$/ },
];

/** Whether apiFetch must refuse this request because a demo account is signed in. */
export function isBlockedForDemo(endpoint: string, method = "GET") {
  const m = method.toUpperCase();
  if (!readOnly || m === "GET" || m === "HEAD") return false;
  const path = endpoint.split("?")[0];
  return !ALLOWED_WRITES.some((w) => w.method === m && w.path.test(path));
}
