import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";

import { BorderRadius, Colors, Spacing } from "@/constants/theme";

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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: disabled
            ? Colors.light.border
            : Colors.light.primary,
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
  return <Text style={[styles.text, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
});
