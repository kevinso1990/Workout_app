/**
 * Exercise image utility for TrackYourLift.
 *
 * Images come from the yuhonas/free-exercise-db repository on GitHub.
 * URL format: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{ID}/0.jpg
 *
 * Keys in EXERCISE_IMAGE_IDS cover every name used in DEFAULT_EXERCISES plus
 * common alternate spellings so existing workout history continues to work.
 */

const BASE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

/**
 * Maps exercise display names → free-exercise-db folder IDs.
 * Both plural and singular forms are included to handle workout history
 * saved under either convention.
 */
const EXERCISE_IMAGE_IDS: Record<string, string> = {
  // ── Chest ──────────────────────────────────────────────────────────
  "Bench Press":               "Barbell_Bench_Press_-_Medium_Grip",
  "Barbell Bench Press":       "Barbell_Bench_Press_-_Medium_Grip",
  "Dumbbell Bench Press":      "Dumbbell_Bench_Press",
  "Incline Dumbbell Press":    "Incline_Dumbbell_Press",
  "Cable Flyes":               "Cable_Crossover",
  "Dumbbell Flyes":            "Dumbbell_Flyes",
  "Dips":                      "Dips_-_Triceps_Version",
  "Chest Dips":                "Dips_-_Chest_Version",
  "Push-Ups":                  "Push-Up",
  "Diamond Push-Ups":          "Close-Grip_Push-Up",

  // ── Back ───────────────────────────────────────────────────────────
  "Deadlift":                  "Barbell_Deadlift",
  "Barbell Rows":              "Bent_Over_Barbell_Row",
  "Barbell Row":               "Bent_Over_Barbell_Row",
  "Dumbbell Row":              "Dumbbell_Bent_Over_Row",
  "Lat Pulldowns":             "Wide-Grip_Lat_Pulldown",
  "Lat Pulldown":              "Wide-Grip_Lat_Pulldown",
  "Seated Cable Rows":         "Seated_Cable_Rows",
  "Seated Cable Row":          "Seated_Cable_Rows",
  "Pull Ups":                  "Pullups",
  "Pull-Ups":                  "Pullups",
  "Chin-Ups":                  "Pullups",
  "Hyperextension":            "Hyperextensions_With_No_Hyperextension_Bench",

  // ── Shoulders ──────────────────────────────────────────────────────
  "Overhead Press":            "Standing_Military_Press",
  "Dumbbell Shoulder Press":   "Dumbbell_Shoulder_Press",
  "Lateral Raise":             "Side_Lateral_Raise",
  "Lateral Raises":            "Side_Lateral_Raise",
  "Front Raise":               "Front_Dumbbell_Raise",
  "Front Raises":              "Front_Dumbbell_Raise",
  "Face Pull":                 "Face_Pull",
  "Face Pulls":                "Face_Pull",
  "Rear Delt Fly":             "Seated_Bent-Over_Rear_Delt_Raise",
  "Rear Delt Flyes":           "Seated_Bent-Over_Rear_Delt_Raise",
  "Shrugs":                    "Barbell_Shrug",
  "Barbell Shrug":             "Barbell_Shrug",
  "Dumbbell Shrug":            "Dumbbell_Shrug",

  // ── Biceps ─────────────────────────────────────────────────────────
  "Bicep Curls":               "Barbell_Curl",
  "Barbell Curl":              "Barbell_Curl",
  "Dumbbell Curl":             "Dumbbell_Bicep_Curl",
  "Hammer Curls":              "Hammer_Curls",
  "Hammer Curl":               "Hammer_Curls",
  "Preacher Curl":             "Preacher_Curl",
  "Incline Dumbbell Curl":     "Incline_Dumbbell_Curl",
  "Concentration Curl":        "Concentration_Curls",

  // ── Triceps ────────────────────────────────────────────────────────
  "Tricep Pushdowns":          "Triceps_Pushdown",
  "Tricep Pushdown":           "Triceps_Pushdown",
  "Skull Crushers":            "EZ-Bar_Skullcrusher",
  "Overhead Tricep Extension": "Dumbbell_One-Arm_Triceps_Extension",
  "Tricep Dips":               "Dips_-_Triceps_Version",
  "Tricep Kickback":           "Dumbbell_Tricep_Kickback",

  // ── Legs ───────────────────────────────────────────────────────────
  "Squats":                    "Barbell_Full_Squat",
  "Barbell Squat":             "Barbell_Full_Squat",
  "Goblet Squat":              "Dumbbell_Goblet_Squat",
  "Romanian Deadlift":         "Romanian_Deadlift_With_Dumbbells",
  "Leg Press":                 "Leg_Press",
  "Leg Curls":                 "Lying_Leg_Curls",
  "Leg Curl":                  "Lying_Leg_Curls",
  "Leg Extension":             "Leg_Extensions",
  "Calf Raises":               "Standing_Calf_Raises",
  "Lunges":                    "Dumbbell_Lunges",
  "Walking Lunges":            "Dumbbell_Lunges",
  "Reverse Lunges":            "Dumbbell_Lunges",
  "Bulgarian Split Squat":     "Dumbbell_Single_Leg_Split_Squat",
  "Hip Thrust":                "Barbell_Hip_Thrust",
  "Glute Bridge":              "Barbell_Glute_Bridge",
  "Sissy Squat":               "Sissy_Squat",
  "Step Ups":                  "Barbell_Step_Ups",

  // ── Core ───────────────────────────────────────────────────────────
  "Plank":                     "Plank",
  "Side Plank":                "Side_Plank",
  "Russian Twist":             "Russian_Twist",
  "Russian Twists":            "Russian_Twist",
  "Hanging Leg Raise":         "Hanging_Leg_Raise",
  "Cable Crunch":              "Cable_Crunch",
  "Ab Wheel Rollout":          "Ab_Roller",
  "Mountain Climbers":         "Mountain_Climbers",
  "Dead Bug":                  "Dead_Bug",
  "Crunches":                  "Crunches",
  "Sit-Ups":                   "Sit-Up",
};

