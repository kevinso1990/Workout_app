import express from 'express';
import type { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import type { Part } from '@google/generative-ai';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { rateLimit } from '../middleware/rateLimiter';
import { geminiGenerateContent } from '../services/geminiGenerate';
import { matchExerciseToCatalog } from '../services/importExerciseMatchService';
import { IMPORT_WORKOUT_EXTRACTION_PROMPT } from '../services/aiGenerator';

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

/** Reject duplicate exercise names across different days (LLM copy-paste guard). */
function deduplicateExercisesAcrossDays(raw: Record<string, unknown>): void {
  const days = raw.days;
  if (!Array.isArray(days) || days.length < 2) return;

  const globalUsed = new Set<string>();

  for (const day of days) {
    if (typeof day !== "object" || day === null) continue;
    const d = day as Record<string, unknown>;
    const exercises = d.exercises;
    if (!Array.isArray(exercises)) continue;

    const kept: Record<string, unknown>[] = [];
    for (const ex of exercises) {
      if (typeof ex !== "object" || ex === null) continue;
      const e = ex as Record<string, unknown>;
      const name = String(e.name ?? "").trim();
      if (!name) continue;
      const key = normalizeExerciseKey(name);
      if (globalUsed.has(key)) continue;
      globalUsed.add(key);
      kept.push(e);
    }
    d.exercises = kept;
  }
}

function normalizeImportedPlan(raw: Record<string, unknown>): Record<string, unknown> {
  const planName =
    typeof raw.planName === "string" && raw.planName.trim() ? raw.planName.trim() : "Imported Plan";
  raw.planName = planName;

  const days = raw.days;
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
    const exercises = d.exercises;
    if (!Array.isArray(exercises)) {
      d.exercises = [];
      continue;
    }

    const cleaned: Record<string, unknown>[] = [];
    for (const ex of exercises) {
      if (typeof ex !== "object" || ex === null) continue;
      const e = ex as Record<string, unknown>;
      const rawName = String(e.name ?? "").trim();
      if (!rawName) continue;

      const m = matchExerciseToCatalog(rawName);
      e.name = m.canonicalName;
      e.muscleGroup = m.muscleGroup;
      e.catalogExerciseId = m.catalogExerciseId;
      e.importMeta = {
        originalName: m.originalName,
        matchQuality: m.matchQuality,
        needsUserMapping: m.needsUserMapping,
      };
      e.sets = coerceNumber(e.sets, 3);
      if (e.reps !== null && e.reps !== undefined && e.reps !== "") {
        const r = typeof e.reps === "number" ? e.reps : parseInt(String(e.reps), 10);
        e.reps = Number.isFinite(r) ? Math.min(120, Math.max(0, Math.floor(r))) : null;
      } else {
        e.reps = null;
      }
      if (e.weight !== null && e.weight !== undefined && e.weight !== "") {
        const w = typeof e.weight === "number" ? e.weight : parseFloat(String(e.weight).replace(",", "."));
        e.weight = Number.isFinite(w) ? Math.round(w * 10) / 10 : null;
      } else {
        e.weight = null;
      }
      if (e.notes !== null && e.notes !== undefined) {
        e.notes = String(e.notes).trim() || null;
      } else {
        e.notes = null;
      }

      cleaned.push(e);
      exerciseCount++;
    }
    d.exercises = cleaned;
  }

  if (exerciseCount === 0) {
    raw.emptyPlan = true;
    return raw;
  }

  deduplicateExercisesAcrossDays(raw);
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
}

/**
 * Heuristic: a CSV block is "readable" when most characters are printable
 * ASCII / common whitespace.
 */
function isReadableText(s: string): boolean {
  if (!s) return false;
  let printable = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)) {
      printable++;
    }
  }
  return printable / s.length >= 0.9;
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
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse workout plan from input');
  return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
}

/**
 * Call Claude (primary).  Handles images, PDFs, and spreadsheet text.
 */
async function callClaude(
  images: ImportImage[],
  pdfBase64: string | null,
  spreadsheetText: string | null,
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

  if (pdfBase64) {
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
    max_tokens: 4096,
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
): Promise<string> {
  const parts: Part[] = [];
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mediaType || 'image/jpeg', data: img.base64 } });
  }
  if (pdfBase64) {
    parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } });
  }
  if (spreadsheetText) {
    parts.push({ text: `Spreadsheet contents:\n\n${spreadsheetText}` });
  }
  parts.push({ text: IMPORT_WORKOUT_EXTRACTION_PROMPT });

  return geminiGenerateContent(parts, { grounding: true });
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

    if (images.length === 0 && !hasPdf && !hasSpreadsheet) {
      res.status(400).json({ error: 'No images, PDF, or spreadsheet provided' });
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
      res.status(500).json({ error: 'No AI provider configured (ANTHROPIC_API_KEY or GEMINI_API_KEY required)' });
      return;
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

    const pdfBase64 = hasPdf ? pdfBase64FromBody : null;

    // Try Claude first; fall back to Gemini on any error.
    let rawText: string;
    let usedProvider = 'claude';

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        rawText = await callClaude(images, pdfBase64, spreadsheetText);
      } catch (claudeErr) {
        console.warn('Claude failed, trying Gemini fallback:', (claudeErr as Error).message);
        usedProvider = 'gemini';
        rawText = await callGemini(images, pdfBase64, spreadsheetText);
      }
    } else {
      usedProvider = 'gemini';
      rawText = await callGemini(images, pdfBase64, spreadsheetText);
    }

    const plan = normalizeImportedPlan(extractPlan(rawText));
    console.log(`[import-workout] parsed plan via ${usedProvider}:`, (plan as { planName?: string }).planName ?? '(unnamed)');
    res.json(plan);
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
      message = err.message;
      const geminiErr = err as Error & {
        errorDetails?: Array<{ message?: string }>;
        status?: string;
      };
      const detail = geminiErr.errorDetails?.[0]?.message ?? geminiErr.status ?? null;
      if (detail) message = `${message} — ${detail}`;
    }
    res.status(500).json({ error: message });
  }
}

router.post('/import-workout', importLimiter, (req, res, next) => {
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
