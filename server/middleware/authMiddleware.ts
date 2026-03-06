import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/authService";
import type { JwtPayload } from "../models";

// Extend Express's Request with our typed user property
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * If a Bearer token is present, verifies it and sets `req.user`.
 * Does NOT reject the request if no token is provided — use for routes that
 * work both authenticated and unauthenticated but behave differently when
 * a user is known (e.g. scoping plans/sessions to the current user).
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = verifyToken(header.slice(7));
    } catch {
      // Token present but invalid — ignore it; route will proceed unauthenticated
    }
  }
  next();
}

/**
 * Requires a valid Bearer JWT in the Authorization header.
 * Populates `req.user` with `{ sub: userId, username }` on success.
 * Returns 401 if the token is missing or invalid.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization header missing or malformed" });
    return;
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch (err) {
    next(err);
  }
}
