/**
 * Read a fetch Response body exactly once (avoids "Body has already been read").
 */

export async function readResponseBodyAsText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("already been read")) {
      throw new Error(
        "Response body was already consumed. Use a single read (text or json), not both.",
      );
    }
    throw err;
  }
}

export function parseJsonFromText<T = unknown>(text: string): T | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

export function isJsonContentType(contentType: string | null): boolean {
  return (contentType ?? "").toLowerCase().includes("application/json");
}
