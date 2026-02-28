/**
 * SOAP Batch API Server
 *
 * Express 服务入口，提供批量 SOAP 笔记生成 API
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { randomBytes } from "crypto";
import { createBatchRouter } from "./routes/batch";
import { createAutomateRouter } from "./routes/automate";
import { createAIGenerateRouter } from "./routes/ai-generate";

// ── Auth Middleware ──────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // 1. Try JWT cookie (shared with PT system)
  const token = req.cookies?.rbmeds_token;
  if (token) {
    const secret = process.env.SHARED_JWT_SECRET;
    if (secret) {
      try {
        const payload = jwt.verify(token, secret) as Record<string, unknown>;
        if (!payload.ac_access) {
          res
            .status(403)
            .json({ success: false, error: "No AC system access" });
          return;
        }
        (req as any).user = payload;
        next();
        return;
      } catch {
        // JWT invalid, fall through to x-api-key
      }
    }
  }

  // 2. Fallback: x-api-key (backward compatible)
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    next();
    return;
  }
  const provided = req.headers["x-api-key"];
  if (provided !== apiKey) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  next();
}

// ── CSRF Protection ──────────────────────────────

function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

function csrfProtect(req: Request, res: Response, next: NextFunction): void {
  if (!req.cookies.csrf_token) {
    res.cookie("csrf_token", generateCsrfToken(), {
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const cookieToken = req.cookies.csrf_token as string | undefined;
    const headerToken = req.headers["x-csrf-token"] as string | undefined;
    if (!cookieToken || cookieToken !== headerToken) {
      res.status(403).json({ success: false, error: "Forbidden" });
      return;
    }
  }
  next();
}

// ── Env Validation ───────────────────────────────

function validateEnv(): void {
  if (process.env.NODE_ENV !== "production") return;
  const required = ["SHARED_JWT_SECRET", "COOKIE_ENCRYPTION_KEY"] as const;
  const missing = required.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    process.stderr.write(
      `FATAL: Missing required env vars: ${missing.join(", ")}\n`,
    );
    process.exit(1);
  }
}

// ── App Factory ─────────────────────────────────

export function createApp(): express.Application {
  const app = express();

  // S1: Restrict CORS to known origin
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:9090",
      methods: ["GET", "POST", "PUT"],
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // S5: Rate limiting
  const apiLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/", apiLimiter);
  app.use("/api/automate/login", loginLimiter);

  app.use(csrfProtect);

  // 健康检查 (无需认证)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth check endpoint (无需认证)
  app.get("/api/auth/me", (req, res) => {
    const token = req.cookies?.rbmeds_token;
    const secret = process.env.SHARED_JWT_SECRET;
    if (!token || !secret) {
      res.json({ authenticated: false });
      return;
    }
    try {
      const payload = jwt.verify(token, secret) as Record<string, unknown>;
      res.json({
        authenticated: true,
        user: {
          username: payload.username,
          role: payload.role,
          ac_access: payload.ac_access,
        },
      });
    } catch {
      res.json({ authenticated: false });
    }
  });

  // S3: Protected routes
  app.use("/api/batch", requireAuth, createBatchRouter());
  app.use("/api/automate", requireAuth, createAutomateRouter());
  app.use("/api/ai", requireAuth, createAIGenerateRouter());

  return app;
}

// 直接运行时启动服务器
if (require.main === module) {
  validateEnv();
  const port = parseInt(process.env.PORT ?? "3001", 10);
  const app = createApp();
  app.listen(port, () => {
    process.stdout.write(`SOAP Batch API running on port ${port}\n`);
  });
}
