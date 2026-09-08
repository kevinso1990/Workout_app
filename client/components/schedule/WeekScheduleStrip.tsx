import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { scheduleTrainingWeek, type WeeklyCommitment } from "@shared/weeklySchedule";
import {
  COMMITMENT_SPORTS,
  WEEKDAY_FALLBACK,
  useCommitmentLabels,
} from "@/components/schedule/CommitmentEditor";

/** JS getDay() is Sunday-based; the schedule is Monday-based. */
function todayWeekday(): number {
  return (new Date().getDay() + 6) % 7;
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
}: {
  commitments: WeeklyCommitment[];
  sessionDayNames: string[];
  onPressEdit?: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { dayLabel, sportLabel } = useCommitmentLabels();
  const today = todayWeekday();

  const schedule = useMemo(
    () => scheduleTrainingWeek({ commitments, sessionDayNames }),
    [commitments, sessionDayNames],
  );

  if (sessionDayNames.length === 0 && commitments.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
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
          const sportIcon =
            slot.kind === "sport"
              ? COMMITMENT_SPORTS.find((s) => s.id === slot.commitment!.sport)?.icon ?? "activity"
              : null;

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

              <View
                style={[
                  styles.cell,
                  { borderColor: theme.border },
                  slot.kind === "gym" && {
                    backgroundColor: Colors.light.primary,
                    borderColor: Colors.light.primary,
                  },
                  slot.kind === "sport" && { backgroundColor: theme.backgroundSecondary },
                  isToday && { borderColor: Colors.light.chalk, borderWidth: 2 },
                ]}
              >
                {slot.kind === "gym" ? (
                  <Feather name="activity" size={14} color={Colors.light.onChalk} />
                ) : slot.kind === "sport" ? (
                  <Feather name={sportIcon as never} size={14} color={theme.text} />
                ) : (
                  <ThemedText style={[styles.restDash, { color: theme.textSecondary }]}>
                    –
                  </ThemedText>
                )}
              </View>

              <ThemedText
                numberOfLines={1}
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
    </View>
  );
}

const styles = StyleSheet.create({
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
  cellCaption: { fontSize: 9, textAlign: "center" },
  warning: { fontSize: 12, marginTop: Spacing.md },
});
