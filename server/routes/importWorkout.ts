import express from 'express';
import type { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import type { Part } from '@google/generative-ai';
import multer from 'multer';
import * as XLSX from 'xlsx';
// Import the worker directly to avoid pdf-parse's index.js debug-mode side effect.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { rateLimit } from '../middleware/rateLimiter';
import { aiUsageGuard } from '../middleware/aiUsageGuard';
import { geminiGenerateContent } from '../services/geminiGenerate';
import { matchExerciseToCatalog } from '../services/importExerciseMatchService';
import {
  parseWorkoutTextImport,
  isAiQuotaOrBillingError,
  extractStrengthDaySections,
  isSpreadsheetLikeText,
  type ParsedImportPlan,
} from '../services/importTextParser';
import {
  IMPORT_MUSCLE_GROUPS,
  IMPORT_WORKOUT_EXTRACTION_PROMPT,
  IMPORT_WORKOUT_RESPONSE_SCHEMA,
} from '../services/aiGenerator';
import { mergeAvoidLists } from "../../shared/avoidExercises";
import { formatAiServiceError } from '../lib/formatAiServiceError';
import {
  cleanText,
  normalizeDayKind,
  normalizeRepsTarget,
  normalizeRestSeconds,
  normalizeSchedule,
  normalizeSets,
  normalizeSuperset,
  stripWeekdaySuffix,
} from '../services/importStructure';
import { jsonrepair } from 'jsonrepair';

const router = express.Router();

// Per-IP daily cap for the AI-backed import.
const importLimiter = rateLimit(15, 24 * 60 * 60 * 1000);

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export class ImportUnreadableError extends Error {
  readonly code = "IMPORT_UNREADABLE" as const;
  constructor(message: string) {
    super(message);
    this.name = "ImportUnreadableError";
  }
}

function coerceNumber(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (Number.isFinite(n) && n > 0) return Math.min(99, Math.floor(n));
  return fallback;
}

/**
 * Normalizes LLM JSON: maps exercise names to canonical DB names and attaches muscle groups.
 * Returns `{ emptyPlan: true }` when nothing could be extracted so the client can offer a manual flow.
 */
function normalizeExerciseKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Reject a day's exercises only when the WHOLE day is a near-duplicate of an
 * earlier day (LLM copy-paste guard, e.g. hallucinating the same GK A list
 * twice). A single repeated exercise name across days — e.g. a closing
 * "Dead Hang" programmed at the end of every training day — is a completely
 * normal, legitimate plan structure and must never be dropped on its own.
 * (Previously this deduped by exercise name across a single global Set,
 * which silently deleted any exercise reused on a later day.)
 */
function deduplicateExercisesAcrossDays(raw: Record<string, unknown>): void {
  const days = raw.days;
  if (!Array.isArray(days) || days.length < 2) return;

  const seenDaySignatures: Set<string>[] = [];

  for (const day of days) {
    if (typeof day !== "object" || day === null) continue;
    const d = day as Record<string, unknown>;
    const exercises = d.exercises;
    if (!Array.isArray(exercises)) continue;

    const namesInDay = new Set<string>();
    for (const ex of exercises) {
      if (typeof ex !== "object" || ex === null) continue;
      const e = ex as Record<string, unknown>;
      const name = String(e.name ?? "").trim();
      if (name) namesInDay.add(normalizeExerciseKey(name));
    }
    if (namesInDay.size === 0) continue;

    const isDuplicateDay = seenDaySignatures.some((prior) => {
      const overlap = [...namesInDay].filter((n) => prior.has(n)).length;
      return overlap / Math.max(namesInDay.size, prior.size) >= 0.8;
    });

    if (isDuplicateDay) {
      console.warn(`[import-workout] dropped day "${String(d.dayName)}" — near-duplicate of an earlier day`);
      d.exercises = [];
    } else {
      seenDaySignatures.push(namesInDay);
    }
  }
}

export interface NormalizeImportOptions {
  /**
   * Client understands mobility/cardio days, supersets and the schedule
   * (request `?v=2`). Older app builds get strength days only — they would
   * otherwise turn a cardio day into a list of "exercises".
   */
  fullPlan?: boolean;
}

export function normalizeImportedPlan(
  raw: Record<string, unknown>,
  opts: NormalizeImportOptions = {},
): Record<string, unknown> {
  const planName =
    typeof raw.planName === "string" && raw.planName.trim() ? raw.planName.trim() : "Imported Plan";
  raw.planName = planName;

  // Names the source itself framed as "do not do" (see AVOID-LIST in the
  // extraction prompt). Sanitized the same way a user-typed entry would be —
  // trimmed, de-duplicated, capped — since this is about to sit in the same
  // list as anything typed in Profile or onboarding.
  // Deterministic safety net, independent of whether the model followed the
  // split-compound-rows instruction: an exercise name never legitimately
  // contains a comma, so splitting on one is unambiguous and catches a model
  // that still returns "V-Ups, Jackknives, Sit-Ups" as a single joined entry.
  const avoidNames = Array.isArray(raw.avoidExercises)
    ? raw.avoidExercises
        .filter((n): n is string => typeof n === "string")
        .flatMap((n) => n.split(","))
    : [];
  raw.avoidExercises = mergeAvoidLists([], avoidNames);

  const rawSchedule = raw.schedule;
  delete raw.schedule;

  let days = raw.days;
  if (!Array.isArray(days) || days.length === 0) {
    raw.days = [];
    raw.emptyPlan = true;
    return raw;
  }

  let exerciseCount = 0;

  for (const day of days) {
    if (typeof day !== "object" || day === null) continue;
    const d = day as Record<string, unknown>;
    if (typeof d.dayName !== "string" || !d.dayName.trim()) {
      d.dayName = "Day";
    }
    // "GK A lang (Sa)", "Mobility – Mo abends", "Cardio – So": the weekday
    // belongs to the schedule, not the session's name.
    d.dayName = stripWeekdaySuffix(String(d.dayName));
    d.kind = normalizeDayKind(d.kind, String(d.dayName));
    d.warmup = cleanText(d.warmup, 500);
    d.notes = cleanText(d.notes, 500);
    const dur = typeof d.durationMinutes === "number" ? d.durationMinutes : parseInt(String(d.durationMinutes ?? ""), 10);
    d.durationMinutes = Number.isFinite(dur) && dur > 0 && dur <= 300 ? Math.round(dur) : null;

    const exercises = d.exercises;
    // A cardio session is a prescription, not a list of lifts to log.
    if (!Array.isArray(exercises) || d.kind === "cardio") {
      d.exercises = [];
      continue;
    }

    const cleaned: Record<string, unknown>[] = [];
    for (const ex of exercises) {
      if (typeof ex !== "object" || ex === null) continue;
      const e = ex as Record<string, unknown>;
      // "A1 Trap Bar Deadlift" — the block prefix is structure, not name.
      const rawName = String(e.name ?? "").trim().replace(/^[A-H][1-9]\s+/, "");
      if (!rawName) continue;

      const m = matchExerciseToCatalog(rawName);
      // Weak/uncertain matches are kept (not dropped) — the client's import
      // review screen lets the user assign a catalog exercise or delete the
      // row. Silently dropping here used to eat real exercises whose names
      // just didn't fuzzy-match anything (e.g. "KB Chop Split Stance").
      if (m.needsUserMapping || m.matchQuality === "uncertain" || !m.catalogExerciseId) {
        console.warn(`[import-workout] kept unmapped row for manual assignment: "${rawName}" → ${m.matchQuality}`);
      }
      e.name = m.canonicalName;
      // An exercise the catalog doesn't know still gets the model's read of
      // what it trains, so it doesn't land in the plan without a muscle group.
      const modelGroup = typeof e.muscleGroup === "string" ? e.muscleGroup : "";
      e.muscleGroup =
        m.muscleGroup ||
        ((IMPORT_MUSCLE_GROUPS as readonly string[]).includes(modelGroup) ? modelGroup : "");
      e.catalogExerciseId = m.catalogExerciseId;
      e.importMeta = {
        originalName: m.originalName,
        matchQuality: m.matchQuality,
        needsUserMapping: m.needsUserMapping,
      };
      e.sets = normalizeSets(e.sets, 3);
      const target = normalizeRepsTarget(e.reps, e.perSide);
      e.reps = target.reps;
      e.perSide = target.perSide;
      if (e.weight !== null && e.weight !== undefined && e.weight !== "") {
        const w = typeof e.weight === "number" ? e.weight : parseFloat(String(e.weight).replace(",", "."));
        e.weight = Number.isFinite(w) ? Math.round(w * 10) / 10 : null;
      } else {
        e.weight = null;
      }
      e.notes = cleanText(e.notes);
      e.alternative = cleanText(e.alternative, 160);
      e.superset = normalizeSuperset(e.superset);
      e.restSeconds = normalizeRestSeconds(e.restSeconds);

      cleaned.push(e);
      exerciseCount++;
    }
    // A "superset" of one is just an exercise.
    for (const e of cleaned) {
      if (e.superset && cleaned.filter((o) => o.superset === e.superset).length < 2) e.superset = null;
    }
    d.exercises = cleaned;
  }

  if (!opts.fullPlan) {
    days = (days as Record<string, unknown>[]).filter((d) => d?.kind === "strength");
    raw.days = days;
  }

  if (exerciseCount === 0) {
    raw.emptyPlan = true;
    return raw;
  }

  deduplicateExercisesAcrossDays(raw);

  if (opts.fullPlan) {
    const dayNames = (raw.days as Record<string, unknown>[]).map((d) => String(d?.dayName ?? ""));
    raw.schedule = { weeks: normalizeSchedule(rawSchedule, dayNames) };
  }
  return raw;
}

interface ImportImage {
  base64: string;
  mediaType?: string;
}

interface ImportPdf {
  base64: string;
}

interface ImportSpreadsheet {
  base64: string;
  mediaType?: string;
}

interface ImportRequestBody {
  images?: ImportImage[];
  image?: string;
  mediaType?: string;
  pdf?: ImportPdf;
  /** Flat Base64 PDF payload (native iOS import). */
  pdfData?: string;
  spreadsheet?: ImportSpreadsheet;
  /** User-pasted plan text (bypasses PDF formatting issues). */
  plainText?: string;
}

/**
 * Heuristic: text is readable when most chars are whitespace or printable
 * (ASCII + common Latin letters incl. German umlauts).
 */
function isReadableText(s: string): boolean {
  if (!s) return false;
  let printable = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 32 && code <= 126) ||
      (code >= 0xc0 && code <= 0x024f) // Latin extended (ä ö ü ß …)
    ) {
      printable++;
    }
  }
  return printable / s.length >= 0.85;
}

