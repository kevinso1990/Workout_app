import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { saveWorkoutPlan, type WorkoutPlan } from "@/lib/storage";
import { scheduleDataSync } from "@/lib/dataSync";
import { MOBILITY_PLAN_ID } from "@/lib/mobilitySchedule";
import { syncMobilityReminders } from "@/lib/mobilityReminders";
import {
  findMobilityDayToSplit,
  splitMobilityDay,
  type MobilityDayCandidate,
} from "@/lib/mobilitySplit";
import { translateDayName } from "@/lib/dayNameLabel";
import { displayPlanName } from "@/lib/defaultPlanName";
import { MobilityDaysCard } from "@/components/workout/MobilityDaysCard";
import { toast } from "@/lib/toast";

const ANSWERED_KEY = "@mobilityDaySplitAnswered";

/**
 * Follow-up question after a plan comes in (import, AI, hand-built): a
 * mobility day buried in a strength plan can only be started by opening that
 * plan. Offer to make it the standalone Mobility-Session — startable on its
 * own, with its own weekdays and reminder — then ask which days.
 */
export function MobilityDayQuestion({
  plans,
  onChanged,
}: {
  plans: WorkoutPlan[];
  /** Plans were rewritten; reload them. */
  onChanged: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const [answered, setAnswered] = useState<Set<string> | null>(null);
  const [step, setStep] = useState<"ask" | "days">("ask");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(ANSWERED_KEY).then((raw) => {
      try {
        setAnswered(new Set(raw ? (JSON.parse(raw) as string[]) : []));
      } catch {
        setAnswered(new Set());
      }
    });
  }, []);

  const candidate: MobilityDayCandidate | null = useMemo(
    () => (answered ? findMobilityDayToSplit(plans, answered) : null),
    [plans, answered],
  );

  const remember = async (key: string) => {
    const next = new Set(answered ?? []);
    next.add(key);
    setAnswered(next);
    await AsyncStorage.setItem(ANSWERED_KEY, JSON.stringify([...next]));
  };

  if (step === "days") {
    return (
      <View style={styles.card} testID="card-mobility-split-days">
        {/* The days card brings its own heading; this line only confirms
            what just happened. */}
        <View style={styles.header}>
          <Feather name="check-circle" size={18} color={theme.text} />
          <ThemedText style={styles.confirm}>{t("plans.mobilitySplit.doneTitle")}</ThemedText>
        </View>
        <MobilityDaysCard style={styles.embeddedDays} />
        <Pressable
          onPress={() => setStep("ask")}
          style={[styles.btn, styles.btnPrimary, { backgroundColor: theme.primary }]}
          accessibilityRole="button"
          testID="button-mobility-split-finish"
        >
          <ThemedText style={[styles.btnText, { color: theme.onChalk }]}>
            {t("plans.mobilitySplit.finish")}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  if (!candidate) return null;

  const day = candidate.plan.days[candidate.dayIndex];
  const replacesExisting = plans.some((p) => p.id === MOBILITY_PLAN_ID);

  const split = async () => {
    if (busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { trainingPlan, mobilityPlan } = splitMobilityDay(
        candidate.plan,
        candidate.dayIndex,
        t("addWorkout.mobilitySession"),
      );
      await saveWorkoutPlan(mobilityPlan);
      await saveWorkoutPlan(trainingPlan);
      await remember(candidate.key);
      scheduleDataSync();
      void syncMobilityReminders();
      setStep("days");
      onChanged();
    } catch (err) {
      console.error("MobilityDayQuestion: split failed", err);
      toast.error(t("common.actionFailed"));
    } finally {
      setBusy(false);
    }
  };

  const keep = () => {
    Haptics.selectionAsync();
    void remember(candidate.key);
  };

  return (
    <View style={styles.card} testID="card-mobility-split">
      <View style={styles.header}>
        <View style={[styles.iconTile, { backgroundColor: theme.ironElevated3 }]}>
          <Feather name="wind" size={18} color={theme.text} />
        </View>
        <ThemedText style={styles.title}>{t("plans.mobilitySplit.title")}</ThemedText>
      </View>
      <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
        {t("plans.mobilitySplit.body", {
          day: translateDayName(t, day.dayName),
          plan: displayPlanName(t, candidate.plan.name),
        })}
        {replacesExisting ? ` ${t("plans.mobilitySplit.replaces")}` : ""}
      </ThemedText>
      <View style={styles.actions}>
        <Pressable
          onPress={keep}
          style={[styles.btn, { borderWidth: 1, borderColor: theme.controlOutline }]}
          accessibilityRole="button"
          testID="button-mobility-split-keep"
        >
          <ThemedText style={styles.btnText}>{t("plans.mobilitySplit.keep")}</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => void split()}
          disabled={busy}
          style={[styles.btn, styles.btnPrimary, { backgroundColor: theme.primary, opacity: busy ? 0.6 : 1 }]}
          accessibilityRole="button"
          testID="button-mobility-split-yes"
        >
          <ThemedText style={[styles.btnText, { color: theme.onChalk }]}>
            {t("plans.mobilitySplit.yes")}
          </ThemedText>
        </Pressable>
      </View>
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
      borderWidth: 1,
      borderColor: c.controlOutline,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    iconTile: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      flex: 1,
      fontSize: 17,
      fontWeight: "700",
    },
    confirm: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
    },
    actions: {
      flexDirection: "row",
      gap: Spacing.sm,
    },
    btn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.full,
    },
    btnPrimary: {
      borderWidth: 0,
    },
    btnText: {
      fontSize: 14,
      fontWeight: "700",
    },
    embeddedDays: {
      marginHorizontal: 0,
      marginTop: 0,
      padding: 0,
      borderWidth: 0,
      backgroundColor: "transparent",
    },
  });
