/**
 * O2/O3/V6: grading↔trend consistency + spasm monotonic constraint
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

function parseGrading(grading: string | undefined): number {
  const m = grading?.match(/\+(\d)/);
  return m ? parseInt(m[1]) : -1;
}

const bodyParts = ["LBP", "KNEE", "SHOULDER", "NECK", "ELBOW"] as const;
const seeds = [42, 999, 2024, 7777, 12345, 54321, 11111, 22222, 33333, 44444];

function generateAll() {
  const results: Array<{
    bp: string;
    seed: number;
    states: ReturnType<typeof generateTXSequenceStates>["states"];
  }> = [];
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
      results.push({ bp, seed, states });
    }
  }
  return results;
}

describe("Grading↔trend consistency (O2/O3/V6)", () => {
  it("O2: tenderness grading drop implies trend ≠ stable", () => {
    const violations: string[] = [];
    for (const { bp, seed, states } of generateAll()) {
      let prevGrade = 3;
      for (const st of states) {
        const grade = parseGrading(st.tendernessGrading);
        if (grade >= 0 && grade < prevGrade && st.soaChain.objective.tendernessTrend === "stable") {
          violations.push(
            `${bp} TX${st.visitIndex} seed=${seed}: tenderness ${prevGrade}→${grade} but trend=stable`,
          );
        }
        if (grade >= 0) prevGrade = grade;
      }
    }
    expect(violations, violations.slice(0, 5).join("\n")).toHaveLength(0);
  });

  it("O3: spasm grading drop implies trend ≠ stable", () => {
    const violations: string[] = [];
    for (const { bp, seed, states } of generateAll()) {
      let prevGrade = 3;
      for (const st of states) {
        const grade = parseGrading(st.spasmGrading);
        if (grade >= 0 && grade < prevGrade && st.soaChain.objective.spasmTrend === "stable") {
          violations.push(
            `${bp} TX${st.visitIndex} seed=${seed}: spasm ${prevGrade}→${grade} but trend=stable`,
          );
        }
        if (grade >= 0) prevGrade = grade;
      }
    }
    expect(violations, violations.slice(0, 5).join("\n")).toHaveLength(0);
  });

  it("V6: spasm grading never increases longitudinally", () => {
    const violations: string[] = [];
    for (const { bp, seed, states } of generateAll()) {
      let lowestGrade = 3;
      for (const st of states) {
        const grade = parseGrading(st.spasmGrading);
        if (grade >= 0) {
          if (grade > lowestGrade) {
            violations.push(
              `${bp} TX${st.visitIndex} seed=${seed}: spasm=${grade} but lowest was ${lowestGrade}`,
            );
          }
          if (grade < lowestGrade) lowestGrade = grade;
        }
      }
    }
    expect(violations, violations.slice(0, 5).join("\n")).toHaveLength(0);
  });
});
