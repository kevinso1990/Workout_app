import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

interface DataPoint {
  date: string;
  volume: number;
  maxWeight: number;
}

export default function ExerciseChart({ exerciseId, exerciseName }: { exerciseId: number; exerciseName: string }) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getExerciseHistory(exerciseId)
      .then(setData)
      .catch(() => [])
      .finally(() => setLoading(false));
  }, [exerciseId]);

  if (loading) return <div className="h-32 flex items-center justify-center"><div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" /></div>;
  if (data.length < 2) return null;

  const maxWeight = Math.max(...data.map(d => d.maxWeight));
  const minWeight = Math.min(...data.map(d => d.maxWeight));
  const range = maxWeight - minWeight || 1;
  const improvement = minWeight > 0 ? Math.round(((maxWeight - minWeight) / minWeight) * 100) : 0;

  const width = 280;
  const height = 80;
  const padding = 4;
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * plotW;
    const y = padding + plotH - ((d.maxWeight - minWeight) / range) * plotH;
    return `${x},${y}`;
  }).join(" ");

  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-[var(--color-text-muted)]">Weight Progression</div>
        {improvement > 0 ? (
          <div className="text-xs font-bold text-green-400">+{improvement}%</div>
        ) : null}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20">
        <defs>
          <linearGradient id={`grad-${exerciseId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f8ef7" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#4f8ef7" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#grad-${exerciseId})`} />
        <polyline points={points} fill="none" stroke="#4f8ef7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => {
          const x = padding + (i / (data.length - 1)) * plotW;
          const y = padding + plotH - ((d.maxWeight - minWeight) / range) * plotH;
          return <circle key={i} cx={x} cy={y} r="3" fill="#4f8ef7" />;
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
        <span>{data[0]?.date ? new Date(data[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
        <span className="font-bold text-[var(--color-text)]">{maxWeight} kg</span>
        <span>{data[data.length - 1]?.date ? new Date(data[data.length - 1].date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
      </div>
    </div>
  );
}
