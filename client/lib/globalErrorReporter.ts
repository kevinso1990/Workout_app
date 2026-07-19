import { Platform } from "react-native";

import { ERROR_FALLBACK_COPY } from "@/constants/errorCopy";

export type CapturedError = {
  message: string;
  stack: string;
  componentStack: string;
  source: string;
  at: number;
};

let lastCaptured: CapturedError | null = null;
const listeners = new Set<(err: CapturedError) => void>();

const OVERLAY_ID = "fitplan-fatal-error-overlay";

function normalizeError(error: unknown): { message: string; stack: string } {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || "Error",
      stack: error.stack ?? "",
    };
  }
  if (typeof error === "string") {
    return { message: error, stack: "" };
  }
  try {
    return { message: JSON.stringify(error), stack: "" };
  } catch {
    return { message: String(error), stack: "" };
  }
}

export function getLastCapturedError(): CapturedError | null {
  return lastCaptured;
}

export function clearCapturedError(): void {
  lastCaptured = null;
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.getElementById(OVERLAY_ID)?.remove();
  }
}

export function subscribeCapturedErrors(
  listener: (err: CapturedError) => void,
): () => void {
  listeners.add(listener);
  if (lastCaptured) listener(lastCaptured);
  return () => listeners.delete(listener);
}

export function reportCapturedError(
  error: unknown,
  meta?: { componentStack?: string; source?: string },
): CapturedError {
  const { message, stack } = normalizeError(error);
  const captured: CapturedError = {
    message,
    stack,
    componentStack: meta?.componentStack?.trim() ?? "",
    source: meta?.source ?? "unknown",
    at: Date.now(),
  };
  lastCaptured = captured;
  for (const listener of listeners) {
    try {
      listener(captured);
    } catch {
      /* listener failed */
    }
  }
  if (Platform.OS === "web") {
    showDomFatalOverlay(captured);
  }
  return captured;
}

export function formatCapturedErrorText(err: CapturedError): string {
  const lines = [
    `[${err.source}]`,
    `Message: ${err.message}`,
    "",
    err.stack ? `Stack:\n${err.stack}` : "(no stack)",
  ];
  if (err.componentStack) {
    lines.push("", `Component stack:\n${err.componentStack}`);
  }
  return lines.join("\n");
}

function showDomFatalOverlay(err: CapturedError): void {
  if (typeof document === "undefined") return;

  let root = document.getElementById(OVERLAY_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = OVERLAY_ID;
    root.setAttribute(
      "style",
      [
        "position:fixed",
        "inset:0",
        "z-index:2147483647",
        "background:#111",
        "color:#f5f5f5",
        "padding:16px",
        "padding-top:max(16px,env(safe-area-inset-top))",
        "padding-bottom:max(16px,env(safe-area-inset-bottom))",
        "box-sizing:border-box",
        "display:flex",
        "flex-direction:column",
        "font-family:ui-monospace,Menlo,Consolas,monospace",
        "font-size:11px",
        "line-height:1.45",
        "-webkit-overflow-scrolling:touch",
      ].join(";"),
    );
    document.body.appendChild(root);
  }

  const text = formatCapturedErrorText(err)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  root.innerHTML = `
    <div style="font-size:15px;font-weight:700;margin-bottom:8px;font-family:system-ui,sans-serif;">
      ${ERROR_FALLBACK_COPY.title}
    </div>
    <pre style="flex:1;overflow:auto;margin:0 0 12px;white-space:pre-wrap;word-break:break-word;">${text}</pre>
    <button type="button" id="fitplan-fatal-reload-btn" style="
      width:100%;
      padding:14px;
      font-size:16px;
      font-weight:600;
      border:none;
      border-radius:10px;
      background:#34C759;
      color:#fff;
      cursor:pointer;
      touch-action:manipulation;
    ">${ERROR_FALLBACK_COPY.reload}</button>
  `;

  const btn = document.getElementById("fitplan-fatal-reload-btn");
  if (btn) {
    btn.onclick = () => {
      const base = window.location.pathname || "/";
      window.location.href = `${base}?cb=${Date.now()}`;
    };
  }
}

export function reloadWebApp(): void {
  if (typeof window === "undefined") return;
  clearCapturedError();
  const base = window.location.pathname || "/";
  window.location.href = `${base}?cb=${Date.now()}`;
}
