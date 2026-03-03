import { generateTXSequenceStates } from "../tx-sequence-engine";
import { exportSOAPAsText } from "../soap-generator";
import type { GenerationContext } from "../../types";

const BODY_PARTS: GenerationContext["primaryBodyPart"][] = [
  "LBP",
  "SHOULDER",
  "KNEE",
];

function makeContext(
  bp: GenerationContext["primaryBodyPart"],
): GenerationContext {
  return {
    noteType: "TX",
    insuranceType: "NONE",
    primaryBodyPart: bp,
    laterality: bp === "LBP" ? "bilateral" : "left",
    localPattern: "Qi & Blood Stagnation",
    systemicPattern: "Liver Qi Stagnation",
    chronicityLevel: "Chronic",
    severityLevel: "moderate to severe",
    hasPacemaker: false,
    hasMetalImplant: false,
    painCurrent: 8,
    painTypes: ["Dull", "Aching"],
    associatedSymptoms: ["soreness"],
    symptomScale: "70%",
    painFrequency:
      "Constant (symptoms occur between 76% and 100% of the time)",
    age: 58,
    gender: "Female",
    medicalHistory: ["chronic pain"],
  };
}

function extractRomDegrees(text: string): number[] {
  const out: number[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/:\s*(-?\d+)\s*(?:Degrees|degree)?\s*\(/i);
    if (m) out.push(Number(m[1]));
  }
  return out;
}

describe("ROM trend vs rendered ROM alignment", () => {
  it("stable romTrend with unchanged pain label should not show large ROM jumps", () => {
    let checkedPairs = 0;

    for (const bp of BODY_PARTS) {
      for (let seed = 1; seed <= 30; seed++) {
        const context = makeContext(bp);
        const result = generateTXSequenceStates(context, {
          txCount: 20,
          seed,
          initialState: {
            pain: 8,
            tightness: 4,
            tenderness: 3,
            spasm: 3,
            frequency: 3,
            associatedSymptom: "soreness",
            symptomScale: "70%",
            painTypes: ["Dull", "Aching"],
            inspection: "weak muscles and dry skin without luster",
          },
        });
        const texts = result.states.map((s) => exportSOAPAsText(context, s));

        for (let i = 1; i < result.states.length; i++) {
          const prev = result.states[i - 1];
          const cur = result.states[i];
          if (
            cur.soaChain.objective.romTrend !== "stable" ||
            cur.painScaleLabel !== prev.painScaleLabel
          ) {
            continue;
          }
          const prevRom = extractRomDegrees(texts[i - 1]);
          const curRom = extractRomDegrees(texts[i]);
          if (
            prevRom.length === 0 ||
            curRom.length === 0 ||
            prevRom.length !== curRom.length
          ) {
            continue;
          }
          checkedPairs++;
          const maxDelta = prevRom.reduce((acc, value, idx) => {
            return Math.max(acc, Math.abs(curRom[idx] - value));
          }, 0);
          expect(maxDelta).toBeLessThanOrEqual(15);
        }
      }
    }

    expect(checkedPairs).toBeGreaterThan(100);
  });

  it("no-change visits should not contain double-digit ROM jumps", () => {
    let checkedNoChange = 0;

    for (const bp of BODY_PARTS) {
      for (let seed = 1; seed <= 30; seed++) {
        const context = makeContext(bp);
        const result = generateTXSequenceStates(context, {
          txCount: 20,
          seed,
          initialState: {
            pain: 8,
            tightness: 4,
            tenderness: 3,
            spasm: 3,
            frequency: 3,
            associatedSymptom: "soreness",
            symptomScale: "70%",
            painTypes: ["Dull", "Aching"],
            inspection: "weak muscles and dry skin without luster",
          },
        });
        const texts = result.states.map((s) => exportSOAPAsText(context, s));

        for (let i = 1; i < result.states.length; i++) {
          const cur = result.states[i];
          if (cur.soaChain.assessment.present !== "no change.") continue;

          const prevRom = extractRomDegrees(texts[i - 1]);
          const curRom = extractRomDegrees(texts[i]);
          if (
            prevRom.length === 0 ||
            curRom.length === 0 ||
            prevRom.length !== curRom.length
          ) {
            continue;
          }
          checkedNoChange++;
          const maxDelta = prevRom.reduce((acc, value, idx) => {
            return Math.max(acc, Math.abs(curRom[idx] - value));
          }, 0);
          expect(maxDelta).toBeLessThanOrEqual(15);
        }
      }
    }

    expect(checkedNoChange).toBeGreaterThan(100);
  });
});
