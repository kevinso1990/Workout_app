import React, { useMemo} from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ActivityIcon } from "@/components/schedule/activityIcons";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors, FontFamily } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { scheduleTrainingWeek, type WeeklyCommitment } from "@shared/weeklySchedule";
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
 * "What's on this week" — the plan's sessions laid out around the athlete's
 * fixed sport days.
 *
 * The layout is derived on every render from (commitments + plan day names)
 * rather than stored, so it can never show a stale week after either changes.
 */
export function WeekScheduleStrip({
  commitments,
  sessionDayNames,
  onPressEdit,
  onPress,
}: {
  commitments: WeeklyCommitment[];
  sessionDayNames: string[];
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

  const schedule = useMemo(
    () => scheduleTrainingWeek({ commitments, sessionDayNames }),
    [commitments, sessionDayNames],
  );

  if (sessionDayNames.length === 0 && commitments.length === 0) return null;

  const Card = onPress ? Pressable : View;

  return (
    <Card
      onPress={onPress}
      testID={onPress ? "button-week-strip" : undefined}
      accessibilityRole={onPress ? "button" : undefined}
      style={[styles.card, { backgroundColor: theme.ironElevated2 }]}
    >
      <View style={styles.header}>
        <ThemedText style={styles.title}>
          {t("plans.weekStrip.title", { defaultValue: "Deine Woche" })}
        </ThemedText>
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
                  slot.kind === "gym" && {
                    backgroundColor: theme.primary,
                    borderColor: theme.primary,
                  },
                  slot.kind === "sport" && { backgroundColor: theme.backgroundSecondary },
                  isToday && { borderColor: theme.chalk, borderWidth: 2 },
                ]}
              >
                {slot.kind === "gym" ? (
                  <ActivityIcon size={16} color={theme.onChalk} />
                ) : slot.kind === "sport" ? (
                  <ActivityIcon
                    sport={slot.commitment!.sport}
                    size={16}
                    color={theme.text}
                  />
                ) : (
                  <ThemedText style={[styles.restDash, { color: theme.textSecondary }]}>
                    –
                  </ThemedText>
                )}
              </View>

              <ThemedText
                numberOfLines={2}
                style={[styles.cellCaption, { color: theme.textSecondary }]}
              >
                {slot.kind === "gym"
                  ? slot.dayName
                  : slot.kind === "sport"
                    ? sportLabel(slot.commitment!)
                    : ""}
              </ThemedText>
            </View>
          );
        })}
      </View>

      {schedule.unplacedDayNames.length > 0 ? (
        <ThemedText style={[styles.warning, { color: theme.textSecondary }]}>
          {t("plans.weekStrip.unplaced", {
            names: schedule.unplacedDayNames.join(", "),
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
  cellCaption: { fontSize: 9, lineHeight: 11, textAlign: "center" },
  warning: { fontSize: 12, marginTop: Spacing.md },
});
