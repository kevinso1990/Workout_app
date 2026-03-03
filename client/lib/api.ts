const BASE = "";

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
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

  logSet: (data: { session_id: number; exercise_id: number; set_number: number; weight: number; reps: number }) =>
    request<any>("/api/sets", { method: "POST", body: JSON.stringify(data) }),
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

  getStatsTotals: () => request<any>("/api/stats/totals"),
  getWeeklyHistory: () => request<any[]>("/api/stats/weekly-history"),
  getConsistency: () => request<any[]>("/api/stats/consistency"),
  getExerciseProgress: (exerciseId: number) => request<any>(`/api/stats/exercise-progress/${exerciseId}`),
  getMuscleVolume7d: () => request<any[]>("/api/stats/muscle-volume-7d"),
  getLoggedExercises: () => request<any[]>("/api/stats/logged-exercises"),

  autoGeneratePlans: (data: { frequency: number; experience: string; goal: string }) =>
    request<any>("/api/plans/auto-generate", { method: "POST", body: JSON.stringify(data) }),
};
