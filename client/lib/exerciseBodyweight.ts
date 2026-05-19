import type { Exercise } from "@/lib/storage";

const BODYWEIGHT_NAME =
  /\b(push[- ]?up|pull[- ]?up|chin[- ]?up|dip|plank|burpee|muscle[- ]?up|handstand|sit[- ]?up|crunch|leg\s*raise|pike|l[- ]?sit|bodyweight|air\s*squat|glute\s*bridge|hyperextension|sissy\s*squat)\b/i;

/** True when set logging should hide weight and require reps only. */
export function isBodyweightExercise(
  exercise: Pick<Exercise, "name"> & {
    equipment?: string | null;
    mechanics?: string | null;
  },
): boolean {
  const eq = exercise.equipment?.trim().toLowerCase() ?? "";
  if (eq === "bodyweight") return true;

  const mech = exercise.mechanics?.trim().toLowerCase() ?? "";
  if (mech === "calisthenics" || mech === "bodyweight") return true;

  return BODYWEIGHT_NAME.test(exercise.name.trim());
}
