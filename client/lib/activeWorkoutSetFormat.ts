export const WEIGHT_SLIDER_STEP_KG = 2.5;

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

export function clampAndFormatReps(raw: string): string {
  const n = parseInt(String(raw).replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.min(100, n));
}
