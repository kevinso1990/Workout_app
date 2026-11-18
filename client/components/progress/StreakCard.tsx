import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { PanelFill, panelFrame } from "@/components/surface/Panel";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { dayNumber, type RestDayStreak } from "@/lib/restDayStreak";
import { mondayStart } from "@/lib/strengthProgress";

const WEEKS = 5;

/**
 * The streak as days, with the last five weeks underneath: trained days
 * filled, rest days inside the streak ringed — rest is part of the streak,
 * not a hole in it. Today carries the signal.
 */
export function StreakCard({
  streak,
  now,
  index,
}: {
  streak: RestDayStreak;
  now: Date;
  index: number;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();

  const today = dayNumber(now);
  const firstMonday = mondayStart(now);
  firstMonday.setDate(firstMonday.getDate() - (WEEKS - 1) * 7);
  const firstDay = dayNumber(firstMonday);

  const weekdayLetters = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(firstMonday);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString(i18n.language, { weekday: "narrow" });
  });

  const status =
    streak.days === 0
      ? t("streak.broken")
      : streak.trained.has(today)
        ? t("streak.trainedToday")
        : streak.restLeft === 0
          ? t("streak.lastDay")
          : t("streak.restLeft", { count: streak.restLeft });

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={[styles.card, panelFrame(theme)]}
      testID="card-streak"
    >
      <PanelFill />
      {/* The number itself is the tile above; this says what it means now. */}
      <ThemedText style={styles.title}>{t("streak.title")}</ThemedText>
      <ThemedText style={[styles.status, { color: theme.textSecondary }]}>{status}</ThemedText>

      <View style={styles.row}>
        {weekdayLetters.map((letter, i) => (
          <ThemedText key={i} style={[styles.weekday, { color: theme.chalkFaint }]}>
            {letter}
          </ThemedText>
        ))}
      </View>
      {Array.from({ length: WEEKS }, (_, w) => (
        <View key={w} style={styles.row}>
          {Array.from({ length: 7 }, (_, d) => {
            const day = firstDay + w * 7 + d;
            const trained = streak.trained.has(day);
            const inStreak = streak.startDay !== null && day >= streak.startDay && day <= today;
            const isToday = day === today;
            const future = day > today;
            return (
              <View key={d} style={styles.cell}>
                <View
                  style={[
                    styles.dot,
                    trained
                      ? { backgroundColor: theme.chalk }
                      : inStreak
                        ? { borderWidth: 1.5, borderColor: theme.chalkDim }
                        : future
                          ? null
                          : { backgroundColor: theme.hairlineStrong, transform: [{ scale: 0.4 }] },
                    isToday && {
                      borderWidth: 2,
                      borderColor: theme.signal,
                      transform: [{ scale: 1 }],
                      backgroundColor: trained ? theme.chalk : "transparent",
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      ))}
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: theme.chalk }]} />
        <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>
          {t("streak.legendTrained")}
        </ThemedText>
        <View style={[styles.legendDot, { borderWidth: 1.5, borderColor: theme.chalkDim }]} />
        <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>
          {t("streak.legendRest")}
        </ThemedText>
      </View>
      <ThemedText style={[styles.rule, { color: theme.textSecondary }]}>
        {t("streak.rule", { count: streak.maxRest })}
      </ThemedText>
    </Animated.View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    title: {
      fontSize: 16,
      fontWeight: "600",
      fontFamily: "Archivo_600SemiBold",
      color: c.chalk,
    },
    status: {
      fontSize: 14,
      lineHeight: 20,
      marginTop: 4,
      marginBottom: Spacing.md,
    },
    rule: {
      fontSize: 12,
      marginTop: 6,
      marginLeft: 6,
    },
    row: {
      flexDirection: "row",
    },
    weekday: {
      flex: 1,
      textAlign: "center",
      fontSize: 12,
      marginBottom: 4,
    },
    cell: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 5,
    },
    dot: {
      width: 18,
      height: 18,
      borderRadius: 9,
    },
    legend: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: Spacing.sm,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginLeft: 6,
    },
    legendText: {
      fontSize: 12,
      marginRight: Spacing.sm,
    },
  });
