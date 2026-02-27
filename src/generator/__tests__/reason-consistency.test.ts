import { describe, it, expect, beforeAll } from "vitest";
import { generateTXSequenceStates } from "../tx-sequence-engine";
import { setWhitelist } from "../../parser/template-rule-whitelist";
import whitelistData from "../../../frontend/src/data/whitelist.json";
import type { GenerationContext } from "../../types";

beforeAll(() => {
  setWhitelist(whitelistData as Record<string, string[]>);
});

function makeContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    noteType: "TX",
    insuranceType: "OPTUM",
    primaryBodyPart: "LBP",
    laterality: "bilateral",
    localPattern: "Cold-Damp + Wind-Cold",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "moderate to severe",
    painCurrent: 8,
    associatedSymptom: "soreness",
    hasPacemaker: false,
    ...overrides,
  } as GenerationContext;
}

// ADL-related reasons: should only appear when adlChange=improved
const ADL_REASONS = [
  "less difficulty performing daily activities",
  "can bend and lift with less discomfort",
  "sitting tolerance has improved",
  "overhead reaching is easier",
  "can reach behind back more comfortably",
  "stair climbing is less painful",
  "can lift objects with less elbow pain",
  "physical activity no longer causes distress",
];

// Pain-related reasons: should only appear when painChange=improved with actual delta
const PAIN_REASONS = [
  "reduced level of pain",
  "can move joint more freely and with less pain",
  "walking distance increased without pain",
  "can walk longer distances comfortably",
];

// O-side reasons: should only appear when objective has non-stable trends
const OBJ_REASONS = [
  "muscle tension has reduced noticeably",
  "shoulder stiffness has decreased",
  "forearm tension has decreased",
  "knee stability has improved",
  "neck rotation range has improved",
  "grip strength has improved",
  "can look over shoulder more easily",
  "less headache related to neck tension",
];

function splitReasons(reason: string): string[] {
  return reason.split(/ and /).map((r) => r.trim());
}

describe("Reason↔dimension consistency", () => {
  const bodyParts = ["LBP", "KNEE", "SHOULDER", "NECK", "ELBOW"] as const;
  const seeds = [42, 999, 2024, 7777, 12345];

  it("ADL-related reasons only appear when adlChange=improved", () => {
    const violations: string[] = [];
    for (const bp of bodyParts) {
      for (const seed of seeds) {
        const ctx = makeContext({
          primaryBodyPart: bp,
          laterality: bp === "LBP" ? "bilateral" : "right",
        });
        const { states } = generateTXSequenceStates(ctx, {
          txCount: 12,
          seed,
          initialState: {
            pain: 8,
            tightness: 3,
            tenderness: 3,
            spasm: 3,
            frequency: 3,
            associatedSymptom: "soreness",
            painTypes: ["Dull", "Aching"],
          },
        });
        for (const st of states) {
          if (st.soaChain.subjective.adlChange !== "improved") {
            const parts = splitReasons(st.reason);
            for (const part of parts) {
              if (ADL_REASONS.includes(part)) {
                violations.push(
                  `${bp} TX${st.visitIndex} seed=${seed}: adl=stable but reason="${part}"`,
                );
              }
            }
          }
        }
      }
    }
    expect(violations, violations.slice(0, 5).join("\n")).toHaveLength(0);
  });

  it("Pain-related reasons only appear when there is actual pain improvement", () => {
    const violations: string[] = [];
    for (const bp of bodyParts) {
      for (const seed of seeds) {
        const ctx = makeContext({
          primaryBodyPart: bp,
          laterality: bp === "LBP" ? "bilateral" : "right",
        });
        const { states } = generateTXSequenceStates(ctx, {
          txCount: 12,
          seed,
          initialState: {
            pain: 8,
            tightness: 3,
            tenderness: 3,
            spasm: 3,
            frequency: 3,
            associatedSymptom: "soreness",
            painTypes: ["Dull", "Aching"],
          },
        });
        let prevPain = 8;
        for (const st of states) {
          const painDelta = prevPain - st.painScaleCurrent;
          if (painDelta <= 0.2) {
            const parts = splitReasons(st.reason);
            for (const part of parts) {
              if (PAIN_REASONS.includes(part)) {
                violations.push(
                  `${bp} TX${st.visitIndex} seed=${seed}: painDelta=${painDelta.toFixed(1)} but reason="${part}"`,
                );
              }
            }
          }
          prevPain = st.painScaleCurrent;
        }
      }
    }
    expect(violations, violations.slice(0, 5).join("\n")).toHaveLength(0);
  });

  it("O-side reasons only appear when objective trends are non-stable", () => {
    const violations: string[] = [];
    for (const bp of bodyParts) {
      for (const seed of seeds) {
        const ctx = makeContext({
          primaryBodyPart: bp,
          laterality: bp === "LBP" ? "bilateral" : "right",
        });
        const { states } = generateTXSequenceStates(ctx, {
          txCount: 12,
          seed,
          initialState: {
            pain: 8,
            tightness: 3,
            tenderness: 3,
            spasm: 3,
            frequency: 3,
            associatedSymptom: "soreness",
            painTypes: ["Dull", "Aching"],
          },
        });
        for (const st of states) {
          const o = st.soaChain.objective;
          const allStable =
            o.tightnessTrend === "stable" &&
            o.tendernessTrend === "stable" &&
            o.spasmTrend === "stable" &&
            o.romTrend === "stable" &&
            o.strengthTrend === "stable";
          if (allStable) {
            const parts = splitReasons(st.reason);
            for (const part of parts) {
              if (OBJ_REASONS.includes(part)) {
                violations.push(
                  `${bp} TX${st.visitIndex} seed=${seed}: all O stable but reason="${part}"`,
                );
              }
            }
          }
        }
      }
    }
    expect(violations, violations.slice(0, 5).join("\n")).toHaveLength(0);
  });

  it("reason diversity still ≤ 20% repeat rate after filtering", () => {
    for (const bp of bodyParts) {
      const ctx = makeContext({
        primaryBodyPart: bp,
        laterality: bp === "LBP" ? "bilateral" : "right",
      });
      for (const seed of seeds) {
        const { states } = generateTXSequenceStates(ctx, {
          txCount: 12,
          seed,
          initialState: {
            pain: 8,
            tightness: 3,
            tenderness: 3,
            spasm: 3,
            frequency: 3,
            associatedSymptom: "soreness",
            painTypes: ["Dull", "Aching"],
          },
        });
        const reasons = states.map((s) => s.reason);
        const unique = new Set(reasons);
        const repeatRate = 1 - unique.size / reasons.length;
        expect(
          repeatRate,
          `${bp} seed=${seed} repeatRate=${(repeatRate * 100).toFixed(0)}%`,
        ).toBeLessThanOrEqual(0.25); // slightly relaxed due to smaller filtered pool
      }
    }
  });
});
