import React from "react";
import { Text, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Colors, FontFamily } from "@/constants/theme";

export type BrandLogoProps = {
  /** Max height in dp — drives the wordmark's cap height. */
  height?: number;
  /** Center within parent (default true for nav headers). */
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

const C = Colors.dark;

/**
 * Brand wordmark — "Chalk & Iron" logotype. A condensed Oswald lockup in chalk
 * that reads as intentional on the dark iron ground (the old clipboard PNG was
 * built for light backgrounds and floated like a placeholder icon on dark).
 */
export function BrandLogo({
  height = 38,
  centered = true,
  style,
  accessibilityLabel = "Track Your Lift",
  testID = "brand-logo",
}: BrandLogoProps) {
  // Cap height ≈ 0.66 of the box; Oswald is tall so this fills the slot well.
  // At small (header) sizes this always fits on one line. At large hero sizes
  // (onboarding uses height=140 → ~92pt) "TRACKYOURLIFT" is wider than any
  // phone screen and used to hard-truncate to "TRACK…". adjustsFontSizeToFit
  // shrinks it to whatever width it's actually given instead of clipping.
  const fontSize = Math.round(height * 0.66);

  return (
    <View
      style={[styles.wrap, centered && styles.centered, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.3}
        style={[
          styles.mark,
          centered && styles.markCentered,
          { fontSize, letterSpacing: fontSize * 0.03, lineHeight: Math.round(fontSize * 1.3) },
        ]}
      >
        TRACK<Text style={styles.dim}>YOUR</Text>LIFT
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: "center",
    width: "100%",
  },
  centered: {
    alignItems: "center",
  },
  mark: {
    fontFamily: FontFamily.display,
    color: C.chalk,
    textTransform: "uppercase",
  },
  markCentered: {
    width: "100%",
    textAlign: "center",
  },
  dim: {
    fontFamily: FontFamily.display,
    color: C.chalkDim,
  },
});
