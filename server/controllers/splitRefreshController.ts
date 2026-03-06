import type { Request, Response } from "express";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import * as splitRefreshService from "../services/splitRefreshService";

function getDeviceId(req: Request): string {
  const raw = req.headers["x-device-id"];
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) throw new AppError(400, "x-device-id header required");
  return id;
}

export const getSplitAge = asyncHandler(async (req: Request, res: Response) => {
  const deviceId = getDeviceId(req);
  const threshold = req.query.threshold ? parseInt(req.query.threshold as string, 10) : undefined;
  res.json(splitRefreshService.getSplitAge(deviceId, threshold));
});

export const snoozeSplitRefresh = asyncHandler(async (req: Request, res: Response) => {
  const deviceId = getDeviceId(req);
  splitRefreshService.snooze(deviceId);
  res.json({ ok: true });
});
