import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as planService from "../services/planService";
import type { CreatePlanBody, UpdatePlanBody, AutoGeneratePlansBody } from "../models";

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(planService.listPlans(req.user?.sub));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  res.json(planService.getPlan(id, req.user?.sub));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreatePlanBody;
  res.json(planService.createPlan(body, req.user?.sub));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const body = req.body as UpdatePlanBody;
  res.json(planService.updatePlan(id, body));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  planService.deletePlan(id);
  res.json({ ok: true });
});

export const autoGenerate = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as AutoGeneratePlansBody;
  res.json(planService.autoGeneratePlans(body, req.user?.sub));
});
