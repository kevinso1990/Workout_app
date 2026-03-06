import { Router } from "express";
import * as recoveryController from "../controllers/recoveryController";

const router = Router();

router.get("/", recoveryController.getRecovery);

export default router;
