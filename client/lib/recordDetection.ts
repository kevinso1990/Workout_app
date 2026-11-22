import type { WorkoutSession } from "@/lib/storage";

/**
 * Earlier workouts an exercise needs before beating them counts as a record.
 * The first sessions with a new exercise are the athlete finding their working
 * weight: every heavier set "beat" an empty or one-session history, so a new
 * exercise celebrated a record on nearly every set.
 */
export const MIN_SESSIONS_FOR_RECORD = 2;

export interface RecordBaseline {
  /** Earlier workouts with at least one completed working set of the exercise. */
  sessions: number;
  /** Best weight × reps of any completed set in those workouts. */
  bestVolume: number;
}

export function recordBaseline(
  history: WorkoutSession[],
  exerciseName: string,
): RecordBaseline {
  let sessions = 0;
  let bestVolume = 0;
  for (const session of history) {
    const exList = session.exercises ?? [];
    const prog = session.exerciseProgress ?? [];
    let counted = false;
    for (let i = 0; i < exList.length; i++) {
      if ((exList[i]?.name ?? "") !== exerciseName) continue;
      for (const s of prog[i]?.sets ?? []) {
        if (!s.completed) continue;
        const w = parseFloat(String(s.weight).replace(",", ".")) || 0;
        const r = parseInt(String(s.reps), 10) || 0;
        if (w <= 0 || r <= 0) continue;
        bestVolume = Math.max(bestVolume, w * r);
        counted = true;
      }
    }
    if (counted) sessions++;
  }
  return { sessions, bestVolume };
}

/**
 * Whether a completed set is a record: it beats every earlier workout AND
 * every earlier set of this one. `sessionBest` is the volume of this
 * workout's current record for the exercise (0 if none yet), so a second set
 * at the same weight and reps is not a second record.
 */
export function isRecordSet(input: {
  baseline: RecordBaseline;
  sessionBest: number;
  weight: number;
  reps: number;
}): boolean {
  const { baseline, sessionBest, weight, reps } = input;
  if (baseline.sessions < MIN_SESSIONS_FOR_RECORD) return false;
  const volume = weight * reps;
  return volume > 0 && volume > Math.max(baseline.bestVolume, sessionBest);
}
