// Fixed categorical order — CVD-validated (worst adjacent ΔE 24.2), never reordered/cycled per slot.
// Reference: dataviz skill's default palette (no brand-specific categorical scheme defined yet).
export const CATEGORICAL_PALETTE = [
  "#2a78d6", // 1 blue
  "#1baf7a", // 2 aqua
  "#eda100", // 3 yellow
  "#008300", // 4 green
  "#4a3aa7", // 5 violet
  "#e34948", // 6 red
  "#e87ba4", // 7 magenta
  "#eb6834", // 8 orange
];

// The aggregate "All portfolios" is the whole, not one more portfolio: a neutral ink (drawn
// dashed where it's a line) rather than the next hue.
export const AGGREGATE_COLOR = "#44403c";
const FALLBACK_COLOR = "#94a3b8";

/**
 * Each portfolio's colour, the same on every page: the standard portfolios take the palette in
 * list order (so selecting or hiding some never repaints the rest), the aggregate its own ink.
 * Past the palette's 8 hues, a neutral grey rather than a generated hue.
 */
export function portfolioColorMap(portfolios: { uuid: string; isAggregate: boolean }[]): (uuid: string) => string {
  const map = new Map<string, string>();
  let i = 0;
  for (const p of portfolios) map.set(p.uuid, p.isAggregate ? AGGREGATE_COLOR : CATEGORICAL_PALETTE[i++] ?? FALLBACK_COLOR);
  return (uuid) => map.get(uuid) ?? FALLBACK_COLOR;
}
