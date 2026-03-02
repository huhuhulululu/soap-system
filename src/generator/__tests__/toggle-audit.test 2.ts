import { describe, it, expect } from "vitest";
import { generateTXSequenceStates } from "../tx-sequence-engine";
import type { GenerationContext } from "../../types";

const BODY_PARTS = ["LBP", "NECK", "SHOULDER", "KNEE", "ELBOW"] as const;
const SEEDS = [42, 1000, 2000, 3000, 5000, 7777, 9999, 12345, 54321, 99999];
const SEVERITY_ORDER = [
  "mild",
  "mild to moderate",
  "moderate",
  "moderate to severe",
  "severe",
];
const STRENGTH_ORDER = ["3-/5", "3/5", "3+/5", "4-/5", "4/5", "4+/5", "5/5"];

function makeContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    noteType: "TX",
    insuranceType: "NONE",
    primaryBodyPart: "SHOULDER",
    laterality: "left",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "moderate to severe",
    painCurrent: 8,
    ...overrides,
  } as GenerationContext;
}

// ============================================================
// A. 开关关闭状态审计
// ============================================================
describe("Audit: allowNegativeEvents=OFF (default)", () => {
  it("zero negative symptomChange across 10 seeds × 5 body parts × 20 visits", () => {
    for (const bp of BODY_PARTS) {
      const ctx = makeContext({ primaryBodyPart: bp });
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed });
        for (const s of states) {
          expect(
            s.symptomChange,
            `OFF: ${bp} seed=${seed} v${s.visitIndex} has negative: "${s.symptomChange}"`,
          ).not.toMatch(/exacerbate|came back/);
        }
      }
    }
  });

  it("soaChain.subjective.painChange is only improved or similar", () => {
    for (const bp of BODY_PARTS) {
      const ctx = makeContext({ primaryBodyPart: bp });
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed });
        for (const s of states) {
          if (!s.soaChain) continue;
          expect(
            ["improved", "similar"],
            `OFF: ${bp} seed=${seed} v${s.visitIndex} painChange="${s.soaChain.subjective.painChange}"`,
          ).toContain(s.soaChain.subjective.painChange);
        }
      }
    }
  });

  it("pain monotonically decreases (never increases)", () => {
    for (const bp of BODY_PARTS) {
      const ctx = makeContext({ primaryBodyPart: bp });
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed });
        for (let i = 1; i < states.length; i++) {
          expect(
            states[i].painScaleCurrent,
            `OFF: ${bp} seed=${seed} v${i + 1} pain ${states[i].painScaleCurrent} > prev ${states[i - 1].painScaleCurrent}`,
          ).toBeLessThanOrEqual(states[i - 1].painScaleCurrent + 0.01);
        }
      }
    }
  });
});

// ============================================================
// B. 开关开启状态审计
// ============================================================
describe("Audit: allowNegativeEvents=ON", () => {
  it("negative events exist but ≤ 10% across 10 seeds × 5 body parts × 20 visits", () => {
    let totalVisits = 0;
    let negativeVisits = 0;
    for (const bp of BODY_PARTS) {
      const ctx = makeContext({
        primaryBodyPart: bp,
        allowNegativeEvents: true,
      });
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed });
        for (const s of states) {
          totalVisits++;
          if (
            s.symptomChange.includes("exacerbate") ||
            s.symptomChange.includes("came back")
          ) {
            negativeVisits++;
          }
        }
      }
    }
    const rate = negativeVisits / totalVisits;
    expect(negativeVisits, "ON: no negative events at all").toBeGreaterThan(0);
    expect(
      rate,
      `ON: negative rate ${(rate * 100).toFixed(1)}% > 10%`,
    ).toBeLessThanOrEqual(0.1);
  });

  it("visit 1 never has negative events", () => {
    for (const bp of BODY_PARTS) {
      const ctx = makeContext({
        primaryBodyPart: bp,
        allowNegativeEvents: true,
      });
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed });
        expect(
          states[0].symptomChange,
          `ON: ${bp} seed=${seed} v1 is negative`,
        ).not.toMatch(/exacerbate|came back/);
      }
    }
  });

  it("PRNG determinism: same seed same result with toggle on", () => {
    const ctx = makeContext({ allowNegativeEvents: true });
    const baseline = generateTXSequenceStates(ctx, { txCount: 20, seed: 42 });
    for (let i = 0; i < 20; i++) {
      const run = generateTXSequenceStates(ctx, { txCount: 20, seed: 42 });
      expect(run.states.map((s) => s.reason)).toEqual(
        baseline.states.map((s) => s.reason),
      );
    }
  });
});

