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

  if (loading) return <div className="h-32 flex items-center justify-center"><div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  if (data.length < 2) return null;

  const maxWeight = Math.max(...data.map(d => d.maxWeight));
  const minWeight = Math.min(...data.map(d => d.maxWeight));
  const range = maxWeight - minWeight || 1;

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
      <div className="text-xs text-neutral-500 mb-1">Weight Progression</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20">
        <polygon points={areaPoints} fill="rgba(249,115,22,0.1)" />
        <polyline points={points} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => {
          const x = padding + (i / (data.length - 1)) * plotW;
          const y = padding + plotH - ((d.maxWeight - minWeight) / range) * plotH;
          return <circle key={i} cx={x} cy={y} r="3" fill="#f97316" />;
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-neutral-600">
        <span>{data[0]?.date ? new Date(data[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
        <span>{data[data.length - 1]?.date ? new Date(data[data.length - 1].date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
      </div>
    </div>
  );
}
