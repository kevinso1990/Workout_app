import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as feedbackService from "../services/feedbackService";
import type { SubmitFeedbackBody } from "../models";

export const submit = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as SubmitFeedbackBody;
  feedbackService.upsertFeedback(body);
  res.json({ ok: true });
});
