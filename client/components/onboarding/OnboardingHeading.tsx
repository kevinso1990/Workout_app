import React, { useMemo } from "react";
import { Colors } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

type OnboardingHeadingProps = {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
  centered?: boolean;
};

/** Onboarding titles — native SF / Roboto, no custom font family. */
export function OnboardingHeading({
  title,
  subtitle,
  style,
  centered = false,
}: OnboardingHeadingProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={[styles.wrap, centered && styles.wrapCentered, style]}>
      <Text style={[styles.title, centered && styles.titleCentered]}>{title}</Text>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            centered && styles.subtitleCentered,
            { color: theme.textSecondary },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  wrap: {
    marginBottom: Spacing.xl,
  },
  wrapCentered: {
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: c.chalk,
    letterSpacing: -0.5,
    lineHeight: 30,
    paddingTop: 16,
    marginBottom: Spacing.sm,
  },
  titleCentered: {
    textAlign: "center",
    paddingTop: 0,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400",
  },
  subtitleCentered: {
    textAlign: "center",
  },
});
