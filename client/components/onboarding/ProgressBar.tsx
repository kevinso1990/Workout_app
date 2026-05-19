import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";

interface ProgressBarProps {
  step: number;
  total: number;
  style?: StyleProp<ViewStyle>;
  /** Compact brand mark above progress (onboarding steps). */
  showBrand?: boolean;
}

export function ProgressBar({ step, total, style, showBrand = false }: ProgressBarProps) {
  const { theme } = useTheme();
  return (
    <View style={style}>
      {showBrand ? (
        <View style={styles.brandRow}>
          <BrandLogo height={36} centered />
        </View>
      ) : null}
      <View style={styles.progressContainer}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          testID={`progress-dot-${index}`}
          accessibilityValue={{ text: index < step ? "active" : "inactive" }}
          aria-valuetext={index < step ? "active" : "inactive"}
          style={[
            styles.progressDot,
            {
              backgroundColor:
                index < step ? Colors.light.primary : theme.border,
            },
          ]}
        />
      ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  progressDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});
