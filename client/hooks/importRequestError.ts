/** Structured import failure for UI + logs (fetch, HTTP, timeout, ATS). */
export class ImportRequestError extends Error {
  readonly statusCode: number | null;
  readonly responseBodyPreview: string | null;
  readonly nativeMessage: string;
  readonly url: string;

  constructor(params: {
    statusCode: number | null;
    nativeMessage: string;
    responseBodyPreview?: string | null;
    url: string;
  }) {
    const body =
      params.responseBodyPreview?.trim().slice(0, 100) ?? null;
    const statusLabel =
      params.statusCode != null ? String(params.statusCode) : "Network";
    const message = `Import Error: [${statusLabel}] | Message: ${params.nativeMessage}${
      body ? ` | Body: ${body}` : ""
    }`;
    super(message);
    this.name = "ImportRequestError";
    this.statusCode = params.statusCode;
    this.nativeMessage = params.nativeMessage;
    this.responseBodyPreview = body;
    this.url = params.url;
  }
}

export function formatImportFailure(e: unknown, fallback = "Unknown import failure"): string {
  if (e instanceof ImportRequestError) return e.message;
  if (e instanceof Error) return `Import Error: [Network] | Message: ${e.message}`;
  return `Import Error: [Network] | Message: ${fallback}`;
}
