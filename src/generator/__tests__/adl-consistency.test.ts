/**
 * ADL consistency: adlChange=improved only when ADL items actually changed,
 * and Assessment mentions ADL only when adlChange=improved.
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

const bodyParts = ["LBP", "KNEE", "SHOULDER", "NECK", "ELBOW"] as const;
const seeds = [42, 999, 2024, 7777, 12345];

describe("ADL consistency (S→A chain)", () => {
  it("adlChange=improved only when ADL item count actually decreased", () => {
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
        let prevAdlCount = -1;
        for (const st of states) {
          const adlCount = st.adlItems?.length ?? 0;
          const adlChange = st.soaChain?.subjective?.adlChange ?? "stable";
          if (adlChange === "improved" && prevAdlCount >= 0 && adlCount >= prevAdlCount) {
            violations.push(
              `${bp} TX${st.visitIndex} seed=${seed}: adlChange=improved but adlCount ${prevAdlCount}→${adlCount}`,
            );
          }
          prevAdlCount = adlCount;
        }
      }
    }
    expect(violations, violations.slice(0, 5).join("\n")).toHaveLength(0);
  });

  it("Assessment mentions ADL only when adlChange=improved", () => {
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
          const adlChange = st.soaChain?.subjective?.adlChange ?? "stable";
          const whatChanged = st.soaChain?.assessment?.whatChanged ?? "";
          if (whatChanged.includes("ADL") && adlChange !== "improved") {
            violations.push(
              `${bp} TX${st.visitIndex} seed=${seed}: A mentions ADL but S.adlChange=${adlChange}`,
            );
          }
        }
      }
    }
    expect(violations, violations.slice(0, 5).join("\n")).toHaveLength(0);
  });
});
