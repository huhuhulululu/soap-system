/**
 * Regression tests for 3 template compliance bugs:
 * V-21: "overall condition" not in TEMPLATE_TX_WHAT_CHANGED
 * V-14: PATTERN_TONGUE_DEFAULTS missing 2 patterns (Yin Deficiency Fire, LU & KI Deficiency)
 * V-11: ELBOW painTypeOptions incorrectly includes "pin & needles"
 */
import { describe, it, expect } from "vitest";
import {
  TEMPLATE_TX_WHAT_CHANGED,
  TEMPLATE_PAIN_TYPES,
} from "../../shared/template-options";
import { generateTXSequenceStates } from "../tx-sequence-engine";
import type { GenerationContext } from "../../types";

// Minimal context factory for TX generation
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

describe("V-21: whatChanged must only use TEMPLATE_TX_WHAT_CHANGED values", () => {
  it("TEMPLATE_TX_WHAT_CHANGED does not contain 'overall condition'", () => {
    expect(TEMPLATE_TX_WHAT_CHANGED).not.toContain("overall condition");
  });

  it("seed=1 txCount=10 whatChanged never contains 'overall condition'", () => {
    // seed=1 previously triggered "overall condition" fallback
    const ctx = makeTxContext();
    const { states } = generateTXSequenceStates(ctx, { txCount: 10, seed: 1 });
    const validOptions = [...TEMPLATE_TX_WHAT_CHANGED];

    for (const state of states) {
      if (state.soaChain?.assessment?.whatChanged) {
        const wc = state.soaChain.assessment.whatChanged;
        const parts = wc
          .split(/,\s*|\s+and\s+/)
          .map((s: string) => s.trim())
          .filter(Boolean);
        for (const part of parts) {
          expect(
            validOptions,
            `"${part}" from whatChanged="${wc}" is not in TEMPLATE_TX_WHAT_CHANGED`,
          ).toContain(part);
        }
      }
    }
  });
});

describe("V-14: PATTERN_TONGUE_DEFAULTS must cover all TONE_MAP patterns", () => {
  it("Yin Deficiency Fire + LU & KI Deficiency: tongue/pulse not generic fallback", () => {
    // When BOTH local and systemic are missing from PATTERN_TONGUE_DEFAULTS,
    // it falls back to generic "Pink with thin white coating" / "Even and moderate"
    const ctx = makeTxContext({
      localPattern: "Yin Deficiency Fire",
      systemicPattern: "LU & KI Deficiency",
    });
    const { states } = generateTXSequenceStates(ctx, { txCount: 3, seed: 42 });
    expect(states.length).toBeGreaterThan(0);
    expect(states[0].tonguePulse.tongue).not.toBe(
      "Pink with thin white coating",
    );
    expect(states[0].tonguePulse.pulse).not.toBe("Even and moderate");
  });

  it("Yin Deficiency Fire as sole pattern uses pattern-specific tongue/pulse", () => {
    const ctx = makeTxContext({
      localPattern: "Yin Deficiency Fire",
      systemicPattern: "",
    });
    const { states } = generateTXSequenceStates(ctx, { txCount: 3, seed: 42 });
    expect(states.length).toBeGreaterThan(0);
    // Should match TONE_MAP "Yin Deficiency Fire": cracked / thready
    expect(states[0].tonguePulse.tongue).toBe("cracked");
    expect(states[0].tonguePulse.pulse).toBe("thready");
  });

  it("LU & KI Deficiency as sole pattern uses pattern-specific tongue/pulse", () => {
    const ctx = makeTxContext({
      localPattern: "",
      systemicPattern: "LU & KI Deficiency",
    });
    const { states } = generateTXSequenceStates(ctx, { txCount: 3, seed: 42 });
    expect(states.length).toBeGreaterThan(0);
    // Should match TONE_MAP "LU & KI Deficiency": pale, thin white coat / thready
    expect(states[0].tonguePulse.tongue).toBe("pale, thin white coat");
    expect(states[0].tonguePulse.pulse).toBe("thready");
  });
});

describe("V-11: ELBOW painTypeOptions must not include 'pin & needles'", () => {
  it("TEMPLATE_PAIN_TYPES.ELBOW excludes 'pin & needles'", () => {
    expect(TEMPLATE_PAIN_TYPES.ELBOW).not.toContain("pin & needles");
  });

  it("TEMPLATE_PAIN_TYPES.LBP includes 'pin & needles' (sanity check)", () => {
    expect(TEMPLATE_PAIN_TYPES.LBP).toContain("pin & needles");
  });

  it("ELBOW has 12 pain types, others have 13", () => {
    expect(TEMPLATE_PAIN_TYPES.ELBOW).toHaveLength(12);
    expect(TEMPLATE_PAIN_TYPES.LBP).toHaveLength(13);
  });
});
