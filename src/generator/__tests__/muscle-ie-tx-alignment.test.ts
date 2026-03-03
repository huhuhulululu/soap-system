import { exportSOAPAsText } from "../soap-generator";
import { generateTXSequenceStates } from "../tx-sequence-engine";

/**
 * BUG: TX engine used a different seed (actualSeed+1000) for muscle selection
 * than IE renderer (objectiveMuscleSeed). This caused IE and TX1 to show
 * different muscles for the same patient.
 *
 * Fix: TX engine must use the same seed as IE renderer.
 */
describe("IE → TX muscle alignment", () => {
  const bodies = ["SHOULDER", "KNEE", "LBP", "NECK"] as const;

  function extractMuscleLines(text: string) {
    const tightMatch = text.match(/Tightness muscles noted along (.+)/);
    const tenderMatch = text.match(
      /(?:Tenderness|Point tenderness) (?:noted (?:along|on)|on) (.+)/,
    );
    const spasmMatch = text.match(
      /(?:Spasm|Muscles spasm) (?:noted (?:along|on)|on) (.+)/,
    );
    return {
      tightness: tightMatch?.[1]?.trim() ?? "",
      tenderness: tenderMatch?.[1]?.trim() ?? "",
      spasm: spasmMatch?.[1]?.trim() ?? "",
    };
  }

  for (const bp of bodies) {
    it(`${bp}: TX1 muscles should match IE muscles (same severity)`, () => {
      const ctx: any = {
        primaryBodyPart: bp,
        noteType: "IE",
        laterality: "bilateral",
        seed: 42,
        painCurrent: 7,
        painWorst: 9,
        painBest: 3,
        severityLevel: "moderate to severe",
        associatedSymptoms: ["soreness"],
        medicalHistory: [],
        secondaryBodyParts: [],
      };

      const ieText = exportSOAPAsText(ctx);
      const ieMuscles = extractMuscleLines(ieText);

      const txResult = generateTXSequenceStates(ctx, { txCount: 1, seed: 42 });
      const vs = txResult.states[0];
      const txCtx = { ...ctx, noteType: "TX", visitNumber: 1 };
      const txText = exportSOAPAsText(txCtx, vs);
      const txMuscles = extractMuscleLines(txText);

      // Tightness muscles must match between IE and TX1
      expect(txMuscles.tightness).toBe(ieMuscles.tightness);
      expect(txMuscles.tenderness).toBe(ieMuscles.tenderness);
      expect(txMuscles.spasm).toBe(ieMuscles.spasm);
    });
  }
});

/**
 * "similar symptom(s) as last visit" should never appear in TX output.
 * symptomChange should always be "improvement of symptom(s)" or similar positive.
 */
describe("TX never outputs 'similar symptom(s) as last visit'", () => {
  it("symptomChange field never contains 'similar'", () => {
    const ctx: any = {
      primaryBodyPart: "SHOULDER",
      noteType: "IE",
      laterality: "bilateral",
      seed: 42,
      painCurrent: 7,
      painWorst: 9,
      painBest: 3,
      severityLevel: "moderate to severe",
      associatedSymptoms: ["soreness"],
      medicalHistory: [],
      secondaryBodyParts: [],
    };

    const txResult = generateTXSequenceStates(ctx, { txCount: 12, seed: 42 });
    for (const vs of txResult.states) {
      expect(vs.symptomChange).not.toContain("similar");
      // Assessment present field should also not contain "similar"
      expect(vs.soaChain.assessment.present).not.toContain("similar");
    }
  });

  it("rendered TX text never contains 'similar symptom(s) as last visit'", () => {
    const bodies = ["SHOULDER", "KNEE", "LBP", "NECK"] as const;
    const seeds = [42, 123, 456];

    for (const bp of bodies) {
      for (const seed of seeds) {
        const ctx: any = {
          primaryBodyPart: bp,
          noteType: "IE",
          laterality: "bilateral",
          seed,
          painCurrent: 7,
          painWorst: 9,
          painBest: 3,
          severityLevel: "moderate to severe",
          associatedSymptoms: ["soreness"],
          medicalHistory: [],
          secondaryBodyParts: [],
        };

        const txResult = generateTXSequenceStates(ctx, { txCount: 12, seed });
        for (let v = 0; v < txResult.states.length; v++) {
          const vs = txResult.states[v];
          const txCtx = { ...ctx, noteType: "TX", visitNumber: v + 1 };
          const txText = exportSOAPAsText(txCtx, vs);
          expect(txText).not.toContain("similar symptom(s) as last visit");
        }
      }
    }
  });
});
