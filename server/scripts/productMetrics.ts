/**
 * Prints the STRATEGY.md metrics from the events table.
 * On the VPS: cd /root/Workout_app && npx tsx server/scripts/productMetrics.ts
 */
import db from "../db";
import { computeProductMetrics, type EventRow } from "../services/productMetrics";

const rows = db
  .prepare("SELECT anon_id AS anonId, name, client_ts AS ts FROM events")
  .all() as EventRow[];
const m = computeProductMetrics(rows, new Date());
const pct = (r: { hits: number; of: number; rate: number | null }) =>
  r.rate === null ? "– (noch niemand)" : `${Math.round(r.rate * 100)} % (${r.hits}/${r.of})`;

console.log(`Installs:                          ${m.installs}`);
console.log(`Import in 24 h (Ziel ≥ 40 %):      ${pct(m.importIn24h)}`);
console.log(`Woche-4-Aktive (Ziel ≥ 25 %):      ${pct(m.week4Active)}`);
console.log(
  `Trainings/aktive Woche (≥ 2,5):    ${m.workoutsPerActiveWeek === null ? "–" : m.workoutsPerActiveWeek.toFixed(1)}`,
);
console.log(`Pro in 30 Tagen (Ziel ≥ 3 %):      ${pct(m.proIn30d)}`);
console.log(
  `Median bis 1. Satz (Ziel < 120 s): ${m.medianSecondsToFirstSet === null ? "–" : `${Math.round(m.medianSecondsToFirstSet)} s`}`,
);
