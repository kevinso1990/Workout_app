import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ActivityIcon } from "@/components/schedule/activityIcons";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, FontFamily } from "@/constants/theme";
import { mobilityHue, sessionHues, type Palette } from "@/constants/palettes";
import type { WeeklyCommitment } from "@shared/weeklySchedule";
import { planTrainingWeek } from "@shared/planSchedule";
import { getWorkoutHistory, type WorkoutPlan } from "@/lib/storage";
import { isMobilitySession, mondayBasedWeekday } from "@/lib/mobilitySchedule";
import { mondayOf } from "@shared/planSchedule";
import { isMobilityDay } from "@/lib/mobilitySplit";
import { sessionHueIndex, weekStripCaption } from "@/lib/planStructure";
import { Panel } from "@/components/surface/Panel";
import { translateDayName } from "@/lib/dayNameLabel";
import { useCommitmentLabels } from "@/components/schedule/CommitmentEditor";

/** JS getDay() is Sunday-based; the schedule is Monday-based. */
function todayWeekday(): number {
  return (new Date().getDay() + 6) % 7;
}

/** Calendar dates for the current Monday-based week, indexed by weekday. */
function datesOfCurrentWeek(): number[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - todayWeekday());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.getDate();
  });
}

/**
 * "What's on this week" — the plan's sessions on the plan's own weekdays (and
 * rotation week) when it prescribes them, else laid out around the athlete's
 * fixed sport days.
 *
 * The layout is derived on every render from (commitments + plan) rather
 * than stored, so it can never show a stale week after either changes.
 */
