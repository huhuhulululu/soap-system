/**
 * W4.5 CSRF integration test — covers AC7 scenarios (a)–(f).
 *
 * Builds a minimal Express app mirroring server/index.ts's CSRF setup so the
 * test avoids importing routes that depend on soap-producer.ts (which has
 * pre-existing TS errors unrelated to W4 CSRF work).
 *
 * csrf-csrf 4.0.3 double-submit pattern:
 * - GET /api/csrf-token is the primary token endpoint (v3.1 C1 fix)
 * - doubleCsrfProtection validates x-csrf-token header vs cookie on mutating methods
 * - skipCsrfProtection bypasses when x-api-key matches
 */
import express, {
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import http from "http";

interface Res {
  status: number;
  body: unknown;
  setCookies: string[];
}

function buildCsrfTestApp(): Application {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET || "unit-test-secret",
    getSessionIdentifier: (req) =>
      (req.cookies?.session_id as string) || (req.ip as string) || "",
    cookieName: "csrf_token",
    cookieOptions: {
      sameSite: "strict",
      secure: false,
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

  app.get("/api/csrf-token", (req, res) => {
    const token = generateCsrfToken(req, res);
    res.json({ token });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    doubleCsrfProtection(req, res, next);
  });

  app.post("/api/csrf-test-echo", (_req, res) => res.json({ ok: true }));
  return app;
}

function withServer(app: Application) {
  let server: http.Server;
  const start = () =>
    new Promise<number>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        resolve(port);
      });
    });
  const stop = () =>
    new Promise<void>((resolve) => {
      if (!server || !server.listening) return resolve();
      server.close(() => resolve());
    });

  async function request(
    method: string,
    path: string,
    opts: { headers?: Record<string, string>; body?: unknown } = {},
  ): Promise<Res> {
    const port = await start();
    try {
      const headers: Record<string, string> = { ...(opts.headers || {}) };
      let bodyData: string | undefined;
      if (opts.body !== undefined) {
        headers["Content-Type"] = "application/json";
        bodyData = JSON.stringify(opts.body);
      }
      const res = await globalThis.fetch(
        `http://127.0.0.1:${port}${path}`,
        { method, headers, body: bodyData },
      );
      const text = await res.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      const setCookies: string[] = [];
      const maybeGetSet = (res.headers as unknown as {
        getSetCookie?: () => string[];
      }).getSetCookie;
      if (typeof maybeGetSet === "function") {
        setCookies.push(...maybeGetSet.call(res.headers));
      } else {
        res.headers.forEach((v, k) => {
          if (k.toLowerCase() === "set-cookie") setCookies.push(v);
        });
      }
      return { status: res.status, body, setCookies };
    } finally {
      await stop();
    }
  }
  return { request };
}

describe("W4.5 CSRF integration (csrf-csrf@4.0.3 double-submit)", () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    process.env.NODE_ENV = "test";
    process.env.API_KEY = "test-api-key";
    process.env.CSRF_SECRET = "unit-test-secret";
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  test("(a) GET /api/csrf-token returns { token } and sets csrf_token cookie", async () => {
    const { request } = withServer(buildCsrfTestApp());
    const res = await request("GET", "/api/csrf-token");
    expect(res.status).toBe(200);
    expect((res.body as { token?: string }).token).toBeTruthy();
    expect(res.setCookies.join(";").toLowerCase()).toContain("csrf_token=");
  });

  test("(b) POST without CSRF header returns 403", async () => {
    const { request } = withServer(buildCsrfTestApp());
    const res = await request("POST", "/api/csrf-test-echo", { body: {} });
    expect(res.status).toBe(403);
  });

  test("(c) POST with valid header + cookie → 200", async () => {
    const { request } = withServer(buildCsrfTestApp());
    const tokenRes = await request("GET", "/api/csrf-token");
    const token = (tokenRes.body as { token: string }).token;
    const m = tokenRes.setCookies.join("\n").match(/csrf_token=([^;]+)/i);
    expect(m).not.toBeNull();
    const cookie = `csrf_token=${m![1]}`;
    const res = await request("POST", "/api/csrf-test-echo", {
      headers: { "x-csrf-token": token, cookie },
      body: {},
    });
    expect(res.status).toBe(200);
    expect((res.body as { ok?: boolean }).ok).toBe(true);
  });

  test("(d) POST with valid x-api-key bypasses CSRF → 200", async () => {
    const { request } = withServer(buildCsrfTestApp());
    const res = await request("POST", "/api/csrf-test-echo", {
      headers: { "x-api-key": "test-api-key" },
      body: {},
    });
    expect(res.status).toBe(200);
  });

  test("(e) GET /api/csrf-token with x-api-key still returns token", async () => {
    const { request } = withServer(buildCsrfTestApp());
    const res = await request("GET", "/api/csrf-token", {
      headers: { "x-api-key": "test-api-key" },
    });
    expect(res.status).toBe(200);
    expect((res.body as { token?: string }).token).toBeTruthy();
  });

  test("(f) Other GET endpoints do NOT auto-issue CSRF cookie", async () => {
    const { request } = withServer(buildCsrfTestApp());
    const res = await request("GET", "/api/health");
    expect(res.status).toBe(200);
    const cookies = res.setCookies.join(";").toLowerCase();
    expect(cookies).not.toContain("csrf_token=");
  });
});
