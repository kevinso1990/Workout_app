import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import { registerRoutes } from "./routes";
import { initDb } from "./db";
import * as fs from "fs";
import * as path from "path";

const app = express();
const log = console.log;
const isProd = process.env.NODE_ENV === "production";

function setupCors(app: express.Application) {
  const allowedOrigins = [
    /\.replit\.dev$/,
    /\.repl\.co$/,
    /^http:\/\/localhost(:\d+)?$/,
  ];

  app.use((req, res, next) => {
    const origin = req.header("origin");
    if (origin && allowedOrigins.some(p => p.test(origin))) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });
}

(async () => {
  initDb();
  log("Database initialized");

  setupCors(app);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (req.path.startsWith("/api") || req.path === "/") {
        log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
      }
    });
    next();
  });

  await registerRoutes(app);

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as { status?: number; statusCode?: number; message?: string };
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Server error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  const port = parseInt(process.env.PORT || "5000", 10);

  if (isProd) {
    const distPath = path.resolve(process.cwd(), "dist/public");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    }

    const server = app.listen(port, "0.0.0.0", () => {
      log(`Server running on port ${port}`);
    });

    const proxyPort = 8081;
    if (proxyPort !== port) {
      app.listen(proxyPort, "0.0.0.0", () => {
        log(`Server also listening on port ${proxyPort} (proxy)`);
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
    }
  }
})();