/** Max characters of extracted PDF text we forward to the model. */
const MAX_PDF_TEXT_CHARS = 60_000;

/**
 * Extracts the embedded text layer from a (digital) PDF.
 * Returns "" for scanned/image-only PDFs that have no text layer — the caller
 * then falls back to sending the binary PDF to a vision model.
 */
export async function pdfToText(base64: string): Promise<string> {
  const buf = Buffer.from(base64, 'base64');
  const result = await pdfParse(buf);
  const text = (result?.text ?? '').trim();
  return text.length > MAX_PDF_TEXT_CHARS ? text.slice(0, MAX_PDF_TEXT_CHARS) : text;
}

/**
 * Convert an xlsx/xls/csv buffer into a compact text representation.
 */
export function spreadsheetToText(base64: string): string {
  const buf = Buffer.from(base64, 'base64');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const blocks: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
    if (!csv) continue;
    if (!isReadableText(csv)) continue;
    blocks.push(`### Sheet: ${name}\n${csv}`);
  }
  return blocks.join('\n\n');
}

/** Parse the JSON plan out of an LLM response string. */
function extractPlan(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : trimmed;
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch (parseError) {
    try {
      return JSON.parse(jsonrepair(candidate)) as Record<string, unknown>;
    } catch {
      console.error('[import-workout] extractPlan: JSON.parse and jsonrepair both failed', parseError);
      throw new Error('Could not parse workout plan from input');
    }
  }
}

