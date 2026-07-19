// All domain types for the workout tracker API.
// ── Auth entities ────────────────────────────────────────────────────────────

export type SubscriptionTier = "free" | "pro";
export type SubscriptionProvider = "apple" | "google";

/**
 * OAuth identity provider. "google" and "apple" are the real providers used in
 * production. "dev" is a special local-only identity minted by the dev-login
 * route for testing the web frontend without going through real OAuth — it is
 * never accepted by Google/Apple verification, only by the gated dev endpoint.
 */
export type AuthProvider = "google" | "apple" | "dev" | "guest" | "email";

export interface User {
  id: number;
  username: string | null;
  email: string;
  password_hash: string | null;
  name: string | null;
  avatar_url: string | null;
  provider: AuthProvider | null;
  provider_id: string | null;
  created_at: string;
  subscription_tier: SubscriptionTier;
  subscription_provider: SubscriptionProvider | null;
  subscription_expires_at: string | null;
}

/** Safe public shape — strips secret/internal fields before returning to clients. */
export interface PublicUser {
  id: number;
  username: string | null;
  email: string;
  name: string | null;
  avatar_url: string | null;
  provider: AuthProvider | null;
  created_at: string;
  subscription_tier: SubscriptionTier;
  subscription_provider: SubscriptionProvider | null;
  subscription_expires_at: string | null;
}

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  isPro: boolean;
  provider: SubscriptionProvider | null;
  expiresAt: string | null;
}

export interface SubscriptionReceiptRow {
  id: number;
  user_id: number;
  provider: SubscriptionProvider;
  original_transaction_id: string;
  product_id: string | null;
  expires_at: string | null;
  status: "active" | "expired" | "cancelled" | "refunded";
  raw_response: string | null;
  created_at: string;
  updated_at: string;
}

export interface ValidateAppleReceiptBody {
  receiptData: string; // base64-encoded receipt from StoreKit
  isSandbox?: boolean;
}

export interface ValidateGooglePurchaseBody {
  packageName: string;
  subscriptionId: string; // matches GOOGLE_PRODUCT_ID env var
  purchaseToken: string;
}

export interface JwtPayload {
  sub: number;       // user id
  email: string;
  provider: AuthProvider;
}

/** POST /api/auth/google */
export interface GoogleAuthBody {
  /** Google ID token (the JWT returned by Google Sign-In on the client). */
  id_token: string;
}

/** POST /api/auth/apple */
export interface AppleAuthBody {
  /** Apple identity token (the JWT returned by Sign in with Apple). */
  id_token: string;
  /**
   * Apple only returns the user's name on the very first sign-in. Clients
   * should pass it through here so we can persist it on user creation.
   */
  name?: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

/** Normalised identity payload extracted from a verified Google/Apple ID token. */
export interface OAuthIdentity {
  provider: AuthProvider;
  provider_id: string;  // the `sub` claim
  email: string;
  name: string | null;
  avatar_url: string | null;
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

export type WorkoutType = "strength" | "cardio";

export type CardioSportType =
  | "running"
  | "football"
  | "tennis"
  | "cycling"
  | "swimming"
  | "boxing"
  | "custom";

export interface Session {
  id: number;
  plan_id: number;
  user_id: number | null;
  started_at: string;
  finished_at: string | null;
  rpe: number | null;
  notes: string | null;
  workout_type?: WorkoutType;
  sport_type?: CardioSportType | string | null;
  duration_minutes?: number | null;
  distance_km?: number | null;
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

export interface LogCardioBody {
  sport_type: CardioSportType | string;
  sport_label?: string;
  duration_minutes: number;
  distance_km?: number | string | null;
  rpe: number;
  notes?: string | null;
  completed_at?: string;
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

export interface ModifyPlanBody {
  plan: {
    name: string;
    days: Array<{
      dayName: string;
      exercises: Array<{
        name: string;
        sets: number;
        reps: string | number;
        muscleGroup?: string;
      }>;
    }>;
  };
  instruction: string;
}

export interface AutoGeneratePlansBody {
  frequency: number;
  experience: string;
  goal: string;
  equipment?: string;
  focusMuscles?: string[];
  /** Native onboarding split id: push-pull-legs | upper-lower | full-body | bro-split */
  splitPreference?: string;
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
