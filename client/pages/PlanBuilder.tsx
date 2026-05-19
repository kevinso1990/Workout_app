import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { api } from "../lib/api";
import { DEFAULT_SETS, DEFAULT_REPS, DEFAULT_WEIGHT } from "../config";
import ExerciseMedia from "../components/ExerciseMedia";
import { useTranslation } from "react-i18next";

interface PlanExercise {
  exercise_id: number;
  name: string;
  muscle_group: string;
  default_sets: number;
  default_reps: number;
  default_weight: number;
  superset_group: number | null;
}

const SUPERSET_COLORS = ["#4f8ef7", "#7c5bf5", "#22c55e", "#f59e0b", "#ef4444", "#ec4899"];

export default function PlanBuilder() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;

  const [name, setName] = useState("");
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [allExercises, setAllExercises] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customGroup, setCustomGroup] = useState("Chest");
  const [saving, setSaving] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    api.getExercises().then(setAllExercises);
    if (isEdit) {
      api.getPlan(parseInt(params.id!)).then(plan => {
        setName(plan.name);
        setExercises(plan.exercises.map((e: any) => ({
          exercise_id: e.exercise_id,
          name: e.name,
          muscle_group: e.muscle_group,
          default_sets: e.default_sets,
          default_reps: e.default_reps,
          default_weight: e.default_weight,
          superset_group: e.superset_group || null,
        })));
      });
    }
  }, [params.id]);

  const muscleGroups = [...new Set(allExercises.map(e => e.muscle_group))].sort();

  const filteredExercises = allExercises.filter(e => {
    if (filterGroup && e.muscle_group !== filterGroup) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    return !exercises.some(pe => pe.exercise_id === e.id);
  });

  const addExercise = (ex: any) => {
    setExercises([...exercises, {
      exercise_id: ex.id,
      name: ex.name,
      muscle_group: ex.muscle_group,
      default_sets: DEFAULT_SETS,
      default_reps: DEFAULT_REPS,
      default_weight: DEFAULT_WEIGHT,
      superset_group: null,
    }]);
  };

  const removeExercise = (idx: number) => {
    setExercises(exercises.filter((_, i) => i !== idx));
  };

  const moveExercise = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= exercises.length) return;
    const arr = [...exercises];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setExercises(arr);
  };

  const updateExercise = (idx: number, field: string, value: number) => {
    setExercises(exercises.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const linkSuperset = () => {
    if (selected.size < 2) return;
    const usedGroups = exercises.map(e => e.superset_group).filter((g): g is number => g !== null);
    const nextGroup = usedGroups.length > 0 ? Math.max(...usedGroups) + 1 : 1;
    setExercises(exercises.map((e, i) => selected.has(i) ? { ...e, superset_group: nextGroup } : e));
    setSelected(new Set());
    setSelectMode(false);
  };

  const unlinkSuperset = (group: number) => {
    setExercises(exercises.map(e => e.superset_group === group ? { ...e, superset_group: null } : e));
  };

  const getSupersetColor = (group: number | null) => {
    if (group === null) return undefined;
    return SUPERSET_COLORS[(group - 1) % SUPERSET_COLORS.length];
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data = {
        name,
        exercises: exercises.map(e => ({
          exercise_id: e.exercise_id,
          default_sets: e.default_sets,
          default_reps: e.default_reps,
          default_weight: e.default_weight,
          superset_group: e.superset_group,
        })),
      };
      if (isEdit) {
        await api.updatePlan(parseInt(params.id!), data);
      } else {
        await api.createPlan(data);
      }
      navigate("/plans");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCustom = async () => {
    if (!customName.trim()) return;
    const ex = await api.createExercise({ name: customName.trim(), muscle_group: customGroup });
    setAllExercises([...allExercises, ex]);
    addExercise(ex);
    setCustomName("");
    setShowCustom(false);
  };

  const supersetGroups = [...new Set(exercises.map(e => e.superset_group).filter((g): g is number => g !== null))];

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] flex flex-col">
      <header className="sticky top-0 z-40 bg-[var(--color-nav-bg)] backdrop-blur-xl px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => navigate("/plans")} className="btn-ghost min-h-0 px-2 py-1 text-sm">
            {t("planBuilder.cancel")}
          </button>
          <h1 className="font-bold">{isEdit ? t("planBuilder.editPlan") : t("planBuilder.newPlan")}</h1>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary min-h-0 px-4 py-1.5 text-sm">
            {saving ? t("planBuilder.saving") : t("planBuilder.save")}
          </button>
        </div>
      </header>

      <div className="flex-1 px-4 pt-4 pb-24 max-w-lg mx-auto w-full">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t("planBuilder.planNamePlaceholder")}
          className="input w-full text-lg font-bold mb-4"
          autoFocus
        />

        {exercises.length >= 2 ? (
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${selectMode ? "text-white" : "bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]"}`}
              style={selectMode ? { background: "var(--color-accent-gradient)" } : {}}
            >
              {t("planBuilder.superset")}
            </button>
            {selectMode && selected.size >= 2 ? (
              <button onClick={linkSuperset} className="text-xs px-3 py-1.5 rounded-full font-semibold text-white" style={{ background: "var(--color-accent-gradient)" }}>
                {t("planBuilder.linkSuperset")}
              </button>
            ) : null}
          </div>
        ) : null}

        {exercises.length > 0 ? (
          <div className="space-y-1 mb-6">
            {exercises.map((ex, idx) => {
              const isFirstInGroup = ex.superset_group !== null && (idx === 0 || exercises[idx - 1].superset_group !== ex.superset_group);
              const isInGroup = ex.superset_group !== null;
              const color = getSupersetColor(ex.superset_group);

              return (
                <React.Fragment key={`${ex.exercise_id}-${idx}`}>
                  {isFirstInGroup ? (
                    <div className="flex items-center justify-between pt-2 pb-1 px-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs font-semibold" style={{ color }}>{t("planBuilder.superset")}</span>
                      </div>
                      <button onClick={() => unlinkSuperset(ex.superset_group!)} className="text-xs text-[var(--color-text-muted)] hover:text-red-400">
                        {t("planBuilder.unlink")}
                      </button>
                    </div>
                  ) : null}
                  <div
                    className="card p-3"
                    style={isInGroup ? { borderLeft: `3px solid ${color}`, borderRadius: "0.75rem" } : {}}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {selectMode ? (
                        <button onClick={() => toggleSelect(idx)} className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${selected.has(idx) ? "border-[var(--color-accent)] bg-[var(--color-accent)]" : "border-[var(--color-border)]"}`}>
                          {selected.has(idx) ? (
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          ) : null}
                        </button>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => moveExercise(idx, -1)} disabled={idx === 0} className="text-[var(--color-text-muted)] disabled:opacity-20 p-0.5">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                          </button>
                          <button onClick={() => moveExercise(idx, 1)} disabled={idx === exercises.length - 1} className="text-[var(--color-text-muted)] disabled:opacity-20 p-0.5">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{ex.name}</div>
                        <div className="text-xs text-[var(--color-text-secondary)]">{ex.muscle_group}</div>
                        <ExerciseMedia exerciseName={ex.name} compact />
                      </div>
                      {!selectMode ? (
                        <button onClick={() => removeExercise(idx)} className="text-[var(--color-text-muted)] hover:text-red-400 p-1">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      ) : null}
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">{t("planBuilder.setsLabel")}</label>
                        <input type="number" value={ex.default_sets} onChange={e => updateExercise(idx, "default_sets", parseInt(e.target.value) || 0)} className="input w-full text-sm py-1.5 mt-0.5" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">{t("planBuilder.repsLabel")}</label>
                        <input type="number" value={ex.default_reps} onChange={e => updateExercise(idx, "default_reps", parseInt(e.target.value) || 0)} className="input w-full text-sm py-1.5 mt-0.5" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-[var(--color-text-muted)] uppercase font-semibold">{t("planBuilder.kgLabel")}</label>
                        <input type="number" value={ex.default_weight} onChange={e => updateExercise(idx, "default_weight", parseFloat(e.target.value) || 0)} className="input w-full text-sm py-1.5 mt-0.5" step="2.5" />
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        ) : null}

        <button onClick={() => setShowLibrary(true)} className="btn-outline w-full mb-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          {t("planBuilder.addExercise")}
        </button>
        <button onClick={() => setShowCustom(true)} className="btn-ghost w-full text-sm">
          {t("planBuilder.createCustom")}
        </button>
      </div>

      {showLibrary ? (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
          <div className="flex-1 bg-[var(--color-bg)] flex flex-col mt-8 rounded-t-2xl overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <h2 className="font-bold text-lg">{t("planBuilder.exerciseLibrary")}</h2>
              <button onClick={() => setShowLibrary(false)} className="btn-ghost min-h-0 px-2 py-1 text-sm">{t("planBuilder.done")}</button>
            </div>
            <div className="px-4 py-3 space-y-2">
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("planBuilder.searchPlaceholder")} className="input w-full" autoFocus />
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                <button onClick={() => setFilterGroup("")} className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-semibold ${!filterGroup ? "text-white" : "bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]"}`} style={!filterGroup ? { background: "var(--color-accent-gradient)" } : {}}>{t("planBuilder.all")}</button>
                {muscleGroups.map(mg => (
                  <button key={mg} onClick={() => setFilterGroup(mg)} className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-semibold ${filterGroup === mg ? "text-white" : "bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]"}`} style={filterGroup === mg ? { background: "var(--color-accent-gradient)" } : {}}>{mg}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="space-y-0.5">
                {filteredExercises.map(ex => (
                  <button key={ex.id} onClick={() => addExercise(ex)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--color-surface)] active:bg-[var(--color-surface-alt)] transition-colors text-left">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <ExerciseMedia exerciseName={ex.name} compact />
                      <div className="min-w-0">
                        <div className="font-medium">{ex.name}</div>
                        <div className="text-xs text-[var(--color-text-secondary)]">{ex.muscle_group}</div>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showCustom ? (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end">
          <div
            className="w-full bg-[var(--color-surface)] rounded-t-2xl p-5 overflow-y-auto"
            style={{ maxHeight: "80dvh", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
          >
            <h2 className="font-bold text-lg mb-4">{t("planBuilder.customExercise")}</h2>
            <input type="text" value={customName} onChange={e => setCustomName(e.target.value)} placeholder={t("planBuilder.exerciseName")} className="input w-full mb-3" autoFocus />
            <select value={customGroup} onChange={e => setCustomGroup(e.target.value)} className="input w-full mb-4">
              {(muscleGroups.length > 0 ? muscleGroups : ["Chest", "Back", "Shoulders", "Legs", "Biceps", "Triceps", "Core"]).map(mg => (
                <option key={mg} value={mg}>{mg}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowCustom(false)} className="btn-ghost flex-1">{t("planBuilder.cancel")}</button>
              <button onClick={handleCreateCustom} className="btn-primary flex-1">{t("planBuilder.create")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
