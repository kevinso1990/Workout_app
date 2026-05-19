import { Router } from "express";
import * as feedbackController from "../controllers/feedbackController";

const router = Router();

router.post("/", feedbackController.submit);

export default router;
