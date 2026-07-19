import type { Request, Response } from "express";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import * as sessionService from "../services/sessionService";
import type { FinishSessionBody, LogCardioBody } from "../models";

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(str, 10);
  if (isNaN(id) || id <= 0) throw new AppError(400, "id must be a positive integer");
  return id;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(sessionService.listSessions(req.user!.sub));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json(sessionService.getSession(parseId(req.params.id), req.user!.sub));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { plan_id } = req.body as { plan_id: number };
  res.json(sessionService.createSession(plan_id, req.user!.sub));
});

export const history = asyncHandler(async (req: Request, res: Response) => {
  res.json(sessionService.getWorkoutHistory(req.user!.sub));
});

export const finish = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    sessionService.finishSession(parseId(req.params.id), req.body as FinishSessionBody, req.user!.sub),
  );
});

export const syncLocal = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { session?: { id?: string } };
  const session = body?.session;
  if (!session || typeof session !== "object") {
    throw new AppError(400, "session object required");
  }
  const localId = typeof session.id === "string" ? session.id : "";
  const userId = req.user?.sub ?? null;
  res.status(201).json(
    sessionService.syncLocalWorkoutSession(userId, localId, session),
  );
});

export const logCardio = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(
    sessionService.logCardioSession(req.user!.sub, req.body as LogCardioBody),
  );
});
