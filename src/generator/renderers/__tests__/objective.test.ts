/**
 * Smoke + export surface tests for objective renderer (W3 Step 5)
 */

import { generateObjective } from "../objective";
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
    painCurrent: 7,
    ...overrides,
  } as GenerationContext;
}

describe("objective renderer — smoke", () => {
  test("generateObjective returns non-empty string with Muscles Testing section (KNEE)", () => {
    const out = generateObjective(makeContext());
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(100);
    expect(out).toContain("Muscles Testing");
    expect(out).toContain("Inspection:");
  });

  test("generateObjective SHOULDER puts Inspection at top", () => {
    const out = generateObjective(makeContext({ primaryBodyPart: "SHOULDER" }));
    expect(out.indexOf("Inspection:")).toBeLessThan(out.indexOf("Muscles Testing"));
  });
});

describe("objective renderer — export surface via barrel", () => {
  test("generateObjective re-exported from soap-generator barrel is the same reference", () => {
    expect(barrel.generateObjective).toBe(generateObjective);
  });
});
