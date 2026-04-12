import type { Request, Response } from "express";
import { asyncHandler, AppError } from "../middleware/errorHandler";
import * as setService from "../services/setService";
import type { LogSetBody } from "../models";

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(str, 10);
  if (isNaN(id) || id <= 0) throw new AppError(400, "id must be a positive integer");
  return id;
}

export const logSet = asyncHandler(async (req: Request, res: Response) => {
  res.json(setService.logSet(req.body as LogSetBody));
});

export const updateRir = asyncHandler(async (req: Request, res: Response) => {
  const { rir } = req.body as { rir: number };
  setService.updateSetRir(parseId(req.params.id), rir);
  res.json({ ok: true });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  setService.deleteSet(parseId(req.params.id));
  res.json({ ok: true });
});
