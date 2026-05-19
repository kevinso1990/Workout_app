import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as exerciseService from "../services/exerciseService";
import type { CreateExerciseBody } from "../models";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const equipment = req.query.equipment as string | undefined;
  res.json(exerciseService.listExercises(equipment));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateExerciseBody;
  res.json(exerciseService.createExercise(body));
});
