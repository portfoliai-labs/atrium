// services/ipsService.ts
import type { InvestorPolicy } from "../models/InvestorPolicy";
import { emptyPolicy, mergeWithDefaults } from "../lib/ips";

// The backend has no endpoint for the investor policy yet, so it is kept in this browser, one
// entry per user. Everything goes through this object and stays async, so moving to an API
// (GET / PUT on the user's policy) means changing only this file: the policy then follows the
// user across devices instead of staying on this one.
const storageKey = (userUuid: string) => `investor_policy:${userUuid}`;

export const ipsService = {
  async getPolicy(userUuid: string): Promise<InvestorPolicy> {
    try {
      const raw = localStorage.getItem(storageKey(userUuid));
      return raw ? mergeWithDefaults(JSON.parse(raw)) : emptyPolicy();
    } catch {
      // Unreadable or corrupted entry: start over rather than block the page.
      return emptyPolicy();
    }
  },

  async savePolicy(userUuid: string, policy: InvestorPolicy): Promise<InvestorPolicy> {
    const saved = { ...policy, updated_at: new Date().toISOString() };
    localStorage.setItem(storageKey(userUuid), JSON.stringify(saved));
    return saved;
  },

  // Called when the account is deleted, so nothing of it is left behind in the browser.
  clearPolicy(userUuid: string): void {
    localStorage.removeItem(storageKey(userUuid));
  },
};
