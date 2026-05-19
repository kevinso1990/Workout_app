import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";

export default function ConsistencyCalendar() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || "en";
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getConsistency().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const workoutMap = new Map<string, { sessions: number; has_pr: boolean }>();
  data.forEach(d => workoutMap.set(d.workout_date, { sessions: d.sessions, has_pr: !!d.has_pr }));

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 182);
  startDate.setDate(startDate.getDate() - startDate.getDay() + 1);

  const weeks: Date[][] = [];
  const cursor = new Date(startDate);
  while (cursor <= today) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const months: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const m = week[0].getMonth();
    if (m !== lastMonth) {
      months.push({ label: week[0].toLocaleString(locale, { month: "short" }), col: i });
      lastMonth = m;
    }
  });

  if (loading) return <div className="card p-4 animate-pulse h-40" />;

  return (
    <div className="card p-4">
      <h3 className="section-label">{t("consistency.title")}</h3>
      <div className="flex gap-0.5 mb-1">
        {months.map((m, i) => (
          <span
            key={i}
            className="text-[10px] text-[var(--color-text-muted)]"
            style={{ position: "relative", left: m.col * 14 }}
          >
            {m.label}
          </span>
        ))}
      </div>
      <div className="flex gap-[3px] overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day, di) => {
              const key = day.toISOString().split("T")[0];
              const entry = workoutMap.get(key);
              const isFuture = day > today;
              let bg = "var(--color-surface-alt)";
              if (entry?.has_pr) {
                bg = "#7c5bf5";
              } else if (entry) {
                bg = "var(--color-accent)";
              }
              return (
                <div
                  key={di}
                  className="rounded-sm"
                  style={{
                    width: 11,
                    height: 11,
                    backgroundColor: isFuture ? "transparent" : bg,
                    opacity: entry ? 1 : 0.3,
                  }}
                  title={`${key}${entry ? ` - ${entry.sessions} workout(s)${entry.has_pr ? " (PR!)": ""}` : ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "var(--color-surface-alt)", opacity: 0.3 }} /> {t("consistency.noWorkout")}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "var(--color-accent)" }} /> {t("consistency.workout")}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#7c5bf5" }} /> {t("consistency.prDay")}</span>
      </div>
    </div>
  );
}
