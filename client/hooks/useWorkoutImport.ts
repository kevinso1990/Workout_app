/**
 * Workout import hook — supports image (camera/library), PDF, and
 * Excel/CSV sources. All of them go through the same AI-backed
 * `/api/import-workout` endpoint (Claude primary, Gemini fallback) and end up persisted via `saveWorkoutPlan`
 * (AsyncStorage) so the rest of the native app sees them just like any
 * manually-built plan.
 */

import { Platform, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { repsToPlanString } from "@/lib/importReps";
import { saveWorkoutPlan } from "@/lib/storage";
import type { WorkoutPlan as StorageWorkoutPlan, Exercise as StorageExercise } from "@/lib/storage";
import { getApiUrl } from "@/lib/query-client";
import { ImportRequestError } from "@/hooks/importRequestError";
import {
  formatHtmlApiError,
  isProxyWaf403,
  looksLikeHtmlBody,
} from "@/lib/httpErrors";
import {
  isJsonContentType,
  parseJsonFromText,
  readResponseBodyAsText,
} from "@/lib/fetchBody";
import {
  IMPORT_ACCEPT_HEADERS,
  IMPORT_JSON_HEADERS,
} from "@/lib/importApiHeaders";

export { ImportRequestError } from "@/hooks/importRequestError";
export { formatImportFailure } from "@/hooks/importRequestError";

// 3 MB in base64 characters (~4 MB raw). Images larger than this are
// compressed client-side before being sent to the server.
const MAX_BASE64_BYTES = 3 * 1024 * 1024;

export type ImportMatchQuality = "exact" | "fuzzy" | "uncertain";

export interface ImportedExerciseImportMeta {
  originalName: string;
  matchQuality: ImportMatchQuality;
  /** Server: weak catalog match — user should confirm or pick another exercise. */
  needsUserMapping?: boolean;
}

export interface ImportedExercise {
  name: string;
  sets: number;
  /** Single rep target (number) or range text e.g. "8-12" after user edit. */
  reps: number | string | null;
  weight: number | null;
  notes: string | null;
  /** SQLite catalog id when mapped to the exercise library. */
  catalogExerciseId?: number | null;
  /** Filled by server after catalog matching. */
  muscleGroup?: string;
  importMeta?: ImportedExerciseImportMeta;
}

/** Server could not read any exercises (422 IMPORT_UNREADABLE). */
export class WorkoutImportUnreadableError extends Error {
  override readonly name = "WorkoutImportUnreadableError";
  constructor() {
    super("IMPORT_UNREADABLE");
  }
}

export interface ImportedWorkoutDay {
  dayName: string;
  exercises: ImportedExercise[];
}

export interface ImportedWorkoutPlan {
  planName: string;
  days: ImportedWorkoutDay[];
  /** Server: KI hat keine lesbaren Übungen geliefert — manueller Aufbau im Client. */
  emptyPlan?: boolean;
}

export interface PickedImage {
  uri: string;
  base64: string;
  mediaType: string;
}

export interface PickedFile {
  uri: string;
  name: string;
  base64: string;
  mediaType: string;
  /** App-owned copy for native multipart upload (PDF). */
  uploadUri?: string;
  /** Web: browser File/Blob for direct FormData upload. */
  webFile?: File | Blob;
  /** "pdf" | "spreadsheet" — chosen by mime type / extension. */
  kind: "pdf" | "spreadsheet";
}

const SPREADSHEET_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel",                                          // .xls
  "text/csv",
  "application/csv",
]);

const SPREADSHEET_EXTENSIONS = [".xlsx", ".xls", ".csv"];

const IMPORT_LOG = "[WorkoutImport]";
const IMPORT_FETCH_TIMEOUT_MS = 45_000;

function logImportDebug(stage: string, detail?: Record<string, unknown>) {
  if (detail) {
    console.log(`${IMPORT_LOG} ${stage}`, detail);
  } else {
    console.log(`${IMPORT_LOG} ${stage}`);
  }
}

