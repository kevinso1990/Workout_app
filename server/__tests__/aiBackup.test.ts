/**
 * The backup generator, and the rules about when it may NOT be used.
 *
 * The dangerous failure here is not the backup being unavailable — it is the
 * backup answering a prompt it was not equipped for and winning the race with
 * a confident wrong answer. Import sends PDFs and screenshots to Gemini as
 * inline parts; a text-only chat endpoint receives none of that and would
 * happily invent a workout. Those guards are the point of this file.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  backupBaseUrl,
  backupModel,
  isBackupConfigured,
  partsAreTextOnly,
  backupGenerateContent,
} from "../services/aiBackup";

const ENV_KEYS = [
  "AI_BACKUP_API_KEY",
  "AI_BACKUP_BASE_URL",
  "AI_BACKUP_MODEL",
  "AI_BACKUP_ENABLED",
];

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

describe("configuration", () => {
  it("is off until a key is set, so nothing changes by merely deploying this", () => {
    expect(isBackupConfigured()).toBe(false);
    process.env.AI_BACKUP_API_KEY = "test-key";
    expect(isBackupConfigured()).toBe(true);
  });

  it("can be switched off without removing the key", () => {
    process.env.AI_BACKUP_API_KEY = "test-key";
    process.env.AI_BACKUP_ENABLED = "false";
    expect(isBackupConfigured()).toBe(false);
  });

  it("defaults to Groq, whose speed is the reason the backup exists", () => {
    expect(backupBaseUrl()).toBe("https://api.groq.com/openai/v1");
    expect(backupModel()).toBe("llama-3.3-70b-versatile");
  });

  it("switches provider with nothing but a base URL and a model", () => {
    process.env.AI_BACKUP_BASE_URL = "https://openrouter.ai/api/v1/";
    process.env.AI_BACKUP_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
    // Trailing slash trimmed so the request path cannot end up doubled.
    expect(backupBaseUrl()).toBe("https://openrouter.ai/api/v1");
    expect(backupModel()).toBe("meta-llama/llama-3.3-70b-instruct:free");
  });
});

describe("text-only guard", () => {
  it("accepts an all-text prompt", () => {
    expect(partsAreTextOnly([{ text: "hello" }, { text: "world" }])).toBe(true);
  });

  it("rejects a prompt carrying an inline attachment", () => {
    expect(
      partsAreTextOnly([
        { text: "extract this plan" },
        { inlineData: { mimeType: "application/pdf", data: "base64" } },
      ]),
    ).toBe(false);
  });

  it("refuses to run rather than silently ignore the attachment", async () => {
    process.env.AI_BACKUP_API_KEY = "test-key";
    await expect(
      backupGenerateContent([
        { text: "read the attached plan" },
        { inlineData: { mimeType: "image/png", data: "x" } },
      ]),
    ).rejects.toThrow(/text-only/i);
  });
});

describe("request shape", () => {
  function mockFetch(body: unknown, ok = true, status = 200) {
    const fn = vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
    });
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  it("posts an OpenAI-compatible chat completion and returns the content", async () => {
    process.env.AI_BACKUP_API_KEY = "test-key";
    const fetchMock = mockFetch({
      choices: [{ message: { content: "  a plan  " } }],
    });

    const text = await backupGenerateContent([{ text: "build me a plan" }]);
    expect(text).toBe("a plan");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    const sent = JSON.parse((init as { body: string }).body);
    expect(sent.model).toBe("llama-3.3-70b-versatile");
    expect(sent.messages[0].content).toContain("build me a plan");
    expect((init as { headers: Record<string, string> }).headers.Authorization).toBe(
      "Bearer test-key",
    );
  });

  it("asks for generic JSON mode and states the schema in the prompt", async () => {
    // Gemini enforces a schema server-side. The OpenAI-compatible providers
    // differ in how much of that they accept, and a request rejected over an
    // unsupported schema field would defeat the whole point of a backup.
    process.env.AI_BACKUP_API_KEY = "test-key";
    const fetchMock = mockFetch({ choices: [{ message: { content: "{}" } }] });

    await backupGenerateContent([{ text: "go" }], {
      responseSchema: { type: "object", properties: { days: { type: "array" } } },
    });

    const sent = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(sent.response_format).toEqual({ type: "json_object" });
    expect(sent.messages[0].content).toContain(String.raw`"days"`);
  });

  it("surfaces the provider's own error message", async () => {
    process.env.AI_BACKUP_API_KEY = "test-key";
    mockFetch({ error: { message: "rate limit reached" } }, false, 429);
    await expect(backupGenerateContent([{ text: "go" }])).rejects.toThrow(
      /rate limit reached/,
    );
  });

  it("treats an empty completion as a failure so the race is not won by nothing", async () => {
    process.env.AI_BACKUP_API_KEY = "test-key";
    mockFetch({ choices: [{ message: { content: "   " } }] });
    await expect(backupGenerateContent([{ text: "go" }])).rejects.toThrow(/empty/i);
  });
});
