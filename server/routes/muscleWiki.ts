import { Router } from "express";
import * as muscleWikiController from "../controllers/muscleWikiController";

const router = Router();

router.get("/search", muscleWikiController.search);

export default router;
