import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as recommendationService from "../services/recommendationService";
import type { AcceptRecommendationsBody } from "../models";
import { routeParamFirst } from "../utils/routeParam";

export const getForPlan = asyncHandler(async (req: Request, res: Response) => {
  const planId = parseInt(routeParamFirst(req.params.planId), 10);
  res.json(recommendationService.getRecommendations(planId, req.user!.sub));
});

export const accept = asyncHandler(async (req: Request, res: Response) => {
  const planId = parseInt(routeParamFirst(req.params.planId), 10);
  const { recommendations } = req.body as AcceptRecommendationsBody;
  recommendationService.acceptRecommendations(planId, recommendations, req.user!.sub);
  res.json({ ok: true });
});
