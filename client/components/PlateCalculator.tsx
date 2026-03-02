import React, { useState } from "react";

const BAR_WEIGHT_KG = 20;
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
const PLATE_COLORS: Record<number, string> = {
  25: "#ef4444",
  20: "#3b82f6",
  15: "#eab308",
  10: "#22c55e",
  5: "#f5f5f5",
  2.5: "#ef4444",
  1.25: "#a3a3a3",
};
const PLATE_WIDTHS: Record<number, number> = {
  25: 48,
  20: 44,
  15: 40,
  10: 36,
  5: 32,
  2.5: 28,
  1.25: 24,
};

interface Props {
  unit: "kg" | "lbs";
  onClose: () => void;
}

export default function PlateCalculator({ unit, onClose }: Props) {
  const [targetWeight, setTargetWeight] = useState(60);

  const barWeight = unit === "lbs" ? Math.round(BAR_WEIGHT_KG * 2.205) : BAR_WEIGHT_KG;
  const targetKg = unit === "lbs" ? targetWeight / 2.205 : targetWeight;
  const perSide = (targetKg - BAR_WEIGHT_KG) / 2;

  const plates: number[] = [];
  if (perSide > 0) {
    let remaining = perSide;
    for (const plate of PLATES_KG) {
      while (remaining >= plate - 0.001) {
        plates.push(plate);
        remaining -= plate;
      }
    }
  }

  const displayPlate = (kg: number) => unit === "lbs" ? Math.round(kg * 2.205 * 10) / 10 : kg;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[var(--color-surface)] rounded-t-2xl sm:rounded-2xl p-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">Plate Calculator</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] p-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            onClick={() => setTargetWeight(w => Math.max(barWeight, w - (unit === "lbs" ? 10 : 5)))}
            className="stepper-btn"
          >-</button>
          <div className="text-center">
            <input
              type="number"
              value={targetWeight}
              onChange={e => setTargetWeight(parseFloat(e.target.value) || 0)}
              className="pill-input w-24 text-2xl"
            />
            <div className="text-xs text-[var(--color-text-muted)] mt-1">{unit} total</div>
          </div>
          <button
            onClick={() => setTargetWeight(w => w + (unit === "lbs" ? 10 : 5))}
            className="stepper-btn"
          >+</button>
        </div>

        <div className="text-center text-sm text-[var(--color-text-secondary)] mb-4">
          Bar: {barWeight} {unit} · Each side:
        </div>

        {plates.length > 0 ? (
          <div className="flex items-center justify-center gap-1 mb-4 min-h-[80px]">
            <div className="w-24 h-3 bg-[var(--color-text-muted)] rounded-full" />
            <div className="flex items-center gap-0.5">
              {plates.map((plate, i) => (
                <div
                  key={i}
                  className="rounded-sm flex items-center justify-center text-[10px] font-bold"
                  style={{
                    width: "20px",
                    height: `${PLATE_WIDTHS[plate] || 30}px`,
                    backgroundColor: PLATE_COLORS[plate] || "#888",
                    color: plate === 5 ? "#111" : "#fff",
                  }}
                >
                  {displayPlate(plate)}
                </div>
              ))}
            </div>
            <div className="w-4 h-8 bg-[var(--color-text-muted)] rounded-r" />
          </div>
        ) : (
          <div className="text-center text-[var(--color-text-muted)] text-sm py-6">
            {targetKg <= BAR_WEIGHT_KG ? "Bar only — no plates needed" : "Invalid weight"}
          </div>
        )}

        {plates.length > 0 ? (
          <div className="flex flex-wrap gap-2 justify-center">
            {plates.map((plate, i) => (
              <span key={i} className="tag-pill">{displayPlate(plate)} {unit}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
