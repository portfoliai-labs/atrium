// services/ipsService.ts
import type { InvestorPolicy } from "../models/InvestorPolicy";
import { mergeWithDefaults } from "../lib/ips";
import { apiFetch } from "./apiClient";

// What ianus serves: the policy without the form's goal ids.
type StoredPolicy = Omit<InvestorPolicy, "objectives"> & {
  objectives: Omit<InvestorPolicy["objectives"], "goals"> & {
    goals: Omit<InvestorPolicy["objectives"]["goals"][number], "id">[];
  };
};

// The caller's investor policy, kept by civis: each save that changes it is a new version, and
// deleting the account deletes them all. The goals' ids are only the form's (a key per row):
// given on load, left out on save.
export const ipsService = {
  // GET /users/investor-policy — null while the user never saved one: the empty policy then.
  async getPolicy(): Promise<InvestorPolicy> {
    const stored = await apiFetch<StoredPolicy | null>("/v1/users/investor-policy");
    const policy = mergeWithDefaults(stored as Partial<InvestorPolicy> | null);
    const goals = (stored?.objectives.goals ?? []).map((g) => ({ ...g, id: crypto.randomUUID() }));
    return { ...policy, objectives: { ...policy.objectives, goals } };
  },

  // PUT /users/investor-policy — the whole policy; answers the version it is saved as.
  async savePolicy(policy: InvestorPolicy): Promise<Pick<InvestorPolicy, "version" | "savedAt">> {
    const body = {
      objectives: {
        ...policy.objectives,
        goals: policy.objectives.goals.map((g) => ({
          description: g.description, targetAmount: g.targetAmount, targetYear: g.targetYear,
        })),
      },
      risk: policy.risk,
      constraints: policy.constraints,
      allocation: policy.allocation,
      guidelines: policy.guidelines,
      monitoring: policy.monitoring,
      advisorPreferences: policy.advisorPreferences,
    };
    const saved = await apiFetch<StoredPolicy>("/v1/users/investor-policy", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return { version: saved.version, savedAt: saved.savedAt };
  },
};
