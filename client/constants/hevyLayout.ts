import { StyleSheet } from "react-native";

/**
 * Spatial + colour system for the workout surfaces, retuned to the
 * "Chalk & Iron" identity. Iron is structure, chalk is ink; every value here
 * feeds the shared workout components (set rows, plan detail, start screen),
 * so this file is the single lever that darkens all of them at once.
 */
export const HEVY = {
  textPrimary: "#ECE9E1", // chalk
  textSecondary: "#9BA09A", // chalk dim
  textMuted: "#686D69", // chalk faint
  surface: "#212427", // iron, elevated card
  canvas: "#191B1D", // iron ground (recessed vs. surface)
  hairline: "rgba(236,233,225,0.08)",
  separator: "rgba(236,233,225,0.12)",
  pad: 16,
  padLg: 24,
  radiusCard: 14,
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
