import { RawRow } from "./fileParsing";
import { buildSignature } from "./signature";
import { categoricalCandidateColumns, profileColumns, ColumnProfile } from "./columnProfile";

const BUDGET = 25;

export interface SampleSelectionResult {
  sampleRows: RawRow[]; // original file order — helps the model recognize date formats
  columnProfiles: Record<string, ColumnProfile>;
  categoricalCandidates: string[];
  distinctSignatureCount: number;
  // More distinct row shapes than the budget can cover almost certainly means the file itself
  // is malformed (ragged columns, concatenated exports) — surface it instead of silently
  // widening the sample.
  malformed: boolean;
}

function groupBySignature(rows: RawRow[], signatures: string[]): RawRow[][] {
  const groups = new Map<string, RawRow[]>();
  rows.forEach((row, i) => {
    const sig = signatures[i];
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig)!.push(row);
  });
  return Array.from(groups.values());
}

// Structural (not random) sampling: a random draw over hundreds of rows will very likely miss
// the one rare row type ("Rimborso", an isolated sale) that the model most needs to see to
// figure out which columns are categorical and how differently-shaped rows behave.
export function selectSample(headers: string[], rows: RawRow[]): SampleSelectionResult {
  const columnProfiles = profileColumns(headers, rows);
  const categoricalCandidates = categoricalCandidateColumns(headers, columnProfiles);

  if (rows.length <= BUDGET) {
    return { sampleRows: rows, columnProfiles, categoricalCandidates, distinctSignatureCount: rows.length, malformed: false };
  }

  const signatures = rows.map((row) => buildSignature(row, headers, categoricalCandidates));
  const groups = groupBySignature(rows, signatures).sort((a, b) => a.length - b.length); // rarest first

  const priorityOrdered: RawRow[] = [];
  const seen = new Set<RawRow>();
  const take = (row: RawRow) => {
    if (!seen.has(row)) {
      seen.add(row);
      priorityOrdered.push(row);
    }
  };

  // A. one row per distinct signature — rarity ordering guarantees the lone "Rimborso" row
  //    among 168 makes it into the sample.
  for (const g of groups) {
    if (priorityOrdered.length >= BUDGET - 8) break;
    take(g[0]);
  }

  // B. a second occurrence of frequent signatures (>5% of rows) — confirms the pattern is
  //    stable rather than a one-off.
  for (const g of groups.filter((g) => g.length > rows.length * 0.05)) {
    if (priorityOrdered.length >= BUDGET - 6 || g.length < 2) break;
    take(g[1]);
  }

  // C. first/last 3 rows of the file — catches format changes in exports concatenated across periods.
  [...rows.slice(0, 3), ...rows.slice(-3)].forEach(take);

  const capped = priorityOrdered.slice(0, BUDGET);
  const orderIndex = new Map(rows.map((r, i) => [r, i]));
  const sampleRows = [...capped].sort((a, b) => orderIndex.get(a)! - orderIndex.get(b)!);

  return {
    sampleRows,
    columnProfiles,
    categoricalCandidates,
    distinctSignatureCount: groups.length,
    malformed: groups.length > BUDGET,
  };
}
