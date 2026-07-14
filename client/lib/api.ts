const BASE = "";
const TOKEN_KEY = "workoutapp_auth_token";

function getDeviceId(): string {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("device_id", id);
  }
  return id;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/**
 * Best-effort decode of the JWT payload (no signature check — the server is
 * the source of truth, this is only used to decide whether the current token
 * was minted for a guest vs an OAuth user).
 */
function readTokenProvider(token: string | null): string | null {
  if (!token) return null;
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const padded = segment + "=".repeat((4 - (segment.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { provider?: string };
    return payload.provider ?? null;
  } catch {
    return null;
  }
}

/**
 * Hits the guest sign-in endpoint to mint a JWT keyed on this device. Backs
 * the "Skip" / "Continue without an account" option that's always available
 * alongside Google/Apple sign-in. Data persists per-device until the user
 * clears storage, switches devices, or signs in for real.
 */
async function guestLogin(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/guest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": getDeviceId(),
      },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { token: string };
    setStoredToken(body.token);
    return body.token;
  } catch {
    return null;
  }
}

/**
 * Public helper the UI can call from a "Skip" / "Continue as guest" button.
 * Forces a fresh guest token even if one already exists (useful when the user
 * explicitly chooses to start over as a guest).
 */
export async function continueAsGuest(): Promise<string | null> {
  setStoredToken(null);
  return guestLogin();
}

