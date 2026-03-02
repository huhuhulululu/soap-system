import { checkDocument } from "../note-checker";
import type { OptumNoteDocument, VisitRecord } from "../../types";

function makeBaseVisit(
  visitType: VisitRecord["subjective"]["visitType"],
): VisitRecord {
  return {
    subjective: {
      visitType,
      chiefComplaint:
        "Patient c/o Chronic Dull pain on lower back area without radiation associated with muscles soreness (scale as 70%).",
      chronicityLevel: "Chronic",
      painTypes: ["Dull"],
      bodyPart: "lower back area",
      bodyPartNormalized: "LBP",
      laterality: "bilateral",
      radiation: false,
      muscleWeaknessScale: "70%",
      adlImpairment:
        "moderate difficulty with ADLs like Standing for long periods of time",
      adlDifficultyLevel: "moderate",
      painScale: { value: 8 },
      painFrequency: "Frequent",
      painFrequencyRange: "51% and 75%",
      medicalHistory: [],
    },
    objective: {
      inspection: "local skin no damage or rash",
      tightnessMuscles: {
        muscles: ["Quadratus Lumborum"],
        gradingScale: "moderate",
      },
      tendernessMuscles: {
        muscles: ["Quadratus Lumborum"],
        scale: 2,
        scaleDescription: "moderate tenderness",
      },
      spasmMuscles: {
        muscles: ["Quadratus Lumborum"],
        frequencyScale: 2,
        scaleDescription: "occasional spontaneous spasms",
      },
      rom: {
        bodyPart: "Lumbar",
        items: [
          {
            strength: "4/5",
            movement: "Flexion",
            degrees: 50,
            severity: "moderate",
          },
        ],
      },
      tonguePulse: { tongue: "pale", pulse: "thready" },
    },
    assessment: {
      date: "01/15/2026",
      generalCondition: "fair",
      symptomChange: "improvement",
      physicalFindingChange: "reduced",
      tcmDiagnosis:
        visitType === "INITIAL EVALUATION"
          ? {
              diagnosis: "Lower back pain due to Qi Stagnation",
              pattern: "Kidney Yang Deficiency",
              treatmentPrinciples: "promote circulation",
            }
          : undefined,
      currentPattern: "Qi Stagnation in local meridian",
      localPattern: "Qi Stagnation",
      systemicPattern: "Kidney Yang Deficiency",
    },
    plan: {
      needleSpecs: [{ gauge: "34#", length: "1.5\"" }],
      treatmentTime: 15,
      treatmentPosition: "Back Points",
      acupoints: ["BL23", "BL25", "DU4"],
      electricalStimulation: false,
      shortTermGoal:
        visitType === "INITIAL EVALUATION"
          ? {
              frequency: "6 treatments",
              painScaleTarget: "5",
              sensationScaleTarget: "50%",
              tightnessTarget: "moderate",
              tendernessTarget: "+2",
              spasmsTarget: "+2",
              strengthTarget: "4+/5",
              adlTarget: "moderate",
            }
          : undefined,
      longTermGoal:
        visitType === "INITIAL EVALUATION"
          ? {
              frequency: "12 treatments",
              painScaleTarget: "3",
              sensationScaleTarget: "30%",
              tightnessTarget: "mild",
              tendernessTarget: "+1",
              spasmsTarget: "+1",
              strengthTarget: "5/5",
              adlTarget: "mild",
            }
          : undefined,
      treatmentPrinciples: "focus on promote circulation",
    },
    diagnosisCodes: [],
    procedureCodes: [],
  };
}

function makeDocument(visits: VisitRecord[]): OptumNoteDocument {
  return {
    header: {
      patient: {
        name: "DOE, JOHN",
        dob: "01/01/1980",
        patientId: "1234567890",
        gender: "Male",
        age: 46,
        ageAsOfDate: "01/15/2026",
      },
      dateOfService: "01/15/2026",
      printedOn: "01/16/2026",
    },
    visits,
  };
}

describe("note-checker smoke", () => {
  it("returns DOC01 CRITICAL when document has no IE visit", () => {
    const doc = makeDocument([makeBaseVisit("Follow up visit")]);
    const result = checkDocument({ document: doc });
    const doc01 = result.errors.find((e) => e.ruleId === "DOC01");
    expect(doc01).toBeDefined();
    expect(doc01?.severity).toBe("CRITICAL");
  });

  it("returns TX06 CRITICAL when TX visit carries goals", () => {
    const ie = makeBaseVisit("INITIAL EVALUATION");
    const tx = makeBaseVisit("Follow up visit");
    tx.plan.shortTermGoal = {
      frequency: "4 treatments",
      painScaleTarget: "4",
      sensationScaleTarget: "50%",
      tightnessTarget: "moderate",
      tendernessTarget: "+2",
      spasmsTarget: "+2",
      strengthTarget: "4+/5",
      adlTarget: "moderate",
    };

    const doc = makeDocument([ie, tx]);
    const result = checkDocument({ document: doc });
    const tx06 = result.errors.find((e) => e.ruleId === "TX06");
    expect(tx06).toBeDefined();
    expect(tx06?.severity).toBe("CRITICAL");
  });
});

