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
  // The iron ramp has four steps; this file was only using the bottom two, so
  // card and ground sat ~5% apart and everything on the workout screen blurred
  // into one dark band. Card now takes a real step up from the ground, and
  // pressable surfaces get a step of their own above the card — a control that
  // borrows the page ground (as the +/- buttons did) cannot read as a control.
  surface: "#2A2E32", // iron elevated — card
  canvas: "#191B1D", // iron ground — page
  control: "#33383D", // iron elevated 2 — pressable surfaces on a card
  hairline: "rgba(236,233,225,0.10)",
  separator: "rgba(236,233,225,0.16)",
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
