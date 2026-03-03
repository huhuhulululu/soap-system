import { generateTXSequenceStates } from "../tx-sequence-engine";
import { exportSOAPAsText } from "../soap-generator";
import type { GenerationContext } from "../../types";

function makeContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    noteType: "TX",
    insuranceType: "OPTUM",
    primaryBodyPart: "LBP",
    laterality: "bilateral",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "moderate to severe",
    painCurrent: 7,
    painFrequency:
      "Constant (symptoms occur between 76% and 100% of the time)",
    associatedSymptoms: ["stiffness", "soreness"],
    painTypes: ["Dull", "Aching"],
    ...overrides,
  };
}

describe("associatedSymptoms multi-value preservation", () => {
  it("preserves context.associatedSymptoms in TX state and text when initialState is missing", () => {
    const context = makeContext();
    const { states } = generateTXSequenceStates(context, {
      txCount: 1,
      seed: 42,
    });
    const state = states[0];
    const text = exportSOAPAsText(context, state);

    expect(state.associatedSymptom).toBe("stiffness");
    expect(state.associatedSymptoms).toEqual(["stiffness", "soreness"]);
    expect(text).toContain("associated with muscles stiffness, soreness");
  });

  it("prefers initialState.associatedSymptoms over context defaults", () => {
    const context = makeContext({
      associatedSymptoms: ["soreness", "stiffness"],
    });
    const { states } = generateTXSequenceStates(context, {
      txCount: 1,
      seed: 42,
      initialState: {
        pain: 7,
        associatedSymptom: "numbness",
        associatedSymptoms: ["numbness", "weakness"],
      },
    });
    const state = states[0];
    const text = exportSOAPAsText(context, state);

    expect(state.associatedSymptom).toBe("numbness");
    expect(state.associatedSymptoms).toEqual(["numbness", "weakness"]);
    expect(text).toContain("associated with muscles numbness, weakness");
  });
});

