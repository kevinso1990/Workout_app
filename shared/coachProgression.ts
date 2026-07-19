/**
 * Conservative, volume-aware auto-progression (shared client + server).
 * AI suggests; the athlete always has final control in the UI.
 */

export type ProgressionConfidence = "increase" | "hold" | "decrease";

export type ProgressionContextKey =
  | "volumeProtectionHold"
  | "volumeProtectionDeload"
  | "conservativeMode"
  | "standardIncrease"
  | "standardHold"
  | "standardDecrease";

export interface LoggedSetSnapshot {
  weight: string;
  reps: string;
  rating?: "green" | "yellow" | "red" | null;
  completed?: boolean;
}

export interface VolumePerformanceAnalysis {
  totalTargetReps: number;
  totalLoggedReps: number;
  ratio: number;
  /** Logged volume below 90% of prescribed reps. */
  underperformed: boolean;
  /** Sharp drop in later sets or ratio below ~75%. */
  severe: boolean;
}

export interface AdaptiveProgressionInput {
  exerciseName: string;
  targetRepsLabel: string;
  targetRepsNumber?: number | null;
  plannedSetCount: number;
  lastSets: LoggedSetSnapshot[];
  conservativeCyclesRemaining: number;
}

export interface AdaptiveProgressionResult {
  recommendedWeight: number;
  recommendedReps: number;
  confidence: ProgressionConfidence;
  contextKey: ProgressionContextKey;
  contextParams?: Record<string, string | number>;
  /** Human-readable fallback (English) for legacy UI. */
  reason: string;
  /** Weight the engine suggested before any in-session edits (override tracking). */
  suggestedWeightKg: number;
  previousWorkingWeightKg: number;
}

const LARGE_COMPOUND_KEYWORDS = ["squat", "deadlift", "bench", "press", "row", "pull"];

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Parse plan rep prescription to a single target per working set. */
export function parseTargetRepsPerSet(
  repsLabel: string,
  targetRepsNumber?: number | null,
): number {
  if (targetRepsNumber != null && Number.isFinite(targetRepsNumber) && targetRepsNumber > 0) {
    return Math.floor(targetRepsNumber);
  }
  const t = (repsLabel || "").trim();
  const range = t.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) {
    const lo = parseInt(range[1], 10);
    if (Number.isFinite(lo) && lo > 0) return lo;
  }
  const n = parseInt(t.replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 8;
}

