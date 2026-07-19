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
import type { SplitRefreshOffer } from "@/lib/splitRefreshEvaluation";
import { snoozeSplitRefreshLocal } from "@/lib/splitRefreshSnooze";
import { snoozeSplitRefreshOnServer } from "@/lib/splitRefreshApi";
import {
  requestPlanModify,
  applyModifyResultToPlan,
  type PlanModifyResponse,
} from "@/lib/planModifyApi";

type Props = {
  offer: SplitRefreshOffer;
  onApplied: (updated: WorkoutPlan) => void;
  onDismiss: () => void;
};

function buildSplitReviewInstruction(offer: SplitRefreshOffer): string {
  const mismatchNote = offer.hasPatternMismatch
    ? `Detected pattern mismatch: ${offer.patternSummary}.`
    : `Athlete has followed this plan for ${offer.weeksOnPlan} weeks.`;
  return `Review my training split for better alignment with how I actually train.

Plan: ${offer.planName}
${mismatchNote}

Suggest specific changes to day structure, exercise selection, or weekly frequency so the split matches my real session patterns. Keep the same training goal. Only propose changes supported by the pattern data above. Explain each change in the changes array.`;
}

export function SplitRefreshBanner({ offer, onApplied, onDismiss }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PlanModifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReview = async () => {
    setLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await requestPlanModify(
        offer.plan,
        buildSplitReviewInstruction(offer),
      );
      setPreview(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("plans.splitRefresh.error"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!preview) return;
    const updated = applyModifyResultToPlan(offer.plan, preview);
    onApplied(updated);
    setPreview(null);
  };

  const handleSnooze = async () => {
    await snoozeSplitRefreshLocal();
    snoozeSplitRefreshOnServer().catch(() => {});
    onDismiss();
  };

  return (
    <>
      <View
        style={[
          styles.banner,
          {
            backgroundColor: Colors.light.primary + "10",
            borderColor: Colors.light.primary + "35",
          },
        ]}
      >
        <Feather name="refresh-cw" size={20} color={Colors.light.primary} />
        <View style={styles.bannerText}>
          <ThemedText style={styles.bannerTitle}>
            {t("plans.splitRefresh.title")}
          </ThemedText>
          <ThemedText style={[styles.bannerSub, { color: theme.textSecondary }]}>
            {offer.hasPatternMismatch
              ? t("plans.splitRefresh.subtitleMismatch", {
                  pattern: offer.patternSummary,
                })
              : t("plans.splitRefresh.subtitleWeeks", {
                  plan: offer.planName,
                  weeks: offer.weeksOnPlan,
                })}
          </ThemedText>
        </View>
        <Pressable
          onPress={handleReview}
          disabled={loading}
          style={[styles.cta, { backgroundColor: Colors.light.primary }]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <ThemedText style={styles.ctaText}>
              {t("plans.splitRefresh.review")}
            </ThemedText>
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
              {t("plans.splitRefresh.previewTitle")}
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
              <Pressable onPress={() => setPreview(null)} style={styles.modalBtn}>
                <ThemedText>{t("common.cancel")}</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleApply}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
              >
                <ThemedText style={styles.modalBtnPrimaryText}>
                  {t("plans.splitRefresh.apply")}
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
