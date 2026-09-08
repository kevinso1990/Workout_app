/**
 * Central AI instruction sets for plan extraction and auto-generation.
 */

/** Strict import prompt — NO internet RAG, NO warm-up/cardio/meta sections. */
export const IMPORT_WORKOUT_EXTRACTION_PROMPT = `You are a strength-training plan extractor. Output ONLY structured JSON for KRAFT/STRENGTH workout days.

STRICT FILTERING — IGNORE COMPLETELY (do not parse, do not output):
- Introductions, week schedules ("Bei 2x/Woche: Mo + Do Kraft"), training frequency notes
- Warm-up / Aufwärmen / Activation sections
- Physio rules, general coaching text, disclaimers, tables of rules
- Bürotage, office days, recovery-only days
- Cardio, Mobility, Stretching, Yoga, Pilates, conditioning-only blocks
- Page headers, footers, page numbers, copyright

ONLY PARSE sections explicitly titled like:
- "GK A", "GK B", "GK C" (Ganzkörper A/B/C)
- "Tag 1", "Tag 2", "Tag A", "Day A", "Day B", "Workout A", "Training A"
- Similar labeled STRENGTH day blocks with a list of resistance exercises (sets × reps)

EXERCISE RULES:
- Include ONLY real resistance/strength exercises (barbell, dumbbell, kettlebell, machine, bodyweight strength moves).
- Each exercise MUST have a recognizable exercise name (e.g. "Trap Bar Deadlift", "Kettlebell Swing", "Reverse Lunges").
- If a line is NOT a clear strength exercise (schedule text, section title, note, rule), OMIT it entirely — never guess.
- Use exact exercise names as written in the document. Do not invent exercises.
- sets: positive integer (default 3 only if sets column is missing but exercise row is clearly a working set).
- reps: integer or null if not visible.
- weight: number or null.

MULTI-DAY:
- Preserve day grouping (GK A, GK B, GK C as separate days).
- Do NOT duplicate identical exercise lists across days unless the source explicitly repeats them.
- Do NOT merge warm-up or cardio exercises into strength days.

OUTPUT FORMAT — VALID JSON IS MANDATORY:
- If a source exercise name contains a double-quote character (e.g. an alt-name in quotes like Hip "Getup"), you MUST escape it as \\" inside the JSON string, or rewrite the name without the quote marks. Never emit a raw, unescaped " inside a JSON string value.
- Output must be a single valid JSON object parseable by a strict JSON parser — no trailing commas, no comments.

If zero strength exercises found in allowed sections, return: {"planName":"Imported Plan","days":[]}`;

/** JSON schema for Gemini structured output (import). */
export const IMPORT_WORKOUT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    planName: { type: "string" },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dayName: { type: "string" },
          exercises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                sets: { type: "integer" },
                reps: { type: "integer", nullable: true },
                weight: { type: "number", nullable: true },
                notes: { type: "string", nullable: true },
              },
              required: ["name", "sets"],
            },
          },
        },
        required: ["dayName", "exercises"],
      },
    },
  },
  required: ["planName", "days"],
} as const;

/**
 * Internet-RAG instructions for plan generation (NOT import).
 */
