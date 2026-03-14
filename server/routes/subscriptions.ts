import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware";
import * as subscriptionController from "../controllers/subscriptionController";

const router = Router();

// GET  /api/subscriptions/status         — current user's Pro status (auth required)
router.get("/status", requireAuth, subscriptionController.getStatus);

// POST /api/subscriptions/validate/apple  — validate Apple StoreKit receipt
router.post("/validate/apple",  requireAuth, subscriptionController.validateApple);

// POST /api/subscriptions/validate/google — validate Google Play purchase token
router.post("/validate/google", requireAuth, subscriptionController.validateGoogle);

// POST /api/subscriptions/webhooks/apple  — Apple App Store Server Notifications
// (no auth — Apple calls this server-to-server; we validate via JWS signature)
router.post("/webhooks/apple",  subscriptionController.appleWebhook);

// POST /api/subscriptions/webhooks/google — Google Play Real-time Developer Notifications
// (no auth — Google calls via Pub/Sub; validate via GOOGLE_PUBSUB_TOKEN query param)
router.post("/webhooks/google", subscriptionController.googleWebhook);

export default router;
