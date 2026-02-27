/**
 * A-SORENESS-PHANTOM: Assessment must NOT mention "muscles soreness sensation"
 * when the final displayed symptomScale is unchanged from previous visit.
 *
 * Root cause: symptomScaleChanged is computed before the output-layer cap,
 * which can defer symptomScale changes, making the Assessment claim stale.
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
    primaryBodyPart: "SHOULDER",
    laterality: "right",
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

const defaultOpts = {
  txCount: 20,
  seed: 2024,
  initialState: {
    pain: 8,
    tightness: 3,
    tenderness: 3,
    spasm: 3,
    frequency: 3,
    associatedSymptom: "soreness" as const,
    painTypes: ["Dull", "Aching"] as string[],
  },
};

describe("A-SORENESS-PHANTOM: symptomScale↔Assessment consistency", () => {
  it("Assessment mentions 'soreness sensation' only when symptomScale actually changed", () => {
    const bodyParts = ["LBP", "KNEE", "SHOULDER", "NECK", "ELBOW"] as const;
    const seeds = [42, 999, 2024, 7777, 12345];
    const violations: string[] = [];

    for (const bp of bodyParts) {
      for (const seed of seeds) {
        const ctx = makeContext({
          primaryBodyPart: bp,
          laterality: bp === "LBP" ? "bilateral" : "right",
        });
        const { states } = generateTXSequenceStates(ctx, {
          ...defaultOpts,
          seed,
        });

        for (let i = 1; i < states.length; i++) {
          const st = states[i];
          const prev = states[i - 1];
          const whatChanged = st.soaChain?.assessment?.whatChanged ?? "";

          if (
            whatChanged.includes("soreness sensation") &&
            st.symptomScale === prev.symptomScale
          ) {
            violations.push(
              `${bp} TX${st.visitIndex} seed=${seed}: A.whatChanged="${whatChanged}" but symptomScale=${st.symptomScale} unchanged`,
            );
          }
        }
      }
    }

    if (violations.length > 0) {
      console.log(
        `A-SORENESS-PHANTOM violations (${violations.length}):`,
      );
      violations.slice(0, 10).forEach((v) => console.log(`  ${v}`));
    }
    expect(violations).toHaveLength(0);
  });
});
