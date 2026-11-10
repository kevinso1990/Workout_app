import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, FontFamily } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { WeeklyCommitment } from "@shared/weeklySchedule";
import { getWorkoutHistory, type WorkoutPlan, type WorkoutSession } from "@/lib/storage";
import {
  clearActiveWorkoutDraft,
  loadActiveWorkoutDraft,
  type ActiveWorkoutDraft,
} from "@/lib/activeWorkoutPersistence";
import { isSameLocalDay } from "@/lib/mobilitySchedule";
import { confirmAlert } from "@/lib/confirmAlert";
import { todayOverview, type TodaySession } from "@/lib/todayPlan";
import { translateDayName } from "@/lib/dayNameLabel";
import { ActivityIcon } from "@/components/schedule/activityIcons";
import { useCommitmentLabels } from "@/components/schedule/CommitmentEditor";

/**
 * "What do I do today?" answered on the home tab with one tap into the
 * workout — the week strip already knew, but starting still took three taps
 * through plan → day → start.
 */
export function TodayCard({
  plans,
  commitments,
  mobilityWeekdays,
}: {
  plans: WorkoutPlan[];
  commitments: WeeklyCommitment[];
  mobilityWeekdays: number[];
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();
  const { dayLabel, sportLabel } = useCommitmentLabels();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [history, setHistory] = useState<WorkoutSession[] | null>(null);
  const [draft, setDraft] = useState<ActiveWorkoutDraft | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([getWorkoutHistory(), loadActiveWorkoutDraft()]).then(([h, d]) => {
        if (cancelled) return;
        setHistory(h);
        setDraft(d);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const overview = useMemo(
    () =>
      history
        ? todayOverview({ plans, commitments, mobilityWeekdays, history, now: new Date() })
        : null,
    [plans, commitments, mobilityWeekdays, history],
  );

  // A workout started today has its own card above; offering a second one to
  // start would compete with it. A draft left over from an earlier day must
  // not hide today's plan, though.
  const draftFromToday = !!draft && isSameLocalDay(new Date(draft.workoutStartedAt), new Date());
  if (!overview || draftFromToday) return null;
  const { strength, mobility, sport, doneToday, next } = overview;
  if (!strength && !mobility && !next && !sport) return null;

  const start = async (s: TodaySession) => {
    if (draft) {
      // Starting a new workout replaces the unfinished one — never silently.
      const ok = await confirmAlert(
        t("plans.resume.discardTitle"),
        t("plans.resume.discardMessage"),
        {
          confirmText: t("plans.resume.discard"),
          cancelText: t("common.cancel"),
          destructive: true,
        },
      );
      if (!ok) return;
      await clearActiveWorkoutDraft();
      setDraft(null);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("ActiveWorkout", {
      planId: s.planId,
      planName: s.planName,
      dayIndex: s.dayIndex,
    });
  };

  const exercises = (s: TodaySession) => t("plans.exerciseCount", { count: s.exerciseCount });

  const dateLabel = new Date().toLocaleDateString(i18n.language, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  // Today is the one thing on this tab that wants a decision, so it is the
  // only element drawn big — no box, a headline and one chalk button. The
  // notices, the week and the plans around it stay quiet.
  return (
    <View style={styles.hero} testID="card-today">
      <ThemedText style={[styles.overline, { color: theme.textSecondary }]}>
        {t("plans.today.title")} · {dateLabel}
      </ThemedText>

      {strength ? (
        <>
          <ThemedText style={styles.heroTitle} numberOfLines={2}>
            {translateDayName(t, strength.dayName)}
          </ThemedText>
          <ThemedText style={[styles.heroMeta, { color: theme.textSecondary }]}>
            {exercises(strength)}
          </ThemedText>
          <Pressable
            onPress={() => void start(strength)}
            style={({ pressed }) => [
              styles.heroBtn,
              { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 },
            ]}
            accessibilityRole="button"
            testID="button-today-start"
          >
            <Feather name="play" size={16} color={theme.onChalk} />
            <ThemedText style={[styles.heroBtnText, { color: theme.onChalk }]}>
              {t("plans.today.start")}
            </ThemedText>
          </Pressable>
        </>
      ) : (
        <View style={styles.statusRow}>
          <View style={styles.statusText}>
            <View style={styles.statusTitleRow}>
              {sport ? (
                <ActivityIcon sport={sport.sport} size={20} color={theme.text} />
              ) : (
                <Feather name={doneToday ? "check-circle" : "moon"} size={20} color={theme.text} />
              )}
              <ThemedText style={styles.statusTitle} numberOfLines={1}>
                {sport
                  ? sportLabel(sport)
                  : doneToday
                    ? t("plans.today.doneTitle")
                    : t("plans.today.restDay")}
              </ThemedText>
            </View>
            {next ? (
              <ThemedText style={[styles.heroMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                {t("plans.today.next", {
                  day: dayLabel(next.weekday),
                  name: translateDayName(t, next.dayName),
                })}
              </ThemedText>
            ) : null}
          </View>
          {next && !mobility ? (
            <Pressable
              onPress={() => void start(next)}
              style={[styles.smallBtn, { borderColor: theme.controlOutline }]}
              accessibilityRole="button"
              testID="button-today-start-next"
            >
              <ThemedText style={[styles.smallBtnText, { color: theme.text }]}>
                {t("plans.today.startEarly")}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      )}

      {mobility ? (
        <View style={[styles.mobilityRow, { borderTopColor: theme.hairline }]}>
          <Feather name="wind" size={16} color={theme.text} />
          <View style={styles.statusText}>
            <ThemedText style={styles.mobilityTitle} numberOfLines={1}>
              {t("mobility.reminderTitle")}
            </ThemedText>
            <ThemedText style={[styles.heroMeta, { color: theme.textSecondary }]} numberOfLines={1}>
              {exercises(mobility)}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => void start(mobility)}
            style={[
              styles.smallBtn,
              strength
                ? { borderColor: theme.controlOutline }
                : { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
            accessibilityRole="button"
            testID="button-today-mobility"
          >
            <ThemedText style={[styles.smallBtnText, { color: strength ? theme.text : theme.onChalk }]}>
              {t("plans.today.start")}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    hero: {
      marginBottom: Spacing.xl,
      gap: Spacing.sm,
    },
    overline: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    heroTitle: {
      fontFamily: FontFamily.display,
      fontSize: 34,
      lineHeight: 40,
      color: c.chalk,
    },
    heroMeta: {
      fontSize: 14,
    },
    heroBtn: {
      marginTop: Spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      height: 52,
      borderRadius: BorderRadius.full,
    },
    heroBtnText: {
      fontSize: 16,
      fontWeight: "700",
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    statusText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    statusTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    statusTitle: {
      flexShrink: 1,
      fontFamily: FontFamily.display,
      fontSize: 26,
      lineHeight: 32,
      color: c.chalk,
    },
    mobilityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      marginTop: Spacing.sm,
      paddingTop: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    mobilityTitle: {
      fontSize: 15,
      fontWeight: "700",
    },
    smallBtn: {
      paddingHorizontal: Spacing.lg,
      height: 36,
      justifyContent: "center",
      borderRadius: BorderRadius.full,
      borderWidth: 1,
    },
    smallBtnText: {
      fontSize: 13,
      fontWeight: "700",
    },
  });
