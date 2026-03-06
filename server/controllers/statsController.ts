import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as statsService from "../services/statsService";

export const weeklyVolume = asyncHandler(async (_req: Request, res: Response) => {
  res.json(statsService.getWeeklyVolume());
});

export const prs = asyncHandler(async (_req: Request, res: Response) => {
  res.json(statsService.getPRs());
});

export const exerciseHistory = asyncHandler(async (req: Request, res: Response) => {
  const exerciseId = parseInt(req.params.exerciseId, 10);
  res.json(statsService.getExerciseHistory(exerciseId));
});

export const lastSets = asyncHandler(async (req: Request, res: Response) => {
  const exerciseId = parseInt(req.params.exerciseId, 10);
  res.json(statsService.getLastSets(exerciseId));
});

export const restAverage = asyncHandler(async (req: Request, res: Response) => {
  const exerciseId = parseInt(req.params.exerciseId, 10);
  res.json(statsService.getRestAverage(exerciseId));
});

export const totals = asyncHandler(async (_req: Request, res: Response) => {
  res.json(statsService.getTotals());
});

export const weeklyHistory = asyncHandler(async (_req: Request, res: Response) => {
  res.json(statsService.getWeeklyHistory());
});

export const consistency = asyncHandler(async (_req: Request, res: Response) => {
  res.json(statsService.getConsistency());
});

export const exerciseProgress = asyncHandler(async (req: Request, res: Response) => {
  const exerciseId = parseInt(req.params.exerciseId, 10);
  res.json(statsService.getExerciseProgress(exerciseId));
});

export const muscleVolume7d = asyncHandler(async (_req: Request, res: Response) => {
  res.json(statsService.getMuscleVolume7d());
});

export const loggedExercises = asyncHandler(async (_req: Request, res: Response) => {
  res.json(statsService.getLoggedExercises());
});
