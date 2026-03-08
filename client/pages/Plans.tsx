import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { api } from "../lib/api";
import ConfirmModal from "../components/ConfirmModal";
import { useTranslation } from "react-i18next";

const INITIAL_VISIBLE = 2;

function getPlanDescription(name: string, t: (key: string) => string): string {
  const n = name.toLowerCase().replace(/^kb\s*/, "");
  if (n.includes("push")) return t("plans.descPush");
  if (n.includes("pull")) return t("plans.descPull");
  if (n.includes("legs") || n.includes("leg")) return t("plans.descLegs");
  if (n === "upper a" || n.startsWith("upper a")) return t("plans.descUpperA");
  if (n === "upper b" || n.startsWith("upper b")) return t("plans.descUpperB");
  if (n === "lower a" || n.startsWith("lower a")) return t("plans.descLowerA");
  if (n === "lower b" || n.startsWith("lower b")) return t("plans.descLowerB");
  if (n.includes("upper")) return t("plans.descUpperA");
  if (n.includes("lower")) return t("plans.descLowerA");
  if (n.includes("full body") || n.includes("full_body")) return t("plans.descFullBody");
  return "";
}

const MUSCLE_FILTERS = ["All", "Chest", "Back", "Legs", "Shoulders", "Biceps", "Triceps"];

export default function Plans() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [muscleFilter, setMuscleFilter] = useState("All");

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

  const filteredPlans = muscleFilter === "All"
    ? plans
    : plans.filter(p => p.exercises?.some((e: any) => e.muscle_group === muscleFilter));

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
        <h1 className="text-2xl font-bold">{t("plans.title")}</h1>
        <Link href="/plans/create">
          <button className="btn-primary text-sm px-4 py-2 min-h-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t("plans.new")}
          </button>
        </Link>
      </div>

      {plans.length > 0 ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 -mx-1 px-1 scrollbar-none">
          {MUSCLE_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => { setMuscleFilter(f); setShowAll(false); }}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                muscleFilter === f
                  ? "text-white"
                  : "bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]"
              }`}
              style={muscleFilter === f ? { background: "var(--color-accent-gradient)" } : {}}
            >
              {f === "All" ? t("planBuilder.all") : f}
            </button>
          ))}
        </div>
      ) : null}

      {filteredPlans.length === 0 && plans.length > 0 ? (
        <div className="card p-6 text-center">
          <p className="text-[var(--color-text-secondary)] text-sm">{t("plans.noPlansFilter")}</p>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-[var(--color-text-secondary)] mb-4">{t("plans.noPlans")}</p>
          <Link href="/plans/create">
            <button className="btn-primary">{t("plans.createPlan")}</button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(showAll ? filteredPlans : filteredPlans.slice(0, INITIAL_VISIBLE)).map(plan => {
            const desc = getPlanDescription(plan.name, t);
            return (
            <div key={plan.id} className="card p-4">
              <div className="mb-3">
                <h3 className="font-bold text-lg">{plan.name}</h3>
                {desc ? (
                  <p className="text-xs text-[var(--color-accent)] font-medium mb-0.5">{desc}</p>
                ) : null}
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t("plans.exercises", { count: plan.exercises?.length || 0 })}
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
                  {t("plans.start")}
                </button>
                <Link href={`/plans/${plan.id}/edit`}>
                  <button className="btn-ghost text-sm min-h-11">{t("plans.edit")}</button>
                </Link>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteId(plan.id); }} className="btn-ghost text-red-400/70 text-sm min-h-11">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            );
          })}
          {filteredPlans.length > INITIAL_VISIBLE ? (
            <button
              onClick={() => setShowAll(v => !v)}
              className="w-full btn-ghost text-sm min-h-11"
            >
              {showAll
                ? t("plans.showLess")
                : t("plans.seeAllPlans", { count: filteredPlans.length - INITIAL_VISIBLE })}
            </button>
          ) : null}
        </div>
      )}

      <ConfirmModal
        open={deleteId !== null}
        title={t("plans.deletePlan")}
        message={t("plans.deleteConfirm")}
        confirmLabel={t("plans.delete")}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
