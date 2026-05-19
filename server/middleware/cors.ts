import type { Request, Response, NextFunction } from "express";

/**
 * Permissive CORS for Expo Go / native apps on LAN.
 * Does NOT require X-Requested-With (or any custom header) for API access.
 */
const ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "Accept",
  "X-Device-Id",
  "X-Requested-With",
].join(", ");

export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  res.header("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
}
