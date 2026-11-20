/**
 * The four numbers STRATEGY.md bets on, computed from anonymous events.
 * Pure over event rows so it can be tested without a database.
 */

export interface EventRow {
  anonId: string;
  name: string;
  /** ISO time the event happened on the device. */
  ts: string;
}

export interface ProductMetrics {
  installs: number;
  /** Installs with a successful import within 24 h of first open. */
  importIn24h: Rate;
  /** Of installs at least 4 weeks old: ≥ 2 workouts in their 4th week. */
  week4Active: Rate;
  /** Average workouts in weeks with at least one, over the last 28 days. */
  workoutsPerActiveWeek: number | null;
  /** Of installs at least 30 days old: bought Pro within 30 days. */
  proIn30d: Rate;
  /** Median seconds from first open to the first logged set. */
  medianSecondsToFirstSet: number | null;
}

export interface Rate {
  hits: number;
  of: number;
  /** 0–1, or null when there is nobody to measure yet. */
  rate: number | null;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function rate(hits: number, of: number): Rate {
  return { hits, of, rate: of > 0 ? hits / of : null };
}

export function computeProductMetrics(events: EventRow[], now: Date): ProductMetrics {
  const byAnon = new Map<string, Map<string, number[]>>();
  for (const e of events) {
    const t = new Date(e.ts).getTime();
    if (!Number.isFinite(t)) continue;
    const names = byAnon.get(e.anonId) ?? new Map<string, number[]>();
    const list = names.get(e.name) ?? [];
    list.push(t);
    names.set(e.name, list);
    byAnon.set(e.anonId, names);
  }

  const nowMs = now.getTime();
  let installs = 0;
  let importHits = 0;
  let week4Of = 0;
  let week4Hits = 0;
  let proOf = 0;
  let proHits = 0;
  const toFirstSet: number[] = [];

  for (const names of byAnon.values()) {
    const firstOpen = Math.min(...(names.get("first_open") ?? []));
    if (!Number.isFinite(firstOpen)) continue;
    installs++;
    const within = (name: string, from: number, to: number) =>
      (names.get(name) ?? []).filter((t) => t >= from && t < to);

    if (within("import_succeeded", firstOpen, firstOpen + DAY).length > 0) importHits++;

    if (nowMs - firstOpen >= 28 * DAY) {
      week4Of++;
      if (within("workout_completed", firstOpen + 21 * DAY, firstOpen + 28 * DAY).length >= 2) {
        week4Hits++;
      }
    }

    if (nowMs - firstOpen >= 30 * DAY) {
      proOf++;
      if (within("pro_purchased", firstOpen, firstOpen + 30 * DAY).length > 0) proHits++;
    }

    const firstSet = Math.min(...(names.get("first_set_logged") ?? []));
    if (Number.isFinite(firstSet) && firstSet >= firstOpen) {
      toFirstSet.push((firstSet - firstOpen) / 1000);
    }
  }

  // Workouts per active week: every (install, week-since-day-0) bucket with
  // at least one workout in the last 28 days.
  const weekly = new Map<string, number>();
  for (const [anon, names] of byAnon) {
    for (const t of names.get("workout_completed") ?? []) {
      if (t < nowMs - 28 * DAY || t > nowMs) continue;
      const key = `${anon}:${Math.floor((nowMs - t) / (7 * DAY))}`;
      weekly.set(key, (weekly.get(key) ?? 0) + 1);
    }
  }
  const counts = [...weekly.values()];

  toFirstSet.sort((a, b) => a - b);
  const median =
    toFirstSet.length === 0
      ? null
      : toFirstSet.length % 2
        ? toFirstSet[(toFirstSet.length - 1) / 2]
        : (toFirstSet[toFirstSet.length / 2 - 1] + toFirstSet[toFirstSet.length / 2]) / 2;

  return {
    installs,
    importIn24h: rate(importHits, installs),
    week4Active: rate(week4Hits, week4Of),
    workoutsPerActiveWeek: counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : null,
    proIn30d: rate(proHits, proOf),
    medianSecondsToFirstSet: median,
  };
}
