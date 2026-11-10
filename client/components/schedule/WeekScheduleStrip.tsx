import React, { useMemo} from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ActivityIcon } from "@/components/schedule/activityIcons";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors, FontFamily } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import type { WeeklyCommitment } from "@shared/weeklySchedule";
import { planTrainingWeek } from "@shared/planSchedule";
import type { WorkoutPlan } from "@/lib/storage";
import { isMobilityDay } from "@/lib/mobilitySplit";
import { weekStripCaption } from "@/lib/planStructure";
import { translateDayName } from "@/lib/dayNameLabel";
import {
  WEEKDAY_FALLBACK,
  useCommitmentLabels,
} from "@/components/schedule/CommitmentEditor";

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

  return (
    <Card
      onPress={onPress}
      testID={onPress ? "button-week-strip" : undefined}
      accessibilityRole={onPress ? "button" : undefined}
      style={[styles.card, { backgroundColor: theme.ironElevated2 }]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <ThemedText style={styles.title}>
            {t("plans.weekStrip.title", { defaultValue: "Deine Woche" })}
          </ThemedText>
          {schedule.cycle ? (
            <ThemedText style={[styles.cycle, { color: theme.textSecondary }]}>
              {t("plans.weekStrip.cycleWeek", schedule.cycle)}
            </ThemedText>
          ) : null}
        </View>
        {onPressEdit ? (
          <Pressable
            onPress={onPressEdit}
            testID="button-edit-commitments"
            hitSlop={8}
            style={styles.editBtn}
          >
            <Feather name="edit-2" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.editText, { color: theme.textSecondary }]}>
              {t("plans.weekStrip.edit", { defaultValue: "Termine" })}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.row}>
        {schedule.slots.map((slot) => {
          const isToday = slot.weekday === today;
          const planDayIdx = schedule.dayIndexByWeekday.get(slot.weekday);
          // The plan's own mobility day ("Mo Mobility") reads as mobility,
          // not as a gym session.
          const planMobility =
            slot.kind === "gym" && planDayIdx !== undefined && isMobilityDay(days[planDayIdx]);
          const isGym = slot.kind === "gym" && !planMobility;
          const isMobility = planMobility || mobilityWeekdays.includes(slot.weekday);
          return (
            <View key={slot.weekday} style={styles.dayCol}>
              <ThemedText
                style={[
                  styles.dayLabel,
                  { color: isToday ? theme.text : theme.textSecondary },
                  isToday && styles.dayLabelToday,
                ]}
              >
                {dayLabel(slot.weekday)}
              </ThemedText>
              <ThemedText
                style={[
                  styles.dayDate,
                  { color: isToday ? theme.text : theme.textSecondary },
                ]}
              >
                {weekDates[slot.weekday]}
              </ThemedText>

              <View
                style={[
                  styles.cell,
                  { borderColor: theme.border },
                  isGym && {
                    backgroundColor: theme.primary,
                    borderColor: theme.primary,
                  },
                  slot.kind === "sport" && { backgroundColor: theme.backgroundSecondary },
                  isToday && { borderColor: theme.chalk, borderWidth: 2 },
                ]}
              >
                {isGym ? (
                  <ActivityIcon size={16} color={theme.onChalk} />
                ) : slot.kind === "sport" ? (
                  <ActivityIcon
                    sport={slot.commitment!.sport}
                    size={16}
                    color={theme.text}
                  />
                ) : isMobility ? (
                  <Feather name="wind" size={16} color={theme.text} />
                ) : (
                  <ThemedText style={[styles.restDash, { color: theme.textSecondary }]}>
                    –
                  </ThemedText>
                )}
                {/* Mobility on a day that already holds a session: a corner
                    badge rather than replacing the session's own icon. */}
                {isMobility && slot.kind !== "rest" && !planMobility ? (
                  <View
                    style={[
                      styles.mobilityBadge,
                      { backgroundColor: theme.ironElevated3, borderColor: theme.ironElevated2 },
                    ]}
                  >
                    <Feather name="wind" size={9} color={theme.text} />
                  </View>
                ) : null}
              </View>

              {isGym ? (
                (() => {
                  // One long word ("Ganzkörper") is wider than the column and
                  // got broken mid-word. Shrink the name to fit one line and
                  // put the variant underneath instead.
                  const [line1, line2] = weekStripCaption(translateDayName(t, slot.dayName ?? ""));
                  return (
                    <>
                      <ThemedText
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        style={[styles.cellCaption, { color: theme.textSecondary }]}
                      >
                        {line1}
                      </ThemedText>
                      {line2 ? (
                        <ThemedText
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                          style={[styles.cellCaption, { color: theme.textSecondary }]}
                        >
                          {line2}
                        </ThemedText>
                      ) : null}
                    </>
                  );
                })()
              ) : (
                <ThemedText
                  numberOfLines={2}
                  style={[styles.cellCaption, { color: theme.textSecondary }]}
                >
                  {slot.kind === "sport"
                    ? sportLabel(slot.commitment!)
                    : isMobility
                      ? t("mobility.weekStripLabel")
                      : ""}
                </ThemedText>
              )}
            </View>
          );
        })}
      </View>

      {schedule.unplacedDayNames.length > 0 ? (
        <ThemedText style={[styles.warning, { color: theme.textSecondary }]}>
          {t("plans.weekStrip.unplaced", {
            names: schedule.unplacedDayNames.map((n) => translateDayName(t, n)).join(", "),
            defaultValue: `Kein freier Tag mehr für: ${schedule.unplacedDayNames.join(", ")}`,
          })}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.sm,
  },
  cycle: {
    fontSize: 13,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  title: { fontSize: 15, fontWeight: "700" },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  editText: { fontSize: 13, fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
  dayCol: { flex: 1, alignItems: "center", gap: 4 },
  dayLabel: { fontSize: 11, fontWeight: "600" },
  dayDate: { fontSize: 12, fontFamily: FontFamily.mono, marginBottom: 1 },
  dayLabelToday: { fontWeight: "700" },
  cell: {
    width: "100%",
    aspectRatio: 1,
    maxHeight: 38,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  restDash: { fontSize: 13 },
  // Stretch to the column so adjustsFontSizeToFit has a width to fit into —
  // centred content-width text would just overflow instead of shrinking.
  mobilityBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cellCaption: { fontSize: 9, lineHeight: 11, textAlign: "center", alignSelf: "stretch" },
  warning: { fontSize: 12, marginTop: Spacing.md },
});
