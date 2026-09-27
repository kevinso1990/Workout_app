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
// Elevation in light mode does NOT mirror the dark ramp.
//
// In dark, every step away from the ground adds light: 0x19 -> 0x21 -> 0x2A ->
// 0x33, an even staircase. Translating that literally fails, because the light
// ground is already bright and elevation cannot keep adding light past white.
// The first attempt did exactly that and produced a zigzag: the page sat at
// 244, one card token jumped to 255 and the other fell to 239 — BELOW the page.
// So cards rendered white on some screens and darker-than-background on others,
// depending on which token the screen happened to use, and the whole theme read
// as muddy beige-on-beige.
//
// The invariant that actually carries over is contrast against the PARENT
// surface, not the direction of travel. So: the page is clearly grey, cards
// take the white, and a control drawn on a card defines itself by stepping back
// toward the ground — the way a key is defined against the face of a keyboard.
//
// The steps are also wider than the dark ramp's. Near-white surfaces compress
// perceptually, so a difference that reads clearly at 0x19 vanishes at 0xF4.
// One more thing the dark palette hides: `ironElevated2` carries TWO roles.
// It is the card surface (HEVY.surface) and it is `backgroundSecondary`, which
// every screen uses for inset controls — text inputs, filter chips, search
// fields, placeholders. In dark a single step lighter serves both, so nothing
// gives. In light the two roles pull apart: a card has to reach white, while a
// control drawn on that card has to step down to be visible at all. Pointing
// both at one value is what produced cards of three different shades on one
// screen, and a close button that vanished into the sheet behind it.
//
// So light splits them. Every card role resolves to `card`, every inset role to
// `inset`, and the two can no longer disagree.
const paper = "#E6E2DB"; // ground — page. Deliberately grey so white cards lift off it.
const card = "#FFFFFF"; // every card surface, whichever token a screen reaches for
const inset = "#EFECE5"; // a control ON a card: input, chip, stepper, icon button
const insetDeep = "#E1DDD5"; // a control inside an inset, or a pressed state

const inkStrong = "#17191B";
const inkDim = "#52575A";
const inkFaint = "#797E80";

// Heavier than the dark hairlines on purpose: an outline at 0.10 disappeared
// against near-white fills, leaving cards with no edge at all once the fills
// themselves were only a few units apart.
const hairlineLight = "rgba(23,25,27,0.12)";
const hairlineStrongLight = "rgba(23,25,27,0.22)";
const controlOutlineLight = "rgba(23,25,27,0.42)";

// What sits on a primary-filled (near-black) surface. The grey ground was being
// reused here, which put a dull grey on black instead of a clean highlight.
const onInk = "#FBFAF8";

const lightPalette = {
  text: inkStrong,
  textSecondary: inkDim,
  buttonText: onInk,
  tabIconDefault: inkFaint,
  tabIconSelected: inkStrong,
  link: plateInfo,
  primary: inkStrong,
  setCompleteAccent: inkStrong,
  backgroundRoot: paper,
  backgroundDefault: card,
  backgroundSecondary: inset,
  backgroundTertiary: insetDeep,
  border: hairlineStrongLight,
  controlOutline: controlOutlineLight,
  success: plateLight,
  error: plateHeavy,

  iron: paper,
  ironElevated: card,
  ironElevated2: card,
  ironElevated3: inset,
  chalk: inkStrong,
  chalkDim: inkDim,
  chalkFaint: inkFaint,
  onChalk: onInk,
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
