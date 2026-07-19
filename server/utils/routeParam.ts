/**
 * Express 5 types `req.params.*` as `string | string[]`. Normalise to a single segment.
 */
export function routeParamFirst(value: string | string[] | undefined): string {
  if (value === undefined) return "";
  return Array.isArray(value) ? value[0] ?? "" : value;
}
