/**
 * Smoke + export surface tests for needle-protocol renderer (W3 Step 7)
 */

import { generateNeedleProtocol } from "../needle-protocol";
import * as barrel from "../../soap-generator";
import type { GenerationContext } from "../../../types";

function makeContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    noteType: "IE",
    insuranceType: "NONE",
    primaryBodyPart: "KNEE",
    laterality: "bilateral",
    localPattern: "Qi Stagnation",
    systemicPattern: "",
    chronicityLevel: "Chronic",
    severityLevel: "moderate",
    painCurrent: 6,
    ...overrides,
  } as GenerationContext;
}

describe("needle-protocol renderer — smoke", () => {
  test("generateNeedleProtocol full code (NONE insurance) returns 4-step 60min protocol", () => {
    const out = generateNeedleProtocol(makeContext());
    expect(typeof out).toBe("string");
    expect(out).toContain("60 mins");
    expect(out).toContain("1.");
    expect(out).toContain("2.");
    expect(out).toContain("3.");
    expect(out).toContain("4.");
  });

  test("generateNeedleProtocol 97810 code (HF insurance) returns 15min single-step protocol", () => {
    const out = generateNeedleProtocol(makeContext({ insuranceType: "HF" }));
    expect(out).toContain("15 mins");
    expect(out).toContain("Acupuncture Points");
  });
});

describe("needle-protocol renderer — export surface via barrel", () => {
  test("generateNeedleProtocol re-exported from soap-generator barrel is the same reference", () => {
    expect(barrel.generateNeedleProtocol).toBe(generateNeedleProtocol);
  });
});
