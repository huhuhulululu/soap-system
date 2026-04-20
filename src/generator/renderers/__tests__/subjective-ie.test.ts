/**
 * Smoke + export surface tests for subjective-ie renderer (W3 Step 3)
 */

import {
  generateSubjective,
  filterADLByDemographics,
  MUSCLE_SEVERITY_ORDER,
} from "../subjective-ie";
import * as barrel from "../../soap-generator";
import type { GenerationContext } from "../../../types";

function makeContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
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

describe("subjective-ie renderer — smoke", () => {
  test("generateSubjective returns non-empty string with INITIAL EVALUATION header for IE", () => {
    const out = generateSubjective(makeContext());
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(100);
    expect(out).toContain("INITIAL EVALUATION");
  });

  test("filterADLByDemographics returns original list when no age/gender provided", () => {
    const list = ["Sit", "Stand", "Walk"];
    expect(filterADLByDemographics(list)).toEqual(list);
  });

  test("MUSCLE_SEVERITY_ORDER has entries for all supported body parts", () => {
    expect(Object.keys(MUSCLE_SEVERITY_ORDER)).toEqual(
      expect.arrayContaining(["LBP", "NECK", "SHOULDER", "KNEE"]),
    );
  });
});

describe("subjective-ie renderer — export surface via barrel", () => {
  test("generateSubjective re-exported from soap-generator barrel is the same reference", () => {
    expect(barrel.generateSubjective).toBe(generateSubjective);
  });

  test("filterADLByDemographics re-exported from barrel", () => {
    expect(barrel.filterADLByDemographics).toBe(filterADLByDemographics);
  });

  test("MUSCLE_SEVERITY_ORDER re-exported from barrel", () => {
    expect(barrel.MUSCLE_SEVERITY_ORDER).toBe(MUSCLE_SEVERITY_ORDER);
  });
});
