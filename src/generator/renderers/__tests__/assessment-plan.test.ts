/**
 * Smoke + export surface tests for assessment / plan-ie / plan-tx renderers (W3 Step 6)
 */

import { generateAssessment, generateAssessmentTX } from "../assessment";
import { generatePlanIE } from "../plan-ie";
import { generatePlanTX } from "../plan-tx";
import * as barrel from "../../soap-generator";
import type { GenerationContext } from "../../../types";

function makeIE(overrides: Partial<GenerationContext> = {}): GenerationContext {
  return {
    noteType: "IE",
    insuranceType: "NONE",
    primaryBodyPart: "LBP",
    laterality: "bilateral",
    localPattern: "Qi Stagnation",
    systemicPattern: "",
    chronicityLevel: "Chronic",
    severityLevel: "moderate",
    painCurrent: 7,
    ...overrides,
  } as GenerationContext;
}

function makeTX(overrides: Partial<GenerationContext> = {}): GenerationContext {
  return { ...makeIE(overrides), noteType: "TX" } as GenerationContext;
}

describe("assessment + plan renderers — smoke", () => {
  test("generateAssessment IE contains TCM Dx header", () => {
    const out = generateAssessment(makeIE());
    expect(out).toContain("TCM Dx:");
    expect(out).toContain("Today's TCM treatment principles:");
  });

  test("generateAssessmentTX contains general condition sentence", () => {
    const out = generateAssessmentTX(makeTX());
    expect(out).toContain("general condition");
    expect(out).toContain("No adverse side effect post treatment.");
  });

  test("generatePlanIE contains Short Term Goal + Long Term Goal", () => {
    const out = generatePlanIE(makeIE());
    expect(out).toContain("Short Term Goal");
    expect(out).toContain("Long Term Goal");
  });

  test("generatePlanTX contains Today's treatment principles", () => {
    const out = generatePlanTX(makeTX());
    expect(out).toContain("Today's treatment principles");
  });
});

describe("assessment + plan renderers — export surface via barrel", () => {
  test("generateAssessment re-exported", () => {
    expect(barrel.generateAssessment).toBe(generateAssessment);
  });
  test("generateAssessmentTX re-exported", () => {
    expect(barrel.generateAssessmentTX).toBe(generateAssessmentTX);
  });
  test("generatePlanIE re-exported", () => {
    expect(barrel.generatePlanIE).toBe(generatePlanIE);
  });
  test("generatePlanTX re-exported", () => {
    expect(barrel.generatePlanTX).toBe(generatePlanTX);
  });
});
