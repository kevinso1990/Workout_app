/**
 * Guards the AI "goal from free text" feature.
 *
 * The free-text goal (e.g. "improve hip mobility") must reach the Gemini
 * auto-generate prompt AND carry the mobility-unlocking instructions, otherwise
 * the model would keep filtering stretches out and never serve a mobility goal.
 */
import { describe, it, expect } from "vitest";
import { buildGeminiAutoGeneratePrompt } from "../services/aiGenerator";

const baseParams = {
  frequency: 3,
  experience: "intermediate",
  goal: "build_muscle",
  equipment: "barbell",
  focusMuscles: [] as string[],
  sessionLines: "1. Full Body A\n2. Full Body B\n3. Full Body C",
  whitelistLines: "Barbell Bench Press\nStanding Hip Flexors\nHamstring Stretch",
  sessionCount: 3,
};

describe("buildGeminiAutoGeneratePrompt — free-text goal", () => {
  it("injects the free-text goal as highest priority when goalText is set", () => {
    const prompt = buildGeminiAutoGeneratePrompt({
      ...baseParams,
      goalText: "improve hip mobility",
    });
    expect(prompt).toContain("PRIMARY USER GOAL");
    expect(prompt).toContain("improve hip mobility");
    // Mobility goals must be allowed to program timed holds via the reps field.
    expect(prompt.toLowerCase()).toContain("seconds");
    expect(prompt.toLowerCase()).toContain("mobility");
  });

  it("omits the free-text goal block for the structured onboarding path", () => {
    const prompt = buildGeminiAutoGeneratePrompt(baseParams);
    expect(prompt).not.toContain("PRIMARY USER GOAL");
  });

  it("neutralizes double quotes in the goal text so the prompt stays clean", () => {
    const prompt = buildGeminiAutoGeneratePrompt({
      ...baseParams,
      goalText: 'loosen my "tight" hips',
    });
    expect(prompt).toContain("PRIMARY USER GOAL");
    expect(prompt).not.toContain('"tight"');
    expect(prompt).toContain("'tight'");
  });
});
