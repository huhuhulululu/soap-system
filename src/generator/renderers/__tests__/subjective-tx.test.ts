/**
 * Smoke + export surface tests for subjective-tx renderer (W3 Step 4)
 */

import { generateSubjectiveTX } from "../subjective-tx";
import * as barrel from "../../soap-generator";
import type { GenerationContext } from "../../../types";

function makeTxContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    noteType: "TX",
    insuranceType: "NONE",
    primaryBodyPart: "LBP",
    laterality: "bilateral",
    localPattern: "Qi Stagnation",
    systemicPattern: "",
    chronicityLevel: "Chronic",
    severityLevel: "moderate",
    painCurrent: 6,
    ...overrides,
  } as GenerationContext;
}

describe("subjective-tx renderer — smoke", () => {
  test("generateSubjectiveTX returns non-empty text with Follow up visit header", () => {
    const out = generateSubjectiveTX(makeTxContext());
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(100);
    expect(out).toContain("Follow up visit");
    expect(out).toContain("Pain Scale:");
  });

  test("generateSubjectiveTX html format wraps lines with <br>", () => {
    const out = generateSubjectiveTX(makeTxContext(), undefined, "html");
    expect(out).toContain("<br>");
  });
});

describe("subjective-tx renderer — export surface via barrel", () => {
  test("generateSubjectiveTX re-exported from soap-generator barrel is the same reference", () => {
    expect(barrel.generateSubjectiveTX).toBe(generateSubjectiveTX);
  });
});
