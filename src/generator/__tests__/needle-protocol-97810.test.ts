import { generateNeedleProtocol } from "../soap-generator";
import type { TXVisitState } from "../tx-sequence-engine";
import type { GenerationContext } from "../../types";
import { TEMPLATE_NEEDLE_POINTS } from "../../shared/template-options";

function makeContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    noteType: "TX",
    insuranceType: "HF",
    primaryBodyPart: "ELBOW",
    laterality: "right",
    localPattern: "Qi Stagnation",
    systemicPattern: "",
    chronicityLevel: "Acute",
    severityLevel: "moderate",
    ...overrides,
  } as GenerationContext;
}

describe("97810 needle point selection", () => {
  it("uses merged points from all 4 groups when visit needle groups exist", () => {
    const ctx = makeContext();
    const visitState = {
      needlePoints: {
        front1: ["F1A", "F1B"],
        front2: ["F2A"],
        back1: ["B1A", "B1B"],
        back2: ["B2A"],
      },
      electricalStimulation: false,
      treatmentTime: 15,
    } as unknown as TXVisitState;

    const text = generateNeedleProtocol(ctx, visitState);
    expect(text).toContain("Acupuncture Points: (15 mins)");
    expect(text).toContain("F1A, F1B, F2A, B1A");
  });

  it("keeps side default fallback when visit needle groups are missing", () => {
    const ctx = makeContext();
    const text = generateNeedleProtocol(ctx);
    const expectedFrontFallback = TEMPLATE_NEEDLE_POINTS.ELBOW.frontPool
      .slice(0, 4)
      .join(", ");

    expect(text).toContain("Acupuncture Points: (15 mins)");
    expect(text).toContain(expectedFrontFallback);
  });
});