export const PLAN_GENERATOR_INTERNET_RAG_PROMPT = `You are an Elite Sports Scientist. Before generating or formatting any workout routine, execute a live web search query to retrieve evidence-based guidelines for bodyweight training and calisthenics sequencing from authoritative sources (e.g., ExRx.net, NSCA, sports medicine registries).

When a multi-day Full Body (Ganzkörper) bodyweight routine is requested:
1. LIVE RE-VALIDATION: Check professional split templates to ensure optimal recovery.
2. STRICT FULL BODY VARIATION: Every session must target the entire body, but the exercise selection MUST vary across days.
3. DATA FIELDS: Ensure weights are strictly 0 or empty for bodyweight exercises.`;

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
  splitPreference?: string;
  goalText?: string;
  /** Fixed weekly sport commitments, pre-rendered client-side. */
  commitmentsText?: string;
  sessionLines: string;
  whitelistLines: string;
  sessionCount: number;
}): string {
  const {
    frequency,
    experience,
    goal,
    equipment,
    focusMuscles,
    splitPreference,
    goalText,
    commitmentsText,
    sessionLines,
    whitelistLines,
    sessionCount,
  } = params;

  const physiologyGoal = goalPhysiologyLabel(goal);

  // Free-text goal ("improve hip mobility"): this outranks the structured goal
  // key. Steer the whole plan toward it, and only then unlock mobility work.
  const freeTextGoalBlock = goalText
    ? `PRIMARY USER GOAL (free text — HIGHEST PRIORITY): "${goalText.replace(/"/g, "'")}"
- Design EVERY day of the plan to serve this goal above the generic goal_key below.
- Name each day to reflect the goal (e.g. "Hip Mobility A") using the dayName field.
- If the goal is about mobility, flexibility, or loosening a specific body region:
  * Prioritize the relevant stretching / mobility / activation movements from the whitelist.
  * Program them as timed holds: put the hold length in SECONDS into the "reps" field (e.g. 30-45), with 2-3 sets and weight 0.
  * You MAY use fewer, gentler compound movements as warm-ups, but stretches/mobility drills must dominate.
- If the goal is strength or hypertrophy focused: prioritize compound + accessory lifts for the targeted area and do NOT include stretching-only movements.
- Match the free-text goal's language, but keep exercise "name" values EXACTLY as in the whitelist.
- Set "planName" to a short, clean plan title in the goal's language — a NOUN phrase of at most 4 words, with NO imperative verb (e.g. "Hüftmobilität & Beweglichkeit", NOT "Hüftmobilität verbessern"; "Shoulder Mobility", NOT "Improve shoulder mobility").

`
    : "";

  // Goal-driven plans must NOT inherit the Upper/Lower strength-split structure
  // or the "compounds first" bias — otherwise a mobility goal comes back as a
  // bench/row/squat plan with a few stretches appended.
  const structureBlock = goalText
    ? `You must output exactly ${sessionCount} day objects. Do NOT use generic strength-split titles like "Upper A" or "Lower A". Name each day yourself (via dayName) after the goal and the region it trains that day, in the goal's language (e.g. "Hüfte & Beinrückseite", "Rumpf & Rotation", "Ganzkörper-Mobilität").

Programming requirements (GOAL-DRIVEN — the goal above overrides everything):
- The overwhelming majority of exercises on EVERY day must directly serve the primary goal. Do not pad days with unrelated heavy barbell lifts (bench press, rows, curls, shrugs) just to reach an exercise count.
- Mobility/flexibility goal → fill each day with the relevant stretching / mobility / activation drills as timed holds (seconds go in "reps", e.g. 30-45, with 2-3 sets and weight 0). At most 1 light supporting strength movement per day, and only if it serves the goal.
- Strength/hypertrophy goal → prioritize the compound + accessory lifts for the targeted area; do not include stretching-only movements.
- Each day: 5-7 exercises. Copy "name" values EXACTLY from the whitelist. No name may repeat across days. Individualize sets/reps. weight 0 for bodyweight/stretch movements.`
    : `You must output exactly ${sessionCount} day objects in this fixed order and with these day titles (use each dayName exactly as listed unless a clearer Ganzkörper label is provided):
${sessionLines}

Programming requirements:
- Each day must include 5–8 exercises in performance order (compounds first, then accessories/core).
- Exercise "name" values MUST be copied EXACTLY from the whitelist (spelling and capitalization).
- No exercise name may appear on more than one day in this plan.
- Assign individualized sets and reps per exercise — never copy the same sets×reps block to every movement.
- For equipment_key "bodyweight", every exercise "weight" must be 0.`;

  // "experience" was previously passed through as an inert data field — the
  // model had no instruction on what it should mean for exercise SELECTION
  // (only sets/reps/exercise-count are varied elsewhere in this codebase).
  // A true beginner then routinely got a squat/deadlift/bench/row-heavy plan,
  // the most technique-demanding, injury-risky movements to learn unsupervised.
  // The app's own template fallback already encodes the right philosophy (a
  // dedicated machine/dumbbell-only "beg-" pool) — mirror it here so the AI
  // path matches instead of contradicting it.
  const experienceBlock =
    experience === "beginner"
      ? `EXPERIENCE — beginner: this principle applies across EVERY equipment category, not barbell alone. Avoid movements that demand real technique or strength to perform safely unsupervised, regardless of what equipment they use:
- Barbell: avoid Barbell Squat, Barbell Deadlift, Barbell Bench Press, Bent Over Barbell Row, Barbell Overhead Press and similar free-weight barbell compounds. Prefer machine, cable, or dumbbell equivalents (Leg Press, Goblet Squat, Machine Chest Press, Seated Cable Row, Dumbbell Shoulder Press, etc.) whenever the whitelist offers one.
- Kettlebell: avoid ballistic/technical lifts — Swing, Snatch, Clean, Renegade Row, Turkish Get-Up, Windmill. Prefer controlled, supported movements — Goblet Squat, Deadlift, Row, Suitcase Carry.
- Bodyweight: avoid movements most untrained people cannot yet perform for real reps — unassisted Pull-Up/Chin-Up, Dip, Muscle-Up, Pistol Squat, Sissy Squat, Handstand Push-Up. Prefer regressions and simpler patterns — Bodyweight Squat, Push-Up (or Incline/Knee Push-Up), Glute Bridge, Plank, Superman, Reverse Lunge.
If the whitelist truly offers nothing gentler for a muscle group, the least-demanding option available is still better than the most demanding one.\n`
      : experience === "advanced"
        ? `EXPERIENCE — advanced: for each muscle group, prioritize the heaviest, most technically demanding compound movement available within the whitelist for the given equipment (e.g. free-weight barbell compounds when equipment is barbell/full_gym; Snatch/Clean/Turkish Get-Up when equipment is kettlebell; weighted or strict Pull-Up/Dip/Pistol Squat when equipment is bodyweight) rather than defaulting to easier machine or assisted variants.\n`
        : "";

  // The athlete's fixed sport days constrain the strength plan: a week that
  // already contains two court-sport sessions cannot also carry maximal
  // lower-body volume. Placement of the sessions themselves is decided
  // deterministically in shared/weeklySchedule.ts, not here.
  const commitmentsBlock = commitmentsText ? `${commitmentsText}\n\n` : "";

  return `${PLAN_GENERATOR_FULL_JSON_PROMPT}

${freeTextGoalBlock}User profile:
- days_per_week: ${frequency}
- experience: ${experience}
- goal_key: ${goal}
- goal_physiology: ${physiologyGoal}
- equipment_key: ${equipment}
- split_preference: ${splitPreference ?? "auto"}
- focus_muscles_UI: ${JSON.stringify(focusMuscles)}

${commitmentsBlock}${experienceBlock}${structureBlock}

Whitelist — use ONLY these exercise names:
${whitelistLines}

Return ONLY valid JSON matching the EXPECTED JSON OUTPUT FORMAT above. No markdown fences, no commentary.`;
}

/** AI Coach — modify an existing plan per user instruction. */
export const PLAN_MODIFY_PROMPT = `You are an expert strength & hybrid-athlete coach. The user wants to MODIFY their existing workout plan.

RULES:
1. Preserve the overall plan structure (day names/count) unless the user explicitly asks to add/remove days.
2. When adding or swapping exercises, pick ONLY from the provided EXERCISE CATALOG whitelist (exact names).
3. Adjust sets/reps intelligently for the user's request (e.g. low-back core, hybrid running, deload).
4. Do NOT remove all exercises from a day unless asked.
5. Return a "summary" (1-2 sentences, German or English matching user language) and "changes" (bullet list of concrete edits).
6. reps may be an integer or a range string like "8-12".

Return ONLY JSON — no markdown.`;

export const PLAN_MODIFY_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    planName: { type: "string" },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dayName: { type: "string" },
          exercises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                sets: { type: "integer" },
                reps: { type: "string" },
                notes: { type: "string", nullable: true },
              },
              required: ["name", "sets", "reps"],
            },
          },
        },
        required: ["dayName", "exercises"],
      },
    },
    summary: { type: "string" },
    changes: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["planName", "days", "summary", "changes"],
} as const;
