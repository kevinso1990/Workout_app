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
import { dayNumber, type RestDayStreak } from "@/lib/restDayStreak";
import { mondayStart } from "@/lib/strengthProgress";

const WEEKS = 5;
const DOT = 30;

/**
 * The streak as one number and a calendar it runs through: the streak is a
 * band across the days, trained days sit on it as chalk discs, rest days are
 * simply part of the band. Today carries the signal ring.
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

  const weekdayLetters = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(firstMonday);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString(i18n.language, { weekday: "narrow" });
  });

  const alive = streak.days > 0;
  const trainedToday = streak.trained.has(today);
  const lastChain = streak.chains[streak.chains.length - 1];
  const status = !alive
    ? lastChain
      ? t("streak.brokenAfter", { count: lastChain.end - lastChain.start + 1 })
      : t("streak.broken")
    : trainedToday
      ? t("streak.trainedToday")
      : streak.restLeft === 0
        ? t("streak.lastDay")
        : t("streak.restLeft", { count: streak.restLeft });

  // Every streak gets the band, finished ones too: the gap between two bands
  // is where one broke.
  const chainOf = (day: number) => streak.chains.find((c) => day >= c.start && day <= c.end);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={[styles.card, panelFrame(theme)]}
      testID="card-streak"
    >
      <PanelFill />
      <View style={styles.header}>
        <View style={styles.headline}>
          <ThemedText style={styles.number}>{streak.days}</ThemedText>
          <ThemedText style={styles.unit}>{t("streak.unit", { count: streak.days })}</ThemedText>
        </View>
        {alive ? (
          // Rest left as pips: what the streak can still absorb.
          <View style={styles.pipsWrap} accessibilityLabel={status}>
            <View style={styles.pips}>
              {Array.from({ length: streak.maxRest }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pip,
                    i < (trainedToday ? streak.maxRest : streak.restLeft)
                      ? { backgroundColor: theme.chalk }
                      : { borderWidth: 1.5, borderColor: theme.chalkFaint },
                  ]}
                />
              ))}
            </View>
            <ThemedText style={styles.pipsLabel}>{t("streak.restPips")}</ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText style={styles.status}>{status}</ThemedText>

      <View style={styles.row}>
        {weekdayLetters.map((letter, i) => (
          <ThemedText key={i} style={styles.weekday}>
            {letter}
          </ThemedText>
        ))}
      </View>
      {Array.from({ length: WEEKS }, (_, w) => (
        <View key={w} style={styles.row}>
          {Array.from({ length: 7 }, (_, d) => {
            const date = new Date(firstMonday);
            date.setDate(firstMonday.getDate() + w * 7 + d);
            const day = dayNumber(date);
            const trained = streak.trained.has(day);
            const chain = chainOf(day);
            const band = !!chain;
            const future = day > today;
            const isToday = day === today;
            // The band is cut into cells; round it where the run starts or
            // ends and where the week wraps to the next row.
            const bandStart = !!chain && (d === 0 || day === chain.start);
            const bandEnd = !!chain && (d === 6 || day === chain.end);
            return (
              <View key={d} style={styles.cell}>
                {band ? (
                  <View
                    style={[
                      styles.band,
                      bandStart && styles.bandStart,
                      bandEnd && styles.bandEnd,
                    ]}
                  />
                ) : null}
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
                          : band
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
        <Feather name="award" size={14} color={theme.chalkDim} />
        <ThemedText style={styles.footerText}>
          {t("streak.longest", { count: streak.longest })}
        </ThemedText>
        <ThemedText style={[styles.footerText, styles.footerRule]} numberOfLines={1}>
          {t("streak.rule", { count: streak.maxRest })}
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
      left: 0,
      right: 0,
      height: DOT,
      backgroundColor: c.chipIdle,
    },
    bandStart: {
      left: 4,
      borderTopLeftRadius: DOT / 2,
      borderBottomLeftRadius: DOT / 2,
    },
    bandEnd: {
      right: 4,
      borderTopRightRadius: DOT / 2,
      borderBottomRightRadius: DOT / 2,
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
