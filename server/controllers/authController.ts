import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as authService from "../services/authService";
import type { SignupBody, LoginBody } from "../models";

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.signup(req.body as SignupBody);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body as LoginBody);
  res.json(result);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  // req.user is set by requireAuth middleware
  res.json(req.user);
});
