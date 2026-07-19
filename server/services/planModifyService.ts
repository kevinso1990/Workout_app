import Anthropic from "@anthropic-ai/sdk";
import db from "../db";
import { AppError } from "../middleware/errorHandler";
import { matchExerciseToCatalog } from "./importExerciseMatchService";
import { geminiGenerateContent } from "./geminiGenerate";
import {
  PLAN_MODIFY_PROMPT,
  PLAN_MODIFY_RESPONSE_SCHEMA,
} from "./aiGenerator";
import { formatAiServiceError } from "../lib/formatAiServiceError";

export type ClientPlanDay = {
  dayName: string;
  exercises: Array<{
    name: string;
    sets: number;
    reps: string | number;
    muscleGroup?: string;
    notes?: string | null;
  }>;
};

export type ClientPlanPayload = {
  name: string;
  days: ClientPlanDay[];
};

export type ModifyPlanResult = {
  planName: string;
  days: Array<{
    dayName: string;
    exercises: Array<{
      name: string;
      sets: number;
      reps: string;
      muscleGroup: string;
      notes: string | null;
      catalogExerciseId: number | null;
    }>;
  }>;
  summary: string;
  changes: string[];
};

function loadCatalogLines(): string {
  const rows = db
    .prepare(
      "SELECT id, name, muscle_group FROM exercises WHERE is_custom = 0 ORDER BY name ASC",
    )
    .all() as { id: number; name: string; muscle_group: string }[];
  return rows.map((r) => `${r.id}|${r.name}|${r.muscle_group}`).join("\n");
}

function extractJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Could not parse AI response");
    return JSON.parse(m[0]) as Record<string, unknown>;
  }
}

function normalizeModifiedPlan(raw: Record<string, unknown>): ModifyPlanResult {
  const planName =
    typeof raw.planName === "string" && raw.planName.trim()
      ? raw.planName.trim()
      : "Modified Plan";
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  const changes = Array.isArray(raw.changes)
    ? raw.changes.map((c) => String(c).trim()).filter(Boolean)
    : [];

  const daysRaw = raw.days;
  if (!Array.isArray(daysRaw) || daysRaw.length === 0) {
    throw new AppError(422, "AI returned no days");
  }

  const days: ModifyPlanResult["days"] = [];

  for (const day of daysRaw) {
    if (typeof day !== "object" || day === null) continue;
    const d = day as Record<string, unknown>;
    const dayName =
      typeof d.dayName === "string" && d.dayName.trim() ? d.dayName.trim() : "Day";
    const exercisesRaw = d.exercises;
    if (!Array.isArray(exercisesRaw)) continue;

    const exercises: ModifyPlanResult["days"][0]["exercises"] = [];
    for (const ex of exercisesRaw) {
      if (typeof ex !== "object" || ex === null) continue;
      const e = ex as Record<string, unknown>;
      const rawName = String(e.name ?? "").trim();
      if (!rawName) continue;

      const m = matchExerciseToCatalog(rawName);
      if (m.needsUserMapping || !m.catalogExerciseId) continue;

      const sets =
        typeof e.sets === "number"
          ? Math.min(10, Math.max(1, Math.floor(e.sets)))
          : parseInt(String(e.sets), 10) || 3;

      let reps = "10";
      if (typeof e.reps === "number" && Number.isFinite(e.reps)) {
        reps = String(Math.floor(e.reps));
      } else if (typeof e.reps === "string" && e.reps.trim()) {
        reps = e.reps.trim();
      }

      exercises.push({
        name: m.canonicalName,
        sets,
        reps,
        muscleGroup: m.muscleGroup,
        notes:
          e.notes !== null && e.notes !== undefined
            ? String(e.notes).trim() || null
            : null,
        catalogExerciseId: m.catalogExerciseId,
      });
    }

    if (exercises.length > 0) {
      days.push({ dayName, exercises });
    }
  }

  if (days.length === 0) {
    throw new AppError(422, "No valid exercises after catalog matching");
  }

  return { planName, days, summary, changes };
}

async function callClaudeModify(userContent: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: userContent }],
  });
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Empty Claude response");
  return textBlock.text;
}

async function callGeminiModify(userContent: string): Promise<string> {
  return geminiGenerateContent(
    [{ text: userContent }],
    {
      responseSchema: PLAN_MODIFY_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    },
  );
}

export async function modifyPlanWithAi(
  plan: ClientPlanPayload,
  instruction: string,
): Promise<ModifyPlanResult> {
  const wish = instruction.trim();
  if (wish.length < 4) throw new AppError(400, "instruction too short");
  if (wish.length > 2000) throw new AppError(400, "instruction too long");

  if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
    throw new AppError(500, "No AI provider configured");
  }

  const catalog = loadCatalogLines();
  const planJson = JSON.stringify(plan, null, 2);

  const userContent = `${PLAN_MODIFY_PROMPT}

EXERCISE CATALOG (id|name|muscle_group — use exact names only):
${catalog}

CURRENT PLAN:
${planJson}

USER REQUEST:
${wish}`;

  let rawText: string;
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        rawText = await callClaudeModify(userContent);
      } catch {
        if (!process.env.GEMINI_API_KEY) throw new Error("Claude failed and no Gemini fallback");
        rawText = await callGeminiModify(userContent);
      }
    } else {
      rawText = await callGeminiModify(userContent);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError(502, formatAiServiceError(msg));
  }

  console.log(`[plan-modify] AI raw response:\n${rawText.slice(0, 4000)}`);

  const parsed = extractJson(rawText);
  return normalizeModifiedPlan(parsed);
}
