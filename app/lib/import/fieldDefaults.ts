import { detectDateFormat } from "../parser/dateFormat";

// The backend stores date_format as a Python strftime pattern (e.g. "%d/%m/%Y"); our local
// date-fns-based detector/parser works with date-fns patterns ("dd/MM/yyyy"). These convert
// between the two — order matters ("yyyy" must be replaced before the leftover "yy").
export function datefnsToStrftime(pattern: string): string {
  return pattern.replace(/yyyy/g, "%Y").replace(/yy/g, "%y").replace(/MM/g, "%m").replace(/dd/g, "%d");
}

export function strftimeToDatefns(pattern: string): string {
  return pattern.replace(/%Y/g, "yyyy").replace(/%y/g, "yy").replace(/%m/g, "MM").replace(/%d/g, "dd");
}

// Best-effort default whenever the AI proposes a date field, or the user (re)points it at a
// column — reuses the same detector the legacy manual-mapping flow already relies on.
// `ambiguous` (passed straight through from detectDateFormat) tells the caller whether this is
// a confident deduction or a guess that needs the user's explicit confirmation: several
// candidate patterns fit every value (e.g. every day happens to be <= 12, so dd/MM and MM/dd
// both "work" but disagree) or none does. date_format is already in the backend's strftime
// style, ready to store on the field mapping directly.
export function guessDateFormat(values: string[]): { date_format: string; ambiguous: boolean } {
  const { format, ambiguous } = detectDateFormat(values);
  return { date_format: datefnsToStrftime(format), ambiguous };
}

// Trailing-digit range is deliberately wide (not just 1-2): prices, exchange rates and crypto
// quantities routinely carry 3-8 decimal places, and undercounting these here is what used to
// push the guess towards "," on columns that are actually "."-decimal (see thousands guess below).
export function guessDecimalSeparator(values: string[]): "," | "." {
  const commaDecimals = values.filter((v) => /,\d{1,8}$/.test(v.trim())).length;
  const dotDecimals = values.filter((v) => /\.\d{1,8}$/.test(v.trim())).length;
  return commaDecimals >= dotDecimals ? "," : ".";
}

// A thousands separator is only claimed when a value shows genuine grouping: the candidate
// character repeats ("1.234.567") or is followed later by the real decimal marker
// ("1.234,56"). A single, unrepeated candidate followed only by exactly 3 trailing digits
// ("1.500") is indistinguishable from a plain 3-decimal fraction on its own, so it's also
// required that no value in the column uses the same candidate character with a *different*
// number of trailing digits — a mix (e.g. "1.00" alongside "0.500") proves the column uses it
// as a decimal point with varying precision (common for fractional/crypto quantities), not as
// grouping. Misreading it as grouping would strip the character from every value in the column
// (turning "1.00" into "100"), which is exactly the bug this guards against.
export function guessThousandsSeparator(values: string[], decimalSeparator: "," | "."): "," | "." | null {
  const candidate = decimalSeparator === "," ? "." : ",";
  const escaped = candidate === "." ? "\\." : ",";
  const groupingRe = new RegExp(`\\d${escaped}\\d{3}(?:\\D|$)`);
  const trailingRe = new RegExp(`${escaped}(\\d+)$`);

  let sawGrouping = false;
  let sawOtherPrecision = false;
  for (const raw of values) {
    const s = raw.trim();
    if (groupingRe.test(s)) sawGrouping = true;
    const match = s.match(trailingRe);
    if (match && match[1].length !== 3) sawOtherPrecision = true;
  }
  return sawGrouping && !sawOtherPrecision ? candidate : null;
}
