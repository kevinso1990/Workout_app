import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { isOnboardingDone, markOnboardingDone } from "../lib/onboarding";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";
import { subscribeToPush } from "../lib/notifications";

const FREQUENCIES = [
  { days: 2, splitKey: "splits.fullBody" },
  { days: 3, splitKey: "splits.fullBodyOrPPL3" },
  { days: 4, splitKey: "splits.upperLower" },
  { days: 5, splitKey: "splits.upperLowerFull" },
  { days: 6, splitKey: "splits.pplx2" },
];

const EXPERIENCES = [
  { key: "beginner",     icon: "🌱", labelKey: "onboarding.beginner",     subKey: "onboarding.beginnerSub" },
  { key: "intermediate", icon: "💪", labelKey: "onboarding.intermediate", subKey: "onboarding.intermediateSub" },
  { key: "advanced",     icon: "🏆", labelKey: "onboarding.advanced",     subKey: "onboarding.advancedSub" },
];

const GOALS = [
  { key: "muscle",   icon: "💪", labelKey: "onboarding.buildMuscle",    descKey: "onboarding.goalMuscleDesc" },
  { key: "strength", icon: "🏋️", labelKey: "onboarding.gainStrength",   descKey: "onboarding.goalStrengthDesc" },
  { key: "fat",      icon: "🔥", labelKey: "onboarding.loseFat",        descKey: "onboarding.goalFatDesc" },
  { key: "fitness",  icon: "⚡", labelKey: "onboarding.generalFitness", descKey: "onboarding.goalFitnessDesc" },
];

const EQUIPMENT = [
  { key: "gym",         icon: "🏋️", labelKey: "onboarding.gym" },
  { key: "kettlebells", icon: "🔔", labelKey: "onboarding.kettlebells" },
  { key: "dumbbells",   icon: "🏅", labelKey: "onboarding.dumbbells" },
  { key: "bands",       icon: "🪢", labelKey: "onboarding.bands" },
  { key: "none",        icon: "🤸", labelKey: "onboarding.noneEquipment" },
];

const EQUIPMENT_API_MAP: Record<string, string> = {
  gym: "barbell",
  kettlebells: "kettlebell",
  dumbbells: "dumbbell",
  bands: "bodyweight",
  none: "bodyweight",
};

// Approximate exercises per session and duration for each split
const SPLIT_INFO: Record<number, { exercises: number; minutes: number }> = {
  2: { exercises: 10, minutes: 55 },
  3: { exercises: 9,  minutes: 50 },
  4: { exercises: 8,  minutes: 45 },
  5: { exercises: 8,  minutes: 45 },
  6: { exercises: 7,  minutes: 40 },
};

function getSplitRecommendation(freq: number, t: (key: string, opts?: any) => string) {
  if (freq <= 3) return { name: t("splits.fullBody"), desc: t("onboarding.splitDescFullBody", { days: freq }) };
  if (freq === 4) return { name: t("splits.upperLower"), desc: t("onboarding.splitDescUpperLower") };
  if (freq === 5) return { name: t("splits.upperLowerFull"), desc: t("onboarding.splitDescUpperLowerFull") };
  return { name: t("splits.pplx2"), desc: t("onboarding.splitDescPPL") };
}

