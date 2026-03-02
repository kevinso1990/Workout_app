import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { api } from "../lib/api";

export default function History() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [prs, setPrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getSessions(), api.getPRs()])
      .then(([s, p]) => { setSessions(s); setPrs(p); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60dvh]">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const prMap = new Map(prs.map((p: any) => [p.exercise_id, p]));

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Workout History</h1>

      {prs.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">Personal Records</h2>
          <div className="grid grid-cols-2 gap-2">
            {prs.slice(0, 6).map((pr: any) => (
              <div key={pr.exercise_id} className="card p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-yellow-400">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  </span>
                  <span className="text-xs text-neutral-500 truncate">{pr.name}</span>
                </div>
                <div className="text-lg font-bold">{pr.max_weight} kg</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {sessions.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-neutral-400">No workouts recorded yet. Start a workout to see your history.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s: any) => {
            const hasPR = s.sets?.some((st: any) => {
              const pr = prMap.get(st.exercise_id);
              return pr && st.weight === pr.max_weight;
            });

            return (
              <Link key={s.id} href={`/session/${s.id}`}>
                <div className="card p-4 active:scale-[0.98] transition-transform cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{s.plan_name}</span>
                        {hasPR ? (
                          <span className="text-yellow-400">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                          </span>
                        ) : null}
                      </div>
                      <div className="text-sm text-neutral-500">
                        {new Date(s.started_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {s.duration ? ` · ${s.duration} min` : ""}
                        {` · ${s.sets?.length || 0} sets`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-brand">{Math.round(s.totalVolume).toLocaleString()} kg</div>
                      {s.rpe ? <div className="text-xs text-neutral-500">RPE {s.rpe}</div> : null}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
