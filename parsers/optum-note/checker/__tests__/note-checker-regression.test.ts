/**
 * W4 regression test — compares current checkDocument output against frozen
 * baselines captured at HEAD 65322b7 (before registry refactor).
 *
 * Baselines live in `.claude-state/w4-baselines/<fixtureKey>.json` and were
 * written by `.claude-state/scripts/w4-baseline-capture.ts`.
 *
 * To re-capture after an approved change (rare): re-run the script and diff.
 */
import * as fs from "fs";
import * as path from "path";
import { checkDocument } from "../note-checker";
import type { CheckError } from "../types";
import { parseOptumNote } from "../../parser";
import type {
  OptumNoteDocument,
  VisitRecord,
} from "../../types";

/* ──────── fixtures: parser-derived ──────── */

function buildMinimalIEText(): string {
  const header =
    "DOE, JOHN (DOB: 01/01/1980 ID: 1234567890) Date of Service: 01/15/2026 Printed on: 01/16/2026";
  const body = `
01/15/2026
Subjective:
INITIAL EVALUATION
Patient c/o Chronic Dull, Aching pain on lower back area without radiation for 3 month(s). The pain is associated with muscles soreness (scale as 70%). There is moderate difficulty with ADLs like Standing for long periods of time, Sitting for long periods of time.
Pain Scale: 8 /10
Pain Frequency: Frequent (symptoms occur between 51% and 75% of the time)
Objective:
Inspection: local skin no damage or rash
Assessment:
TCM Dx:
Lower back pain due to Qi Stagnation in local meridian.
Plan:
Today's treatment principles:
focus on promote circulation.
`;
  return `${header}\n${body}`.trim();
}

function buildMinimalTXText(): string {
  const header =
    "SMITH, JANE (DOB: 05/10/1975 ID: 2233445566) Date of Service: 02/01/2026 Printed on: 02/02/2026";
  const body = `
02/01/2026
Subjective:
Follow up visit
Patient c/o Chronic Dull pain on shoulder area without radiation associated with muscles soreness (scale as 50%).
Pain Scale: 5 /10
Pain Frequency: Occasional (symptoms occur between 25% and 50% of the time)
Objective:
Inspection: local skin no damage or rash
Assessment:
The patient shows improvement.
Plan:
Today's treatment principles:
focus on relaxation and circulation.
`;
  return `${header}\n${body}`.trim();
}

function parseOrThrow(text: string, key: string): OptumNoteDocument {
  const r = parseOptumNote(text);
  if (!r.success || !r.document) {
    throw new Error(`[${key}] parse failed: ${JSON.stringify(r.errors)}`);
  }
  return r.document;
}

/* ──────── fixtures: synthetic (mirror of baseline script builders) ──────── */

function makeVisit(overrides: Partial<VisitRecord> = {}): VisitRecord {
  const base: VisitRecord = {
    subjective: {
      visitType: "Follow up visit",
      chiefComplaint: "pain continues",
      chronicityLevel: "Chronic",
      painTypes: ["Dull"],
      bodyPart: "lower back",
      bodyPartNormalized: "LBP",
      laterality: "bilateral",
      radiation: false,
      muscleWeaknessScale: "40%",
      adlImpairment: "moderate difficulty with ADLs like standing",
      adlDifficultyLevel: "moderate",
      painScale: { value: 5 },
      painFrequency: "Occasional",
      painFrequencyRange: "25% and 50%",
    },
    objective: {
      inspection: "local skin no damage or rash",
      tightnessMuscles: { muscles: ["iliocostalis"], gradingScale: "mild" },
      tendernessMuscles: {
        muscles: ["iliocostalis"],
        scale: 2,
        scaleDescription: "+2 moderate",
      },
      spasmMuscles: {
        muscles: ["iliocostalis"],
        frequencyScale: 2,
        scaleDescription: "+2 occasional",
      },
      rom: {
        bodyPart: "Lumbar",
        items: [
          {
            strength: "4/5",
            movement: "Flexion",
            degrees: 80,
            severity: "mild",
          },
          {
            strength: "4/5",
            movement: "Extension",
            degrees: 25,
            severity: "mild",
          },
        ],
      },
      tonguePulse: { tongue: "thin white coat", pulse: "wiry" },
    },
    assessment: {
      date: "02/01/2026",
      generalCondition: "good",
      symptomChange: "improvement",
      physicalFindingChange: "",
      currentPattern: "Qi Stagnation in local meridian",
      localPattern: "Qi Stagnation",
    },
    plan: {
      needleSpecs: [{ gauge: "30#", length: '1"' }],
      treatmentTime: 15,
      treatmentPosition: "Back Points",
      acupoints: ["BL23", "BL25", "GB30", "BL40"],
      electricalStimulation: false,
      treatmentPrinciples: "circulation",
    },
    diagnosisCodes: [{ description: "LBP", icd10: "M54.53" }],
    procedureCodes: [{ description: "ACUP", cpt: "97810" }],
  };
  return { ...base, ...overrides } as VisitRecord;
}

