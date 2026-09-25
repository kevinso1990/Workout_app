import React, { useMemo, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { useTheme } from "@/hooks/useTheme";
import {
  acceptPendingRefinement,
  clearPendingRefinement,
  type PendingRefinement,
} from "@/lib/planRefinement";

type Props = {
  pending: PendingRefinement;
  onResolved: () => void;
};

/**
 * Offers an AI refinement that was NOT applied automatically.
 *
 * A refinement only lands unasked on a plan nobody has touched. Once the user
 * has edited the plan or trained with it, silently swapping it out would throw
 * away their work — so it becomes this, an offer they can decline. That is also
 * why the banner names the plan: the change is not abstract, it replaces
 * something specific they already own.
 */
export function PlanRefinementBanner({ pending, onResolved }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    await acceptPendingRefinement();
    onResolved();
  };

  const dismiss = async () => {
    if (busy) return;
    setBusy(true);
    await clearPendingRefinement();
    onResolved();
  };

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: theme.primary + "10", borderColor: theme.primary + "35" },
      ]}
    >
      <View style={styles.row}>
        <Feather name="zap" size={18} color={theme.primary} />
        <ThemedText style={[styles.text, { color: theme.text }]}>
          {t("plans.refinementOffer", { planName: pending.planName })}
        </ThemedText>
        <Pressable onPress={dismiss} hitSlop={10} accessibilityLabel={t("common.dismiss")}>
          <Feather name="x" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={dismiss}
          disabled={busy}
          style={[styles.secondaryBtn, { borderColor: theme.border }]}
          testID="button-refinement-keep"
        >
          <ThemedText style={[styles.secondaryLabel, { color: theme.textSecondary }]}>
            {t("plans.refinementKeep")}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={accept}
          disabled={busy}
          style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
          testID="button-refinement-accept"
        >
          <ThemedText style={[styles.primaryLabel, { color: theme.onChalk }]}>
            {t("plans.refinementApply")}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  banner: {
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
  },
  secondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  secondaryLabel: { fontSize: 13, fontWeight: "600" },
  primaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  primaryLabel: { fontSize: 13, fontWeight: "700" },
});
