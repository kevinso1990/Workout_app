/** Returns false for empty, whitespace, or known API “unavailable” placeholders. */
export function isCoachTipRenderable(tip: string | null | undefined): boolean {
  if (tip == null) return false;
  const trimmed = tip.trim();
  if (!trimmed) return false;
  return !/coach tip unavailable|coach-tipp derzeit nicht verfügbar/i.test(trimmed);
}
