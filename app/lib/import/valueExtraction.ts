import { RawRow } from "./fileParsing";

// Every distinct raw value of a column, across the WHOLE file — completeness matters here
// (this feeds the analyze-values request): a value left out means its rows can never resolve
// to anything but "unmapped".
export function allDistinctValues(column: string, rows: RawRow[]): string[] {
  return Array.from(new Set(rows.map((r) => (r[column] ?? "").trim())));
}

// Local-only (never sent to the backend): how often each value occurs, for the confirmation
// UI's counts.
export function valueCounts(column: string, rows: RawRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = (row[column] ?? "").trim();
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}
