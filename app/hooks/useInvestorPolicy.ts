// app/hooks/useInvestorPolicy.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ipsService } from "../services/ipsService";
import type { InvestorPolicy } from "../models/InvestorPolicy";

export type IpsSaveStatus = "idle" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 500;

/**
 * The user's investor policy, saved as they fill it in: every change is written after a short
 * pause, and anything still pending is written when the component unmounts, so no step is ever
 * lost. `policy` is null until the first load (or while it fails: `status` is then "error").
 */
export function useInvestorPolicy(userUuid: string | undefined) {
  const [policy, setPolicy] = useState<InvestorPolicy | null>(null);
  const [status, setStatus] = useState<IpsSaveStatus>("idle");
  const latest = useRef<InvestorPolicy | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userUuid) return;
    let cancelled = false;
    ipsService.getPolicy().then((loaded) => {
      if (cancelled) return;
      latest.current = loaded;
      setPolicy(loaded);
    }).catch((err) => {
      console.error("Failed to load the investor policy:", err);
      if (!cancelled) setStatus("error");
    });
    return () => { cancelled = true; };
  }, [userUuid]);

  const persist = useCallback(async () => {
    if (!userUuid || !latest.current) return;
    setStatus("saving");
    try {
      const saved = await ipsService.savePolicy(latest.current);
      // Only the version: edits made while the request was out stay, and are saved next.
      latest.current = { ...latest.current, ...saved };
      setPolicy(latest.current);
      setStatus("saved");
    } catch (err) {
      console.error("Failed to save the investor policy:", err);
      setStatus("error");
    }
  }, [userUuid]);

  const update = useCallback((change: (current: InvestorPolicy) => InvestorPolicy) => {
    if (!latest.current) return;
    latest.current = change(latest.current);
    setPolicy(latest.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      persist();
    }, SAVE_DELAY_MS);
  }, [persist]);

  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      if (userUuid && latest.current) ipsService.savePolicy(latest.current).catch(() => {});
    }
  }, [userUuid]);

  return { policy, status, update };
}
