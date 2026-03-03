import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import ConsistencyCalendar from "../components/ConsistencyCalendar";
import MuscleHeatmap from "../components/MuscleHeatmap";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4 flex flex-col items-center justify-center">
      <span className="text-2xl font-bold" style={{ color: "var(--color-accent)" }}>{value}</span>
      <span className="text-xs text-[var(--color-text-secondary)] mt-1">{label}</span>
      {sub && <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{sub}</span>}
    </div>
  );
}

function WeeklyVolumeChart({ data }: { data: any[] }) {
  const weeks: { label: string; volume: number }[] = [];
  const today = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 7);
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const label = weekStart.toLocaleDateString("default", { month: "short", day: "numeric" });
    const dateStr = weekStart.toISOString().split("T")[0];
    const match = data.find(w => w.week_start && w.week_start.startsWith(dateStr.substring(0, 8)));
    weeks.push({ label, volume: match?.volume || 0 });
  }

  const maxVol = Math.max(...weeks.map(w => w.volume), 1);

  return (
    <div className="card p-4">
      <h3 className="section-label">Weekly Volume</h3>
      <div className="flex items-end gap-2 h-32">
        {weeks.map((w, i) => {
          const h = w.volume > 0 ? Math.max((w.volume / maxVol) * 100, 4) : 4;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-[var(--color-text-muted)]">{w.volume > 0 ? `${Math.round(w.volume / 1000)}k` : ""}</span>
              <div
                className="w-full rounded-t-lg transition-all duration-300"
                style={{
                  height: `${h}%`,
                  background: w.volume > 0 ? "var(--color-accent-gradient)" : "var(--color-surface-alt)",
                  minHeight: 4,
                }}
              />
              <span className="text-[9px] text-[var(--color-text-muted)]">{w.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExerciseProgressDetail({ exerciseId, exerciseName, onClose }: { exerciseId: number; exerciseName: string; onClose: () => void }) {
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
        <button onClick={onClose} className="text-[var(--color-text-muted)] text-lg">&times;</button>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)]">No data yet</p>
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

  const chartW = 280;
  const chartH = 80;

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{exerciseName}</h3>
        <button onClick={onClose} className="text-[var(--color-text-muted)] text-lg">&times;</button>
      </div>

      <div>
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Est. 1RM</span>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-20 mt-1">
          <defs>
            <linearGradient id="g1rm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f8ef7" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#4f8ef7" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,${chartH} ${linePoints(sessions.map((s: any) => s.estimated_1rm), max1rm, chartW, chartH)} ${chartW},${chartH}`}
            fill="url(#g1rm)"
          />
          <polyline
            points={linePoints(sessions.map((s: any) => s.estimated_1rm), max1rm, chartW, chartH)}
            fill="none" stroke="#4f8ef7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </div>

      <div>
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Best Weight</span>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-20 mt-1">
          <defs>
            <linearGradient id="gwt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c5bf5" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#7c5bf5" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,${chartH} ${linePoints(sessions.map((s: any) => s.best_weight), maxWeight, chartW, chartH)} ${chartW},${chartH}`}
            fill="url(#gwt)"
          />
          <polyline
            points={linePoints(sessions.map((s: any) => s.best_weight), maxWeight, chartW, chartH)}
            fill="none" stroke="#7c5bf5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </div>

      <div>
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Volume / Session</span>
        <div className="flex items-end gap-1 h-16 mt-1">
          {sessions.slice(-10).map((s: any, i: number) => (
            <div
              key={i}
              className="flex-1 rounded-t"
              style={{
                height: `${Math.max((s.volume / maxVol) * 100, 5)}%`,
                background: "var(--color-accent-gradient)",
              }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-[var(--color-surface-alt)]">
          <div className="text-sm font-bold">{prs?.max_weight || 0} kg</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Best Weight</div>
        </div>
        <div className="p-2 rounded-lg bg-[var(--color-surface-alt)]">
          <div className="text-sm font-bold">{prs?.max_reps || 0}</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Best Reps</div>
        </div>
        <div className="p-2 rounded-lg bg-[var(--color-surface-alt)]">
          <div className="text-sm font-bold">{Math.round(prs?.max_volume_set || 0)} kg</div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Best Set Vol</div>
        </div>
      </div>
    </div>
  );
}

function BodyWeightSection() {
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
  const chartW = 280;
  const chartH = 60;

  return (
    <div className="card p-4">
      <h3 className="section-label">Body Weight</h3>
      <div className="flex gap-2 mb-3">
        <input
          type="number"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          placeholder="kg"
          className="input flex-1 text-sm"
          step="0.1"
        />
        <button onClick={logWeight} className="btn-primary text-sm px-4 min-h-[2.5rem]">Log</button>
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
            points={`0,${chartH} ${sorted.map((e, i) => {
              const x = (i / (sorted.length - 1)) * chartW;
              const y = chartH - ((e.weight_kg - minW) / range) * (chartH - 10);
              return `${x},${y}`;
            }).join(" ")} ${chartW},${chartH}`}
            fill="url(#gbw)"
          />
          <polyline
            points={sorted.map((e, i) => {
              const x = (i / (sorted.length - 1)) * chartW;
              const y = chartH - ((e.weight_kg - minW) / range) * (chartH - 10);
              return `${x},${y}`;
            }).join(" ")}
            fill="none" stroke="#4f8ef7" strokeWidth="2" strokeLinecap="round"
          />
        </svg>
      )}
      {sorted.length > 0 && (
        <div className="text-xs text-[var(--color-text-secondary)] mt-1">
          Latest: {sorted[sorted.length - 1].weight_kg} kg ({sorted[sorted.length - 1].logged_date})
        </div>
      )}
    </div>
  );
}

export default function Progress() {
  const [totals, setTotals] = useState<any>(null);
  const [weeklyHistory, setWeeklyHistory] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "exercises" | "body">("overview");

  useEffect(() => {
    Promise.all([
      api.getStatsTotals(),
      api.getWeeklyHistory(),
      api.getLoggedExercises(),
    ]).then(([t, wh, ex]) => {
      setTotals(t);
      setWeeklyHistory(wh);
      setExercises(ex);
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

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">Progress</h1>

      <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-surface)]">
        {(["overview", "exercises", "body"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              tab === t
                ? "text-white"
                : "text-[var(--color-text-secondary)]"
            }`}
            style={tab === t ? { background: "var(--color-accent-gradient)" } : {}}
          >
            {t === "overview" ? "Overview" : t === "exercises" ? "Exercises" : "Body"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Workouts" value={totals?.totalWorkouts || 0} />
            <StatCard label="Total Volume" value={`${Math.round((totals?.totalVolume || 0) / 1000)}k kg`} />
            <StatCard label="Current Streak" value={`${totals?.currentStreak || 0}w`} sub="consecutive weeks" />
            <StatCard label="Longest Streak" value={`${totals?.longestStreak || 0}w`} sub="all time" />
          </div>

          <WeeklyVolumeChart data={weeklyHistory} />
          <MuscleHeatmap />
          <ConsistencyCalendar />
        </>
      )}

      {tab === "exercises" && (
        <>
          {selectedExercise ? (
            <ExerciseProgressDetail
              exerciseId={selectedExercise.id}
              exerciseName={selectedExercise.name}
              onClose={() => setSelectedExercise(null)}
            />
          ) : (
            <>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search exercises..."
                className="input w-full text-sm"
              />
              <div className="space-y-1">
                {filteredExercises.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => setSelectedExercise(ex)}
                    className="w-full card p-3 flex items-center justify-between active:scale-[0.98] transition-transform"
                  >
                    <div className="text-left">
                      <div className="text-sm font-semibold">{ex.name}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{ex.muscle_group} &middot; {ex.total_sets} sets logged</div>
                    </div>
                    <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
                {filteredExercises.length === 0 && (
                  <p className="text-sm text-[var(--color-text-secondary)] text-center py-8">No exercises found</p>
                )}
              </div>
            </>
          )}
        </>
      )}

      {tab === "body" && <BodyWeightSection />}
    </div>
  );
}
