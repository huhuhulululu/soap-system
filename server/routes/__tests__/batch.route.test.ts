import { vi } from "vitest";
import type { Request } from "express";
import fs from "fs";
import { createBatchRouter } from "../batch";
import {
  buildPatientsFromRows,
  parseExcelBuffer,
} from "../../services/excel-parser";
import { regenerateVisit } from "../../services/batch-generator";
import { generateBatchAsync } from "../../services/soap-worker-pool";
import {
  confirmBatch,
  generateBatchId,
  getBatch,
  saveBatch,
} from "../../store/batch-store";
import { createMockResponse, getRouteHandler } from "./route-test-helpers";

vi.mock("../../services/excel-parser", () => ({
  parseExcelBuffer: vi.fn(),
  buildPatientsFromRows: vi.fn(),
}));

vi.mock("../../services/batch-generator", () => ({
  regenerateVisit: vi.fn(),
}));

vi.mock("../../services/soap-worker-pool", () => ({
  generateBatchAsync: vi.fn(),
}));

vi.mock("../../store/batch-store", () => ({
  generateBatchId: vi.fn(() => "batch-1"),
  saveBatch: vi.fn(),
  getBatch: vi.fn(),
  confirmBatch: vi.fn(),
}));

describe("batch routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (generateBatchId as any).mockReturnValue("batch-1");
  });

  it("POST / returns 400 for invalid excel header bytes", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(router, "post", "/");
    const req = {
      file: { buffer: Buffer.from([0x00, 0x11, 0x22, 0x33]) },
      body: {},
    } as unknown as Request;
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "Invalid file format",
    });
  });

  it("POST / parses mode/flags and persists generated batch", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(router, "post", "/");
    const rows = [{ Patient: "A" }];
    const patients = [{ visits: [] }];
    const summary = { totalPatients: 1, totalVisits: 2, byType: { IE: 1, TX: 1 } };
    (parseExcelBuffer as any).mockResolvedValue(rows);
    (buildPatientsFromRows as any).mockReturnValue({ patients, summary });
    (generateBatchAsync as any).mockResolvedValue({
      patients,
      totalGenerated: 2,
      totalFailed: 0,
    });

    const req = {
      file: { buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xaa]) },
      body: {
        mode: "continue",
        realisticPatch: "true",
        disableChronicCaps: true,
      },
    } as unknown as Request;
    const res = createMockResponse();

    await handler(req, res);

    expect(buildPatientsFromRows).toHaveBeenCalledWith(rows, "continue");
    expect(generateBatchAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: "batch-1",
        mode: "continue",
      }),
      true,
      true,
    );
    expect(saveBatch).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload).toEqual({
      success: true,
      data: {
        batchId: "batch-1",
        totalPatients: 1,
        totalVisits: 2,
        totalGenerated: 2,
        totalFailed: 0,
        byType: { IE: 1, TX: 1 },
      },
    });
  });

  it("POST / returns 400 when parseExcelBuffer throws", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(router, "post", "/");
    (parseExcelBuffer as any).mockRejectedValue(new Error("parse failed"));

    const req = {
      file: { buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xbb]) },
      body: {},
    } as unknown as Request;
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "parse failed",
    });
  });

  it("POST /json validates rows and handles generation", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(router, "post", "/json");

    const badReq = { body: {} } as unknown as Request;
    const badRes = createMockResponse();
    await handler(badReq, badRes);
    expect(badRes.statusCode).toBe(400);
    expect(badRes.jsonPayload).toEqual({
      success: false,
      error: "rows[] is required",
    });

    const rows = [{ Patient: "A" }];
    const patients = [{ visits: [] }];
    const summary = { totalPatients: 1, totalVisits: 1, byType: { IE: 1 } };
    (buildPatientsFromRows as any).mockReturnValue({ patients, summary });
    (generateBatchAsync as any).mockResolvedValue({
      patients,
      totalGenerated: 1,
      totalFailed: 0,
    });

    const okReq = {
      body: {
        rows,
        mode: "soap-only",
        realisticPatch: true,
        disableChronicCaps: "true",
      },
    } as unknown as Request;
    const okRes = createMockResponse();
    await handler(okReq, okRes);
    expect(buildPatientsFromRows).toHaveBeenCalledWith(rows, "soap-only");
    expect(generateBatchAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "soap-only" }),
      true,
      true,
    );
    expect(okRes.statusCode).toBe(200);
  });

  it("POST /json returns 400 when worker generation fails", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(router, "post", "/json");
    (buildPatientsFromRows as any).mockReturnValue({
      patients: [],
      summary: { totalPatients: 0, totalVisits: 0, byType: {} },
    });
    (generateBatchAsync as any).mockRejectedValue(new Error("worker failed"));
    const req = { body: { rows: [{}] } } as unknown as Request;
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "worker failed",
    });
  });

  it("GET /:id returns 404 when batch is missing", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(router, "get", "/:id");
    const req = { params: { id: "missing" } } as unknown as Request;
    const res = createMockResponse();
    (getBatch as any).mockResolvedValue(null);

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.jsonPayload).toEqual({ success: false, error: "Batch not found" });
  });

  it("GET /:id returns batch payload", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(router, "get", "/:id");
    const req = { params: { id: "b1" } } as unknown as Request;
    const res = createMockResponse();
    (getBatch as any).mockResolvedValue({ batchId: "b1", patients: [] });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload).toEqual({
      success: true,
      data: { batchId: "b1", patients: [] },
    });
  });

  it("GET /:id returns 500 when getBatch throws", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(router, "get", "/:id");
    const req = { params: { id: "b1" } } as unknown as Request;
    const res = createMockResponse();
    (getBatch as any).mockRejectedValue(new Error("db read failed"));

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "db read failed",
    });
  });

  it("PUT /:batchId/visit/:patientIdx/:visitIdx validates indexes", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(
      router,
      "put",
      "/:batchId/visit/:patientIdx/:visitIdx",
    );
    const req = {
      params: { batchId: "b1", patientIdx: "x", visitIdx: "1" },
      body: {},
    } as unknown as Request;
    const res = createMockResponse();
    (getBatch as any).mockResolvedValue({ patients: [] });

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "Invalid patient or visit index",
    });
  });

  it("PUT /:batchId/visit/:patientIdx/:visitIdx regenerates and persists visit", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(
      router,
      "put",
      "/:batchId/visit/:patientIdx/:visitIdx",
    );

    const originalVisit = { visitNumber: 1, generated: "old", context: {} };
    const batch = {
      batchId: "b1",
      patients: [{ visits: [originalVisit] }],
    };
    const regeneratedVisit = { ...originalVisit, generated: "new" };
    (getBatch as any).mockResolvedValue(batch);
    (regenerateVisit as any).mockReturnValue(regeneratedVisit);

    const req = {
      params: { batchId: "b1", patientIdx: "0", visitIdx: "0" },
      body: { seed: 42 },
    } as unknown as Request;
    const res = createMockResponse();

    await handler(req, res);

    expect(regenerateVisit).toHaveBeenCalled();
    expect(saveBatch).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.jsonPayload).toEqual({
      success: true,
      data: { patientIndex: 0, visitIndex: 0, generated: "new" },
    });
  });

  it("PUT /:batchId/visit/:patientIdx/:visitIdx handles missing batch/patient/visit", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(
      router,
      "put",
      "/:batchId/visit/:patientIdx/:visitIdx",
    );

    const req = {
      params: { batchId: "b1", patientIdx: "0", visitIdx: "0" },
      body: {},
    } as unknown as Request;

    const missingBatchRes = createMockResponse();
    (getBatch as any).mockResolvedValueOnce(null);
    await handler(req, missingBatchRes);
    expect(missingBatchRes.statusCode).toBe(404);
    expect(missingBatchRes.jsonPayload).toEqual({
      success: false,
      error: "Batch not found",
    });

    const missingPatientRes = createMockResponse();
    (getBatch as any).mockResolvedValueOnce({ patients: [] });
    await handler(req, missingPatientRes);
    expect(missingPatientRes.statusCode).toBe(404);
    expect(missingPatientRes.jsonPayload).toEqual({
      success: false,
      error: "Patient not found",
    });

    const missingVisitRes = createMockResponse();
    (getBatch as any).mockResolvedValueOnce({ patients: [{ visits: [] }] });
    await handler(req, missingVisitRes);
    expect(missingVisitRes.statusCode).toBe(404);
    expect(missingVisitRes.jsonPayload).toEqual({
      success: false,
      error: "Visit not found",
    });
  });

  it("PUT /:batchId/visit/:patientIdx/:visitIdx returns 500 on regeneration error", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(
      router,
      "put",
      "/:batchId/visit/:patientIdx/:visitIdx",
    );
    const req = {
      params: { batchId: "b1", patientIdx: "0", visitIdx: "0" },
      body: {},
    } as unknown as Request;
    const res = createMockResponse();
    (getBatch as any).mockResolvedValue({
      patients: [{ visits: [{ generated: "old", context: {} }] }],
    });
    (regenerateVisit as any).mockImplementation(() => {
      throw new Error("regen failed");
    });

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "regen failed",
    });
  });

  it("POST /:batchId/generate handles missing and existing batch", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(router, "post", "/:batchId/generate");

    const reqMissing = {
      params: { batchId: "missing" },
      body: {},
    } as unknown as Request;
    const resMissing = createMockResponse();
    (getBatch as any).mockResolvedValueOnce(null);
    await handler(reqMissing, resMissing);
    expect(resMissing.statusCode).toBe(404);

    const reqOk = { params: { batchId: "b1" }, body: {} } as unknown as Request;
    const resOk = createMockResponse();
    const batch = { batchId: "b1", patients: [] };
    (getBatch as any).mockResolvedValueOnce(batch);
    (generateBatchAsync as any).mockResolvedValue({
      patients: [],
      totalGenerated: 2,
      totalFailed: 0,
    });
    await handler(reqOk, resOk);
    expect(resOk.statusCode).toBe(200);
    expect(saveBatch).toHaveBeenCalled();
  });

  it("POST /:batchId/generate passes flags and handles worker errors", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(router, "post", "/:batchId/generate");
    const req = {
      params: { batchId: "b1" },
      body: { realisticPatch: "true", disableChronicCaps: true },
    } as unknown as Request;
    const okRes = createMockResponse();
    (getBatch as any).mockResolvedValueOnce({ batchId: "b1", patients: [] });
    (generateBatchAsync as any).mockResolvedValueOnce({
      patients: [],
      totalGenerated: 1,
      totalFailed: 0,
    });

    await handler(req, okRes);
    expect(generateBatchAsync).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: "b1" }),
      true,
      true,
    );
    expect(okRes.statusCode).toBe(200);

    const errRes = createMockResponse();
    (getBatch as any).mockResolvedValueOnce({ batchId: "b1", patients: [] });
    (generateBatchAsync as any).mockRejectedValueOnce(new Error("batch failed"));
    await handler(req, errRes);
    expect(errRes.statusCode).toBe(500);
    expect(errRes.jsonPayload).toEqual({
      success: false,
      error: "batch failed",
    });
  });

  it("POST /:batchId/confirm and GET /template/download handle 404 branches", async () => {
    const router = createBatchRouter();
    const confirmHandler = getRouteHandler(router, "post", "/:batchId/confirm");
    const downloadHandler = getRouteHandler(router, "get", "/template/download");

    const reqConfirm = { params: { batchId: "b1" } } as unknown as Request;
    const resConfirm404 = createMockResponse();
    (confirmBatch as any).mockResolvedValueOnce(false);
    await confirmHandler(reqConfirm, resConfirm404);
    expect(resConfirm404.statusCode).toBe(404);

    const resConfirm200 = createMockResponse();
    (confirmBatch as any).mockResolvedValueOnce(true);
    await confirmHandler(reqConfirm, resConfirm200);
    expect(resConfirm200.statusCode).toBe(200);

    const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const resDownload = createMockResponse();
    await downloadHandler({} as Request, resDownload);
    expect(resDownload.statusCode).toBe(404);
    expect(resDownload.jsonPayload).toEqual({
      success: false,
      error: "Template file not found",
    });
    existsSpy.mockRestore();
  });

  it("POST /:batchId/confirm returns 500 on store failure", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(router, "post", "/:batchId/confirm");
    const req = { params: { batchId: "b1" } } as unknown as Request;
    const res = createMockResponse();
    (confirmBatch as any).mockRejectedValue(new Error("confirm failed"));

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "confirm failed",
    });
  });

  it("GET /template/download downloads template when file exists", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(router, "get", "/template/download");
    const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);
    const res = createMockResponse() as typeof createMockResponse extends () => infer R
      ? R & { download: any }
      : never;
    res.download = vi.fn().mockReturnValue(res);

    await handler({} as Request, res);

    expect(res.statusCode).toBe(200);
    expect(res.download).toHaveBeenCalledWith(
      expect.stringMatching(/batch-template\.xlsx$/),
      "batch-template.xlsx",
    );
    existsSpy.mockRestore();
  });

  it("GET /template/download returns 500 when fs.existsSync throws", async () => {
    const router = createBatchRouter();
    const handler = getRouteHandler(router, "get", "/template/download");
    const existsSpy = vi.spyOn(fs, "existsSync").mockImplementation(() => {
      throw new Error("fs failed");
    });
    const res = createMockResponse();

    await handler({} as Request, res);

    expect(res.statusCode).toBe(500);
    expect(res.jsonPayload).toEqual({
      success: false,
      error: "fs failed",
    });
    existsSpy.mockRestore();
  });
});
