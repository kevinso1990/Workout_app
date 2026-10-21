import { Platform } from "react-native";

/** Guaranteed clearance below notch / Dynamic Island for full-screen headers. */
export function notchSafeTopPadding(safeAreaInsetTop: number): number {
  return Math.max(safeAreaInsetTop, 20) + 8;
}

/** Extra push so title rows never collide with hardware chrome (stack headers only). */
export const HEADER_SAFE_MARGIN_TOP = 8;

/**
 * Styles for onboarding / full-screen top content.
 * Keeps titles fully below the notch without excessive empty space.
 */
export function screenHeaderSafeAreaStyle(safeAreaInsetTop: number) {
  return {
    paddingTop: notchSafeTopPadding(safeAreaInsetTop),
  } as const;
}

/**
 * `paddingTop` for scroll content under a transparent navigation header.
 * Includes notch/Dynamic Island buffer so titles are not clipped on iOS.
 */
export function paddingTopUnderHeader(
  headerHeight: number,
  safeAreaInsetTop: number,
  spacing: number,
): number {
  // useHeaderHeight() already includes the status bar / Dynamic Island, so
  // adding the safe-area inset on top of it left a ~60pt empty band under
  // every tab header. Only fall back to inset + bar when there is no header.
  if (headerHeight > 0) return headerHeight + spacing;
  const safeTop = notchSafeTopPadding(safeAreaInsetTop);
  const navBar = Platform.OS === "ios" ? 44 : 56;
  return navBar + safeTop + spacing;
}
