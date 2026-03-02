import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { api } from "../lib/api";
import ConfirmModal from "../components/ConfirmModal";

export default function SessionDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [showApplied, setShowApplied] = useState(false);

  useEffect(() => {
    api.getSession(parseInt(params.id!)).then(async s => {
      setSession(s);
      try {
        const recs = await api.getRecommendations(s.plan_id);
        setRecommendations(recs);
      } catch {}
      setLoading(false);
    });
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-neutral-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-[100dvh] bg-neutral-950 flex items-center justify-center">
        <p className="text-neutral-400">Session not found</p>
      </div>
    );
  }

  const exerciseGroups = new Map<number, { name: string; muscle_group: string; sets: any[] }>();
  for (const set of session.sets || []) {
    if (!exerciseGroups.has(set.exercise_id)) {
      exerciseGroups.set(set.exercise_id, { name: set.exercise_name, muscle_group: set.muscle_group, sets: [] });
    }
    exerciseGroups.get(set.exercise_id)!.sets.push(set);
  }

  const recMap = new Map(recommendations.map(r => [r.exercise_id, r]));

  const acceptAll = async () => {
    await api.acceptRecommendations(session.plan_id, recommendations);
    setShowApplied(true);
  };

  return (
    <div className="min-h-[100dvh] bg-neutral-950">
      <header className="sticky top-0 z-40 bg-neutral-950/95 backdrop-blur-lg border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => navigate("/history")} className="p-2 -ml-2 text-neutral-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="font-semibold">{session.plan_name}</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="px-4 pt-4 pb-8 max-w-lg mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="card p-3 flex-1 text-center">
            <div className="text-xs text-neutral-500">Volume</div>
            <div className="text-lg font-bold">{Math.round(session.totalVolume).toLocaleString()} kg</div>
          </div>
          <div className="card p-3 flex-1 text-center">
            <div className="text-xs text-neutral-500">Duration</div>
            <div className="text-lg font-bold">{session.duration ? `${session.duration} min` : "—"}</div>
          </div>
          {session.rpe ? (
            <div className="card p-3 flex-1 text-center">
              <div className="text-xs text-neutral-500">RPE</div>
              <div className="text-lg font-bold">{session.rpe}</div>
            </div>
          ) : null}
        </div>

        {session.notes ? (
          <div className="card p-4 mb-6">
            <div className="text-xs text-neutral-500 mb-1">Notes</div>
            <p className="text-sm text-neutral-300">{session.notes}</p>
          </div>
        ) : null}

        <div className="space-y-4">
          {[...exerciseGroups.entries()].map(([exId, group]) => {
            const rec = recMap.get(exId);
            return (
              <div key={exId} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-semibold">{group.name}</div>
                    <div className="text-xs text-neutral-500">{group.muscle_group}</div>
                  </div>
                </div>
                <div className="space-y-1 mb-2">
                  {group.sets.map((s: any) => (
                    <div key={s.id} className="flex justify-between text-sm py-1">
                      <span className="text-neutral-500">Set {s.set_number}</span>
                      <span>{s.weight} kg x {s.reps}</span>
                    </div>
                  ))}
                </div>
                {rec && rec.reason !== "No previous data" ? (
                  <div className="mt-2 p-2.5 rounded-lg bg-brand/10 border border-brand/20">
                    <div className="text-xs text-brand font-semibold mb-0.5">Next session</div>
                    <div className="text-sm font-medium">{rec.suggested_sets} x {rec.suggested_reps} @ {rec.suggested_weight} kg</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{rec.reason}</div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {recommendations.some(r => r.reason !== "No previous data") ? (
          <button onClick={acceptAll} className="btn-primary w-full mt-6">
            Accept All Recommendations
          </button>
        ) : null}
      </div>

      <ConfirmModal
        open={showApplied}
        title="Recommendations Applied"
        message="Your plan has been updated with the new targets."
        confirmLabel="OK"
        cancelLabel=""
        onConfirm={() => setShowApplied(false)}
        onCancel={() => setShowApplied(false)}
      />
    </div>
  );
}
