/**
 * W4.6 correction-generator smoke tests — direct invocation of
 * generateCorrections(document, errors) without going through checkDocument.
 */
import { generateCorrections } from "../correction-generator";
import type { CheckError } from "../types";
import type {
  OptumNoteDocument,
  VisitRecord,
} from "../../types";

function makeVisit(overrides: Partial<VisitRecord> = {}): VisitRecord {
  const base: VisitRecord = {
    subjective: {
      visitType: "Follow up visit",
      chiefComplaint: "pain",
      chronicityLevel: "Chronic",
      painTypes: ["Dull"],
      bodyPart: "lower back",
      bodyPartNormalized: "LBP",
      laterality: "bilateral",
      radiation: false,
      muscleWeaknessScale: "40%",
      adlImpairment: "moderate",
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
        scaleDescription: "+2",
      },
      spasmMuscles: {
        muscles: ["iliocostalis"],
        frequencyScale: 2,
        scaleDescription: "+2",
      },
      rom: {
        bodyPart: "Lumbar",
        items: [
          { strength: "4/5", movement: "Flexion", degrees: 80, severity: "mild" },
        ],
      },
      tonguePulse: { tongue: "thin white coat", pulse: "wiry" },
    },
    assessment: {
      date: "02/01/2026",
      generalCondition: "good",
      symptomChange: "no change",
      physicalFindingChange: "",
      currentPattern: "Qi Stagnation in local meridian",
      localPattern: "Qi Stagnation",
    },
    plan: {
      needleSpecs: [{ gauge: "30#", length: '1"' }],
      treatmentTime: 15,
      treatmentPosition: "Back Points",
      acupoints: ["BL23", "BL25"],
      electricalStimulation: false,
      treatmentPrinciples: "circulation",
    },
    diagnosisCodes: [{ description: "LBP", icd10: "M54.53" }],
    procedureCodes: [{ description: "ACUP", cpt: "97810" }],
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

function mkError(overrides: Partial<CheckError> = {}): CheckError {
  return {
    id: "TX02-1-tenderness.scale",
    ruleId: "TX02",
    severity: "MEDIUM",
    visitDate: "02/01/2026",
    visitIndex: 1,
    section: "O",
    field: "tenderness.scale",
    ruleName: "pain→tenderness 合理",
    message: "too low",
    expected: ">= +3",
    actual: "+1",
    ...overrides,
  };
}

describe("W4.6 generateCorrections smoke", () => {
  test("single visit + 1 error → 1 correction with fieldFixes + annotated text", () => {
    const v = makeVisit({
      subjective: { ...makeVisit().subjective, painScale: { value: 8 } },
      objective: {
        ...makeVisit().objective,
        tendernessMuscles: {
          muscles: ["iliocostalis"],
          scale: 1,
          scaleDescription: "+1",
        },
      },
    });
    const doc = makeDoc([v]);
    const errors = [mkError({ visitIndex: 0 })];
    const corrections = generateCorrections(doc, errors);
    expect(corrections).toHaveLength(1);
    const c = corrections[0];
    expect(c.visitIndex).toBe(0);
    expect(c.errors).toHaveLength(1);
    expect(c.fieldFixes.length).toBeGreaterThan(0);
    expect(typeof c.correctedFullText).toBe("string");
    expect(c.correctedFullText.length).toBeGreaterThan(0);
    expect(typeof c.correctedAnnotatedText).toBe("string");
  });

  test("empty errors → empty corrections", () => {
    const doc = makeDoc([makeVisit()]);
    expect(generateCorrections(doc, [])).toEqual([]);
  });

  test("multi visit errors grouped by visitIndex", () => {
    const v0 = makeVisit({ assessment: { ...makeVisit().assessment, date: "03/01/2026" } });
    const v1 = makeVisit({ assessment: { ...makeVisit().assessment, date: "03/08/2026" } });
    const v2 = makeVisit({ assessment: { ...makeVisit().assessment, date: "03/15/2026" } });
    const doc = makeDoc([v0, v1, v2]);
    const errors = [
      mkError({ visitIndex: 0, id: "TX02-0-tenderness.scale" }),
      mkError({ visitIndex: 0, id: "TX02-0-other", field: "other" }),
      mkError({ visitIndex: 2, id: "TX02-2-tenderness.scale" }),
    ];
    const corrections = generateCorrections(doc, errors);
    expect(corrections).toHaveLength(2);
    const indices = corrections.map((c) => c.visitIndex).sort();
    expect(indices).toEqual([0, 2]);
    expect(corrections.find((c) => c.visitIndex === 0)!.errors).toHaveLength(2);
    expect(corrections.find((c) => c.visitIndex === 2)!.errors).toHaveLength(1);
  });

  test("correctedFullText and correctedAnnotatedText are non-empty strings", () => {
    const v = makeVisit({
      subjective: { ...makeVisit().subjective, painScale: { value: 8 } },
      objective: {
        ...makeVisit().objective,
        tendernessMuscles: {
          muscles: ["iliocostalis"],
          scale: 0,
          scaleDescription: "+0",
        },
      },
    });
    const doc = makeDoc([v]);
    const errors = [mkError({ visitIndex: 0 })];
    const [c] = generateCorrections(doc, errors);
    expect(typeof c.correctedFullText).toBe("string");
    expect(c.correctedFullText.length).toBeGreaterThan(0);
    expect(typeof c.correctedAnnotatedText).toBe("string");
    expect(c.correctedAnnotatedText.length).toBeGreaterThan(0);
  });
});
