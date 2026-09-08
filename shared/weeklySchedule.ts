/**
 * Weekly training schedule.
 *
 * The athlete tells us which days are already taken by sport ("Tuesday
 * basketball, Thursday jogging"). From that we place the strength sessions on
 * the remaining days.
 *
 * Placement is deliberately deterministic rather than delegated to the LLM:
 * where a session lands is a constraint problem (free days, spacing, recovery),
 * not a creative one. Keeping it here means it is reproducible and testable —
 * the model still picks the exercises. The rules encoded below are the ones a
 * coach would actually apply:
 *
 *  - A leg-heavy session the day BEFORE a running/court sport is the worst
 *    case: you play on dead legs, which is both worse training and a higher
 *    injury risk. Penalised hardest.
 *  - A leg-heavy session the day AFTER such a sport is bad but recoverable.
 *  - Upper-body work sits fine next to running — that pairing is free.
 *  - Two gym days back to back are tolerable but not preferred, and clearly
 *    worse for full-body sessions, which need ~48h between repeats.
 *  - Otherwise, spread the sessions as evenly as the free days allow.
 */

/** 0 = Monday … 6 = Sunday (the German/ISO week, not the US one). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export type CommitmentSport =
  | "running"
  | "football"
  | "basketball"
  | "tennis"
  | "cycling"
  | "swimming"
  | "boxing"
  | "custom";

export interface WeeklyCommitment {
  id: string;
  weekday: Weekday;
  sport: CommitmentSport;
  /** Display label when sport === "custom". */
  label?: string;
  durationMinutes?: number;
}

/** How hard a sport taxes the legs — the axis that actually drives placement. */
type LowerBodyLoad = "high" | "moderate" | "low";

const SPORT_LOWER_BODY_LOAD: Record<CommitmentSport, LowerBodyLoad> = {
  running: "high",
  football: "high",
  basketball: "high",
  tennis: "high",
  cycling: "moderate",
  swimming: "low",
  boxing: "moderate",
  custom: "moderate",
};

export type SlotKind = "gym" | "sport" | "rest";

export interface ScheduledSlot {
  weekday: Weekday;
  kind: SlotKind;
  /** Set when kind === "gym" — the plan's day name, e.g. "Push" or "Full Body A". */
  dayName?: string;
  /** Set when kind === "sport". */
  commitment?: WeeklyCommitment;
}

export interface WeekSchedule {
  slots: ScheduledSlot[];
  /**
   * Sessions that did not fit because sport already occupies too much of the
   * week. Never silently dropped — the UI has to tell the athlete.
   */
  unplacedDayNames: string[];
}

/** True for sessions that meaningfully fatigue the legs. */
export function isLowerBodySession(dayName: string): boolean {
  return /leg|lower|squat|full\s*body|ganzk[oö]rper|unterk[oö]rper/i.test(dayName);
}

function lowerBodyLoadOn(day: Weekday, commitments: WeeklyCommitment[]): LowerBodyLoad {
  let worst: LowerBodyLoad = "low";
  for (const c of commitments) {
    if (c.weekday !== day) continue;
    const load = SPORT_LOWER_BODY_LOAD[c.sport];
    if (load === "high") return "high";
    if (load === "moderate") worst = "moderate";
  }
  return worst;
}

const nextDay = (d: Weekday): Weekday => (((d + 1) % 7) as Weekday);
const prevDay = (d: Weekday): Weekday => (((d + 6) % 7) as Weekday);

/**
 * Cost of putting `dayName` on `day`. Lower is better; the week wraps, so
 * Sunday is adjacent to Monday.
 */
function placementCost(
  day: Weekday,
  dayName: string,
  commitments: WeeklyCommitment[],
): number {
  if (!isLowerBodySession(dayName)) return 0;

  let cost = 0;
  const loadAfter = lowerBodyLoadOn(nextDay(day), commitments);
  if (loadAfter === "high") cost += 10;
  else if (loadAfter === "moderate") cost += 4;

  const loadBefore = lowerBodyLoadOn(prevDay(day), commitments);
  if (loadBefore === "high") cost += 6;
  else if (loadBefore === "moderate") cost += 2;

  return cost;
}

/** Penalty for gym days sitting next to each other, wrapping across the week. */
function clusteringCost(days: Weekday[], dayNames: string[]): number {
  if (days.length < 2) return 0;
  let cost = 0;
  for (let i = 0; i < days.length; i++) {
    for (let j = i + 1; j < days.length; j++) {
      const raw = Math.abs(days[i] - days[j]);
      const gap = Math.min(raw, 7 - raw);
      if (gap === 1) {
        // Back-to-back sessions that load the SAME region are the real problem:
        // Lower/Lower (or two full-body days) gives the legs no recovery at all,
        // whereas Upper followed by Lower is a normal, perfectly trainable
        // pairing. Penalising both equally produced schedules that pushed the
        // leg days away from the sport days and then stacked them on the
        // weekend, which trades one recovery problem for another.
        const sameRegion =
          isLowerBodySession(dayNames[i]) === isLowerBodySession(dayNames[j]);
        cost += sameRegion ? 8 : 3;
      }
    }
  }
  return cost;
}

