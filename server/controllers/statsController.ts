import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as statsService from "../services/statsService";
import { routeParamFirst } from "../utils/routeParam";

export const weeklyVolume = asyncHandler(async (req: Request, res: Response) => {
  res.json(statsService.getWeeklyVolume(req.user!.sub));
});

export const prs = asyncHandler(async (req: Request, res: Response) => {
  res.json(statsService.getPRs(req.user!.sub));
});

export const exerciseHistory = asyncHandler(async (req: Request, res: Response) => {
  const exerciseId = parseInt(routeParamFirst(req.params.exerciseId), 10);
  res.json(statsService.getExerciseHistory(exerciseId, req.user!.sub));
});

export const lastSets = asyncHandler(async (req: Request, res: Response) => {
  const exerciseId = parseInt(routeParamFirst(req.params.exerciseId), 10);
  res.json(statsService.getLastSets(exerciseId, req.user!.sub));
});

export const restAverage = asyncHandler(async (req: Request, res: Response) => {
  const exerciseId = parseInt(routeParamFirst(req.params.exerciseId), 10);
  res.json(statsService.getRestAverage(exerciseId, req.user!.sub));
});

export const totals = asyncHandler(async (req: Request, res: Response) => {
  res.json(statsService.getTotals(req.user!.sub));
});

export const weeklyHistory = asyncHandler(async (req: Request, res: Response) => {
  res.json(statsService.getWeeklyHistory(req.user!.sub));
});

export const consistency = asyncHandler(async (req: Request, res: Response) => {
  res.json(statsService.getConsistency(req.user!.sub));
});

export const exerciseProgress = asyncHandler(async (req: Request, res: Response) => {
  const exerciseId = parseInt(routeParamFirst(req.params.exerciseId), 10);
  res.json(statsService.getExerciseProgress(exerciseId, req.user!.sub));
});

export const muscleVolume7d = asyncHandler(async (req: Request, res: Response) => {
  res.json(statsService.getMuscleVolume7d(req.user!.sub));
});

export const loggedExercises = asyncHandler(async (req: Request, res: Response) => {
  res.json(statsService.getLoggedExercises(req.user!.sub));
});

export const muscleBalance = asyncHandler(async (req: Request, res: Response) => {
  res.json(statsService.getMuscleBalance(req.user!.sub));
});

export const weeklySummary = asyncHandler(async (req: Request, res: Response) => {
  res.json(statsService.getWeeklySummary(req.user!.sub));
});

export const exerciseBest = asyncHandler(async (req: Request, res: Response) => {
  const exerciseId = parseInt(routeParamFirst(req.params.exerciseId), 10);
  res.json(statsService.getExerciseBest(exerciseId, req.user!.sub));
});
