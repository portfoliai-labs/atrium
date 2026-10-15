// Locates the real data table inside a raw sheet: many broker exports prepend 3-8 rows of
// metadata (account holder, period, export date) before the header, and append a totals or
// disclaimer footer. Detection is purely structural (row widths / text-vs-number shape) since
// at this point we don't yet know what any column means.

const isBlankCell = (v: string | undefined | null): boolean => v === undefined || v === null || v.trim() === "";

const nonEmptyCount = (row: string[]): number => row.filter((c) => !isBlankCell(c)).length;

const NUMERIC_CELL_RE = /^[+-]?[\d.,\s]+%?$/;
const looksNumeric = (v: string): boolean => NUMERIC_CELL_RE.test(v.trim()) && /\d/.test(v);

const TOTAL_ROW_RE = /total|totale|somma|subtotale|sum\b/i;

function mostCommon(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0] ?? 0;
  let bestCount = -1;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

// A header row is (close to) the table's full width and is mostly non-numeric text —
// distinguishes it from a data row that happens to share the same column count.
function looksLikeHeaderRow(row: string[], modeWidth: number): boolean {
  const filled = row.filter((c) => !isBlankCell(c));
  if (modeWidth === 0 || filled.length < modeWidth * 0.6) return false;
  const numericCount = filled.filter(looksNumeric).length;
  return numericCount / filled.length < 0.3;
}

export interface TableBounds {
  headerIndex: number;
  dataStart: number;
  dataEnd: number; // exclusive
}

export function detectTableBounds(rawRows: string[][], maxHeaderScan = 10): TableBounds {
  if (rawRows.length === 0) return { headerIndex: 0, dataStart: 0, dataEnd: 0 };

  const counts = rawRows.map(nonEmptyCount);
  const modeWidth = mostCommon(counts.filter((c) => c > 0));

  let headerIndex = -1;
  for (let i = 0; i < Math.min(maxHeaderScan, rawRows.length); i++) {
    if (counts[i] === 0) continue; // skip blank separator rows
    if (counts[i] >= modeWidth * 0.6 && looksLikeHeaderRow(rawRows[i], modeWidth)) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) {
    headerIndex = counts.findIndex((c) => c > 0);
    if (headerIndex === -1) headerIndex = 0;
  }

  let dataEnd = rawRows.length;
  while (dataEnd > headerIndex + 1) {
    const row = rawRows[dataEnd - 1];
    const cnt = counts[dataEnd - 1];
    const isFooterLike = cnt === 0 || cnt < modeWidth * 0.5 || TOTAL_ROW_RE.test(row.join(" "));
    if (!isFooterLike) break;
    dataEnd--;
  }

  return { headerIndex, dataStart: headerIndex + 1, dataEnd };
}
