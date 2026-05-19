/**
 * Exercise image utility for TrackYourLift.
 *
 * Images come from the yuhonas/free-exercise-db repository on GitHub.
 * URL format: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{ID}/0.jpg
 *
 * Keys in EXERCISE_IMAGE_IDS cover every name seeded in server/db.ts plus
 * common alternate spellings so existing workout history continues to work.
 */

const BASE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

/**
 * Maps exercise display names → free-exercise-db folder IDs.
 * Both plural and singular forms are included to handle workout history
 * saved under either convention.
 *
 * When the free-exercise-db has no exact match, the closest movement
 * pattern is used so users always see a relevant image rather than the
 * generic muscle-group placeholder.
 */
const EXERCISE_IMAGE_IDS: Record<string, string> = {
  // ── Chest ──────────────────────────────────────────────────────────
  "Bench Press":                   "Barbell_Bench_Press_-_Medium_Grip",
  "Barbell Bench Press":           "Barbell_Bench_Press_-_Medium_Grip",
  "Incline Barbell Bench Press":   "Barbell_Incline_Bench_Press_-_Medium_Grip",
  "Decline Barbell Bench Press":   "Barbell_Bench_Press_-_Medium_Grip",
  "Dumbbell Bench Press":          "Dumbbell_Bench_Press",
  "Incline Dumbbell Press":        "Incline_Dumbbell_Press",
  "Dumbbell Flyes":                "Dumbbell_Flyes",
  "Cable Flyes":                   "Cable_Crossover",
  "Machine Chest Press":           "Dumbbell_Bench_Press",
  "Pec Deck":                      "Dumbbell_Bench_Press",
  "Push-Ups":                      "Decline_Push-Up",
  "Chest Dips":                    "Dips_-_Chest_Version",
  "Landmine Press":                "Barbell_Shoulder_Press",
  "Diamond Push-Ups":              "Close-Grip_Push-Up_off_of_a_Dumbbell",
  "Dips":                          "Dips_-_Triceps_Version",

  // ── Back ───────────────────────────────────────────────────────────
  "Deadlift":                      "Barbell_Deadlift",
  "Barbell Row":                   "Bent_Over_Barbell_Row",
  "Barbell Rows":                  "Bent_Over_Barbell_Row",
  "Dumbbell Row":                  "Bent_Over_Two-Dumbbell_Row",
  "One-Arm Dumbbell Row":          "One-Arm_Dumbbell_Row",
  "Pendlay Row":                   "Bent_Over_Barbell_Row",
  "T-Bar Row":                     "Lying_T-Bar_Row",
  "Meadows Row":                   "Bent_Over_Barbell_Row",
  "Seated Cable Row":              "Elevated_Cable_Rows",
  "Seated Cable Rows":             "Elevated_Cable_Rows",
  "Lat Pulldown":                  "Close-Grip_Front_Lat_Pulldown",
  "Lat Pulldowns":                 "Close-Grip_Front_Lat_Pulldown",
  "Wide Grip Lat Pulldown":        "Full_Range-Of-Motion_Lat_Pulldown",
  "Wide-Grip Lat Pulldown":        "Full_Range-Of-Motion_Lat_Pulldown",
  "Pull-Ups":                      "Band_Assisted_Pull-Up",
  "Pull Ups":                      "Band_Assisted_Pull-Up",
  "Chin-Ups":                      "Band_Assisted_Pull-Up",
  "Cable Pullover":                "Barbell_Deadlift",
  "Straight Arm Pulldown":         "Barbell_Deadlift",
  "Machine Row":                   "Elevated_Cable_Rows",
  "Chest Supported Row":           "Dumbbell_Incline_Row",
  "Hyperextension":                "Hyperextensions_With_No_Hyperextension_Bench",
  "Trap Bar Deadlift":             "Barbell_Deadlift",
  "Rack Pull":                     "Barbell_Deadlift",
  "Good Morning":                  "Barbell_Deadlift",
  "Barbell Bent-Over Row":         "Bent_Over_Barbell_Row",
  "Barbell Back Squat":            "Barbell_Full_Squat",
  "Barbell Deadlift":              "Barbell_Deadlift",
  "Barbell Hip Thrust":            "Barbell_Hip_Thrust",
  "Barbell Overhead Press":        "Barbell_Shoulder_Press",
  "Deficit Deadlift":              "Barbell_Deadlift",

  // ── Shoulders ──────────────────────────────────────────────────────
  "Overhead Press":                "Barbell_Shoulder_Press",
  "Dumbbell Shoulder Press":       "Dumbbell_Shoulder_Press",
  "Arnold Press":                  "Arnold_Dumbbell_Press",
  "Arnold Dumbbell Press":         "Arnold_Dumbbell_Press",
  "Lateral Raise":                 "Cable_Seated_Lateral_Raise",
  "Lateral Raises":                "Cable_Seated_Lateral_Raise",
  "Cable Lateral Raise":           "Cable_Seated_Lateral_Raise",
  "Machine Lateral Raise":         "Cable_Seated_Lateral_Raise",
  "Front Raise":                   "Front_Dumbbell_Raise",
  "Front Raises":                  "Front_Dumbbell_Raise",
  "Rear Delt Fly":                 "Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench",
  "Rear Delt Flyes":               "Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench",
  "Bent-Over Rear Delt Flyes":     "Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench",
  "Face Pull":                     "Face_Pull",
  "Face Pulls":                    "Face_Pull",
  "Cable Face Pulls":              "Face_Pull",
  "Upright Row":                   "Barbell_Rear_Delt_Row",
  "Barbell Upright Row":           "Barbell_Rear_Delt_Row",
  "Behind The Neck Press":         "Barbell_Shoulder_Press",
  "Machine Shoulder Press":        "Dumbbell_Shoulder_Press",
  "Shrugs":                        "Barbell_Shrug",
  "Barbell Shrug":                 "Barbell_Shrug",
  "Barbell Shrugs":                "Barbell_Shrug",
  "Dumbbell Shrug":                "Dumbbell_Shrug",
  "Dumbbell Lateral Raises":       "Cable_Seated_Lateral_Raise",
  "Dumbbell Front Raises":         "Front_Dumbbell_Raise",

  // ── Biceps ─────────────────────────────────────────────────────────
  "Bicep Curls":                   "Barbell_Curl",
  "Barbell Curl":                  "Barbell_Curl",
  "Barbell Bicep Curl":            "Barbell_Curl",
  "Dumbbell Curl":                 "Dumbbell_Bicep_Curl",
  "Dumbbell Bicep Curl":           "Dumbbell_Bicep_Curl",
  "Hammer Curl":                   "Hammer_Curls",
  "Hammer Curls":                  "Hammer_Curls",
  "Preacher Curl":                 "Machine_Preacher_Curls",
  "Incline Dumbbell Curl":         "Incline_Dumbbell_Curl",
  "Cable Curl":                    "High_Cable_Curls",
  "Concentration Curl":            "Concentration_Curls",
  "EZ-Bar Curl":                   "EZ-Bar_Curl",
  "Spider Curl":                   "Lying_Cable_Curl",
  "Reverse Curl":                  "Barbell_Curl",
  "Bayesian Curl":                 "High_Cable_Curls",

  // ── Triceps ────────────────────────────────────────────────────────
  "Tricep Pushdown":               "Cable_Incline_Pushdown",
  "Tricep Pushdowns":              "Cable_Incline_Pushdown",
  "Cable Tricep Pushdown":         "Cable_Incline_Pushdown",
  "Rope Pushdown":                 "Cable_Incline_Pushdown",
  "Skull Crushers":                "EZ-Bar_Skullcrusher",
  "Overhead Tricep Extension":     "Dumbbell_One-Arm_Triceps_Extension",
  "Tricep Dips":                   "Dips_-_Triceps_Version",
  "Tricep Kickback":               "Dumbbell_One-Arm_Triceps_Extension",
  "Close Grip Bench Press":        "Close-Grip_Barbell_Bench_Press",
  "Close-Grip Bench Press":        "Close-Grip_Barbell_Bench_Press",
  "Cable Overhead Extension":      "Dumbbell_One-Arm_Triceps_Extension",
  "JM Press":                      "Close-Grip_Barbell_Bench_Press",

  // ── Legs ───────────────────────────────────────────────────────────
  "Squats":                        "Barbell_Full_Squat",
  "Barbell Squat":                 "Barbell_Full_Squat",
  "Front Squat":                   "Barbell_Full_Squat",
  "Goblet Squat":                  "Goblet_Squat",
  "Hack Squat":                    "Hack_Squat",
  "Leg Press":                     "Leg_Press",
  "Machine Leg Press":             "Leg_Press",
  "Leg Extension":                 "Leg_Extensions",
  "Machine Leg Extension":         "Leg_Extensions",
  "Leg Curl":                      "Lying_Leg_Curls",
  "Leg Curls":                     "Lying_Leg_Curls",
  "Seated Leg Curl":               "Lying_Leg_Curls",
  "Lying Leg Curl":                "Lying_Leg_Curls",
  "Romanian Deadlift":             "Barbell_Deadlift",
  "Stiff Leg Deadlift":            "Barbell_Deadlift",
  "Sumo Deadlift":                 "Barbell_Deadlift",
  "Bulgarian Split Squat":         "Barbell_Side_Split_Squat",
  "Walking Lunges":                "Dumbbell_Lunges",
  "Reverse Lunges":                "Dumbbell_Lunges",
  "Lunges":                        "Dumbbell_Lunges",
  "Dumbbell Lunges":               "Dumbbell_Lunges",
  "Hip Thrust":                    "Barbell_Hip_Thrust",
  "Glute Bridge":                  "Barbell_Glute_Bridge",
  "Step Ups":                      "Barbell_Step_Ups",
  "Sissy Squat":                   "Barbell_Full_Squat",
  "Standing Calf Raise":           "Donkey_Calf_Raises",
  "Standing Calf Raises":          "Donkey_Calf_Raises",
  "Calf Raises":                   "Donkey_Calf_Raises",
  "Seated Calf Raise":             "Barbell_Seated_Calf_Raise",
  "Seated Calf Raises":            "Barbell_Seated_Calf_Raise",
  "Leg Press Calf Raise":          "Calf_Press_On_The_Leg_Press_Machine",
  "Nordic Hamstring Curl":         "Lying_Leg_Curls",

  // ── Core ───────────────────────────────────────────────────────────
  "Plank":                         "Dead_Bug",
  "Side Plank":                    "Dead_Bug",
  "Russian Twist":                 "Cable_Russian_Twists",
  "Russian Twists":                "Cable_Russian_Twists",
  "Hanging Leg Raise":             "Hanging_Leg_Raise",
  "Cable Crunch":                  "Cable_Crunch",
  "Ab Wheel Rollout":              "Ab_Roller",
  "Mountain Climbers":             "Mountain_Climbers",
  "Dead Bug":                      "Dead_Bug",
  "Crunches":                      "Crunches",
  "Sit-Ups":                       "3_4_Sit-Up",
  "Decline Sit-Ups":               "3_4_Sit-Up",
  "Dragon Flag":                   "Hanging_Leg_Raise",
  "Pallof Press":                  "Cable_Crunch",
  "Woodchoppers":                  "Cable_Crunch",

  // ── Traps ──────────────────────────────────────────────────────────
  "Farmer's Walk":                 "Barbell_Shrug",

  // ── Forearms ───────────────────────────────────────────────────────
  "Wrist Curl":                    "Barbell_Curl",
  "Reverse Wrist Curl":            "Barbell_Curl",

  // ── Kettlebell exercises ────────────────────────────────────────────
  "KB Goblet Squat":               "Goblet_Squat",
  "KB Swing":                      "Barbell_Deadlift",
  "KB Romanian Deadlift":          "Barbell_Deadlift",
  "KB Lunges":                     "Dumbbell_Lunges",
  "KB Bulgarian Split Squat":      "Barbell_Side_Split_Squat",
  "KB Calf Raise":                 "Donkey_Calf_Raises",
  "KB Press":                      "Barbell_Shoulder_Press",
  "KB Push Press":                 "Barbell_Shoulder_Press",
  "KB Lateral Raise":              "Cable_Seated_Lateral_Raise",
  "KB Halo":                       "Cable_Seated_Lateral_Raise",
  "KB Floor Press":                "Dumbbell_Bench_Press",
  "KB Squeeze Press":              "Dumbbell_Bench_Press",
  "KB Row":                        "Bent_Over_Two-Dumbbell_Row",
  "KB Renegade Row":               "Bent_Over_Two-Dumbbell_Row",
  "KB High Pull":                  "Barbell_Rear_Delt_Row",
  "KB Clean":                      "Barbell_Deadlift",
  "KB Snatch":                     "Barbell_Deadlift",
  "KB Curl":                       "Dumbbell_Bicep_Curl",
  "KB Hammer Curl":                "Hammer_Curls",
  "KB Overhead Tricep Extension":  "Dumbbell_One-Arm_Triceps_Extension",
  "KB Skull Crusher":              "EZ-Bar_Skullcrusher",
  "KB Turkish Get-Up":             "Dead_Bug",
  "KB Windmill":                   "Cable_Seated_Lateral_Raise",
  "KB Russian Twist":              "Cable_Russian_Twists",
  "KB Farmer's Walk":              "Barbell_Shrug",
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
 * Covers every muscle_group value used in server/db.ts seedExercises().
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
  Legs:        { color: "#27AE60", icon: "chevrons-up",    label: "Legs" },
  Quads:       { color: "#27AE60", icon: "chevrons-up",    label: "Quads" },
  Hamstrings:  { color: "#16A085", icon: "chevrons-down",  label: "Hamstrings" },
  Calves:      { color: "#1ABC9C", icon: "arrow-down",     label: "Calves" },
  Glutes:      { color: "#D35400", icon: "star",           label: "Glutes" },
  Core:        { color: "#C0392B", icon: "circle",         label: "Core" },
  Traps:       { color: "#5D6D7E", icon: "arrow-up",       label: "Traps" },
  Forearms:    { color: "#F39C12", icon: "trending-up",    label: "Forearms" },
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
