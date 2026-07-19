import {
  clearCapturedError,
  reportCapturedError,
} from "@/lib/globalErrorReporter";

let installed = false;

/** Registers window.onerror + unhandledrejection before React boots (web only). */
export function installWebGlobalErrorHandlers(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const prevOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const detail =
      error ??
      new Error(
        typeof message === "string"
          ? message
          : "Unknown script error",
      );
    reportCapturedError(detail, {
      source: `window.onerror @ ${source ?? "?"}:${lineno ?? 0}:${colno ?? 0}`,
    });
    if (typeof prevOnError === "function") {
      return prevOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  window.addEventListener("unhandledrejection", (event) => {
    reportCapturedError(event.reason, {
      source: "unhandledrejection",
    });
  });

  void purgeStaleServiceWorkersOnBoot();
}

async function purgeStaleServiceWorkersOnBoot(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      await reg.unregister();
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* best effort */
  }
}

export async function registerWebServiceWorker(buildId: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    await purgeStaleServiceWorkersOnBoot();
    await navigator.serviceWorker.register(`/sw.js?build=${encodeURIComponent(buildId)}`, {
      scope: "/",
      updateViaCache: "none",
    });
  } catch {
    /* SW optional */
  }
}

export { clearCapturedError };
