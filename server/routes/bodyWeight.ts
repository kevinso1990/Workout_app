import { Router } from "express";
import * as bodyWeightController from "../controllers/bodyWeightController";

const router = Router();

router.get("/", bodyWeightController.list);
router.post("/", bodyWeightController.create);

export default router;
