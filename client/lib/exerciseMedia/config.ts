/**
 * Provider selection.
 *
 * Set EXPO_PUBLIC_MEDIA_PROVIDER=ymove before a build to activate YMove.
 * Default is "static" (local images + hardcoded cues).
 */

export type MediaProviderName = "static" | "ymove";

export const ACTIVE_MEDIA_PROVIDER: MediaProviderName =
  (process.env.EXPO_PUBLIC_MEDIA_PROVIDER as MediaProviderName | undefined) ??
  "static";
