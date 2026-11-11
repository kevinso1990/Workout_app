import React from "react";
import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";

/** The page ground: graphite, lighter at the top and falling away below. */
export function ScreenGradient() {
  const { theme } = useTheme();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[theme.groundTop, theme.groundBottom]}
      locations={[0, 0.7]}
      style={StyleSheet.absoluteFill}
    />
  );
}
