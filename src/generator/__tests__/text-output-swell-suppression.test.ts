import { exportSOAPAsText } from "../soap-generator";
import { generateTXSequenceStates } from "../tx-sequence-engine";

function makeKneeTxContext(overrides: Record<string, unknown> = {}): any {
  return {
    noteType: "TX",
    insuranceType: "NONE",
    primaryBodyPart: "KNEE",
    laterality: "bilateral",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "moderate to severe",
    painCurrent: 8,
    painWorst: 9,
    painBest: 3,
    painTypes: ["Dull", "Aching"],
    associatedSymptoms: ["soreness"],
    painRadiation: "without radiation",
    painFrequency: "Constant (symptoms occur between 76% and 100% of the time)",
    symptomScale: "70%",
    medicalHistory: [],
    secondaryBodyParts: [],
    seed: 42,
    ...overrides,
  };
}

function makeBaselineVisitState(context: any, overrides: Record<string, unknown> = {}): any {
  const result = generateTXSequenceStates(context, {
    txCount: 1,
    seed: 42,
    initialState: {
      pain: context.painCurrent ?? 8,
      tightness: 3,
      tenderness: 3,
      spasm: 2,
      frequency: 3,
      associatedSymptom: "soreness",
      symptomScale: context.symptomScale ?? "70%",
      painTypes: context.painTypes ?? ["Dull", "Aching"],
      inspection: "weak muscles and dry skin without luster",
    },
  });

  return {
    ...result.states[0],
    ...overrides,
  };
}

describe("plain text swell suppression", () => {
  test("plain text suppresses swelling reason wording", () => {
    const context = makeKneeTxContext();
    const text = exportSOAPAsText(
      context,
      makeBaselineVisitState(context, {
        symptomChange: "improvement of symptom(s)",
        reasonConnector: "because of",
        reason: "reduced joint stiffness and swelling",
      }),
    );

    expect(text).not.toContain("reduced joint stiffness and swelling");
    expect(text).toContain("reduced level of pain");
  });

  test("plain text suppresses joint swelling inspection wording", () => {
    const context = makeKneeTxContext();
    const text = exportSOAPAsText(
      context,
      makeBaselineVisitState(context, {
        inspection: "joint swelling",
      }),
    );

    expect(text).not.toContain("Inspection: joint swelling");
    expect(text).toContain("Inspection: local skin no damage or rash");
  });

  test("plain text suppresses with local swollen radiation wording", () => {
    const context = makeKneeTxContext({ painRadiation: "with local swollen" });
    const text = exportSOAPAsText(context, makeBaselineVisitState(context));

    expect(text).not.toContain("with local swollen");
    expect(text).toContain("without radiation");
  });

  test("plain text suppresses inherited joint swelling inspection wording", () => {
    const context = makeKneeTxContext({
      insuranceType: "OPTUM",
      severityLevel: "moderate",
      painCurrent: 6,
      painWorst: 8,
      painTypes: ["Dull"],
      symptomScale: "60%-70%",
      previousIE: {},
    });
    const text = exportSOAPAsText(
      context,
      makeBaselineVisitState(context, {
        visitIndex: 4,
        inspection: "joint swelling",
      }),
    );

    expect(text).not.toContain("joint swelling");
    expect(text).toContain("local skin no damage or rash");
  });
});
