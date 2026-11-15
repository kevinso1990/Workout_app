import { describe, expect, it } from "vitest";

import instructionsEn from "@/lib/exerciseMedia/data/freeExerciseDbInstructions.json";
import instructionsDe from "@/lib/exerciseMedia/data/freeExerciseDbInstructionsDe.json";
import cuesDe from "@/lib/exerciseMedia/data/exerciseCuesDe.json";

const en = instructionsEn as Record<string, string[]>;
const de = instructionsDe as Record<string, string[]>;

describe("German exercise instructions", () => {
  it("cover every exercise the English set has", () => {
    const missing = Object.keys(en).filter((k) => !de[k]?.length);
    expect(missing).toEqual([]);
  });

  it("never have more steps than the original", () => {
    const longer = Object.keys(en).filter((k) => de[k].length > en[k].length);
    expect(longer).toEqual([]);
  });

  it("drop the bare 'repeat for the recommended reps' step", () => {
    const filler = Object.values(de)
      .flat()
      .filter((s) => /^Wiederhole (das|die Bewegung)( für die (geplanten|vorgegebenen|empfohlenen)( Anzahl an)? Wiederholungen)?\.$/.test(s));
    expect(filler).toEqual([]);
  });

  it("translate every hand-written cue", () => {
    const untranslated = Object.entries(cuesDe as Record<string, string>).filter(
      ([english, german]) => !german || german === english,
    );
    expect(untranslated).toEqual([]);
  });
});
