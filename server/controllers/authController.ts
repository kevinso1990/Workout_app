import type { Request, Response } from "express";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import * as authService from "../services/authService";
import type { GoogleAuthBody, AppleAuthBody } from "../models";

const DEV_LOGIN_ENABLED =
  process.env.NODE_ENV !== "production" &&
  process.env.ENABLE_DEV_LOGIN !== "false";

/** POST /api/auth/signup — email + password (local / tests). */
export const signUp = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password } = (req.body ?? {}) as {
    username?: unknown;
    email?: unknown;
    password?: unknown;
  };
  if (typeof username !== "string" || !username.trim()) {
    throw new AppError(400, "username is required");
  }
  if (typeof email !== "string" || !email.trim()) {
    throw new AppError(400, "email is required");
  }
  if (typeof password !== "string") {
    throw new AppError(400, "password must be at least 8 characters");
  }
  const out = authService.signUpWithEmailPassword(username, email, password);
  res.status(201).json(out);
});

/** POST /api/auth/login — email + password. */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || typeof password !== "string") {
    throw new AppError(400, "email and password are required");
  }
  res.json(authService.signInWithEmailPassword(email, password));
});

/** POST /api/auth/google — exchange a Google ID token for an app JWT. */
export const googleSignIn = asyncHandler(async (req: Request, res: Response) => {
  const { id_token } = (req.body ?? {}) as GoogleAuthBody;
  if (!id_token) throw new AppError(400, "id_token is required");
  res.json(await authService.signInWithGoogle(id_token));
});

/** POST /api/auth/apple — exchange an Apple identity token for an app JWT. */
export const appleSignIn = asyncHandler(async (req: Request, res: Response) => {
  const { id_token, name } = (req.body ?? {}) as AppleAuthBody;
  if (!id_token) throw new AppError(400, "id_token is required");
  res.json(await authService.signInWithApple(id_token, name));
});

/** GET /api/auth/me — returns the current user, freshly read from the DB. */
export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const user = authService.getUserById(req.user.sub);
  res.json(authService.toPublicUser(user));
});

/**
 * POST /api/auth/logout — stateless. Tokens are JWTs we don't track server-side,
 * so logout simply tells the client it's done; the client must drop its token.
 * Returning 200 always (even without a valid token) is intentional so clients
 * can reliably clear local state without juggling 401 handling on logout.
 */
export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ ok: true });
});

/**
 * POST /api/auth/dev-login — DEV ONLY. Mints a JWT for a fixed test user so
 * the web frontend can be exercised without going through the real Google /
 * Apple OAuth flow. Disabled in production via NODE_ENV.
 */
export const devLogin = asyncHandler(async (_req: Request, res: Response) => {
  if (!DEV_LOGIN_ENABLED) throw new AppError(404, "Not found");
  res.json(authService.signInAsDevUser());
});

/**
 * POST /api/auth/guest — backs the "Skip" / "Continue without an account"
 * option that's always shown alongside Google/Apple sign-in. Each guest user
 * is keyed on the device ID supplied via the `x-device-id` header (or
 * `device_id` body field), so data persists per-device until the user clears
 * storage or switches devices. Available in every environment.
 */
export const guestSignIn = asyncHandler(async (req: Request, res: Response) => {
  const headerId = (req.header("x-device-id") || "").trim();
  const bodyId = ((req.body ?? {}) as { device_id?: unknown }).device_id;
  const deviceId = headerId || (typeof bodyId === "string" ? bodyId.trim() : "");
  if (!deviceId) {
    throw new AppError(400, "Missing x-device-id header (or device_id body field)");
  }
  res.json(authService.signInAsGuest(deviceId));
});
