import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { api } from "../lib/api";
import ConfirmModal from "../components/ConfirmModal";

export default function Plans() {
  const [, navigate] = useLocation();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    api.getPlans().then(setPlans).finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (deleteId === null) return;
    await api.deletePlan(deleteId);
    setPlans(plans.filter(p => p.id !== deleteId));
    setDeleteId(null);
  };

  const startWorkout = async (planId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const session = await api.startSession(planId);
    navigate(`/workout/${session.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60dvh]">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-8 pb-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Plans</h1>
        <Link href="/plans/new">
          <button className="btn-primary text-sm px-4 py-2 min-h-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New
          </button>
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-[var(--color-text-secondary)] mb-4">No plans yet. Create one to get started.</p>
          <Link href="/plans/new">
            <button className="btn-primary">Create Plan</button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className="card p-4">
              <div className="mb-3">
                <h3 className="font-bold text-lg">{plan.name}</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {plan.exercises?.length || 0} exercises
                </p>
              </div>

              {plan.exercises?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {[...new Set(plan.exercises.map((e: any) => e.muscle_group))].map((mg: any) => (
                    <span key={mg} className="tag-pill">{mg}</span>
                  ))}
                </div>
              ) : null}

              <div className="flex gap-2">
                <button onClick={(e) => startWorkout(plan.id, e)} className="btn-primary flex-1 text-sm min-h-11">
                  Start
                </button>
                <Link href={`/plans/${plan.id}/edit`}>
                  <button className="btn-ghost text-sm min-h-11">Edit</button>
                </Link>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteId(plan.id); }} className="btn-ghost text-red-400/70 text-sm min-h-11">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={deleteId !== null}
        title="Delete Plan"
        message="Are you sure? This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
