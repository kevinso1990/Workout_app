import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { api } from "../lib/api";
import { APP_NAME } from "../config";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const [plans, setPlans] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const [splitPrompt, setSplitPrompt] = useState<{ planName: string; weeksOnPlan: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const DAYS = [
    t("days.mon"), t("days.tue"), t("days.wed"), t("days.thu"),
    t("days.fri"), t("days.sat"), t("days.sun"),
  ];

  useEffect(() => {
    Promise.all([
      api.getPlans(),
      api.getSessions(),
      api.getWeeklyVolume(),
      api.getStatsTotals().catch(() => null),
      api.getSplitAge().catch(() => null),
    ]).then(([p, s, wv, totals, splitAge]) => {
      setPlans(p);
      setSessions(s);
      setWeeklyVolume(wv);
      if (totals) setStreak(totals.currentStreak);
      if (splitAge?.shouldPrompt) setSplitPrompt({ planName: splitAge.planName, weeksOnPlan: splitAge.weeksOnPlan });
    }).finally(() => setLoading(false));
  }, []);

  const recentSessions = sessions.slice(0, 5);

  const workoutDays = new Set(
    sessions
      .filter((s: any) => {
        const d = new Date(s.started_at);
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        weekStart.setHours(0, 0, 0, 0);
        return d >= weekStart;
      })
      .map((s: any) => {
        const d = new Date(s.started_at);
        return d.getDay() === 0 ? 6 : d.getDay() - 1;
      })
  );

  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  const startWorkout = async (planId: number) => {
    const session = await api.startSession(planId);
    navigate(`/workout/${session.id}`);
  };

  const dismissSplitPrompt = async () => {
    setSplitPrompt(null);
    api.snoozeSplitRefresh().catch(() => {});
  };

  const locale = i18n.language || "en";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60dvh]">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-8 pb-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">{APP_NAME}</h1>

      {plans.length > 0 ? (
        <section className="mb-6">
          <button
            onClick={() => startWorkout(plans[0].id)}
            className="w-full card p-5 flex items-center justify-between active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg, rgba(79,142,247,0.15), rgba(124,91,245,0.1))" }}
          >
            <div className="flex-1">
              <div className="text-xs font-semibold text-[var(--color-accent)] mb-1 uppercase tracking-wider">{t("dashboard.nextWorkout")}</div>
              <div className="font-bold text-xl mb-1">{plans[0].name}</div>
              <div className="text-sm text-[var(--color-text-secondary)]">{t("dashboard.exercises", { count: plans[0].exercises?.length || 0 })}</div>
            </div>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--color-accent-gradient)" }}>
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </button>

          {plans.length > 1 ? (
            <div className="mt-3 space-y-2">
              {plans.slice(1).map(plan => (
                <button
                  key={plan.id}
                  onClick={() => startWorkout(plan.id)}
                  className="w-full card p-4 flex items-center justify-between active:scale-[0.98] transition-transform"
                >
                  <div>
                    <div className="font-semibold">{plan.name}</div>
                    <div className="text-sm text-[var(--color-text-secondary)]">{t("dashboard.exercises", { count: plan.exercises?.length || 0 })}</div>
                  </div>
                  <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="mb-6">
          <div className="card p-6 text-center">
            <p className="text-[var(--color-text-secondary)] mb-4">{t("dashboard.createFirst")}</p>
            <Link href="/plans/new">
              <button className="btn-primary">{t("dashboard.getStarted")}</button>
            </Link>
          </div>
        </section>
      )}

      {splitPrompt ? (
        <section className="mb-6">
          <div className="card p-4 border border-[var(--color-accent)]/30" style={{ background: "rgba(79,142,247,0.06)" }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: "var(--color-accent-gradient)" }}>
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm mb-0.5">{t("dashboard.splitRefreshTitle")}</div>
                <div className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  {t("dashboard.splitRefreshDesc", { weeks: splitPrompt.weeksOnPlan, plan: splitPrompt.planName })}
                </div>
                <div className="flex gap-2 mt-3">
                  <Link href="/plans">
                    <button className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ background: "var(--color-accent-gradient)" }}>
                      {t("dashboard.splitRefreshAction")}
                    </button>
                  </Link>
                  <button onClick={dismissSplitPrompt} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
                    {t("dashboard.splitRefreshSnooze")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="section-label mb-0">{t("dashboard.thisWeek")}</div>
          {streak > 0 ? (
            <div className="flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)]">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              {t("dashboard.streak", { count: streak })}
            </div>
          ) : null}
        </div>
        <div className="card p-4">
          <div className="flex justify-between">
            {DAYS.map((day, i) => (
              <div key={day} className="flex flex-col items-center gap-1.5">
                <span className={`text-[10px] font-semibold ${i === todayIdx ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}`}>{day}</span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  workoutDays.has(i)
                    ? "text-white"
                    : i === todayIdx
                    ? "border-2 text-[var(--color-accent)]"
                    : "bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]"
                }`}
                  style={workoutDays.has(i) ? { background: "var(--color-accent-gradient)" } : i === todayIdx ? { borderColor: "var(--color-accent)" } : {}}
                >
                  {workoutDays.has(i) ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {weeklyVolume.length > 0 ? (
        <section className="mb-6">
          <div className="section-label">{t("dashboard.volumeByMuscle")}</div>
          <div className="card p-4">
            <div className="space-y-3">
              {weeklyVolume.map((wv: any) => {
                const maxVol = Math.max(...weeklyVolume.map((w: any) => w.volume));
                const pct = maxVol > 0 ? (wv.volume / maxVol) * 100 : 0;
                return (
                  <div key={wv.muscle_group}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-[var(--color-text)]">{wv.muscle_group}</span>
                      <span className="text-[var(--color-text-secondary)] tabular-nums">{Math.round(wv.volume).toLocaleString(locale)} {t("common.kg")}</span>
                    </div>
                    <div className="h-2 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: "var(--color-accent-gradient)" }}
                      />
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
          <div className="section-label">{t("dashboard.recentActivity")}</div>
          <div className="space-y-2">
            {recentSessions.map((s: any) => (
              <Link key={s.id} href={`/session/${s.id}`}>
                <div className="card p-4 active:scale-[0.98] transition-transform cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{s.plan_name}</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        {new Date(s.started_at).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })}
                        {s.duration ? ` · ${s.duration} ${t("dashboard.min")}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[var(--color-accent)] tabular-nums">{Math.round(s.totalVolume).toLocaleString(locale)} {t("common.kg")}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{s.sets?.length || 0} {t("dashboard.sets")}</div>
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
