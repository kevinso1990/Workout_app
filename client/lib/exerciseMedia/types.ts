/**
 * Exercise media provider abstraction.
 *
 * All UI code imports from this module — never directly from a provider.
 * To swap providers (e.g. activate YMove), change ACTIVE_MEDIA_PROVIDER in
 * config.ts; no UI changes required.
 */

export interface ExerciseMedia {
  /** URL for a representative still image; null → render the fallback card */
  imageUrl: string | null;
  /** Short form-cue bullets shown in the detail modal */
  cues: string[];
  /** "Compound" | "Isolation" | "Cardio" — shown as a tag */
  category: string;
}

export interface ExerciseMediaProvider {
  /** Human-readable identifier used in logs */
  readonly providerName: string;

  /**
   * Return media metadata for the given exercise name.
   * Must never throw — return a safe default when the exercise is unknown.
   */
  getMedia(exerciseName: string): ExerciseMedia;
}
