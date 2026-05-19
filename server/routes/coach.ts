import express from "express";
import { rateLimit } from "../middleware/rateLimiter";
import { generateDailyBriefing, suggestSmartSubstitutions } from "../services/coachService";

const router = express.Router();

const coachLimiter = rateLimit(30, 24 * 60 * 60 * 1000);

router.post("/smart-substitutions", coachLimiter, async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "Coach AI is not configured" });
    }
    const body = req.body as {
      exerciseName?: string;
      muscleGroup?: string;
      historyText?: string;
    };
    const exerciseName = typeof body.exerciseName === "string" ? body.exerciseName.trim() : "";
    const muscleGroup = typeof body.muscleGroup === "string" ? body.muscleGroup.trim() : "";
    if (!exerciseName) {
      return res.status(400).json({ error: "exerciseName required" });
    }
    const historyText =
      typeof body.historyText === "string" ? body.historyText.slice(0, 8000) : "";

    const exercises = await suggestSmartSubstitutions({
      exerciseName,
      muscleGroup: muscleGroup || "Unknown",
      historyText,
    });
    return res.json({ exercises });
  } catch (err) {
    console.error("[coach] smart-substitutions:", err);
    const msg = err instanceof Error ? err.message : "Coach error";
    return res.status(500).json({ error: msg });
  }
});

router.post("/daily-briefing", coachLimiter, async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "Coach AI is not configured" });
    }
    const body = req.body as {
      locale?: string;
      planSummary?: string;
      sessionSummary?: string;
    };
    const locale = body.locale === "de" ? "de" : "en";
    const planSummary =
      typeof body.planSummary === "string" ? body.planSummary.slice(0, 6000) : "";
    const sessionSummary =
      typeof body.sessionSummary === "string" ? body.sessionSummary.slice(0, 8000) : "";

    const brief = await generateDailyBriefing({
      locale,
      planSummary: planSummary || "User has no plan description.",
      sessionSummary,
    });
    return res.json({ brief });
  } catch (err) {
    console.error("[coach] daily-briefing:", err);
    const msg = err instanceof Error ? err.message : "Coach error";
    return res.status(500).json({ error: msg });
  }
});

export default router;
