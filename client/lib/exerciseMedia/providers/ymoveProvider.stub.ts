/**
 * YMove provider stub — placeholder for future licensed media integration.
 *
 * ── Integration checklist (when YMove license is active) ───────────────────
 *   1. Install the YMove SDK:
 *        npm install @ymove/react-native-sdk   (check exact package name with YMove)
 *
 *   2. Configure credentials in .env (and expose via app.config.js extra if needed):
 *        YMOVE_API_KEY=your_api_key_here
 *        EXPO_PUBLIC_MEDIA_PROVIDER=ymove
 *
 *   3. Replace the `getMedia()` stub body below with the real SDK call:
 *        const client = new YMoveClient({ apiKey: process.env.YMOVE_API_KEY });
 *        const data   = client.getExercise(exerciseName);           // must be sync or pre-cached
 *        return { imageUrl: data.thumbnailUrl, cues: data.cues, category: data.category };
 *
 *   4. No UI code requires any changes — the abstraction is the single integration point.
 *
 * ── What stays the same ────────────────────────────────────────────────────
 *   - ExerciseDetailModal opens immediately on tap (sync contract must be honoured)
 *   - The static provider keeps working whenever YMOVE_API_KEY is absent
 *   - If the SDK throws at runtime the provider falls back transparently (see provider.ts)
 *
 * ── What is still missing to fully enable YMove ───────────────────────────
 *   - YMove SDK package installed
 *   - YMOVE_API_KEY added to .env / EAS secrets
 *   - The TODO body below replaced with real SDK call + response mapping
 */

import { ExerciseMedia, ExerciseMediaProvider } from "../types";
import { StaticExerciseProvider } from "./staticProvider";

// Module-level fallback instance — used while YMove is not yet integrated.
// Provides correct data for all exercises so the app never crashes when
// EXPO_PUBLIC_MEDIA_PROVIDER=ymove is set during testing.
const _staticFallback = new StaticExerciseProvider();

export class YMoveProvider implements ExerciseMediaProvider {
  readonly providerName = "ymove";

  getMedia(exerciseName: string): ExerciseMedia {
    // ── TODO: replace this block with the real YMove SDK call ─────────────
    //
    //   import YMoveClient from "@ymove/react-native-sdk";
    //   const client = new YMoveClient({ apiKey: process.env.YMOVE_API_KEY });
    //   const data   = client.getExercise(exerciseName);
    //   return {
    //     imageUrl: data.thumbnailUrl ?? null,
    //     cues:     data.formCues ?? [],
    //     category: data.category ?? "Compound",
    //   };
    //
    // ──────────────────────────────────────────────────────────────────────

    if (__DEV__) {
      console.warn(
        `[YMoveProvider] SDK not yet integrated — using static fallback for "${exerciseName}". ` +
          "See providers/ymoveProvider.stub.ts for the integration TODO."
      );
    }

    // Graceful fallback: delegate to static provider so the app runs normally
    // without crashing. Remove this line once the real SDK call is in place.
    return _staticFallback.getMedia(exerciseName);
  }
}
