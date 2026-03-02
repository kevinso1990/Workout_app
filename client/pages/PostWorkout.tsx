import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { api } from "../lib/api";

export default function PostWorkout() {
  const params = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const sessionId = parseInt(params.sessionId!);

  const [session, setSession] = useState<any>(null);
  const [rpe, setRpe] = useState(5);
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSession(sessionId).then(s => {
      setSession(s);
      setLoading(false);
    });
  }, [sessionId]);

  const exerciseList = session?.sets
    ? [...new Map((session.sets as any[]).map(s => [s.exercise_id, { id: s.exercise_id, name: s.exercise_name, muscle_group: s.muscle_group }])).values()]
    : [];

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.finishSession(sessionId, {
        finished_at: new Date().toISOString(),
        rpe,
        notes: notes || undefined,
      });

      for (const [exerciseId, rating] of Object.entries(feedback)) {
        await api.submitFeedback({ session_id: sessionId, exercise_id: parseInt(exerciseId), rating });
      }

      try { localStorage.removeItem("workout_backup"); } catch {}
      navigate("/");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[var(--color-bg)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const rpeColors = ["#22c55e", "#22c55e", "#4ade80", "#84cc16", "#a3e635", "#eab308", "#f59e0b", "#f97316", "#ef4444", "#dc2626"];

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] px-4 py-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-2">How did it feel?</h1>
      <p className="text-neutral-500 mb-8">Rate your workout to get better recommendations next time.</p>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Overall Effort (RPE)</h2>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-5xl font-bold" style={{ color: rpeColors[rpe - 1] }}>{rpe}</span>
            <span className="text-sm text-neutral-500">
              {rpe <= 3 ? "Easy" : rpe <= 5 ? "Moderate" : rpe <= 7 ? "Hard" : rpe <= 9 ? "Very Hard" : "Max Effort"}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={rpe}
            onChange={e => setRpe(parseInt(e.target.value))}
            className="w-full h-3 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${rpeColors[rpe - 1]} ${(rpe - 1) / 9 * 100}%, #262626 ${(rpe - 1) / 9 * 100}%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
            <span>1</span><span>5</span><span>10</span>
          </div>
        </div>
      </section>

      {exerciseList.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Per Exercise</h2>
          <div className="space-y-2">
            {exerciseList.map((ex: any) => (
              <div key={ex.id} className="card p-4">
                <div className="font-medium mb-2">{ex.name}</div>
                <div className="flex gap-2">
                  {[
                    { key: "hard", label: "Too Hard", color: "red" },
                    { key: "right", label: "Just Right", color: "green" },
                    { key: "easy", label: "Too Easy", color: "yellow" },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setFeedback(prev => ({ ...prev, [ex.id]: opt.key }))}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                        feedback[ex.id] === opt.key
                          ? opt.color === "red" ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/50"
                          : opt.color === "green" ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/50"
                          : "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50"
                          : "bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:opacity-80"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">Notes (optional)</h2>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="How did it go? Anything to remember for next time?"
          className="input w-full h-24 resize-none"
        />
      </section>

      <button onClick={handleSubmit} disabled={saving} className="btn-primary w-full text-lg py-4">
        {saving ? "Saving..." : "Save & Done"}
      </button>
    </div>
  );
}
