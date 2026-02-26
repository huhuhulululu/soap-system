import { describe, it, expect } from "vitest";
import { exportSOAPAsText } from "../soap-generator";
import type { GenerationContext } from "../../types";

function makeIEContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    noteType: "IE",
    insuranceType: "NONE",
    primaryBodyPart: "LBP",
    laterality: "left",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "moderate to severe",
    painCurrent: 8,
    ...overrides,
  } as GenerationContext;
}

describe("IE spasm integration", () => {
  it("mild severity → spasm grade ≤ +2", () => {
    const ctx = makeIEContext({ severityLevel: "mild", painCurrent: 3 });
    const text = exportSOAPAsText(ctx);
    expect(text).not.toMatch(/Frequency Grading Scale:\(\+[34]\)/);
  });

  it("severe severity → spasm grade ≥ +3", () => {
    const ctx = makeIEContext({ severityLevel: "severe", painCurrent: 9 });
    const text = exportSOAPAsText(ctx);
    expect(text).toMatch(/Frequency Grading Scale:\(\+[34]\)/);
  });

  it("moderate to severe → spasm grade +3 or +4", () => {
    const ctx = makeIEContext({
      severityLevel: "moderate to severe",
      painCurrent: 8,
    });
    const text = exportSOAPAsText(ctx);
    expect(text).toMatch(/Frequency Grading Scale:\(\+[34]\)/);
  });
});
