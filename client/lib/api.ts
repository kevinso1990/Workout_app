const BASE = "";

function getDeviceId(): string {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("device_id", id);
  }
  return id;
}

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const existing = (opts?.headers as Record<string, string>) ?? {};
  const res = await fetch(`${BASE}${url}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-device-id": getDeviceId(), ...existing },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.message || res.statusText);
  }
  return res.json();
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

  autoGeneratePlans: (data: { frequency: number; experience: string; goal: string; equipment?: string }) =>
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
