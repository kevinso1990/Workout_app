import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ADMOB_REWARDED_IMPORT_ENABLED } from "@/lib/admobConfig";
import { grantBonusImportCredit } from "@/lib/importCredits";
import { Spacing, BorderRadius } from "@/constants/theme";

type Props = {
  onGranted?: (totalBonus: number) => void;
};

/**
 * Rewarded video hook for +1 Gemini PDF import.
 * Stub: grants credit immediately until AdMob SDK shows a real rewarded ad.
 */
export function RewardedImportAdButton({ onGranted }: Props) {
  const [busy, setBusy] = useState(false);

  const onPress = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // TODO: show RewardedAd from react-native-google-mobile-ads
      const total = await grantBonusImportCredit();
      onGranted?.(total);
    } finally {
      setBusy(false);
    }
  }, [busy, onGranted]);

  if (!ADMOB_REWARDED_IMPORT_ENABLED) return null;

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={styles.btn}
      testID="button-rewarded-import-ad"
      accessibilityRole="button"
      accessibilityLabel="Watch ad for extra PDF import"
    >
      <ThemedText style={styles.label}>
        {busy ? "Loading…" : "Watch 30s video → +1 PDF import"}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
});
