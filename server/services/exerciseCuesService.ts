/**
 * Coaching cues for exercises the app has none for — mostly names from
 * imported or AI-built plans ("KB Shin Box Rotation → Press") that match
 * nothing in free-exercise-db. Gemini writes them once per name and
 * language; every later request, from any user, is a database read.
 */
import db from "../db";
import { geminiGenerateContent } from "./gemini";

export type CueLanguage = "de" | "en";

const SCHEMA = {
  type: "object",
  properties: {
    known: { type: "boolean" },
    cues: { type: "array", items: { type: "string" } },
  },
  required: ["known", "cues"],
};

export function cueKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function storedCues(name: string, language: CueLanguage): string[] | null {
  const row = db
    .prepare("SELECT cues FROM exercise_cues WHERE name_key = ? AND lang = ?")
    .get(cueKey(name), language) as { cues: string } | undefined;
  return row ? (JSON.parse(row.cues) as string[]) : null;
}

function prompt(name: string, muscleGroup: string | undefined, language: CueLanguage): string {
  const muscle = muscleGroup ? ` (target: ${muscleGroup})` : "";
  return language === "de"
    ? `Übung aus einem Trainingsplan: "${name}"${muscle}.
Schreib 4–5 kurze Ausführungs-Hinweise für diese Übung in natürlichem Gym-Deutsch, Du-Form im Imperativ, je ein Satz: Ausgangsposition, Bewegung, worauf achten.
Abkürzungen: KB = Kettlebell, KH = Kurzhantel, LH = Langhantel, SL = einbeinig, Iso Hold = isometrisch halten.
Wenn du die Übung nicht sicher erkennst, antworte mit known=false und leerer Liste – nichts erfinden.`
    : `Exercise from a training plan: "${name}"${muscle}.
Write 4–5 short coaching cues for it in plain gym English, imperative, one sentence each: setup, movement, what to watch.
Abbreviations: KB = kettlebell, KH = dumbbell, LH = barbell, SL = single-leg, Iso Hold = hold isometrically.
If you don't recognise the exercise with confidence, answer known=false with an empty list — don't make anything up.`;
}

export async function exerciseCues(
  name: string,
  muscleGroup: string | undefined,
  language: CueLanguage,
): Promise<string[]> {
  const stored = storedCues(name, language);
  if (stored) return stored;

  const raw = await geminiGenerateContent([{ text: prompt(name, muscleGroup, language) }], {
    responseSchema: SCHEMA,
    thinking: false,
  });
  const parsed = JSON.parse(raw) as { known?: boolean; cues?: unknown };
  const cues =
    parsed.known && Array.isArray(parsed.cues)
      ? parsed.cues
          .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
          .map((c) => c.trim())
          .slice(0, 6)
      : [];
  // An unknown exercise is remembered too, so it isn't asked again.
  db.prepare(
    "INSERT OR REPLACE INTO exercise_cues (name_key, lang, cues) VALUES (?, ?, ?)",
  ).run(cueKey(name), language, JSON.stringify(cues));
  return cues;
}
