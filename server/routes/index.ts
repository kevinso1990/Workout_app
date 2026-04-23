import type { Express } from "express";
import authRouter from "./auth";
import exerciseRouter from "./exercises";
import planRouter from "./plans";
import sessionRouter from "./sessions";
import setRouter from "./sets";
import feedbackRouter from "./feedback";
import recommendationRouter from "./recommendations";
import statsRouter from "./stats";
import bodyWeightRouter from "./bodyWeight";
import recoveryRouter from "./recovery";
import muscleWikiRouter from "./muscleWiki";
import pushRouter from "./push";
import votesRouter from "./votes";
import splitRefreshRouter from "./splitRefresh";
import subscriptionRouter from "./subscriptions";
import importWorkoutRouter from "./importWorkout";
import { startPushScheduler } from "../services/pushService";

/**
 * Mounts all API routers on the Express app and starts background schedulers.
 * Called once at server startup from server/index.ts.
 */
export function registerRoutes(app: Express): void {
  app.use("/api/auth", authRouter);
  app.use("/api/exercises", exerciseRouter);
  app.use("/api/plans", planRouter);
  app.use("/api/sessions", sessionRouter);
  app.use("/api/sets", setRouter);
  app.use("/api/exercise-feedback", feedbackRouter);
  app.use("/api/recommendations", recommendationRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/body-weight", bodyWeightRouter);
  app.use("/api/recovery", recoveryRouter);
  app.use("/api/musclewiki", muscleWikiRouter);
  app.use("/api/push", pushRouter);
  app.use("/api/votes", votesRouter);
  app.use("/api/split-refresh", splitRefreshRouter);
  app.use("/api/subscriptions", subscriptionRouter);
  app.use("/api", importWorkoutRouter);

  startPushScheduler();
}
