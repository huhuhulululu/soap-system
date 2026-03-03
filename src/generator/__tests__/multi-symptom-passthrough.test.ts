import { exportSOAPAsText } from "../soap-generator";
import { generateTXSequenceStates } from "../tx-sequence-engine";

describe("IE multi-symptom → TX passthrough", () => {
  const ieCtx: any = {
    primaryBodyPart: "SHOULDER",
    noteType: "IE",
    laterality: "bilateral",
    seed: 42,
    painCurrent: 7,
    painWorst: 9,
    painBest: 3,
    severityLevel: "moderate to severe",
    associatedSymptoms: ["soreness", "stiffness"],
    medicalHistory: [],
    secondaryBodyParts: [],
  };

  it("IE renders both symptoms", () => {
    const ieText = exportSOAPAsText(ieCtx);
    expect(ieText).toContain("soreness");
    expect(ieText).toContain("stiffness");
  });

  it("TX engine preserves multi-symptom array in visitState", () => {
    const txResult = generateTXSequenceStates(ieCtx, { txCount: 5, seed: 42 });
    for (let v = 0; v < txResult.states.length; v++) {
      const vs = txResult.states[v];
      expect(vs.associatedSymptoms).toBeDefined();
      expect(vs.associatedSymptoms!.length).toBeGreaterThanOrEqual(2);
      expect(vs.associatedSymptoms).toContain("soreness");
      expect(vs.associatedSymptoms).toContain("stiffness");
    }
  });

  it("TX renderer outputs both symptoms in text", () => {
    const txResult = generateTXSequenceStates(ieCtx, { txCount: 3, seed: 42 });
    const vs = txResult.states[0];
    const txCtx: any = { ...ieCtx, noteType: "TX", visitNumber: 1 };
    const txText = exportSOAPAsText(txCtx, vs);
    expect(txText).toContain("soreness");
    expect(txText).toContain("stiffness");
    expect(txText).toMatch(/associated with muscles soreness, stiffness/);
  });
});
