import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  isLiveDraft,
  onActiveWorkoutDraftChange,
} from "@/lib/activeWorkoutPersistence";
import { confirmAlert } from "@/lib/confirmAlert";
import { todayOverview, type TodaySession } from "@/lib/todayPlan";
import { translateDayName } from "@/lib/dayNameLabel";
import { ActivityIcon } from "@/components/schedule/activityIcons";
import { Panel } from "@/components/surface/Panel";
import { sessionHues } from "@/constants/palettes";
import { sessionHueIndex, sessionLengthVariant } from "@/lib/planStructure";
import { useCommitmentLabels } from "@/components/schedule/CommitmentEditor";

type LengthChoice<S extends TodaySession = TodaySession> = {
  session: S | null;
  variant: { length: "short" | "long"; otherIndex: number } | null;
  shownLength: "short" | "long" | null;
};

/** The session as due, or its other length when the athlete switched to it. */
function lengthChoice<S extends TodaySession>(
  plans: WorkoutPlan[],
  due: S | null,
  pickedIndex: number | null,
): LengthChoice<S> {
  const plan = due ? plans.find((p) => p.id === due.planId) : undefined;
  const variant =
    due && plan ? sessionLengthVariant(plan.days.map((d) => d.dayName), due.dayIndex) : null;
  if (!due || !plan || !variant) return { session: due, variant: null, shownLength: null };
  if (pickedIndex !== variant.otherIndex) {
    return { session: due, variant, shownLength: variant.length };
  }
  const day = plan.days[variant.otherIndex];
  return {
    session: { ...due, dayIndex: variant.otherIndex, dayName: day.dayName, exerciseCount: day.exercises.length },
    variant,
    shownLength: variant.length === "short" ? "long" : "short",
  };
}

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
  // The other length of today's session, when the athlete switched to it.
  const [pickedDayIndex, setPickedDayIndex] = useState<number | null>(null);
  const [pickedNextIndex, setPickedNextIndex] = useState<number | null>(null);

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
  useEffect(() => onActiveWorkoutDraftChange(setDraft), []);

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
  const draftLive = !!draft && isLiveDraft(draft);
  if (!overview || draftLive) return null;
  const { mobility, sport, doneToday, next } = overview;
  const scheduled = overview.strength;
  if (!scheduled && !mobility && !next && !sport) return null;

  // A plan with "kurz" and "lang" versions of each session: the long one is
  // due, but today there's only time for the short one (or the other way).
  // The same goes for the session pulled forward from later in the week.
  const strengthChoice = lengthChoice(plans, scheduled, pickedDayIndex);
  const strength = strengthChoice.session;
  const nextChoice = lengthChoice(plans, next, pickedNextIndex);
  const nextShown = nextChoice.session;

  const lengthToggle = (
    choice: LengthChoice,
    setPicked: (index: number | null) => void,
    testID: string,
  ) =>
    choice.variant ? (
      <View
        style={[styles.lengthToggle, { borderColor: theme.controlOutline }]}
        accessibilityRole="radiogroup"
        testID={testID}
      >
        {(["short", "long"] as const).map((length) => {
          const active = choice.shownLength === length;
          return (
            <Pressable
              key={length}
              onPress={() => {
                if (active || !choice.variant) return;
                Haptics.selectionAsync();
                setPicked(length === choice.variant.length ? null : choice.variant.otherIndex);
              }}
              style={[styles.lengthOption, active && { backgroundColor: theme.chalk }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              testID={`${testID}-${length}`}
            >
              <ThemedText
                style={[
                  styles.lengthOptionText,
                  { color: active ? theme.onChalk : theme.textSecondary },
                ]}
              >
                {t(`plans.today.length.${length}`)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    ) : null;

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

  // Today is the one thing on this tab that wants a decision: the only panel
  // tinted warm, drawn big, with the one signal button.
  return (
    <Panel warm style={styles.hero} testID="card-today">
      {/* One orange on the tab: the Start button. The date line above it
          used to be orange too, as were the week strip's today and ticks. */}
      <ThemedText style={[styles.overline, { color: theme.textSecondary }]}>
        {t("plans.today.title")} · {dateLabel}
      </ThemedText>

      {strength ? (
        <>
          <ThemedText style={styles.heroTitle} numberOfLines={2}>
            {translateDayName(t, strength.dayName)}
          </ThemedText>
          <View style={styles.metaRow}>
            <ThemedText style={[styles.heroMeta, styles.metaText, { color: theme.textSecondary }]}>
              {exercises(strength)}
            </ThemedText>
            {lengthToggle(strengthChoice, setPickedDayIndex, "toggle-today-length")}
          </View>
          <Pressable
            onPress={() => void start(strength)}
            style={({ pressed }) => [
              styles.heroBtn,
              { backgroundColor: theme.signal, opacity: pressed ? 0.9 : 1 },
            ]}
            accessibilityRole="button"
            testID="button-today-start"
          >
            <Feather name="play" size={16} color={theme.onSignal} />
            <ThemedText style={[styles.heroBtnText, { color: theme.onSignal }]}>
              {overview.firstWorkout ? t("plans.today.startFirst") : t("plans.today.start")}
            </ThemedText>
          </Pressable>
        </>
      ) : (
        <>
          {/* Done is today's news and gets the accent; the next session is
              what to look at, so it reads as a row of its own instead of a
              truncated sentence under the status. */}
          <View style={styles.statusTitleRow}>
            {sport ? (
              <ActivityIcon sport={sport.sport} size={24} color={theme.text} />
            ) : (
              <Feather
                name={doneToday ? "check-circle" : "moon"}
                size={24}
                color={theme.text}
              />
            )}
            <ThemedText style={styles.statusTitle} numberOfLines={1}>
              {sport
                ? sportLabel(sport)
                : doneToday
                  ? t("plans.today.doneTitle")
                  : t("plans.today.restDay")}
            </ThemedText>
          </View>
          {/* A sport day is shown so the week can be planned around it,
              not logged: no button, no prompt. The next session below stays
              the thing to act on. */}
          {nextShown ? (
            <View style={[styles.sessionRow, { borderTopColor: theme.hairline }]} testID="row-today-next">
              {/* In the session's plan colour, as in the week and the plan. */}
              <View
                style={[
                  styles.weekdayBadge,
                  {
                    backgroundColor:
                      sessionHues[sessionHueIndex(nextShown.dayName, nextShown.dayIndex, sessionHues.length)],
                  },
                ]}
              >
                <ThemedText style={[styles.weekdayBadgeText, { color: theme.onSessionHue }]}>
                  {dayLabel(nextShown.weekday)}
                </ThemedText>
              </View>
              <View style={styles.statusText}>
                <ThemedText style={[styles.rowOverline, { color: theme.textSecondary }]}>
                  {t("plans.today.nextOverline")}
                </ThemedText>
                <ThemedText style={styles.rowTitle} numberOfLines={1}>
                  {translateDayName(t, nextShown.dayName)}
                </ThemedText>
                <ThemedText style={[styles.heroMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                  {exercises(nextShown)}
                </ThemedText>
                {nextChoice.variant ? (
                  <View style={styles.nextToggle}>
                    {lengthToggle(nextChoice, setPickedNextIndex, "toggle-next-length")}
                  </View>
                ) : null}
              </View>
              {/* Also on mobility days: switching to the long session for
                  tomorrow was pointless when it couldn't be started. */}
              <Pressable
                onPress={() => void start(nextShown)}
                style={[styles.smallBtn, { borderColor: theme.controlOutline }]}
                accessibilityRole="button"
                testID="button-today-start-next"
              >
                <ThemedText style={[styles.smallBtnText, { color: theme.text }]}>
                  {t("plans.today.startEarly")}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </>
      )}

      {mobility ? (
        <View style={[styles.sessionRow, { borderTopColor: theme.hairline }]}>
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
                : { backgroundColor: theme.signal, borderColor: theme.signal },
            ]}
            accessibilityRole="button"
            testID="button-today-mobility"
          >
            <ThemedText style={[styles.smallBtnText, { color: strength ? theme.text : theme.onSignal }]}>
              {t("plans.today.start")}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </Panel>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    hero: {
      marginBottom: Spacing.lg,
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
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    metaText: {
      flex: 1,
    },
    nextToggle: {
      flexDirection: "row",
      marginTop: Spacing.sm,
    },
    lengthToggle: {
      flexDirection: "row",
      borderWidth: 1,
      borderRadius: BorderRadius.full,
      padding: 2,
    },
    lengthOption: {
      height: 30,
      paddingHorizontal: Spacing.md,
      justifyContent: "center",
      borderRadius: BorderRadius.full,
    },
    lengthOptionText: {
      fontSize: 13,
      fontWeight: "700",
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
    sessionRow: {
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
    weekdayBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    weekdayBadgeText: {
      fontSize: 13,
      fontWeight: "800",
    },
    rowOverline: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    rowTitle: {
      fontSize: 16,
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
