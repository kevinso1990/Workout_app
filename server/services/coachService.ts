import Anthropic from "@anthropic-ai/sdk";
import type { Part } from "@google/generative-ai";
import db from "../db";
import { geminiGenerateContent } from "./geminiGenerate";
import { matchExerciseToCatalog } from "./importExerciseMatchService";
import {
  modifyPlanWithAi,
  type ClientPlanPayload,
  type ModifyPlanResult,
} from "./planModifyService";

export interface PerformanceSignalPayload {
  type: string;
  exercise_name?: string;
  sessions_analyzed: number;
  summary: string;
}

export {
  analyzeVolumePerformance,
  computeAdaptiveProgression,
  didUserOverrideSuggestion,
  parseTargetRepsPerSet,
  previousWorkingWeightKg,
  type AdaptiveProgressionInput,
  type AdaptiveProgressionResult,
  type LoggedSetSnapshot,
  type ProgressionContextKey,
  type VolumePerformanceAnalysis,
} from "../../shared/coachProgression";

function extractFirstJsonObject(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON object in model response");
  return JSON.parse(jsonMatch[0]) as unknown;
}

async function callCoachText(prompt: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });
      const block = message.content.find((b) => b.type === "text");
      if (block?.type === "text") return block.text;
    } catch (e) {
      console.warn("[coach] Claude failed:", (e as Error).message);
    }
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("No AI provider configured (ANTHROPIC_API_KEY or GEMINI_API_KEY required)");
  }
  const parts: Part[] = [{ text: prompt }];
  return geminiGenerateContent(parts);
}

function rowForCanonicalName(name: string): {
  id: number;
  name: string;
  muscle_group: string;
  equipment: string;
} | undefined {
  return db
    .prepare(
      "SELECT id, name, muscle_group, equipment FROM exercises WHERE name = ? COLLATE NOCASE LIMIT 1",
    )
    .get(name) as
    | {
        id: number;
        name: string;
        muscle_group: string;
        equipment: string;
      }
    | undefined;
}

export type CatalogExerciseRow = {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
};

/**
 * LLM suggests three swap candidates; each name is mapped onto the SQLite catalog.
 */
export async function suggestSmartSubstitutions(input: {
  exerciseName: string;
  muscleGroup: string;
  historyText: string;
}): Promise<CatalogExerciseRow[]> {
  const prompt = `You are a strength-training coach. The athlete wants to swap their current exercise for a good alternative.

Current exercise: "${input.exerciseName}"
Primary muscle / group label from the app: "${input.muscleGroup}"

Recent performance log for this movement (may be empty):
${input.historyText || "(no prior logged sessions for this name)"}

Task:
- Propose exactly 3 alternative exercises that target the SAME primary movement pattern and overlapping muscle emphasis (e.g. back squat → leg press or Bulgarian split squat; barbell bench → dumbbell bench or machine chest press).
- Prefer common gym equipment (barbell, dumbbell, machine, cable, bodyweight).
- Names must be realistic English exercise titles as used in commercial gyms.

Return ONLY valid JSON, no markdown fences:
{"alternatives":["Name 1","Name 2","Name 3"]}`;

  const raw = await callCoachText(prompt);
  const parsed = extractFirstJsonObject(raw) as { alternatives?: unknown };
  const rawAlts = Array.isArray(parsed.alternatives) ? parsed.alternatives : [];
  const names = rawAlts
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean)
    .slice(0, 8);

  const out: CatalogExerciseRow[] = [];
  const seen = new Set<string>();
  const currentLower = input.exerciseName.trim().toLowerCase();

  for (const n of names) {
    const m = matchExerciseToCatalog(n);
    if (m.needsUserMapping) continue;
    const row = rowForCanonicalName(m.canonicalName);
    if (!row) continue;
    if (row.name.toLowerCase() === currentLower) continue;
    const key = row.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: String(row.id),
      name: row.name,
      muscle_group: row.muscle_group,
      equipment: row.equipment ?? "",
    });
    if (out.length >= 3) break;
  }

  return out;
}

/**
 * One-sentence briefing for the home / plans screen (language driven by locale).
 */
export async function generateDailyBriefing(input: {
  locale: "de" | "en";
  planSummary: string;
  sessionSummary: string;
}): Promise<string> {
  const lang = input.locale === "de" ? "German" : "English";
  const prompt = `You are a concise gym coach for a tracking app.

Write exactly ONE short sentence (max 220 characters) in ${lang}.

Context:
${input.planSummary}

Recent training summary (may be empty):
${input.sessionSummary || "(no recent sessions)"}

Rules:
- Mention today’s focus if inferable (e.g. pull / push / legs) OR the next logical session.
- If the user was strong on a lift last week, encourage a small progression there.
- No markdown, no quotes, no bullet points — plain sentence only.`;

  const raw = (await callCoachText(prompt)).trim();
  const oneLine = raw.replace(/\s+/g, " ").slice(0, 280);
  return oneLine || (input.locale === "de" ? "Bereit für dein Training — bleib konsistent." : "Ready to train — stay consistent.");
}

/**
 * Closed-loop adaptation: rewrites a plan using logged performance summary.
 */
export async function adaptPlanFromPerformance(input: {
  plan: ClientPlanPayload;
  performanceSummary: string;
  performanceSignals?: PerformanceSignalPayload[];
  locale?: "de" | "en";
}): Promise<ModifyPlanResult> {
  const lang = input.locale === "de" ? "German" : "English";
  const signalBlock =
    input.performanceSignals && input.performanceSignals.length > 0
      ? `Detected performance signals: ${input.performanceSignals
          .map((s) => {
            const label = s.exercise_name
              ? `${s.type} on ${s.exercise_name}`
              : s.type;
            return `[${label} — ${s.summary}]`;
          })
          .join(", ")}. Adapt the plan to address these specific signals. Every proposed change must reference a detected signal. Do not make changes to exercises with no signal.`
      : "";

  const instruction = `Adapt this training plan based on the athlete's REAL logged performance (not theory).

${signalBlock}

Performance log:
${input.performanceSummary.slice(0, 7500)}

Adaptation rules:
- Only modify exercises that have a detected performance signal above
- Every entry in the changes array must cite which signal it addresses
- Progress loads/reps on UNDERLOAD signals where green feedback is consistent
- Hold or reduce volume on OVERREACH or PLATEAU signals
- Address MISSED_SESSIONS by simplifying schedule adherence, not random exercise swaps
- Swap only when a signal explicitly supports it; never substitute exercises without signal data
- Preserve the same split and number of training days
- Preserve exercise order where possible
- Write the summary field in ${lang} (1-2 sentences for the athlete)

Return valid JSON matching the required schema only.`;

  return modifyPlanWithAi(input.plan, instruction);
}
