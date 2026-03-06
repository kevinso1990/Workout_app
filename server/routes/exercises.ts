import { Router } from "express";
import * as exerciseController from "../controllers/exerciseController";

const router = Router();

router.get("/", exerciseController.list);
router.post("/", exerciseController.create);

export default router;
