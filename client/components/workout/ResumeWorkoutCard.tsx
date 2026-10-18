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
import {
  clearActiveWorkoutDraft,
  loadActiveWorkoutDraft,
  type ActiveWorkoutDraft,
} from "@/lib/activeWorkoutPersistence";
import { translateDayName } from "@/lib/dayNameLabel";
import { confirmAlert } from "@/lib/confirmAlert";
import { formatElapsed } from "@/lib/elapsedLabel";

/**
 * The way back into a minimised workout. Without it, leaving the workout
 * screen stranded the session until the next cold start (the only other place
 * the draft was ever read).
 */
export function ResumeWorkoutCard() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [draft, setDraft] = useState<ActiveWorkoutDraft | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadActiveWorkoutDraft().then((d) => {
        if (!cancelled) setDraft(d);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (!draft) return null;

  const day = draft.plan.days[draft.route.dayIndex];
  const name = day ? translateDayName(t, day.dayName) : draft.route.planName;
  const done = draft.progress.reduce(
    (n, ep) => n + ep.sets.filter((s) => s.completed).length,
    0,
  );
  const total = draft.progress.reduce((n, ep) => n + ep.sets.length, 0);

  const resume = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("ActiveWorkout", {
      planId: draft.route.planId,
      planName: draft.route.planName,
      dayIndex: draft.route.dayIndex,
      restored: true,
    });
  };

  const discard = async () => {
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
  };

  return (
    <View style={styles.card} testID="card-resume-workout">
      <View style={styles.textCol}>
        <ThemedText style={styles.title}>{t("plans.resume.title")}</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
          {t("plans.resume.subtitle", {
            name,
            duration: formatElapsed(t, draft.workoutStartedAt),
          })}
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t("activeWorkout.setsProgress", { done, total })}
        </ThemedText>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={resume}
          style={[styles.resumeBtn, { backgroundColor: theme.primary }]}
          accessibilityRole="button"
          testID="button-resume-workout"
        >
          <Feather name="play" size={14} color={theme.onChalk} />
          <ThemedText style={[styles.resumeText, { color: theme.onChalk }]}>
            {t("plans.resume.continue")}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => void discard()}
          hitSlop={8}
          accessibilityRole="button"
          testID="button-discard-workout"
        >
          <ThemedText style={[styles.discardText, { color: theme.textSecondary }]}>
            {t("plans.resume.discard")}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      borderRadius: BorderRadius.lg,
      borderWidth: 1.5,
      borderColor: c.primary,
      backgroundColor: c.ironElevated2,
    },
    textCol: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
    },
    subtitle: {
      fontSize: 13,
    },
    actions: {
      alignItems: "center",
      gap: Spacing.sm,
    },
    resumeBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
    },
    resumeText: {
      fontSize: 14,
      fontWeight: "700",
    },
    discardText: {
      fontSize: 13,
      fontWeight: "600",
    },
  });
