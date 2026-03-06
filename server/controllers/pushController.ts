import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as pushService from "../services/pushService";
import type { SubscribePushBody } from "../models";

export const vapidPublic = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ publicKey: pushService.getVapidPublicKey() });
});

export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as SubscribePushBody;
  pushService.subscribe(body);
  res.json({ ok: true });
});

export const unsubscribe = asyncHandler(async (req: Request, res: Response) => {
  const { endpoint } = req.body as { endpoint: string };
  pushService.unsubscribe(endpoint);
  res.json({ ok: true });
});