function makeIEVisit(overrides: Partial<VisitRecord> = {}): VisitRecord {
  const base = makeVisit();
  base.subjective = { ...base.subjective, visitType: "INITIAL EVALUATION" };
  base.assessment = {
    ...base.assessment,
    tcmDiagnosis: {
      diagnosis: "LBP due to Qi Stagnation",
      pattern: "Qi Stagnation",
      treatmentPrinciples: "circulation",
    },
  };
  base.plan = {
    ...base.plan,
    shortTermGoal: {
      frequency: "2x/week",
      painScaleTarget: "3",
      sensationScaleTarget: "mild",
      tightnessTarget: "mild",
      tendernessTarget: "+1",
      spasmsTarget: "+1",
      strengthTarget: "4+/5",
    },
    longTermGoal: {
      frequency: "12 visits",
      painScaleTarget: "1",
      sensationScaleTarget: "normal",
      tightnessTarget: "normal",
      tendernessTarget: "0",
      spasmsTarget: "0",
      strengthTarget: "5/5",
    },
  };
  return { ...base, ...overrides } as VisitRecord;
}

function makeDoc(visits: VisitRecord[]): OptumNoteDocument {
  return {
    header: {
      patient: {
        name: "TEST, PATIENT",
        dob: "01/01/1970",
        patientId: "9999999999",
        gender: "Male",
        age: 56,
        ageAsOfDate: "01/01/2026",
      },
      dateOfService: visits[0]?.assessment.date || "02/01/2026",
      printedOn: "02/02/2026",
    },
    visits,
  };
}

/* ──────── inline copy of script builders (keep regression isolated) ──────── */

function buildSyntheticBroad(): OptumNoteDocument {
  const ie = makeIEVisit({
    subjective: {
      ...makeIEVisit().subjective,
      painScale: { value: 9 },
      adlDifficultyLevel: "mild",
      adlImpairment: "mild difficulty (minimal impact on ADLs)",
      muscleWeaknessScale: "10%",
    },
    objective: {
      ...makeIEVisit().objective,
      tendernessMuscles: {
        muscles: ["iliocostalis"],
        scale: 0,
        scaleDescription: "+0 none",
      },
      rom: {
        bodyPart: "Lumbar",
        items: [
          { strength: "5/5", movement: "Flexion", degrees: 88, severity: "normal" },
        ],
      },
      tonguePulse: { tongue: "yellow greasy", pulse: "rapid" },
    },
    plan: {
      ...makeIEVisit().plan,
      shortTermGoal: undefined,
      longTermGoal: undefined,
      acupoints: [],
    },
    assessment: {
      ...makeIEVisit().assessment,
      tcmDiagnosis: undefined,
      localPattern: "Qi Stagnation",
    },
    diagnosisCodes: [{ description: "wrong", icd10: "S83.511A" }],
    procedureCodes: [],
  });
  const tx1 = makeVisit({
    assessment: {
      ...makeVisit().assessment,
      date: "02/08/2026",
      symptomChange: "improvement",
      localPattern: "Completely Different Pattern",
    },
    subjective: {
      ...makeVisit().subjective,
      painScale: { value: 9 },
      adlDifficultyLevel: "mild",
      adlImpairment: "mild difficulty",
      painFrequency: "Constant",
      painFrequencyRange: "76% and 100%",
    },
    objective: {
      ...makeVisit().objective,
      tendernessMuscles: {
        muscles: ["iliocostalis"],
        scale: 4,
        scaleDescription: "+4 severe",
      },
      tightnessMuscles: { muscles: ["iliocostalis"], gradingScale: "severe" },
      spasmMuscles: {
        muscles: ["iliocostalis"],
        frequencyScale: 4,
        scaleDescription: "+4",
      },
      rom: {
        bodyPart: "Lumbar",
        items: [
          { strength: "2/5", movement: "Flexion", degrees: 10, severity: "severe" },
        ],
      },
    },
    plan: {
      ...makeVisit().plan,
      shortTermGoal: {
        frequency: "x",
        painScaleTarget: "1",
        sensationScaleTarget: "",
        tightnessTarget: "",
        tendernessTarget: "",
        spasmsTarget: "",
        strengthTarget: "",
      },
      electricalStimulation: true,
      acupoints: ["ZZZ1"],
      needleSpecs: [{ gauge: "20#", length: '1"' }],
    },
    procedureCodes: [{ description: "acup", cpt: "97810" }],
    diagnosisCodes: [{ description: "LBP", icd10: "M54.53" }],
  });
  const tx2 = makeVisit({
    assessment: {
      ...makeVisit().assessment,
      date: "02/15/2026",
      symptomChange: "improvement",
      localPattern: "Completely Different Pattern",
    },
    subjective: {
      ...makeVisit().subjective,
      painScale: { value: 10 },
      chiefComplaint: "pain worse due to skipped treatments muscles weakness",
      adlDifficultyLevel: "severe",
      adlImpairment: "severe difficulty",
    },
    objective: {
      ...makeVisit().objective,
      tendernessMuscles: {
        muscles: ["iliocostalis"],
        scale: 4,
        scaleDescription: "+4 severe",
      },
      tightnessMuscles: { muscles: ["iliocostalis"], gradingScale: "severe" },
      rom: {
        bodyPart: "Lumbar",
        items: [
          { strength: "2/5", movement: "Extension", degrees: 8, severity: "severe" },
        ],
      },
    },
    plan: {
      ...makeVisit().plan,
      acupoints: ["AAA1", "AAA2", "AAA3", "AAA4"],
      electricalStimulation: false,
    },
    procedureCodes: [
      { description: "acup", cpt: "97813" },
      { description: "acup", cpt: "97813" },
    ],
    diagnosisCodes: [{ description: "wrong", icd10: "M99.99" }],
  });
  return makeDoc([ie, tx1, tx2]);
}

