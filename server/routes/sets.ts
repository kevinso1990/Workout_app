import { Router } from "express";
import * as setController from "../controllers/setController";

const router = Router();

router.post("/", setController.logSet);
router.delete("/:id", setController.remove);

export default router;
