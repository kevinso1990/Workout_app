import React, { useState, useEffect } from "react";
import { isOnboardingDone, markOnboardingDone } from "../lib/onboarding";

const STEPS = [
  {
    title: "Create a Plan",
    description: "Build your workout plan from 100+ exercises. Set target sets, reps, and weight for each.",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  },
  {
    title: "Start a Workout",
    description: "Tap Start on any plan. Adjust weight and reps, then tap Log Set. 3 taps total.",
    icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z",
  },
  {
    title: "Track Progress",
    description: "Rate your difficulty after each workout. The app recommends what to do next.",
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOnboardingDone()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    markOnboardingDone();
    setVisible(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={dismiss}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm mx-4 mb-8 sm:mb-0 rounded-2xl p-6 bg-[var(--color-surface)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(79, 142, 247, 0.15)" }}>
            <svg className="w-7 h-7 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={current.icon} />
            </svg>
          </div>
        </div>

        <h3 className="text-lg font-bold text-center mb-2">{current.title}</h3>
        <p className="text-sm text-center text-[var(--color-text-secondary)] mb-6 leading-relaxed">{current.description}</p>

        <div className="flex items-center justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6" : "w-1.5 bg-[var(--color-border)]"}`}
              style={i === step ? { background: "var(--color-accent-gradient)" } : {}}
            />
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={dismiss} className="flex-1 btn-ghost min-h-[2.75rem] text-sm">
            Skip
          </button>
          <button onClick={next} className="flex-1 btn-primary min-h-[2.75rem] text-sm">
            {step < STEPS.length - 1 ? "Next" : "Get Started"}
          </button>
        </div>
      </div>
    </div>
  );
}
