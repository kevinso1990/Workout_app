import React, { useEffect, useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";

function ConfettiPiece({ delay, left, color }: { delay: number; left: number; color: string }) {
  return (
    <div
      className="fixed w-2 h-2 rounded-sm pointer-events-none z-[200]"
      style={{
        left: `${left}%`,
        top: "-10px",
        backgroundColor: color,
        animation: `confetti-fall ${2 + Math.random()}s linear ${delay}s forwards`,
        transform: `rotate(${Math.random() * 360}deg)`,
      }}
    />
  );
}

export default function PostWorkout() {
  const { t } = useTranslation();
  const params = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const sessionId = parseInt(params.sessionId!);

  const [session, setSession] = useState<any>(null);
  const [rpe, setRpe] = useState(5);
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    api.getSession(sessionId).then(s => {
      setSession(s);
      setLoading(false);
    });
    setTimeout(() => setShowConfetti(false), 4000);
  }, [sessionId]);

  const confettiPieces = useMemo(() => {
    const colors = ["#4f8ef7", "#7c5bf5", "#22c55e", "#eab308", "#ef4444", "#f97316"];
    return Array.from({ length: 30 }, (_, i) => ({
      delay: Math.random() * 0.5,
      left: Math.random() * 100,
      color: colors[i % colors.length],
    }));
  }, []);

  const exerciseList = session?.sets
    ? [...new Map((session.sets as any[]).map(s => [s.exercise_id, { id: s.exercise_id, name: s.exercise_name, muscle_group: s.muscle_group }])).values()]
    : [];

  const totalSets = session?.sets?.length || 0;
  const totalVolume = session?.sets?.reduce((a: number, s: any) => a + s.weight * s.reps, 0) || 0;
  const duration = session?.duration || Math.floor((Date.now() - new Date(session?.started_at).getTime()) / 60000);

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
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const rpeColors = ["#22c55e", "#22c55e", "#4ade80", "#84cc16", "#a3e635", "#eab308", "#f59e0b", "#f97316", "#ef4444", "#dc2626"];

  const rpeLabel = (val: number) => {
    if (val <= 3) return t("postWorkout.easy");
    if (val <= 5) return t("postWorkout.moderate");
    if (val <= 7) return t("postWorkout.hard");
    if (val <= 9) return t("postWorkout.veryHard");
    return t("postWorkout.maxEffort");
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] px-4 py-6 max-w-lg mx-auto">
      {showConfetti ? confettiPieces.map((p, i) => (
        <ConfettiPiece key={i} {...p} />
      )) : null}

      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--color-accent-gradient)" }}>
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-1">{t("postWorkout.workoutComplete")}</h1>
        <p className="text-[var(--color-text-secondary)]">{session?.plan_name}</p>
      </div>

      <div className="card p-5 mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-[var(--color-accent)]">{duration}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t("postWorkout.minutes")}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--color-accent)]">{Math.round(totalVolume).toLocaleString()}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t("postWorkout.kgVolume")}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--color-accent)]">{totalSets}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t("postWorkout.sets")}</div>
          </div>
        </div>
      </div>

      <section className="mb-6">
        <div className="section-label">{t("postWorkout.rateEffort")}</div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-5xl font-bold tabular-nums" style={{ color: rpeColors[rpe - 1] }}>{rpe}</span>
            <span className="text-sm text-[var(--color-text-secondary)] font-medium">
              {rpeLabel(rpe)}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={rpe}
            onChange={e => setRpe(parseInt(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${rpeColors[rpe - 1]} ${(rpe - 1) / 9 * 100}%, var(--color-surface-alt) ${(rpe - 1) / 9 * 100}%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-1.5">
            <span>1</span><span>5</span><span>10</span>
          </div>
        </div>
      </section>

      {exerciseList.length > 0 ? (
        <section className="mb-6">
          <div className="section-label">{t("postWorkout.exerciseFeedback")}</div>
          <div className="space-y-2">
            {exerciseList.map((ex: any) => (
              <div key={ex.id} className="card p-4">
                <div className="font-semibold mb-3">{ex.name}</div>
                <div className="flex gap-2">
                  {[
                    { key: "hard", label: t("postWorkout.tooHard"), activeClass: "bg-red-500/20 text-red-400 ring-1 ring-red-500/40" },
                    { key: "right", label: t("postWorkout.justRight"), activeClass: "bg-green-500/20 text-green-400 ring-1 ring-green-500/40" },
                    { key: "easy", label: t("postWorkout.tooEasy"), activeClass: "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40" },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setFeedback(prev => ({ ...prev, [ex.id]: opt.key }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        feedback[ex.id] === opt.key
                          ? opt.activeClass
                          : "bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]"
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

      <section className="mb-6">
        <div className="section-label">{t("postWorkout.notesOptional")}</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={t("postWorkout.notesPlaceholder")}
          className="input w-full h-24 resize-none"
        />
      </section>

      <button onClick={handleSubmit} disabled={saving} className="btn-primary w-full text-lg py-4">
        {saving ? t("postWorkout.saving") : t("postWorkout.saveDone")}
      </button>
    </div>
  );
}
