/**
 * The hedged race between Gemini and the backup provider.
 *
 * This exists because the production failure was SLOWNESS, not errors: Gemini's
 * free tier answers in 40-70s while the app abandons the request at 75s, so the
 * user gets a generic template and the real plan is thrown away. A plain
 * fallback cannot fix that — it only starts after the slow provider has already
 * eaten the budget. The behaviour worth pinning is therefore "a slow primary
 * loses to a fast backup", plus the cases where hedging must not happen at all.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const backupMock = vi.fn();

vi.mock("../services/aiBackup", async () => {
  const actual = await vi.importActual<typeof import("../services/aiBackup")>(
    "../services/aiBackup",
  );
  return {
    ...actual,
    isBackupConfigured: () => process.env.AI_BACKUP_API_KEY != null,
    backupModel: () => "test-backup-model",
    backupGenerateContent: backupMock,
  };
});

const ENV = ["GEMINI_API_KEY", "AI_BACKUP_API_KEY", "AI_HEDGE_MS", "GEMINI_ATTEMPTS_PER_MODEL", "GEMINI_MODEL_CHAIN"];
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  process.env.GEMINI_API_KEY = "gemini-key";
  process.env.GEMINI_ATTEMPTS_PER_MODEL = "1";
  process.env.GEMINI_MODEL_CHAIN = "test-model";
  process.env.AI_HEDGE_MS = "20";
  backupMock.mockReset();
});

afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

/** Gemini REST reply, optionally delayed to imitate the slow free tier. */
function stubGemini(text: string, delayMs = 0, ok = true) {
  const fn = vi.fn().mockImplementation(
    () =>
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              ok,
              status: ok ? 200 : 503,
              json: async () =>
                ok
                  ? { candidates: [{ content: { parts: [{ text }] } }] }
                  : { error: { message: text } },
            }),
          delayMs,
        ),
      ),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

// A schema forces the REST path, which is what plan generation actually uses.
const SCHEMA = { type: "object" } as const;

async function generate(options: Record<string, unknown> = { responseSchema: SCHEMA }) {
  const { geminiGenerateContent } = await import("../services/gemini");
  return geminiGenerateContent([{ text: "build a plan" }], options as never);
}

describe("when the backup is not configured", () => {
  it("behaves exactly as before and never reaches for a backup", async () => {
    delete process.env.AI_BACKUP_API_KEY;
    stubGemini("gemini plan");
    await expect(generate()).resolves.toBe("gemini plan");
    expect(backupMock).not.toHaveBeenCalled();
  });
});

describe("when the backup is configured", () => {
  beforeEach(() => {
    process.env.AI_BACKUP_API_KEY = "backup-key";
  });

  it("does not spend backup quota when Gemini answers inside the window", async () => {
    stubGemini("fast gemini plan", 0);
    await expect(generate()).resolves.toBe("fast gemini plan");
    // The delay before hedging is the whole reason this stays cheap on two
    // free tiers: a healthy primary means the backup is never called.
    expect(backupMock).not.toHaveBeenCalled();
  });

  it("lets a fast backup beat a slow Gemini — the actual production defect", async () => {
    stubGemini("slow gemini plan", 5_000);
    backupMock.mockResolvedValue("backup plan");
    await expect(generate()).resolves.toBe("backup plan");
    expect(backupMock).toHaveBeenCalledTimes(1);
  });

  it("still returns Gemini's answer if the backup fails", async () => {
    stubGemini("gemini plan", 60);
    backupMock.mockRejectedValue(new Error("backup down"));
    await expect(generate()).resolves.toBe("gemini plan");
  });

  it("starts the backup at once when Gemini fails fast, without idling out the delay", async () => {
    // An exhausted quota fails in about a second. Waiting the full hedge delay
    // on a provider that has already given up is dead time the user pays for.
    process.env.AI_HEDGE_MS = "10000";
    stubGemini("401 API key not valid", 0, false);
    backupMock.mockResolvedValue("backup plan");

    const started = Date.now();
    await expect(generate()).resolves.toBe("backup plan");
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("reports both providers when neither succeeds", async () => {
    stubGemini("503 high demand", 0, false);
    backupMock.mockRejectedValue(new Error("backup down"));
    await expect(generate()).rejects.toThrow(/All AI providers failed/);
  });

  it("does not hedge a prompt with attachments the backup cannot see", async () => {
    // Import sends PDFs and screenshots inline. A text-only backup would answer
    // confidently having never seen the file, and could win the race with it.
    stubGemini("gemini read the pdf", 0);
    const { geminiGenerateContent } = await import("../services/gemini");
    await geminiGenerateContent(
      [{ text: "extract" }, { inlineData: { mimeType: "application/pdf", data: "x" } }] as never,
      { responseSchema: SCHEMA } as never,
    );
    expect(backupMock).not.toHaveBeenCalled();
  });

  it("does not hedge a grounded request, which the backup cannot answer", async () => {
    stubGemini("grounded answer", 0);
    await generate({ grounding: true });
    expect(backupMock).not.toHaveBeenCalled();
  });
});
