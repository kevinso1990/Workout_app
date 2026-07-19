import type { Express, Request, Response } from "express";
import authRouter from "./auth";
import exerciseRouter from "./exercises";
import db from "../db";
import planRouter from "./plans";
import sessionRouter from "./sessions";
import setRouter from "./sets";
import feedbackRouter from "./feedback";
import recommendationRouter from "./recommendations";
import statsRouter from "./stats";
import bodyWeightRouter from "./bodyWeight";
import recoveryRouter from "./recovery";
import muscleWikiRouter from "./muscleWiki";
import pushRouter from "./push";
import votesRouter from "./votes";
import splitRefreshRouter from "./splitRefresh";
import subscriptionRouter from "./subscriptions";
import importWorkoutRouter from "./importWorkout";
import translateExerciseRouter from "./translateExercise";
import coachRouter from "./coach";
import workoutSyncRouter from "./workoutSync";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { startPushScheduler } from "../services/pushService";
import { searchMuscleWiki } from "../services/muscleWikiService";
import { listCatalogExercises, listAlternativesByName } from "../services/exerciseService";
import { withListThumbnailResolution } from "../utils/imageResolution";

const muscleWikiFetchInProgress = new Set<string>();

const BACKGROUND_FETCH_RATE_WINDOW_MS = 60_000;
const BACKGROUND_FETCH_RATE_LIMIT = 30;
const backgroundFetchTimestamps: number[] = [];

function canTriggerBackgroundFetch(): boolean {
  const now = Date.now();
  while (backgroundFetchTimestamps.length > 0 && now - backgroundFetchTimestamps[0] > BACKGROUND_FETCH_RATE_WINDOW_MS) {
    backgroundFetchTimestamps.shift();
  }
  if (backgroundFetchTimestamps.length >= BACKGROUND_FETCH_RATE_LIMIT) return false;
  backgroundFetchTimestamps.push(now);
  return true;
}

/**
 * Mounts all API routers on the Express app and starts background schedulers.
 * Called once at server startup from server/index.ts.
 *
 * Auth model:
 *   - /api/auth/* is public (must be reachable to obtain a token)
 *   - every other /api/* route is gated by `requireAuth` so handlers can
 *     trust `req.user.sub` and scope all queries to the owning user.
 */
