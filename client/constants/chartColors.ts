/**
 * Series colours for charts.
 *
 * These are NOT a licence to decorate. A chart series colour is data encoding:
 * it says "this slice is running, that one is boxing", and distinguishing
 * categories genuinely needs distinguishable hues. Two rules keep that from
 * eroding the identity:
 *
 * 1. They are deliberately NOT the plate colours. Plates encode LOAD — a red
 *    marker means top set, not "boxing" — so a chart slice must never be
 *    mistakable for one. The values here are muted well away from the plate
 *    ramp's saturation.
 *
 * 2. They must read on BOTH grounds. The same chart sits on a white card in
 *    light and an iron card in dark, so every value is a mid-tone: nothing so
 *    pale it dissolves into paper, nothing so dark it disappears into iron.
 *
 * Before this existed the charts used stock Tailwind brights — indigo, violet,
 * emerald — which is why the progress donut rendered as a large purple ring
 * that belonged to no part of the design system.
 */

/** Strength is the app's own subject, so it takes the iron of the identity. */
export const SERIES_IRON = "#6F7683";

export const SERIES_BLUE = "#4A7CA8";
export const SERIES_GREEN = "#4A8F68";
export const SERIES_AMBER = "#B8862F";
export const SERIES_PLUM = "#96617F";
export const SERIES_TEAL = "#3F8794";
export const SERIES_BRICK = "#A9564A";
export const SERIES_VIOLET = "#6E6396";

/**
 * Ordered ramp for series with no meaning of their own (a second tracked lift,
 * an extra breakdown). Adjacent entries are far apart in hue so a two- or
 * three-series chart is legible without a legend.
 */
export const CHART_SERIES = [
  SERIES_IRON,
  SERIES_BLUE,
  SERIES_AMBER,
  SERIES_GREEN,
  SERIES_PLUM,
  SERIES_TEAL,
  SERIES_BRICK,
  SERIES_VIOLET,
] as const;

export function chartSeriesColor(index: number): string {
  return CHART_SERIES[index % CHART_SERIES.length];
}
