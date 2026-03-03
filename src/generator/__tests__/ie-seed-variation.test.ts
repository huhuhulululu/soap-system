import { exportSOAPAsText } from "../soap-generator";
import type { BodyPart, GenerationContext } from "../../types";

const BODY_PARTS: BodyPart[] = ["ELBOW", "HIP", "KNEE", "LBP", "NECK", "SHOULDER"];

function makeBaseContext(bp: BodyPart): Omit<GenerationContext, "seed"> {
  return {
    noteType: "IE",
    insuranceType: "NONE",
    primaryBodyPart: bp,
    laterality: "bilateral",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "moderate to severe",
    painCurrent: 8,
    symptomDuration: { value: "3", unit: "month(s)" },
    recentWorse: { value: "1", unit: "week(s)" },
  };
}

describe("IE seed-based variability", () => {
  it.each(BODY_PARTS)("%s: same seed should reproduce identical output", (bp) => {
    const base = makeBaseContext(bp);
    const a = exportSOAPAsText({ ...base, seed: 42001 });
    const b = exportSOAPAsText({ ...base, seed: 42001 });
    expect(a).toBe(b);
  });

  it.each(BODY_PARTS)("%s: different seeds should yield varied output", (bp) => {
    const base = makeBaseContext(bp);
    const outputs = new Set<string>();
    for (const seed of [1101, 1102, 1103, 1104, 1105]) {
      outputs.add(exportSOAPAsText({ ...base, seed }));
    }
    expect(outputs.size).toBeGreaterThan(1);
  });
});
