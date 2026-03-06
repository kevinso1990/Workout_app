import { Router } from "express";
import * as planController from "../controllers/planController";
import { optionalAuth } from "../middleware/authMiddleware";

const router = Router();

// Attach user identity when a token is present (scopes plans to the owner)
router.use(optionalAuth);

// NOTE: /auto-generate must come before /:id to avoid being matched as an ID
router.post("/auto-generate", planController.autoGenerate);

router.get("/", planController.list);
router.post("/", planController.create);
router.get("/:id", planController.getOne);
router.put("/:id", planController.update);
router.delete("/:id", planController.remove);

export default router;
