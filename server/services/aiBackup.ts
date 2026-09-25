/**
 * Backup text generator — any OpenAI-compatible provider.
 *
 * Gemini's free tier is the primary generator and its failure mode is not
 * usually an error: it answers, just slowly (measured at 40-70s against the
 * app's 75s ceiling). A backup that only runs after the primary gives up
 * therefore cannot help — by then the budget is already spent. The orchestrator
 * in gemini.ts hedges instead, and this module is the second horse.
 *
 * Every free provider worth using speaks the OpenAI chat-completions protocol,
 * so one client covers all of them and switching is a base URL and a model
 * name, nothing more:
 *
 *   Groq (default)  https://api.groq.com/openai/v1        llama-3.3-70b-versatile
 *   Cerebras        https://api.cerebras.ai/v1            llama-3.3-70b
 *   OpenRouter      https://openrouter.ai/api/v1          <model>:free
 *   Mistral         https://api.mistral.ai/v1             mistral-small-latest
 *
 * Groq is the default because speed is the actual defect being fixed: it
 * answers these prompts in a few seconds, which is what keeps the request
 * inside the client's budget.
 */

export type BackupGenerateOptions = {
  /** Ask for JSON output. The schema is passed as a prompt instruction. */
  responseSchema?: Record<string, unknown>;
};

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export function backupBaseUrl(): string {
  return (process.env.AI_BACKUP_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export function backupModel(): string {
  return process.env.AI_BACKUP_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * The backup is opt-in: with no key configured the app behaves exactly as it
 * did before, rather than adding a second way for generation to fail.
 */
export function isBackupConfigured(): boolean {
  if (process.env.AI_BACKUP_ENABLED === "false") return false;
  return !!process.env.AI_BACKUP_API_KEY?.trim();
}

/**
 * Text-only. Import accepts PDFs and images as inline Gemini parts, and an
 * OpenAI-compatible text endpoint cannot stand in for that — so the caller must
 * check this before hedging, or the backup would "win" the race by confidently
 * answering a prompt it never saw the attachment for.
 */
export function partsAreTextOnly(parts: Array<Record<string, unknown>>): boolean {
  return parts.every((p) => typeof p.text === "string");
}

function partsToPrompt(parts: Array<Record<string, unknown>>): string {
  return parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n\n");
}

type ChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export async function backupGenerateContent(
  parts: Array<Record<string, unknown>>,
  options?: BackupGenerateOptions,
  signal?: AbortSignal,
): Promise<string> {
  const key = process.env.AI_BACKUP_API_KEY?.trim();
  if (!key) throw new Error("AI_BACKUP_API_KEY not configured");
  if (!partsAreTextOnly(parts)) {
    throw new Error("Backup provider is text-only; prompt has non-text parts");
  }

  let prompt = partsToPrompt(parts);
  const body: Record<string, unknown> = {
    model: backupModel(),
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  };

  if (options?.responseSchema) {
    // Gemini enforces a schema server-side; the OpenAI-compatible providers
    // vary in how much of that they support, and a request rejected for an
    // unsupported schema field would defeat the point of a backup. So the
    // schema is stated in the prompt and only the generic JSON mode — which
    // all of them implement — is switched on. The caller's parser already
    // tolerates code fences and surrounding prose.
    prompt +=
      "\n\nAntworte ausschließlich mit JSON, das exakt diesem Schema entspricht. " +
      "Kein Fließtext, keine Erklärung:\n" +
      JSON.stringify(options.responseSchema);
    body.messages = [{ role: "user", content: prompt }];
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${backupBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  const data = (await res.json()) as ChatResponse;
  if (!res.ok) {
    throw new Error(data.error?.message ?? `HTTP ${res.status}`);
  }

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty backup response");
  return text;
}