function buildSyntheticEdges(): OptumNoteDocument {
  const ie = makeIEVisit({
    subjective: {
      ...makeIEVisit().subjective,
      bodyPart: "right knee",
      bodyPartNormalized: "KNEE",
      laterality: "right",
      medicalHistory: ["Pacemaker"],
    },
    objective: {
      ...makeIEVisit().objective,
      tightnessMuscles: {
        muscles: ["wrong muscle name"],
        gradingScale: "moderate",
      },
      tendernessMuscles: {
        muscles: ["wrong muscle name"],
        scale: 2,
        scaleDescription: "+2",
      },
      spasmMuscles: {
        muscles: ["wrong muscle name"],
        frequencyScale: 2,
        scaleDescription: "+2",
      },
      rom: {
        bodyPart: "Knee",
        items: [
          { strength: "3/5", movement: "Twist", degrees: 90, severity: "moderate" },
        ],
      },
      tonguePulse: { tongue: "bright red", pulse: "rapid" },
    },
    assessment: {
      ...makeIEVisit().assessment,
      localPattern: "Blood Stasis",
      tcmDiagnosis: {
        diagnosis: "Knee pain due to Blood Stasis",
        pattern: "Blood Stasis",
        treatmentPrinciples: "invigorate blood",
      },
    },
    plan: {
      ...makeIEVisit().plan,
      electricalStimulation: true,
      needleSpecs: [{ gauge: "28#", length: '1"' }],
      acupoints: [
        "GB34","ST36","SP9","SP10","GB33","BL40","BL57","KI3","SP6","ST34","BL60","GB39","LR3","KI6","ST35","BL39","LV7","SP7","ST33","GB31","SP12"
      ],
    },
  });
  const tx = makeVisit({
    assessment: { ...makeVisit().assessment, date: "03/01/2026", symptomChange: "exacerbate" },
    subjective: {
      ...makeVisit().subjective,
      bodyPart: "right knee",
      bodyPartNormalized: "KNEE",
      laterality: "right",
      painScale: { value: 3 },
      chiefComplaint: "pain has reduced level of pain maintaining regular treatments",
      painFrequency: "Intermittent",
    },
    objective: {
      ...makeVisit().objective,
      tendernessMuscles: {
        muscles: ["quadratus"],
        scale: 1,
        scaleDescription: "+1",
      },
      tightnessMuscles: { muscles: ["quadratus"], gradingScale: "mild" },
      rom: {
        bodyPart: "Knee",
        items: [
          { strength: "5/5", movement: "Flexion", degrees: 130, severity: "normal" },
        ],
      },
      tonguePulse: { tongue: "bright red yellow", pulse: "rapid" },
    },
    diagnosisCodes: [{ description: "knee", icd10: "M17.11" }],
    procedureCodes: [{ description: "acup", cpt: "97813" }],
    plan: {
      ...makeVisit().plan,
      treatmentTime: 30,
      needleSpecs: [{ gauge: "30#", length: '1"' }],
      acupoints: ["GB34","ST36"],
      electricalStimulation: true,
    },
  });
  return makeDoc([ie, tx]);
}

