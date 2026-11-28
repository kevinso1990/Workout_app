import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, FontFamily, Spacing } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  isLiveDraft,
  loadActiveWorkoutDraft,
  onActiveWorkoutDraftChange,
  type ActiveWorkoutDraft,
} from "@/lib/activeWorkoutPersistence";
import { translateDayName } from "@/lib/dayNameLabel";
import { formatClock } from "@/lib/elapsedLabel";

/** iOS tab bar content height; the safe-area inset comes on top. */
const TAB_BAR_HEIGHT = 49;

/**
 * A minimised workout keeps its clocks in view on every tab: the session time
 * and, while resting, the pause left. Tapping it goes back into the workout.
 * Before, leaving the workout screen meant losing sight of the rest timer.
 */
export function WorkoutTimerBar({ hidden = false }: { hidden?: boolean }) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [draft, setDraft] = useState<ActiveWorkoutDraft | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    void loadActiveWorkoutDraft().then((d) => {
      if (!cancelled) setDraft(d);
    });
    const unsubscribe = onActiveWorkoutDraftChange(setDraft);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const live = !!draft && isLiveDraft(draft);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);

  if (hidden || !draft || !live) return null;

  const day = draft.plan.days[draft.route.dayIndex];
  const name = day ? translateDayName(t, day.dayName) : draft.route.planName;
  const elapsed = Math.max(0, Math.floor((now - draft.workoutStartedAt) / 1000));
  const restLeft =
    draft.restTimerEndAt != null ? Math.ceil((draft.restTimerEndAt - now) / 1000) : 0;

  const resume = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("ActiveWorkout", {
      planId: draft.route.planId,
      planName: draft.route.planName,
      dayIndex: draft.route.dayIndex,
      restored: true,
    });
  };

  return (
    <Pressable
      onPress={resume}
      style={({ pressed }) => [
        styles.bar,
        { bottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.sm },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t("activeWorkout.timerBar.resume", { name })}
      testID="workout-timer-bar"
    >
      <View style={[styles.dot, { backgroundColor: theme.signal }]} />
      <ThemedText style={styles.name} numberOfLines={1}>
        {name}
      </ThemedText>
      {restLeft > 0 ? (
        <View style={styles.rest}>
          <ThemedText style={[styles.restLabel, { color: theme.chalkDim }]}>
            {t("activeWorkout.timerBar.rest")}
          </ThemedText>
          <ThemedText style={styles.clock}>
            {formatClock(restLeft)}
          </ThemedText>
        </View>
      ) : null}
      <ThemedText style={styles.clock}>{formatClock(elapsed)}</ThemedText>
      <Feather name="chevron-up" size={16} color={theme.chalkDim} />
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    bar: {
      position: "absolute",
      left: Spacing.lg,
      right: Spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      borderRadius: BorderRadius.full,
      backgroundColor: c.panelTop,
      borderWidth: 1,
      borderColor: c.panelEdge,
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    pressed: {
      transform: [{ scale: 0.98 }],
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    name: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: c.chalk,
    },
    rest: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    restLabel: {
      fontSize: 13,
      fontWeight: "600",
    },
    clock: {
      fontFamily: FontFamily.mono,
      fontSize: 14,
      color: c.chalk,
    },
  });
