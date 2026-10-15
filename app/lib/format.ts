export function formatCurrency(value: number, currency: string = "EUR", decimals: number = 2): string {
  // useGrouping "always": some locales (Italian, Spanish…) leave four-digit numbers ungrouped by
  // default, which put "7723 EUR" beside "19.975 EUR" in the same list.
  const options = { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: "always" } as Intl.NumberFormatOptions;
  return `${value.toLocaleString(undefined, options)} ${currency}`.trim();
}

// Quantities come from the backend as arbitrary-precision decimal strings (e.g. "0.001710320000000000"),
// often zero-padded to a fixed number of decimals. Trims insignificant trailing zeros for display via
// plain string manipulation — never via Number() — so precision beyond what a JS double can hold
// (the whole reason quantity is a string) isn't lost in the process.
export function formatQuantity(value: string | number): string {
  const s = typeof value === "number" ? value.toString() : value;
  if (!s.includes(".")) return s;
  return s.replace(/0+$/, "").replace(/\.$/, "");
}

// Short figure for chart axes, e.g. 1,250 → "1.3K", 2,400,000 → "2.4M". No currency code: the
// chart's header already names it, and a code on every tick makes the labels wide enough to wrap.
export function formatCompact(value: number): string {
  return value.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 });
}
