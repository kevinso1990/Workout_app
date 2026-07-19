import {
  isCardioSession,
  isStrengthSession,
  type CardioSportType,
  type WorkoutSession,
} from "@/lib/storage";

export type ProgressPeriod = "week" | "month" | "year";

export type DistributionSlice = {
  key: string;
  label: string;
  count: number;
  percent: number;
  color: string;
};

export type RpeTrendPoint = {
  label: string;
  avgRpe: number;
  sessionCount: number;
};

export type HybridHighlight = {
  id: string;
  icon: "zap" | "activity" | "trending-up" | "map-pin";
  title: string;
  subtitle: string;
};

export type HybridPeriodReport = {
  period: ProgressPeriod;
  rangeLabel: string;
  strengthCount: number;
  cardioCount: number;
  totalDurationMinutes: number;
  totalDistanceKm: number;
  distribution: DistributionSlice[];
  rpeTrend: RpeTrendPoint[];
  avgRpe: number | null;
  highlights: HybridHighlight[];
  filteredSessions: WorkoutSession[];
};

const SPORT_COLORS: Record<string, string> = {
  strength: "#6366F1",
  running: "#3B82F6",
  football: "#10B981",
  tennis: "#F59E0B",
  cycling: "#EC4899",
  swimming: "#06B6D4",
  boxing: "#EF4444",
  custom: "#8B5CF6",
};

const STRENGTH_COLOR = SPORT_COLORS.strength;

export function getPeriodRange(
  period: ProgressPeriod,
  refDate = new Date(),
): { start: Date; end: Date } {
  const end = new Date(refDate);
  end.setHours(23, 59, 59, 999);

  const start = new Date(refDate);
  start.setHours(0, 0, 0, 0);

  if (period === "week") {
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);
  } else if (period === "month") {
    start.setDate(1);
  } else {
    start.setMonth(0, 1);
  }

  return { start, end };
}

export function filterSessionsInPeriod(
  sessions: WorkoutSession[],
  period: ProgressPeriod,
  refDate = new Date(),
): WorkoutSession[] {
  const { start, end } = getPeriodRange(period, refDate);
  return sessions.filter((s) => {
    if (!s.completedAt) return false;
    const d = new Date(s.completedAt);
    return d >= start && d <= end;
  });
}

export function sessionDurationMinutes(session: WorkoutSession): number {
  if (isCardioSession(session)) {
    return session.cardio?.durationMinutes ?? session.duration ?? 0;
  }
  if (!session.duration) return 0;
  return Math.max(1, Math.round(session.duration / 60));
}

export function sessionDistanceKm(session: WorkoutSession): number {
  if (!isCardioSession(session)) return 0;
  const d = session.cardio?.distanceKm;
  return typeof d === "number" && d > 0 ? d : 0;
}

export function strengthSessionVolume(session: WorkoutSession): number {
  if (!session.exerciseProgress) return 0;
  return session.exerciseProgress.reduce((total, ep) => {
    return (
      total +
      ep.sets
        .filter((s) => s.completed)
        .reduce((setTotal, s) => {
          const weight = parseFloat(s.weight) || 0;
          const reps = parseInt(s.reps, 10) || 0;
          return setTotal + weight * reps;
        }, 0)
    );
  }, 0);
}

