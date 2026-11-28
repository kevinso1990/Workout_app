import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { PanelFill, panelFrame } from "@/components/surface/Panel";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, FontFamily, Spacing } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { dayNumber, type WeekStreak } from "@/lib/weekStreak";

const DOT = 30;

/**
 * Weeks in a row at the plan's weekly goal, with the last five weeks below:
 * a week that reached the goal is one band, trained days sit on it as chalk
 * discs. Today carries the signal ring. Pips show this week's sessions
 * against the goal — what still counts toward the next week of the streak.
 */
export function StreakCard({
  streak,
  now,
  index,
}: {
  streak: WeekStreak;
  now: Date;
  index: number;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();

  const today = dayNumber(now);
  const firstMonday = streak.recent[0].start;
  const weekdayLetters = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(firstMonday);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString(i18n.language, { weekday: "narrow" });
  });

  const toGo = Math.max(0, streak.goal - streak.thisWeek);
  // Days left this week, today included (Monday-based weeks).
  const daysLeft = 7 - ((now.getDay() + 6) % 7);
  // Never "broken": a week still open only ever counts up. When the goal is
  // out of reach, point at next week instead of counting what can't be done.
  const status =
    toGo === 0
      ? t("streak.goalMet")
      : toGo > daysLeft
        ? t("streak.nextWeek", { count: streak.goal })
        : t("streak.toGo", { count: toGo });

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={[styles.card, panelFrame(theme)]}
      testID="card-streak"
    >
      <PanelFill />
      <View style={styles.header}>
        <View style={styles.headline}>
          <ThemedText style={styles.number}>{streak.weeks}</ThemedText>
          <ThemedText style={styles.unit}>{t("streak.unit", { count: streak.weeks })}</ThemedText>
        </View>
        <View style={styles.pipsWrap} accessibilityLabel={status}>
          <View style={styles.pips}>
            {Array.from({ length: streak.goal }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.pip,
                  i < streak.thisWeek
                    ? { backgroundColor: theme.chalk }
                    : { borderWidth: 1.5, borderColor: theme.chalkFaint },
                ]}
              />
            ))}
          </View>
          <ThemedText style={styles.pipsLabel}>{t("streak.thisWeek")}</ThemedText>
        </View>
      </View>
      <ThemedText style={styles.status}>{status}</ThemedText>

      <View style={styles.row}>
        {weekdayLetters.map((letter, i) => (
          <ThemedText key={i} style={styles.weekday}>
            {letter}
          </ThemedText>
        ))}
      </View>
      {streak.recent.map((week) => (
        <View key={week.start.toISOString()} style={styles.row}>
          {week.met ? <View style={styles.band} /> : null}
          {Array.from({ length: 7 }, (_, d) => {
            const date = new Date(week.start);
            date.setDate(week.start.getDate() + d);
            const day = dayNumber(date);
            const trained = streak.trained.has(day);
            const future = day > today;
            const isToday = day === today;
            return (
              <View key={d} style={styles.cell}>
                <View
                  style={[
                    styles.dot,
                    trained && { backgroundColor: theme.chalk },
                    isToday && { borderWidth: 2, borderColor: theme.signal },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.date,
                      {
                        color: trained
                          ? theme.onChalk
                          : week.met
                            ? theme.chalk
                            : future
                              ? theme.hairlineStrong
                              : theme.chalkFaint,
                      },
                    ]}
                  >
                    {date.getDate()}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>
      ))}

      <View style={styles.footer}>
        {streak.longest > 0 ? (
          <>
            <Feather name="award" size={14} color={theme.chalkDim} />
            <ThemedText style={styles.footerText}>
              {t("streak.longest", { count: streak.longest })}
            </ThemedText>
          </>
        ) : null}
        <ThemedText
          style={[styles.footerText, streak.longest > 0 && styles.footerRule]}
          numberOfLines={1}
        >
          {t("streak.rule", { count: streak.goal })}
        </ThemedText>
      </View>
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
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    headline: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: Spacing.sm,
    },
    number: {
      fontFamily: FontFamily.display,
      fontSize: 52,
      lineHeight: 58,
      color: c.chalk,
    },
    unit: {
      fontFamily: FontFamily.displaySemi,
      fontSize: 20,
      color: c.chalkDim,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    pipsWrap: {
      alignItems: "flex-end",
      gap: 6,
      marginBottom: 10,
    },
    pips: {
      flexDirection: "row",
      gap: 5,
    },
    pip: {
      width: 18,
      height: 6,
      borderRadius: 3,
    },
    pipsLabel: {
      fontSize: 12,
      color: c.chalkDim,
    },
    status: {
      fontSize: 14,
      lineHeight: 20,
      color: c.chalkDim,
      marginTop: 2,
      marginBottom: Spacing.lg,
    },
    row: {
      flexDirection: "row",
    },
    weekday: {
      flex: 1,
      textAlign: "center",
      fontSize: 12,
      color: c.chalkFaint,
      marginBottom: 6,
    },
    cell: {
      flex: 1,
      height: DOT + 10,
      alignItems: "center",
      justifyContent: "center",
    },
    band: {
      position: "absolute",
      left: 4,
      right: 4,
      top: 5,
      height: DOT,
      borderRadius: DOT / 2,
      backgroundColor: c.chipIdle,
    },
    dot: {
      width: DOT,
      height: DOT,
      borderRadius: DOT / 2,
      alignItems: "center",
      justifyContent: "center",
    },
    date: {
      fontFamily: FontFamily.mono,
      fontSize: 12,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hairline,
    },
    footerText: {
      fontSize: 13,
      color: c.chalkDim,
    },
    footerRule: {
      flex: 1,
      textAlign: "right",
    },
  });