export default function Onboarding() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [experience, setExperience] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isOnboardingDone()) setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    markOnboardingDone();
    setVisible(false);
  };

  const TOTAL_STEPS = 6;

  const canProceed = () => {
    if (step === 1) return frequency !== null;
    if (step === 2) return experience !== null;
    if (step === 3) return goal !== null;
    if (step === 4) return equipment !== null;
    return true;
  };

  const next = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else dismiss();
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleNotificationRequest = async () => {
    try {
      const subscribed = await subscribeToPush();
      setNotifGranted(subscribed);
    } catch {}
  };

  const useRecommended = async () => {
    if (!frequency || !experience || !goal) return;
    setGenerating(true);
    try {
      await api.autoGeneratePlans({ frequency, experience, goal, equipment: EQUIPMENT_API_MAP[equipment || "gym"] || "barbell" });
      dismiss();
      navigate("/plans");
    } catch {
      setGenerating(false);
    }
  };

  const buildOwn = () => {
    dismiss();
    navigate("/plans/new");
  };

  const rec = frequency ? getSplitRecommendation(frequency, t) : null;
  const splitInfo = frequency ? SPLIT_INFO[frequency] ?? { exercises: 8, minutes: 45 } : null;
  const isBeginnerSelected = experience === "beginner";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={dismiss} />
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl bg-[var(--color-surface)] overflow-hidden flex flex-col"
        style={{ maxHeight: "90dvh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 overflow-y-auto">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: "var(--color-accent-gradient)" }}>
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold">{t("onboarding.welcome")}</h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {t("onboarding.welcomeSub")}
              </p>
            </div>
          )}

          {/* Step 1: Frequency */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-center">{t("onboarding.frequencyQuestion")}</h2>
              <div className="grid grid-cols-2 gap-2">
                {FREQUENCIES.map(f => (
                  <button
                    key={f.days}
                    onClick={() => setFrequency(f.days)}
                    className={`p-3 rounded-xl text-left transition-all border-2 ${
                      frequency === f.days
                        ? "border-[var(--color-accent)] bg-[rgba(79,142,247,0.1)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface-alt)] hover:border-[var(--color-accent)] hover:bg-[rgba(79,142,247,0.05)]"
                    }`}
                  >
                    <span className="text-2xl font-bold">{f.days}</span>
                    <span className="text-sm text-[var(--color-text-secondary)] ml-1">{t("onboarding.daysUnit")}</span>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-1">{t(f.splitKey)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Experience */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-center">{t("onboarding.experienceQuestion")}</h2>
              <div className="space-y-2">
                {EXPERIENCES.map(e => (
                  <button
                    key={e.key}
                    onClick={() => setExperience(e.key)}
                    className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                      experience === e.key
                        ? "border-[var(--color-accent)] bg-[rgba(79,142,247,0.1)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface-alt)] hover:border-[var(--color-accent)] hover:bg-[rgba(79,142,247,0.05)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl leading-none">{e.icon}</span>
                      <div>
                        <div className="font-semibold">{t(e.labelKey)}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{t(e.subKey)}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Goal */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-center">{t("onboarding.goalQuestion")}</h2>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map(g => (
                  <button
                    key={g.key}
                    onClick={() => setGoal(g.key)}
                    className={`p-4 rounded-xl text-center transition-all border-2 ${
                      goal === g.key
                        ? "border-[var(--color-accent)] bg-[rgba(79,142,247,0.1)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface-alt)] hover:border-[var(--color-accent)] hover:bg-[rgba(79,142,247,0.05)]"
                    }`}
                  >
                    <div className="text-2xl mb-1">{g.icon}</div>
                    <div className="font-semibold text-sm">{t(g.labelKey)}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-snug">{t(g.descKey)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Equipment */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-center">{t("onboarding.equipmentQuestion")}</h2>
              <div className="grid grid-cols-2 gap-2">
                {EQUIPMENT.map(eq => (
                  <button
                    key={eq.key}
                    onClick={() => setEquipment(eq.key)}
                    className={`p-4 rounded-xl transition-all border-2 ${
                      equipment === eq.key
                        ? "border-[var(--color-accent)] bg-[rgba(79,142,247,0.1)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface-alt)] hover:border-[var(--color-accent)] hover:bg-[rgba(79,142,247,0.05)]"
                    }`}
                  >
                    <div className="text-2xl mb-1">{eq.icon}</div>
                    <div className="font-semibold text-sm">{t(eq.labelKey)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Plan recommendation */}
          {step === 5 && rec ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-center">{t("onboarding.recommendedPlan")}</h2>

              {/* Plan card */}
              <div className="p-4 rounded-xl bg-[var(--color-surface-alt)]">
                <div className="font-bold text-[var(--color-accent)] mb-1 text-base">{rec.name}</div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{rec.desc}</p>
                {splitInfo ? (
                  <div className="flex gap-3 mt-2">
                    <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {t("onboarding.exercisesPerSession", { count: splitInfo.exercises })}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                      {t("onboarding.approxSessionTime", { min: splitInfo.minutes })}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Beginner tip */}
              {isBeginnerSelected ? (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <span className="text-base leading-none mt-0.5">💡</span>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    {t("onboarding.beginnerTip")}
                  </p>
                </div>
              ) : null}

              {/* Notification toggle */}
              <button
                onClick={handleNotificationRequest}
                disabled={notifGranted}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  notifGranted
                    ? "border-green-500/40 bg-green-500/10"
                    : "border-[var(--color-border)] bg-[var(--color-surface-alt)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🔔</span>
                  <div className="text-left">
                    <div className="text-sm font-medium">{t("onboarding.enableNotifications")}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">{t("onboarding.notifOptional")}</div>
                  </div>
                </div>
                {notifGranted ? (
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>

              <button
                onClick={useRecommended}
                disabled={generating}
                className="w-full btn-primary min-h-[3rem] text-sm"
              >
                {generating ? t("onboarding.creatingPlans") : t("onboarding.useRecommended")}
              </button>
              <button onClick={buildOwn} className="w-full btn-ghost min-h-[2.75rem] text-sm">
                {t("onboarding.buildOwn")}
              </button>
            </div>
          ) : null}

          {step < 5 ? (
            <>
              <div className="flex items-center justify-center gap-1.5 mt-6 mb-4">
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === step ? "w-6" : "w-1.5 bg-[var(--color-border)]"}`}
                    style={i === step ? { background: "var(--color-accent-gradient)" } : {}}
                  />
                ))}
              </div>
              <div className="flex gap-3">
                {step > 0 ? (
                  <button onClick={prev} className="flex-1 btn-ghost min-h-[2.75rem] text-sm">{t("onboarding.back")}</button>
                ) : (
                  <button onClick={dismiss} className="flex-1 btn-ghost min-h-[2.75rem] text-sm">{t("onboarding.skip")}</button>
                )}
                <button
                  onClick={next}
                  disabled={!canProceed()}
                  className="flex-1 btn-primary min-h-[2.75rem] text-sm"
                >
                  {step === 0 ? t("onboarding.getStarted") : t("onboarding.next")}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
