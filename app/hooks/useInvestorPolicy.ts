// app/hooks/useInvestorPolicy.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clientsKey, useClientsQuery } from "../context/ClientsContext";
import { ipsService } from "../services/ipsService";
import type { InvestorPolicy } from "../models/InvestorPolicy";

export type IpsSaveStatus = "idle" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 500;

/**
 * The user's investor policy, saved as they fill it in: every change is written after a short
 * pause, and anything still pending is written when the component unmounts, so no step is ever
 * lost. `policy` is null until the first load (or while it fails: `status` is then "error"). It's
 * in the query cache under ["clients", "policy"], each change too (Profile and its Investment
 * Policy page show the same one); a save reads the suggested advisors again, matched on it.
 */
export function useInvestorPolicy(userUuid: string | undefined) {
  const queryClient = useQueryClient();
  const query = useClientsQuery(["policy"], () => ipsService.getPolicy().catch((err) => {
    console.error("Failed to load the investor policy:", err);
    throw err;
  }), { enabled: Boolean(userUuid) });
  const [status, setStatus] = useState<IpsSaveStatus>("idle");
  const latest = useRef<InvestorPolicy | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The policy as edited here, in the cache for every module showing it.
  const show = useCallback((policy: InvestorPolicy) => {
    latest.current = policy;
    queryClient.setQueryData(clientsKey("policy"), policy);
  }, [queryClient]);
  const saved = useCallback(() => { void queryClient.invalidateQueries({ queryKey: clientsKey("matches") }); }, [queryClient]);

  const persist = useCallback(async () => {
    if (!userUuid || !latest.current) return;
    setStatus("saving");
    try {
      const result = await ipsService.savePolicy(latest.current);
      // Only the version: edits made while the request was out stay, and are saved next.
      show({ ...latest.current, ...result });
      setStatus("saved");
      saved();
    } catch (err) {
      console.error("Failed to save the investor policy:", err);
      setStatus("error");
    }
  }, [userUuid, show, saved]);

  const update = useCallback((change: (current: InvestorPolicy) => InvestorPolicy) => {
    const current = latest.current ?? queryClient.getQueryData<InvestorPolicy>(clientsKey("policy"));
    if (!current) return;
    show(change(current));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      persist();
    }, SAVE_DELAY_MS);
  }, [persist, show, queryClient]);

  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      if (userUuid && latest.current) {
        ipsService.savePolicy(latest.current).then((result) => {
          queryClient.setQueryData<InvestorPolicy>(clientsKey("policy"), (prev) => prev && { ...prev, ...result });
          saved();
        }, () => {});
      }
    }
  }, [userUuid, saved, queryClient]);

  const policy = userUuid ? query.data ?? null : null;
  return { policy, status: query.isError && !policy ? "error" as const : status, update };
}
