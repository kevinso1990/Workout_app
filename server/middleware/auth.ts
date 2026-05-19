/**
 * JWT authentication middleware.
 *
 * `requireAuth` rejects any request without a valid Bearer token and is the
 * canonical guard used by every non-/api/auth route. `optionalAuth` is kept
 * for back-compat where a route used to be reachable anonymously.
 */
import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/authService";
import type { JwtPayload } from "../models";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Verifies a Bearer JWT and populates `req.user` with the decoded payload.
 * Returns 401 if the token is missing, malformed, expired, or signature-invalid.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * If a Bearer token is present, decodes it onto `req.user`. Never rejects.
 * Used by legacy routes that historically supported anonymous access; new
 * code should prefer `requireAuth`.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      // ignore — route runs unauthenticated
    }
  }
  next();
}
