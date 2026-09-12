/**
 * Audit for German exercise names.
 *
 * The German catalog was generated straight into the database and never
 * reviewed, which let two classes of defect through unnoticed:
 *
 *  1. Names that state the WRONG equipment — "Kurzhantel Pullover" for an
 *     exercise whose equipment is barbell. Not imprecision: it tells the
 *     athlete to pick up the wrong thing.
 *  2. Names that say only "Hantel". German uses that for both Kurzhantel
 *     (dumbbell) and Langhantel (barbell), so in a lifting app it is exactly
 *     the word that carries no information — "Hanteldrücken" could be flat
 *     barbell bench press or a dumbbell press.
 *
 * Both are decidable from data we already have: the exercise's own equipment
 * column. Keeping the rule here as a pure function means it can be unit tested
 * and re-run over the catalog instead of relying on someone re-reading 1076
 * rows by hand.
 */

export type TranslationIssue =
  | { kind: "wrong-equipment"; says: "kurzhantel" | "langhantel" }
  | { kind: "ambiguous-hantel" };

const saysKurzhantel = (de: string) => /kurzhantel|\bkh\b/i.test(de);
const saysLanghantel = (de: string) => /langhantel|\blh\b/i.test(de);
const mentionsHantel = (de: string) => /hantel/i.test(de);

/**
 * Equipment values that cannot legitimately carry a bar or dumbbell in their
 * name. "machine" is deliberately NOT in this list: a Smith machine guides an
 * actual barbell, so "Smith-Maschine Langhantelrudern" is correct.
 */
const FREE_WEIGHT_FREE = new Set(["cable", "body only", "bands", "medicine ball"]);

/** Returns the defect in a German name, or null when it is consistent. */
export function auditGermanExerciseName(
  germanName: string,
  equipment: string | null | undefined,
): TranslationIssue | null {
  const de = (germanName ?? "").trim();
  const eq = (equipment ?? "").trim().toLowerCase();
  if (!de) return null;

  if (eq === "barbell") {
    if (saysKurzhantel(de) && !saysLanghantel(de)) {
      return { kind: "wrong-equipment", says: "kurzhantel" };
    }
    return null;
  }

  if (eq === "dumbbell") {
    if (saysLanghantel(de) && !saysKurzhantel(de)) {
      return { kind: "wrong-equipment", says: "langhantel" };
    }
    // "Hantel" alone, with no Kurz-/Lang- qualifier, is the ambiguous case.
    if (mentionsHantel(de) && !saysKurzhantel(de)) {
      return { kind: "ambiguous-hantel" };
    }
    return null;
  }

  if (FREE_WEIGHT_FREE.has(eq)) {
    if (saysKurzhantel(de)) return { kind: "wrong-equipment", says: "kurzhantel" };
    if (saysLanghantel(de)) return { kind: "wrong-equipment", says: "langhantel" };
  }

  return null;
}
