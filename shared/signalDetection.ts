/**
 * Structured performance signals for plan adaptation gating.
 * Reuses progression helpers from coachProgression — no duplicate e1RM math.
 */

import {
  previousWorkingWeightKg,
  type LoggedSetSnapshot,
} from "./coachProgression";

export type PerformanceSignalType =
  | "PLATEAU"
  | "OVERREACH"
  | "UNDERLOAD"
  | "MISSED_SESSIONS";

export interface PerformanceSignal {
  type: PerformanceSignalType;
  exercise_name?: string;
  sessions_analyzed: number;
  summary: string;
}

export interface SignalDetectionSession {
  completedAt: string;
  exercises: { id: string; name: string }[];
  exerciseProgress?: {
    exerciseId: string;
    sets: LoggedSetSnapshot[];
  }[];
}

export interface SignalDetectionPlan {
  id: string;
  daysPerWeek: number;
  createdAt: string;
}

function sortSessionsChronological(
  sessions: SignalDetectionSession[],
): SignalDetectionSession[] {
  return [...sessions].sort(
    (a, b) =>
      new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
  );
}

function dominantRating(
  sets: LoggedSetSnapshot[],
): "green" | "yellow" | "red" | null {
  const done = sets.filter((s) => s.completed !== false);
  if (done.length === 0) return null;
  const counts = { green: 0, yellow: 0, red: 0 };
  for (const s of done) {
    if (s.rating === "green") counts.green += 1;
    else if (s.rating === "yellow") counts.yellow += 1;
    else if (s.rating === "red") counts.red += 1;
  }
  const total = counts.green + counts.yellow + counts.red;
  if (total === 0) return null;
  if (counts.red >= counts.yellow && counts.red >= counts.green && counts.red > 0) {
    return "red";
  }
  if (counts.green >= counts.yellow && counts.green >= counts.red && counts.green > 0) {
    return "green";
  }
  if (counts.yellow > 0) return "yellow";
  return null;
}

function sessionExerciseRatings(
  session: SignalDetectionSession,
): { name: string; rating: "green" | "yellow" | "red" }[] {
  const out: { name: string; rating: "green" | "yellow" | "red" }[] = [];
  for (const ep of session.exerciseProgress ?? []) {
    const ex = session.exercises.find((e) => e.id === ep.exerciseId);
    const rating = dominantRating(ep.sets);
    if (!rating || rating === "yellow") continue;
    out.push({ name: ex?.name ?? ep.exerciseId, rating });
  }
  return out;
}

function detectPlateauSignals(
  sessions: SignalDetectionSession[],
): PerformanceSignal[] {
  const signals: PerformanceSignal[] = [];
  const byExercise = new Map<string, { name: string; weights: number[]; ratings: ("yellow" | "red")[] }>();

  for (const session of sessions) {
    for (const ep of session.exerciseProgress ?? []) {
      const ex = session.exercises.find((e) => e.id === ep.exerciseId);
      const name = ex?.name ?? ep.exerciseId;
      const weight = previousWorkingWeightKg(ep.sets);
      if (weight <= 0) continue;

      const entry = byExercise.get(ep.exerciseId) ?? {
        name,
        weights: [],
        ratings: [],
      };
      entry.weights.push(weight);
      const dom = dominantRating(ep.sets);
      if (dom === "yellow" || dom === "red") {
        entry.ratings.push(dom);
      }
      byExercise.set(ep.exerciseId, entry);
    }
  }

  for (const [, data] of byExercise) {
    if (data.weights.length < 3) continue;
    const tail = data.weights.slice(-3);
    const sameWeight = tail.every((w) => Math.abs(w - tail[0]) < 0.25);
    const hasHardFeedback = data.ratings.length > 0;
    if (sameWeight && hasHardFeedback) {
      const hard =
        data.ratings.filter((r) => r === "red").length >=
        data.ratings.filter((r) => r === "yellow").length
          ? "feedback trending red"
          : "feedback trending yellow/red";
      signals.push({
        type: "PLATEAU",
        exercise_name: data.name,
        sessions_analyzed: 3,
        summary: `${data.name} — ${tail[0]}kg for 3 sessions, ${hard}`,
      });
    }
  }

  return signals;
}