function buildSyntheticNoIE(): OptumNoteDocument {
  const tx1 = makeVisit({ assessment: { ...makeVisit().assessment, date: "04/01/2026" } });
  const tx2 = makeVisit({ assessment: { ...makeVisit().assessment, date: "04/08/2026" } });
  return makeDoc([tx1, tx2]);
}

function buildSyntheticIeGoals(): OptumNoteDocument {
  const ie = makeIEVisit({
    assessment: {
      date: "05/01/2026",
      generalCondition: "good",
      symptomChange: "improvement",
      physicalFindingChange: "",
      currentPattern: "Qi Stagnation",
      localPattern: "Qi Stagnation",
      tcmDiagnosis: undefined,
    },
    subjective: {
      visitType: "INITIAL EVALUATION",
      chiefComplaint: "low back pain",
      chronicityLevel: "Chronic",
      painTypes: ["Dull"],
      bodyPart: "lower back",
      bodyPartNormalized: "LBP",
      laterality: "bilateral",
      radiation: false,
      muscleWeaknessScale: "40%",
      adlImpairment: "moderate ADL",
      adlDifficultyLevel: "moderate",
      painScale: { value: 5 },
      painFrequency: "Occasional",
      painFrequencyRange: "25% and 50%",
    },
    plan: {
      needleSpecs: [{ gauge: "30#", length: '1"' }],
      treatmentTime: 15,
      treatmentPosition: "Back Points",
      acupoints: ["BL23", "BL25"],
      electricalStimulation: false,
      treatmentPrinciples: "circulation",
      shortTermGoal: {
        frequency: "x",
        painScaleTarget: "7",
        sensationScaleTarget: "",
        tightnessTarget: "",
        tendernessTarget: "",
        spasmsTarget: "",
        strengthTarget: "",
      },
      longTermGoal: {
        frequency: "x",
        painScaleTarget: "8",
        sensationScaleTarget: "",
        tightnessTarget: "",
        tendernessTarget: "",
        spasmsTarget: "",
        strengthTarget: "",
      },
    },
  });
  return makeDoc([ie]);
}

