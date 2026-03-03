import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { isOnboardingDone, markOnboardingDone } from "../lib/onboarding";
import { api } from "../lib/api";

const FREQUENCIES = [
  { days: 2, split: "Full Body" },
  { days: 3, split: "Full Body or PPL (3-day)" },
  { days: 4, split: "Upper / Lower Split" },
  { days: 5, split: "Upper / Lower + Full Body" },
  { days: 6, split: "Push / Pull / Legs (PPL x2)" },
];

const EXPERIENCES = [
  { key: "beginner", label: "Beginner", sub: "Under 1 year" },
  { key: "intermediate", label: "Intermediate", sub: "1–3 years" },
  { key: "advanced", label: "Advanced", sub: "3+ years" },
];

const GOALS = [
  { key: "muscle", label: "Build Muscle", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" },
  { key: "strength", label: "Gain Strength", icon: "M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2.71 7l1.43 1.43L2.71 9.86 4.14 11.29 7 8.43 15.57 17l-2.86 2.86 1.43 1.43 1.43-1.43 1.43 1.43 2.14-2.14 1.43 1.43 2.14-2.14 1.43 1.43" },
  { key: "fat", label: "Lose Fat", icon: "M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 16.89 19.17C18.55 17.36 19.07 14.68 17.66 12.55L17.66 11.2Z" },
  { key: "fitness", label: "General Fitness", icon: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" },
];

function getSplitRecommendation(freq: number, exp: string) {
  if (freq <= 3) return { name: "Full Body", desc: `${freq} days/week hitting all major muscles each session. Great for ${exp === "beginner" ? "building a foundation" : "efficient training"}.` };
  if (freq === 4) return { name: "Upper / Lower Split", desc: "Train upper body and lower body on alternating days. Each muscle group gets hit twice per week for maximum growth." };
  if (freq === 5) return { name: "Upper / Lower + Full Body", desc: "5-day split combining upper/lower days with a full body session for balanced weekly volume." };
  return { name: "Push / Pull / Legs (PPL)", desc: "The classic 6-day split: Push (chest/shoulders/triceps), Pull (back/biceps), Legs — each twice per week." };
}

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [experience, setExperience] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isOnboardingDone()) setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    markOnboardingDone();
    setVisible(false);
  };

  const canProceed = () => {
    if (step === 1) return frequency !== null;
    if (step === 2) return experience !== null;
    if (step === 3) return goal !== null;
    return true;
  };

  const next = () => {
    if (step < 4) setStep(step + 1);
    else dismiss();
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const useRecommended = async () => {
    if (!frequency || !experience || !goal) return;
    setGenerating(true);
    try {
      await api.autoGeneratePlans({ frequency, experience, goal });
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

  const rec = frequency ? getSplitRecommendation(frequency, experience || "beginner") : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={dismiss} />
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl bg-[var(--color-surface)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          {step === 0 && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: "var(--color-accent-gradient)" }}>
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold">Let's build your perfect workout plan</h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Answer 3 quick questions and we'll set everything up for you
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-center">How many days per week can you train?</h2>
              <div className="grid grid-cols-2 gap-2">
                {FREQUENCIES.map(f => (
                  <button
                    key={f.days}
                    onClick={() => setFrequency(f.days)}
                    className={`p-3 rounded-xl text-left transition-all border-2 ${
                      frequency === f.days
                        ? "border-[var(--color-accent)] bg-[rgba(79,142,247,0.1)]"
                        : "border-transparent bg-[var(--color-surface-alt)]"
                    }`}
                  >
                    <span className="text-2xl font-bold">{f.days}</span>
                    <span className="text-sm text-[var(--color-text-secondary)] ml-1">days</span>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-1">{f.split}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-center">What is your training experience?</h2>
              <div className="space-y-2">
                {EXPERIENCES.map(e => (
                  <button
                    key={e.key}
                    onClick={() => setExperience(e.key)}
                    className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                      experience === e.key
                        ? "border-[var(--color-accent)] bg-[rgba(79,142,247,0.1)]"
                        : "border-transparent bg-[var(--color-surface-alt)]"
                    }`}
                  >
                    <div className="font-semibold">{e.label}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{e.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-center">What is your main goal?</h2>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map(g => (
                  <button
                    key={g.key}
                    onClick={() => setGoal(g.key)}
                    className={`p-4 rounded-xl text-center transition-all border-2 ${
                      goal === g.key
                        ? "border-[var(--color-accent)] bg-[rgba(79,142,247,0.1)]"
                        : "border-transparent bg-[var(--color-surface-alt)]"
                    }`}
                  >
                    <div className="font-semibold text-sm">{g.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && rec && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-center">Your Recommended Plan</h2>
              <div className="p-4 rounded-xl bg-[var(--color-surface-alt)]">
                <div className="font-bold text-[var(--color-accent)] mb-1">{rec.name}</div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{rec.desc}</p>
              </div>
              <button
                onClick={useRecommended}
                disabled={generating}
                className="w-full btn-primary min-h-[3rem] text-sm"
              >
                {generating ? "Creating plans..." : "Use Recommended Split"}
              </button>
              <button onClick={buildOwn} className="w-full btn-ghost min-h-[2.75rem] text-sm">
                Build My Own
              </button>
            </div>
          )}

          {step < 4 && (
            <>
              <div className="flex items-center justify-center gap-1.5 mt-6 mb-4">
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === step ? "w-6" : "w-1.5 bg-[var(--color-border)]"}`}
                    style={i === step ? { background: "var(--color-accent-gradient)" } : {}}
                  />
                ))}
              </div>

              <div className="flex gap-3">
                {step > 0 ? (
                  <button onClick={prev} className="flex-1 btn-ghost min-h-[2.75rem] text-sm">Back</button>
                ) : (
                  <button onClick={dismiss} className="flex-1 btn-ghost min-h-[2.75rem] text-sm">Skip</button>
                )}
                <button
                  onClick={next}
                  disabled={!canProceed()}
                  className="flex-1 btn-primary min-h-[2.75rem] text-sm"
                >
                  {step === 0 ? "Get Started" : "Next"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
