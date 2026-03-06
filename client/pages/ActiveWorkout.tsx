import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { api } from "../lib/api";
import { enqueue, dequeue, flushQueue } from "../lib/offlineQueue";
import { DEFAULT_REST_SECONDS, WEIGHT_STEP, REP_STEP } from "../config";
import ConfirmModal from "../components/ConfirmModal";
import PlateCalculator from "../components/PlateCalculator";
import ExerciseMedia from "../components/ExerciseMedia";
import { useTranslation } from "react-i18next";

interface LoggedSet {
  id?: number;
  exercise_id: number;
  set_number: number;
  weight: number;
  reps: number;
  is_drop_set?: boolean;
  parent_set_id?: number | null;
  rir?: number;
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
  superset_group: number | null;
}

const BACKUP_KEY = "workout_backup";
const SUPERSET_COLORS = ["#4f8ef7", "#7c5bf5", "#22c55e", "#f59e0b", "#ef4444", "#ec4899"];

function saveBackup(sessionId: number, exerciseStates: ExerciseState[], activeIdx: number, startedAt: number) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ sessionId, exerciseStates, activeIdx, startedAt, savedAt: Date.now() }));
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
  const { t } = useTranslation();
  const params = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const sessionId = parseInt(params.sessionId!);

  const [exercises, setExercises] = useState<ExerciseState[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState<Record<number, number>>({});
  const [rirPickerKey, setRirPickerKey] = useState<string | null>(null); // "exIdx-setIdx"
  const [startTime, setStartTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [unit, setUnit] = useState<"kg" | "lbs">("kg");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [pulsingRow, setPulsingRow] = useState<string | null>(null);
  const restIntervalRef = useRef<number | null>(null);
  const activeExRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startTime]);

  useEffect(() => {
    loadSession();
    api.getAllVotes().then(setVotes).catch(() => {});
    // Flush any offline-queued sets when we come back online
    const handleOnline = () => flushQueue(api.logSet);
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [sessionId]);

  useEffect(() => {
    if (exercises.length > 0) {
      saveBackup(sessionId, exercises, activeIdx, startTime);
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
        if (backup.startedAt) setStartTime(backup.startedAt);
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
            superset_group: pe.superset_group || null,
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

  const isLastInSupersetGroup = (exIdx: number): boolean => {
    const ex = exercises[exIdx];
    if (!ex.superset_group) return true;
    const nextEx = exercises[exIdx + 1];
    return !nextEx || nextEx.superset_group !== ex.superset_group;
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

  const logSet = async (exIdx: number, dropSet = false) => {
    const ex = exercises[exIdx];
    const normalSets = ex.loggedSets.filter(s => !s.is_drop_set);
    const setNumber = dropSet ? ex.loggedSets.length + 1 : normalSets.length + 1;
    const weight = unit === "lbs" ? Math.round(ex.currentWeight / 2.205 * 10) / 10 : ex.currentWeight;

    const parentId = dropSet && ex.loggedSets.length > 0 ? ex.loggedSets[ex.loggedSets.length - 1].id : null;

    const newSet: LoggedSet = {
      exercise_id: ex.exercise_id,
      set_number: setNumber,
      weight: dropSet ? Math.round(weight * 0.9 / 2.5) * 2.5 : weight,
      reps: ex.currentReps,
      is_drop_set: dropSet,
      parent_set_id: parentId,
    };

    const rowKey = `${ex.exercise_id}-${ex.loggedSets.length + 1}`;
    setPulsingRow(rowKey);
    setTimeout(() => setPulsingRow(null), 300);

    setExercises(prev => prev.map((e, i) => i === exIdx ? { ...e, loggedSets: [...e.loggedSets, newSet] } : e));

    if (!dropSet) {
      if (isLastInSupersetGroup(exIdx)) {
        startRest();
      }
    }

    const setPayload = { session_id: sessionId, ...newSet };
    try {
      const saved = await api.logSet(setPayload);
      setExercises(prev => prev.map((e, i) => {
        if (i !== exIdx) return e;
        return { ...e, loggedSets: e.loggedSets.map(s => s === newSet ? { ...s, id: saved.id } : s) };
      }));
    } catch {
      // Offline — queue for later
      const localId = enqueue(setPayload);
      // Try once more when online event fires; dequeue on success
      const retryOnce = async () => {
        try {
          const saved = await api.logSet(setPayload);
          dequeue(localId);
          setExercises(prev => prev.map((e, i) => {
            if (i !== exIdx) return e;
            return { ...e, loggedSets: e.loggedSets.map(s => s === newSet ? { ...s, id: saved.id } : s) };
          }));
        } catch {}
        window.removeEventListener("online", retryOnce);
      };
      window.addEventListener("online", retryOnce);
    }

    if (!dropSet && normalSets.length + 1 >= ex.default_sets && exIdx < exercises.length - 1) {
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

  const setRir = (exIdx: number, setIdx: number, rir: number) => {
    const set = exercises[exIdx]?.loggedSets[setIdx];
    setExercises(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e,
      loggedSets: e.loggedSets.map((s, j) => j !== setIdx ? s : { ...s, rir }),
    }));
    setRirPickerKey(null);
    if (set?.id) api.updateSetRir(set.id, rir).catch(() => {});
  };

  const castVote = async (exerciseId: number, vote: number) => {
    const current = votes[exerciseId] ?? 0;
    const next = current === vote ? 0 : vote; // toggle off if same
    setVotes(prev => ({ ...prev, [exerciseId]: next }));
    api.voteExercise(exerciseId, next).catch(() => {});
  };

  const finishWorkout = () => {
    clearBackup();
    navigate(`/workout/${sessionId}/finish`);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const toDisplayWeight = (kg: number) => unit === "lbs" ? Math.round(kg * 2.205 * 10) / 10 : kg;
  const step = unit === "lbs" ? 5 : WEIGHT_STEP;

  const restProgress = DEFAULT_REST_SECONDS > 0 ? restTimer / DEFAULT_REST_SECONDS : 0;
  const circumference = 2 * Math.PI * 28;
  const strokeDashoffset = circumference * (1 - restProgress);

  const getSupersetColor = (group: number | null) => {
    if (group === null) return undefined;
    return SUPERSET_COLORS[(group - 1) % SUPERSET_COLORS.length];
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[var(--color-bg)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] flex flex-col">
      <header className="sticky top-0 z-50 bg-[var(--color-nav-bg)] backdrop-blur-xl px-4 py-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => setShowLeaveConfirm(true)} className="text-[var(--color-text-muted)] p-2 -ml-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="text-center">
            <div className="text-base font-bold tabular-nums">{formatTime(elapsed)}</div>
            <div className="text-[10px] text-[var(--color-text-secondary)]">{t("activeWorkout.setsLogged", { count: exercises.reduce((a, e) => a + e.loggedSets.length, 0) })}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPlateCalc(true)} className="p-2 text-[var(--color-text-muted)]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="3" x2="12" y2="8" />
                <line x1="12" y1="16" x2="12" y2="21" />
              </svg>
            </button>
            <button onClick={() => setUnit(u => u === "kg" ? "lbs" : "kg")} className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]">
              {unit}
            </button>
          </div>
        </div>
      </header>

      {isResting ? (
        <div className="bg-[var(--color-surface)] px-4 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="max-w-lg mx-auto flex items-center justify-center gap-6">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="var(--color-surface-alt)" strokeWidth="4" />
                <circle
                  cx="32" cy="32" r="28" fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold tabular-nums">{formatTime(restTimer)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-[var(--color-text-secondary)]">{t("activeWorkout.restTimer")}</span>
              <button onClick={skipRest} className="text-sm font-semibold text-[var(--color-accent)]">{t("activeWorkout.skip")}</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-lg mx-auto">
          {exercises.map((ex, exIdx) => {
            const isActive = exIdx === activeIdx;
            const normalSets = ex.loggedSets.filter(s => !s.is_drop_set);
            const isDone = normalSets.length >= ex.default_sets;
            const supersetColor = getSupersetColor(ex.superset_group);
            const isFirstInGroup = ex.superset_group !== null && (exIdx === 0 || exercises[exIdx - 1].superset_group !== ex.superset_group);

            return (
              <div key={ex.exercise_id}>
                {isFirstInGroup ? (
                  <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: supersetColor }} />
                    <span className="text-xs font-semibold" style={{ color: supersetColor }}>{t("activeWorkout.superset")}</span>
                  </div>
                ) : null}
                <div
                  ref={isActive ? activeExRef : undefined}
                  className={`transition-all ${isActive ? "exercise-highlight" : ""}`}
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    ...(ex.superset_group ? { borderLeft: `3px solid ${supersetColor}` } : {}),
                  }}
                >
                  <div className={`flex items-center ${isActive ? "" : "opacity-50"}`}>
                    <button
                      onClick={() => setActiveIdx(exIdx)}
                      className="flex-1 px-4 py-3.5 flex items-center gap-3 text-left"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        isDone
                          ? "bg-green-500/20 text-green-400"
                          : isActive
                          ? "text-white"
                          : "bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]"
                      }`}
                        style={isActive && !isDone ? { background: "var(--color-accent-gradient)" } : {}}
                      >
                        {isDone ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : exIdx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-base">{ex.name}</div>
                        <div className="text-xs text-[var(--color-text-secondary)]">{ex.muscle_group} · {normalSets.length}/{ex.default_sets} {t("activeWorkout.set").toLowerCase()}s</div>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 pr-3">
                      <button
                        onClick={() => castVote(ex.exercise_id, 1)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          votes[ex.exercise_id] === 1
                            ? "bg-green-500/20 text-green-400"
                            : "text-[var(--color-text-muted)] hover:text-green-400"
                        }`}
                        title="Like this exercise"
                      >
                        <svg className="w-4 h-4" fill={votes[ex.exercise_id] === 1 ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905a3.61 3.61 0 01-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => castVote(ex.exercise_id, -1)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          votes[ex.exercise_id] === -1
                            ? "bg-red-500/20 text-red-400"
                            : "text-[var(--color-text-muted)] hover:text-red-400"
                        }`}
                        title="Dislike this exercise"
                      >
                        <svg className="w-4 h-4" fill={votes[ex.exercise_id] === -1 ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905a3.61 3.61 0 01.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isActive ? (
                    <div className="px-4 pb-5">
                      <div className="mb-3">
                        <ExerciseMedia exerciseName={ex.name} showInstructions />
                      </div>
                      {ex.lastSessionSets.length > 0 ? (
                        <div className="mb-4 px-3 py-2 rounded-xl bg-[var(--color-surface)]">
                          <div className="text-[10px] text-[var(--color-text-muted)] mb-1 uppercase tracking-wider font-semibold">{t("activeWorkout.previous")}</div>
                          <div className="flex gap-3 flex-wrap">
                            {ex.lastSessionSets.map((s: any, i: number) => (
                              <span key={i} className="text-sm text-[var(--color-text-secondary)]">{toDisplayWeight(s.weight)}{unit} x {s.reps}</span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="mb-3 rounded-xl overflow-hidden bg-[var(--color-surface)]">
                        <div className="set-row px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]" style={{ borderBottom: "1px solid var(--color-border)" }}>
                          <span>{t("activeWorkout.set")}</span>
                          <span className="text-center">{t("activeWorkout.previous")}</span>
                          <span className="text-center">{t("activeWorkout.kg")}</span>
                          <span className="text-center">{t("activeWorkout.reps")}</span>
                          <span></span>
                        </div>
                        {ex.loggedSets.length > 0 ? ex.loggedSets.map((logged, i) => {
                          const rowKey = `${ex.exercise_id}-${i + 1}`;
                          const pickerKey = `${exIdx}-${i}`;
                          const showPicker = rirPickerKey === pickerKey;
                          return (
                            <React.Fragment key={i}>
                              <div
                                className={`set-row px-3 set-row-done ${pulsingRow === rowKey ? "log-pulse" : ""}`}
                              >
                                <span className="text-sm font-bold text-[var(--color-text-muted)]">
                                  {logged.is_drop_set ? (
                                    <span className="text-[10px] text-purple-400 font-semibold">{t("activeWorkout.drop")}</span>
                                  ) : (
                                    ex.loggedSets.filter((s, j) => j <= i && !s.is_drop_set).length
                                  )}
                                </span>
                                <span className="text-center text-xs text-[var(--color-text-muted)]">
                                  {!logged.is_drop_set && ex.lastSessionSets[ex.loggedSets.filter((s, j) => j <= i && !s.is_drop_set).length - 1]
                                    ? `${toDisplayWeight(ex.lastSessionSets[ex.loggedSets.filter((s, j) => j <= i && !s.is_drop_set).length - 1].weight)} x ${ex.lastSessionSets[ex.loggedSets.filter((s, j) => j <= i && !s.is_drop_set).length - 1].reps}`
                                    : "\u2014"}
                                </span>
                                <span className={`text-center text-sm font-bold ${logged.is_drop_set ? "text-purple-400" : ""}`}>
                                  {toDisplayWeight(logged.weight)}
                                </span>
                                <span className={`text-center text-sm font-bold ${logged.is_drop_set ? "text-purple-400" : ""}`}>
                                  {logged.reps}
                                </span>
                                <button
                                  onClick={() => setRirPickerKey(showPicker ? null : pickerKey)}
                                  className="flex flex-col items-center justify-center gap-0.5"
                                  title={t("activeWorkout.rirLabel")}
                                >
                                  {logged.rir !== undefined ? (
                                    <span className="text-xs font-bold text-[var(--color-accent)]">{logged.rir}</span>
                                  ) : (
                                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  <span className="text-[8px] text-[var(--color-text-faint)] leading-none">RiR</span>
                                </button>
                              </div>
                              {showPicker ? (
                                <div className="flex items-center gap-1 px-3 py-1.5 bg-[var(--color-surface-alt)] rounded-lg mx-3 mb-1">
                                  <span className="text-[10px] text-[var(--color-text-muted)] mr-1 font-medium">{t("activeWorkout.rirPrompt")}</span>
                                  {[0, 1, 2, 3, 4].map(v => (
                                    <button
                                      key={v}
                                      onClick={() => setRir(exIdx, i, v)}
                                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                                        logged.rir === v
                                          ? "text-white"
                                          : "bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
                                      }`}
                                      style={logged.rir === v ? { background: "var(--color-accent-gradient)" } : {}}
                                    >{v}</button>
                                  ))}
                                </div>
                              ) : null}
                            </React.Fragment>
                          );
                        }) : null}
                        {Array.from({ length: Math.max(0, ex.default_sets - normalSets.length) }, (_, i) => {
                          const setNum = normalSets.length + i + 1;
                          const prev = ex.lastSessionSets[normalSets.length + i];
                          const isNext = i === 0;
                          return (
                            <div key={`pending-${i}`} className={`set-row px-3 ${isNext ? "set-row-next" : ""}`}>
                              <span className="text-sm font-bold text-[var(--color-text-muted)]">{setNum}</span>
                              <span className="text-center text-xs text-[var(--color-text-muted)]">
                                {prev ? `${toDisplayWeight(prev.weight)} x ${prev.reps}` : "\u2014"}
                              </span>
                              {isNext ? (
                                <div className="flex items-center justify-center gap-0.5">
                                  <button
                                    onClick={() => adjustWeight(exIdx, -step)}
                                    className="w-5 h-5 rounded text-[10px] flex items-center justify-center bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] active:scale-90"
                                  >−</button>
                                  <input
                                    type="number"
                                    value={toDisplayWeight(ex.currentWeight)}
                                    onChange={e => {
                                      const v = parseFloat(e.target.value) || 0;
                                      const kg = unit === "lbs" ? Math.round(v / 2.205 * 10) / 10 : v;
                                      setExercises(prev2 => prev2.map((ex2, idx) => idx === exIdx ? { ...ex2, currentWeight: kg } : ex2));
                                    }}
                                    className="w-12 text-center text-sm font-bold bg-transparent border-b-2 border-[var(--color-accent)] outline-none py-0.5"
                                  />
                                  <button
                                    onClick={() => adjustWeight(exIdx, step)}
                                    className="w-5 h-5 rounded text-[10px] flex items-center justify-center bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] active:scale-90"
                                  >+</button>
                                </div>
                              ) : (
                                <span className="text-center text-sm text-[var(--color-text-muted)]">{"\u2014"}</span>
                              )}
                              {isNext ? (
                                <div className="flex items-center justify-center gap-0.5">
                                  <button
                                    onClick={() => adjustReps(exIdx, -REP_STEP)}
                                    className="w-5 h-5 rounded text-[10px] flex items-center justify-center bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] active:scale-90"
                                  >−</button>
                                  <input
                                    type="number"
                                    value={ex.currentReps}
                                    onChange={e => {
                                      const v = parseInt(e.target.value) || 0;
                                      setExercises(prev2 => prev2.map((ex2, idx) => idx === exIdx ? { ...ex2, currentReps: v } : ex2));
                                    }}
                                    className="w-10 text-center text-sm font-bold bg-transparent border-b-2 border-[var(--color-accent)] outline-none py-0.5"
                                  />
                                  <button
                                    onClick={() => adjustReps(exIdx, REP_STEP)}
                                    className="w-5 h-5 rounded text-[10px] flex items-center justify-center bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] active:scale-90"
                                  >+</button>
                                </div>
                              ) : (
                                <span className="text-center text-sm text-[var(--color-text-muted)]">{"\u2014"}</span>
                              )}
                              {isNext ? (
                                <button
                                  onClick={() => logSet(exIdx)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto"
                                  style={{ background: "var(--color-accent-gradient)" }}
                                  title={t("activeWorkout.logSet", { number: setNum })}
                                >
                                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                              ) : (
                                <span></span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => logSet(exIdx)}
                        className="w-full btn-primary text-base py-3.5 font-bold"
                      >
                        {t("activeWorkout.logSet", { number: normalSets.length + 1 })}
                      </button>

                      {ex.loggedSets.length > 0 ? (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => logSet(exIdx, true)}
                            className="flex-1 text-center text-sm py-2 font-semibold rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          >
                            {t("activeWorkout.dropSet")}
                          </button>
                          <button onClick={() => deleteLastSet(exIdx)} className="flex-1 text-center text-sm py-2 text-red-400/70 font-medium">
                            {t("activeWorkout.undoLastSet")}
                          </button>
                        </div>
                      ) : null}

                      <div className="mt-3">
                        <input
                          type="text"
                          value={ex.notes}
                          onChange={e => {
                            const val = e.target.value;
                            setExercises(prev => prev.map((ex2, i) => i === exIdx ? { ...ex2, notes: val } : ex2));
                          }}
                          placeholder={t("activeWorkout.notesPlaceholder")}
                          className="input w-full text-sm py-2"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[var(--color-nav-bg)] backdrop-blur-xl p-4 z-50" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className="max-w-lg mx-auto">
          <button onClick={finishWorkout} className="w-full btn bg-green-600 text-white hover:bg-green-700 min-h-12 text-base font-semibold rounded-xl">
            {t("activeWorkout.finishWorkout")}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={showLeaveConfirm}
        title={t("activeWorkout.leaveWorkout")}
        message={t("activeWorkout.leaveMessage")}
        confirmLabel={t("activeWorkout.leave")}
        destructive
        onConfirm={() => { clearBackup(); navigate("/"); }}
        onCancel={() => setShowLeaveConfirm(false)}
      />

      {showPlateCalc ? (
        <PlateCalculator
          unit={unit}
          onClose={() => setShowPlateCalc(false)}
        />
      ) : null}
    </div>
  );
}
