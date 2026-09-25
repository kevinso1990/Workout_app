import { Platform } from "react-native";

/**
 * TrackYourLift — "Chalk & Iron" design language.
 *
 * Iron is structure (ground, cards, frame). Chalk is ink AND the primary
 * action (the primary button is chalk-filled, not a coloured CTA). The
 * competition-plate colours (green → yellow → red) are reserved to encode
 * LOAD intensity and nothing else. No glow: depth comes from material —
 * hairlines, matte surfaces, knurl texture.
 *
 * This is a committed dark identity, so `light` and `dark` intentionally
 * resolve to the same Chalk & Iron palette. Every one of the ~47 screens
 * reads its colours from here via useTheme(), so restyling happens centrally.
 */

// Iron — structural greys, warm-neutral (a hint of green-grey, not pure).
const iron = "#191B1D";
const ironElevated = "#212427";
const ironElevated2 = "#2A2E32";
const ironElevated3 = "#33383D";

// Chalk — warm off-white ink, and the colour of the primary action.
const chalk = "#ECE9E1";
const chalkDim = "#9BA09A";
const chalkFaint = "#686D69";
const onChalk = "#191B1D"; // iron text sitting on a chalk-filled surface

// Hairlines — chalk at low alpha over iron.
const hairline = "rgba(236,233,225,0.09)";
const hairlineStrong = "rgba(236,233,225,0.17)";
/**
 * Outline for interactive controls (secondary buttons, pickers).
 *
 * Divider weight and button weight are not the same job: at 0.17 a secondary
 * button drawn transparent on the near-black ground did not read as a control
 * at all — it looked like grey text floating on the page. Dividers keep the
 * quieter value; anything you can press uses this.
 */
const controlOutline = "rgba(236,233,225,0.38)";

// Plate colours — LOAD intensity only. Do not use for decoration.
const plateLight = "#2FA35F"; // green  — warm-up / isolation
const plateMedium = "#E8B10E"; // yellow — working sets
const plateHeavy = "#CB3A2C"; // red    — top set / PR zone
const plateInfo = "#2E77BE"; // blue   — informational links / neutral accent

/** The primary action colour is chalk itself. */
const primaryColor = chalk;
/** Completed-set indicator fills with chalk (was a bright orange tick). */
export const setCompleteAccent = chalk;

const palette = {
  text: chalk,
  textSecondary: chalkDim,
  buttonText: onChalk,
  tabIconDefault: chalkFaint,
  tabIconSelected: chalk,
  link: plateInfo,
  primary: primaryColor,
  setCompleteAccent,
  backgroundRoot: iron,
  backgroundDefault: ironElevated,
  backgroundSecondary: ironElevated2,
  backgroundTertiary: ironElevated3,
  border: hairlineStrong,
  controlOutline,
  success: plateLight,
  error: plateHeavy,

  // --- Chalk & Iron additions (new semantic tokens) ---
  iron,
  ironElevated,
  ironElevated2,
  ironElevated3,
  chalk,
  chalkDim,
  chalkFaint,
  onChalk,
  hairline,
  hairlineStrong,
  plateLight,
  plateMedium,
  plateHeavy,
  plateInfo,
};

export const Colors = {
  light: palette,
  dark: palette,
};

/** Maps a load tier to its plate colour. Use for spines, dots, tier chips. */
export type LoadTier = "light" | "medium" | "heavy";
export function plateColor(tier: LoadTier): string {
  return tier === "heavy"
    ? plateHeavy
    : tier === "medium"
      ? plateMedium
      : plateLight;
}

/**
 * Classifies a working weight into a load tier relative to the exercise's
 * best known top set, so the UI can colour it. Falls back to a coarse
 * absolute scale when no reference is available.
 */
export function loadTier(weightKg: number, referenceTopKg?: number): LoadTier {
  if (referenceTopKg && referenceTopKg > 0) {
    const r = weightKg / referenceTopKg;
    if (r >= 0.85) return "heavy";
    if (r >= 0.6) return "medium";
    return "light";
  }
  if (weightKg >= 60) return "heavy";
  if (weightKg >= 25) return "medium";
  return "light";
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
  "5xl": 56,
  inputHeight: 48,
  buttonHeight: 52,
};

/** Real radius ramp — cards get generous corners, controls stay tighter. */
export const BorderRadius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  "2xl": 16,
  "3xl": 18,
  full: 999,
};

const OSWALD_BOLD = "Oswald_700Bold";
const OSWALD_SEMI = "Oswald_600SemiBold";
const OSWALD_MED = "Oswald_500Medium";
const ARCHIVO = "Archivo_400Regular";
const ARCHIVO_MED = "Archivo_500Medium";
const ARCHIVO_SEMI = "Archivo_600SemiBold";
const MONO_MED = "IBMPlexMono_500Medium";

/**
 * Oswald (condensed, uppercase) for titles — stamped-on-iron feel.
 * Archivo for body. IBM Plex Mono for numeric values.
 */
export const Typography = {
  display: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "700" as const,
    fontFamily: OSWALD_BOLD,
    letterSpacing: 0.4,
    textTransform: "uppercase" as const,
  },
  h1: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "700" as const,
    fontFamily: OSWALD_BOLD,
    letterSpacing: 0.4,
    textTransform: "uppercase" as const,
  },
  h2: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "600" as const,
    fontFamily: OSWALD_SEMI,
    letterSpacing: 0.3,
    textTransform: "uppercase" as const,
  },
  h3: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600" as const,
    fontFamily: OSWALD_SEMI,
    letterSpacing: 0.2,
  },
  h4: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
    fontFamily: OSWALD_MED,
    letterSpacing: 0.2,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400" as const,
    fontFamily: ARCHIVO,
  },
  small: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
    fontFamily: ARCHIVO,
  },
  link: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500" as const,
    fontFamily: ARCHIVO_MED,
  },
  /** Uppercase tracked micro-label — eyebrows, column heads. */
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600" as const,
    fontFamily: OSWALD_SEMI,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
  },
  /** Monospace numeric readout — weights, reps, timers. */
  numeric: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "500" as const,
    fontFamily: MONO_MED,
  },
} as const;

/** Named font families for ad-hoc use in component styles. */
export const FontFamily = {
  display: OSWALD_BOLD,
  displaySemi: OSWALD_SEMI,
  displayMed: OSWALD_MED,
  body: ARCHIVO,
  bodyMed: ARCHIVO_MED,
  bodySemi: ARCHIVO_SEMI,
  mono: MONO_MED,
};

export const Fonts = Platform.select({
  ios: {
    sans: "Archivo_400Regular",
    serif: "ui-serif",
    rounded: "Oswald_600SemiBold",
    mono: "IBMPlexMono_500Medium",
  },
  default: {
    sans: "Archivo_400Regular",
    serif: "serif",
    rounded: "Oswald_600SemiBold",
    mono: "IBMPlexMono_500Medium",
  },
  web: {
    sans: "Archivo, system-ui, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "Oswald, system-ui, sans-serif",
    mono: "'IBM Plex Mono', SFMono-Regular, Menlo, monospace",
  },
});
