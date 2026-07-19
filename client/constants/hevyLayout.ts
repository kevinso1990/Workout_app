import { StyleSheet } from "react-native";

/** Hevy-inspired spatial system (2026 routine detail density). */
export const HEVY = {
  textPrimary: "#121212",
  textSecondary: "#6B6B6B",
  textMuted: "#8E8E93",
  surface: "#FFFFFF",
  canvas: "#F5F5F7",
  hairline: "rgba(0,0,0,0.06)",
  separator: "#E5E5EA",
  pad: 16,
  padLg: 24,
  radiusCard: 12,
} as const;

/** Fixed header block — clears notch / Dynamic Island (no absolute positioning). */
export function hevyHeaderInsets(topInset: number) {
  return {
    paddingTop: topInset + 24,
    paddingBottom: 16,
    paddingHorizontal: HEVY.pad,
  } as const;
}

export const hevyHairline = {
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: HEVY.hairline,
};
