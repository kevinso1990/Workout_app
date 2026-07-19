/**
 * Headers for /api/import-workout — direct to Express (no Replit proxy).
 * X-Requested-With is optional on our server but included for older gateways.
 */

export const IMPORT_ACCEPT_HEADERS = {
  Accept: "application/json",
  "X-Requested-With": "XMLHttpRequest",
} as const;

export const IMPORT_JSON_HEADERS = {
  ...IMPORT_ACCEPT_HEADERS,
  "Content-Type": "application/json",
} as const;
