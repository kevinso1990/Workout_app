import React, { useState, useEffect } from "react";
import { api } from "../lib/api";

const MUSCLE_PATHS: Record<string, { d: string; cx: number; cy: number }> = {
  Chest: { d: "M35,28 Q50,25 65,28 L62,40 Q50,42 38,40 Z", cx: 50, cy: 34 },
  Shoulders: { d: "M28,24 L35,28 L35,35 L25,32 Z M72,24 L65,28 L65,35 L75,32 Z", cx: 50, cy: 28 },
  Biceps: { d: "M22,34 L28,34 L26,50 L20,50 Z M78,34 L72,34 L74,50 L80,50 Z", cx: 50, cy: 42 },
  Triceps: { d: "M18,34 L22,34 L20,50 L16,50 Z M82,34 L78,34 L80,50 L84,50 Z", cx: 50, cy: 42 },
  Back: { d: "M38,28 Q50,26 62,28 L60,50 Q50,52 40,50 Z", cx: 50, cy: 39 },
  Core: { d: "M40,42 L60,42 L58,60 Q50,62 42,60 Z", cx: 50, cy: 51 },
  Legs: { d: "M38,62 L48,62 L46,90 L36,90 Z M52,62 L62,62 L64,90 L54,90 Z", cx: 50, cy: 76 },
  Traps: { d: "M38,20 Q50,16 62,20 L58,28 Q50,26 42,28 Z", cx: 50, cy: 23 },
  Forearms: { d: "M16,52 L22,52 L20,66 L14,66 Z M84,52 L78,52 L80,66 L86,66 Z", cx: 50, cy: 59 },
};

export default function MuscleHeatmap() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMuscleVolume7d().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const maxSets = Math.max(...data.map(d => d.set_count || 0), 1);

  function getColor(muscle: string): string {
    const entry = data.find(d => d.muscle_group === muscle);
    if (!entry) return "var(--color-surface-alt)";
    const intensity = Math.min(entry.set_count / maxSets, 1);
    const r = Math.round(79 + (124 - 79) * intensity);
    const g = Math.round(142 + (91 - 142) * intensity);
    const b = Math.round(247 + (245 - 247) * intensity);
    return `rgba(${r}, ${g}, ${b}, ${0.25 + intensity * 0.75})`;
  }

  if (loading) return <div className="card p-4 animate-pulse h-48" />;

  return (
    <div className="card p-4">
      <h3 className="section-label">Muscle Balance (7 days)</h3>
      <div className="flex items-start gap-4">
        <svg viewBox="10 12 80 82" className="w-36 h-48 flex-shrink-0">
          <ellipse cx="50" cy="18" rx="8" ry="7" fill="var(--color-surface-alt)" opacity="0.5" />
          {Object.entries(MUSCLE_PATHS).map(([muscle, path]) => (
            <path
              key={muscle}
              d={path.d}
              fill={getColor(muscle)}
              stroke="var(--color-border)"
              strokeWidth="0.3"
              className="transition-all duration-300"
            />
          ))}
        </svg>
        <div className="flex-1 grid grid-cols-1 gap-1.5">
          {Object.keys(MUSCLE_PATHS).map(muscle => {
            const entry = data.find(d => d.muscle_group === muscle);
            const sets = entry?.set_count || 0;
            const pct = (sets / maxSets) * 100;
            return (
              <div key={muscle} className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--color-text-secondary)] w-16 truncate">{muscle}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      background: sets > 0 ? "var(--color-accent-gradient)" : "transparent",
                    }}
                  />
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)] w-6 text-right">{sets}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
