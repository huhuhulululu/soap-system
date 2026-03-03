import { generateObjective } from "../soap-generator";
import { generateTXSequenceStates } from "../tx-sequence-engine";
import type { GenerationContext } from "../../types";
import fs from "fs";
import path from "path";

function makeContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    noteType: "TX",
    insuranceType: "NONE",
    primaryBodyPart: "LBP",
    laterality: "right",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "moderate to severe",
    painCurrent: 8,
    ...overrides,
  };
}

describe("Objective source alignment", () => {
  it("TX Objective muscle lines prefer visitState muscle arrays", () => {
    const context = makeContext();
    const { states } = generateTXSequenceStates(context, {
      txCount: 1,
      seed: 42,
      initialState: { pain: 8 },
    });
    const base = states[0];

    const state = {
      ...base,
      tightMuscles: ["TIGHT_A", "TIGHT_B", "TIGHT_C"] as const,
      tenderMuscles: ["TENDER_A", "TENDER_B"] as const,
      spasmMuscles: ["SPASM_A"] as const,
    };

    const objective = generateObjective(context, state);

    expect(objective).toContain(
      "Tightness muscles noted along TIGHT_A, TIGHT_B, TIGHT_C",
    );
    expect(objective).toContain("TENDER_A, TENDER_B");
    expect(objective).toContain("Muscles spasm noted along SPASM_A");
  });

  it("soap-generator does not hardcode painScale=7 for weight contexts", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../soap-generator.ts"),
      "utf8",
    );
    expect(source).not.toContain("painScale: 7");
  });
});