function logImportError(stage: string, err: unknown, detail?: Record<string, unknown>) {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`${IMPORT_LOG} ${stage}`, { ...detail, errorMessage: msg, stack });
}

const TEMP_IMPORT_PDF = "temp_import.pdf";

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] ?? "";
      resolve(sanitizeBase64(base64));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(blob);
  });
}

async function readWebDocumentFile(
  asset: DocumentPicker.DocumentPickerAsset,
  kind: PickedFile["kind"],
): Promise<PickedFile> {
  const webFile = (asset as DocumentPicker.DocumentPickerAsset & { file?: File }).file;
  let fileBlob: Blob | File | null = webFile ?? null;

  if (!fileBlob) {
    try {
      const res = await fetch(asset.uri);
      fileBlob = await res.blob();
    } catch (err) {
      logImportError("web:fetch_blob_failed", err, { uri: asset.uri.slice(0, 120) });
      throw err;
    }
  }

  const base64 = await blobToBase64(fileBlob);
  const mediaType =
    asset.mimeType ||
    fileBlob.type ||
    (kind === "pdf" ? "application/pdf" : "application/octet-stream");

  return {
    uri: asset.uri,
    name: asset.name,
    base64,
    mediaType,
    webFile: fileBlob,
    kind,
  };
}

/** Strip CRLF from Base64 so JSON transport cannot break on multi-line encodings. */
function sanitizeBase64(base64String: string): string {
  return base64String.replace(/[\r\n]/g, "");
}

/**
 * iOS: copy picked PDF into app-owned storage, then read Base64 from the local file.
 * Security-scoped picker URIs often fail on direct read / fetch pipelines.
 */
