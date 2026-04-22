/**
 * W4 rule test harness — provides deterministic builders + 6 per-kind runners.
 * Each rule test imports the appropriate `runXRule` to avoid any `unknown` cast.
 */
import type { OptumNoteDocument, VisitRecord } from "../../../types";
import type {
  IERule,
  IERuleContext,
  TXRule,
  TXRuleContext,
  SequenceRule,
  SequenceRuleContext,
  CodeRule,
  CodeRuleContext,
  GeneratorRule,
  GeneratorRuleContext,
  DocRule,
  DocRuleContext,
} from "../../types";

/* ───────── VisitRecord / Document builders ───────── */

export function makeVisit(overrides: Partial<VisitRecord> = {}): VisitRecord {
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
      adlImpairment: "moderate difficulty",
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
        ],
      },
      tonguePulse: { tongue: "thin white coat", pulse: "wiry" },
    },
    assessment: {
      date: "01/01/2026",
      generalCondition: "good",
      symptomChange: "no change",
      physicalFindingChange: "",
      currentPattern: "Qi Stagnation",
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

export function makeDocument(visits: VisitRecord[]): OptumNoteDocument {
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
      dateOfService: visits[0]?.assessment.date || "01/01/2026",
      printedOn: "01/02/2026",
    },
    visits,
  };
}

/* ───────── per-kind context makers ───────── */

export function makeIECtx(
  overrides: Partial<IERuleContext> = {},
): IERuleContext {
  return {
    visit: overrides.visit ?? makeVisit({ subjective: { ...makeVisit().subjective, visitType: "INITIAL EVALUATION" } }),
    visitIndex: overrides.visitIndex ?? 0,
  };
}

export function makeTXCtx(
  overrides: Partial<TXRuleContext> = {},
): TXRuleContext {
  return {
    visit: overrides.visit ?? makeVisit(),
    visitIndex: overrides.visitIndex ?? 1,
    ieVisit: overrides.ieVisit ?? null,
    prevVisit: overrides.prevVisit ?? null,
  };
}

export function makeSeqCtx(
  visits: VisitRecord[],
  i: number = 1,
): SequenceRuleContext {
  return {
    visits,
    prev: visits[i - 1],
    cur: visits[i],
    visitIndex: i,
  };
}

export function makeCodeCtx(
  visits: VisitRecord[],
  i: number = 0,
  opts: {
    insuranceType?: string;
    treatmentTime?: number;
    allMissingDx?: boolean;
    allMissingCpt?: boolean;
  } = {},
): CodeRuleContext {
  return {
    visits,
    visit: visits[i],
    visitIndex: i,
    insuranceType: opts.insuranceType,
    treatmentTime: opts.treatmentTime,
    allMissingDx:
      opts.allMissingDx ?? visits.every((v) => v.diagnosisCodes.length === 0),
    allMissingCpt:
      opts.allMissingCpt ?? visits.every((v) => v.procedureCodes.length === 0),
  };
}

export function makeGeneratorCtx(
  visits: VisitRecord[],
  i: number = 0,
): GeneratorRuleContext {
  return { visits, visit: visits[i], visitIndex: i };
}

export function makeDocCtx(visits: VisitRecord[]): DocRuleContext {
  return { visits };
}

/* ───────── 6 per-kind runners (no unknown cast) ───────── */

export const runIERule = (r: IERule, c: IERuleContext) => r.check(c);
export const runTXRule = (r: TXRule, c: TXRuleContext) => r.check(c);
export const runSequenceRule = (
  r: SequenceRule,
  c: SequenceRuleContext,
) => r.check(c);
export const runCodeRule = (r: CodeRule, c: CodeRuleContext) => r.check(c);
export const runGeneratorRule = (
  r: GeneratorRule,
  c: GeneratorRuleContext,
) => r.check(c);
export const runDocRule = (r: DocRule, c: DocRuleContext) => r.check(c);