/**
 * Call Claude (primary).  Handles images, PDFs, and spreadsheet text.
 */
async function callClaude(
  images: ImportImage[],
  pdfBase64: string | null,
  spreadsheetText: string | null,
  pdfText: string | null,
): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  type ClaudeContent = Anthropic.ImageBlockParam | Anthropic.TextBlockParam | Anthropic.Base64PDFSource;

  const content: (Anthropic.ImageBlockParam | Anthropic.TextBlockParam | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } })[] = [];

  for (const img of images) {
    const mimeType = (img.mediaType || 'image/jpeg') as
      | 'image/jpeg'
      | 'image/png'
      | 'image/gif'
      | 'image/webp';
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: img.base64 },
    });
  }

  if (pdfText) {
    content.push({ type: 'text', text: `PDF text contents:\n\n${pdfText}` });
  } else if (pdfBase64) {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
    } as { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } });
  }

  if (spreadsheetText) {
    content.push({ type: 'text', text: `Spreadsheet contents:\n\n${spreadsheetText}` });
  }

  content.push({ type: 'text', text: IMPORT_WORKOUT_EXTRACTION_PROMPT });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    // A full plan with cues for every row runs well past 4k tokens.
    max_tokens: 16000,
    messages: [{ role: 'user', content }],
  });

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('Empty response from Claude');
  return textBlock.text;
}

