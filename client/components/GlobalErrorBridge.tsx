import React, { useEffect, useState } from "react";

import { ErrorFallback } from "@/components/ErrorFallback";
import {
  clearCapturedError,
  reloadWebApp,
  subscribeCapturedErrors,
  type CapturedError,
} from "@/lib/globalErrorReporter";

type Props = {
  children: React.ReactNode;
};

/**
 * Surfaces window.onerror / unhandledrejection outside React's error boundary tree.
 */
export function GlobalErrorBridge({ children }: Props) {
  const [fatal, setFatal] = useState<CapturedError | null>(null);

  useEffect(() => {
    return subscribeCapturedErrors((err) => setFatal(err));
  }, []);

  if (fatal) {
    const error = new Error(fatal.message);
    error.stack = fatal.stack;
    return (
      <ErrorFallback
        error={error}
        componentStack={fatal.componentStack}
        source={fatal.source}
        resetError={() => {
          clearCapturedError();
          setFatal(null);
          reloadWebApp();
        }}
      />
    );
  }

  return <>{children}</>;
}
