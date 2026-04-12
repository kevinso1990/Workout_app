import type { Request, Response } from "express";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import * as planService from "../services/planService";
import type { CreatePlanBody, UpdatePlanBody, AutoGeneratePlansBody } from "../models";

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(str, 10);
  if (isNaN(id) || id <= 0) throw new AppError(400, "id must be a positive integer");
  return id;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(planService.listPlans(req.user?.sub));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json(planService.getPlan(parseId(req.params.id), req.user?.sub));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  res.json(planService.createPlan(req.body as CreatePlanBody, req.user?.sub));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  // Ownership guard: getPlan throws 403 if plan belongs to a different user
  planService.getPlan(id, req.user?.sub);
  res.json(planService.updatePlan(id, req.body as UpdatePlanBody));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  planService.deletePlan(parseId(req.params.id));
  res.json({ ok: true });
});

export const autoGenerate = asyncHandler(async (req: Request, res: Response) => {
  const rawDeviceId = req.headers["x-device-id"];
  const deviceId = Array.isArray(rawDeviceId) ? rawDeviceId[0] : rawDeviceId;
  res.json(planService.autoGeneratePlans(req.body as AutoGeneratePlansBody, req.user?.sub, deviceId));
});