function detectOverreachSignals(
  sessions: SignalDetectionSession[],
): PerformanceSignal[] {
  if (sessions.length < 3) return [];
  const tail = sessions.slice(-3);
  const redMajority = tail.every((session) => {
    const ratings = sessionExerciseRatings(session);
    if (ratings.length === 0) return false;
    const redCount = ratings.filter((r) => r.rating === "red").length;
    return redCount > ratings.length / 2;
  });
  if (!redMajority) return [];
  return [
    {
      type: "OVERREACH",
      sessions_analyzed: 3,
      summary:
        "majority of sets marked hard in last 3 sessions — consider deload or volume reduction",
    },
  ];
}

function detectUnderloadSignals(
  sessions: SignalDetectionSession[],
): PerformanceSignal[] {
  if (sessions.length < 3) return [];
  const tail = sessions.slice(-3);

  const greenMajority = tail.every((session) => {
    const ratings = sessionExerciseRatings(session);
    if (ratings.length === 0) return false;
    const greenCount = ratings.filter((r) => r.rating === "green").length;
    return greenCount > ratings.length / 2;
  });
  if (!greenMajority) return [];

  const exerciseWeights = new Map<string, number[]>();
  for (const session of tail) {
    for (const ep of session.exerciseProgress ?? []) {
      const w = previousWorkingWeightKg(ep.sets);
      if (w <= 0) continue;
      const arr = exerciseWeights.get(ep.exerciseId) ?? [];
      arr.push(w);
      exerciseWeights.set(ep.exerciseId, arr);
    }
  }

  const stalled = [...exerciseWeights.values()].some(
    (weights) =>
      weights.length >= 3 &&
      weights.every((w) => Math.abs(w - weights[0]) < 0.25),
  );
  if (!stalled) return [];

  return [
    {
      type: "UNDERLOAD",
      sessions_analyzed: 3,
      summary:
        "majority green feedback with no weight increases over last 3 sessions — room to progress load",
    },
  ];
}

function detectMissedSessionSignals(
  plan: SignalDetectionPlan,
  sessions: SignalDetectionSession[],
): PerformanceSignal[] {
  const planStart = new Date(plan.createdAt).getTime();
  const weeks = Math.max(
    1,
    Math.floor((Date.now() - planStart) / (7 * 24 * 60 * 60 * 1000)),
  );
  const expected = weeks * Math.max(1, plan.daysPerWeek);
  const logged = sessions.length;
  const missed = expected - logged;
  if (missed < 2) return [];
  return [
    {
      type: "MISSED_SESSIONS",
      sessions_analyzed: weeks,
      summary: `${missed} expected sessions not logged this plan cycle (${logged}/${expected})`,
    },
  ];
}

/** Detect structured adaptation signals from plan-scoped session history. */
export function detectPerformanceSignals(
  plan: SignalDetectionPlan,
  sessions: SignalDetectionSession[],
): PerformanceSignal[] {
  const chronological = sortSessionsChronological(sessions);
  if (chronological.length === 0) return [];

  const signals: PerformanceSignal[] = [
    ...detectPlateauSignals(chronological),
    ...detectOverreachSignals(chronological),
    ...detectUnderloadSignals(chronological),
    ...detectMissedSessionSignals(plan, chronological),
  ];

  return signals;
}

export function formatSignalsForPrompt(signals: PerformanceSignal[]): string {
  if (signals.length === 0) return "";
  const parts = signals.map((s) => {
    const prefix = s.exercise_name
      ? `${s.type} on ${s.exercise_name}`
      : s.type;
    return `[${prefix} — ${s.summary}]`;
  });
  return `Detected performance signals: ${parts.join(", ")}. Adapt the plan to address these specific signals. Every proposed change must reference a detected signal. Do not make changes to exercises with no signal.`;
}
