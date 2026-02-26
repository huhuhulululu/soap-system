/**
 * 跑一个完整的 12 次 LBP case，输出每次 visit 的关键指标变化
 */
import {
  generateTXSequenceStates,
  type TXVisitState,
} from "../src/generator/tx-sequence-engine";
import { exportSOAPAsText } from "../src/generator/soap-generator";
import { patchSOAPText } from "../src/generator/objective-patch";
import {
  normalizeGenerationContext,
  type NormalizeInput,
} from "../src/shared/normalize-generation-context";

// ── 多 Case 定义 ──
interface CaseDef {
  label: string;
  input: NormalizeInput;
  txCount: number;
  seed: number;
}

const cases: CaseDef[] = [
  {
    label: "Case 1: LBP, Pain 8, 55F, Chronic, 高血压, 12 visits",
    txCount: 11,
    seed: 42,
    input: {
      noteType: "IE",
      insuranceType: "HF",
      primaryBodyPart: "LBP",
      laterality: "unspecified",
      painCurrent: 8,
      severityLevel: "moderate to severe",
      chronicityLevel: "Chronic",
      painWorst: 9,
      painBest: 5,
      associatedSymptom: "soreness",
      associatedSymptoms: ["soreness"],
      symptomDuration: { value: "3", unit: "year(s)" },
      painRadiation: "without radiation",
      recentWorse: { value: "1", unit: "week(s)" },
      painTypes: ["Dull", "Aching"],
      symptomScale: "70%-80%",
      painFrequency:
        "Constant (symptoms occur between 76% and 100% of the time)",
      causativeFactors: ["age related/degenerative changes"],
      relievingFactors: ["Changing positions", "Resting"],
      age: 55,
      gender: "Female",
      secondaryBodyParts: [],
      medicalHistory: ["Hypertension"],
    },
  },
  {
    label:
      "Case 2: KNEE bilateral, Pain 7, 68M, Chronic, 糖尿病+高血压, 12 visits",
    txCount: 11,
    seed: 123,
    input: {
      noteType: "IE",
      insuranceType: "HF",
      primaryBodyPart: "KNEE",
      laterality: "bilateral",
      painCurrent: 7,
      severityLevel: "moderate",
      chronicityLevel: "Chronic",
      painWorst: 8,
      painBest: 4,
      associatedSymptom: "stiffness",
      associatedSymptoms: ["stiffness"],
      symptomDuration: { value: "5", unit: "year(s)" },
      painRadiation: "without radiation",
      recentWorse: { value: "2", unit: "week(s)" },
      painTypes: ["Dull", "Aching"],
      symptomScale: "70%-80%",
      painFrequency:
        "Constant (symptoms occur between 76% and 100% of the time)",
      causativeFactors: ["age related/degenerative changes"],
      relievingFactors: ["Resting", "Massage"],
      age: 68,
      gender: "Male",
      secondaryBodyParts: [],
      medicalHistory: ["Diabetes", "Hypertension"],
    },
  },
  {
    label:
      "Case 3: SHOULDER bilateral, Pain 6, 42F, Sub Acute, 无病史, 20 visits",
    txCount: 19,
    seed: 777,
    input: {
      noteType: "IE",
      insuranceType: "HF",
      primaryBodyPart: "SHOULDER",
      laterality: "bilateral",
      painCurrent: 6,
      severityLevel: "moderate",
      chronicityLevel: "Sub Acute",
      painWorst: 7,
      painBest: 3,
      associatedSymptom: "soreness",
      associatedSymptoms: ["soreness"],
      symptomDuration: { value: "3", unit: "month(s)" },
      painRadiation: "without radiation",
      recentWorse: { value: "1", unit: "week(s)" },
      painTypes: ["Aching", "Stabbing"],
      symptomScale: "60%-70%",
      painFrequency:
        "Frequent (symptoms occur between 51% and 75% of the time)",
      causativeFactors: ["repetitive motion"],
      relievingFactors: ["Changing positions", "Resting"],
      age: 42,
      gender: "Female",
      secondaryBodyParts: [],
      medicalHistory: [],
    },
  },
  {
    label: "Case 4: NECK, Pain 9, 72M, Chronic, Stroke+高血压, 12 visits",
    txCount: 11,
    seed: 999,
    input: {
      noteType: "IE",
      insuranceType: "HF",
      primaryBodyPart: "NECK",
      laterality: "unspecified",
      painCurrent: 9,
      severityLevel: "severe",
      chronicityLevel: "Chronic",
      painWorst: 10,
      painBest: 6,
      associatedSymptom: "numbness",
      associatedSymptoms: ["numbness"],
      symptomDuration: { value: "5", unit: "year(s)" },
      painRadiation: "with radiation to R arm",
      recentWorse: { value: "1", unit: "week(s)" },
      painTypes: ["Shooting", "Tingling"],
      symptomScale: "80%-90%",
      painFrequency:
        "Constant (symptoms occur between 76% and 100% of the time)",
      causativeFactors: ["age related/degenerative changes"],
      relievingFactors: ["Resting"],
      age: 72,
      gender: "Male",
      secondaryBodyParts: [],
      medicalHistory: ["Stroke", "Hypertension"],
    },
  },
];

