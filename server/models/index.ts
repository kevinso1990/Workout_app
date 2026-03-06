// All domain types for the workout tracker API.
// ── Auth entities ────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
}

/** Safe public shape — never include password_hash in responses */
export interface PublicUser {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface JwtPayload {
  sub: number;   // user id
  username: string;
}

export interface SignupBody {
  username: string;
  email: string;
  password: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}


// These replace `any` casts throughout the codebase.

// ── Core entities ────────────────────────────────────────────────────────────

export interface Exercise {
  id: number;
  name: string;
  muscle_group: string;
  equipment: string;
  is_custom: number; // 0 | 1
}

export interface PlanExercise {
  id: number;
  plan_id: number;
  exercise_id: number;
  sort_order: number;
  default_sets: number;
  default_reps: number;
  default_weight: number;
  superset_group: number | null;
  // joined from exercises table
  name: string;
  muscle_group: string;
}

export interface Plan {
  id: number;
  user_id: number | null;
  name: string;
  created_at: string;
}

export interface PlanWithExercises extends Plan {
  exercises: PlanExercise[];
}

export interface Session {
  id: number;
  plan_id: number;
  user_id: number | null;
  started_at: string;
  finished_at: string | null;
  rpe: number | null;
  notes: string | null;
}

export interface SessionRow extends Session {
  plan_name: string;
}

export interface SessionWithDetails extends SessionRow {
  sets: WorkoutSetRow[];
  feedback: FeedbackRow[];
  totalVolume: number;
  duration: number | null;
}

export interface WorkoutSet {
  id: number;
  session_id: number;
  exercise_id: number;
  set_number: number;
  weight: number;
  reps: number;
  is_drop_set: number; // 0 | 1
  parent_set_id: number | null;
  logged_at: string;
}

export interface WorkoutSetRow extends WorkoutSet {
  exercise_name: string;
  muscle_group: string;
}

export interface FeedbackRow {
  id: number;
  session_id: number;
  exercise_id: number;
  rating: "easy" | "right" | "hard";
  exercise_name: string;
}

export interface BodyWeight {
  id: number;
  weight_kg: number;
  logged_date: string;
  notes: string | null;
}

export interface MuscleFatigueRow {
  muscle_group: string;
  fatigue_score: number;
  last_trained_at: string;
}

export interface PushSubscriptionRow {
  id: number;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
}

// ── Derived / computed shapes ────────────────────────────────────────────────

export interface Recommendation {
  exercise_id: number;
  name: string;
  muscle_group: string;
  suggested_sets: number;
  suggested_reps: number;
  suggested_weight: number;
  reason: string;
}

export interface RecoveryStatus {
  muscle_group: string;
  recovery_percent: number;
  fatigue_score: number;
}

export interface StatsTotals {
  totalWorkouts: number;
  totalVolume: number;
  currentStreak: number;
  longestStreak: number;
}

export interface WeeklyVolumeRow {
  muscle_group: string;
  volume: number;
}

export interface PRRow {
  exercise_id: number;
  name: string;
  muscle_group: string;
  max_weight: number;
  reps: number;
}

export interface ExerciseHistoryRow {
  session_id: number;
  started_at: string;
  volume: number;
  total_sets: number;
}

export interface WeekRow {
  wk: string;
  cnt: number;
}

export interface WeeklyHistoryRow {
  week: string;
  week_start: string;
  volume: number;
}

export interface ConsistencyRow {
  workout_date: string;
  sessions: number;
  has_pr: number;
}

export interface ExerciseProgressRow {
  id: number;
  started_at: string;
  best_weight: number;
  estimated_1rm: number;
  volume: number;
  best_reps: number;
}

export interface ExercisePRRow {
  max_weight: number;
  max_reps: number;
  max_volume_set: number;
}

export interface MuscleVolumeRow {
  muscle_group: string;
  set_count: number;
  volume: number;
}

export interface LoggedExerciseRow {
  id: number;
  name: string;
  muscle_group: string;
  total_sets: number;
  last_used: string;
}

// ── Request body shapes ──────────────────────────────────────────────────────

export interface PlanExerciseInput {
  exercise_id: number;
  default_sets?: number;
  default_reps?: number;
  default_weight?: number;
  superset_group?: number | null;
}

export interface CreateExerciseBody {
  name: string;
  muscle_group: string;
}

export interface CreatePlanBody {
  name: string;
  exercises?: PlanExerciseInput[];
}

export interface UpdatePlanBody {
  name?: string;
  exercises?: PlanExerciseInput[];
}

export interface FinishSessionBody {
  finished_at: string;
  rpe?: number;
  notes?: string;
}

export interface LogSetBody {
  session_id: number;
  exercise_id: number;
  set_number: number;
  weight: number;
  reps: number;
  is_drop_set?: boolean;
  parent_set_id?: number | null;
  rir?: number | null;
}

export interface SubmitFeedbackBody {
  session_id: number;
  exercise_id: number;
  rating: "easy" | "right" | "hard";
}

export interface LogBodyWeightBody {
  weight_kg: number;
  logged_date?: string;
  notes?: string;
}

export interface AutoGeneratePlansBody {
  frequency: number;
  experience: string;
  goal: string;
  equipment?: string;
}

export interface AcceptRecommendationsBody {
  recommendations: Array<{
    exercise_id: number;
    suggested_weight: number;
    suggested_reps: number;
    suggested_sets: number;
  }>;
}

export interface SubscribePushBody {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}
