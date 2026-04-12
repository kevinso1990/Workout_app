import db from "../db";
import type { MuscleFatigueRow, RecoveryStatus } from "../models";

// ── Muscle → fatigue score mapping ──────────────────────────────────────────
// Primary muscles score 3 points per set, secondary score 1 point.

type MuscleMap = Record<string, { primary: string[]; secondary: string[] }>;

const EXERCISE_MUSCLE_MAP: MuscleMap = {
  "Barbell Bench Press": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Incline Barbell Bench Press": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Decline Barbell Bench Press": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Dumbbell Bench Press": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Incline Dumbbell Press": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Dumbbell Flyes": { primary: ["Chest"], secondary: [] },
  "Cable Flyes": { primary: ["Chest"], secondary: [] },
  "Machine Chest Press": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Pec Deck": { primary: ["Chest"], secondary: [] },
  "Push-Ups": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Chest Dips": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Landmine Press": { primary: ["Chest"], secondary: ["Shoulders"] },
  "KB Floor Press": { primary: ["Chest"], secondary: ["Triceps"] },
  "KB Squeeze Press": { primary: ["Chest"], secondary: ["Triceps"] },

  "Barbell Row": { primary: ["Back"], secondary: ["Biceps"] },
  "Dumbbell Row": { primary: ["Back"], secondary: ["Biceps"] },
  "Pendlay Row": { primary: ["Back"], secondary: ["Biceps"] },
  "T-Bar Row": { primary: ["Back"], secondary: ["Biceps"] },
  "Seated Cable Row": { primary: ["Back"], secondary: ["Biceps"] },
  "Lat Pulldown": { primary: ["Back"], secondary: ["Biceps"] },
  "Wide Grip Lat Pulldown": { primary: ["Back"], secondary: ["Biceps"] },
  "Pull-Ups": { primary: ["Back"], secondary: ["Biceps"] },
  "Chin-Ups": { primary: ["Back"], secondary: ["Biceps"] },
  "Cable Pullover": { primary: ["Back"], secondary: [] },
  "Straight Arm Pulldown": { primary: ["Back"], secondary: [] },
  "Machine Row": { primary: ["Back"], secondary: ["Biceps"] },
  "Meadows Row": { primary: ["Back"], secondary: ["Biceps"] },
  "Chest Supported Row": { primary: ["Back"], secondary: ["Biceps"] },
  "Deadlift": { primary: ["Back", "Legs"], secondary: ["Core"] },
  "Trap Bar Deadlift": { primary: ["Back", "Legs"], secondary: ["Core"] },
  "Rack Pull": { primary: ["Back"], secondary: ["Core"] },
  "Good Morning": { primary: ["Back"], secondary: ["Legs"] },
  "Hyperextension": { primary: ["Back"], secondary: ["Legs"] },
  "KB Row": { primary: ["Back"], secondary: ["Biceps"] },
  "KB Renegade Row": { primary: ["Back"], secondary: ["Core", "Biceps"] },
  "KB High Pull": { primary: ["Back"], secondary: ["Shoulders"] },
  "KB Clean": { primary: ["Back"], secondary: ["Shoulders", "Legs"] },
  "KB Snatch": { primary: ["Back"], secondary: ["Shoulders", "Legs"] },

  "Overhead Press": { primary: ["Shoulders"], secondary: ["Triceps"] },
  "Dumbbell Shoulder Press": { primary: ["Shoulders"], secondary: ["Triceps"] },
  "Arnold Press": { primary: ["Shoulders"], secondary: ["Triceps"] },
  "Lateral Raise": { primary: ["Shoulders"], secondary: [] },
  "Cable Lateral Raise": { primary: ["Shoulders"], secondary: [] },
  "Machine Lateral Raise": { primary: ["Shoulders"], secondary: [] },
  "Front Raise": { primary: ["Shoulders"], secondary: [] },
  "Rear Delt Fly": { primary: ["Shoulders"], secondary: [] },
  "Face Pull": { primary: ["Shoulders"], secondary: ["Back"] },
  "Upright Row": { primary: ["Shoulders"], secondary: ["Traps"] },
  "Behind The Neck Press": { primary: ["Shoulders"], secondary: ["Triceps"] },
  "Machine Shoulder Press": { primary: ["Shoulders"], secondary: ["Triceps"] },
  "KB Press": { primary: ["Shoulders"], secondary: ["Triceps"] },
  "KB Push Press": { primary: ["Shoulders"], secondary: ["Triceps", "Legs"] },
  "KB Lateral Raise": { primary: ["Shoulders"], secondary: [] },
  "KB Halo": { primary: ["Shoulders"], secondary: ["Core"] },

  "Barbell Squat": { primary: ["Legs"], secondary: ["Core"] },
  "Front Squat": { primary: ["Legs"], secondary: ["Core"] },
  "Goblet Squat": { primary: ["Legs"], secondary: ["Core"] },
  "Hack Squat": { primary: ["Legs"], secondary: [] },
  "Leg Press": { primary: ["Legs"], secondary: [] },
  "Leg Extension": { primary: ["Legs"], secondary: [] },
  "Leg Curl": { primary: ["Legs"], secondary: [] },
  "Seated Leg Curl": { primary: ["Legs"], secondary: [] },
  "Romanian Deadlift": { primary: ["Legs"], secondary: ["Back"] },
  "Stiff Leg Deadlift": { primary: ["Legs"], secondary: ["Back"] },
  "Sumo Deadlift": { primary: ["Legs"], secondary: ["Back", "Core"] },
  "Bulgarian Split Squat": { primary: ["Legs"], secondary: [] },
  "Walking Lunges": { primary: ["Legs"], secondary: [] },
  "Reverse Lunges": { primary: ["Legs"], secondary: [] },
  "Hip Thrust": { primary: ["Legs"], secondary: [] },
  "Glute Bridge": { primary: ["Legs"], secondary: [] },
  "Step Ups": { primary: ["Legs"], secondary: [] },
  "Sissy Squat": { primary: ["Legs"], secondary: [] },
  "Leg Press Calf Raise": { primary: ["Legs"], secondary: [] },
  "Standing Calf Raise": { primary: ["Legs"], secondary: [] },
  "Seated Calf Raise": { primary: ["Legs"], secondary: [] },
  "KB Goblet Squat": { primary: ["Legs"], secondary: ["Core"] },
  "KB Swing": { primary: ["Legs"], secondary: ["Back", "Core"] },
  "KB Romanian Deadlift": { primary: ["Legs"], secondary: ["Back"] },
  "KB Lunges": { primary: ["Legs"], secondary: [] },
  "KB Bulgarian Split Squat": { primary: ["Legs"], secondary: [] },
  "KB Calf Raise": { primary: ["Legs"], secondary: [] },

  "Barbell Curl": { primary: ["Biceps"], secondary: [] },
  "Dumbbell Curl": { primary: ["Biceps"], secondary: [] },
  "Hammer Curl": { primary: ["Biceps"], secondary: ["Forearms"] },
  "Preacher Curl": { primary: ["Biceps"], secondary: [] },
  "Incline Dumbbell Curl": { primary: ["Biceps"], secondary: [] },
  "Cable Curl": { primary: ["Biceps"], secondary: [] },
  "Concentration Curl": { primary: ["Biceps"], secondary: [] },
  "EZ-Bar Curl": { primary: ["Biceps"], secondary: [] },
  "Spider Curl": { primary: ["Biceps"], secondary: [] },
  "Bayesian Curl": { primary: ["Biceps"], secondary: [] },
  "Reverse Curl": { primary: ["Biceps"], secondary: ["Forearms"] },
  "KB Curl": { primary: ["Biceps"], secondary: [] },
  "KB Hammer Curl": { primary: ["Biceps"], secondary: ["Forearms"] },

  "Tricep Pushdown": { primary: ["Triceps"], secondary: [] },
  "Overhead Tricep Extension": { primary: ["Triceps"], secondary: [] },
  "Skull Crushers": { primary: ["Triceps"], secondary: [] },
  "Close Grip Bench Press": { primary: ["Triceps"], secondary: ["Chest"] },
  "Tricep Dips": { primary: ["Triceps"], secondary: ["Chest", "Shoulders"] },
  "Tricep Kickback": { primary: ["Triceps"], secondary: [] },
  "Cable Overhead Extension": { primary: ["Triceps"], secondary: [] },
  "Diamond Push-Ups": { primary: ["Triceps"], secondary: ["Chest"] },
  "JM Press": { primary: ["Triceps"], secondary: ["Chest"] },
  "KB Overhead Tricep Extension": { primary: ["Triceps"], secondary: [] },
  "KB Skull Crusher": { primary: ["Triceps"], secondary: [] },

  "Plank": { primary: ["Core"], secondary: [] },
  "Side Plank": { primary: ["Core"], secondary: [] },
  "Crunches": { primary: ["Core"], secondary: [] },
  "Russian Twist": { primary: ["Core"], secondary: [] },
  "Hanging Leg Raise": { primary: ["Core"], secondary: [] },
  "Cable Crunch": { primary: ["Core"], secondary: [] },
  "Ab Wheel Rollout": { primary: ["Core"], secondary: [] },
  "Mountain Climbers": { primary: ["Core"], secondary: [] },
  "Dead Bug": { primary: ["Core"], secondary: [] },
  "Sit-Ups": { primary: ["Core"], secondary: [] },
  "Pallof Press": { primary: ["Core"], secondary: [] },
  "Woodchoppers": { primary: ["Core"], secondary: [] },
  "Decline Sit-Ups": { primary: ["Core"], secondary: [] },
  "Dragon Flag": { primary: ["Core"], secondary: [] },
  "KB Turkish Get-Up": { primary: ["Core"], secondary: ["Shoulders", "Legs"] },
  "KB Windmill": { primary: ["Core"], secondary: ["Shoulders"] },
  "KB Russian Twist": { primary: ["Core"], secondary: [] },

  "Barbell Shrug": { primary: ["Traps"], secondary: [] },
  "Dumbbell Shrug": { primary: ["Traps"], secondary: [] },
  "Farmer's Walk": { primary: ["Traps"], secondary: ["Forearms"] },
  "KB Farmer's Walk": { primary: ["Traps"], secondary: ["Forearms"] },

  "Wrist Curl": { primary: ["Forearms"], secondary: [] },
  "Reverse Wrist Curl": { primary: ["Forearms"], secondary: [] },
  "Plate Pinch": { primary: ["Forearms"], secondary: [] },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMuscleScores(
  exerciseName: string,
  muscleGroup: string,
): { muscle: string; score: number }[] {
  const mapping = EXERCISE_MUSCLE_MAP[exerciseName];
  if (mapping) {
    return [
      ...mapping.primary.map((m) => ({ muscle: m, score: 3 })),
      ...mapping.secondary.map((m) => ({ muscle: m, score: 1 })),
    ];
  }
  return [{ muscle: muscleGroup, score: 3 }];
}

// ── Public service functions ─────────────────────────────────────────────────

/**
 * Called after a session is finished. Computes per-muscle fatigue scores based
 * on the sets logged and stores them in the `muscle_fatigue` table.
 */
export function calculateAndStoreFatigue(sessionId: number): void {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as
    | { finished_at: string | null }
    | undefined;
  if (!session?.finished_at) return;

  const sets = db
    .prepare(
      `SELECT st.exercise_id, e.name, e.muscle_group, COUNT(*) as set_count
       FROM sets st
       JOIN exercises e ON e.id = st.exercise_id
       WHERE st.session_id = ?
       GROUP BY st.exercise_id`,
    )
    .all(sessionId) as { exercise_id: number; name: string; muscle_group: string; set_count: number }[];

  const fatigueMap: Record<string, number> = {};
  for (const s of sets) {
    for (const { muscle, score } of getMuscleScores(s.name, s.muscle_group)) {
      fatigueMap[muscle] = (fatigueMap[muscle] ?? 0) + score * Math.min(s.set_count, 6);
    }
  }

  const insert = db.prepare(
    "INSERT INTO muscle_fatigue (muscle_group, fatigue_score, last_trained_at, session_id) VALUES (?, ?, ?, ?)",
  );

  db.transaction(() => {
    for (const [muscle, score] of Object.entries(fatigueMap)) {
      insert.run(muscle, score, session.finished_at, sessionId);
    }
  })();
}

const ALL_MUSCLES = [
  "Chest", "Back", "Shoulders", "Legs",
  "Biceps", "Triceps", "Core", "Traps", "Forearms",
];
const MAX_FATIGUE = 18;

export function getRecovery(): RecoveryStatus[] {
  // Fatigue fully decays after 18 days (MAX_FATIGUE / 1 point per day).
  // Capping the scan to 20 days prevents unbounded table growth from affecting
  // recovery queries on long-lived databases.
  const rows = db
    .prepare(
      `SELECT muscle_group, fatigue_score, last_trained_at
       FROM muscle_fatigue
       WHERE last_trained_at > datetime('now', '-20 days')
       ORDER BY last_trained_at DESC`,
    )
    .all() as MuscleFatigueRow[];

  // Initialise every muscle to zero fatigue
  const muscleData: Record<string, number> = Object.fromEntries(
    ALL_MUSCLES.map((m) => [m, 0]),
  );

  const now = Date.now();
  for (const row of rows) {
    // Fatigue decays by 1 point per 24 hours
    const hoursAgo =
      (now - new Date(row.last_trained_at + "Z").getTime()) / (1000 * 60 * 60);
    const decayedScore = Math.max(0, row.fatigue_score - hoursAgo / 24);
    if (decayedScore > 0 && muscleData[row.muscle_group] !== undefined) {
      muscleData[row.muscle_group] += decayedScore;
    }
  }

  return ALL_MUSCLES.map((muscle) => {
    const fatigue = Math.min(muscleData[muscle], MAX_FATIGUE);
    return {
      muscle_group: muscle,
      recovery_percent: Math.round(Math.max(0, (1 - fatigue / MAX_FATIGUE)) * 100),
      fatigue_score: Math.round(fatigue * 10) / 10,
    };
  });
}
