import { Router } from "express";
import * as authController from "../controllers/authController";
import { requireAuth } from "../middleware/authMiddleware";
import { rateLimit } from "../middleware/rateLimiter";

const router = Router();

// 10 attempts per minute per IP protects against credential stuffing / brute-force
const authLimiter = rateLimit(10, 60_000);

router.post("/signup", authLimiter, authController.signup);
router.post("/login",  authLimiter, authController.login);
router.get("/me",      requireAuth, authController.me);

export default router;
