/** Production crash-screen copy (no i18n hooks — safe inside error boundaries). */
export const ERROR_FALLBACK_COPY = {
  title: "Something went wrong",
  subtitle:
    "Try reloading the app. If this keeps happening, contact support with a screenshot of the details below.",
  reload: "Reload",
} as const;
