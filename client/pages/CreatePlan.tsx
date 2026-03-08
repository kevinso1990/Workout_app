import React, { useState } from "react";
import { useLocation } from "wouter";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";

const FREQUENCIES = [
  { days: 2, splitKey: "splits.fullBody" },
  { days: 3, splitKey: "splits.fullBodyOrPPL3" },
  { days: 4, splitKey: "splits.upperLower" },
  { days: 5, splitKey: "splits.upperLowerFull" },
  { days: 6, splitKey: "splits.pplx2" },
];

const EXPERIENCES = [
  { key: "beginner", labelKey: "onboarding.beginner", subKey: "onboarding.beginnerSub" },
  { key: "intermediate", labelKey: "onboarding.intermediate", subKey: "onboarding.intermediateSub" },
  { key: "advanced", labelKey: "onboarding.advanced", subKey: "onboarding.advancedSub" },
];

const GOALS = [
  { key: "muscle", labelKey: "onboarding.buildMuscle", icon: "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" },
  { key: "strength", labelKey: "onboarding.gainStrength", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { key: "fat", labelKey: "onboarding.loseFat", icon: "M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" },
  { key: "fitness", labelKey: "onboarding.generalFitness", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
];

const EQUIPMENT = [
  { key: "gym", labelKey: "onboarding.gym", icon: "M3 12h2m14 0h2M5 12a2 2 0 012-2V6a2 2 0 114 0v4a2 2 0 012 2s0 0 0 0a2 2 0 012-2V6a2 2 0 114 0v4a2 2 0 012 2" },
  { key: "dumbbells", labelKey: "onboarding.dumbbells", icon: "M3 12h18M7 8v8m10-8v8" },
  { key: "kettlebells", labelKey: "onboarding.kettlebells", icon: "M12 8a4 4 0 100-8 4 4 0 000 8zm-3 2a7 7 0 0014 0" },
  { key: "bands", labelKey: "onboarding.bands", icon: "M4 12c0-4 4-8 8-8s8 4 8 8-4 8-8 8-8-4-8-8z" },
  { key: "none", labelKey: "onboarding.noneEquipment", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
];

const EQUIPMENT_API_MAP: Record<string, string> = {
  gym: "barbell",
  kettlebells: "kettlebell",
  dumbbells: "dumbbell",
  bands: "bodyweight",
  none: "bodyweight",
};

function getSplitRecommendation(freq: number, t: (key: string, opts?: any) => string) {
  if (freq <= 3) return { name: t("splits.fullBody"), desc: t("onboarding.splitDescFullBody", { days: freq }) };
  if (freq === 4) return { name: t("splits.upperLower"), desc: t("onboarding.splitDescUpperLower") };
  if (freq === 5) return { name: t("splits.upperLowerFull"), desc: t("onboarding.splitDescUpperLowerFull") };
  return { name: t("splits.pplx2"), desc: t("onboarding.splitDescPPL") };
}

type Mode = "choose" | "generate" | "done";
type GenStep = "frequency" | "experience" | "goal" | "equipment" | "review";

const GEN_STEPS: GenStep[] = ["frequency", "experience", "goal", "equipment", "review"];

export default function CreatePlan() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("choose");
  const [genStep, setGenStep] = useState(0);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [experience, setExperience] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const currentStep = GEN_STEPS[genStep];

  const canProceed = () => {
    if (currentStep === "frequency") return frequency !== null;
    if (currentStep === "experience") return experience !== null;
    if (currentStep === "goal") return goal !== null;
    if (currentStep === "equipment") return equipment !== null;
    return true;
  };

  const nextStep = () => {
    if (genStep < GEN_STEPS.length - 1) setGenStep(genStep + 1);
  };

  const prevStep = () => {
    if (genStep > 0) setGenStep(genStep - 1);
    else setMode("choose");
  };

  const handleGenerate = async () => {
    if (!frequency || !experience || !goal) return;
    setGenerating(true);
    try {
      await api.autoGeneratePlans({ frequency, experience, goal, equipment: EQUIPMENT_API_MAP[equipment || "gym"] || "barbell" });
      navigate("/plans");
    } catch {
      setGenerating(false);
    }
  };

  const rec = frequency ? getSplitRecommendation(frequency, t) : null;

  if (mode === "choose") {
    return (
      <div className="px-4 pt-8 pb-4 max-w-lg mx-auto">
        <button onClick={() => navigate("/plans")} className="flex items-center gap-1 text-sm text-[var(--color-text-muted)] mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("createPlan.back")}
        </button>

        <h1 className="text-2xl font-bold mb-2">{t("createPlan.title")}</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mb-8">{t("createPlan.subtitle")}</p>

        <div className="space-y-3">
          <button
            onClick={() => setMode("generate")}
            className="w-full card p-5 text-left active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg, rgba(79,142,247,0.12), rgba(124,91,245,0.08))" }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center" style={{ background: "var(--color-accent-gradient)" }}>
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base mb-1">{t("createPlan.generateTitle")}</div>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{t("createPlan.generateDesc")}</p>
              </div>
              <svg className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          <button
            onClick={() => navigate("/plans/new")}
            className="w-full card p-5 text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center bg-[var(--color-surface-alt)]">
                <svg className="w-6 h-6 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base mb-1">{t("createPlan.manualTitle")}</div>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{t("createPlan.manualDesc")}</p>
              </div>
              <svg className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-8 pb-4 max-w-lg mx-auto">
      <button onClick={prevStep} className="flex items-center gap-1 text-sm text-[var(--color-text-muted)] mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {t("onboarding.back")}
      </button>

      <div className="flex items-center gap-1.5 mb-8">
        {GEN_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full flex-1 transition-all ${
              i <= genStep ? "" : "bg-[var(--color-border)]"
            }`}
            style={i <= genStep ? { background: "var(--color-accent-gradient)" } : {}}
          />
        ))}
      </div>

      {currentStep === "frequency" && (
        <div>
          <h2 className="text-xl font-bold mb-2">{t("onboarding.frequencyQuestion")}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">{t("createPlan.frequencyHint")}</p>
          <div className="space-y-2">
            {FREQUENCIES.map(f => (
              <button
                key={f.days}
                onClick={() => setFrequency(f.days)}
                className={`w-full p-4 rounded-xl flex items-center gap-4 transition-all border-2 ${
                  frequency === f.days
                    ? "border-[var(--color-accent)] bg-[rgba(79,142,247,0.1)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-alt)]"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                  frequency === f.days ? "text-white" : "text-[var(--color-text-secondary)] bg-[var(--color-surface)]"
                }`}
                  style={frequency === f.days ? { background: "var(--color-accent-gradient)" } : {}}
                >
                  {f.days}
                </div>
                <div className="text-left">
                  <div className="font-semibold">{t("createPlan.daysPerWeek", { count: f.days })}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{t(f.splitKey)}</div>
                </div>
                {frequency === f.days ? (
                  <svg className="w-5 h-5 ml-auto text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {currentStep === "experience" && (
        <div>
          <h2 className="text-xl font-bold mb-2">{t("onboarding.experienceQuestion")}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">{t("createPlan.experienceHint")}</p>
          <div className="space-y-2">
            {EXPERIENCES.map(e => (
              <button
                key={e.key}
                onClick={() => setExperience(e.key)}
                className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                  experience === e.key
                    ? "border-[var(--color-accent)] bg-[rgba(79,142,247,0.1)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-alt)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{t(e.labelKey)}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{t(e.subKey)}</div>
                  </div>
                  {experience === e.key ? (
                    <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {currentStep === "goal" && (
        <div>
          <h2 className="text-xl font-bold mb-2">{t("onboarding.goalQuestion")}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">{t("createPlan.goalHint")}</p>
          <div className="grid grid-cols-2 gap-3">
            {GOALS.map(g => (
              <button
                key={g.key}
                onClick={() => setGoal(g.key)}
                className={`p-4 rounded-xl text-center transition-all border-2 ${
                  goal === g.key
                    ? "border-[var(--color-accent)] bg-[rgba(79,142,247,0.1)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-alt)]"
                }`}
              >
                <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2 ${
                  goal === g.key ? "" : "bg-[var(--color-surface)]"
                }`}
                  style={goal === g.key ? { background: "var(--color-accent-gradient)" } : {}}
                >
                  <svg className={`w-5 h-5 ${goal === g.key ? "text-white" : "text-[var(--color-text-muted)]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={g.icon} />
                  </svg>
                </div>
                <div className="font-semibold text-sm">{t(g.labelKey)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {currentStep === "equipment" && (
        <div>
          <h2 className="text-xl font-bold mb-2">{t("onboarding.equipmentQuestion")}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">{t("createPlan.equipmentHint")}</p>
          <div className="space-y-2">
            {EQUIPMENT.map(eq => (
              <button
                key={eq.key}
                onClick={() => setEquipment(eq.key)}
                className={`w-full p-4 rounded-xl flex items-center gap-4 transition-all border-2 ${
                  equipment === eq.key
                    ? "border-[var(--color-accent)] bg-[rgba(79,142,247,0.1)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-alt)]"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  equipment === eq.key ? "" : "bg-[var(--color-surface)]"
                }`}
                  style={equipment === eq.key ? { background: "var(--color-accent-gradient)" } : {}}
                >
                  <svg className={`w-5 h-5 ${equipment === eq.key ? "text-white" : "text-[var(--color-text-muted)]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={eq.icon} />
                  </svg>
                </div>
                <div className="font-semibold text-left">{t(eq.labelKey)}</div>
                {equipment === eq.key ? (
                  <svg className="w-5 h-5 ml-auto text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {currentStep === "review" && rec ? (
        <div>
          <h2 className="text-xl font-bold mb-2">{t("createPlan.reviewTitle")}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">{t("createPlan.reviewDesc")}</p>

          <div className="card p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-muted)]">{t("createPlan.labelFrequency")}</span>
              <span className="text-sm font-semibold">{t("createPlan.daysPerWeek", { count: frequency })}</span>
            </div>
            <div className="h-px bg-[var(--color-border)]" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-muted)]">{t("createPlan.labelExperience")}</span>
              <span className="text-sm font-semibold">{t(`onboarding.${experience}`)}</span>
            </div>
            <div className="h-px bg-[var(--color-border)]" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-muted)]">{t("createPlan.labelGoal")}</span>
              <span className="text-sm font-semibold">{t(`onboarding.${goal === "muscle" ? "buildMuscle" : goal === "strength" ? "gainStrength" : goal === "fat" ? "loseFat" : "generalFitness"}`)}</span>
            </div>
            <div className="h-px bg-[var(--color-border)]" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-muted)]">{t("createPlan.labelEquipment")}</span>
              <span className="text-sm font-semibold">{t(`onboarding.${equipment}`)}</span>
            </div>
          </div>

          <div className="card p-4 mb-6" style={{ background: "linear-gradient(135deg, rgba(79,142,247,0.1), rgba(124,91,245,0.06))" }}>
            <div className="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider mb-1">{t("createPlan.recommendedSplit")}</div>
            <div className="font-bold text-lg">{rec.name}</div>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1 leading-relaxed">{rec.desc}</p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full btn-primary min-h-[3rem] text-sm mb-3"
          >
            {generating ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t("onboarding.creatingPlans")}
              </div>
            ) : t("createPlan.generateNow")}
          </button>
          <button onClick={() => navigate("/plans/new")} className="w-full btn-ghost min-h-[2.75rem] text-sm">
            {t("onboarding.buildOwn")}
          </button>
        </div>
      ) : null}

      {currentStep !== "review" ? (
        <div className="mt-8">
          <button
            onClick={nextStep}
            disabled={!canProceed()}
            className="w-full btn-primary min-h-[3rem] text-sm"
          >
            {t("onboarding.next")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