for (const c of cases) {
  console.log(`\n${"#".repeat(80)}`);
  console.log(`## ${c.label}`);
  console.log(`${"#".repeat(80)}`);

  const { context, initialState } = normalizeGenerationContext(c.input);
  const txCtx = { ...context, noteType: "TX" as const };

  const ieText = patchSOAPText(exportSOAPAsText(context, {}), context as any);
  const { states, seed } = generateTXSequenceStates(txCtx, {
    txCount: c.txCount,
    startVisitIndex: 1,
    seed: c.seed,
    initialState,
  });

  console.log(`SEED: ${seed}\n`);

  // IE 摘要
  const ieLines = ieText.split("\n");
  const painLine = ieLines.find((l) => l.includes("Pain Scale:"));
  const freqLine = ieLines.find(
    (l) => l.includes("Pain frequency:") || l.includes("Pain Frequency:"),
  );
  console.log(`--- Visit 0 (IE) ---`);
  console.log(`  Pain: ${painLine?.trim()}`);
  console.log(`  Freq: ${freqLine?.trim()}`);
  console.log("");

  // TX 摘要
  for (const state of states) {
    const text = patchSOAPText(
      exportSOAPAsText(txCtx, state),
      txCtx as any,
      state,
    );
    const lines = text.split("\n");

    const sPain = lines.find((l) => l.includes("Pain Scale:"))?.trim() || "";
    const sFreq =
      lines
        .find(
          (l) => l.includes("Pain frequency:") || l.includes("pain frequency:"),
        )
        ?.trim() || "";
    const sReport =
      lines.find((l) => l.includes("Patient reports:"))?.trim() || "";
    const sSymptomScale =
      lines
        .find((l) => l.includes("scale as"))
        ?.match(/scale as ([^)]+)/)?.[1] || "";

    // ADL — 提取所有 difficulty 行
    const adlLines = lines.filter((l) => l.includes("difficulty"));
    const adlSummary = adlLines
      .map((l) => {
        const sevMatch = l.match(
          /(severe|moderate to severe|moderate|mild to moderate|mild)\s+difficulty/,
        );
        return sevMatch ? sevMatch[1] : "";
      })
      .filter(Boolean)
      .join(" | ");

    const tightness = (state as any).tightnessGrading || "";
    const tenderness = (state as any).tendernessGrading || "";
    const spasm = (state as any).spasmGrading || "";
    const romLine = lines.find((l) => /^\d[+-]?\/5\s/.test(l))?.trim() || "";

    // A — 完整提取
    const aIdx = lines.findIndex((l) => l.startsWith("Assessment"));
    const pIdx = lines.findIndex((l) => l.startsWith("Plan"));
    const aLines =
      aIdx >= 0 && pIdx >= 0
        ? lines.slice(aIdx + 1, pIdx).filter((l) => l.trim())
        : [];
    const aFull = aLines.join(" ").trim();

    console.log(
      `--- Visit ${state.visitIndex} (TX) | progress: ${((state as any).progress * 100).toFixed(0)}% ---`,
    );
    console.log(`  S report: ${sReport}`);
    console.log(`  S Pain: ${sPain}`);
    console.log(`  S Freq: ${sFreq}`);
    console.log(`  S Symptom%: ${sSymptomScale}`);
    console.log(`  S ADL: ${adlSummary || "N/A"}`);
    console.log(
      `  O Tight/Tender/Spasm: ${tightness} | ${tenderness.substring(0, 30)} | ${spasm.substring(0, 30)}`,
    );
    console.log(`  O ROM+Str: ${romLine}`);
    console.log(`  A: ${aFull.substring(0, 200)}`);
    console.log("");
  }
}
