import React from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

const LOGO_SOURCE = require("@/assets/brand/logo_main.png");

export type BrandLogoProps = {
  /** Max height in dp (Hevy header: 36–40). */
  height?: number;
  /** Center within parent (default true for nav headers). */
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Professional brand mark — clipboard + barbell lockup.
 * Use on #F5F5F7 / white backgrounds; `contain` avoids pixelation.
 */
export function BrandLogo({
  height = 38,
  centered = true,
  style,
  accessibilityLabel = "Track Your Lift",
  testID = "brand-logo",
}: BrandLogoProps) {
  const width = Math.round(height * 3.4);

  return (
    <View
      style={[styles.wrap, centered && styles.centered, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Image
        source={LOGO_SOURCE}
        style={{ width, height, maxHeight: height }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: "center",
  },
  centered: {
    alignSelf: "center",
    alignItems: "center",
  },
});
