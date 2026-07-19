import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { DaySessionSummary } from "@/lib/workoutCalendar";
import { dateKeyFromIso } from "@/lib/workoutCalendar";

type HybridCalendarProps = {
  month: Date;
  summaries: Map<string, DaySessionSummary>;
  selectedDateKey: string | null;
  onSelectDate: (dateKey: string) => void;
};

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function buildMonthGrid(month: Date): { date: Date; inMonth: boolean }[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
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

export function HybridCalendar({
  month,
  summaries,
  selectedDateKey,
  onSelectDate,
}: HybridCalendarProps) {
  const { t } = useTranslation();
  const todayKey = dateKeyFromIso(new Date().toISOString());
  const cells = buildMonthGrid(month);

  return (
    <View style={styles.wrap}>
      <View style={styles.weekRow}>
        {WEEKDAY_KEYS.map((key) => (
          <ThemedText key={key} style={styles.weekday}>
            {t(`days.${key}`)}
          </ThemedText>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map(({ date, inMonth }) => {
          const dateKey = dateKeyFromIso(date.toISOString());
          const summary = summaries.get(dateKey);
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDateKey;
          const hasStrength = (summary?.strengthCount ?? 0) > 0;
          const hasCardio = (summary?.cardioCount ?? 0) > 0;

          return (
            <Pressable
              key={dateKey}
              onPress={() => onSelectDate(dateKey)}
              style={({ pressed }) => [
                styles.cell,
                !inMonth && styles.cellOutside,
                isSelected && styles.cellSelected,
                isToday && !isSelected && styles.cellToday,
                pressed && styles.cellPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={dateKey}
            >
              <ThemedText
                style={[
                  styles.dayNum,
                  !inMonth && styles.dayNumOutside,
                  isSelected && styles.dayNumSelected,
                ]}
              >
                {date.getDate()}
              </ThemedText>
              <View style={styles.dots}>
                {hasStrength ? (
                  <View style={[styles.dot, styles.dotStrength]}>
                    <Feather name="activity" size={8} color="#FFFFFF" />
                  </View>
                ) : null}
                {hasCardio ? (
                  <View style={[styles.dot, styles.dotCardio]}>
                    <Feather name="zap" size={8} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotStrength]} />
          <ThemedText style={styles.legendText}>{t("calendar.legendStrength")}</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotCardio]} />
          <ThemedText style={styles.legendText}>{t("calendar.legendCardio")}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.55,
    textTransform: "uppercase",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
    paddingVertical: 2,
  },
  cellOutside: {
    opacity: 0.35,
  },
  cellSelected: {
    backgroundColor: Colors.light.primary,
  },
  cellToday: {
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  cellPressed: {
    opacity: 0.85,
  },
  dayNum: {
    fontSize: 14,
    fontWeight: "600",
  },
  dayNumOutside: {
    fontWeight: "400",
  },
  dayNumSelected: {
    color: "#FFFFFF",
  },
  dots: {
    flexDirection: "row",
    gap: 3,
    marginTop: 3,
    minHeight: 10,
    alignItems: "center",
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  dotStrength: {
    backgroundColor: Colors.light.primary,
  },
  dotCardio: {
    backgroundColor: "#F59E0B",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    opacity: 0.7,
  },
});
