import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import * as fs from "fs";
import * as path from "path";
import db, { initDb } from "./db";
import { registerRoutes } from "./routes/index";
import { errorHandler } from "./middleware/errorHandler";

// ── Process-level error safety ────────────────────────────────────────────────
// These are last-resort handlers. Bugs that escape asyncHandler end up here.
// Log the error and restart (process manager / Replit will restart the dyno).

process.on("uncaughtException", (err) => {
  console.error("[fatal] uncaughtException:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[fatal] unhandledRejection:", reason);
  process.exit(1);
});

const app = express();
const log = console.log;
const isProd = process.env.NODE_ENV === "production";

function setupCors(app: express.Application): void {
  const allowedOrigins = [
    /\.replit\.dev$/,
    /\.repl\.co$/,
    /^http:\/\/localhost(:\d+)?$/,
  ];

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.header("origin");
    if (origin && allowedOrigins.some((p) => p.test(origin))) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-Id");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
}

(async () => {
  initDb();
  log("Database initialized");

  setupCors(app);

  // Limit request body size to prevent trivial memory abuse
  app.use(express.json({ limit: "100kb" }));
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

    const proxyPort = 8081;
    if (proxyPort !== port) {
      const proxyServer = app.listen(proxyPort, "0.0.0.0", () => {
        log(`Server also listening on port ${proxyPort} (proxy)`);
      });
      proxyServer.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          log(`Port ${proxyPort} already in use — skipping proxy listener`);
        } else {
          throw err;
        }
      });
    }
  } else {
    const { createServer: createHttpServer } = await import("http");
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
      log(`Server running on port ${port}`);
    });

    const proxyPort = 8081;
    if (proxyPort !== port) {
      const httpServer2 = createHttpServer(app);
      httpServer2.listen(proxyPort, "0.0.0.0", () => {
        log(`Server also listening on port ${proxyPort} (proxy)`);
      });
      httpServer2.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          log(`Port ${proxyPort} already in use — skipping proxy listener`);
        } else {
          throw err;
        }
      });
    }
  }
})();
