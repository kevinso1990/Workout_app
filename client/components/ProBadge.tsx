import React from "react";
import { View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/context/SubscriptionContext";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/subscriptionConfig";

interface ProBadgeProps {
  feature: string;
  compact?: boolean;
}

/**
 * Shown on Pro-gated features when subscriptions are disabled (coming soon),
 * or as a lock hint when subscriptions are enabled but the user is not Pro.
 */
export function ProBadge({ feature, compact = false }: ProBadgeProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { isEnabled, isPro } = useSubscription();

  if (isEnabled && isPro) return null;
  if (isEnabled && !isPro) {
    return (
      <View
        style={[
          styles.badge,
          compact ? styles.badgeCompact : null,
          {
            backgroundColor: Colors.light.primary + "12",
            borderColor: Colors.light.primary + "35",
          },
        ]}
      >
        <Feather name="lock" size={compact ? 12 : 14} color={Colors.light.primary} />
        <ThemedText style={[styles.text, { color: theme.textSecondary }]}>
          {t("subscription.proFeature", { feature })}
        </ThemedText>
      </View>
    );
  }

  if (SUBSCRIPTIONS_ENABLED) return null;

  return (
    <View
      style={[
        styles.badge,
        compact ? styles.badgeCompact : null,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.border,
        },
      ]}
    >
      <Feather name="clock" size={compact ? 12 : 14} color={theme.textSecondary} />
      <ThemedText style={[styles.text, { color: theme.textSecondary }]}>
        {t("subscription.comingSoon", { feature })}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginVertical: Spacing.sm,
  },
  badgeCompact: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default ProBadge;
