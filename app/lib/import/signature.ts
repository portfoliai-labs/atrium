import { RawRow } from "./fileParsing";
import { isEmpty } from "./columnProfile";

const NEGATIVE_RE = /^-\s*[\d.,]/;
const CURRENCY_SYMBOL_RE = /[€$£¥]/;
const DATE_LIKE_RE = /^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}$/;

const hasNegativeValue = (row: RawRow, headers: string[]): boolean =>
  headers.some((h) => NEGATIVE_RE.test((row[h] ?? "").trim()));

const hasParentheses = (row: RawRow, headers: string[]): boolean =>
  headers.some((h) => /^\(.*\)$/.test((row[h] ?? "").trim()));

const hasCurrencySymbol = (row: RawRow, headers: string[]): boolean =>
  headers.some((h) => CURRENCY_SYMBOL_RE.test(row[h] ?? ""));

// Length of the first date-shaped value in the row — separates "15/05/2026" from "15/05/26"
// in files concatenated from exports with different date settings.
const dateLikeLength = (row: RawRow, headers: string[]): number => {
  for (const h of headers) {
    const v = (row[h] ?? "").trim();
    if (DATE_LIKE_RE.test(v)) return v.length;
  }
  return 0;
};

// Captures the "shape" of a row without interpreting what any column means: which categorical
// candidate values it carries, which fields are populated vs. blank (the empty-pattern is what
// tells a dividend row — no quantity/price — apart from a buy/sell row), and a few format
// anomalies. Two rows with the same signature are, structurally, the same kind of row.
export function buildSignature(row: RawRow, headers: string[], categoricalCandidates: string[]): string {
  return [
    ...categoricalCandidates.map((c) => (row[c] ?? "").trim()),
    headers.map((h) => (isEmpty(row[h]) ? "0" : "1")).join(""),
    hasNegativeValue(row, headers) ? "NEG" : "",
    hasParentheses(row, headers) ? "PAR" : "",
    hasCurrencySymbol(row, headers) ? "CUR" : "",
    String(dateLikeLength(row, headers)),
  ].join("|");
}
