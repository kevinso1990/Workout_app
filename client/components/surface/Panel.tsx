import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

/**
 * A section floating on the page: one step lighter than the ground, a light
 * catch along the top edge and a soft shadow below. `warm` tints the top-left
 * toward the signal colour — for the one panel that is about "now".
 */
export function Panel({
  children,
  warm = false,
  padded = true,
  style,
  testID,
}: {
  children: React.ReactNode;
  warm?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { theme } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.panel,
        { backgroundColor: theme.panelBottom, borderColor: theme.hairline, borderTopColor: theme.panelEdge },
        padded && styles.padded,
        style,
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={warm ? [theme.panelWarm, theme.panelTop, theme.panelBottom] : [theme.panelTop, theme.panelBottom]}
        locations={warm ? [0, 0.55, 1] : [0, 1]}
        start={{ x: 0, y: 0 }}
        end={warm ? { x: 1, y: 1 } : { x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.fill]}
      />
      {children}
    </View>
  );
}

const RADIUS = 20;

const styles = StyleSheet.create({
  panel: {
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  fill: {
    borderRadius: RADIUS,
  },
  padded: {
    padding: Spacing.lg,
  },
});
