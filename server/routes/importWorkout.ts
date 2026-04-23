import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { rateLimit } from '../middleware/rateLimiter';

const router = express.Router();

const importLimiter = rateLimit(5, 24 * 60 * 60 * 1000);

router.post('/import-workout', importLimiter, async (req, res) => {
  try {
    const { image, mediaType } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mediaType || 'image/jpeg',
          data: image,
        },
      },
      `Extract the workout plan from this image. Return ONLY valid JSON, no markdown, no explanation, no code blocks:
{
  "planName": "string",
  "days": [
    {
      "dayName": "string",
      "exercises": [
        {
          "name": "string",
          "sets": number,
          "reps": number,
          "weight": number or null,
          "notes": "string or null"
        }
      ]
    }
  ]
}`,
    ]);

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(422).json({ error: 'Could not parse workout plan from image' });

    const plan = JSON.parse(jsonMatch[0]);
    return res.json(plan);

  } catch (err: any) {
    console.error('Import workout error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
