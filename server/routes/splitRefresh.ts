import { Router } from "express";
import * as splitRefreshController from "../controllers/splitRefreshController";

const router = Router();

router.get("/", splitRefreshController.getSplitAge);
router.post("/snooze", splitRefreshController.snoozeSplitRefresh);

export default router;
