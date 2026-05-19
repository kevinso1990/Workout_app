/**
 * Central AI instruction sets for plan extraction and auto-generation.
 * Imported by import routes and planService Gemini path.
 */

/**
 * Internet-RAG instructions: requires Gemini `google_search` grounding (see `gemini.ts`).
 * Used for workout import extraction.
 */
export const PLAN_GENERATOR_INTERNET_RAG_PROMPT = `You are an Elite Sports Scientist. Before generating or formatting any workout routine, execute a live web search query to retrieve evidence-based guidelines for bodyweight training and calisthenics sequencing from authoritative sources (e.g., ExRx.net, NSCA, sports medicine registries).

When a multi-day Full Body (Ganzkörper) bodyweight routine is requested:
1. LIVE RE-VALIDATION: Check professional split templates to ensure optimal recovery.
2. STRICT FULL BODY VARIATION: Every session must target the entire body, but the exercise selection MUST vary across days. For example, if Day A uses classic Push-Ups and Squats, Day B must search and implement alternative kinesiological patterns like Pike Push-Ups and Lunges, and Day C should utilize Wide-Grip Push-Ups and Bulgarian Split Squats. Never output identical exercise rows across different days.
3. DATA FIELDS: Ensure weights are strictly 0 or empty for bodyweight exercises. Populate the "notes" field with a highly detailed, step-by-step text guide on how to perform the movement safely (setup, execution, breathing, common errors).`;

export const IMPORT_WORKOUT_EXTRACTION_PROMPT = `${PLAN_GENERATOR_INTERNET_RAG_PROMPT}

You extract structured workout data from photos, PDFs, or spreadsheet text.

Goals:
1) Read ONLY what is visible. If text is illegible, blurry, or ambiguous, prefer null over guessing.
2) Merge multiple inputs into ONE plan with preserved day grouping.
3) For each exercise "name", output the clearest text you read (English or German). Do NOT invent exercises that are not on the page.
   The server will map names to the app's canonical exercise database (including closest matches for typos).

CRITICAL RULE — Multi-day splits:
- For multi-day workout plans (splits, 2-day, 3-day, full-body rotations), every single workout day MUST have a distinct, complementary selection of exercises.
- DO NOT duplicate the exact same routine across Day A, Day B, and Day C (or Day 1 / Day 2 / Day 3). Zero repeated exercise names across different days unless the source document explicitly shows the same exercise on two days.
- If the user requests a Multi-Day Full Body Split (e.g., Kettlebell Full Body 3-Day), rotate movement patterns variationally:
  • Day A: Posterior chain & overhead pressing emphasis (e.g., swings, clean & press, RDL patterns)
  • Day B: Anterior chain & horizontal pulling emphasis (e.g., goblet squat, rows, floor press)
  • Day C: Unilateral work, core & conditioning emphasis (e.g., lunges, Turkish get-up, snatch or carries)
- Each day must list different exercise names; vary compounds and accessories across days while covering the full body over the week.
- Ensure exercise names are specific (e.g., "Barbell Bench Press", "KB Goblet Squat") — never generic blocks like "upper body" or "legs circuit".

Return ONLY valid JSON. No markdown, no code fences, no commentary:
{
  "planName": "string",
  "days": [
    {
      "dayName": "string (e.g. 'Day 1', 'Push Day', 'Monday', 'Full Body A')",
      "exercises": [
        {
          "name": "string",
          "sets": number,
          "reps": number | null,
          "weight": number | null,
          "notes": "string | null — REQUIRED for bodyweight/calisthenics: step-by-step safety instructions (setup, execution, breathing, common errors); null only if not applicable"
        }
      ]
    }
  ]
}

Rules:
- If days are not labeled, use "Day 1", "Day 2", …
- If plan title is missing, use "Imported Plan".
- "sets" must be a positive integer when visible; otherwise use 3 as a conservative default ONLY if the row clearly represents a logged set block but the number is unreadable; if the whole exercise row is unreadable, omit that exercise (do not fabricate names).
- "reps" / "weight" use null when not visible.
- For bodyweight exercises, set "weight" to 0 or null — never invent external loads.
- Use "notes" for detailed coaching instructions when the source omits them but the movement is identifiable (especially calisthenics / Ganzkörper).
- If the entire page is unreadable or contains zero recognizable exercises, return {"planName":"Imported Plan","days":[]} exactly (empty days array).`;

