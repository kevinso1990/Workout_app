/**
 * Active provider singleton.
 *
 * All app code should import getExerciseMedia() from here — never
 * instantiate a provider directly.
 */

import { ExerciseMediaProvider } from "./types";
import { StaticExerciseProvider } from "./providers/staticProvider";
import { ACTIVE_MEDIA_PROVIDER } from "./config";

let _provider: ExerciseMediaProvider | null = null;

export function getExerciseMediaProvider(): ExerciseMediaProvider {
  if (_provider) return _provider;

  if (ACTIVE_MEDIA_PROVIDER === "ymove") {
    // Lazy-require so the YMove SDK is never bundled when unused
    const { YMoveProvider } = require("./providers/ymoveProvider.stub");
    _provider = new YMoveProvider() as ExerciseMediaProvider;
  } else {
    _provider = new StaticExerciseProvider();
  }

  return _provider;
}

/** Convenience shorthand used by UI components */
export function getExerciseMedia(exerciseName: string) {
  return getExerciseMediaProvider().getMedia(exerciseName);
}
