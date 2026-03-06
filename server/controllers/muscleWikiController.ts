import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as muscleWikiService from "../services/muscleWikiService";

export const search = asyncHandler(async (req: Request, res: Response) => {
  const name = (req.query.name as string) ?? "";
  res.json(await muscleWikiService.searchMuscleWiki(name));
});
