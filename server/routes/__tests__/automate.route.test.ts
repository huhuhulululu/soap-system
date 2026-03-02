import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Request } from "express";
import { createAutomateRouter } from "../automate";
import {
  getActiveJob,
  getCookiesInfo,
  getJobStatus,
  hasCookies,
  isRunning,
  saveCookies,
  startAutomation,
  stopAutomation,
} from "../../services/automation-runner";
import { getBatch } from "../../store/batch-store";
import { createMockResponse, getRouteHandler } from "./route-test-helpers";

vi.mock("../../services/automation-runner", () => ({
  saveCookies: vi.fn(),
  getCookiesInfo: vi.fn(),
  hasCookies: vi.fn(),
  startAutomation: vi.fn(),
  getJobStatus: vi.fn(),
  getActiveJob: vi.fn(),
  isRunning: vi.fn(),
  stopAutomation: vi.fn(),
}));

vi.mock("../../store/batch-store", () => ({
  getBatch: vi.fn(),
}));

describe("automate routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (getCookiesInfo as any).mockResolvedValue({ hasCookies: true });
    (hasCookies as any).mockResolvedValue(true);
    (isRunning as any).mockReturnValue(false);
  });

  it("POST /cookies returns 400 for non-object body", async () => {
    const router = createAutomateRouter();
    const handler = getRouteHandler(router, "post", "/cookies");
    const req = { body: null } as unknown as Request;
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "Request body must be a JSON object",
    });
  });

  it("POST /cookies saves storage state when cookies are provided", async () => {
    const router = createAutomateRouter();
    const handler = getRouteHandler(router, "post", "/cookies");
    const req = {
      body: [{ name: "sid", value: "1", domain: ".example.com", path: "/" }],
    } as unknown as Request;
    const res = createMockResponse();
    (getCookiesInfo as any).mockResolvedValue({
      hasCookies: true,
      cookieCount: 1,
    });

    await handler(req, res);

    expect(saveCookies).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload).toEqual({
      success: true,
      data: { cookieCount: 1, hasCookies: true },
    });
  });

  it("POST /cookies returns 400 when cookies field is missing", async () => {
    const router = createAutomateRouter();
    const handler = getRouteHandler(router, "post", "/cookies");
    const req = { body: { origins: [] } } as unknown as Request;
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "Expected {cookies:[...]} or a raw cookies array",
    });
  });

  it("POST /cookies returns 500 when saveCookies fails", async () => {
    const router = createAutomateRouter();
    const handler = getRouteHandler(router, "post", "/cookies");
    const req = {
      body: { cookies: [{ name: "sid", value: "1", domain: ".example.com", path: "/" }] },
    } as unknown as Request;
    const res = createMockResponse();
    (saveCookies as any).mockRejectedValue(new Error("save failed"));

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.jsonPayload).toEqual({ success: false, error: "save failed" });
  });

  it("GET /cookies returns info and handles errors", async () => {
    const router = createAutomateRouter();
    const handler = getRouteHandler(router, "get", "/cookies");

    const okRes = createMockResponse();
    await handler({} as Request, okRes);
    expect(okRes.statusCode).toBe(200);
    expect(okRes.jsonPayload).toEqual({
      success: true,
      data: { hasCookies: true },
    });

    const errRes = createMockResponse();
    (getCookiesInfo as any).mockRejectedValueOnce(new Error("cookie read error"));
    await handler({} as Request, errRes);
    expect(errRes.statusCode).toBe(500);
    expect(errRes.jsonPayload).toEqual({
      success: false,
      error: "cookie read error",
    });
  });

  it("POST /:batchId returns 404 when batch is missing", async () => {
    const router = createAutomateRouter();
    const handler = getRouteHandler(router, "post", "/:batchId");
    const req = { params: { batchId: "b1" } } as unknown as Request;
    const res = createMockResponse();
    (getBatch as any).mockResolvedValue(null);

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.jsonPayload).toEqual({ success: false, error: "Batch not found" });
  });

  it("POST /:batchId returns 409 when another job is running", async () => {
    const router = createAutomateRouter();
    const handler = getRouteHandler(router, "post", "/:batchId");
    const req = { params: { batchId: "b1" } } as unknown as Request;
    const res = createMockResponse();
    (getBatch as any).mockResolvedValue({ confirmed: true });
    (isRunning as any).mockReturnValue(true);
    (getActiveJob as any).mockReturnValue({ batchId: "active-1" });

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "Automation already running for batch active-1",
    });
  });

  it("POST /:batchId returns 400 when batch is not confirmed", async () => {
    const router = createAutomateRouter();
    const handler = getRouteHandler(router, "post", "/:batchId");
    const req = { params: { batchId: "b1" } } as unknown as Request;
    const res = createMockResponse();
    (getBatch as any).mockResolvedValue({ confirmed: false });

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "Batch not confirmed yet",
    });
  });

  it("POST /:batchId returns 400 when cookies are missing", async () => {
    const router = createAutomateRouter();
    const handler = getRouteHandler(router, "post", "/:batchId");
    const req = { params: { batchId: "b1" } } as unknown as Request;
    const res = createMockResponse();
    (getBatch as any).mockResolvedValue({ confirmed: true });
    (hasCookies as any).mockResolvedValue(false);

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "MDLand cookies not uploaded. Upload storage state first.",
    });
  });

  it("POST /:batchId starts automation when preconditions pass", async () => {
    const router = createAutomateRouter();
    const handler = getRouteHandler(router, "post", "/:batchId");
    const req = { params: { batchId: "b1" } } as unknown as Request;
    const res = createMockResponse();
    (getBatch as any).mockResolvedValue({ confirmed: true });
    (startAutomation as any).mockResolvedValue({
      batchId: "b1",
      status: "running",
    });

    await handler(req, res);

    expect(startAutomation).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload).toEqual({
      success: true,
      data: { batchId: "b1", status: "running" },
    });
  });

  it("POST /:batchId returns 500 when startAutomation throws", async () => {
    const router = createAutomateRouter();
    const handler = getRouteHandler(router, "post", "/:batchId");
    const req = { params: { batchId: "b1" } } as unknown as Request;
    const res = createMockResponse();
    (getBatch as any).mockResolvedValue({ confirmed: true });
    (startAutomation as any).mockRejectedValue(new Error("start failed"));

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "start failed",
    });
  });

  it("GET /:batchId returns active job payload", async () => {
    const router = createAutomateRouter();
    const handler = getRouteHandler(router, "get", "/:batchId");
    const req = { params: { batchId: "b2" } } as unknown as Request;
    const res = createMockResponse();
    (getJobStatus as any).mockReturnValue({
      batchId: "b2",
      status: "running",
      logs: ["started"],
      exitCode: null,
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload).toEqual({
      success: true,
      data: {
        batchId: "b2",
        status: "running",
        logs: ["started"],
        exitCode: null,
      },
    });
  });

  it("GET /:batchId returns 500 when getJobStatus throws", async () => {
    const router = createAutomateRouter();
    const handler = getRouteHandler(router, "get", "/:batchId");
    const req = { params: { batchId: "b2" } } as unknown as Request;
    const res = createMockResponse();
    (getJobStatus as any).mockImplementation(() => {
      throw new Error("status failed");
    });

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "status failed",
    });
  });

  it("GET /:batchId and POST /:batchId/stop handle idle/stop states", async () => {
    const router = createAutomateRouter();
    const getHandler = getRouteHandler(router, "get", "/:batchId");
    const stopHandler = getRouteHandler(router, "post", "/:batchId/stop");

    const getReq = { params: { batchId: "b2" } } as unknown as Request;
    const getRes = createMockResponse();
    (getJobStatus as any).mockReturnValue(null);
    await getHandler(getReq, getRes);
    expect(getRes.statusCode).toBe(200);
    expect(getRes.jsonPayload).toEqual({
      success: true,
      data: { batchId: "b2", status: "idle", logs: [], exitCode: null },
    });

    const stopReq = { params: { batchId: "b2" } } as unknown as Request;
    const stopRes404 = createMockResponse();
    (stopAutomation as any).mockReturnValue(false);
    await stopHandler(stopReq, stopRes404);
    expect(stopRes404.statusCode).toBe(404);

    const stopRes200 = createMockResponse();
    (stopAutomation as any).mockReturnValue(true);
    await stopHandler(stopReq, stopRes200);
    expect(stopRes200.statusCode).toBe(200);
    expect(stopRes200.jsonPayload).toEqual({
      success: true,
      data: { stopped: true },
    });
  });

  it("POST /:batchId/stop returns 500 when stopAutomation throws", async () => {
    const router = createAutomateRouter();
    const stopHandler = getRouteHandler(router, "post", "/:batchId/stop");
    const req = { params: { batchId: "b2" } } as unknown as Request;
    const res = createMockResponse();
    (stopAutomation as any).mockImplementation(() => {
      throw new Error("stop failed");
    });

    await stopHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "stop failed",
    });
  });
});
