import { RawRow } from "./fileParsing";
import { ColumnProfileDTO } from "../../models/Import";

export const isEmpty = (v: string | undefined | null): boolean => v === undefined || v === null || v.trim() === "";

const DATE_LIKE_RE = /^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}$/;
// Accepts plain numbers, thousands separators (either convention), decimal comma/point,
// parenthesized negatives ("(1.234,56)") and a trailing "%".
const NUMBER_LIKE_RE = /^\(?-?\d{1,3}([.,]\d{3})*([.,]\d+)?\)?%?$/;

function inferType(values: string[]): "number" | "date" | "string" {
  const nonEmpty = values.filter((v) => !isEmpty(v));
  if (nonEmpty.length === 0) return "string";

  const dateRatio = nonEmpty.filter((v) => DATE_LIKE_RE.test(v.trim())).length / nonEmpty.length;
  if (dateRatio > 0.8) return "date";

  const numberRatio = nonEmpty.filter((v) => NUMBER_LIKE_RE.test(v.trim())).length / nonEmpty.length;
  if (numberRatio > 0.8) return "number";

  return "string";
}

// Frontend-only profile used purely to drive the structural row-sampling (Fase 1) — distinct
// from ColumnProfileDTO, the shape actually sent to the backend (see buildColumnProfilesForRequest).
export interface ColumnProfile {
  distinctCount: number;
  nullRate: number;
  cardinalityRatio: number;
  inferredType: "number" | "date" | "string";
}

export function profileColumns(headers: string[], rows: RawRow[]): Record<string, ColumnProfile> {
  const profile: Record<string, ColumnProfile> = {};
  for (const col of headers) {
    const values = rows.map((r) => r[col] ?? "");
    const distinctCount = new Set(values.map((v) => v.trim())).size;
    const nullRate = rows.length ? values.filter(isEmpty).length / rows.length : 0;
    const cardinalityRatio = rows.length ? distinctCount / rows.length : 0;
    profile[col] = { distinctCount, nullRate, cardinalityRatio, inferredType: inferType(values) };
  }
  return profile;
}

// Candidate categorical column: few distinct values, both in absolute terms and relative to
// row count. A "Segno" column with 3 values out of 168 rows qualifies; a "Prezzo" column with
// 140 doesn't — no need to know what either column actually contains.
export const isCategoricalCandidate = (p: ColumnProfile): boolean =>
  p.inferredType === "string" && p.distinctCount <= 25 && p.cardinalityRatio < 0.1;

export function categoricalCandidateColumns(headers: string[], profiles: Record<string, ColumnProfile>): string[] {
  return headers.filter((h) => isCategoricalCandidate(profiles[h]));
}

// The actual wire-format profile the backend wants: every distinct raw value across the WHOLE
// file (not just the sample) plus a 0-100 null rate — lets the AI reason about e.g. a column
// that's blank in 12% of rows without ever seeing the full dataset.
export function buildColumnProfilesForRequest(headers: string[], rows: RawRow[]): Record<string, ColumnProfileDTO> {
  const profiles: Record<string, ColumnProfileDTO> = {};
  for (const col of headers) {
    const values = rows.map((r) => r[col] ?? "");
    const distinctValues = Array.from(new Set(values.map((v) => v.trim()).filter((v) => v !== "")));
    const nullCount = values.filter(isEmpty).length;
    profiles[col] = {
      distinct_values: distinctValues,
      null_rate_pct: rows.length ? (nullCount / rows.length) * 100 : 0,
    };
  }
  return profiles;
}
