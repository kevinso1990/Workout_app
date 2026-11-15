import type { ExerciseVariant, ExerciseVariantTag } from "@/lib/storage";

type TFunction = (key: string, opts?: Record<string, unknown>) => string;

/** Additions first (they change the load), then swapped equipment. */
export const VARIANT_TAGS: ExerciseVariantTag[] = [
  "vest",
  "band",
  "elevated",
  "kettlebell",
  "dumbbell",
  "barbell",
  "trapBar",
  "cable",
  "machine",
];

export function hasVariant(variant: ExerciseVariant | undefined): variant is ExerciseVariant {
  return !!variant && (variant.tags.length > 0 || !!variant.note?.trim());
}

/** "Gewichtsweste · Band · mit Pause unten" */
export function variantSummary(t: TFunction, variant: ExerciseVariant | undefined): string {
  if (!hasVariant(variant)) return "";
  const parts = variant.tags.map((tag) => t(`activeWorkout.variant.tags.${tag}`));
  if (variant.note?.trim()) parts.push(variant.note.trim());
  return parts.join(" · ");
}
