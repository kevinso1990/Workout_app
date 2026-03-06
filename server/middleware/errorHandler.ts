import type { Request, Response, NextFunction } from "express";

/**
 * Typed HTTP error. Throw this from any service or controller to return a
 * specific status code to the client.
 *
 * @example
 *   throw new AppError(404, "Plan not found");
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Wraps an async route handler so that any rejected promise is forwarded to
 * Express's error-handling middleware instead of causing an unhandled rejection.
 *
 * Use for every controller method, async or sync, for uniform error propagation.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Global Express error-handling middleware. Must be registered last, after all
 * routes, via `app.use(errorHandler)`.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Handle errors thrown by Express itself (e.g. body-parser)
  const cast = err as { status?: number; statusCode?: number; message?: string };
  const status = cast.status ?? cast.statusCode ?? 500;
  const message = cast.message ?? "Internal Server Error";

  if (status >= 500) {
    console.error("Unhandled server error:", err);
  }

  res.status(status).json({ error: message });
}
