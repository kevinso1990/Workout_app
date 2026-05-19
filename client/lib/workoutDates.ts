import type { WorkoutSession } from "@/lib/storage";

type TranslateFn = (key: string, opts?: Record<string, unknown>) => string;

/** True when the session has a valid completion timestamp. */
export function hasCompletedWorkoutSession(
  session: WorkoutSession | null | undefined,
): boolean {
  if (!session?.completedAt) return false;
  const date = new Date(session.completedAt);
  return !Number.isNaN(date.getTime());
}

/** Relative “last performed” label — only call when {@link hasCompletedWorkoutSession} is true. */
export function formatLastPerformedLabel(
  session: WorkoutSession,
  t: TranslateFn,
): string {
  const date = new Date(session.completedAt);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays <= 0) return t("startWorkout.lastPerformedToday");
  if (diffDays === 1) return t("startWorkout.lastPerformedYesterday");
  return t("startWorkout.lastPerformedDaysAgo", { count: diffDays });
}
