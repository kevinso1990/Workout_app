import express from "express";
import { rateLimit } from "../middleware/rateLimiter";
import { aiUsageGuard } from "../middleware/aiUsageGuard";
import { generateDailyBriefing, suggestSmartSubstitutions, adaptPlanFromPerformance } from "../services/coachService";
import type { ClientPlanPayload } from "../services/planModifyService";

const router = express.Router();

const coachLimiter = rateLimit(30, 24 * 60 * 60 * 1000);

router.post("/smart-substitutions", coachLimiter, aiUsageGuard, async (req, res) => {
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

router.post("/daily-briefing", coachLimiter, aiUsageGuard, async (req, res) => {
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

router.post("/adapt-plan", coachLimiter, aiUsageGuard, async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "Coach AI is not configured" });
    }
    const body = req.body as {
      plan?: { name?: string; days?: unknown[] };
      performanceSummary?: string;
      performanceSignals?: {
        type: string;
        exercise_name?: string;
        sessions_analyzed: number;
        summary: string;
      }[];
      locale?: string;
    };
    if (!body.plan?.days?.length) {
      return res.status(400).json({ error: "plan with days required" });
    }
    const performanceSummary =
      typeof body.performanceSummary === "string"
        ? body.performanceSummary.trim()
        : "";
    if (performanceSummary.length < 40) {
      return res.status(400).json({ error: "performanceSummary too short" });
    }

    const locale = body.locale === "de" ? "de" : "en";
    const result = await adaptPlanFromPerformance({
      plan: body.plan as ClientPlanPayload,
      performanceSummary,
      performanceSignals: Array.isArray(body.performanceSignals)
        ? body.performanceSignals
        : [],
      locale,
    });
    return res.json(result);
  } catch (err) {
    console.error("[coach] adapt-plan:", err);
    const msg = err instanceof Error ? err.message : "Coach error";
    return res.status(500).json({ error: msg });
  }
});

export default router;
