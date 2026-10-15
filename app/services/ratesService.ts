// services/ratesService.ts
import type { Benchmark, BenchmarkCode, PolicyRate, YieldCurve, YieldHistory } from "../models/Rates";
import { apiFetch } from "./apiClient";

// Errors come back as ApiError: 422 for a malformed code, 503 when the source is down and nothing is
// cached. An unknown code isn't one: its entry has found: false.

function ratesQuery(params: Record<string, (string | number)[] | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) for (const v of value) search.append(key, String(v));
    else if (value) search.set(key, "true");
  }
  return `?${search.toString()}`;
}

// The same answer for the whole session, since the figures move once a day at most: several
// mortgage cards, or a holding opened twice, ask once. A failed call is forgotten, to be asked again.
const cache = new Map<string, Promise<unknown>>();

function cached<T>(endpoint: string): Promise<T> {
  const hit = cache.get(endpoint);
  if (hit) return hit as Promise<T>;
  const call = apiFetch<T>(endpoint);
  cache.set(endpoint, call);
  call.catch(() => cache.delete(endpoint));
  return call;
}

export const ratesService = {
  // GET /v1/rates/policy?currency=EUR&currency=USD[&history=true] — by currency: a bond in EUR follows
  // the ECB whoever issued it.
  policy(currencies: string[], history = false): Promise<PolicyRate[]> {
    return cached(`/v1/rates/policy${ratesQuery({ currency: currencies, history })}`);
  },

  // GET /v1/rates/yield-curves?area=IT&area=XM — by area (see lib/rates' curveArea).
  yieldCurves(areas: string[]): Promise<YieldCurve[]> {
    return cached(`/v1/rates/yield-curves${ratesQuery({ area: areas })}`);
  },

  // GET /v1/rates/yield-history?area=IT&tenorMonths=120 — one entry per area and tenor.
  yieldHistory(areas: string[], tenorMonths: number[]): Promise<YieldHistory[]> {
    return cached(`/v1/rates/yield-history${ratesQuery({ area: areas, tenorMonths })}`);
  },

  // GET /v1/rates/benchmarks?code=ESTR&code=SOFR[&history=true]
  benchmarks(codes: BenchmarkCode[], history = false): Promise<Benchmark[]> {
    return cached(`/v1/rates/benchmarks${ratesQuery({ code: codes, history })}`);
  },
};
