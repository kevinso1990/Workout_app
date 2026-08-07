import express from "express";
import type { Request, Response, NextFunction } from "express";
import * as fs from "fs";
import * as path from "path";
import db, { initDb } from "./db";
import { registerRoutes } from "./routes/index";
import { errorHandler } from "./middleware/errorHandler";
import { corsMiddleware } from "./middleware/cors";
import { runGifPrefetch } from "./services/gifPrefetchService";
import { initSentry, Sentry, captureFatalAndFlush } from "./lib/sentry";

// Initialise error reporting first thing, before anything can throw.
initSentry();

// ── Process-level error safety ────────────────────────────────────────────────
// These are last-resort handlers. Bugs that escape asyncHandler end up here.
// Report to Sentry (if configured), log, then exit (the process manager restarts).

process.on("uncaughtException", (err) => {
  console.error("[fatal] uncaughtException:", err);
  captureFatalAndFlush(err, "uncaughtException").finally(() => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  console.error("[fatal] unhandledRejection:", reason);
  captureFatalAndFlush(reason, "unhandledRejection").finally(() => process.exit(1));
});

const app = express();
const log = console.log;
const isProd = process.env.NODE_ENV === "production";

// Local dev: no upstream proxy. Production may sit behind one hop.
if (isProd) {
  app.set("trust proxy", 1);
}

(async () => {
  initDb();
  log("Database initialized");

  // Fire-and-forget: populate gif_url on exercises table. Only runs when
  // RAPIDAPI_KEY is set in the environment; silently skips otherwise.
  runGifPrefetch().catch((err) =>
    console.error("[GIF prefetch] Unexpected error:", err)
  );

  // Periodic retry: re-run the prefetch every hour so exercises that had no
  // image due to a transient API failure eventually get one without needing a
  // server restart. unref() prevents the timer from blocking graceful shutdown.
  // The in-flight flag prevents overlapping runs if a prefetch takes > 1 hour.
  let gifPrefetchRunning = false;
  (setInterval(() => {
    if (gifPrefetchRunning) {
      console.log("[GIF prefetch] Periodic retry skipped — previous run still in progress.");
      return;
    }
    gifPrefetchRunning = true;
    const start = Date.now();
    runGifPrefetch()
      .catch((err) => console.error("[GIF prefetch] Periodic retry error:", err))
      .finally(() => {
        gifPrefetchRunning = false;
        console.log(`[GIF prefetch] Periodic retry completed in ${Date.now() - start}ms.`);
      });
  }, 60 * 60 * 1000) as unknown as NodeJS.Timeout).unref();

  app.use(corsMiddleware);

  // Limit request body size to prevent trivial memory abuse.
  // The Gemini-backed import route is the ONLY consumer of large payloads
  // (multi-image uploads / PDFs land around 3-5MB each, base64-encoded), so
  // we scope the 25MB ceiling to that route and keep every other endpoint on
  // a tight 1MB default to shrink the DoS surface.
  app.use("/api/import-workout", (req, res, next) => {
    const ct = req.headers["content-type"] ?? "";
    if (ct.includes("multipart/form-data")) {
      return next();
    }
    return express.json({ limit: "25mb" })(req, res, next);
  });
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));

  // Basic security headers — no helmet dep needed for these fundamentals
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });

  // Health check — no auth, cheap, safe for load-balancer / uptime probes
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", ts: new Date().toISOString() });
  });

  // Attach a short request ID to every request — referenced in error logs
  // so a user-reported error code can be correlated to a specific log line.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).requestId = Math.random().toString(36).slice(2, 10);
    next();
  });

  // Structured request logging: method path status duration [userId] [rid on error]
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
      if (!req.path.startsWith("/api") && req.path !== "/") return;
      const duration = Date.now() - start;
      const parts: (string | number)[] = [req.method, req.path, res.statusCode, `${duration}ms`];
      if (req.user?.sub) parts.push(`uid=${req.user.sub}`);
      if (res.statusCode >= 500) {
        parts.push(`rid=${(req as any).requestId}`);
      }
      log(parts.join(" "));
    });
    next();
  });

  registerRoutes(app);

  // Sentry captures unhandled route errors (no-op unless SENTRY_DSN is set).
  // Must sit after routes and before our own error handler.
  Sentry.setupExpressErrorHandler(app);

  // Global error handler — must be registered after all routes
  app.use(errorHandler);

  const port = parseInt(process.env.PORT ?? "5000", 10);

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  // On SIGTERM / SIGINT: stop accepting new requests, close the DB, then exit.
  // A 10s hard deadline prevents zombie hangs in case of slow in-flight requests.
  function shutdown(signal: string, server: ReturnType<typeof app.listen>) {
    log(`[server] ${signal} received — shutting down gracefully`);
    server.close(() => {
      try { db.close(); } catch { /* already closed */ }
      log("[server] shutdown complete");
      process.exit(0);
    });
    (setTimeout(() => {
      console.error("[server] forced shutdown after 10s timeout");
      process.exit(1);
    }, 10_000) as unknown as NodeJS.Timeout).unref();
  }

  if (isProd) {
    const distPath = path.resolve(process.cwd(), "dist/public");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("/{*splat}", (_req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    } else {
      log("WARNING: dist/public not found — no static files to serve");
    }

    const mainServer = app.listen(port, "0.0.0.0", () => {
      log(`Server running on port ${port}`);
    });
    process.on("SIGTERM", () => shutdown("SIGTERM", mainServer));
    process.on("SIGINT",  () => shutdown("SIGINT",  mainServer));
  } else {
    const { createServer: createHttpServer } = await import("http");
    const { createServer: createViteServer } = await import("vite");
    const httpServer = createHttpServer(app);

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);

    httpServer.listen(port, "0.0.0.0", () => {
      log(`Server running on port ${port} (dev + Vite)`);
    });
  }
})();
