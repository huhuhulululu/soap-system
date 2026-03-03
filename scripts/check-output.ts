import { generateSubjective, generateObjective, generateAssessment, generatePlanIE, generateSubjectiveTX, generateAssessmentTX, generatePlanTX, generateNeedleProtocol } from "../src/generator/soap-generator";
import { generateTXSequenceStates } from "../src/generator/tx-sequence-engine";
import { createSeededRng } from "../src/shared/seeded-rng";

const context: any = {
  primaryBodyPart: "LBP",
  laterality: "bilateral",
  painCurrent: 7,
  painWorst: 8,
  painBest: 7,
  painRadiation: "without radiation",
  painTypes: ["Dull", "Freezing"],
  symptomDuration: { value: 10, unit: "year(s)" },
  causativeFactors: ["age related/degenerative changes", "strain when pick up heavy object from floor", "prolong sitting"],
  relievingFactors: ["Moving around", "Resting", "Changing positions"],
  associatedSymptoms: ["soreness", "stiffness"],
  symptomScale: "70%-80%",
  painFrequency: "Constant (symptoms occur between 76% and 100% of the time)",
  chronicityLevel: "Chronic",
  localPattern: "Cold-Damp + Wind-Cold",
  systemicPattern: "Kidney Yang Deficiency",
  medicalHistory: [],
  hasPacemaker: false,
  secondaryBodyParts: ["upper back", "neck"],
  seed: 42,
};

const { rng } = createSeededRng(42);

console.log("========== IE ==========");
console.log("--- Subjective ---");
console.log(generateSubjective(context));
console.log("--- Objective ---");
console.log(generateObjective(context, undefined, rng));
console.log("--- Assessment ---");
console.log(generateAssessment(context));
console.log("--- Plan ---");
console.log(generatePlanIE(context));

// TX
const result = generateTXSequenceStates(context, { txCount: 11, seed: 42 });
const tx1 = result.states[0];
const { rng: txRng } = createSeededRng(42);

console.log("\n========== TX1 ==========");
console.log("--- Subjective ---");
console.log(generateSubjectiveTX(context, tx1));
console.log("--- Objective ---");
console.log(generateObjective(context, tx1, txRng));
console.log("--- Assessment ---");
console.log(generateAssessmentTX(context, tx1));
