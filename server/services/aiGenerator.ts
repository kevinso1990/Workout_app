/**
 * Central AI instruction sets for plan extraction and auto-generation.
 */

/**
 * Import prompt — NO internet RAG. Reads every session of the plan (strength,
 * mobility, cardio) with its structure: supersets, rest, cues, home
 * alternatives, warm-up and the weekly schedule / rotation.
 */
export const IMPORT_WORKOUT_EXTRACTION_PROMPT = `You read a training plan document and output ONLY structured JSON. Be faithful to the document: never invent exercises, numbers or days.

WHAT TO READ — every SESSION block of the plan:
- Strength days, however titled ("GK A", "GK A kurz – Bein / Hinge", "Tag 1", "Day A", "Push", "Workout B", …). Short and long versions of the same focus day are SEPARATE days.
- Mobility / stretching sessions ("Mobility – Mo abends") → kind "mobility".
- Cardio / conditioning sessions ("Cardio – So", "Norwegisches 4×4") → kind "cardio".
WHAT TO IGNORE: introductions, rule/physio text, disclaimers, page headers/footers, table header rows ("# Übung Sätze × Wdh Kurz-Hinweis").

PER DAY:
- dayName: the session title exactly as written (e.g. "GK A kurz – Bein / Hinge"). For a cardio session use a short name with its format when the document gives one (e.g. "Cardio 4×4").
- kind: "strength" | "mobility" | "cardio".
- warmup: a warm-up row/section of this day as ONE line of text, exactly as written (e.g. "5 Min Seil · Couch Stretch 60–90 Sek/Seite (Becken nach hinten) · 2×15 Glute Bridges"). A warm-up is NEVER an exercise. null if none.
- durationMinutes: the session's stated duration (upper bound of a range), else null.
- notes: for cardio days, the full prescription in one or two short lines (e.g. "10 Min warm-up locker · 4 × 4 Min bei 90–95 % HRmax, dazwischen 3 Min sehr locker · 5 Min Cool-down. Bike oder Sprints."). Otherwise null.
- exercises: for cardio days return []. Otherwise every exercise row in order.

PER EXERCISE:
- name: the exercise name only — no numbering, no "A1"/"B2" prefix, no conditions like "(falls Stange da)" (those go to notes). Keep qualifiers that change WHICH exercise it is ("Single Leg KB RDL", "Enge Klimmzüge (supinated)", "Bulgarian Split Squat (KB Front Rack)"). Equipment choices between otherwise identical options go to notes ("Rudern Sitzend (Kabel/Maschine)" → name "Rudern Sitzend", notes "Kabel/Maschine").
- sets: integer. For a range ("2–3") use the higher number and add "2–3 Sätze" to notes. A row with only a duration ("Child's Pose 60 Sek") is 1 set. If the block header gives rounds ("3 Runden") and the row has no own sets, use the rounds.
- reps: the per-set target as a string, WITHOUT the "per side" part:
    "6–8" → "6-8", "10" → "10", "20–30 Sek" → "20-30 s", "45 Sek" → "45 s", "2 Min" → "120 s", "2–3 Min" → "120-180 s". null if none.
- perSide: true when the target is per side ("/Seite", "pro Seite", "je Seite", "each side", "per side"), else false.
- weight: number in kg if the row prescribes a load, else null.
- notes: the row's coaching cue as written, shortened only by removing the alternative (below). Instructions in a BLOCK header that apply to every exercise of the block (e.g. "linke Seite zuerst, links +1 Satz") are added to each of those exercises' notes. null if nothing.
- alternative: an alternative exercise the row offers for another setting, with its label, e.g. "Zuhause: KB Suitcase DL 3 × 8/Seite" or "Gym: Reverse Butterfly". Remove it from notes. null if none.
- superset: when the row belongs to a superset/circuit block ("Superset A – 3 Runden, 90 Sek Pause", rows prefixed A1/A2), the block letter ("A", "B"). Exercises of a normal block or a "Finisher" without superset wording → null.
- restSeconds: rest in seconds stated for the row or its block ("90 Sek Pause" → 90, "2 Min Pause" → 120), else null.
- muscleGroup: the main muscle group the exercise trains, one of: Chest, Back, Shoulders, Biceps, Triceps, Forearms, Traps, Quads, Hamstrings, Glutes, Calves, Legs, Core, Full Body, Mobility ("Mobility" for stretches and mobility drills).

SCHEDULE — only when the document assigns sessions to weekdays:
- schedule.weeks: one entry per week of the cycle. A plan without rotation has exactly one week.
- Each week lists sessions { weekday, dayName }: weekday is "mon","tue","wed","thu","fri","sat","sun"; dayName must be EXACTLY one of the dayName values you output in "days".
- Resolve rotation tables: e.g. "Woche 1: Di GK B kurz, Do GK C kurz, Sa GK A lang" → week 1 has tue → "GK B kurz – Pull", thu → "GK C kurz – Push / Core", sat → "GK A lang – Bein / Hinge".
- Sessions that are the same every week (e.g. "Mo Mobility", "So Cardio") appear in EVERY week of the cycle.
- Free/rest days are simply not listed.
- If the document has no weekday assignment at all, return "weeks": [].

AVOID-LIST — separate from the days:
- Some plans carry a section framed as things NOT to do ("Verboten", "Vermeiden", "Nicht erlaubt", "Contraindicated", "Avoid"), often with a reason column instead of sets×reps. Those are NOT days.
- Collect just the exercise NAMES from such a section into "avoidExercises". Split a row naming several exercises ("V-Ups, Jackknives, Sit-Ups mit fixierten Füßen") into separate entries.
- Only exercises the document itself frames as to be avoided. Empty array if none.

OUTPUT FORMAT — VALID JSON IS MANDATORY:
{"planName": string, "days": [...], "schedule": {"weeks": [{"sessions": [{"weekday": "tue", "dayName": "..."}]}]}, "avoidExercises": [...]}
- Escape a double-quote inside a string as \\" or leave the quote marks out. No trailing commas, no comments.
- planName: the document's title if it has one, else a short descriptive name.

If no session with exercises is found, return: {"planName":"Imported Plan","days":[],"schedule":{"weeks":[]},"avoidExercises":[]}`;

