/** Maps raw LLM provider errors to short, user-facing messages. */
export function formatAiServiceError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("prepayment credits") ||
    lower.includes("credit") && lower.includes("depleted") ||
    lower.includes("quota") ||
    lower.includes("resource exhausted") ||
    lower.includes("billing")
  ) {
    return (
      "KI-Kontingent erschöpft. Der Server hat kein Guthaben mehr für Gemini/Claude. " +
      "Bitte GEMINI_API_KEY oder ANTHROPIC_API_KEY auf dem Server mit Guthaben hinterlegen."
    );
  }
  if (lower.includes("all gemini models failed")) {
    return formatAiServiceError(raw.split("—").pop()?.trim() ?? raw);
  }
  return raw;
}
