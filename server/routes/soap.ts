/**
 * SOAP 生产 API 路由
 *
 * POST /api/soap              - 单患者 SOAP 生产
 * POST /api/soap/generate-batch - 多患者批量生产
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  produceSinglePatient,
  type ProduceRequest,
} from "../services/soap-producer";

// ── Zod Schemas ─────────────────────────────────

const normalizeInputSchema = z
  .object({
    noteType: z.enum(["IE", "TX"]),
    insuranceType: z.enum([
      "HF",
      "AETNA",
      "CIGNA",
      "UHC",
      "BCBS",
      "ELDERPLAN",
      "OPTUM",
    ]),
    primaryBodyPart: z.enum([
      "SHOULDER",
      "KNEE",
      "ELBOW",
      "NECK",
      "LBP",
      "MIDDLE_BACK",
      "MID_LOW_BACK",
    ]),
    laterality: z.enum(["left", "right", "bilateral"]),
    painCurrent: z.number().int().min(1).max(10),
    severityLevel: z.enum(["mild", "moderate", "severe"]),
  })
  .passthrough();

const produceRequestSchema = z
  .object({
    input: normalizeInputSchema,
    txCount: z.number().int().min(0),
    seed: z.number().int().optional(),
    realisticPatch: z.boolean().optional(),
    startVisitIndex: z.number().int().optional(),
    ieTxCount: z.number().int().min(0).optional(),
  })
  .refine((data) => data.input.noteType === "IE" || data.txCount >= 1, {
    message: "txCount must be >= 1 when noteType is TX",
    path: ["txCount"],
  });

const batchRequestSchema = z.object({
  patients: z.array(produceRequestSchema).min(1),
});

// ── Router ──────────────────────────────────────

export function createSoapRouter(): Router {
  const router = Router();

  /**
   * POST /api/soap - 单患者 SOAP 生产
   */
  router.post("/", (req: Request, res: Response) => {
    try {
      const parsed = produceRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        });
        return;
      }

      const result = produceSinglePatient(parsed.data as ProduceRequest);
      res.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * POST /api/soap/generate-batch - 多患者批量生产
   */
  router.post("/generate-batch", (req: Request, res: Response) => {
    try {
      const parsed = batchRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        });
        return;
      }

      const results = parsed.data.patients.map((patient) =>
        produceSinglePatient(patient as ProduceRequest),
      );

      res.json({ success: true, data: { patients: results } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}
