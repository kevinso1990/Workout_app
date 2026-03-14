import { Router } from "express";
import * as statsController from "../controllers/statsController";

const router = Router();

router.get("/weekly-volume", statsController.weeklyVolume);
router.get("/prs", statsController.prs);
router.get("/exercise-history/:exerciseId", statsController.exerciseHistory);
router.get("/last-sets/:exerciseId", statsController.lastSets);
router.get("/rest-average/:exerciseId", statsController.restAverage);
router.get("/totals", statsController.totals);
router.get("/weekly-history", statsController.weeklyHistory);
router.get("/consistency", statsController.consistency);
router.get("/exercise-progress/:exerciseId", statsController.exerciseProgress);
router.get("/muscle-volume-7d", statsController.muscleVolume7d);
router.get("/logged-exercises", statsController.loggedExercises);
router.get("/muscle-balance", statsController.muscleBalance);
router.get("/weekly-summary", statsController.weeklySummary);
router.get("/exercise-best/:exerciseId", statsController.exerciseBest);

export default router;
