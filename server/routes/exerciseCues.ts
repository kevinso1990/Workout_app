import express from "express";
import { rateLimit } from "../middleware/rateLimiter";
import { exerciseCues } from "../services/exerciseCuesService";

const router = express.Router();

// Generation is once per name and language; reads after that are cheap, so
// the limit only guards against a client looping over the whole catalog.
const cuesLimiter = rateLimit(30, 60 * 1000);

router.post("/exercise-cues", cuesLimiter, async (req, res) => {
  const { name, muscleGroup, language } = req.body ?? {};
  if (typeof name !== "string" || !name.trim() || name.length > 120) {
    return res.status(400).json({ error: "Invalid name" });
  }
  const lang = language === "de" ? "de" : "en";
  try {
    const cues = await exerciseCues(
      name,
      typeof muscleGroup === "string" ? muscleGroup.slice(0, 40) : undefined,
      lang,
    );
    return res.json({ cues });
  } catch {
    return res.status(503).json({ cues: [] });
  }
});

export default router;