async function readPdfAsBase64FromPicker(
  sourceUri: string,
): Promise<{ base64: string; uploadUri: string }> {
  const docDir = FileSystem.documentDirectory;
  logImportDebug("pdf:read_start", {
    platform: Platform.OS,
    hasDocumentDir: !!docDir,
    sourcePreview: sourceUri.slice(0, 120),
  });

  if (!docDir) {
    const err = new Error("Application document directory is unavailable.");
    logImportError("pdf:no_document_directory", err);
    throw err;
  }

  const destUri = `${docDir}${TEMP_IMPORT_PDF}`;

  try {
    await FileSystem.deleteAsync(destUri, { idempotent: true });
  } catch (cleanupErr) {
    logImportError("pdf:pre_delete_failed", cleanupErr, { destUri });
  }

  try {
    logImportDebug("pdf:copyAsync", { from: sourceUri.slice(0, 120), to: destUri });
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    logImportDebug("pdf:copy_ok");
  } catch (err) {
    logImportError("pdf:copy_failed", err, {
      from: sourceUri.slice(0, 160),
      to: destUri,
    });
    throw err;
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(destUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    logImportDebug("pdf:read_base64_ok", { base64Chars: base64.length });
    if (!base64?.length) {
      throw new Error("PDF read returned empty data.");
    }
    return { base64: sanitizeBase64(base64), uploadUri: destUri };
  } catch (err) {
    logImportError("pdf:read_base64_failed", err, { destUri });
    throw err;
  }
}

/**
 * iOS: reading the picked URI in-place often fails (sandbox / security-scoped /
 * transient cache). Copy into app-owned `documentDirectory` first, then read
 * Base64 from that path, then delete the copy.
 */
async function readPickedDocumentAsBase64(
  sourceUri: string,
  meta: { kind: PickedFile["kind"]; name: string }
): Promise<string> {
  const docDir = FileSystem.documentDirectory;
  const ext = meta.kind === "pdf" ? "pdf" : "bin";
  const destFile = `workout-import-${meta.kind}-${Date.now()}.${ext}`;
  logImportDebug("document:read_start", {
    kind: meta.kind,
    name: meta.name,
    hasDocumentDir: !!docDir,
    sourcePreview: sourceUri.slice(0, 96),
  });

  if (!docDir) {
    logImportDebug("document:no_documentDirectory_try_direct_read", { platform: Platform.OS });
    try {
      const base64 = await FileSystem.readAsStringAsync(sourceUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      logImportDebug("document:direct_read_ok", { base64Chars: base64.length });
      return base64;
    } catch (err) {
      logImportError("document:direct_read_failed", err, {
        sourcePreview: sourceUri.slice(0, 120),
      });
      throw err;
    }
  }

  const destUri = `${docDir}${destFile}`;
  try {
    logImportDebug("document:copyAsync", {
      fromPreview: sourceUri.slice(0, 120),
      to: destUri,
    });
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    logImportDebug("document:copy_ok");
  } catch (err) {
    logImportError("document:copy_failed", err, {
      fromPreview: sourceUri.slice(0, 120),
      to: destUri,
    });
    throw err;
  }

  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(destUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    logImportDebug("document:read_base64_ok", { base64Chars: base64.length });
  } catch (err) {
    logImportError("document:read_base64_failed", err, { destUri });
    throw err;
  } finally {
    try {
      await FileSystem.deleteAsync(destUri, { idempotent: true });
      logImportDebug("document:temp_deleted");
    } catch (cleanupErr) {
      logImportError("document:temp_delete_failed", cleanupErr, { destUri });
    }
  }

  return base64;
}

function classifyFile(name: string, mime: string | undefined): PickedFile["kind"] | null {
  const lowerName = name.toLowerCase();
  const lowerMime = (mime || "").toLowerCase();
  if (lowerMime === "application/pdf" || lowerName.endsWith(".pdf")) return "pdf";
  if (SPREADSHEET_MIMES.has(lowerMime)) return "spreadsheet";
  if (SPREADSHEET_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) return "spreadsheet";
  return null;
}

/**
 * Try to open the device Settings page so the user can grant photo/camera
 * access. Silently no-ops on web or if Linking is unavailable.
 */
export async function openAppSettings(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Linking.openSettings();
  } catch {
    // openSettings not supported on this platform
  }
}

export function useWorkoutImport() {
  // ── Pickers ────────────────────────────────────────────────────────────────

  /**
   * Picks an image from the camera or photo library.
   *
   * Returns `null` if the user cancelled without selecting a photo.
   * Throws a descriptive Error if the required permission was denied — the
   * caller should display the message and optionally call `openAppSettings()`.
   */
  async function pickImage(source: "camera" | "library"): Promise<PickedImage | null> {
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        const canAsk = perm.canAskAgain ?? true;
        throw new Error(
          canAsk
            ? "Camera access is required to take a photo. Please allow access when prompted."
            : "Camera access was denied. Open Settings to allow this app to use your camera."
        );
      }
      const result = await ImagePicker.launchCameraAsync({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mediaTypes: ["images"] as any,
        quality: 0.8,
        allowsEditing: false,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return null;
      const asset = result.assets[0];
      const base64 =
        asset.base64 ??
        (await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        }));
      return { uri: asset.uri, base64, mediaType: asset.mimeType || "image/jpeg" };
    }

    // ── Photo library ──────────────────────────────────────────────────────
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();

    // iOS 14+ "limited" access returns status:"granted" with accessPrivileges:"limited".
    // Older SDK builds may surface status:"limited" directly — treat both as OK.
    const permissionOk =
      perm.status === "granted" ||
      (perm as unknown as { status: string }).status === "limited";

    if (!permissionOk) {
      const canAsk = perm.canAskAgain ?? true;
      throw new Error(
        canAsk
          ? "Photo library access is required. Please allow access when prompted."
          : "Photo library access was denied. Open Settings to allow this app to access your photos."
      );
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mediaTypes: ["images"] as any,
      quality: 0.8,
      allowsEditing: false,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    const base64 =
      asset.base64 ??
      (await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      }));
    return { uri: asset.uri, base64, mediaType: asset.mimeType || "image/jpeg" };
  }

  /**
   * Lets the user pick a PDF or spreadsheet (xlsx/xls/csv). Returns null if
   * the picker was cancelled or the file type is not supported (in which case
   * the caller should surface a friendly error rather than crashing).
   */
  async function pickFile(): Promise<PickedFile | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
        "application/csv",
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return null;

    const asset = result.assets[0];
    const kind = classifyFile(asset.name, asset.mimeType);
    if (!kind) return null;

    if (Platform.OS === "web") {
      return readWebDocumentFile(asset, kind);
    }

    let base64: string;
    let uploadUri: string | undefined;
    if (kind === "pdf") {
      const pdf = await readPdfAsBase64FromPicker(asset.uri);
      base64 = pdf.base64;
      uploadUri = pdf.uploadUri;
    } else {
      base64 = await readPickedDocumentAsBase64(asset.uri, {
        kind,
        name: asset.name,
      });
    }
    return {
      uri: asset.uri,
      name: asset.name,
      base64,
      uploadUri,
      mediaType: asset.mimeType || (kind === "pdf" ? "application/pdf" : "application/octet-stream"),
      kind,
    };
  }

  // ── Network ────────────────────────────────────────────────────────────────

  async function postImportPdfMultipart(fileUri: string): Promise<ImportedWorkoutPlan> {
    const url = new URL("/api/import-workout", getApiUrl()).toString();
    const form = new FormData();
    form.append("pdf", {
      uri: fileUri,
      name: "import.pdf",
      type: "application/pdf",
    } as unknown as Blob);

    return postImportPdfFormData(form, url, "multipart-pdf-native");
  }

  async function postImportPdfMultipartWeb(
    file: File | Blob,
    fileName: string,
  ): Promise<ImportedWorkoutPlan> {
    const url = new URL("/api/import-workout", getApiUrl()).toString();
    const form = new FormData();
    const name = fileName.toLowerCase().endsWith(".pdf") ? fileName : "import.pdf";
    form.append("pdf", file, name);

    return postImportPdfFormData(form, url, "multipart-pdf-web");
  }

  async function postImportPdfFormData(
    form: FormData,
    url: string,
    transport: string,
  ): Promise<ImportedWorkoutPlan> {
    logImportDebug("postImport:multipart_pdf_start", {
      url,
      transport,
      timeoutMs: IMPORT_FETCH_TIMEOUT_MS,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMPORT_FETCH_TIMEOUT_MS);

    try {
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { ...IMPORT_ACCEPT_HEADERS },
          body: form,
          signal: controller.signal,
        });
      } catch (err) {
        return handleImportFetchError(err, url, transport);
      } finally {
        clearTimeout(timeoutId);
      }
      return parseImportResponse(response, url);
    } catch (e) {
      return rethrowImportError(e, url);
    }
  }

  function handleImportFetchError(
    err: unknown,
    url: string,
    transport: string,
    bodyBytes?: number,
  ): never {
    const nativeMessage = err instanceof Error ? err.message : String(err);
    const isAbort = err instanceof Error && err.name === "AbortError";
    const isNetwork =
      nativeMessage === "Network request failed" ||
      nativeMessage.includes("Network request failed");

    logImportError("postImport:network_or_fetch_failed", err, {
      transport,
      bodyBytes,
      url,
      platform: Platform.OS,
      isAbort,
      isNetwork,
    });

    if (isAbort) {
      throw new ImportRequestError({
        statusCode: null,
        nativeMessage: `Request aborted (45s timeout). Try a smaller PDF or stronger Wi‑Fi.`,
        url,
      });
    }

    const devHint =
      Platform.OS !== "web" && isNetwork
        ? ` Cannot reach API at ${url}. On a physical device, set EXPO_PUBLIC_API_URL to your computer's LAN IP (e.g. http://192.168.1.10:5000/) — localhost only works in the simulator.`
        : "";

    throw new ImportRequestError({
      statusCode: null,
      nativeMessage: `${nativeMessage}${devHint}`,
      url,
    });
  }

  async function parseImportResponse(
    response: Response,
    url: string,
  ): Promise<ImportedWorkoutPlan> {
    const contentType = response.headers.get("content-type");

    let bodyText: string;
    try {
      bodyText = await readResponseBodyAsText(response);
    } catch (readErr) {
      const nativeMessage =
        readErr instanceof Error ? readErr.message : String(readErr);
      throw new ImportRequestError({
        statusCode: response.status,
        nativeMessage: `Failed to read response body: ${nativeMessage}`,
        url,
      });
    }

    if (!response.ok) {
      const errBody = parseJsonFromText<{ code?: string; error?: string }>(bodyText);
      logImportError("postImport:http_error", new Error(`HTTP ${response.status}`), {
        status: response.status,
        bodyPreview: bodyText.slice(0, 500),
      });
      if (
        response.status === 422 &&
        errBody &&
        (errBody.code === "IMPORT_UNREADABLE" || errBody.error === "IMPORT_UNREADABLE")
      ) {
        throw new WorkoutImportUnreadableError();
      }
      const serverMsg =
        response.status === 403 && isProxyWaf403(bodyText)
          ? `Blocked before API (wrong host or proxy). Check EXPO_PUBLIC_API_URL and server:dev.`
          : looksLikeHtmlBody(bodyText)
            ? formatHtmlApiError(response.status, url)
            : errBody?.error && typeof errBody.error === "string"
              ? errBody.error
              : `Import failed (${response.status}): ${bodyText.slice(0, 200)}`;
      throw new ImportRequestError({
        statusCode: response.status,
        nativeMessage: serverMsg,
        responseBodyPreview: bodyText,
        url,
      });
    }

    const parsed =
      isJsonContentType(contentType) || bodyText.trim().startsWith("{")
        ? parseJsonFromText<ImportedWorkoutPlan>(bodyText)
        : null;

    if (parsed == null) {
      if (bodyText && looksLikeHtmlBody(bodyText)) {
        throw new ImportRequestError({
          statusCode: response.status,
          nativeMessage: formatHtmlApiError(response.status, url),
          responseBodyPreview: bodyText,
          url,
        });
      }
      throw new ImportRequestError({
        statusCode: response.status,
        nativeMessage: "Import succeeded but response was not valid JSON.",
        responseBodyPreview: bodyText,
        url,
      });
    }

    return parsed;
  }

  function rethrowImportError(e: unknown, url: string): never {
    if (e instanceof WorkoutImportUnreadableError) throw e;
    if (e instanceof ImportRequestError) throw e;
    const nativeMessage = e instanceof Error ? e.message : String(e);
    throw new ImportRequestError({
      statusCode: null,
      nativeMessage,
      url,
    });
  }

  async function postImport(payload: Record<string, unknown>): Promise<ImportedWorkoutPlan> {
    const url = new URL("/api/import-workout", getApiUrl()).toString();
    const keys = Object.keys(payload);

    logImportDebug("postImport:fetch_start", {
      url,
      payloadKeys: keys,
      hasSpreadsheet: !!payload.spreadsheet,
      imageCount: Array.isArray(payload.images) ? payload.images.length : 0,
      timeoutMs: IMPORT_FETCH_TIMEOUT_MS,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMPORT_FETCH_TIMEOUT_MS);
    const bodyJson = JSON.stringify(payload);

    try {
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { ...IMPORT_JSON_HEADERS },
          body: bodyJson,
          signal: controller.signal,
        });
      } catch (err) {
        return handleImportFetchError(err, url, "json", bodyJson.length);
      } finally {
        clearTimeout(timeoutId);
      }

      return parseImportResponse(response, url);
    } catch (e) {
      return rethrowImportError(e, url);
    }
  }

  async function compressIfNeeded(img: PickedImage): Promise<PickedImage> {
    if (img.base64.length <= MAX_BASE64_BYTES) return img;
    try {
      const result = await ImageManipulator.manipulateAsync(
        img.uri,
        [{ resize: { width: 1280 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
      return {
        uri: result.uri,
        base64: result.base64 || img.base64,
        mediaType: "image/jpeg",
      };
    } catch {
      return img;
    }
  }

  /**
   * Sends every picked image to the backend in a single request so the AI can
   * merge them (e.g. multiple photos of the same plan) into ONE plan.
   * Images larger than 3 MB base64 are compressed before sending.
   */
  async function analyzeImages(images: PickedImage[]): Promise<ImportedWorkoutPlan> {
    if (images.length === 0) throw new Error("No images selected");
    const compressed = await Promise.all(images.map(compressIfNeeded));
    return postImport({
      images: compressed.map((img) => ({ base64: img.base64, mediaType: img.mediaType })),
    });
  }

  async function analyzeFile(file: PickedFile): Promise<ImportedWorkoutPlan> {
    if (file.kind === "pdf") {
      logImportDebug("analyzeFile:pdf", {
        base64Chars: file.base64.length,
        hasUploadUri: !!file.uploadUri,
        hasWebFile: !!file.webFile,
      });
      if (Platform.OS === "web") {
        if (file.webFile) {
          return postImportPdfMultipartWeb(file.webFile, file.name);
        }
        const blob = await (await fetch(file.uri)).blob();
        return postImportPdfMultipartWeb(blob, file.name);
      }
      if (file.uploadUri) {
        return postImportPdfMultipart(file.uploadUri);
      }
      return postImport({ pdfData: sanitizeBase64(file.base64) });
    }
    return postImport({
      spreadsheet: { base64: file.base64, mediaType: file.mediaType },
    });
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  /**
   * Saves the parsed plan into the same AsyncStorage bucket the rest of the
   * native app reads from, returning the new plan id so the caller can deep
   * link into PlanDetail / StartWorkout.
   */
  async function saveImportedPlan(plan: ImportedWorkoutPlan): Promise<string> {
    const planId = Date.now().toString();
    const storagePlan: StorageWorkoutPlan = {
      id: planId,
      name: plan.planName?.trim() || "Imported Plan",
      daysPerWeek: plan.days.length,
      days: plan.days.map((day, dIdx) => ({
        dayName: day.dayName,
        exercises: day.exercises.map((ex, idx): StorageExercise => {
          const row: StorageExercise = {
            id: `imported-${planId}-${dIdx}-${idx}`,
            name: ex.name,
            muscleGroup: (ex.muscleGroup ?? "").trim(),
            sets: ex.sets,
            reps: repsToPlanString(ex.reps),
          };
          if (ex.weight != null && Number.isFinite(ex.weight)) {
            row.targetWeight = Math.round(ex.weight * 10) / 10;
          }
          if (typeof ex.reps === "number" && Number.isFinite(ex.reps)) {
            row.targetReps = Math.min(120, Math.max(0, Math.floor(ex.reps)));
          } else if (typeof ex.reps === "string") {
            const first = ex.reps.match(/(\d+)/);
            if (first) {
              row.targetReps = Math.min(120, Math.max(0, parseInt(first[1], 10)));
            }
          }
          return row;
        }),
      })),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };
    await saveWorkoutPlan(storagePlan);
    return planId;
  }

  async function analyzePlainText(text: string): Promise<ImportedWorkoutPlan> {
    const trimmed = text.trim();
    if (trimmed.length < 20) {
      throw new Error("Paste at least a few lines of your workout plan.");
    }
    return postImport({ plainText: trimmed });
  }

  return { pickImage, pickFile, analyzeImages, analyzeFile, analyzePlainText, saveImportedPlan };
}