/** Catalog muscle groups (+ Mobility) the model may assign to an exercise the catalog doesn't know. */
export const IMPORT_MUSCLE_GROUPS = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms", "Traps",
  "Quads", "Hamstrings", "Glutes", "Calves", "Legs", "Core", "Full Body", "Mobility",
] as const;

/** JSON schema for Gemini structured output (import). */
export const IMPORT_WORKOUT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    planName: { type: "string" },
    avoidExercises: {
      type: "array",
      items: { type: "string" },
    },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dayName: { type: "string" },
          kind: { type: "string", enum: ["strength", "mobility", "cardio"] },
          warmup: { type: "string", nullable: true },
          durationMinutes: { type: "integer", nullable: true },
          notes: { type: "string", nullable: true },
          exercises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                sets: { type: "integer" },
                reps: { type: "string", nullable: true },
                perSide: { type: "boolean" },
                weight: { type: "number", nullable: true },
                notes: { type: "string", nullable: true },
                alternative: { type: "string", nullable: true },
                superset: { type: "string", nullable: true },
                restSeconds: { type: "integer", nullable: true },
                muscleGroup: { type: "string", enum: [...IMPORT_MUSCLE_GROUPS] },
              },
              required: ["name", "sets"],
            },
          },
        },
        required: ["dayName", "kind", "exercises"],
      },
    },
    schedule: {
      type: "object",
      properties: {
        weeks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sessions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    weekday: { type: "string", enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] },
                    dayName: { type: "string" },
                  },
                  required: ["weekday", "dayName"],
                },
              },
            },
            required: ["sessions"],
          },
        },
      },
      required: ["weeks"],
    },
  },
  required: ["planName", "days", "schedule", "avoidExercises"],
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
