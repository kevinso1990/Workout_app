import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Colors, FontFamily } from "@/constants/theme";
import type { DaySessionSummary } from "@/lib/workoutCalendar";
import { dateKeyFromIso } from "@/lib/workoutCalendar";

type HybridCalendarProps = {
  month: Date;
  summaries: Map<string, DaySessionSummary>;
  selectedDateKey: string | null;
  onSelectDate: (dateKey: string) => void;
};

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * Only as many weeks as the month actually spans.
 *
 * The old grid always emitted 42 cells, so a month that fits in five rows still
 * rendered a sixth row of greyed-out next-month numbers — an empty band under
 * the calendar that made the screen look padded out with nothing.
 */
function buildMonthGrid(month: Date): { date: Date; inMonth: boolean }[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-based week
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((startOffset + daysInMonth) / 7);

  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    cells.push({ date, inMonth: date.getMonth() === month.getMonth() });
  }
  return cells;
}

/**
 * Month grid for the training calendar.
 *
 * The encoding follows the Chalk & Iron rule that colour is not decoration: a
 * day you trained is a chalk-filled tile (the same treatment as a primary
 * action), a day with sport/cardio is an iron tile carrying a hairline marker,
 * and both together get the filled tile plus the marker. The previous version
 * used an amber dot, which reads as a plate colour and so implied a load
 * intensity it never meant.
 */
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
            <View key={dateKey} style={styles.cellSlot}>
              <Pressable
                onPress={() => onSelectDate(dateKey)}
                style={({ pressed }) => [
                  styles.cell,
                  !inMonth && styles.cellOutside,
                  hasStrength && styles.cellTrained,
                  !hasStrength && hasCardio && styles.cellCardio,
                  isToday && !isSelected && styles.cellToday,
                  isSelected && styles.cellSelected,
                  pressed && styles.cellPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={dateKey}
                testID={`calendar-day-${dateKey}`}
              >
                <ThemedText
                  style={[
                    styles.dayNum,
                    !inMonth && styles.dayNumOutside,
                    hasStrength && styles.dayNumOnChalk,
                  ]}
                >
                  {date.getDate()}
                </ThemedText>

                {hasCardio ? (
                  <View
                    style={[styles.cardioBar, hasStrength && styles.cardioBarOnChalk]}
                  />
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.legendSwatchTrained} />
          <ThemedText style={styles.legendText}>
            {t("calendar.legendStrength")}
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendSwatchCardio}>
            <View style={styles.cardioBar} />
          </View>
          <ThemedText style={styles.legendText}>
            {t("calendar.legendCardio")}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.light.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "600",
    color: Colors.light.chalkFaint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  // The slot holds the 1/7 column width; the tile inside is inset so tiles read
  // as separate pieces of material rather than one continuous block.
  cellSlot: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2.5,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.light.ironElevated2,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 3,
  },
  cellOutside: {
    backgroundColor: "transparent",
  },
  cellTrained: {
    backgroundColor: Colors.light.primary,
  },
  cellCardio: {
    borderColor: Colors.light.hairlineStrong,
  },
  cellToday: {
    borderColor: Colors.light.chalkDim,
  },
  cellSelected: {
    borderColor: Colors.light.chalk,
    borderWidth: 2,
  },
  cellPressed: {
    opacity: 0.75,
  },
  dayNum: {
    fontSize: 14,
    fontFamily: FontFamily.mono,
    color: Colors.light.chalk,
  },
  dayNumOutside: {
    color: Colors.light.chalkFaint,
  },
  dayNumOnChalk: {
    color: Colors.light.onChalk,
  },
  cardioBar: {
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.light.chalkDim,
  },
  cardioBarOnChalk: {
    backgroundColor: Colors.light.onChalk,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendSwatchTrained: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: Colors.light.primary,
  },
  legendSwatchCardio: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: Colors.light.ironElevated2,
    borderWidth: 1,
    borderColor: Colors.light.hairlineStrong,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 2,
  },
  legendText: {
    fontSize: 12,
    color: Colors.light.chalkDim,
  },
});
