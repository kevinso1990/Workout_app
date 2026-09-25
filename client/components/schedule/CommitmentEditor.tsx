import React, { useState, useMemo} from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { ActivityIcon } from "@/components/schedule/activityIcons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import type { CommitmentSport, Weekday, WeeklyCommitment } from "@shared/weeklySchedule";

export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const WEEKDAY_FALLBACK = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export const COMMITMENT_SPORTS: { id: CommitmentSport; fallback: string }[] = [
  { id: "running", fallback: "Laufen" },
  { id: "football", fallback: "Fußball" },
  { id: "basketball", fallback: "Basketball" },
  { id: "tennis", fallback: "Tennis" },
  { id: "cycling", fallback: "Radfahren" },
  { id: "swimming", fallback: "Schwimmen" },
  { id: "boxing", fallback: "Kampfsport" },
  { id: "custom", fallback: "Anderes" },
];

export function useCommitmentLabels() {
  const { t } = useTranslation();
  return {
    dayLabel: (d: number) =>
      t(`onboarding.commitments.weekday.${WEEKDAY_KEYS[d]}`, {
        defaultValue: WEEKDAY_FALLBACK[d],
      }),
    sportLabel: (c: Pick<WeeklyCommitment, "sport" | "label">) =>
      c.sport === "custom" && c.label
        ? c.label
        : t(`onboarding.commitments.sport.${c.sport}`, {
            defaultValue: COMMITMENT_SPORTS.find((x) => x.id === c.sport)?.fallback ?? c.sport,
          }),
  };
}

/**
 * Weekday strip plus sport picker, shared by onboarding and the profile so the
 * two can't drift apart. Tapping a filled day clears it — a separate delete
 * affordance would double the controls for something this small.
 */
export function CommitmentEditor({
  commitments,
  onChange,
  testIDPrefix = "commitment",
}: {
  commitments: WeeklyCommitment[];
  onChange: (next: WeeklyCommitment[]) => void;
  testIDPrefix?: string;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { dayLabel, sportLabel } = useCommitmentLabels();
  const [pickerDay, setPickerDay] = useState<Weekday | null>(null);

  const commitmentOn = (d: Weekday) => commitments.find((c) => c.weekday === d);

  const handleDayPress = (d: Weekday) => {
    Haptics.selectionAsync();
    if (commitmentOn(d)) {
      onChange(commitments.filter((c) => c.weekday !== d));
      setPickerDay(null);
      return;
    }
    setPickerDay(pickerDay === d ? null : d);
  };

  const handlePickSport = (sport: CommitmentSport) => {
    if (pickerDay === null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange([
      ...commitments.filter((c) => c.weekday !== pickerDay),
      { id: `${pickerDay}-${sport}-${Date.now()}`, weekday: pickerDay, sport },
    ]);
    setPickerDay(null);
  };

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEKDAY_FALLBACK.map((_, i) => {
          const d = i as Weekday;
          const c = commitmentOn(d);
          const isPicking = pickerDay === d;
          return (
            <Pressable
              key={d}
              onPress={() => handleDayPress(d)}
              testID={`${testIDPrefix}-day-${d}`}
              style={[
                styles.dayPill,
                { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
                c && { backgroundColor: theme.primary, borderColor: theme.primary },
                isPicking && { borderColor: theme.primary, borderWidth: 2 },
              ]}
            >
              <ThemedText style={[styles.dayPillText, c && { color: theme.onChalk }]}>
                {dayLabel(d)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {pickerDay !== null ? (
        <View style={styles.sportGrid}>
          {COMMITMENT_SPORTS.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => handlePickSport(s.id)}
              testID={`${testIDPrefix}-sport-${s.id}`}
              style={[
                styles.sportChip,
                { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
              ]}
            >
              <ActivityIcon sport={s.id} size={17} color={theme.text} />
              <ThemedText style={styles.sportChipText}>
                {sportLabel({ sport: s.id })}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {commitments.length > 0 ? (
        <View style={styles.summary}>
          {[...commitments]
            .sort((a, b) => a.weekday - b.weekday)
            .map((c) => (
              <View key={c.id} style={styles.summaryRow}>
                <ThemedText style={styles.summaryDay}>{dayLabel(c.weekday)}</ThemedText>
                <ThemedText style={[styles.summarySport, { color: theme.textSecondary }]}>
                  {sportLabel(c)}
                </ThemedText>
              </View>
            ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  weekRow: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  dayPill: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  dayPillText: { fontSize: 13, fontWeight: "600" },
  sportGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.lg },
  sportChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  sportChipText: { fontSize: 14, fontWeight: "500" },
  summary: { marginTop: Spacing.lg, gap: Spacing.xs },
  summaryRow: { flexDirection: "row", gap: Spacing.md },
  summaryDay: { fontSize: 14, fontWeight: "700", width: 32 },
  summarySport: { fontSize: 14 },
});
