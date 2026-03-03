import { generateObjective } from "../soap-generator";
import { selectInitialMuscles } from "../muscle-selector";
import type { GenerationContext } from "../../types";

function makeContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    noteType: "IE",
    insuranceType: "NONE",
    primaryBodyPart: "SHOULDER",
    laterality: "left",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "severe",
    painCurrent: 9,
    painFrequency:
      "Constant (symptoms occur between 76% and 100% of the time)",
    age: 58,
    gender: "Female",
    seed: 77,
    ...overrides,
  };
}

function extractTightnessCount(objective: string): number {
  const m = objective.match(/Tightness muscles noted along ([^\n]+)/);
  if (!m) return 0;
  return m[1]
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean).length;
}

describe("IE objective muscle source alignment", () => {
  it("IE tightness muscles use muscle-selector count for severe SHOULDER", () => {
    const context = makeContext({ seed: 77, severityLevel: "severe" });
    const objective = generateObjective(context);

    const expected = selectInitialMuscles("SHOULDER", "severe", 77).tightness
      .length;
    const actual = extractTightnessCount(objective);

    expect(actual).toBe(expected);
    expect(actual).toBeGreaterThanOrEqual(5);
  });

  it("IE no longer hardcodes tightness count to 3 in severe cases", () => {
    const context = makeContext({ seed: 123, severityLevel: "severe" });
    const objective = generateObjective(context);
    const count = extractTightnessCount(objective);

    expect(count).not.toBe(3);
    expect(count).toBeGreaterThanOrEqual(5);
  });
});

