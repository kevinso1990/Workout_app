import type { Request, Response } from "express";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import * as voteService from "../services/voteService";

function getDeviceId(req: Request): string {
  const raw = req.headers["x-device-id"];
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) throw new AppError(400, "x-device-id header required");
  return id;
}

export const upsertVote = asyncHandler(async (req: Request, res: Response) => {
  const deviceId = getDeviceId(req);
  const exerciseId = parseInt(req.params.exerciseId, 10);
  const { vote } = req.body as { vote: number };
  if (![1, -1, 0].includes(vote)) throw new AppError(400, "vote must be 1, -1, or 0");
  voteService.upsertVote(deviceId, exerciseId, vote);
  res.json({ ok: true });
});

export const getVote = asyncHandler(async (req: Request, res: Response) => {
  const deviceId = getDeviceId(req);
  const exerciseId = parseInt(req.params.exerciseId, 10);
  res.json({ vote: voteService.getVote(deviceId, exerciseId) });
});

export const getAllVotes = asyncHandler(async (req: Request, res: Response) => {
  const deviceId = getDeviceId(req);
  res.json(voteService.getVotesForDevice(deviceId));
});
