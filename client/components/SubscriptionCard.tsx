import React, { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/context/SubscriptionContext";
import { PRO_PRICE_DISPLAY } from "@/lib/subscriptionConfig";

export function SubscriptionCard() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const {
    isEnabled,
    isPro,
    isLoading,
    packagesLoading,
    purchasePro,
    restorePurchases,
  } = useSubscription();
  const [busy, setBusy] = useState<"purchase" | "restore" | null>(null);

  if (!isEnabled) return null;

  const handlePurchase = async () => {
    setBusy("purchase");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await purchasePro();
    setBusy(null);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("subscription.proActiveTitle"), t("subscription.proActiveBody"));
      return;
    }
    if (result.errorCode === "cancelled") return;
    Alert.alert(t("subscription.errorTitle"), result.error ?? t("subscription.errorGeneric"));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const handleRestore = async () => {
    setBusy("restore");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await restorePurchases();
    setBusy(null);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("subscription.restoreSuccessTitle"), t("subscription.restoreSuccessBody"));
      return;
    }
    Alert.alert(t("subscription.errorTitle"), result.error ?? t("subscription.restoreEmpty"));
  };

  const priceLabel =
    packagesLoading || isLoading
      ? PRO_PRICE_DISPLAY
      : PRO_PRICE_DISPLAY;

  return (
    <Animated.View
      entering={FadeInDown.delay(192).duration(400)}
      style={[styles.card, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: Colors.light.primary + "15" }]}>
          <Feather name="star" size={20} color={Colors.light.primary} />
        </View>
        <View style={styles.headerText}>
          <ThemedText style={styles.title}>{t("subscription.title")}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {isPro
              ? t("subscription.proActiveLabel")
              : t("subscription.subtitle", { price: priceLabel })}
          </ThemedText>
        </View>
      </View>

      {!isPro ? (
        <Pressable
          onPress={handlePurchase}
          disabled={busy != null}
          style={[styles.primaryBtn, { backgroundColor: Colors.light.primary }]}
          testID="button-subscribe-pro"
        >
          {busy === "purchase" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.primaryBtnText}>
              {t("subscription.subscribe")}
            </ThemedText>
          )}
        </Pressable>
      ) : null}

      <Pressable
        onPress={handleRestore}
        disabled={busy != null}
        style={[styles.restoreBtn, { borderColor: theme.border }]}
        testID="button-restore-purchases"
      >
        {busy === "restore" ? (
          <ActivityIndicator color={Colors.light.primary} />
        ) : (
          <ThemedText style={[styles.restoreText, { color: theme.textSecondary }]}>
            {t("subscription.restore")}
          </ThemedText>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  primaryBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  restoreBtn: {
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  restoreText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
