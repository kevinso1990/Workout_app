/**
 * Gemini client — optional Google Search grounding (Internet-RAG) for
 * evidence-based workout programming.
 */

import { GoogleGenerativeAI, type Part } from "@google/generative-ai";

export type GeminiGenerateOptions = {
  /** When true, enables `google_search` grounding via the REST API. */
  grounding?: boolean;
};

function modelChain(): string[] {
  const raw = process.env.GEMINI_MODEL_CHAIN?.trim();
  if (raw) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return ["gemini-2.0-flash", "gemini-2.0-flash-lite"];
}

function extractTextFromRestResponse(data: unknown): string | null {
  const candidates = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    ?.candidates;
  const parts = candidates?.[0]?.content?.parts;
  if (!parts?.length) return null;
  return parts.map((p) => p.text ?? "").join("").trim() || null;
}

/** REST generateContent — supports `google_search` tool on Gemini 2.x models. */
async function generateWithGroundingRest(
  modelName: string,
  parts: Part[],
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      tools: [{ google_search: {} }],
    }),
  });

  const data = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const text = extractTextFromRestResponse(data);
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

/** SDK path without grounding (multimodal PDF/image parts). */
async function generateWithSdk(modelName: string, parts: Part[]): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(parts);
  return result.response.text();
}

/**
 * Generate text from Gemini parts. Tries each model in `GEMINI_MODEL_CHAIN`.
 * When `grounding` is true, uses Google Search via REST (`google_search` tool).
 */
export async function geminiGenerateContent(
  parts: Part[],
  options?: GeminiGenerateOptions,
): Promise<string> {
  const useGrounding = options?.grounding === true;
  const errors: string[] = [];

  for (const modelName of modelChain()) {
    try {
      if (useGrounding) {
        return await generateWithGroundingRest(modelName, parts);
      }
      return await generateWithSdk(modelName, parts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${modelName}: ${msg}`);
      console.warn(`[Gemini] ${modelName} failed, trying next if any`);
    }
  }

  throw new Error(`All Gemini models failed — ${errors.join(" | ")}`);
}
