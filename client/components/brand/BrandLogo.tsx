import React, { useMemo } from "react";
import { Text, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { FontFamily } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { useTheme } from "@/hooks/useTheme";

export type BrandLogoProps = {
  /** Max height in dp — drives the wordmark's cap height. */
  height?: number;
  /** Center within parent (default true for nav headers). */
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Brand wordmark — "Chalk & Iron" logotype, a condensed Oswald lockup.
 *
 * The colour follows the theme rather than being fixed to chalk. Chalk is
 * near-white, so a hard-coded wordmark washed out to near-invisible against the
 * light palette's paper ground — the app's own name was the least legible thing
 * on the screen.
 */
export function BrandLogo({
  height = 38,
  centered = true,
  style,
  accessibilityLabel = "Track Your Lift",
  testID = "brand-logo",
}: BrandLogoProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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

export type BrandMarkProps = {
  /** Edge length in dp. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Compact square brand mark — the wordmark condensed to a monogram for slots
 * that need a square logo rather than a lockup (profile header, empty states).
 *
 * Built from tokens only, so it stays on-system and needs no raster asset:
 * matte iron surface, hairline edge, chalk monogram in the display face. The
 * profile header previously used a peach / orange-red running-figure PNG, which
 * broke two rules at once — plate colours are reserved for load intensity, and
 * a running motif reads as cardio in a strength app.
 */
export function BrandMark({
  size = 64,
  style,
  accessibilityLabel = "Track Your Lift",
  testID = "brand-mark",
}: BrandMarkProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const fontSize = Math.round(size * 0.34);
  return (
    <View
      style={[
        styles.markBox,
        { width: size, height: size, borderRadius: Math.round(size * 0.22) },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Text
        allowFontScaling={false}
        style={[
          styles.markMonogram,
          {
            fontSize,
            letterSpacing: fontSize * 0.04,
            lineHeight: Math.round(fontSize * 1.2),
          },
        ]}
      >
        T<Text style={styles.dim}>Y</Text>L
      </Text>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  wrap: {
    justifyContent: "center",
    width: "100%",
  },
  markBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.ironElevated2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairlineStrong,
  },
  markMonogram: {
    fontFamily: FontFamily.display,
    color: c.chalk,
    textTransform: "uppercase",
  },
  centered: {
    alignItems: "center",
  },
  mark: {
    fontFamily: FontFamily.display,
    color: c.chalk,
    textTransform: "uppercase",
  },
  markCentered: {
    width: "100%",
    textAlign: "center",
  },
  dim: {
    fontFamily: FontFamily.display,
    color: c.chalkDim,
  },
});
