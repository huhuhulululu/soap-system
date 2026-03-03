import { generateTXSequenceStates } from "../src/generator/tx-sequence-engine";

const context: any = {
  primaryBodyPart: "LBP",
  laterality: "bilateral",
  painCurrent: 7,
  associatedSymptoms: ["soreness", "stiffness"],
  symptomScale: "70%-80%",
  painFrequency: "Constant (symptoms occur between 76% and 100% of the time)",
  chronicityLevel: "Chronic",
  localPattern: "Cold-Damp + Wind-Cold",
  systemicPattern: "Kidney Yang Deficiency",
  medicalHistory: [],
  hasPacemaker: false,
};

const result = generateTXSequenceStates(context, { txCount: 11, seed: 42 });
for (let i = 0; i < 3; i++) {
  const s = result.states[i];
  console.log(`TX${i+1}: pain=${s.painScaleCurrent} tender="${s.tendernessGrading}" spasm="${s.spasmGrading}" tight="${s.tightnessGrading}" romTrend=${s.soaChain.objective.romTrend} symptomChange="${s.symptomChange}"`);
}
