import React from "react";
import { View, StyleSheet } from "react-native";

import { ADMOB_WORKOUT_BANNER_ENABLED } from "@/lib/admobConfig";

/**
 * P1 AdMob banner slot — renders nothing until EXPO_PUBLIC_ADMOB_ENABLED=true
 * and react-native-google-mobile-ads is integrated.
 */
export function WorkoutBannerAd() {
  if (!ADMOB_WORKOUT_BANNER_ENABLED) return null;

  return (
    <View
      style={styles.placeholder}
      accessibilityLabel="Advertisement"
      testID="admob-workout-banner-placeholder"
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    height: 50,
    width: "100%",
    backgroundColor: "transparent",
  },
});
