import { Router } from "express";
import * as pushController from "../controllers/pushController";

const router = Router();

router.get("/vapid-public", pushController.vapidPublic);
router.post("/subscribe", pushController.subscribe);
router.delete("/unsubscribe", pushController.unsubscribe);

export default router;
