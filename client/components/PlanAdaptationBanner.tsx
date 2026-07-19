import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { WorkoutPlan } from "@/lib/storage";
import {
  buildPlanAdaptationSummary,
  snoozePlanAdaptation,
  type PerformanceSignal,
} from "@/lib/planAdaptation";
import { requestPlanAdaptation } from "@/lib/planAdaptApi";
import {
  applyModifyResultToPlan,
  type PlanModifyResponse,
} from "@/lib/planModifyApi";
import { getWorkoutHistory } from "@/lib/storage";
import { logPlanAdaptationOutcome } from "@/lib/planAdaptationOutcomeLog";

type Props = {
  plan: WorkoutPlan;
  signals: PerformanceSignal[];
  onApplied: (updated: WorkoutPlan) => void;
  onDismiss: () => void;
};

async function logOutcomesForSignals(
  signals: PerformanceSignal[],
  proposalSummary: string,
  userAction: "accept" | "dismiss" | "snooze",
): Promise<void> {
  for (const signal of signals) {
    await logPlanAdaptationOutcome({
      signal_type: signal.type,
      exercise_name: signal.exercise_name,
      sessions_analyzed: signal.sessions_analyzed,
      proposal_summary: proposalSummary,
      user_action: userAction,
    });
  }
}

export function PlanAdaptationBanner({ plan, signals, onApplied, onDismiss }: Props) {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PlanModifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdapt = async () => {
    setLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const history = await getWorkoutHistory();
      const summary = buildPlanAdaptationSummary(plan, history);
      const locale = i18n.language.startsWith("de") ? "de" : "en";
      const result = await requestPlanAdaptation(plan, summary, signals, locale);
      setPreview(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("planAdaptation.error"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!preview) return;
    const updated = applyModifyResultToPlan(plan, preview);
    await logOutcomesForSignals(signals, preview.summary ?? "", "accept");
    onApplied(updated);
    setPreview(null);
  };

  const handleDismissPreview = async () => {
    if (preview) {
      await logOutcomesForSignals(signals, preview.summary ?? "", "dismiss");
    }
    setPreview(null);
  };

  const handleSnooze = async () => {
    await logOutcomesForSignals(signals, "", "snooze");
    await snoozePlanAdaptation(14);
    onDismiss();
  };

  return (
    <>
      <View
        style={[
          styles.banner,
          {
            backgroundColor: Colors.light.primary + "12",
            borderColor: Colors.light.primary + "40",
          },
        ]}
      >
        <Feather name="cpu" size={20} color={Colors.light.primary} />
        <View style={styles.bannerText}>
          <ThemedText style={styles.bannerTitle}>
            {t("planAdaptation.title")}
          </ThemedText>
          <ThemedText style={[styles.bannerSub, { color: theme.textSecondary }]}>
            {t("planAdaptation.subtitle")}
          </ThemedText>
        </View>
        <Pressable
          onPress={handleAdapt}
          disabled={loading}
          style={[styles.cta, { backgroundColor: Colors.light.primary }]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <ThemedText style={styles.ctaText}>{t("planAdaptation.cta")}</ThemedText>
          )}
        </Pressable>
        <Pressable onPress={handleSnooze} hitSlop={8} style={styles.dismiss}>
          <Feather name="x" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      {error ? (
        <ThemedText style={[styles.error, { color: theme.textSecondary }]}>
          {error}
        </ThemedText>
      ) : null}

      <Modal visible={preview != null} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.backgroundRoot }]}>
            <ThemedText style={styles.modalTitle}>
              {t("planAdaptation.previewTitle")}
            </ThemedText>
            <ScrollView style={styles.modalScroll}>
              <ThemedText style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
                {preview?.summary}
              </ThemedText>
              {(preview?.changes ?? []).map((c, i) => (
                <ThemedText key={i} style={styles.changeLine}>
                  • {c}
                </ThemedText>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable onPress={handleDismissPreview} style={styles.modalBtn}>
                <ThemedText>{t("common.cancel")}</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleApply}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
              >
                <ThemedText style={styles.modalBtnPrimaryText}>
                  {t("planAdaptation.apply")}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  bannerText: { flex: 1 },
  bannerTitle: { fontWeight: "700", fontSize: 14 },
  bannerSub: { fontSize: 12, marginTop: 2 },
  cta: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    minWidth: 72,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  dismiss: { padding: 4 },
  error: { fontSize: 12, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: "75%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.md },
  modalScroll: { maxHeight: 280 },
  changeLine: { fontSize: 14, marginBottom: 6 },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalBtn: { padding: Spacing.md },
  modalBtnPrimary: {
    backgroundColor: Colors.light.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
  },
  modalBtnPrimaryText: { color: "#fff", fontWeight: "600" },
});