/** Session RPE: explicit for cardio; estimated from set ratings for strength. */
export function sessionRpe(session: WorkoutSession): number | null {
  if (isCardioSession(session)) {
    const rpe = session.cardio?.rpe;
    return typeof rpe === "number" && rpe >= 1 && rpe <= 10 ? rpe : null;
  }

  const ratings = (session.exerciseProgress ?? []).flatMap((ep) =>
    ep.sets.filter((s) => s.completed && s.rating).map((s) => s.rating),
  );
  if (ratings.length === 0) return null;

  const map: Record<string, number> = { green: 6, yellow: 7.5, red: 9 };
  const sum = ratings.reduce((acc, r) => acc + (map[r as string] ?? 7), 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

function sportLabelKey(sport: CardioSportType | string): string {
  return `calendar.sports.${sport}`;
}

function distributionKey(session: WorkoutSession): string {
  if (isStrengthSession(session)) return "strength";
  return session.cardio?.sport ?? "custom";
}

function formatPeriodLabel(period: ProgressPeriod, refDate: Date, locale?: string): string {
  const { start, end } = getPeriodRange(period, refDate);
  const opts: Intl.DateTimeFormatOptions =
    period === "year"
      ? { year: "numeric" }
      : period === "month"
        ? { month: "long", year: "numeric" }
        : { day: "numeric", month: "short" };

  if (period === "week") {
    const endWeek = new Date(start);
    endWeek.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${endWeek.toLocaleDateString(locale, { day: "numeric", month: "short" })}`;
  }
  if (period === "year") return start.getFullYear().toString();
  return start.toLocaleDateString(locale, opts);
}

function buildDistribution(
  sessions: WorkoutSession[],
  t: (key: string) => string,
): DistributionSlice[] {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const key = distributionKey(s);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = sessions.length || 1;
  const slices: DistributionSlice[] = [];

  for (const [key, count] of counts) {
    const label =
      key === "strength"
        ? t("progress.hybrid.strengthLabel")
        : t(sportLabelKey(key as CardioSportType));
    slices.push({
      key,
      label,
      count,
      percent: Math.round((count / total) * 100),
      color: SPORT_COLORS[key] ?? SPORT_COLORS.custom,
    });
  }

  return slices.sort((a, b) => b.count - a.count);
}

function buildRpeTrend(
  sessions: WorkoutSession[],
  period: ProgressPeriod,
  locale?: string,
): RpeTrendPoint[] {
  const withRpe = sessions
    .map((s) => ({ session: s, rpe: sessionRpe(s), date: new Date(s.completedAt) }))
    .filter((x) => x.rpe !== null) as Array<{
    session: WorkoutSession;
    rpe: number;
    date: Date;
  }>;

  if (withRpe.length === 0) return [];

  const buckets = new Map<string, { sum: number; n: number; sort: number }>();

  for (const item of withRpe) {
    let key: string;
    let sort: number;
    if (period === "week") {
      key = item.date.toLocaleDateString(locale, { weekday: "short" });
      sort = item.date.getTime();
    } else if (period === "month") {
      const w = Math.ceil(item.date.getDate() / 7);
      key = `W${w}`;
      sort = w;
    } else {
      key = item.date.toLocaleDateString(locale, { month: "short" });
      sort = item.date.getMonth();
    }
    const b = buckets.get(key) ?? { sum: 0, n: 0, sort };
    b.sum += item.rpe;
    b.n += 1;
    buckets.set(key, b);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[1].sort - b[1].sort)
    .map(([label, b]) => ({
      label,
      avgRpe: Math.round((b.sum / b.n) * 10) / 10,
      sessionCount: b.n,
    }));
}

function buildHighlights(
  sessions: WorkoutSession[],
  t: (key: string, opts?: Record<string, unknown>) => string,
): HybridHighlight[] {
  const highlights: HybridHighlight[] = [];

  let longestCardio: { minutes: number; label: string } | null = null;
  let maxStrengthVol = 0;
  let maxStrengthDay = "";
  let maxDistance = 0;
  let maxDistanceLabel = "";
  let peakRpe = 0;
  let peakRpeLabel = "";

  for (const s of sessions) {
    if (isCardioSession(s)) {
      const mins = sessionDurationMinutes(s);
      const label =
        s.cardio?.sport === "custom" && s.cardio.sportLabel
          ? s.cardio.sportLabel
          : t(sportLabelKey(s.cardio?.sport ?? "custom"));
      if (mins > (longestCardio?.minutes ?? 0)) {
        longestCardio = { minutes: mins, label };
      }
      const dist = sessionDistanceKm(s);
      if (dist > maxDistance) {
        maxDistance = dist;
        maxDistanceLabel = label;
      }
      const rpe = s.cardio?.rpe ?? 0;
      if (rpe > peakRpe) {
        peakRpe = rpe;
        peakRpeLabel = label;
      }
    } else {
      const vol = strengthSessionVolume(s);
      if (vol > maxStrengthVol) {
        maxStrengthVol = vol;
        maxStrengthDay = s.dayName || s.planName;
      }
    }
  }

  if (longestCardio) {
    highlights.push({
      id: "longest-cardio",
      icon: "zap",
      title: t("progress.hybrid.highlightLongestCardio", {
        minutes: longestCardio.minutes,
        sport: longestCardio.label,
      }),
      subtitle: t("progress.hybrid.highlightLongestCardioSub"),
    });
  }

  if (maxStrengthVol > 0) {
    highlights.push({
      id: "max-volume",
      icon: "activity",
      title: t("progress.hybrid.highlightMaxVolume", {
        volume: Math.round(maxStrengthVol),
        day: maxStrengthDay,
      }),
      subtitle: t("progress.hybrid.highlightMaxVolumeSub"),
    });
  }

  if (maxDistance > 0) {
    highlights.push({
      id: "max-distance",
      icon: "map-pin",
      title: t("progress.hybrid.highlightMaxDistance", {
        km: maxDistance.toFixed(1),
        sport: maxDistanceLabel,
      }),
      subtitle: t("progress.hybrid.highlightMaxDistanceSub"),
    });
  }

  if (peakRpe >= 8) {
    highlights.push({
      id: "peak-rpe",
      icon: "trending-up",
      title: t("progress.hybrid.highlightPeakRpe", {
        rpe: peakRpe,
        sport: peakRpeLabel,
      }),
      subtitle: t("progress.hybrid.highlightPeakRpeSub"),
    });
  }

  return highlights.slice(0, 4);
}

export function buildHybridPeriodReport(
  allSessions: WorkoutSession[],
  period: ProgressPeriod,
  t: (key: string, opts?: Record<string, unknown>) => string,
  refDate = new Date(),
  locale?: string,
): HybridPeriodReport {
  const filteredSessions = filterSessionsInPeriod(allSessions, period, refDate);

  let strengthCount = 0;
  let cardioCount = 0;
  let totalDurationMinutes = 0;
  let totalDistanceKm = 0;
  const rpeValues: number[] = [];

  for (const s of filteredSessions) {
    if (isCardioSession(s)) cardioCount++;
    else strengthCount++;

    totalDurationMinutes += sessionDurationMinutes(s);
    totalDistanceKm += sessionDistanceKm(s);

    const rpe = sessionRpe(s);
    if (rpe !== null) rpeValues.push(rpe);
  }

  totalDistanceKm = Math.round(totalDistanceKm * 10) / 10;

  const avgRpe =
    rpeValues.length > 0
      ? Math.round((rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length) * 10) / 10
      : null;

  return {
    period,
    rangeLabel: formatPeriodLabel(period, refDate, locale),
    strengthCount,
    cardioCount,
    totalDurationMinutes,
    totalDistanceKm,
    distribution: buildDistribution(filteredSessions, t),
    rpeTrend: buildRpeTrend(filteredSessions, period, locale),
    avgRpe,
    highlights: buildHighlights(filteredSessions, t),
    filteredSessions,
  };
}

export function formatDurationHuman(minutes: number, t: (key: string, o?: Record<string, unknown>) => string): string {
  if (minutes < 60) return t("progress.hybrid.durationMinutes", { count: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return t("progress.hybrid.durationHours", { count: h });
  return t("progress.hybrid.durationHoursMinutes", { hours: h, minutes: m });
}

export { STRENGTH_COLOR, SPORT_COLORS };
