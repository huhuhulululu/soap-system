import { generateAssessmentTX } from "../soap-generator";

function makeTxContext(
  primaryBodyPart: "SHOULDER" | "KNEE" | "ELBOW" | "NECK" | "LBP",
  laterality: "left" | "right" | "bilateral" = "bilateral",
): any {
  return {
    noteType: "TX",
    insuranceType: "NONE",
    primaryBodyPart,
    laterality,
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "moderate to severe",
    painCurrent: 8,
  };
}

describe("TX Assessment laterality phrasing", () => {
  it("uses 'for in bilateral ... area today' for SHOULDER", () => {
    const text = generateAssessmentTX(makeTxContext("SHOULDER"), undefined, "text");
    expect(text).toContain(
      "The patient continues treatment for in bilateral shoulder area area today.",
    );
  });

  it("uses 'for in bilateral ... area today' for KNEE", () => {
    const text = generateAssessmentTX(makeTxContext("KNEE"), undefined, "text");
    expect(text).toContain(
      "The patient continues treatment for in bilateral knee area today.",
    );
  });

  it("uses 'for in bilateral ... area today' for ELBOW", () => {
    const text = generateAssessmentTX(makeTxContext("ELBOW"), undefined, "text");
    expect(text).toContain(
      "The patient continues treatment for in bilateral elbow area today.",
    );
  });

  it("keeps NECK without laterality prefix", () => {
    const text = generateAssessmentTX(makeTxContext("NECK"), undefined, "text");
    expect(text).toContain("Patient continue treatment for neck area today.");
    expect(text).not.toContain("in bilateral neck");
  });
});
