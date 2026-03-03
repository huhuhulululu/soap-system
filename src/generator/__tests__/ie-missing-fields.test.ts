import { exportSOAPAsText } from "../soap-generator";
import type { BodyPart, GenerationContext } from "../../types";

const BODY_PARTS: BodyPart[] = ["ELBOW", "HIP", "KNEE", "LBP", "NECK", "SHOULDER"];

describe("IE missing-field fallback", () => {
  it.each(BODY_PARTS)("%s: should not crash or emit undefined/NaN", (bp) => {
    const minimal = {
      noteType: "IE",
      insuranceType: "NONE",
      primaryBodyPart: bp,
      painCurrent: 7,
    } as unknown as GenerationContext;

    const text = exportSOAPAsText(minimal);

    expect(text).toContain("Subjective");
    expect(text).toContain("Objective");
    expect(text).toContain("Assessment");
    expect(text).toContain("Plan");
    expect(text).not.toMatch(/undefined/i);
    expect(text).not.toMatch(/\bNaN\b/);
  });

  it("missing systemicPattern should not render fake systemic sentence", () => {
    const context = {
      noteType: "IE",
      insuranceType: "NONE",
      primaryBodyPart: "KNEE",
      laterality: "bilateral",
      localPattern: "Qi Stagnation",
      chronicityLevel: "Chronic",
      severityLevel: "moderate",
      painCurrent: 6,
    } as unknown as GenerationContext;

    const text = exportSOAPAsText(context);
    expect(text).not.toContain("but patient also has undefined");
  });
});
