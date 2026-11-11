import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";

export const PANEL_RADIUS = 20;

/**
 * The frame of a floating panel: one step lighter than the ground, a light
 * catch along the top edge and a soft shadow below. Spread it into an existing
 * card's style and put a <PanelFill /> first inside it.
 */
export function panelFrame(c: Palette, radius = PANEL_RADIUS): ViewStyle {
  return {
    backgroundColor: c.panelBottom,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    borderTopWidth: 1,
    borderTopColor: c.panelEdge,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  };
}

/**
 * The panel's gradient, as the first child of a panelFrame. `warm` tints the
 * top-left toward the signal colour — for the one panel that is about "now".
 */
export function PanelFill({ warm = false, radius = PANEL_RADIUS }: { warm?: boolean; radius?: number }) {
  const { theme } = useTheme();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={warm ? [theme.panelWarm, theme.panelTop, theme.panelBottom] : [theme.panelTop, theme.panelBottom]}
      locations={warm ? [0, 0.55, 1] : [0, 1]}
      start={{ x: 0, y: 0 }}
      end={warm ? { x: 1, y: 1 } : { x: 0, y: 1 }}
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
    />
  );
}

/** A section floating on the page — panelFrame + PanelFill in one. */
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
    <View testID={testID} style={[panelFrame(theme), padded && styles.padded, style]}>
      <PanelFill warm={warm} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  padded: {
    padding: Spacing.lg,
  },
});