/**
 * Call Gemini (fallback).
 */
async function callGemini(
  images: ImportImage[],
  pdfBase64: string | null,
  spreadsheetText: string | null,
  pdfText: string | null,
): Promise<string> {
  const parts: Part[] = [];
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mediaType || 'image/jpeg', data: img.base64 } });
  }
  if (pdfText) {
    // Sending extracted text instead of the binary PDF keeps the request tiny
    // and avoids Gemini ResourceExhausted (quota) errors on large documents.
    parts.push({ text: `PDF text contents:\n\n${pdfText}` });
  } else if (pdfBase64) {
    parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } });
  }
  if (spreadsheetText) {
    parts.push({ text: `Spreadsheet contents:\n\n${spreadsheetText}` });
  }
  parts.push({ text: IMPORT_WORKOUT_EXTRACTION_PROMPT });

  // Text-only imports don't need Google Search grounding — it burns quota and
  // adds latency. Grounding stays enabled for image/PDF-binary vision paths.
  const useGrounding = images.length > 0 || !!pdfBase64;
  return geminiGenerateContent(parts, {
    grounding: useGrounding,
    responseSchema: IMPORT_WORKOUT_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    thinking: false,
  });
}

/** Log long text payloads without flooding the terminal. */
function logImportText(label: string, text: string): void {
  const preview = text.length > 4000 ? `${text.slice(0, 4000)}\n… [${text.length} chars total]` : text;
  console.log(`[import-workout] ${label} (${text.length} chars):\n${preview}`);
}

function parsedPlanToRaw(parsed: ParsedImportPlan): Record<string, unknown> {
  return {
    planName: parsed.planName,
    importSource: "text_parser",
    days: parsed.days.map((d) => ({
      dayName: d.dayName,
      exercises: d.exercises.map((e) => ({
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight,
        notes: e.notes,
      })),
    })),
  };
}

