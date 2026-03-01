/**
 * Tests for template consolidation (P0 + P1):
 * V-18: TENDERNESS_OPTIONS should reference TEMPLATE_TENDERNESS_SCALE
 * V-10: TX arrays should reference TEMPLATE_TX_REASON / TEMPLATE_TX_WHAT_CHANGED
 * V-15: NEUTRAL/CAME_BACK_REASONS should derive from TEMPLATE_TX_REASON
 * V-20: deriveAssessmentFromSOA values should be in TX option constants
 */
import { describe, it, expect } from "vitest";
import {
  TEMPLATE_TENDERNESS_SCALE,
  TEMPLATE_TX_REASON,
  TEMPLATE_TX_WHAT_CHANGED,
} from "../../shared/template-options";
import { generateTXSequenceStates } from "../tx-sequence-engine";
import type { GenerationContext } from "../../types";

function makeTxContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    patientName: "TEST,PATIENT(01/01/1970)",
    gender: "M",
    insuranceType: "HF",
    primaryBodyPart: "LBP",
    laterality: "B",
    icdCodes: ["M54.50"],
    cptCodes: ["97810", "97811x3"],
    totalVisits: 10,
    painWorst: 8,
    painBest: 3,
    painCurrent: 6,
    symptomDuration: "3 year(s)",
    painRadiation: "without radiation",
    painTypes: ["Dull", "Aching"],
    associatedSymptoms: ["soreness"],
    causativeFactors: ["age related/degenerative changes"],
    relievingFactors: ["Changing positions", "Resting"],
    symptomScale: "70%-80%",
    painFrequency: "Constant (symptoms occur between 76% and 100% of the time)",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "chronic",
    severityLevel: "moderate",
    secondaryParts: [],
    medicalHistory: [],
    ...overrides,
  };
}

describe("V-18: tenderness grading uses TEMPLATE_TENDERNESS_SCALE", () => {
  const bodyParts = ["SHOULDER", "KNEE", "LBP", "NECK"] as const;

  for (const bp of bodyParts) {
    it(`${bp} tenderness grading is a valid TEMPLATE_TENDERNESS_SCALE value`, () => {
      const ctx = makeTxContext({ primaryBodyPart: bp });
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 5,
        seed: 42,
      });
      const validTexts = Object.values(TEMPLATE_TENDERNESS_SCALE[bp]);

      for (const state of states) {
        if (state.tendernessGrading) {
          expect(
            validTexts,
            `${bp} tenderness "${state.tendernessGrading}" not in TEMPLATE_TENDERNESS_SCALE`,
          ).toContain(state.tendernessGrading);
        }
      }
    });
  }
});

describe("V-10/V-15: TX reason uses TEMPLATE_TX_REASON values", () => {
  it("all generated reasons are in TEMPLATE_TX_REASON", () => {
    const ctx = makeTxContext();
    const validReasons = [...TEMPLATE_TX_REASON];

    // Test multiple seeds to cover different branches
    for (const seed of [1, 42, 100, 200, 500]) {
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 10,
        seed,
      });
      for (const state of states) {
        if (state.reason) {
          expect(
            validReasons,
            `reason "${state.reason}" (seed=${seed}) not in TEMPLATE_TX_REASON`,
          ).toContain(state.reason);
        }
      }
    }
  });
});

describe("V-20: assessment whatChanged uses TEMPLATE_TX_WHAT_CHANGED", () => {
  it("all whatChanged parts are valid template options", () => {
    const ctx = makeTxContext();
    const validOptions = [...TEMPLATE_TX_WHAT_CHANGED];

    for (const seed of [1, 42, 100, 200, 500]) {
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 10,
        seed,
      });
      for (const state of states) {
        const wc = state.soaChain?.assessment?.whatChanged;
        if (wc) {
          const parts = wc
            .split(/,\s*|\s+and\s+/)
            .map((s: string) => s.trim())
            .filter(Boolean);
          for (const part of parts) {
            expect(
              validOptions,
              `whatChanged part "${part}" (seed=${seed}) not in TEMPLATE_TX_WHAT_CHANGED`,
            ).toContain(part);
          }
        }
      }
    }
  });
});
