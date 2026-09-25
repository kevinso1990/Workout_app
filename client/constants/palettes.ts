/**
 * The two colour palettes, kept free of any React Native import.
 *
 * theme.ts pulls in Platform/StyleSheet, which a plain unit test cannot parse.
 * Palette values are the part worth asserting on — that the two themes really
 * differ, and that text on a primary surface is never the primary colour —
 * so they live here where they can be imported on their own.
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
const hairline = "rgba(236,233,225,0.10)";
const hairlineStrong = "rgba(236,233,225,0.16)";
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
export const plateLight = "#2FA35F"; // green  — warm-up / isolation
export const plateMedium = "#E8B10E"; // yellow — working sets
export const plateHeavy = "#CB3A2C"; // red    — top set / PR zone
export const plateInfo = "#2E77BE"; // blue   — informational links / neutral accent

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


// ── Light palette ────────────────────────────────────────────────────────────
//
// Chalk & Iron inverted, not a different design: paper is the ground, iron is
// the ink, and the primary action flips from chalk-filled-with-iron-text to
// iron-filled-with-paper-text. The plate colours do NOT change — they encode
// load intensity, which is a property of the weight, not of the theme.
//
// The token NAMES stay dark-flavoured ("chalk", "onChalk") because 600+ call
// sites use them. Read them semantically: `chalk` is the ink, `onChalk` is
// what sits on a primary-filled surface.
const paper = "#F4F2ED"; // ground
const paperRaised = "#FFFFFF"; // card
const paperRaised2 = "#EFEDE7";
const paperRaised3 = "#E6E3DC";

const inkStrong = "#191B1D";
const inkDim = "#5C615E";
const inkFaint = "#8A8F8B";

const hairlineLight = "rgba(25,27,29,0.10)";
const hairlineStrongLight = "rgba(25,27,29,0.18)";
const controlOutlineLight = "rgba(25,27,29,0.38)";

const lightPalette = {
  text: inkStrong,
  textSecondary: inkDim,
  buttonText: paper,
  tabIconDefault: inkFaint,
  tabIconSelected: inkStrong,
  link: plateInfo,
  primary: inkStrong,
  setCompleteAccent: inkStrong,
  backgroundRoot: paper,
  backgroundDefault: paperRaised,
  backgroundSecondary: paperRaised2,
  backgroundTertiary: paperRaised3,
  border: hairlineStrongLight,
  controlOutline: controlOutlineLight,
  success: plateLight,
  error: plateHeavy,

  iron: paper,
  ironElevated: paperRaised,
  ironElevated2: paperRaised2,
  ironElevated3: paperRaised3,
  chalk: inkStrong,
  chalkDim: inkDim,
  chalkFaint: inkFaint,
  onChalk: paper,
  hairline: hairlineLight,
  hairlineStrong: hairlineStrongLight,
  plateLight,
  plateMedium,
  plateHeavy,
  plateInfo,
};

/**
 * `light` is deliberately still the DARK palette.
 *
 * 484 call sites write `Colors.light.x` meaning "the app's colour", not "the
 * light theme's colour" — the app has only ever had one palette. Pointing this
 * at lightPalette would flip half the app to light instantly, mid-refactor,
 * with no screen actually converted. Screens move to useTheme() one at a time;
 * this alias is what keeps the unconverted ones working until they do.
 */
export const Colors = {
  light: palette,
  dark: palette,
};

/** The real two palettes. useTheme() resolves between these. */
export const Palettes = {
  dark: palette,
  light: lightPalette,
};

/** Either palette. Stylesheet factories take this. */
export type Palette = typeof Palettes.dark;
