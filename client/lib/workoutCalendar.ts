import type { WorkoutSession } from "@/lib/storage";
import { isCardioSession, isStrengthSession } from "@/lib/storage";

export type DaySessionSummary = {
  dateKey: string;
  strengthCount: number;
  cardioCount: number;
  sessions: WorkoutSession[];
};

/** Local date key YYYY-MM-DD from an ISO timestamp. */
export function dateKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dateKeyFromSession(session: WorkoutSession): string {
  return dateKeyFromIso(session.completedAt);
}

export function groupSessionsByDate(
  sessions: WorkoutSession[],
): Map<string, WorkoutSession[]> {
  const map = new Map<string, WorkoutSession[]>();
  for (const s of sessions) {
    const key = dateKeyFromSession(s);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }
  for (const [key, list] of map) {
    list.sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    );
    map.set(key, list);
  }
  return map;
}

export function summarizeSessionsByDate(
  sessions: WorkoutSession[],
): Map<string, DaySessionSummary> {
  const grouped = groupSessionsByDate(sessions);
  const out = new Map<string, DaySessionSummary>();
  for (const [dateKey, list] of grouped) {
    out.set(dateKey, {
      dateKey,
      strengthCount: list.filter(isStrengthSession).length,
      cardioCount: list.filter(isCardioSession).length,
      sessions: list,
    });
  }
  return out;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

/** Monday-first calendar grid cells for a month (includes leading/trailing days). */
export function buildMonthGrid(month: Date): { date: Date; inMonth: boolean }[] {
  const first = startOfMonth(month);
  const startOffset = (first.getDay() + 6) % 7; // Mon=0
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    cells.push({ date, inMonth: date.getMonth() === month.getMonth() });
  }
  return cells;
}

export function isoFromDateKey(dateKey: string, hour = 12): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0).toISOString();
}
