import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as recoveryService from "../services/recoveryService";

export const getRecovery = asyncHandler(async (_req: Request, res: Response) => {
  res.json(recoveryService.getRecovery());
});