let bootstrapPromise: Promise<string | null> | null = null;
async function ensureToken(): Promise<string | null> {
  const existing = getStoredToken();
  if (existing) return existing;
  if (!bootstrapPromise) {
    bootstrapPromise = guestLogin().finally(() => {
      bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
}

const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(url: string, opts?: RequestInit, _retried = false): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const existing = (opts?.headers as Record<string, string>) ?? {};
  const token = await ensureToken();

  let res: Response;
  try {
    res = await fetch(`${BASE}${url}`, {
      ...opts,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-device-id": getDeviceId(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...existing,
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out — check your connection and try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  // If the token expired or was rejected:
  //   - Guests / no-token sessions: silently mint a fresh guest token and retry
  //     once. (Avoids users getting stuck after JWT_SECRET rotation.)
  //   - OAuth users (google/apple): do NOT silently downgrade them to a guest
  //     account. Clear the token and surface the 401 so the UI can route them
  //     back through the real sign-in flow.
  if (res.status === 401 && !_retried) {
    const previousProvider = readTokenProvider(token);
    setStoredToken(null);
    const isGuestOrAnonymous = previousProvider === null || previousProvider === "guest" || previousProvider === "dev";
    if (isGuestOrAnonymous) {
      const fresh = await guestLogin();
      if (fresh) return request<T>(url, opts, true);
    }
  }

  const text = await res.text();
  if (!res.ok) {
    let body: { error?: string; message?: string } = {};
    if (text.trim()) {
      try {
        body = JSON.parse(text) as { error?: string; message?: string };
      } catch {
        body = {};
      }
    }
    throw new Error(body.error || body.message || res.statusText);
  }
  return JSON.parse(text) as T;
}

export const api = {
  getExercises: () => request<any[]>("/api/exercises"),
  createExercise: (data: { name: string; muscle_group: string }) =>
    request<any>("/api/exercises", { method: "POST", body: JSON.stringify(data) }),

  getPlans: () => request<any[]>("/api/plans"),
  getPlan: (id: number) => request<any>(`/api/plans/${id}`),
  createPlan: (data: any) => request<any>("/api/plans", { method: "POST", body: JSON.stringify(data) }),
  updatePlan: (id: number, data: any) => request<any>(`/api/plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePlan: (id: number) => request<any>(`/api/plans/${id}`, { method: "DELETE" }),

  /** Permanently deletes the authenticated account + all its server-side data. */
  deleteAccount: () => request<any>("/api/auth/account", { method: "DELETE" }),

  startSession: (plan_id: number) => request<any>("/api/sessions", { method: "POST", body: JSON.stringify({ plan_id }) }),
  finishSession: (id: number, data: { finished_at: string; rpe?: number; notes?: string }) =>
    request<any>(`/api/sessions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  getSessions: () => request<any[]>("/api/sessions"),
  getSession: (id: number) => request<any>(`/api/sessions/${id}`),

  logSet: (data: { session_id: number; exercise_id: number; set_number: number; weight: number; reps: number; is_drop_set?: boolean; parent_set_id?: number | null; rir?: number }) =>
    request<any>("/api/sets", { method: "POST", body: JSON.stringify(data) }),
  updateSetRir: (id: number, rir: number) =>
    request<any>(`/api/sets/${id}/rir`, { method: "PATCH", body: JSON.stringify({ rir }) }),
  deleteSet: (id: number) => request<any>(`/api/sets/${id}`, { method: "DELETE" }),

  submitFeedback: (data: { session_id: number; exercise_id: number; rating: string }) =>
    request<any>("/api/exercise-feedback", { method: "POST", body: JSON.stringify(data) }),

  getRecommendations: (planId: number) => request<any[]>(`/api/recommendations/${planId}`),
  acceptRecommendations: (planId: number, recommendations: any[]) =>
    request<any>(`/api/recommendations/${planId}/accept`, { method: "POST", body: JSON.stringify({ recommendations }) }),

  getWeeklyVolume: () => request<any[]>("/api/stats/weekly-volume"),
  getPRs: () => request<any[]>("/api/stats/prs"),
  getExerciseHistory: (exerciseId: number) => request<any[]>(`/api/stats/exercise-history/${exerciseId}`),
  getLastSets: (exerciseId: number) => request<any[]>(`/api/stats/last-sets/${exerciseId}`),
  getRestAverage: (exerciseId: number) => request<any>(`/api/stats/rest-average/${exerciseId}`),

  searchMuscleWiki: (name: string) => request<any[]>(`/api/musclewiki/search?name=${encodeURIComponent(name)}`),

  getBodyWeight: () => request<any[]>("/api/body-weight"),
  logBodyWeight: (data: { weight_kg: number; logged_date?: string; notes?: string }) =>
    request<any>("/api/body-weight", { method: "POST", body: JSON.stringify(data) }),

  getWeeklyHistory: () => request<any[]>("/api/stats/weekly-history"),
  getConsistency: () => request<any[]>("/api/stats/consistency"),
  getExerciseProgress: (exerciseId: number) => request<any>(`/api/stats/exercise-progress/${exerciseId}`),
  getMuscleVolume7d: () => request<any[]>("/api/stats/muscle-volume-7d"),
  getLoggedExercises: () => request<any[]>("/api/stats/logged-exercises"),
  getMuscleBalance: () => request<{ muscle_group: string; actual_sets: number; target_sets: number }[]>("/api/stats/muscle-balance"),
  getWeeklySummary: () => request<{ workouts: number; totalVolume: number; totalSets: number; prevWorkouts: number; prevVolume: number; topMuscle: string | null }>("/api/stats/weekly-summary"),

  autoGeneratePlans: (data: { frequency: number; experience: string; goal: string; equipment?: string; focusMuscles?: string[] }) =>
    request<any>("/api/plans/auto-generate", { method: "POST", body: JSON.stringify(data) }),

  getRecovery: () => request<any[]>("/api/recovery"),

  getVapidPublicKey: () => request<{ publicKey: string }>("/api/push/vapid-public"),
  subscribePush: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    request<any>("/api/push/subscribe", { method: "POST", body: JSON.stringify(subscription) }),
  unsubscribePush: (endpoint: string) =>
    request<any>("/api/push/unsubscribe", { method: "DELETE", body: JSON.stringify({ endpoint }) }),

  getStatsTotals: () => request<{ totalWorkouts: number; totalVolume: number; currentStreak: number; longestStreak: number }>("/api/stats/totals"),

  getAllVotes: () => request<Record<number, number>>("/api/votes"),
  voteExercise: (exerciseId: number, vote: number) =>
    request<{ ok: boolean }>(`/api/votes/${exerciseId}`, { method: "POST", body: JSON.stringify({ vote }) }),

  getSplitAge: () => request<{ planId: number; planName: string; weeksOnPlan: number; shouldPrompt: boolean } | null>("/api/split-refresh"),
  snoozeSplitRefresh: () => request<{ ok: boolean }>("/api/split-refresh/snooze", { method: "POST" }),

  getExerciseBest: (exerciseId: number) =>
    request<{ maxWeight: number; maxReps: number; estimated1rm: number }>(`/api/stats/exercise-best/${exerciseId}`),

  // ── Subscriptions ──────────────────────────────────────────────────────────
  getSubscriptionStatus: () =>
    request<{ tier: "free" | "pro"; isPro: boolean; provider: string | null; expiresAt: string | null }>("/api/subscriptions/status"),
  validateAppleReceipt: (data: { receiptData: string; isSandbox?: boolean }) =>
    request<{ ok: boolean; tier: string; expiresAt: string | null; provider: string }>("/api/subscriptions/validate/apple", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  validateGooglePurchase: (data: { packageName: string; subscriptionId: string; purchaseToken: string }) =>
    request<{ ok: boolean; tier: string; expiresAt: string | null; provider: string }>("/api/subscriptions/validate/google", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
