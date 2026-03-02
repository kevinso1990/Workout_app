import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { api } from "../lib/api";
import { DEFAULT_REST_SECONDS, WEIGHT_STEP, REP_STEP } from "../config";
import ConfirmModal from "../components/ConfirmModal";

interface LoggedSet {
  id?: number;
  exercise_id: number;
  set_number: number;
  weight: number;
  reps: number;
}

interface ExerciseState {
  exercise_id: number;
  name: string;
  muscle_group: string;
  default_sets: number;
  default_reps: number;
  default_weight: number;
  currentWeight: number;
  currentReps: number;
  loggedSets: LoggedSet[];
  lastSessionSets: any[];
  notes: string;
  skipped: boolean;
}

const BACKUP_KEY = "workout_backup";

function saveBackup(sessionId: number, exerciseStates: ExerciseState[], activeIdx: number) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ sessionId, exerciseStates, activeIdx, savedAt: Date.now() }));
  } catch {}
}

function loadBackup(): any | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearBackup() {
  try { localStorage.removeItem(BACKUP_KEY); } catch {}
}

export default function ActiveWorkout() {
  const params = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const sessionId = parseInt(params.sessionId!);

  const [exercises, setExercises] = useState<ExerciseState[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [unit, setUnit] = useState<"kg" | "lbs">("kg");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const restIntervalRef = useRef<number | null>(null);
  const activeExRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startTime]);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  useEffect(() => {
    if (exercises.length > 0) {
      saveBackup(sessionId, exercises, activeIdx);
    }
  }, [exercises, activeIdx]);

  useEffect(() => {
    activeExRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeIdx]);

  const loadSession = async () => {
    try {
      const session = await api.getSession(sessionId);
      const plan = await api.getPlan(session.plan_id);

      const backup = loadBackup();
      if (backup && backup.sessionId === sessionId) {
        setExercises(backup.exerciseStates);
        setActiveIdx(backup.activeIdx);
        setLoading(false);
        return;
      }

      const states: ExerciseState[] = await Promise.all(
        plan.exercises.map(async (pe: any) => {
          const lastSets = await api.getLastSets(pe.exercise_id).catch(() => []);
          const lastWeight = lastSets.length > 0 ? lastSets[0].weight : pe.default_weight;
          const lastReps = lastSets.length > 0 ? lastSets[0].reps : pe.default_reps;
          return {
            exercise_id: pe.exercise_id,
            name: pe.name,
            muscle_group: pe.muscle_group,
            default_sets: pe.default_sets,
            default_reps: pe.default_reps,
            default_weight: pe.default_weight,
            currentWeight: lastWeight,
            currentReps: lastReps,
            loggedSets: [],
            lastSessionSets: lastSets,
            notes: "",
            skipped: false,
          };
        })
      );

      setExercises(states);
    } catch (err) {
      console.error("Failed to load session", err);
    } finally {
      setLoading(false);
    }
  };

  const startRest = useCallback(() => {
    setRestTimer(DEFAULT_REST_SECONDS);
    setIsResting(true);
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    restIntervalRef.current = window.setInterval(() => {
      setRestTimer(prev => {
        if (prev <= 1) {
          setIsResting(false);
          if (restIntervalRef.current) clearInterval(restIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const skipRest = () => {
    setIsResting(false);
    setRestTimer(0);
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
  };

  const logSet = async (exIdx: number) => {
    const ex = exercises[exIdx];
    const setNumber = ex.loggedSets.length + 1;
    const weight = unit === "lbs" ? Math.round(ex.currentWeight / 2.205 * 10) / 10 : ex.currentWeight;

    const newSet: LoggedSet = {
      exercise_id: ex.exercise_id,
      set_number: setNumber,
      weight,
      reps: ex.currentReps,
    };

    setExercises(prev => prev.map((e, i) => i === exIdx ? { ...e, loggedSets: [...e.loggedSets, newSet] } : e));

    startRest();

    try {
      const saved = await api.logSet({ session_id: sessionId, ...newSet });
      setExercises(prev => prev.map((e, i) => {
        if (i !== exIdx) return e;
        return { ...e, loggedSets: e.loggedSets.map(s => s === newSet ? { ...s, id: saved.id } : s) };
      }));
    } catch (err) {
      console.error("Failed to save set", err);
    }

    if (setNumber >= ex.default_sets && exIdx < exercises.length - 1) {
      setTimeout(() => setActiveIdx(exIdx + 1), 300);
    }
  };

  const deleteLastSet = async (exIdx: number) => {
    const ex = exercises[exIdx];
    if (ex.loggedSets.length === 0) return;
    const lastSet = ex.loggedSets[ex.loggedSets.length - 1];
    setExercises(prev => prev.map((e, i) => i === exIdx ? { ...e, loggedSets: e.loggedSets.slice(0, -1) } : e));
    if (lastSet.id) {
      api.deleteSet(lastSet.id).catch(console.error);
    }
  };

  const adjustWeight = (exIdx: number, delta: number) => {
    setExercises(prev => prev.map((e, i) => i === exIdx ? { ...e, currentWeight: Math.max(0, e.currentWeight + delta) } : e));
  };

  const adjustReps = (exIdx: number, delta: number) => {
    setExercises(prev => prev.map((e, i) => i === exIdx ? { ...e, currentReps: Math.max(0, e.currentReps + delta) } : e));
  };

  const finishWorkout = () => {
    clearBackup();
    navigate(`/workout/${sessionId}/finish`);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const toDisplayWeight = (kg: number) => unit === "lbs" ? Math.round(kg * 2.205 * 10) / 10 : kg;
  const step = unit === "lbs" ? 5 : WEIGHT_STEP;

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[var(--color-bg)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] flex flex-col">
      <header className="sticky top-0 z-50 bg-[var(--color-nav-bg)] backdrop-blur-lg border-b border-[var(--color-border)] px-4 py-2 safe-top">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => setShowLeaveConfirm(true)} className="text-neutral-500 p-2 -ml-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="text-center">
            <div className="text-sm font-semibold">{formatTime(elapsed)}</div>
            <div className="text-[10px] text-neutral-500">{exercises.reduce((a, e) => a + e.loggedSets.length, 0)} sets logged</div>
          </div>
          <button onClick={() => setUnit(u => u === "kg" ? "lbs" : "kg")} className="text-xs font-semibold px-2 py-1 rounded-lg bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
            {unit}
          </button>
        </div>
      </header>

      {isResting ? (
        <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-brand tabular-nums">{formatTime(restTimer)}</div>
              <span className="text-sm text-neutral-500">Rest</span>
            </div>
            <button onClick={skipRest} className="btn-ghost min-h-0 text-sm px-3 py-1">Skip</button>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-lg mx-auto">
          {exercises.map((ex, exIdx) => {
            const isActive = exIdx === activeIdx;
            const isDone = ex.loggedSets.length >= ex.default_sets;

            return (
              <div
                key={ex.exercise_id}
                ref={isActive ? activeExRef : undefined}
                className={`border-b border-[var(--color-border)] transition-all ${isActive ? "bg-[var(--color-bg)] exercise-highlight" : "opacity-60"}`}
              >
                <button
                  onClick={() => setActiveIdx(exIdx)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${isDone ? "bg-green-500/20 text-green-400" : isActive ? "bg-brand/20 text-brand" : "bg-neutral-800 text-neutral-500"}`}>
                    {isDone ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    ) : exIdx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${isDone ? "text-neutral-500" : ""}`}>{ex.name}</div>
                    <div className="text-xs text-neutral-600">{ex.muscle_group} · {ex.loggedSets.length}/{ex.default_sets} sets</div>
                  </div>
                </button>

                {isActive ? (
                  <div className="px-4 pb-4">
                    {ex.lastSessionSets.length > 0 ? (
                      <div className="mb-4 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                        <div className="text-xs text-neutral-500 mb-1.5 font-medium">Last session</div>
                        <div className="flex gap-3 flex-wrap">
                          {ex.lastSessionSets.map((s: any, i: number) => (
                            <span key={i} className="text-sm text-neutral-400">{toDisplayWeight(s.weight)}{unit} x {s.reps}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {ex.loggedSets.length > 0 ? (
                      <div className="mb-4 space-y-1">
                        {ex.loggedSets.map((s, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-[var(--color-surface)]">
                            <span className="text-sm text-neutral-400">Set {s.set_number}</span>
                            <span className="text-sm font-medium">{toDisplayWeight(s.weight)} {unit} x {s.reps}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="mb-4">
                      <div className="text-xs text-neutral-500 mb-2">Weight ({unit})</div>
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => adjustWeight(exIdx, -step)} className="stepper-btn">-</button>
                        <div className="w-28 text-center">
                          <input
                            type="number"
                            value={toDisplayWeight(ex.currentWeight)}
                            onChange={e => {
                              const v = parseFloat(e.target.value) || 0;
                              const kg = unit === "lbs" ? Math.round(v / 2.205 * 10) / 10 : v;
                              setExercises(prev => prev.map((ex2, i) => i === exIdx ? { ...ex2, currentWeight: kg } : ex2));
                            }}
                            className="w-full text-center text-3xl font-bold bg-transparent outline-none tabular-nums"
                          />
                          <div className="text-xs text-neutral-600">{unit}</div>
                        </div>
                        <button onClick={() => adjustWeight(exIdx, step)} className="stepper-btn">+</button>
                      </div>
                    </div>

                    <div className="mb-5">
                      <div className="text-xs text-neutral-500 mb-2">Reps</div>
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => adjustReps(exIdx, -REP_STEP)} className="stepper-btn">-</button>
                        <div className="w-28 text-center">
                          <input
                            type="number"
                            value={ex.currentReps}
                            onChange={e => {
                              const v = parseInt(e.target.value) || 0;
                              setExercises(prev => prev.map((ex2, i) => i === exIdx ? { ...ex2, currentReps: v } : ex2));
                            }}
                            className="w-full text-center text-3xl font-bold bg-transparent outline-none tabular-nums"
                          />
                          <div className="text-xs text-neutral-600">reps</div>
                        </div>
                        <button onClick={() => adjustReps(exIdx, REP_STEP)} className="stepper-btn">+</button>
                      </div>
                    </div>

                    <button
                      onClick={() => logSet(exIdx)}
                      className="w-full btn-primary text-lg py-4 font-bold"
                    >
                      Log Set {ex.loggedSets.length + 1}
                    </button>

                    {ex.loggedSets.length > 0 ? (
                      <button onClick={() => deleteLastSet(exIdx)} className="w-full btn-ghost text-sm mt-2 text-red-400">
                        Undo Last Set
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[var(--color-nav-bg)] backdrop-blur-lg border-t border-[var(--color-border)] p-4 z-50">
        <div className="max-w-lg mx-auto">
          <button onClick={finishWorkout} className="w-full btn bg-green-600 text-white hover:bg-green-700 min-h-12 text-base font-semibold">
            Finish Workout
          </button>
        </div>
      </div>

      <ConfirmModal
        open={showLeaveConfirm}
        title="Leave Workout?"
        message="Your progress is saved and you can resume later."
        confirmLabel="Leave"
        destructive
        onConfirm={() => navigate("/")}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </div>
  );
}
