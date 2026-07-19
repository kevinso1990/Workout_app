import type { WorkoutPlan, WorkoutSession } from "./storage";

/**
 * Text block for the coach / LLM: recent sessions that include this exercise name.
 */
export function buildSwapHistoryText(
  exerciseName: string,
  sessions: WorkoutSession[],
  maxSessions = 6,
): string {
  const needle = exerciseName.trim().toLowerCase();
  if (!needle) return "";

  const lines: string[] = [];
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  let count = 0;
  for (const s of sorted) {
    const idx = s.exercises.findIndex((e) => e.name.trim().toLowerCase() === needle);
    if (idx < 0) continue;
    const ex = s.exercises[idx];
    const ep = s.exerciseProgress?.find((p) => p.exerciseId === ex.id);
    const parts: string[] = [];
    if (ep?.sets?.length) {
      for (const st of ep.sets) {
        if (!st.completed) continue;
        const w = typeof st.weight === "string" ? st.weight.trim() : "";
        const r = typeof st.reps === "string" ? st.reps.trim() : "";
        if (w || r) parts.push(`${w || "?"}kg×${r || "?"}`);
      }
    }
    const date = s.completedAt?.slice(0, 10) ?? "?";
    lines.push(`- ${date} ${s.dayName}: ${parts.join(", ") || "no set data"}`);
    count++;
    if (count >= maxSessions) break;
  }
  return lines.join("\n");
}

/** True when logged reps hit the prescribed target (single number or inclusive range). */
export function repsMeetsTarget(reps: number, targetReps?: string | null): boolean {
  if (!targetReps?.trim()) return false;
  const t = targetReps.trim();
  const range = t.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) {
    const lo = parseInt(range[1], 10);
    const hi = parseInt(range[2], 10);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return false;
    return reps >= lo && reps <= hi;
  }
  const n = parseInt(t.replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return false;
  return reps === n;
}

export function buildDailyBriefingPayload(
  plans: WorkoutPlan[],
  sessions: WorkoutSession[],
  language: string,
): { locale: "de" | "en"; planSummary: string; sessionSummary: string } {
  const locale: "de" | "en" = language.startsWith("de") ? "de" : "en";

  const planSummary = plans
    .slice(0, 5)
    .map((p) => {
      const dayLines = p.days.map((d) => {
        const names = d.exercises.map((e) => e.name).slice(0, 8).join(", ");
        return `  ${d.dayName}: ${names}`;
      });
      return `Plan "${p.name}" (${p.daysPerWeek} d/w):\n${dayLines.join("\n")}`;
    })
    .join("\n\n");

  const recent = [...sessions]
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 10);

  const sessionSummary = recent
    .map((s) => {
      const names = s.exercises.map((e) => e.name).slice(0, 8).join(", ");
      return `${(s.completedAt || "").slice(0, 10)} — ${s.planName} / ${s.dayName}: ${names}`;
    })
    .join("\n");

  return { locale, planSummary, sessionSummary };
}
