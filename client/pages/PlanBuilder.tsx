import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { api } from "../lib/api";
import { DEFAULT_SETS, DEFAULT_REPS, DEFAULT_WEIGHT } from "../config";

interface PlanExercise {
  exercise_id: number;
  name: string;
  muscle_group: string;
  default_sets: number;
  default_reps: number;
  default_weight: number;
}

export default function PlanBuilder() {
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

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data = { name, exercises: exercises.map(e => ({ exercise_id: e.exercise_id, default_sets: e.default_sets, default_reps: e.default_reps, default_weight: e.default_weight })) };
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

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] flex flex-col">
      <header className="sticky top-0 z-40 bg-[var(--color-nav-bg)] backdrop-blur-lg border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => navigate("/plans")} className="btn-ghost min-h-0 px-2 py-1 text-sm">
            Cancel
          </button>
          <h1 className="font-semibold">{isEdit ? "Edit Plan" : "New Plan"}</h1>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary min-h-0 px-4 py-1.5 text-sm">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </header>

      <div className="flex-1 px-4 pt-4 pb-24 max-w-lg mx-auto w-full">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Plan name (e.g. Push Day A)"
          className="input w-full text-lg font-semibold mb-6"
          autoFocus
        />

        {exercises.length > 0 ? (
          <div className="space-y-2 mb-6">
            {exercises.map((ex, idx) => (
              <div key={`${ex.exercise_id}-${idx}`} className="card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveExercise(idx, -1)} disabled={idx === 0} className="text-neutral-600 hover:text-neutral-400 disabled:opacity-20 p-0.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => moveExercise(idx, 1)} disabled={idx === exercises.length - 1} className="text-neutral-600 hover:text-neutral-400 disabled:opacity-20 p-0.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{ex.name}</div>
                    <div className="text-xs text-neutral-500">{ex.muscle_group}</div>
                  </div>
                  <button onClick={() => removeExercise(idx)} className="text-neutral-600 hover:text-red-400 p-1">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-neutral-500">Sets</label>
                    <input type="number" value={ex.default_sets} onChange={e => updateExercise(idx, "default_sets", parseInt(e.target.value) || 0)} className="input w-full text-sm py-1.5 mt-0.5" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-neutral-500">Reps</label>
                    <input type="number" value={ex.default_reps} onChange={e => updateExercise(idx, "default_reps", parseInt(e.target.value) || 0)} className="input w-full text-sm py-1.5 mt-0.5" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-neutral-500">Weight (kg)</label>
                    <input type="number" value={ex.default_weight} onChange={e => updateExercise(idx, "default_weight", parseFloat(e.target.value) || 0)} className="input w-full text-sm py-1.5 mt-0.5" step="2.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <button onClick={() => setShowLibrary(true)} className="btn-outline w-full mb-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Exercise
        </button>
        <button onClick={() => setShowCustom(true)} className="btn-ghost w-full text-sm">
          Create Custom Exercise
        </button>
      </div>

      {showLibrary ? (
        <div className="fixed inset-0 bg-black/70 z-50 flex flex-col">
          <div className="flex-1 bg-[var(--color-bg)] flex flex-col mt-8 rounded-t-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <h2 className="font-semibold text-lg">Exercise Library</h2>
              <button onClick={() => setShowLibrary(false)} className="btn-ghost min-h-0 px-2 py-1">Done</button>
            </div>

            <div className="px-4 py-3 space-y-2">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search exercises..."
                className="input w-full"
                autoFocus
              />
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                <button onClick={() => setFilterGroup("")} className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${!filterGroup ? "bg-brand text-white" : "bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]"}`}>All</button>
                {muscleGroups.map(mg => (
                  <button key={mg} onClick={() => setFilterGroup(mg)} className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${filterGroup === mg ? "bg-brand text-white" : "bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]"}`}>{mg}</button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="space-y-1">
                {filteredExercises.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => addExercise(ex)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--color-surface)] active:bg-[var(--color-surface-alt)] transition-colors text-left"
                  >
                    <div>
                      <div className="font-medium">{ex.name}</div>
                      <div className="text-xs text-neutral-500">{ex.muscle_group}</div>
                    </div>
                    <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showCustom ? (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="w-full bg-[var(--color-surface)] rounded-t-2xl p-4 pb-8">
            <h2 className="font-semibold text-lg mb-4">Create Custom Exercise</h2>
            <input type="text" value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Exercise name" className="input w-full mb-3" autoFocus />
            <select value={customGroup} onChange={e => setCustomGroup(e.target.value)} className="input w-full mb-4">
              {(muscleGroups.length > 0 ? muscleGroups : ["Chest", "Back", "Shoulders", "Legs", "Biceps", "Triceps", "Core"]).map(mg => (
                <option key={mg} value={mg}>{mg}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowCustom(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={handleCreateCustom} className="btn-primary flex-1">Create</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
