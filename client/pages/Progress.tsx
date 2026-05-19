import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { api } from "../lib/api";
import ConsistencyCalendar from "../components/ConsistencyCalendar";
import MuscleHeatmap from "../components/MuscleHeatmap";
import { ProBadge } from "../components/ProBadge";
import { useTranslation } from "react-i18next";

// ── Shared sub-components ────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="card p-4 flex flex-col items-center justify-center">
      <span className="text-2xl font-bold" style={{ color: accent ? "var(--color-accent)" : "var(--color-text)" }}>{value}</span>
      <span className="text-xs text-[var(--color-text-secondary)] mt-1">{label}</span>
      {sub ? <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{sub}</span> : null}
    </div>
  );
}

function StreakCard({ current, longest }: { current: number; longest: number }) {
  const { t } = useTranslation();
  return (
    <div className="card accent-bar p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 mb-1">
            <svg className="w-4 h-4 text-[var(--color-accent)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{t("progress.currentStreak")}</span>
          </div>
          <span className="text-3xl font-bold text-[var(--color-accent)]">{current}</span>
          <span className="text-xs text-[var(--color-text-muted)] mt-0.5">{t("progress.consecutiveWeeks")}</span>
        </div>
        <div className="flex flex-col items-center border-l border-[var(--color-border)] pl-4">
          <div className="flex items-center gap-1.5 mb-1">
            <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{t("progress.longestStreak")}</span>
          </div>
          <span className="text-3xl font-bold text-[var(--color-text)]">{longest}</span>
          <span className="text-xs text-[var(--color-text-muted)] mt-0.5">{t("progress.allTime")}</span>
        </div>
      </div>
    </div>
  );
}

