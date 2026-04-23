import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { rateLimit } from '../middleware/rateLimiter';

const router = express.Router();

const translateLimiter = rateLimit(60, 60 * 1000);

const translationCache: Record<string, string> = {};

router.post('/translate-exercise', translateLimiter, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Invalid name' });

    const key = name.toLowerCase().trim();
    if (translationCache[key]) return res.json({ english: translationCache[key] });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(
      `Translate this fitness exercise name to English. Return ONLY the English name, nothing else. Exercise: "${name}"`
    );

    const english = result.response.text().trim();
    translationCache[key] = english;
    return res.json({ english });
  } catch (err: any) {
    return res.json({ english: req.body.name });
  }
});

export default router;
