import type { Request, Response } from "express";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import * as planService from "../services/planService";
import { modifyPlanWithAi } from "../services/planModifyService";
import type { CreatePlanBody, UpdatePlanBody, AutoGeneratePlansBody, ModifyPlanBody } from "../models";

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(str, 10);
  if (isNaN(id) || id <= 0) throw new AppError(400, "id must be a positive integer");
  return id;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(planService.listPlans(req.user!.sub));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json(planService.getPlan(parseId(req.params.id), req.user!.sub));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  res.json(planService.createPlan(req.body as CreatePlanBody, req.user!.sub));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  res.json(planService.updatePlan(id, req.body as UpdatePlanBody, req.user!.sub));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  planService.deletePlan(parseId(req.params.id), req.user!.sub);
  res.json({ ok: true });
});

export const autoGenerate = asyncHandler(async (req: Request, res: Response) => {
  const rawDeviceId = req.headers["x-device-id"];
  const deviceId = Array.isArray(rawDeviceId) ? rawDeviceId[0] : rawDeviceId;
  const body = req.body as AutoGeneratePlansBody;
  const userId = req.user!.sub;
  planService.cleanupOrphanAutoGeneratePlans(userId);
  try {
    const geminiPlans = await planService.tryAutoGeneratePlansWithGemini(body, userId, deviceId);
    if (geminiPlans) {
      res.json(geminiPlans);
      return;
    }
    // Free-text goal requests depend on the AI to interpret the goal. The
    // deterministic template generator ignores goalText, so falling back to it
    // would hand the user a generic strength split mislabeled as their goal
    // (e.g. a bench-press plan named "improve hip mobility"). Fail honestly so
    // the client can say "AI unavailable, try again" instead. The structured
    // onboarding path (no goalText) still gets the reliable template fallback.
    if (body.goalText) {
      throw new AppError(503, "AI plan generation is temporarily unavailable");
    }
    res.json(planService.autoGeneratePlans(body, userId, deviceId));
  } catch (err) {
    planService.cleanupOrphanAutoGeneratePlans(userId);
    throw err;
  }
});

export const modify = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ModifyPlanBody;
  if (!body?.plan?.days?.length || !body.instruction?.trim()) {
    throw new AppError(400, "plan and instruction required");
  }
  const result = await modifyPlanWithAi(body.plan, body.instruction);
  res.json(result);
});
