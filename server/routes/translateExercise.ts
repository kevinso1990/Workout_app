import express from 'express';
import { rateLimit } from '../middleware/rateLimiter';
import { geminiGenerateContent } from '../services/geminiGenerate';

const router = express.Router();

const translateLimiter = rateLimit(60, 60 * 1000);

const translationCache: Record<string, string> = {};

router.post('/translate-exercise', translateLimiter, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Invalid name' });

    const key = name.toLowerCase().trim();
    if (translationCache[key]) return res.json({ english: translationCache[key] });

    const english = (
      await geminiGenerateContent([
        {
          text: `Translate this fitness exercise name to English. Return ONLY the English name, nothing else. Exercise: "${name}"`,
        },
      ])
    ).trim();
    translationCache[key] = english;
    return res.json({ english });
  } catch (err: any) {
    return res.json({ english: req.body.name });
  }
});

export default router;