async function handleImportWorkout(req: Request, res: Response): Promise<void> {
  try {
    const body = (req.body ?? {}) as ImportRequestBody;

    const images: ImportImage[] = Array.isArray(body.images) && body.images.length
      ? body.images
      : body.image
        ? [{ base64: body.image, mediaType: body.mediaType }]
        : [];

    const multipartPdf = req.file;
    const pdfBase64FromBody =
      multipartPdf?.buffer
        ? multipartPdf.buffer.toString("base64")
        : typeof body.pdfData === "string" && body.pdfData.length > 0
          ? body.pdfData
          : body.pdf?.base64 ?? null;
    const hasPdf = !!pdfBase64FromBody;
    const hasSpreadsheet = !!body.spreadsheet?.base64;
    const pastedText =
      typeof body.plainText === "string" && body.plainText.trim().length >= 20
        ? body.plainText.trim().slice(0, MAX_PDF_TEXT_CHARS)
        : null;

    if (images.length === 0 && !hasPdf && !hasSpreadsheet && !pastedText) {
      res.status(400).json({ error: 'No images, PDF, spreadsheet, or text provided' });
      return;
    }

    // Validate spreadsheet early to return a clean 400 if malformed.
    let spreadsheetText: string | null = null;
    if (hasSpreadsheet) {
      try {
        spreadsheetText = spreadsheetToText(body.spreadsheet!.base64);
      } catch (err) {
        res.status(400).json({ error: 'Could not parse spreadsheet: ' + (err as Error).message });
        return;
      }
      if (!spreadsheetText) {
        res.status(400).json({ error: 'Spreadsheet contained no readable rows' });
        return;
      }
    }

    if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
      // Allow offline text import (PDF / spreadsheet / pasted text) when no AI provider is configured.
      const hasTextImport = images.length === 0 && (hasPdf || !!spreadsheetText || !!pastedText);
      if (!hasTextImport) {
        res.status(500).json({ error: 'No AI provider configured (ANTHROPIC_API_KEY or GEMINI_API_KEY required)' });
        return;
      }
    }

    // Size guards
    const MAX_BASE64_BYTES = 15 * 1024 * 1024;
    const MAX_AGGREGATE_BYTES = 20 * 1024 * 1024;
    let aggregateImageBytes = 0;
    for (const img of images) {
      if (img.base64.length > MAX_BASE64_BYTES) {
        res.status(400).json({ error: 'One or more images are too large. Please resize to under 15 MB each.' });
        return;
      }
      aggregateImageBytes += img.base64.length;
    }
    if (aggregateImageBytes > MAX_AGGREGATE_BYTES) {
      res.status(400).json({ error: 'Total image size is too large (20 MB combined limit).' });
      return;
    }
    if (hasPdf && pdfBase64FromBody!.length > MAX_BASE64_BYTES) {
      res.status(400).json({ error: 'PDF is too large. Please reduce file size to under 15 MB.' });
      return;
    }

    let pdfBase64 = hasPdf ? pdfBase64FromBody : null;

    // Prefer extracting the PDF text layer: it slashes token usage (avoiding
    // Gemini's ResourceExhausted/quota errors) and parses faster. Scanned PDFs
    // have no text layer, so we keep the binary as a vision fallback.
    let pdfText: string | null = null;
    if (hasPdf && pdfBase64) {
      try {
        const extracted = await pdfToText(pdfBase64);
        const compact = extracted.replace(/\s+/g, '');
        if (compact.length >= 80 && isReadableText(extracted)) {
          pdfText = extracted;
          pdfBase64 = null;
          console.log(`[import-workout] using extracted PDF text (${extracted.length} chars)`);
        }
      } catch (pdfErr) {
        console.warn('[import-workout] pdf text extraction failed, falling back to binary PDF:', (pdfErr as Error).message);
      }
    }

    const plainText = [pdfText, spreadsheetText, pastedText].filter(Boolean).join("\n\n") || null;
    if (pdfText) {
      logImportText('extracted PDF text', pdfText);
    }
    // The model gets the whole document: the schedule, rotation, warm-ups and
    // mobility/cardio sessions are part of the plan. Only the offline parser
    // (no AI) works on the pre-filtered strength sections.
    const aiText = plainText;
    const offlineText =
      plainText && !isSpreadsheetLikeText(plainText) ? extractStrengthDaySections(plainText) : plainText;
    const fullPlan = String(req.query.v ?? "") === "2";

    if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
      if (offlineText) {
        const fallback = parseWorkoutTextImport(offlineText, { minExercises: 1 });
        if (fallback) {
          const plan = normalizeImportedPlan(parsedPlanToRaw(fallback));
          console.log(`[import-workout] parsed plan via text_parser (no AI keys):`, (plan as { planName?: string }).planName ?? '(unnamed)');
          res.json(plan);
          return;
        }
      }
      res.status(422).json({
        code: 'IMPORT_UNREADABLE',
        error: 'IMPORT_UNREADABLE',
      });
      return;
    }

    // Try Claude first; fall back to Gemini on any error.
    let rawText: string;
    let usedProvider = 'claude';

    try {
      if (process.env.ANTHROPIC_API_KEY) {
        try {
          rawText = await callClaude(images, pdfBase64, spreadsheetText, aiText);
        } catch (claudeErr) {
          console.warn('Claude failed, trying Gemini fallback:', (claudeErr as Error).message);
          usedProvider = 'gemini';
          rawText = await callGemini(images, pdfBase64, spreadsheetText, aiText);
        }
      } else {
        usedProvider = 'gemini';
        rawText = await callGemini(images, pdfBase64, spreadsheetText, aiText);
      }

      console.log(`[import-workout] ${usedProvider} raw response:\n${rawText}`);

      const plan = normalizeImportedPlan(extractPlan(rawText), { fullPlan });
      console.log(`[import-workout] parsed plan via ${usedProvider}:`, (plan as { planName?: string }).planName ?? '(unnamed)');
      res.json(plan);
    } catch (aiErr) {
      // When AI quota/billing is exhausted but we have readable text, fall back
      // to the offline parser on pre-filtered strength sections only.
      if (offlineText && isAiQuotaOrBillingError(aiErr)) {
        const fallback = parseWorkoutTextImport(offlineText, { minExercises: 1 });
        if (fallback) {
          const plan = normalizeImportedPlan(parsedPlanToRaw(fallback));
          console.warn('[import-workout] AI quota exhausted — used text_parser fallback');
          res.json({ ...plan, importWarning: 'KI-Kontingent erschöpft — Plan per Text-Analyse importiert. Bitte Übungen prüfen.' });
          return;
        }
      }
      throw aiErr;
    }
  } catch (err: unknown) {
    if (err instanceof ImportUnreadableError) {
      res.status(422).json({
        code: err.code,
        error: "IMPORT_UNREADABLE",
      });
      return;
    }
    console.error('Import workout error:', err);
    let message = 'Internal server error';
    if (err instanceof Error) {
      message = formatAiServiceError(err.message);
      const geminiErr = err as Error & {
        errorDetails?: Array<{ message?: string }>;
        status?: string;
      };
      const detail = geminiErr.errorDetails?.[0]?.message ?? geminiErr.status ?? null;
      if (detail && !message.includes("KI-Kontingent")) {
        message = formatAiServiceError(`${message} — ${detail}`);
      }
    }
    res.status(500).json({ error: message, code: 'IMPORT_AI_FAILED' });
  }
}

router.post('/import-workout', importLimiter, aiUsageGuard, (req, res, next) => {
  const ct = req.headers['content-type'] ?? '';
  if (ct.includes('multipart/form-data')) {
    pdfUpload.single('pdf')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid PDF upload' });
        return;
      }
      void handleImportWorkout(req, res);
    });
    return;
  }
  void handleImportWorkout(req, res);
});

export default router;
