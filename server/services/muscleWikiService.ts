import db from "../db";

const MUSCLEWIKI_BASE = "https://musclewiki.com/newapi/exercise/exercises/";
const CACHE_TTL_DAYS = 7;

interface MuscleWikiResult {
  id: number;
  name: string;
  category: string;
  difficulty: string;
  muscles_primary: string[];
  muscles_secondary: string[];
  video_url: string;
  video_mp4: string;
  body_map_front: string;
  body_map_back: string;
  correct_steps: string[];
  description: string;
}

export async function searchMuscleWiki(name: string): Promise<MuscleWikiResult[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];

  // Return cached result if fresh enough
  const cached = db
    .prepare(
      `SELECT data FROM exercise_media_cache
       WHERE exercise_name = ? AND fetched_at > datetime('now', '-${CACHE_TTL_DAYS} days')`,
    )
    .get(trimmed) as { data: string } | undefined;

  if (cached) return JSON.parse(cached.data) as MuscleWikiResult[];

  const resp = await fetch(
    `${MUSCLEWIKI_BASE}?format=json&limit=5&name=${encodeURIComponent(trimmed)}`,
  );
  if (!resp.ok) return [];

  const data = (await resp.json()) as {
    results?: {
      id: number;
      name: string;
      category?: { name: string };
      difficulty?: { name: string };
      muscles_primary?: { name: string }[];
      muscles_secondary?: { name: string }[];
      male_images?: { og_image?: string; branded_video?: string }[];
      female_images?: { og_image?: string }[];
      body_map_images?: { image?: string }[];
      correct_steps?: ({ text?: string } | string)[];
      description?: string;
    }[];
  };

  const results: MuscleWikiResult[] = (data.results ?? []).map((ex) => ({
    id: ex.id,
    name: ex.name,
    category: ex.category?.name ?? "",
    difficulty: ex.difficulty?.name ?? "",
    muscles_primary: (ex.muscles_primary ?? []).map((m) => m.name),
    muscles_secondary: (ex.muscles_secondary ?? []).map((m) => m.name),
    video_url: ex.male_images?.[0]?.og_image ?? ex.female_images?.[0]?.og_image ?? "",
    video_mp4: ex.male_images?.[0]?.branded_video ?? "",
    body_map_front: ex.body_map_images?.[0]?.image ?? "",
    body_map_back: ex.body_map_images?.[1]?.image ?? "",
    correct_steps: (ex.correct_steps ?? []).map((s) =>
      typeof s === "string" ? s : (s.text ?? ""),
    ),
    description: ex.description ?? "",
  }));

  db.prepare(
    "INSERT OR REPLACE INTO exercise_media_cache (exercise_name, data, fetched_at) VALUES (?, ?, datetime('now'))",
  ).run(trimmed, JSON.stringify(results));

  return results;
}
