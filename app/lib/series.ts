import type { TimeSeries } from "../models/PortfolioData";

export interface SeriesPoint {
  date: string;
  value: number;
}

// The analytics endpoints return one point per day for the whole history (about 3,650 a
// decade per series), far more than a chart can draw legibly. Keeps an evenly spaced subset
// of at most `maxPoints` points, always including the last one so the chart ends on the
// latest value.
export function toChartPoints(series: TimeSeries, maxPoints = 400): SeriesPoint[] {
  const n = Math.min(series.dates.length, series.values.length);
  const step = Math.max(1, Math.ceil(n / maxPoints));
  const points: SeriesPoint[] = [];
  for (let i = 0; i < n; i += step) points.push({ date: series.dates[i], value: series.values[i] });
  if (n > 0 && (n - 1) % step !== 0) points.push({ date: series.dates[n - 1], value: series.values[n - 1] });
  return points;
}