/** Production-ready plan JSON emitted directly by Gemini (no server set/rep tables). */
export const PLAN_GENERATOR_FULL_JSON_PROMPT = `You are an Elite Sports Scientist and Master Calisthenics Coach. Generate a complete, highly optimized multi-day training plan based on the user's request.
You must skip any local hardcoded post-processing and return the final, production-ready JSON structure directly.

CRITICAL PROGRAMMING LAWS:
1. FULL BODY VARIATION: In a multi-day Full Body (Ganzkörper) split, every session must target the whole body, but exercise selection MUST vary across days to prevent stagnation and overuse (e.g., rotate push angles, squat variants, and pulling grips). Never duplicate identical exercise lists across days.
2. DYNAMIC INTENSITY (SETS & REPS): Do NOT use flat, uniform numbers for every movement. Intelligently scale sets and repetitions based on exercise mechanical advantage and the user's tier:
   - High-intensity compounds (e.g., Pull-Ups, Pike Push-Ups): Program lower reps with high intensity (e.g., 4 Sätze x 6-8 Reps).
   - Auxiliary/Stamina movements (e.g., regular Push-Ups, Lunges): Program medium/high volume (e.g., 3-4 Sätze x 12-15 Reps).
   - Core/Isolations (e.g., Planks, Dead Bugs): Program high reps (15-20) or hold times in seconds.
3. BODYWEIGHT ENFORCEMENT: For bodyweight-only tracks, "weight" fields must strictly be 0.
4. CLEAN COACHING TEXT: Populate the "instructions" field with crisp Setup, Execution, and Common Errors data. Strip all API tags, credits, or raw URLs.

EXPECTED JSON OUTPUT FORMAT:
{
  "planName": "String (e.g., 3-Day Ganzkörper Calisthenics — Hypertrophy)",
  "days": [
    {
      "dayName": "String (e.g., Full Body A)",
      "exercises": [
        {
          "name": "String",
          "sets": Number,
          "reps": Number,
          "weight": 0,
          "instructions": "String"
        }
      ]
    }
  ]
}`;

export type GeminiGeneratedExercise = {
  name: string;
  sets: number;
  reps: number;
  weight: number;
  instructions: string;
};

export type GeminiGeneratedDay = {
  dayName: string;
  exercises: GeminiGeneratedExercise[];
};

export type GeminiGeneratedPlan = {
  planName: string;
  days: GeminiGeneratedDay[];
};

const INSTRUCTION_NOISE_PATTERNS: RegExp[] = [
  /rapidapi/i,
  /exercisedb\.p\.rapidapi/i,
  /powered\s+by/i,
  /api\s*credit/i,
  /x-rapidapi-key/i,
];

/** Strip API attribution / URLs from coaching text before persistence or display. */
export function sanitizeCoachingInstructions(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (INSTRUCTION_NOISE_PATTERNS.some((re) => re.test(trimmed))) return "";
  if (/^https?:\/\/\S+$/i.test(trimmed)) return "";
  if (/\.(gif|jpe?g|png|webp)(\?|$)/i.test(trimmed)) return "";
  return trimmed;
}

function goalPhysiologyLabel(goal: string): string {
  switch (goal) {
    case "get_stronger":
    case "strength":
      return "Kraftaufbau (Strength)";
    case "lose_fat":
      return "Ausdauer / Fettabbau (Endurance)";
    case "build_muscle":
    case "muscle":
    default:
      return "Muskelaufbau (Hypertrophie)";
  }
}

export function buildGeminiAutoGeneratePrompt(params: {
  frequency: number;
  experience: string;
  goal: string;
  equipment: string;
  focusMuscles: string[];
  sessionLines: string;
  whitelistLines: string;
  sessionCount: number;
}): string {
  const { frequency, experience, goal, equipment, focusMuscles, sessionLines, whitelistLines, sessionCount } =
    params;

  const physiologyGoal = goalPhysiologyLabel(goal);

  return `${PLAN_GENERATOR_FULL_JSON_PROMPT}

User profile:
- days_per_week: ${frequency}
- experience: ${experience}
- goal_key: ${goal}
- goal_physiology: ${physiologyGoal}
- equipment_key: ${equipment}
- focus_muscles_UI: ${JSON.stringify(focusMuscles)}

You must output exactly ${sessionCount} day objects in this fixed order and with these day titles (use each dayName exactly as listed unless a clearer Ganzkörper label is provided):
${sessionLines}

Programming requirements:
- Each day must include 5–8 exercises in performance order (compounds first, then accessories/core).
- Exercise "name" values MUST be copied EXACTLY from the whitelist (spelling and capitalization).
- No exercise name may appear on more than one day in this plan.
- Assign individualized sets and reps per exercise — never copy the same sets×reps block to every movement.
- For equipment_key "bodyweight", every exercise "weight" must be 0.

Whitelist — use ONLY these exercise names:
${whitelistLines}

Return ONLY valid JSON matching the EXPECTED JSON OUTPUT FORMAT above. No markdown fences, no commentary.`;
}