function buildSyntheticSequenceWorsen(): OptumNoteDocument {
  const ie = makeIEVisit({
    assessment: {
      date: "06/01/2026",
      generalCondition: "good",
      symptomChange: "no change",
      physicalFindingChange: "",
      currentPattern: "Qi Stagnation",
      localPattern: "Qi Stagnation",
      tcmDiagnosis: {
        diagnosis: "LBP",
        pattern: "Qi Stagnation",
        treatmentPrinciples: "circulation",
      },
    },
  });
  const tx1 = makeVisit({
    assessment: {
      date: "06/08/2026",
      generalCondition: "good",
      symptomChange: "no change",
      physicalFindingChange: "",
      currentPattern: "Qi Stagnation",
      localPattern: "Qi Stagnation",
    },
    subjective: {
      ...makeVisit().subjective,
      painScale: { value: 3 },
      painFrequency: "Intermittent",
      painFrequencyRange: "0% and 25%",
      chiefComplaint: "muscles soreness patient doing well",
      adlImpairment: "mild difficulty",
      adlDifficultyLevel: "mild",
    },
    objective: {
      inspection: "local skin no damage or rash",
      tightnessMuscles: { muscles: ["iliocostalis"], gradingScale: "mild" },
      tendernessMuscles: {
        muscles: ["iliocostalis"],
        scale: 1,
        scaleDescription: "+1 mild",
      },
      spasmMuscles: {
        muscles: ["iliocostalis"],
        frequencyScale: 1,
        scaleDescription: "+1",
      },
      rom: {
        bodyPart: "Lumbar",
        items: [
          { strength: "5/5", movement: "Flexion", degrees: 85, severity: "normal" },
        ],
      },
      tonguePulse: { tongue: "thin white coat", pulse: "wiry" },
    },
  });
  const tx2 = makeVisit({
    assessment: {
      date: "06/15/2026",
      generalCondition: "good",
      symptomChange: "improvement",
      physicalFindingChange: "",
      currentPattern: "Qi Stagnation",
      localPattern: "Qi Stagnation",
    },
    subjective: {
      ...makeVisit().subjective,
      painScale: { value: 6 },
      painFrequency: "Frequent",
      painFrequencyRange: "51% and 75%",
      chiefComplaint: "muscles weakness has increased",
      adlImpairment: "moderate",
      adlDifficultyLevel: "moderate",
    },
    objective: {
      inspection: "local skin no damage or rash",
      tightnessMuscles: { muscles: ["iliocostalis"], gradingScale: "severe" },
      tendernessMuscles: {
        muscles: ["iliocostalis"],
        scale: 3,
        scaleDescription: "+3",
      },
      spasmMuscles: {
        muscles: ["iliocostalis"],
        frequencyScale: 3,
        scaleDescription: "+3",
      },
      rom: {
        bodyPart: "Lumbar",
        items: [
          { strength: "2/5", movement: "Flexion", degrees: 70, severity: "severe" },
        ],
      },
      tonguePulse: { tongue: "thin white coat", pulse: "wiry" },
    },
  });
  const tx3 = makeVisit({
    assessment: {
      date: "06/22/2026",
      generalCondition: "poor",
      symptomChange: "no change",
      physicalFindingChange: "",
      currentPattern: "Qi Stagnation",
      localPattern: "Qi Stagnation",
    },
    subjective: {
      ...makeVisit().subjective,
      painScale: { value: 6 },
    },
  });
  return makeDoc([ie, tx1, tx2, tx3]);
}

function buildSyntheticT06(): OptumNoteDocument {
  const ie = makeIEVisit({
    assessment: {
      date: "07/01/2026",
      generalCondition: "good",
      symptomChange: "no change",
      physicalFindingChange: "",
      currentPattern: "Qi Stagnation",
      localPattern: "Qi Stagnation",
      tcmDiagnosis: {
        diagnosis: "LBP",
        pattern: "Qi Stagnation",
        treatmentPrinciples: "circulation",
      },
    },
  });
  const tx1 = makeVisit({
    assessment: {
      date: "07/08/2026",
      generalCondition: "good",
      symptomChange: "no change",
      physicalFindingChange: "",
      currentPattern: "Qi Stagnation",
      localPattern: "Qi Stagnation",
    },
    subjective: {
      ...makeVisit().subjective,
      painScale: { value: 8 },
      chiefComplaint:
        "improvement of symptom but due to skipped treatments and intense work",
      adlDifficultyLevel: "moderate to severe",
      adlImpairment: "moderate to severe difficulty",
    },
    objective: {
      inspection: "local skin no damage or rash",
      tightnessMuscles: { muscles: ["iliocostalis"], gradingScale: "moderate" },
      tendernessMuscles: {
        muscles: ["iliocostalis"],
        scale: 1,
        scaleDescription: "+1",
      },
      spasmMuscles: {
        muscles: ["iliocostalis"],
        frequencyScale: 2,
        scaleDescription: "+2",
      },
      rom: {
        bodyPart: "Lumbar",
        items: [
          { strength: "3/5", movement: "Flexion", degrees: 40, severity: "moderate" },
        ],
      },
      tonguePulse: { tongue: "thin white coat", pulse: "wiry" },
    },
  });
  const tx2 = makeVisit({
    assessment: {
      date: "07/15/2026",
      generalCondition: "poor",
      symptomChange: "no change",
      physicalFindingChange: "",
      currentPattern: "Qi Stagnation",
      localPattern: "Qi Stagnation",
    },
    subjective: {
      ...makeVisit().subjective,
      painScale: { value: 7 },
      adlDifficultyLevel: "moderate to severe",
      adlImpairment: "moderate to severe",
    },
    objective: {
      inspection: "local skin no damage or rash",
      tightnessMuscles: { muscles: ["iliocostalis"], gradingScale: "moderate" },
      tendernessMuscles: {
        muscles: ["iliocostalis"],
        scale: 3,
        scaleDescription: "+3",
      },
      spasmMuscles: {
        muscles: ["iliocostalis"],
        frequencyScale: 2,
        scaleDescription: "+2",
      },
      rom: {
        bodyPart: "Lumbar",
        items: [
          { strength: "3/5", movement: "Flexion", degrees: 40, severity: "severe" },
        ],
      },
      tonguePulse: { tongue: "thin white coat", pulse: "wiry" },
    },
  });
  return makeDoc([ie, tx1, tx2]);
}

