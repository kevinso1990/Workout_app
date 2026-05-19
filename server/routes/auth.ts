import { Router } from "express";
import * as authController from "../controllers/authController";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimiter";

const router = Router();

// 20 attempts per minute per IP — protects against ID-token replay floods
const oauthLimiter = rateLimit(20, 60_000);
// Guest sign-in is cheaper but still rate-limited per IP to slow row-creation abuse
const guestLimiter = rateLimit(30, 60_000);
const credentialLimiter = rateLimit(20, 60_000);

router.post("/signup", credentialLimiter, authController.signUp);
router.post("/login", credentialLimiter, authController.login);
router.post("/google", oauthLimiter, authController.googleSignIn);
router.post("/apple",  oauthLimiter, authController.appleSignIn);
router.post("/guest",  guestLimiter, authController.guestSignIn);
router.get("/me",      requireAuth,  authController.me);
router.post("/logout", authController.logout);

// Dev-only convenience login — handler returns 404 when NODE_ENV=production
router.post("/dev-login", authController.devLogin);

export default router;
