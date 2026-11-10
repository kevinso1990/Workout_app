import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import type { ImportedWorkoutPlan } from "@/hooks/useWorkoutImport";
import { useCommitmentLabels } from "@/components/schedule/CommitmentEditor";

/**
 * The weekdays and rotation read from the plan, shown before saving so the
 * user sees the plan was understood as a week — not just as a pile of days.
 */
export function ImportScheduleSummary({ plan }: { plan: ImportedWorkoutPlan }) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const { dayLabel } = useCommitmentLabels();

  const weeks = (plan.schedule?.weeks ?? []).filter((w) => w.length > 0);
  if (weeks.length === 0) return null;
  const rotating = weeks.length > 1;
  const hasCardio = weeks.some((w) => w.some((e) => plan.days[e.dayIndex]?.kind === "cardio"));

  return (
    <View style={[styles.card, { backgroundColor: theme.ironElevated2 }]} testID="card-import-schedule">
      <View style={styles.header}>
        <Feather name="calendar" size={16} color={theme.text} />
        <ThemedText style={styles.title}>{t("importWorkout.schedule.title")}</ThemedText>
      </View>
      {rotating ? (
        <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
          {t("importWorkout.schedule.rotation", { count: weeks.length })}
        </ThemedText>
      ) : null}

      {weeks.map((week, wIdx) => (
        <View key={wIdx} style={styles.week}>
          {rotating ? (
            <ThemedText style={[styles.weekLabel, { color: theme.chalkFaint }]}>
              {t("importWorkout.schedule.week", { n: wIdx + 1 })}
            </ThemedText>
          ) : null}
          {week.map((e) => {
            const day = plan.days[e.dayIndex];
            if (!day) return null;
            return (
              <View key={e.weekday} style={styles.row}>
                <ThemedText style={[styles.weekday, { color: theme.textSecondary }]}>
                  {dayLabel(e.weekday)}
                </ThemedText>
                <ThemedText style={styles.dayName} numberOfLines={1}>
                  {day.dayName}
                </ThemedText>
                {day.kind === "mobility" || day.kind === "cardio" ? (
                  <ThemedText style={[styles.kind, { color: theme.chalkDim }]}>
                    {t(`importWorkout.schedule.kind.${day.kind}`)}
                  </ThemedText>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}

      {hasCardio ? (
        <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
          {t("importWorkout.schedule.cardioAsAppointment")}
        </ThemedText>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      marginTop: Spacing.lg,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      gap: Spacing.sm,
    },
    header: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
    title: { fontSize: 15, fontWeight: "700" },
    hint: { fontSize: 13, lineHeight: 18 },
    week: { gap: 4 },
    weekLabel: {
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: 2,
    },
    row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    weekday: { width: 28, fontSize: 13, fontWeight: "600" },
    dayName: { flex: 1, fontSize: 14 },
    kind: { fontSize: 12 },
  });
