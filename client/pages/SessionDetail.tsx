import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { api } from "../lib/api";
import ConfirmModal from "../components/ConfirmModal";
import ExerciseChart from "../components/ExerciseChart";
import { useTranslation } from "react-i18next";

export default function SessionDetail() {
  const { t } = useTranslation();
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
      <div className="min-h-[100dvh] bg-[var(--color-bg)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-[100dvh] bg-[var(--color-bg)] flex items-center justify-center">
        <p className="text-[var(--color-text-secondary)]">{t("sessionDetail.sessionNotFound")}</p>
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
    <div className="min-h-[100dvh] bg-[var(--color-bg)]">
      <header className="sticky top-0 z-40 bg-[var(--color-nav-bg)] backdrop-blur-xl px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => navigate("/progress")} className="p-2 -ml-2 text-[var(--color-text-secondary)]">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="font-bold">{session.plan_name}</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="px-4 pt-4 pb-8 max-w-lg mx-auto">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-3 text-center">
            <div className="text-xs text-[var(--color-text-secondary)]">{t("sessionDetail.volume")}</div>
            <div className="text-lg font-bold tabular-nums">{Math.round(session.totalVolume).toLocaleString()} <span className="text-sm text-[var(--color-text-muted)]">{t("common.kg")}</span></div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-xs text-[var(--color-text-secondary)]">{t("sessionDetail.duration")}</div>
            <div className="text-lg font-bold">{session.duration ? `${session.duration} ${t("common.min")}` : "\u2014"}</div>
          </div>
          {session.rpe ? (
            <div className="card p-3 text-center">
              <div className="text-xs text-[var(--color-text-secondary)]">{t("sessionDetail.rpe")}</div>
              <div className="text-lg font-bold">{session.rpe}</div>
            </div>
          ) : (
            <div className="card p-3 text-center">
              <div className="text-xs text-[var(--color-text-secondary)]">{t("sessionDetail.sets")}</div>
              <div className="text-lg font-bold">{session.sets?.length || 0}</div>
            </div>
          )}
        </div>

        {session.notes ? (
          <div className="card p-4 mb-6">
            <div className="text-xs text-[var(--color-text-muted)] mb-1 uppercase font-semibold">{t("sessionDetail.notes")}</div>
            <p className="text-sm text-[var(--color-text-secondary)]">{session.notes}</p>
          </div>
        ) : null}

        <div className="space-y-4">
          {[...exerciseGroups.entries()].map(([exId, group]) => {
            const rec = recMap.get(exId);
            return (
              <div key={exId} className="card p-4">
                <div className="mb-3">
                  <div className="font-bold text-base">{group.name}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">{group.muscle_group}</div>
                </div>
                <div className="space-y-0 mb-2">
                  {group.sets.map((s: any) => (
                    <div key={s.id} className="flex justify-between text-sm py-1.5" style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <span className="text-[var(--color-text-muted)]">{t("sessionDetail.set", { number: s.set_number })}</span>
                      <span className="font-bold tabular-nums">{s.weight} {t("common.kg")} x {s.reps}</span>
                    </div>
                  ))}
                </div>
                <ExerciseChart exerciseId={exId} exerciseName={group.name} />
                {rec && rec.reason !== "No previous data" ? (
                  <div className="mt-3 p-3 rounded-xl" style={{ background: "rgba(79, 142, 247, 0.1)" }}>
                    <div className="text-xs text-[var(--color-accent)] font-bold mb-0.5">{t("sessionDetail.nextSession")}</div>
                    <div className="text-sm font-bold">{rec.suggested_sets} x {rec.suggested_reps} @ {rec.suggested_weight} {t("common.kg")}</div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{rec.reason}</div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {recommendations.some(r => r.reason !== "No previous data") ? (
          <button onClick={acceptAll} className="btn-primary w-full mt-6">
            {t("sessionDetail.acceptAll")}
          </button>
        ) : null}
      </div>

      <ConfirmModal
        open={showApplied}
        title={t("sessionDetail.recommendationsApplied")}
        message={t("sessionDetail.planUpdated")}
        confirmLabel={t("sessionDetail.ok")}
        cancelLabel=""
        onConfirm={() => setShowApplied(false)}
        onCancel={() => setShowApplied(false)}
      />
    </div>
  );
}
