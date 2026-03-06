import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as setService from "../services/setService";
import type { LogSetBody } from "../models";

export const logSet = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as LogSetBody;
  res.json(setService.logSet(body));
});

export const updateRir = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const { rir } = req.body as { rir: number };
  setService.updateSetRir(id, rir);
  res.json({ ok: true });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  setService.deleteSet(id);
  res.json({ ok: true });
});
