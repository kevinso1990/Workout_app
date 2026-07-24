// 1 kg increments — users expect per-kilo control on the slider (2.5 kg jumps
// felt too coarse and always landed on odd values like 22.5). Exact/half-kg
// values (e.g. fixed 22.5 kg dumbbells) are still enterable via tap-to-type,
// which uses clampAndFormatWeightExact and does NOT snap to this step.
export const WEIGHT_SLIDER_STEP_KG = 1;

export function roundToStepWeight(value: number, step = WEIGHT_SLIDER_STEP_KG): number {
  return Math.round(value / step) * step;
}

export function clampAndFormatWeight(raw: string): string {
  const n = parseFloat(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return "";
  const clamped = Math.min(500, Math.max(0, n));
  const stepped = roundToStepWeight(clamped);
  return stepped % 1 === 0 ? String(stepped) : stepped.toFixed(1);
}

/**
 * Clamps/formats a typed weight WITHOUT snapping to the 2.5kg slider step.
 * Use for direct numeric entry (tap-to-type) — the slider step exists to
 * make dragging usable, not to forbid exact values like 22kg fixed dumbbells.
 */
export function clampAndFormatWeightExact(raw: string): string {
  const n = parseFloat(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return "";
  const clamped = Math.min(500, Math.max(0, n));
  const rounded = Math.round(clamped * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}

export function clampAndFormatReps(raw: string): string {
  const n = parseInt(String(raw).replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.min(100, n));
}
