import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

interface RecoveryData {
  muscle_group: string;
  recovery_percent: number;
  fatigue_score: number;
}

function getBarColor(percent: number): string {
  if (percent <= 40) return "#ef4444";
  if (percent <= 70) return "#f59e0b";
  return "#22c55e";
}

function getBarBg(percent: number): string {
  if (percent <= 40) return "rgba(239, 68, 68, 0.15)";
  if (percent <= 70) return "rgba(245, 158, 11, 0.15)";
  return "rgba(34, 197, 94, 0.15)";
}

export default function RecoveryPanel() {
  const [recovery, setRecovery] = useState<RecoveryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRecovery()
      .then(setRecovery)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const trained = recovery.filter(r => r.recovery_percent < 100);
  if (trained.length === 0) return null;

  const sorted = [...trained].sort((a, b) => a.recovery_percent - b.recovery_percent);

  return (
    <section className="mb-6">
      <div className="section-label">Recovery Status</div>
      <div className="card p-4">
        <div className="space-y-3">
          {sorted.map(r => (
            <div key={r.muscle_group}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-[var(--color-text)]">{r.muscle_group}</span>
                <span
                  className="font-semibold tabular-nums"
                  style={{ color: getBarColor(r.recovery_percent) }}
                >
                  {r.recovery_percent}%
                </span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: getBarBg(r.recovery_percent) }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${r.recovery_percent}%`,
                    backgroundColor: getBarColor(r.recovery_percent),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function useRecoveryWarning(muscleGroups: string[]) {
  const [recovery, setRecovery] = useState<RecoveryData[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getRecovery()
      .then(setRecovery)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return { fatigued: [], show: false };

  const uniqueMuscles = [...new Set(muscleGroups.map(m => m.toLowerCase()))];
  const fatigued = recovery.filter(r =>
    uniqueMuscles.includes(r.muscle_group.toLowerCase()) && r.recovery_percent < 50
  );

  return { fatigued, show: fatigued.length > 0 };
}