function buildSyntheticCodeRomEdge(): OptumNoteDocument {
  const ie = makeIEVisit({
    assessment: {
      date: "08/01/2026",
      generalCondition: "good",
      symptomChange: "no change",
      physicalFindingChange: "",
      currentPattern: "Qi Stagnation",
      localPattern: "Qi Stagnation",
      tcmDiagnosis: {
        diagnosis: "LBP",
        pattern: "Qi Stagnation",
        treatmentPrinciples: "circulation",
      },
    },
    diagnosisCodes: [],
  });
  const tx1 = makeVisit({
    assessment: {
      date: "08/08/2026",
      generalCondition: "good",
      symptomChange: "no change",
      physicalFindingChange: "",
      currentPattern: "Qi Stagnation",
      localPattern: "Qi Stagnation",
    },
    subjective: {
      ...makeVisit().subjective,
      painScale: { value: 9 },
    },
    objective: {
      inspection: "local skin no damage or rash",
      tightnessMuscles: { muscles: ["iliocostalis"], gradingScale: "mild" },
      tendernessMuscles: {
        muscles: ["iliocostalis"],
        scale: 4,
        scaleDescription: "+4",
      },
      spasmMuscles: {
        muscles: ["iliocostalis"],
        frequencyScale: 3,
        scaleDescription: "+3",
      },
      rom: {
        bodyPart: "Lumbar",
        items: [
          { strength: "2/5", movement: "Flexion", degrees: 40, severity: "normal" },
          { strength: "5/5", movement: "Extension", degrees: 10, severity: "severe" },
        ],
      },
      tonguePulse: { tongue: "thin white coat", pulse: "wiry" },
    },
    diagnosisCodes: [{ description: "LBP", icd10: "M54.53" }],
  });
  return makeDoc([ie, tx1]);
}

/* ──────── test matrix ──────── */

interface BaselineFile {
  fixtureKey: string;
  errors: CheckError[];
  order: string[];
  sourceType: "parser" | "synthetic";
  description: string;
}

const BASELINES_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  ".claude-state",
  "w4-baselines",
);

function readBaseline(key: string): BaselineFile {
  const p = path.join(BASELINES_DIR, `${key}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8")) as BaselineFile;
}

const FIXTURES: Array<[string, () => OptumNoteDocument]> = [
  ["parser-minimal-ie", () => parseOrThrow(buildMinimalIEText(), "parser-minimal-ie")],
  ["parser-minimal-tx", () => parseOrThrow(buildMinimalTXText(), "parser-minimal-tx")],
  ["synthetic-broad", buildSyntheticBroad],
  ["synthetic-edges", buildSyntheticEdges],
  ["synthetic-no-ie", buildSyntheticNoIE],
  ["synthetic-ie-goals", buildSyntheticIeGoals],
  ["synthetic-sequence-worsen", buildSyntheticSequenceWorsen],
  ["synthetic-t06", buildSyntheticT06],
  ["synthetic-code-rom-edge", buildSyntheticCodeRomEdge],
];

describe("W4 checker regression — bit-identical against frozen baselines", () => {
  for (const [key, build] of FIXTURES) {
    test(`${key}: errors + order match baseline`, () => {
      const baseline = readBaseline(key);
      const doc = build();
      const out = checkDocument({ document: doc });
      const actualOrder = out.errors.map(
        (e) => `${e.ruleId}#${e.visitIndex}`,
      );
      expect(actualOrder).toEqual(baseline.order);
      expect(out.errors).toEqual(baseline.errors);
    });
  }

  test("AC15: at least 2 parser-derived baselines exist", () => {
    const files = fs
      .readdirSync(BASELINES_DIR)
      .filter((f) => f.endsWith(".json"));
    const realCount = files
      .map((f) => readBaseline(f.replace(/\.json$/, "")))
      .filter((b) => b.sourceType === "parser").length;
    expect(realCount).toBeGreaterThanOrEqual(2);
  });
});