function WeeklyVolumeChart({ data }: { data: any[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || "en";
  const weeks: { label: string; volume: number }[] = [];
  const today = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 7);
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const label = weekStart.toLocaleDateString(locale, { month: "short", day: "numeric" });
    const dateStr = weekStart.toISOString().split("T")[0];
    const match = data.find(w => w.week_start && w.week_start.startsWith(dateStr.substring(0, 8)));
    weeks.push({ label, volume: match?.volume || 0 });
  }
  const maxVol = Math.max(...weeks.map(w => w.volume), 1);
  return (
    <div className="card p-4">
      <h3 className="section-label">{t("progress.weeklyVolume")}</h3>
      <div className="flex items-end gap-2 h-32">
        {weeks.map((w, i) => {
          const h = w.volume > 0 ? Math.max((w.volume / maxVol) * 100, 4) : 4;
          const isLatest = i === weeks.length - 1;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-[var(--color-text-muted)]">{w.volume > 0 ? `${Math.round(w.volume / 1000)}k` : ""}</span>
              <div
                className="w-full rounded-t-lg transition-all duration-300"
                style={{
                  height: `${h}%`,
                  background: w.volume > 0
                    ? isLatest ? "var(--color-accent-gradient)" : "rgba(79,142,247,0.35)"
                    : "var(--color-surface-alt)",
                  minHeight: 4,
                }}
              />
              <span className={`text-[9px] ${isLatest ? "text-[var(--color-accent)] font-semibold" : "text-[var(--color-text-muted)]"}`}>{w.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExerciseProgressDetail({ exerciseId, exerciseName, onClose }: { exerciseId: number; exerciseName: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getExerciseProgress(exerciseId).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [exerciseId]);

  if (loading) return <div className="card p-4 animate-pulse h-48" />;
  if (!data || !data.sessions?.length) return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">{exerciseName}</h3>
        <button onClick={onClose} className="btn-text muted">&times;</button>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)]">{t("progress.noData")}</p>
    </div>
  );

  const sessions = data.sessions;
  const prs = data.prs;
  const max1rm = Math.max(...sessions.map((s: any) => s.estimated_1rm || 0), 1);
  const maxWeight = Math.max(...sessions.map((s: any) => s.best_weight || 0), 1);
  const maxVol = Math.max(...sessions.map((s: any) => s.volume || 0), 1);

  function linePoints(values: number[], maxVal: number, w: number, h: number) {
    if (values.length < 2) return "";
    return values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - (v / maxVal) * (h - 10);
      return `${x},${y}`;
    }).join(" ");
  }

  const chartW = 280; const chartH = 80;

  return (
    <div className="card p-4 space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{exerciseName}</h3>
        <button onClick={onClose} className="btn-text muted">✕</button>
      </div>
      <ProBadge feature="Detailed exercise progress charts" />

      <div>
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{t("progress.est1RM")}</span>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-20 mt-1">
          <defs>
            <linearGradient id="g1rm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f8ef7" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#4f8ef7" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,${chartH} ${linePoints(sessions.map((s: any) => s.estimated_1rm), max1rm, chartW, chartH)} ${chartW},${chartH}`} fill="url(#g1rm)" />
          <polyline points={linePoints(sessions.map((s: any) => s.estimated_1rm), max1rm, chartW, chartH)} fill="none" stroke="#4f8ef7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div>
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{t("progress.bestWeight")}</span>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-20 mt-1">
          <defs>
            <linearGradient id="gwt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c5bf5" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#7c5bf5" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,${chartH} ${linePoints(sessions.map((s: any) => s.best_weight), maxWeight, chartW, chartH)} ${chartW},${chartH}`} fill="url(#gwt)" />
          <polyline points={linePoints(sessions.map((s: any) => s.best_weight), maxWeight, chartW, chartH)} fill="none" stroke="#7c5bf5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div>
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{t("progress.volumePerSession")}</span>
        <div className="flex items-end gap-1 h-16 mt-1">
          {sessions.slice(-10).map((s: any, i: number) => (
            <div key={i} className="flex-1 rounded-t" style={{ height: `${Math.max((s.volume / maxVol) * 100, 5)}%`, background: "var(--color-accent-gradient)" }} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-[var(--color-surface-alt)]">
          <div className="text-sm font-bold">{prs?.max_weight || 0} {t("common.kg")}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">{t("progress.bestWeight")}</div>
        </div>
        <div className="p-2 rounded-lg bg-[var(--color-surface-alt)]">
          <div className="text-sm font-bold">{prs?.max_reps || 0}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">{t("progress.bestReps")}</div>
        </div>
        <div className="p-2 rounded-lg bg-[var(--color-surface-alt)]">
          <div className="text-sm font-bold">{Math.round(prs?.max_volume_set || 0)} {t("common.kg")}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">{t("progress.bestSetVol")}</div>
        </div>
      </div>
    </div>
  );
}

function BodyWeightSection() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || "en";
  const [entries, setEntries] = useState<any[]>([]);
  const [weight, setWeight] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBodyWeight().then(d => { setEntries(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const logWeight = async () => {
    const val = parseFloat(weight);
    if (isNaN(val) || val <= 0) return;
    const entry = await api.logBodyWeight({ weight_kg: val });
    setEntries([entry, ...entries]);
    setWeight("");
  };

  const sorted = [...entries].reverse();
  const maxW = Math.max(...sorted.map(e => e.weight_kg), 1);
  const minW = Math.min(...sorted.map(e => e.weight_kg), 0);
  const range = maxW - minW || 1;
  const chartW = 280; const chartH = 60;

  return (
    <div className="card p-4">
      <h3 className="section-label">{t("progress.bodyWeight")}</h3>
      <div className="flex gap-2 mb-3">
        <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder={t("common.kg")} className="input flex-1 text-sm" step="0.1" />
        <button onClick={logWeight} className="btn-primary text-sm px-4 min-h-[2.5rem]">{t("progress.log")}</button>
      </div>
      {sorted.length > 1 && (
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-16">
          <defs>
            <linearGradient id="gbw" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f8ef7" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#4f8ef7" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,${chartH} ${sorted.map((e, i) => { const x = (i / (sorted.length - 1)) * chartW; const y = chartH - ((e.weight_kg - minW) / range) * (chartH - 10); return `${x},${y}`; }).join(" ")} ${chartW},${chartH}`}
            fill="url(#gbw)"
          />
          <polyline
            points={sorted.map((e, i) => { const x = (i / (sorted.length - 1)) * chartW; const y = chartH - ((e.weight_kg - minW) / range) * (chartH - 10); return `${x},${y}`; }).join(" ")}
            fill="none" stroke="#4f8ef7" strokeWidth="2" strokeLinecap="round"
          />
        </svg>
      )}
      {sorted.length > 0 && (
        <div className="text-xs text-[var(--color-text-secondary)] mt-1">
          {t("progress.latest")}: {sorted[sorted.length - 1].weight_kg} {t("common.kg")} ({sorted[sorted.length - 1].logged_date})
        </div>
      )}
      {sorted.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">{t("progress.noBodyWeightYet")}</p>
        </div>
      )}
    </div>
  );
}

function MuscleBalanceChart({ data }: { data: { muscle_group: string; actual_sets: number; target_sets: number }[] }) {
  const { t } = useTranslation();
  const sorted = [...data].sort((a, b) => b.actual_sets - a.actual_sets);
  return (
    <div className="card p-4">
      <ProBadge feature="Advanced muscle-balance analytics" />
      <h3 className="section-label">{t("progress.muscleBalance")}</h3>
      <div className="space-y-2.5">
        {sorted.map(row => {
          const pct = Math.min((row.actual_sets / row.target_sets) * 100, 100);
          const over = row.actual_sets >= row.target_sets;
          return (
            <div key={row.muscle_group}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-[var(--color-text)]">{row.muscle_group}</span>
                <span className={over ? "text-green-400 font-semibold" : "text-[var(--color-text-muted)]"}>
                  {row.actual_sets}/{row.target_sets} {t("progress.sets")}
                </span>
              </div>
              <div className="h-1.5 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: over ? "var(--color-accent-gradient)" : "rgba(79,142,247,0.4)" }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-[var(--color-text-faint)] mt-3">{t("progress.muscleBalanceSub")}</p>
    </div>
  );
}

function WeeklySummaryCard({ data }: { data: any }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || "en";
  const volDelta = data.prevVolume > 0 ? Math.round(((data.totalVolume - data.prevVolume) / data.prevVolume) * 100) : null;
  return (
    <div className="card p-4">
      <h3 className="section-label">{t("progress.weeklySummaryTitle")}</h3>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-xl font-bold text-[var(--color-accent)]">{data.workouts}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">{t("progress.workouts")}</div>
        </div>
        <div>
          <div className="text-xl font-bold text-[var(--color-accent)]">{Math.round(data.totalVolume / 1000).toLocaleString(locale)}k</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">{t("common.kg")}</div>
        </div>
        <div>
          <div className="text-xl font-bold text-[var(--color-accent)]">{data.totalSets}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">{t("progress.sets")}</div>
        </div>
      </div>
      {(volDelta !== null || data.topMuscle) ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {volDelta !== null ? (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${volDelta >= 0 ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
              {volDelta >= 0 ? "+" : ""}{volDelta}% {t("progress.vsLastWeek")}
            </span>
          ) : null}
          {data.topMuscle ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
              {t("progress.topMuscle")}: {data.topMuscle}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Sessions sub-tab (former History page) ────────────────────────────────────

function estimated1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

function SessionsTab() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || "en";
  const [sessions, setSessions] = useState<any[]>([]);
  const [prs, setPrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllPRs, setShowAllPRs] = useState(false);

  useEffect(() => {
    Promise.all([api.getSessions(), api.getPRs()])
      .then(([s, p]) => { setSessions(s); setPrs(p); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse" />)}
    </div>
  );

  const prMap = new Map(prs.map((p: any) => [p.exercise_id, p]));
  const visiblePRs = showAllPRs ? prs : prs.slice(0, 6);
  const hasMorePRs = prs.length > 6;

  if (sessions.length === 0 && prs.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--color-text)]">{t("history.noWorkouts")}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{t("history.noWorkoutsHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {prs.length > 0 ? (
        <section>
          <div className="section-label">{t("history.personalRecords")}</div>
          <div className="grid grid-cols-2 gap-2">
            {visiblePRs.map((pr: any) => {
              const e1rm = estimated1RM(pr.max_weight, pr.reps);
              return (
                <div key={pr.exercise_id} className="card p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-yellow-400">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)] truncate">{pr.name}</span>
                  </div>
                  <div className="text-xl font-bold tabular-nums">
                    {pr.max_weight} <span className="text-sm text-[var(--color-text-muted)]">{t("history.kg")}</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    × {pr.reps} {t("history.repsLabel")}
                    {e1rm > pr.max_weight ? (
                      <span className="ml-2 text-[var(--color-accent)]">≈{e1rm} {t("history.est1RM")}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {hasMorePRs ? (
            <button onClick={() => setShowAllPRs(v => !v)} className="btn-text w-full mt-2 justify-center">
              {showAllPRs ? t("history.showFewerPRs") : t("history.showAllPRs", { count: prs.length - 6 })}
            </button>
          ) : null}
        </section>
      ) : null}

      <section>
        <div className="section-label">{t("history.title")}</div>
        <div className="space-y-2">
          {sessions.map((s: any) => {
            const hasPR = s.sets?.some((st: any) => { const pr = prMap.get(st.exercise_id); return pr && st.weight === pr.max_weight; });
            return (
              <Link key={s.id} href={`/session/${s.id}`}>
                <div className="card p-4 active:scale-[0.98] transition-transform cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{s.plan_name}</span>
                        {hasPR ? (
                          <span className="text-yellow-400">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                          </span>
                        ) : null}
                      </div>
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        {new Date(s.started_at).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })}
                        {s.duration ? ` · ${s.duration} ${t("common.min")}` : ""}
                        {` · ${t("history.sets", { count: s.sets?.length || 0 })}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[var(--color-accent)] tabular-nums">{Math.round(s.totalVolume).toLocaleString(locale)} {t("history.kg")}</div>
                      {s.rpe ? <div className="text-xs text-[var(--color-text-muted)]">{t("history.rpe", { value: s.rpe })}</div> : null}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

type TabKey = "overview" | "exercises" | "sessions" | "body";

export default function Progress({ initialTab }: { initialTab?: TabKey }) {
  const { t } = useTranslation();
  const [totals, setTotals] = useState<any>(null);
  const [weeklyHistory, setWeeklyHistory] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [muscleBalance, setMuscleBalance] = useState<any[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>(initialTab ?? "overview");

  useEffect(() => {
    Promise.all([
      api.getStatsTotals(),
      api.getWeeklyHistory(),
      api.getLoggedExercises(),
      api.getMuscleBalance().catch(() => []),
      api.getWeeklySummary().catch(() => null),
    ]).then(([tot, wh, ex, mb, ws]) => {
      setTotals(tot);
      setWeeklyHistory(wh);
      setExercises(ex);
      setMuscleBalance(mb);
      setWeeklySummary(ws);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filteredExercises = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.muscle_group.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <div className="h-8 animate-pulse rounded bg-[var(--color-surface)]" />
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="card p-4 h-20 animate-pulse" />)}
      </div>
    </div>
  );

  const TABS: { key: TabKey; label: string }[] = [
    { key: "overview", label: t("progress.overview") },
    { key: "exercises", label: t("progress.exercises") },
    { key: "sessions", label: t("progress.sessions") },
    { key: "body", label: t("progress.body") },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">{t("progress.title")}</h1>

      {/* Tab switcher — 4 tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-surface)]">
        {TABS.map(tb => (
          <button
            key={tb.key}
            onClick={() => { setTab(tb.key); setSelectedExercise(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === tb.key ? "text-white" : "text-[var(--color-text-secondary)]"
            }`}
            style={tab === tb.key ? { background: "var(--color-accent-gradient)" } : {}}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {/* Streak hero card — most motivating element, goes first */}
          {totals && <StreakCard current={totals.currentStreak || 0} longest={totals.longestStreak || 0} />}

          {/* Consistency calendar — now prominent right below streaks */}
          <ConsistencyCalendar />

          <div className="grid grid-cols-2 gap-3">
            <StatCard label={t("progress.workouts")} value={totals?.totalWorkouts || 0} />
            <StatCard label={t("progress.totalVolume")} value={`${Math.round((totals?.totalVolume || 0) / 1000)}k ${t("common.kg")}`} />
          </div>

          {weeklySummary && weeklySummary.workouts > 0 ? <WeeklySummaryCard data={weeklySummary} /> : null}
          <WeeklyVolumeChart data={weeklyHistory} />
          {muscleBalance.length > 0 ? <MuscleBalanceChart data={muscleBalance} /> : null}
          <MuscleHeatmap />
        </>
      )}

      {tab === "exercises" && (
        <>
          {selectedExercise ? (
            <ExerciseProgressDetail exerciseId={selectedExercise.id} exerciseName={selectedExercise.name} onClose={() => setSelectedExercise(null)} />
          ) : (
            <>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t("progress.searchExercises")}
                className="input w-full text-sm"
              />
              <div className="space-y-1">
                {filteredExercises.map(ex => (
                  <button key={ex.id} onClick={() => setSelectedExercise(ex)} className="w-full card p-3 flex items-center justify-between active:scale-[0.98] transition-transform">
                    <div className="text-left">
                      <div className="text-sm font-semibold">{ex.name}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{ex.muscle_group} · {t("progress.setsLogged", { count: ex.total_sets })}</div>
                    </div>
                    <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
                {filteredExercises.length === 0 && (
                  <div className="card">
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)]">{t("progress.noExercises")}</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {tab === "sessions" && <SessionsTab />}

      {tab === "body" && <BodyWeightSection />}
    </div>
  );
}
