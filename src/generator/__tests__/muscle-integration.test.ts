import { describe, it, expect } from "vitest";
import { generateTXSequenceStates } from "../tx-sequence-engine";
import {
  TEMPLATE_MUSCLES,
  TEMPLATE_ADL,
  TEMPLATE_AGGRAVATING,
  type BodyPartKey,
} from "../../shared/template-options";
import type { GenerationContext } from "../../types";

const BODY_PARTS: BodyPartKey[] = ["LBP", "SHOULDER", "KNEE"];
const SEEDS = [42, 314, 1337];

function makeContext(
  bp: BodyPartKey,
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    noteType: "TX",
    insuranceType: "NONE",
    primaryBodyPart: bp,
    laterality: "left",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "moderate to severe",
    painCurrent: 8,
    ...overrides,
  };
}

function allTemplateMuscles(bp: BodyPartKey): Set<string> {
  const pools = TEMPLATE_MUSCLES[bp];
  const all = new Set<string>();
  for (const m of pools.tightness) all.add(m);
  for (const m of pools.tenderness) all.add(m);
  for (const m of pools.spasm) all.add(m);
  return all;
}

describe("muscle integration in TX engine", () => {
  for (const bp of BODY_PARTS) {
    describe(bp, () => {
      for (const seed of SEEDS) {
        const result = generateTXSequenceStates(makeContext(bp), {
          txCount: 16,
          seed,
        });
        const { states } = result;

        it(`seed=${seed}: every visit has muscle arrays`, () => {
          for (const s of states) {
            expect(Array.isArray(s.tightMuscles)).toBe(true);
            expect(Array.isArray(s.tenderMuscles)).toBe(true);
            expect(Array.isArray(s.spasmMuscles)).toBe(true);
          }
        });

        it(`seed=${seed}: subset constraint spasm ⊆ tenderness ⊆ tightness`, () => {
          for (const s of states) {
            const tightSet = new Set(s.tightMuscles);
            const tenderSet = new Set(s.tenderMuscles);

            for (const m of s.tenderMuscles) {
              expect(tightSet.has(m)).toBe(true);
            }
            for (const m of s.spasmMuscles) {
              expect(tenderSet.has(m)).toBe(true);
            }
          }
        });

        it(`seed=${seed}: muscle counts monotonically decrease or stay stable`, () => {
          for (let i = 1; i < states.length; i++) {
            expect(states[i].tightMuscles.length).toBeLessThanOrEqual(
              states[i - 1].tightMuscles.length,
            );
            expect(states[i].tenderMuscles.length).toBeLessThanOrEqual(
              states[i - 1].tenderMuscles.length,
            );
            expect(states[i].spasmMuscles.length).toBeLessThanOrEqual(
              states[i - 1].spasmMuscles.length,
            );
          }
        });

        it(`seed=${seed}: all muscle names from TEMPLATE_MUSCLES`, () => {
          const valid = allTemplateMuscles(bp);
          for (const s of states) {
            for (const m of s.tightMuscles) {
              expect(valid.has(m)).toBe(true);
            }
            for (const m of s.tenderMuscles) {
              expect(valid.has(m)).toBe(true);
            }
            for (const m of s.spasmMuscles) {
              expect(valid.has(m)).toBe(true);
            }
          }
        });
      }
    });
  }
});

describe("ADL/aggravating integration in TX engine", () => {
  for (const bp of BODY_PARTS) {
    describe(bp, () => {
      for (const seed of SEEDS) {
        const result = generateTXSequenceStates(makeContext(bp), {
          txCount: 20,
          seed,
        });
        const { states } = result;

        it(`seed=${seed}: every visit has adlItems and aggravatingItems`, () => {
          for (const s of states) {
            expect(Array.isArray(s.adlItems)).toBe(true);
            expect(Array.isArray(s.aggravatingItems)).toBe(true);
          }
        });

        it(`seed=${seed}: adlItems count decreases as severity improves (v20 ≤ v1)`, () => {
          const first = states[0];
          const last = states[states.length - 1];
          expect(last.adlItems.length).toBeLessThanOrEqual(
            first.adlItems.length,
          );
        });

        it(`seed=${seed}: all adlItems are from TEMPLATE_ADL`, () => {
          const validADL = new Set(TEMPLATE_ADL[bp]);
          for (const s of states) {
            for (const adl of s.adlItems) {
              expect(validADL.has(adl)).toBe(true);
            }
          }
        });

        it(`seed=${seed}: all aggravatingItems are from TEMPLATE_AGGRAVATING`, () => {
          const validAgg = new Set(TEMPLATE_AGGRAVATING[bp]);
          for (const s of states) {
            for (const agg of s.aggravatingItems) {
              expect(validAgg.has(agg)).toBe(true);
            }
          }
        });
      }
    });
  }
});