// ============================================================
// C. ST/LT 趋向度审计 (20次: 前12次→ST, 后8次→LT)
// ============================================================
describe("Audit: ST/LT goal progression (20 visits, boundary=12)", () => {
  it("pain: v12 closer to ST goal than v1, v20 closer to LT goal than v12", () => {
    for (const bp of BODY_PARTS) {
      const ctx = makeContext({ primaryBodyPart: bp });
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed });
        const v1Pain = states[0].painScaleCurrent;
        const v12Pain = states[11].painScaleCurrent;
        const v20Pain = states[19].painScaleCurrent;
        // v12 should be lower than v1 (closer to ST goal)
        expect(
          v12Pain,
          `${bp} seed=${seed}: v12 pain not < v1`,
        ).toBeLessThanOrEqual(v1Pain);
        // v20 should be lower than or equal to v12 (closer to LT goal)
        expect(
          v20Pain,
          `${bp} seed=${seed}: v20 pain not ≤ v12`,
        ).toBeLessThanOrEqual(v12Pain + 0.01);
      }
    }
  });

  it("tightness/tenderness/spasm: v12 ≤ v1, v20 ≤ v12 (severity order)", () => {
    for (const bp of BODY_PARTS) {
      const ctx = makeContext({ primaryBodyPart: bp });
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed });
        for (const dim of [
          "tightnessGrading",
          "tendernessGrading",
          "spasmGrading",
        ] as const) {
          const v1 = SEVERITY_ORDER.indexOf(states[0][dim]);
          const v12 = SEVERITY_ORDER.indexOf(states[11][dim]);
          const v20 = SEVERITY_ORDER.indexOf(states[19][dim]);
          // Allow at most +1 bounce but overall trend must be down
          expect(
            v12,
            `${bp} seed=${seed} ${dim}: v12(${states[11][dim]}) > v1(${states[0][dim]})`,
          ).toBeLessThanOrEqual(v1 + 1);
          expect(
            v20,
            `${bp} seed=${seed} ${dim}: v20(${states[19][dim]}) > v12(${states[11][dim]})`,
          ).toBeLessThanOrEqual(v12 + 1);
        }
      }
    }
  });

  it("strength: v12 ≥ v1, v20 ≥ v12 (monotonic increase)", () => {
    for (const bp of BODY_PARTS) {
      const ctx = makeContext({ primaryBodyPart: bp });
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed });
        const v1 = STRENGTH_ORDER.indexOf(states[0].strengthGrade ?? "4/5");
        const v12 = STRENGTH_ORDER.indexOf(states[11].strengthGrade ?? "4/5");
        const v20 = STRENGTH_ORDER.indexOf(states[19].strengthGrade ?? "4/5");
        expect(
          v12,
          `${bp} seed=${seed}: strength v12 < v1`,
        ).toBeGreaterThanOrEqual(v1);
        expect(
          v20,
          `${bp} seed=${seed}: strength v20 < v12`,
        ).toBeGreaterThanOrEqual(v12);
      }
    }
  });

  it("both ST and LT phases have reasonable improvement rates (≥ 30%)", () => {
    let stImprovements = 0;
    let ltImprovements = 0;
    let stTotal = 0;
    let ltTotal = 0;
    for (const bp of BODY_PARTS) {
      const ctx = makeContext({ primaryBodyPart: bp });
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed });
        for (let i = 0; i < states.length; i++) {
          const isImprovement = states[i].symptomChange.includes("improvement");
          if (i < 12) {
            stTotal++;
            if (isImprovement) stImprovements++;
          } else {
            ltTotal++;
            if (isImprovement) ltImprovements++;
          }
        }
      }
    }
    const stRate = stImprovements / stTotal;
    const ltRate = ltImprovements / ltTotal;
    // Both phases should show meaningful improvement (≥ 30%)
    expect(
      stRate,
      `ST improvement rate ${(stRate * 100).toFixed(0)}% < 30%`,
    ).toBeGreaterThanOrEqual(0.3);
    expect(
      ltRate,
      `LT improvement rate ${(ltRate * 100).toFixed(0)}% < 30%`,
    ).toBeGreaterThanOrEqual(0.3);
  });

  it("overall: v20 is strictly better than v1 across all dimensions", () => {
    for (const bp of BODY_PARTS) {
      const ctx = makeContext({ primaryBodyPart: bp });
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed });
        const v1 = states[0];
        const v20 = states[19];
        // Pain decreased
        expect(
          v20.painScaleCurrent,
          `${bp} seed=${seed}: v20 pain not < v1`,
        ).toBeLessThanOrEqual(v1.painScaleCurrent);
        // Severity same or better
        expect(
          SEVERITY_ORDER.indexOf(v20.severityLevel),
          `${bp} seed=${seed}: v20 severity worse than v1`,
        ).toBeLessThanOrEqual(SEVERITY_ORDER.indexOf(v1.severityLevel));
        // Strength same or better
        const s1 = STRENGTH_ORDER.indexOf(v1.strengthGrade ?? "4/5");
        const s20 = STRENGTH_ORDER.indexOf(v20.strengthGrade ?? "4/5");
        expect(
          s20,
          `${bp} seed=${seed}: v20 strength < v1`,
        ).toBeGreaterThanOrEqual(s1);
      }
    }
  });
});
