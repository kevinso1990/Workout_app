import { Router } from "express";
import * as voteController from "../controllers/voteController";

const router = Router();

router.get("/", voteController.getAllVotes);
router.get("/:exerciseId", voteController.getVote);
router.post("/:exerciseId", voteController.upsertVote);

export default router;
