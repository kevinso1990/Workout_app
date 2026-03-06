import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as recommendationService from "../services/recommendationService";
import type { AcceptRecommendationsBody } from "../models";

export const getForPlan = asyncHandler(async (req: Request, res: Response) => {
  const planId = parseInt(req.params.planId, 10);
  res.json(recommendationService.getRecommendations(planId));
});

export const accept = asyncHandler(async (req: Request, res: Response) => {
  const planId = parseInt(req.params.planId, 10);
  const { recommendations } = req.body as AcceptRecommendationsBody;
  recommendationService.acceptRecommendations(planId, recommendations);
  res.json({ ok: true });
});