export function registerRoutes(app: Express): void {
  // Public — sign-in endpoints
  app.use("/api/auth", authRouter);

  // Public — anonymous device cloud backup (no auth; keyed by client UUID).
  // Pragmatic safety net so web/PWA users don't lose history if local
  // storage is cleared. Registered before the requireAuth block.
  app.use("/api/workouts", workoutSyncRouter);

  // Public — GIF URL lookups are read-only reference data with no user context.
  // Registered before the requireAuth exercises mount so these paths are reachable
  // without a Bearer token (clients may call them before authentication).
  app.get("/api/exercises/gif/:name", (req: Request, res: Response) => {
    const raw = req.params.name;
    const segment = typeof raw === "string" ? raw : raw?.[0] ?? "";
    const name = decodeURIComponent(segment);

    // Check MuscleWiki cache first — it provides animated GIFs (og_image) and MP4 videos.
    let videoMp4: string | null = null;
    let gifUrl: string | null = null;

    const mediaCache = db
      .prepare(
        "SELECT data FROM exercise_media_cache WHERE exercise_name = ? COLLATE NOCASE",
      )
      .get(name) as { data: string } | undefined;

    let correctSteps: string[] = [];
    const hasMuscleWikiCache = !!mediaCache;

    if (mediaCache) {
      try {
        const results = JSON.parse(mediaCache.data) as Array<{
          video_url?: string;
          video_mp4?: string;
          correct_steps?: string[];
        }>;
        if (results.length > 0) {
          gifUrl = results[0].video_url || null;
          videoMp4 = results[0].video_mp4 || null;
          correctSteps = results[0].correct_steps ?? [];
        }
      } catch {
        /* ignore malformed cache */
      }
    }

    // Fall back to the static GitHub CDN image when MuscleWiki has no cached data.
    if (!gifUrl) {
      const row = db
        .prepare("SELECT gif_url FROM exercises WHERE name = ? COLLATE NOCASE")
        .get(name) as { gif_url: string | null } | undefined;
      gifUrl = row?.gif_url ?? null;
    }

    const resQ = req.query.resolution;
    const resStr = Array.isArray(resQ) ? resQ[0] : resQ;
    const wantThumb =
      resStr === "360" || resStr === "thumbnail" || String(resStr) === "360";
    if (wantThumb && gifUrl) {
      gifUrl = withListThumbnailResolution(gifUrl, 360);
      videoMp4 = null;
    }

    res.json({ gifUrl, videoMp4, correctSteps });

    // If MuscleWiki has no data for this exercise, trigger a background fetch so
    // subsequent requests (and modal opens) will have form tips available.
    // Rate-limited to prevent request amplification via the public endpoint.
    if (!hasMuscleWikiCache) {
      const key = name.toLowerCase().trim();
      if (!muscleWikiFetchInProgress.has(key) && canTriggerBackgroundFetch()) {
        muscleWikiFetchInProgress.add(key);
        searchMuscleWiki(name)
          .catch(() => {})
          .finally(() => muscleWikiFetchInProgress.delete(key));
      }
    }
  });

  app.get("/api/exercises/gif-names", (_req: Request, res: Response) => {
    // Include exercises that have either a static gif_url or MuscleWiki cached data.
    const rows = db
      .prepare("SELECT name FROM exercises WHERE gif_url IS NOT NULL")
      .all() as { name: string }[];
    const mediaRows = db
      .prepare("SELECT exercise_name AS name FROM exercise_media_cache")
      .all() as { name: string }[];
    const allNames = new Set([
      ...rows.map((r) => r.name),
      ...mediaRows.map((r) => r.name),
    ]);
    res.json([...allNames]);
  });

  /** Public catalog — full SQLite exercise list for native clients. */
  app.get("/api/exercises/catalog", (_req: Request, res: Response) => {
    const rows = listCatalogExercises();
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        muscle_group: r.muscle_group,
        equipment: r.equipment,
        is_custom: r.is_custom,
      })),
    );
  });

  /** Public alternatives — same muscle group as named exercise (DB). */
  app.get("/api/exercises/alternatives", (req: Request, res: Response) => {
    const raw = req.query.name;
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name) {
      res.status(400).json({ error: "name query parameter required" });
      return;
    }
    const rows = listAlternativesByName(name, 64);
    res.json({
      exercises: rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        muscle_group: r.muscle_group,
        equipment: r.equipment,
      })),
    });
  });

  // All other routes require a valid Bearer JWT
  app.use("/api/exercises",         requireAuth, exerciseRouter);
  app.use("/api/plans",             requireAuth, planRouter);
  app.use("/api/sessions",          requireAuth, sessionRouter);
  app.use("/api/sets",              requireAuth, setRouter);
  app.use("/api/exercise-feedback", requireAuth, feedbackRouter);
  app.use("/api/recommendations",   requireAuth, recommendationRouter);
  app.use("/api/stats",             requireAuth, statsRouter);
  app.use("/api/body-weight",       requireAuth, bodyWeightRouter);
  app.use("/api/recovery",          requireAuth, recoveryRouter);
  app.use("/api/musclewiki",        requireAuth, muscleWikiRouter);
  app.use("/api/push",              requireAuth, pushRouter);
  app.use("/api/votes",             requireAuth, votesRouter);
  app.use("/api/split-refresh",     requireAuth, splitRefreshRouter);
  // Subscription router applies `requireAuth` only to user-scoped routes; webhooks stay public.
  app.use("/api/subscriptions", subscriptionRouter);
  // Workout import: Claude primary, Gemini fallback, per-IP rate limit.
  // Use optionalAuth so guests (who don't yet hold a JWT) can still import
  // their plans — matches the "skip / continue without account" UX promise.
  app.use("/api",                   optionalAuth, importWorkoutRouter);
  app.use("/api/coach",             optionalAuth, coachRouter);
  app.use("/api",                   requireAuth, translateExerciseRouter);

  startPushScheduler();
}
