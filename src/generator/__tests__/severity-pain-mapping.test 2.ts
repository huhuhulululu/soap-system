/**
 * S6: severity↔pain mapping consistency
 *
 * Verifies that the severity level assigned to each visit
 * is consistent with the current pain score.
 */
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

/**
 * Acceptable severity for a given pain score.
 * Allows ±1 band tolerance because ADL improvement can shift severity down.
 */
function acceptableSeverities(pain: number): string[] {
  if (pain >= 9) return ["severe", "moderate to severe"];
  if (pain >= 7) return ["moderate to severe", "moderate"];
  if (pain >= 6) return ["moderate", "mild to moderate"];
  if (pain >= 4) return ["mild to moderate", "mild"];
  return ["mild"];
}

describe("Severity↔pain mapping (S6)", () => {
  const bodyParts = ["LBP", "KNEE", "SHOULDER", "NECK", "ELBOW"] as const;
  const seeds = [42, 999, 2024, 7777, 12345, 54321, 11111, 22222, 33333, 44444];

  it("severity is within acceptable range for current pain across all body parts and seeds", () => {
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
          const acceptable = acceptableSeverities(st.painScaleCurrent);
          if (!acceptable.includes(st.severityLevel)) {
            violations.push(
              `${bp} TX${st.visitIndex} seed=${seed}: pain=${st.painScaleCurrent.toFixed(1)} sev="${st.severityLevel}" expected=[${acceptable.join(",")}]`,
            );
          }
        }
      }
    }
    expect(violations, violations.slice(0, 5).join("\n")).toHaveLength(0);
  });

  it("severity never increases across visits (monotonic descent)", () => {
    const severityRank: Record<string, number> = {
      mild: 0,
      "mild to moderate": 1,
      moderate: 2,
      "moderate to severe": 3,
      severe: 4,
    };
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
        let prevRank = 4; // start at severe
        for (const st of states) {
          const rank = severityRank[st.severityLevel] ?? 0;
          if (rank > prevRank) {
            violations.push(
              `${bp} TX${st.visitIndex} seed=${seed}: severity went UP from rank ${prevRank} to ${rank} ("${st.severityLevel}")`,
            );
          }
          prevRank = rank;
        }
      }
    }
    expect(violations, violations.slice(0, 5).join("\n")).toHaveLength(0);
  });
});