/** Returns a GitHub CDN image URL for the exercise, or null if unmapped. */
export function getExerciseImageUrl(exerciseName: string): string | null {
  const id = EXERCISE_IMAGE_IDS[exerciseName];
  if (!id) return null;
  return `${BASE_URL}/${id}/0.jpg`;
}

/**
 * Per-muscle-group visual config used for the fallback card shown when
 * no image is available (unmapped exercise or network error).
 */
export const MUSCLE_GROUP_META: Record<
  string,
  { color: string; icon: string; label: string }
> = {
  Chest:       { color: "#E74C3C", icon: "activity",      label: "Chest" },
  Back:        { color: "#2980B9", icon: "anchor",         label: "Back" },
  Shoulders:   { color: "#8E44AD", icon: "wind",           label: "Shoulders" },
  "Rear Delts":{ color: "#7D3C98", icon: "rotate-ccw",     label: "Rear Delts" },
  Biceps:      { color: "#F39C12", icon: "trending-up",    label: "Biceps" },
  Triceps:     { color: "#E67E22", icon: "zap",            label: "Triceps" },
  Quads:       { color: "#27AE60", icon: "chevrons-up",    label: "Quads" },
  Hamstrings:  { color: "#16A085", icon: "chevrons-down",  label: "Hamstrings" },
  Calves:      { color: "#1ABC9C", icon: "arrow-down",     label: "Calves" },
  Glutes:      { color: "#D35400", icon: "star",           label: "Glutes" },
  Core:        { color: "#C0392B", icon: "circle",         label: "Core" },
};

/** Returns visual config for a muscle group, with a sensible default. */
export function getMuscleGroupMeta(muscleGroup: string) {
  return (
    MUSCLE_GROUP_META[muscleGroup] ?? {
      color: "#6B7280",
      icon: "activity",
      label: muscleGroup || "Exercise",
    }
  );
}
