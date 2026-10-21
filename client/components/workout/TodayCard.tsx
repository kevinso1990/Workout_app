import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
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
  const { t } = useTranslation();
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

  const rows: React.ReactNode[] = [];

  if (strength) {
    rows.push(
      <Row
        key="strength"
        styles={styles}
        theme={theme}
        icon={<ActivityIcon size={18} color={theme.text} />}
        title={translateDayName(t, strength.dayName)}
        subtitle={exercises(strength)}
        actionLabel={t("plans.today.start")}
        primary
        onPress={() => void start(strength)}
        testID="button-today-start"
      />,
    );
  } else {
    // Nothing to lift today: say why, then what's next — with a way to pull
    // it forward, since rest days get swapped all the time.
    const title = sport
      ? sportLabel(sport)
      : doneToday
        ? t("plans.today.doneTitle")
        : t("plans.today.restDay");
    const icon = sport ? (
      <ActivityIcon sport={sport.sport} size={18} color={theme.text} />
    ) : (
      <Feather name={doneToday ? "check-circle" : "moon"} size={18} color={theme.text} />
    );
    rows.push(
      <Row
        key="status"
        styles={styles}
        theme={theme}
        icon={icon}
        title={title}
        subtitle={
          next
            ? t("plans.today.next", {
                day: dayLabel(next.weekday),
                name: translateDayName(t, next.dayName),
              })
            : undefined
        }
        actionLabel={next && !mobility ? t("plans.today.startEarly") : undefined}
        onPress={next ? () => void start(next) : undefined}
        testID="button-today-start-next"
      />,
    );
  }

  if (mobility) {
    rows.push(
      <Row
        key="mobility"
        styles={styles}
        theme={theme}
        icon={<Feather name="wind" size={18} color={theme.text} />}
        title={t("mobility.reminderTitle")}
        subtitle={exercises(mobility)}
        actionLabel={t("plans.today.start")}
        primary={!strength}
        onPress={() => void start(mobility)}
        testID="button-today-mobility"
      />,
    );
  }

  return (
    <View style={styles.card} testID="card-today">
      <ThemedText style={[styles.overline, { color: theme.textSecondary }]}>
        {t("plans.today.title")}
      </ThemedText>
      {rows.map((row, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.hairline }]} /> : null}
          {row}
        </React.Fragment>
      ))}
    </View>
  );
}

function Row({
  styles,
  theme,
  icon,
  title,
  subtitle,
  actionLabel,
  primary = false,
  onPress,
  testID,
}: {
  styles: ReturnType<typeof makeStyles>;
  theme: Palette;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  primary?: boolean;
  onPress?: () => void;
  testID: string;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: theme.ironElevated3 }]}>{icon}</View>
      <View style={styles.textCol}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {actionLabel && onPress ? (
        <Pressable
          onPress={onPress}
          style={[
            styles.btn,
            primary
              ? { backgroundColor: theme.primary }
              : { borderWidth: 1, borderColor: theme.controlOutline },
          ]}
          accessibilityRole="button"
          testID={testID}
        >
          {primary ? <Feather name="play" size={14} color={theme.onChalk} /> : null}
          <ThemedText style={[styles.btnText, { color: primary ? theme.onChalk : theme.text }]}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      marginBottom: Spacing.md,
      padding: Spacing.lg,
      gap: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: c.ironElevated2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
    },
    overline: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    textCol: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    title: {
      fontSize: 17,
      fontWeight: "700",
    },
    subtitle: {
      fontSize: 13,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
    },
    btn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm + 2,
      borderRadius: BorderRadius.full,
    },
    btnText: {
      fontSize: 14,
      fontWeight: "700",
    },
  });
