import { Router } from "express";
import * as recommendationController from "../controllers/recommendationController";

const router = Router();

router.get("/:planId", recommendationController.getForPlan);
router.post("/:planId/accept", recommendationController.accept);

export default router;
