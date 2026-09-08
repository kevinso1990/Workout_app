/**
 * Regression guard for the production outage where plan generation failed for
 * every user while Gemini itself was healthy.
 *
 * Gemini's free tier answers a large prompt with 503 "This model is currently
 * experiencing high demand" fairly often. That is a transient capacity signal,
 * but the old code treated any error as "this model is broken", moved to the
 * next one in a two-model chain, exhausted it, and threw — so the app hung
 * until its own 75s timeout and silently fell back to a template plan.
 *
 * The classifier below decides retry vs give-up, so it is worth pinning down.
 */

import { describe, it, expect } from "vitest";
import { isRetryableGeminiError } from "../services/gemini";

describe("isRetryableGeminiError — transient upstream conditions", () => {
  it("retries the exact 503 message that caused the outage", () => {
    const real =
      "[GoogleGenerativeAI Error]: Error fetching from " +
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent: " +
      "[503 Service Unavailable] This model is currently experiencing high demand. " +
      "Spikes in demand are usually temporary. Please try again later.";
    expect(isRetryableGeminiError(real)).toBe(true);
  });

  it("retries rate limiting and the other 5xx family", () => {
    for (const m of [
      "[429 Too Many Requests] rate limit exceeded",
      "[500 Internal Server Error]",
      "[502 Bad Gateway]",
      "[504 Gateway Timeout]",
      "Quota exceeded for this project",
      "The model is overloaded, try again",
    ]) {
      expect(isRetryableGeminiError(m), m).toBe(true);
    }
  });

  it("retries transport-level failures", () => {
    for (const m of [
      "fetch failed",
      "socket hang up",
      "read ECONNRESET",
      "connect ETIMEDOUT 142.250.1.1:443",
      "getaddrinfo EAI_AGAIN generativelanguage.googleapis.com",
      "Request timed out",
    ]) {
      expect(isRetryableGeminiError(m), m).toBe(true);
    }
  });
});

describe("isRetryableGeminiError — real faults must NOT be retried", () => {
  it("does not retry auth, argument or safety errors", () => {
    for (const m of [
      "[400 Bad Request] API key not valid. Please pass a valid API key.",
      "[401 Unauthorized]",
      "[403 Forbidden] permission denied",
      "[404 Not Found] models/gemini-does-not-exist is not found",
      "GEMINI_API_KEY not configured",
      "Candidate was blocked due to SAFETY",
      "Invalid JSON payload received. Unknown name \"foo\"",
    ]) {
      expect(isRetryableGeminiError(m), m).toBe(false);
    }
  });

  it("does not treat an unrelated number as a status code", () => {
    // "503" must be matched as a token, not as part of a longer number —
    // otherwise a token count or an id could silently trigger endless retries.
    expect(isRetryableGeminiError("prompt had 15039 tokens")).toBe(false);
    expect(isRetryableGeminiError("request id 4297 rejected")).toBe(false);
  });
});
