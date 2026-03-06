import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as sessionService from "../services/sessionService";
import type { FinishSessionBody } from "../models";

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(sessionService.listSessions(req.user?.sub));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  res.json(sessionService.getSession(id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { plan_id } = req.body as { plan_id: number };
  res.json(sessionService.createSession(plan_id, req.user?.sub));
});

export const history = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  res.json(sessionService.getWorkoutHistory(userId));
});

export const finish = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const body = req.body as FinishSessionBody;
  res.json(sessionService.finishSession(id, body));
});
