/**
 * Gemini client — optional Google Search grounding (Internet-RAG) for
 * evidence-based workout programming.
 */

import { GoogleGenerativeAI, type Part } from "@google/generative-ai";

export type GeminiGenerateOptions = {
  /** When true, enables `google_search` grounding via the REST API. */
  grounding?: boolean;
  /** When set, forces JSON output matching this schema (Gemini structured outputs). */
  responseSchema?: Record<string, unknown>;
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

/** REST generateContent — supports grounding and/or structured JSON schema. */
async function generateWithRest(
  modelName: string,
  parts: Part[],
  options?: GeminiGenerateOptions,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(key)}`;

  const generationConfig: Record<string, unknown> = {};
  if (options?.responseSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = options.responseSchema;
  }

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
  };
  if (options?.grounding) {
    body.tools = [{ google_search: {} }];
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

/** @deprecated Use generateWithRest */
async function generateWithGroundingRest(
  modelName: string,
  parts: Part[],
): Promise<string> {
  return generateWithRest(modelName, parts, { grounding: true });
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
/**
 * Transient upstream conditions, not "this model is wrong". Gemini's free tier
 * returns 503 "high demand" regularly under load, and the old behaviour treated
 * that as fatal for the model: it moved straight on, exhausted the short chain,
 * and gave up — so a temporary capacity blip took plan generation down entirely
 * while the client sat waiting for its 75s timeout.
 */
export function isRetryableGeminiError(message: string): boolean {
  return (
    /\b(429|500|502|503|504)\b/.test(message) ||
    /high demand|overloaded|unavailable|rate.?limit|quota|deadline|timeout|timed out|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up/i.test(
      message,
    )
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function geminiGenerateContent(
  parts: Part[],
  options?: GeminiGenerateOptions,
): Promise<string> {
  const useGrounding = options?.grounding === true;
  const useSchema = !!options?.responseSchema;
  const errors: string[] = [];

  const attemptsPerModel = Math.max(
    1,
    parseInt(process.env.GEMINI_ATTEMPTS_PER_MODEL || "3", 10) || 3,
  );
  // Stay comfortably inside the client's own 75s ceiling: returning a template
  // plan at 50s is a far better outcome than a request the app abandons.
  const deadlineMs = Math.max(
    5_000,
    parseInt(process.env.GEMINI_DEADLINE_MS || "50000", 10) || 50_000,
  );
  const startedAt = Date.now();
  const timeLeft = () => deadlineMs - (Date.now() - startedAt);

  for (const modelName of modelChain()) {
    for (let attempt = 1; attempt <= attemptsPerModel; attempt++) {
      if (timeLeft() <= 0) {
        throw new Error(
          `Gemini deadline of ${deadlineMs}ms exceeded — ${errors.join(" | ") || "no attempts completed"}`,
        );
      }
      try {
      // Structured JSON or grounding require REST API.
      if (useSchema || useGrounding) {
        return await generateWithRest(modelName, parts, options);
      }
      return await generateWithSdk(modelName, parts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${modelName}#${attempt}: ${msg}`);
      // Log the actual reason. Without it a failing model is indistinguishable
      // from a rate limit, an oversized prompt, or a bad key — which is exactly
      // the hole that made a production generation outage undiagnosable from
      // the logs. Prompt size is included because the failures that matter here
      // only show up on real (large) prompts, never on a smoke test.
      const promptChars = parts.reduce(
        (n, p) => n + (typeof (p as { text?: string }).text === "string" ? (p as { text: string }).text.length : 0),
        0,
      );
      const retryable = isRetryableGeminiError(msg);
      console.warn(
        `[Gemini] ${modelName} attempt ${attempt}/${attemptsPerModel} failed ` +
          `(prompt ${promptChars} chars, ` +
          `${useSchema ? "schema" : useGrounding ? "grounding" : "sdk"} path, ` +
          `${retryable ? "retryable" : "fatal"}): ${msg}`,
      );

      if (!retryable) break; // a real problem with this model — move on
      if (attempt >= attemptsPerModel) break;
      // Back off before retrying the SAME model: a 503 means "busy now",
      // and the next model in the chain is usually just as busy.
      const backoff = Math.min(1_000 * 2 ** (attempt - 1), 4_000);
      if (timeLeft() <= backoff) break;
      await sleep(backoff);
    }
    }
  }

  throw new Error(`All Gemini models failed — ${errors.join(" | ")}`);
}