/** Prefer evenly spread days: penalise the deviation from the ideal gap. */
function spreadCost(days: Weekday[]): number {
  if (days.length < 2) return 0;
  const sorted = [...days].sort((a, b) => a - b);
  const ideal = 7 / sorted.length;
  let cost = 0;
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length];
    const gap = i === sorted.length - 1 ? next + 7 - sorted[i] : next - sorted[i];
    cost += Math.abs(gap - ideal);
  }
  return cost;
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [head, ...tail] = items;
  return [
    ...combinations(tail, k - 1).map((c) => [head, ...c]),
    ...combinations(tail, k),
  ];
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) out.push([items[i], ...p]);
  }
  return out;
}

/**
 * Places `sessionDayNames` on the week's free days around the athlete's fixed
 * sport commitments.
 *
 * The search is exhaustive rather than greedy: with at most 7 days and 7
 * sessions the worst case is 7! = 5040 candidates, which is nothing, and a
 * greedy pass gets adjacency rules wrong precisely in the cases that matter
 * (it commits to a day before seeing what still has to be placed).
 */
export function scheduleTrainingWeek(input: {
  commitments: WeeklyCommitment[];
  sessionDayNames: string[];
}): WeekSchedule {
  const commitments = input.commitments ?? [];
  const sessionDayNames = input.sessionDayNames ?? [];

  const sportDays = new Set<Weekday>(commitments.map((c) => c.weekday));
  const freeDays = WEEKDAYS.filter((d) => !sportDays.has(d));

  const placeCount = Math.min(sessionDayNames.length, freeDays.length);
  const toPlace = sessionDayNames.slice(0, placeCount);
  const unplacedDayNames = sessionDayNames.slice(placeCount);

  let bestDays: Weekday[] = [];
  let bestNames: string[] = [];
  let bestCost = Number.POSITIVE_INFINITY;

  if (placeCount > 0) {
    for (const dayCombo of combinations(freeDays, placeCount)) {
      for (const nameOrder of permutations(toPlace)) {
        let cost = clusteringCost(dayCombo, nameOrder) + spreadCost(dayCombo);
        for (let i = 0; i < dayCombo.length; i++) {
          cost += placementCost(dayCombo[i], nameOrder[i], commitments);
        }
        if (cost < bestCost) {
          bestCost = cost;
          bestDays = dayCombo;
          bestNames = nameOrder;
        }
      }
    }
  }

  const gymByDay = new Map<Weekday, string>();
  bestDays.forEach((d, i) => gymByDay.set(d, bestNames[i]));

  const slots: ScheduledSlot[] = WEEKDAYS.map((weekday) => {
    const commitment = commitments.find((c) => c.weekday === weekday);
    if (commitment) return { weekday, kind: "sport" as const, commitment };
    const dayName = gymByDay.get(weekday);
    if (dayName) return { weekday, kind: "gym" as const, dayName };
    return { weekday, kind: "rest" as const };
  });

  return { slots, unplacedDayNames };
}

/**
 * Compact description of the athlete's week for the plan-generation prompt, so
 * the model knows what the strength sessions have to coexist with. Empty string
 * when nothing is committed — callers can drop the block entirely.
 */
export function describeCommitmentsForPrompt(
  commitments: WeeklyCommitment[],
  dayLabels: string[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
): string {
  if (commitments.length === 0) return "";
  const parts = commitments
    .slice()
    .sort((a, b) => a.weekday - b.weekday)
    .map((c) => {
      const what = c.sport === "custom" && c.label ? c.label : c.sport;
      const dur = c.durationMinutes ? ` (~${c.durationMinutes} min)` : "";
      return `${dayLabels[c.weekday]}: ${what}${dur}`;
    });
  const heavyLegDays = commitments
    .filter((c) => SPORT_LOWER_BODY_LOAD[c.sport] === "high")
    .map((c) => dayLabels[c.weekday]);

  let out = `WEEKLY COMMITMENTS — the athlete already trains these outside the gym: ${parts.join("; ")}.`;
  if (heavyLegDays.length > 0) {
    out +=
      ` ${heavyLegDays.join(" and ")} place a high demand on the legs, so keep total weekly lower-body volume moderate` +
      ` and do not build a plan that assumes fully fresh legs on every session.`;
  }
  return out;
}