export function WeekScheduleStrip({
  commitments,
  plan,
  onPressEdit,
  onPress,
  mobilityWeekdays = [],
}: {
  commitments: WeeklyCommitment[];
  plan: Pick<WorkoutPlan, "days" | "schedule"> | null;
  /** Fixed Mobility-Session weekdays (0 = Mo); shown on top of the schedule. */
  mobilityWeekdays?: number[];
  onPressEdit?: () => void;
  /** Opens the full calendar. Omitted where the strip already sits in it. */
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const { dayLabel, sportLabel } = useCommitmentLabels();
  const today = todayWeekday();
  const weekDates = datesOfCurrentWeek();

  // Weekdays of this week with a strength session logged — the ticks and the
  // progress line. Cardio and mobility don't count toward the plan's week.
  const [trainedWeekdays, setTrainedWeekdays] = useState<Set<number>>(new Set());
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getWorkoutHistory().then((history) => {
        if (cancelled) return;
        const start = mondayOf(new Date()).getTime();
        const end = start + 7 * 24 * 60 * 60 * 1000;
        const set = new Set<number>();
        for (const s of history) {
          const at = new Date(s.completedAt);
          if (at.getTime() < start || at.getTime() >= end) continue;
          if (s.workoutType === "cardio" || s.cardio || isMobilitySession(s)) continue;
          set.add(mondayBasedWeekday(at));
        }
        setTrainedWeekdays(set);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const days = plan?.days ?? [];
  const schedule = useMemo(
    () => planTrainingWeek({ commitments, days, schedule: plan?.schedule, now: new Date() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commitments, plan],
  );

  if (days.length === 0 && commitments.length === 0 && mobilityWeekdays.length === 0) {
    return null;
  }

  const Card = onPress ? Pressable : View;

  // Planned strength sessions this week vs. the days one was actually logged.
  const plannedGym = schedule.slots.filter((slot) => {
    const idx = schedule.dayIndexByWeekday.get(slot.weekday);
    return slot.kind === "gym" && !(idx !== undefined && isMobilityDay(days[idx]));
  }).length;
  const doneCount = schedule.slots.filter((slot) => trainedWeekdays.has(slot.weekday)).length;

  return (
    <Card
      onPress={onPress}
      testID={onPress ? "button-week-strip" : undefined}
      accessibilityRole={onPress ? "button" : undefined}
      style={styles.card}
    >
      <Panel>
      <View style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.textSecondary }]} numberOfLines={1}>
          {t("plans.weekStrip.title", { defaultValue: "Deine Woche" })}
          {schedule.cycle ? ` · ${t("plans.weekStrip.cycleWeek", schedule.cycle)}` : ""}
        </ThemedText>
        {onPressEdit ? (
          <Pressable
            onPress={onPressEdit}
            testID="button-edit-commitments"
            hitSlop={8}
            style={styles.editBtn}
          >
            <Feather name="edit-2" size={13} color={theme.textSecondary} />
            <ThemedText style={[styles.editText, { color: theme.textSecondary }]}>
              {t("plans.weekStrip.edit", { defaultValue: "Termine" })}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {/* Days as a line of marks, not seven boxes: a dot is a session, a
          ring is mobility, a tick is done — and only "today" is in signal. */}
      <View style={styles.row}>
        {schedule.slots.map((slot) => {
          const isToday = slot.weekday === today;
          const planDayIdx = schedule.dayIndexByWeekday.get(slot.weekday);
          const planMobility =
            slot.kind === "gym" && planDayIdx !== undefined && isMobilityDay(days[planDayIdx]);
          const isGym = slot.kind === "gym" && !planMobility;
          const isMobility = planMobility || mobilityWeekdays.includes(slot.weekday);
          const trained = trainedWeekdays.has(slot.weekday);

          let caption = "";
          if (isGym) caption = weekStripCaption(translateDayName(t, slot.dayName ?? ""))[0];
          else if (slot.kind === "sport") caption = sportLabel(slot.commitment!);
          else if (isMobility) caption = t("mobility.weekStripLabel");

          return (
            <View
              key={slot.weekday}
              style={[styles.dayCol, isToday && { backgroundColor: theme.signal + "1F" }]}
            >
              <ThemedText
                style={[
                  styles.dayLabel,
                  { color: isToday ? theme.signalText : theme.textSecondary },
                  isToday && styles.dayLabelToday,
                ]}
              >
                {dayLabel(slot.weekday)}
              </ThemedText>
              <ThemedText
                style={[styles.dayDate, { color: isToday ? theme.text : theme.textSecondary }]}
              >
                {weekDates[slot.weekday]}
              </ThemedText>
              <View style={styles.markWrap}>
                {trained && (isGym || slot.kind === "rest") ? (
                  <View style={[styles.checkDot, { backgroundColor: theme.signal }]}>
                    <Feather name="check" size={11} color={theme.onSignal} />
                  </View>
                ) : isGym ? (
                  // Each session in its plan colour, the same one its row in
                  // the plan wears.
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          sessionHues[
                            sessionHueIndex(
                              slot.dayName ?? "",
                              schedule.dayIndexByWeekday.get(slot.weekday) ?? 0,
                              sessionHues.length,
                            )
                          ],
                      },
                    ]}
                  />
                ) : slot.kind === "sport" ? (
                  <ActivityIcon sport={slot.commitment!.sport} size={13} color={theme.textSecondary} />
                ) : isMobility ? (
                  <View style={[styles.ring, { borderColor: mobilityHue }]} />
                ) : null}
              </View>
              <ThemedText
                numberOfLines={1}
                style={[styles.caption, { color: isToday ? theme.text : theme.textSecondary }]}
              >
                {caption}
              </ThemedText>
            </View>
          );
        })}
      </View>

      {plannedGym > 0 ? (
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: theme.hairlineStrong }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.signal,
                  width: `${Math.min(100, Math.round((doneCount / plannedGym) * 100))}%`,
                },
              ]}
            />
          </View>
          <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
            {t("plans.weekStrip.progress", { done: doneCount, total: plannedGym })}
          </ThemedText>
        </View>
      ) : null}

      {schedule.unplacedDayNames.length > 0 ? (
        <ThemedText style={[styles.warning, { color: theme.textSecondary }]}>
          {t("plans.weekStrip.unplaced", {
            names: schedule.unplacedDayNames.map((n) => translateDayName(t, n)).join(", "),
            defaultValue: `Kein freier Tag mehr für: ${schedule.unplacedDayNames.join(", ")}`,
          })}
        </ThemedText>
      ) : null}
      </Panel>
    </Card>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  // A section of the page, not another box.
  card: {
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  title: { flex: 1, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  editText: { fontSize: 13, fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  // Today's column is tinted — the one place on the strip the eye should land.
  dayCol: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 8, borderRadius: BorderRadius.md },
  dayLabel: { fontSize: 12, fontWeight: "600" },
  dayLabelToday: { fontWeight: "800" },
  dayDate: { fontSize: 11, fontFamily: FontFamily.mono },
  markWrap: { height: 18, alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  ring: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  checkDot: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  caption: { fontSize: 10, maxWidth: "100%", paddingHorizontal: 2 },
  progressWrap: { marginTop: Spacing.md, gap: 6 },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  progressText: { fontSize: 12 },
  warning: { fontSize: 12, marginTop: Spacing.sm },
});
