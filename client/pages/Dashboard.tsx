import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { api } from "../lib/api";
import { APP_NAME } from "../config";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [plans, setPlans] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getPlans(), api.getSessions(), api.getWeeklyVolume()])
      .then(([p, s, wv]) => { setPlans(p); setSessions(s); setWeeklyVolume(wv); })
      .finally(() => setLoading(false));
  }, []);

  const recentSessions = sessions.slice(0, 3);
  const lastExercises = sessions.length > 0 && sessions[0].sets
    ? [...new Map(sessions[0].sets.map((s: any) => [s.exercise_id, s])).values()].slice(0, 4)
    : [];

  const startWorkout = async (planId: number) => {
    const session = await api.startSession(planId);
    navigate(`/workout/${session.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60dvh]">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">{APP_NAME}</h1>

      {plans.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">Start Workout</h2>
          <div className="space-y-2">
            {plans.map(plan => (
              <button
                key={plan.id}
                onClick={() => startWorkout(plan.id)}
                className="w-full card p-4 flex items-center justify-between active:scale-[0.98] transition-transform"
              >
                <div>
                  <div className="font-semibold text-lg">{plan.name}</div>
                  <div className="text-sm text-neutral-500">{plan.exercises?.length || 0} exercises</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-brand" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="mb-8">
          <div className="card p-6 text-center">
            <p className="text-neutral-400 mb-4">No workout plans yet</p>
            <Link href="/plans/new">
              <button className="btn-primary">Create Your First Plan</button>
            </Link>
          </div>
        </section>
      )}

      {lastExercises.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">Quick Add</h2>
          <div className="grid grid-cols-2 gap-2">
            {lastExercises.map((ex: any) => (
              <button
                key={ex.exercise_id}
                className="card p-3 text-left active:scale-[0.97] transition-transform"
                onClick={() => plans.length > 0 && startWorkout(plans[0].id)}
              >
                <div className="text-sm font-medium truncate">{ex.exercise_name}</div>
                <div className="text-xs text-neutral-500">{ex.weight}kg x {ex.reps}</div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {weeklyVolume.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">Weekly Volume</h2>
          <div className="card p-4">
            <div className="space-y-3">
              {weeklyVolume.map((wv: any) => {
                const maxVol = Math.max(...weeklyVolume.map((w: any) => w.volume));
                const pct = maxVol > 0 ? (wv.volume / maxVol) * 100 : 0;
                return (
                  <div key={wv.muscle_group}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-neutral-300">{wv.muscle_group}</span>
                      <span className="text-neutral-500">{Math.round(wv.volume).toLocaleString()} kg</span>
                    </div>
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {recentSessions.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">Recent Workouts</h2>
          <div className="space-y-2">
            {recentSessions.map((s: any) => (
              <Link key={s.id} href={`/session/${s.id}`}>
                <div className="card p-4 active:scale-[0.98] transition-transform cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{s.plan_name}</div>
                      <div className="text-sm text-neutral-500">
                        {new Date(s.started_at).toLocaleDateString()} {s.duration ? `· ${s.duration} min` : ""}
                      </div>
                    </div>
                    <div className="text-sm text-brand font-semibold">
                      {Math.round(s.totalVolume).toLocaleString()} kg
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
