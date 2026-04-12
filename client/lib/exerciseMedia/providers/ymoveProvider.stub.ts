/**
 * YMove provider stub — placeholder for future licensed media integration.
 *
 * Hook-in checklist when YMove is ready:
 *   1. Install the YMove SDK / configure API credentials in .env
 *   2. Replace the stub body below with real YMove SDK calls
 *   3. Set EXPO_PUBLIC_MEDIA_PROVIDER=ymove in your .env file
 *   4. No UI code requires any changes — the abstraction handles it
 *
 * The provider must implement getMedia() synchronously (or cache eagerly)
 * because the detail modal opens immediately on tap.
 */

import { ExerciseMedia, ExerciseMediaProvider } from "../types";

export class YMoveProvider implements ExerciseMediaProvider {
  readonly providerName = "ymove";

  getMedia(_exerciseName: string): ExerciseMedia {
    // TODO: call YMove API / SDK here, e.g.:
    //   const data = ymoveClient.getExercise(exerciseName);
    //   return { imageUrl: data.thumbnailUrl, cues: data.cues, category: data.category };
    throw new Error(
      "YMove provider is not yet integrated. Set EXPO_PUBLIC_MEDIA_PROVIDER=static or implement the YMove SDK."
    );
  }
}
