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
import { doubleCsrf } from "csrf-csrf";
import { createBatchRouter } from "./routes/batch";
import { createAutomateRouter } from "./routes/automate";
import { createAIGenerateRouter } from "./routes/ai-generate";
import { createSoapRouter } from "./routes/soap";

// ── Auth Middleware ──────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // 1. Try JWT cookie (shared with PT system)
  const token = req.cookies?.rbmeds_token;
  if (token) {
    const secret = process.env.SHARED_JWT_SECRET;
    if (secret) {
      try {
        const payload = jwt.verify(token, secret) as Record<string, unknown>;
        const systems = payload.systems as string[] | undefined;
        const hasAccess = systems
          ? systems.includes("ac")
          : Boolean(payload.ac_access);
        if (!hasAccess) {
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

// ── CSRF Protection (csrf-csrf double-submit pattern) ────────

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || "dev-secret-change-in-prod",
  getSessionIdentifier: (req) =>
    (req.cookies?.session_id as string) || (req.ip as string) || "",
  cookieName: "csrf_token",
  cookieOptions: {
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  },
  size: 64,
  getCsrfTokenFromRequest: (req) =>
    (req.headers["x-csrf-token"] as string) || "",
  skipCsrfProtection: (req) => {
    const apiKey = process.env.API_KEY;
    return Boolean(apiKey && req.headers["x-api-key"] === apiKey);
  },
});

function csrfProtect(req: Request, res: Response, next: NextFunction): void {
  doubleCsrfProtection(req, res, next);
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

  app.use("/api/", apiLimiter);

  // CSRF token issuance endpoint (v3.1 C1: primary path, not fallback)
  app.get("/api/csrf-token", (req, res) => {
    const token = generateCsrfToken(req, res);
    res.json({ token });
  });

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
      const systems = payload.systems as string[] | undefined;
      const acAccess = systems
        ? systems.includes("ac")
        : Boolean(payload.ac_access);
      res.json({
        authenticated: true,
        user: {
          username: payload.username,
          role: payload.role,
          ac_access: acAccess,
          systems: systems || [],
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
  app.use("/api/soap", requireAuth, createSoapRouter());

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
