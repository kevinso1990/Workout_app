import React, { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";

import { BorderRadius, Colors, Spacing } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { useTheme } from "@/hooks/useTheme";

type SolidActionButtonProps = {
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Primary CTA — flat fill, no gradients (Hevy industrial standard). */
export function SolidActionButton({
  onPress,
  disabled,
  children,
  style,
  testID,
}: SolidActionButtonProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: disabled
            ? theme.border
            : theme.primary,
          opacity: pressed && !disabled ? 0.92 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function SolidActionButtonText({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.text, style]}>{children}</Text>;
}

const makeStyles = (c: Palette) => StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  text: {
    color: c.onChalk,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
});
