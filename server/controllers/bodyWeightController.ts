import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as bodyWeightService from "../services/bodyWeightService";
import type { LogBodyWeightBody } from "../models";

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(bodyWeightService.listBodyWeight());
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as LogBodyWeightBody;
  res.json(bodyWeightService.logBodyWeight(body));
});
