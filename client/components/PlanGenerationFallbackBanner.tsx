import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { dismissPlanGenerationFallbackNotice } from "@/lib/planGenerationFallback";

type Props = {
  onDismiss: () => void;
};

export function PlanGenerationFallbackBanner({ onDismiss }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const handleDismiss = async () => {
    await dismissPlanGenerationFallbackNotice();
    onDismiss();
  };

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: Colors.light.primary + "10",
          borderColor: Colors.light.primary + "35",
        },
      ]}
    >
      <Feather name="info" size={18} color={Colors.light.primary} />
      <ThemedText style={[styles.text, { color: theme.text }]}>
        {t("planGeneration.fallbackBanner")}
      </ThemedText>
      <Pressable onPress={handleDismiss} hitSlop={10} accessibilityLabel={t("common.dismiss")}>
        <Feather name="x" size={18} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
