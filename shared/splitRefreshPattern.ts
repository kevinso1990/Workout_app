export const SPLIT_REFRESH_WEEKS_THRESHOLD = 4;
export const SPLIT_REFRESH_MIN_SESSIONS = 6;

export type SplitPatternSession = {
  planId: string;
  dayName: string;
  completedAt: string;
  exercises: { id: string; muscleGroup?: string; sets?: number }[];
  exerciseProgress?: {
    exerciseId: string;
    sets: { completed?: boolean }[];
  }[];
};

export type SplitPatternPlan = {
  id: string;
  name: string;
  days: { dayName: string }[];
};

type Bucket = "push" | "pull" | "legs" | "upper" | "lower" | "mixed";

const PUSH_MUSCLES = new Set(["chest", "shoulders", "triceps"]);
const PULL_MUSCLES = new Set(["back", "biceps", "traps", "forearms"]);
const LEG_MUSCLES = new Set(["legs"]);

function classifyDayName(dayName: string): Bucket | null {
  const d = dayName.toLowerCase();
  if (/push|chest|shoulder/.test(d)) return "push";
  if (/pull|back/.test(d)) return "pull";
  if (/leg|lower/.test(d)) return "legs";
  if (/upper/.test(d)) return "upper";
  if (/lower/.test(d) && !/full/.test(d)) return "lower";
  if (/full/.test(d)) return "mixed";
  return null;
}

function classifyByMuscles(session: SplitPatternSession): Bucket {
  const scores = { push: 0, pull: 0, legs: 0, upper: 0, lower: 0 };
  for (const ex of session.exercises) {
    const mg = (ex.muscleGroup || "").trim();
    const key = mg.charAt(0).toUpperCase() + mg.slice(1).toLowerCase();
    const sets =
      session.exerciseProgress?.find((ep) => ep.exerciseId === ex.id)?.sets
        .length ?? ex.sets ?? 1;
    if (PUSH_MUSCLES.has(key)) scores.push += sets;
    else if (PULL_MUSCLES.has(key)) scores.pull += sets;
    else if (LEG_MUSCLES.has(key)) scores.legs += sets;
    if (key !== "Legs") {
      scores.upper +=
        PUSH_MUSCLES.has(key) || PULL_MUSCLES.has(key) ? sets : 0;
    }
    if (LEG_MUSCLES.has(key)) scores.lower += sets;
  }

  const entries = Object.entries(scores).filter(([, v]) => v > 0) as [
    Bucket,
    number,
  ][];
  if (entries.length === 0) return "mixed";
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function sessionBucket(session: SplitPatternSession): Bucket {
  return classifyDayName(session.dayName) ?? classifyByMuscles(session);
}

function inferPlanSplitType(
  plan: SplitPatternPlan,
): "ppl" | "upper_lower" | "full" | "unknown" {
  const names = plan.days.map((d) => d.dayName.toLowerCase()).join(" ");
  const hasPush = /push/.test(names);
  const hasPull = /pull/.test(names);
  const hasLegs = /leg/.test(names);
  if (hasPush && hasPull && hasLegs) return "ppl";
  const hasUpper = /upper/.test(names);
  const hasLower = /lower/.test(names);
  if (hasUpper && hasLower) return "upper_lower";
  if (/full/.test(names) || plan.days.length <= 3) return "full";
  return "unknown";
}

export function detectSplitPatternMismatch(
  plan: SplitPatternPlan,
  sessions: SplitPatternSession[],
): { mismatch: boolean; summary: string } {
  const recent = sessions
    .filter((s) => s.planId === plan.id)
    .sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    )
    .slice(0, 12);

  if (recent.length < SPLIT_REFRESH_MIN_SESSIONS) {
    return { mismatch: false, summary: "" };
  }

  const counts: Record<string, number> = {};
  for (const s of recent) {
    const bucket = sessionBucket(s);
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }

  const splitType = inferPlanSplitType(plan);

  if (splitType === "ppl") {
    const push = counts.push ?? 0;
    const pull = counts.pull ?? 0;
    const legs = counts.legs ?? 0;
    const max = Math.max(push, pull, legs);
    const min = Math.min(push, pull, legs);
    if (max >= 2 && min === 0) {
      return {
        mismatch: true,
        summary: `logged ${push} push, ${pull} pull, ${legs} leg sessions recently`,
      };
    }
    if (max >= 2 && max / Math.max(min, 1) >= 2) {
      const dominant =
        max === push ? "push" : max === pull ? "pull" : "leg";
      return {
        mismatch: true,
        summary: `${dominant} sessions outnumber others (${push} push / ${pull} pull / ${legs} legs)`,
      };
    }
  }

  if (splitType === "upper_lower") {
    const upper = (counts.upper ?? 0) + (counts.push ?? 0) + (counts.pull ?? 0);
    const lower = (counts.lower ?? 0) + (counts.legs ?? 0);
    const max = Math.max(upper, lower);
    const min = Math.min(upper, lower);
    if (max >= 2 && max / Math.max(min, 1) >= 2) {
      return {
        mismatch: true,
        summary: `upper/lower balance skewed (${upper} upper-style vs ${lower} lower-style sessions)`,
      };
    }
  }

  return { mismatch: false, summary: "" };
}