function parseLoggedReps(reps: string): number {
  const n = parseInt(String(reps).replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseLoggedWeight(weight: string): number {
  const n = parseFloat(String(weight).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function completedSets(lastSets: LoggedSetSnapshot[]): LoggedSetSnapshot[] {
  return lastSets.filter((s) => {
    const reps = parseLoggedReps(s.reps);
    return reps > 0 && (s.completed !== false);
  });
}

/** Previous session working weight (heaviest completed set). */
export function previousWorkingWeightKg(lastSets: LoggedSetSnapshot[]): number {
  const weights = completedSets(lastSets)
    .map((s) => parseLoggedWeight(s.weight))
    .filter((w) => w > 0);
  return weights.length ? Math.max(...weights) : 0;
}

/**
 * Compare target reps vs logged reps across completed sets.
 * Example: 10-10-10 target vs 10-8-6 logged → underperformed + severe.
 */
export function analyzeVolumePerformance(
  lastSets: LoggedSetSnapshot[],
  targetRepsPerSet: number,
): VolumePerformanceAnalysis | null {
  const done = completedSets(lastSets);
  if (done.length === 0 || targetRepsPerSet <= 0) return null;

  const loggedReps = done.map((s) => parseLoggedReps(s.reps));
  const totalTargetReps = done.length * targetRepsPerSet;
  const totalLoggedReps = loggedReps.reduce((a, b) => a + b, 0);
  const ratio = totalTargetReps > 0 ? totalLoggedReps / totalTargetReps : 1;

  const underperformed = ratio < 0.9;

  const finalTwo = loggedReps.slice(-2);
  const lateDrop =
    finalTwo.length >= 2 &&
    finalTwo[0] >= targetRepsPerSet * 0.85 &&
    finalTwo[finalTwo.length - 1] < targetRepsPerSet * 0.75;

  const lastBelow =
    loggedReps.length > 0 &&
    loggedReps[loggedReps.length - 1] < targetRepsPerSet * 0.7;

  const severe = ratio < 0.75 || lateDrop || lastBelow;

  return {
    totalTargetReps,
    totalLoggedReps,
    ratio,
    underperformed,
    severe,
  };
}

function weightIncrementKg(exerciseName: string): number {
  const lower = exerciseName.toLowerCase();
  const isCompound = LARGE_COMPOUND_KEYWORDS.some((kw) => lower.includes(kw));
  return isCompound ? 2.5 : 1.25;
}

function minWeightKg(exerciseName: string): number {
  return exerciseName.toLowerCase().includes("barbell") ? 20 : 0;
}

/**
 * Core progression: volume protection → conservative mode → standard e1RM rules.
 */
export function computeAdaptiveProgression(
  input: AdaptiveProgressionInput,
): AdaptiveProgressionResult | null {
  const valid = completedSets(input.lastSets);
  if (valid.length === 0) return null;

  const targetRepsPerSet = parseTargetRepsPerSet(
    input.targetRepsLabel,
    input.targetRepsNumber,
  );
  const wPrev = previousWorkingWeightKg(input.lastSets);
  if (wPrev <= 0) return null;

  const step = 1.25;
  const increment = weightIncrementKg(input.exerciseName);
  const minW = minWeightKg(input.exerciseName);

  const volume = analyzeVolumePerformance(input.lastSets, targetRepsPerSet);

  if (volume?.underperformed) {
    const deloadPct = volume.severe ? 0.9 : 0.95;
    const recommendedWeight = roundToStep(
      Math.max(minW, wPrev * deloadPct),
      step,
    );
    if (volume.severe) {
      return {
        recommendedWeight,
        recommendedReps: targetRepsPerSet,
        confidence: "decrease",
        contextKey: "volumeProtectionDeload",
        contextParams: {
          percent: Math.round((1 - deloadPct) * 100),
        },
        reason: `Reps fell short (${volume.totalLoggedReps}/${volume.totalTargetReps}) — slight deload`,
        suggestedWeightKg: recommendedWeight,
        previousWorkingWeightKg: wPrev,
      };
    }
    return {
      recommendedWeight: roundToStep(wPrev, step),
      recommendedReps: targetRepsPerSet,
      confidence: "hold",
      contextKey: "volumeProtectionHold",
      reason: `Reps dropped early (${volume.totalLoggedReps}/${volume.totalTargetReps}) — hold weight`,
      suggestedWeightKg: roundToStep(wPrev, step),
      previousWorkingWeightKg: wPrev,
    };
  }

  if (input.conservativeCyclesRemaining > 0) {
    const hold = roundToStep(wPrev, step);
    return {
      recommendedWeight: hold,
      recommendedReps: targetRepsPerSet,
      confidence: "hold",
      contextKey: "conservativeMode",
      contextParams: { cycles: input.conservativeCyclesRemaining },
      reason: "Conservative mode — matching your recent custom targets",
      suggestedWeightKg: hold,
      previousWorkingWeightKg: wPrev,
    };
  }

  const targetRepsNum = targetRepsPerSet;
  const setsWithE1RM = valid.map((s) => {
    const weight = parseLoggedWeight(s.weight);
    const reps = parseLoggedReps(s.reps);
    return { weight, reps, e1RM: weight * (1 + reps / 30) };
  });
  const worstSet = setsWithE1RM.reduce((min, s) => (s.e1RM < min.e1RM ? s : min));
  const averageWeight =
    setsWithE1RM.reduce((sum, s) => sum + s.weight, 0) / setsWithE1RM.length;
  const worstReps = worstSet.reps;

  let recommendedWeight: number;
  let confidence: ProgressionConfidence;
  let contextKey: ProgressionContextKey;
  let reason: string;

  if (worstReps >= targetRepsNum + 2) {
    recommendedWeight = roundToStep(averageWeight + increment, step);
    confidence = "increase";
    contextKey = "standardIncrease";
    reason = `All sets hit ${worstReps}+ reps — add ${increment} kg`;
  } else if (worstReps >= targetRepsNum) {
    recommendedWeight = roundToStep(averageWeight, step);
    confidence = "hold";
    contextKey = "standardHold";
    reason = `Worst set hit ${worstReps} reps — keep weight stable`;
  } else if (worstReps >= targetRepsNum - 2) {
    recommendedWeight = roundToStep(averageWeight - increment * 0.5, step);
    confidence = "decrease";
    contextKey = "standardDecrease";
    reason = `Worst set dropped to ${worstReps} reps — slight deload`;
  } else {
    recommendedWeight = roundToStep(averageWeight * 0.95, step);
    confidence = "decrease";
    contextKey = "standardDecrease";
    reason = `Worst set hit only ${worstReps} reps — reduce weight`;
  }

  recommendedWeight = Math.max(recommendedWeight, minW);

  return {
    recommendedWeight,
    recommendedReps: targetRepsPerSet,
    confidence,
    contextKey,
    contextParams:
      contextKey === "standardIncrease" ? { kg: increment } : undefined,
    reason,
    suggestedWeightKg: recommendedWeight,
    previousWorkingWeightKg: wPrev,
  };
}

/** User logged below the engine suggestion (manual override downward). */
export function didUserOverrideSuggestion(
  suggestedWeightKg: number,
  maxLoggedWeightKg: number,
  epsilonKg = 0.25,
): boolean {
  if (suggestedWeightKg <= 0 || maxLoggedWeightKg <= 0) return false;
  return maxLoggedWeightKg < suggestedWeightKg - epsilonKg;
}
