import { Router } from "express";
import * as sessionController from "../controllers/sessionController";
import { requireAuth, optionalAuth } from "../middleware/authMiddleware";

const router = Router();

// /history requires a user; all other session routes scope to user when possible
router.get("/history", requireAuth, sessionController.history);

router.get("/",      optionalAuth, sessionController.list);
router.post("/",     optionalAuth, sessionController.create);
router.get("/:id",   sessionController.getOne);
router.put("/:id",   sessionController.finish);

export default router;
