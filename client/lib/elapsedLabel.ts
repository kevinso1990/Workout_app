type TFunction = (key: string, opts?: Record<string, unknown>) => string;

/** "12 Min." / "3 Std." / "2 Tg." since `startedAt` — never "0 Min.". */
export function formatElapsed(t: TFunction, startedAt: number, now = Date.now()): string {
  const minutes = Math.max(1, Math.floor((now - startedAt) / 60000));
  if (minutes < 60) return t("plans.resume.minutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("plans.resume.hours", { count: hours });
  return t("plans.resume.days", { count: Math.floor(hours / 24) });
}
