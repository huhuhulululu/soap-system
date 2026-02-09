/**
 * Correction Generator Tests
 * TDD tests for correction-generator.ts
 *
 * Coverage targets:
 * - computeFixes: All 7 rule types (IE01, TX01, IE02, TX02, T02, T03, T06, T07, X4, TX05, TX06)
 * - formatSubjectiveText: IE and TX format differences
 * - formatObjectiveText: tenderness and tonguePulse fixes
 * - formatPlanText: electricalStimulation and goals fixes
 * - generateCorrections: Integration test
 */

import { generateCorrections } from '../correction-generator'
import type { OptumNoteDocument, VisitRecord, PainScaleDetailed } from '../../types'
import type { CheckError, CorrectionItem, FieldFix } from '../types'

// ============ Test Fixtures ============

function createBaseVisitRecord(overrides: Partial<VisitRecord> = {}): VisitRecord {
  const base: VisitRecord = {
    subjective: {
      visitType: 'INITIAL EVALUATION',
      chiefComplaint: 'Patient c/o chronic pain in lower back which is aching.',
      chronicityLevel: 'Chronic',
      painTypes: ['Aching'],
      bodyPart: 'lower back',
      bodyPartNormalized: 'LBP',
      laterality: 'bilateral',
      radiation: false,
      muscleWeaknessScale: '40%',
      adlImpairment: 'Patient reports moderate difficulty with standing, walking, bending.',
      adlDifficultyLevel: 'moderate',
      painScale: {
        worst: 8,
        best: 5,
        current: 7
      } as PainScaleDetailed,
      painFrequency: 'Frequent',
      painFrequencyRange: '51% and 75%',
      medicalHistory: ['Hypertension', 'Diabetes']
    },
    objective: {
      inspection: 'local skin no damage or rash',
      tightnessMuscles: {
        muscles: ['iliocostalis', 'spinalis', 'longissimus'],
        gradingScale: 'moderate'
      },
      tendernessMuscles: {
        muscles: ['iliocostalis', 'spinalis'],
        scale: 3,
        scaleDescription: '+3 tenderness'
      },
      spasmMuscles: {
        muscles: ['longissimus'],
        frequencyScale: 2,
        scaleDescription: '+2 spasm'
      },
      rom: {
        bodyPart: 'Lumbar Spine',
        items: [
          { strength: '4/5', movement: 'Flexion', degrees: 70, severity: 'mild' },
          { strength: '4/5', movement: 'Extension', degrees: 20, severity: 'mild' }
        ]
      },
      tonguePulse: {
        tongue: 'pale, thin white coat',
        pulse: 'thready'
      }
    },
    assessment: {
      date: '01/15/2025',
      generalCondition: 'fair',
      symptomChange: 'no change',
      physicalFindingChange: 'reduced tightness',
      tcmDiagnosis: {
        diagnosis: 'Lower back pain due to Qi Stagnation',
        pattern: 'Qi Stagnation',
        treatmentPrinciples: 'Move Qi, Resolve Stagnation'
      },
      currentPattern: 'Qi Stagnation in local meridian',
      localPattern: 'Qi Stagnation',
      systemicPattern: 'Kidney Yang Deficiency'
    },
    plan: {
      needleSpecs: [
        { gauge: '30#', length: '1.5"' },
        { gauge: '34#', length: '1"' }
      ],
      treatmentTime: 15,
      treatmentPosition: 'Back Points',
      acupoints: ['BL23', 'BL25', 'BL40', 'GB30', 'GV4'],
      electricalStimulation: true,
      shortTermGoal: {
        frequency: '12 treatments in 5-6 weeks',
        painScaleTarget: '4-5/10',
        sensationScaleTarget: '30%',
        tightnessTarget: 'mild',
        tendernessTarget: '+2',
        spasmsTarget: '+1',
        strengthTarget: '4+/5'
      },
      longTermGoal: {
        frequency: '24 treatments in 10-12 weeks',
        painScaleTarget: '2-3/10',
        sensationScaleTarget: '15%',
        tightnessTarget: 'mild',
        tendernessTarget: '+1',
        spasmsTarget: '+1',
        strengthTarget: '5/5',
        adlTarget: 'Improved function'
      },
      treatmentPrinciples: 'Move Qi, Resolve Stagnation, Tonify Kidney'
    },
    diagnosisCodes: [
      { description: 'Low back pain', icd10: 'M54.5' }
    ],
    procedureCodes: [
      { description: 'ACUP W ESTIM 1ST 15 MIN', cpt: '97813' }
    ]
  }

  return deepMerge(base, overrides as Partial<VisitRecord>)
}

function createTXVisitRecord(overrides: Partial<VisitRecord> = {}): VisitRecord {
  const base = createBaseVisitRecord()
  const txBase: VisitRecord = {
    ...base,
    subjective: {
      ...base.subjective,
      visitType: 'Follow up visit',
      chiefComplaint: 'Patient reports: there is improvement of symptom(s) because of maintain regular treatments.',
      medicalHistory: undefined,
      walkingAid: undefined
    },
    assessment: {
      ...base.assessment,
      date: '01/22/2025',
      symptomChange: 'improvement',
      tcmDiagnosis: undefined
    },
    plan: {
      ...base.plan,
      shortTermGoal: undefined,
      longTermGoal: undefined
    }
  }

  return deepMerge(txBase, overrides) as VisitRecord
}

function createDocument(visits: VisitRecord[]): OptumNoteDocument {
  return {
    header: {
      patient: {
        name: 'Test Patient',
        dob: '01/01/1980',
        patientId: '1234567890',
        gender: 'Male',
        age: 45,
        ageAsOfDate: '01/15/2025'
      },
      dateOfService: '01/15/2025',
      printedOn: '01/16/2025'
    },
    visits
  }
}

function createError(overrides: Partial<CheckError>): CheckError {
  return {
    id: 'test-error-1',
    ruleId: 'IE01',
    severity: 'HIGH',
    visitDate: '01/15/2025',
    visitIndex: 0,
    section: 'S',
    field: 'adlDifficultyLevel',
    ruleName: 'pain->severity mapping',
    message: 'Pain=7 should correspond to moderate to severe severity',
    expected: 'moderate to severe',
    actual: 'mild',
    ...overrides
  }
}

// Deep merge utility - simplified for test fixtures
function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target } as Record<string, unknown>
  const src = source as Record<string, unknown>
  for (const key of Object.keys(src)) {
    if (src[key] !== undefined) {
      const targetVal = (target as Record<string, unknown>)[key]
      if (
        typeof src[key] === 'object' &&
        src[key] !== null &&
        !Array.isArray(src[key]) &&
        typeof targetVal === 'object' &&
        targetVal !== null
      ) {
        result[key] = deepMerge(
          targetVal as Record<string, unknown>,
          src[key] as Record<string, unknown>
        )
      } else {
        result[key] = src[key]
      }
    }
  }
  return result as T
}

// ============ Tests ============

describe('correction-generator', () => {
  describe('generateCorrections', () => {
    describe('with empty errors', () => {
      it('returns empty corrections array when no errors provided', () => {
        const ieVisit = createBaseVisitRecord()
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = []

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toEqual([])
      })
    })

    describe('with single error', () => {
      it('returns one correction item for one error', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'Patient c/o chronic pain in lower back.',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '40%',
            adlImpairment: 'Patient reports mild difficulty',
            adlDifficultyLevel: 'mild',
            painScale: { worst: 8, best: 5, current: 7 } as PainScaleDetailed,
            painFrequency: 'Frequent',
            painFrequencyRange: '51% and 75%'
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'IE01',
            visitIndex: 0,
            section: 'S',
            field: 'adlDifficultyLevel',
            expected: 'moderate to severe',
            actual: 'mild'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        expect(corrections[0].visitIndex).toBe(0)
        expect(corrections[0].section).toBe('S')
        expect(corrections[0].fieldFixes).toHaveLength(1)
        expect(corrections[0].fieldFixes[0].field).toBe('adlDifficultyLevel')
      })
    })

    describe('with multiple errors in same section', () => {
      it('groups errors by section and generates combined fix', () => {
        const ieVisit = createBaseVisitRecord({
          objective: {
            inspection: 'local skin no damage or rash',
            tightnessMuscles: {
              muscles: ['iliocostalis'],
              gradingScale: 'mild'
            },
            tendernessMuscles: {
              muscles: ['iliocostalis'],
              scale: 1,
              scaleDescription: '+1 tenderness'
            },
            spasmMuscles: {
              muscles: ['longissimus'],
              frequencyScale: 2,
              scaleDescription: '+2 spasm'
            },
            rom: {
              bodyPart: 'Lumbar Spine',
              items: [
                { strength: '4/5', movement: 'Flexion', degrees: 70, severity: 'mild' }
              ]
            },
            tonguePulse: {
              tongue: 'pale, thin white coat',
              pulse: 'thready'
            }
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'IE02',
            visitIndex: 0,
            section: 'O',
            field: 'tenderness.scale',
            expected: '>= +3',
            actual: '+1'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        expect(corrections[0].section).toBe('O')
        expect(corrections[0].fieldFixes.some(f => f.field === 'tenderness')).toBe(true)
      })
    })

    describe('with errors across multiple visits', () => {
      it('generates separate corrections for each visit', () => {
        const ieVisit = createBaseVisitRecord()
        const txVisit = createTXVisitRecord()
        const doc = createDocument([ieVisit, txVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'IE01',
            visitIndex: 0,
            section: 'S',
            visitDate: '01/15/2025'
          }),
          createError({
            id: 'test-error-2',
            ruleId: 'TX01',
            visitIndex: 1,
            section: 'S',
            visitDate: '01/22/2025'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(2)
        expect(corrections[0].visitIndex).toBe(0)
        expect(corrections[1].visitIndex).toBe(1)
      })
    })
  })

  describe('computeFixes - Rule ID Mapping', () => {
    describe('IE01 and TX01 - adlDifficultyLevel', () => {
      it('generates adlDifficultyLevel fix for IE01 error', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'Patient c/o chronic pain',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '40%',
            adlImpairment: 'mild difficulty',
            adlDifficultyLevel: 'mild',
            painScale: { worst: 9, best: 6, current: 9 } as PainScaleDetailed,
            painFrequency: 'Constant',
            painFrequencyRange: '76% and 100%'
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'IE01',
            visitIndex: 0,
            section: 'S',
            field: 'adlDifficultyLevel',
            expected: 'severe',
            actual: 'mild'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'adlDifficultyLevel')
        expect(fix).toBeDefined()
        expect(fix?.corrected).toBe('severe')
      })

      it('generates adlDifficultyLevel fix for TX01 error', () => {
        const ieVisit = createBaseVisitRecord()
        const txVisit = createTXVisitRecord({
          subjective: {
            visitType: 'Follow up visit',
            chiefComplaint: 'improvement of symptom(s)',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '40%',
            adlImpairment: 'mild difficulty',
            adlDifficultyLevel: 'mild',
            painScale: { worst: 8, best: 5, current: 7 } as PainScaleDetailed,
            painFrequency: 'Frequent',
            painFrequencyRange: '51% and 75%'
          }
        })
        const doc = createDocument([ieVisit, txVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'TX01',
            visitIndex: 1,
            section: 'S',
            field: 'adlDifficultyLevel',
            expected: 'moderate to severe',
            actual: 'mild'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'adlDifficultyLevel')
        expect(fix).toBeDefined()
        expect(fix?.corrected).toBe('moderate to severe')
      })

      it('maps pain 9+ to severe', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'severe pain',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '50%',
            adlImpairment: 'mild difficulty',
            adlDifficultyLevel: 'mild',
            painScale: { worst: 10, best: 7, current: 9 } as PainScaleDetailed,
            painFrequency: 'Constant',
            painFrequencyRange: '76% and 100%'
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({ ruleId: 'IE01', visitIndex: 0, section: 'S', actual: 'mild' })
        ]

        const corrections = generateCorrections(doc, errors)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'adlDifficultyLevel')
        expect(fix?.corrected).toBe('severe')
      })

      it('maps pain 7-8 to moderate to severe', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'pain',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '40%',
            adlImpairment: 'mild difficulty',
            adlDifficultyLevel: 'mild',
            painScale: { worst: 8, best: 5, current: 7 } as PainScaleDetailed,
            painFrequency: 'Frequent',
            painFrequencyRange: '51% and 75%'
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({ ruleId: 'IE01', visitIndex: 0, section: 'S', actual: 'mild' })
        ]

        const corrections = generateCorrections(doc, errors)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'adlDifficultyLevel')
        expect(fix?.corrected).toBe('moderate to severe')
      })

      it('maps pain 6 to moderate', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'pain',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '30%',
            adlImpairment: 'mild difficulty',
            adlDifficultyLevel: 'mild',
            painScale: { worst: 7, best: 4, current: 6 } as PainScaleDetailed,
            painFrequency: 'Occasional',
            painFrequencyRange: '26% and 50%'
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({ ruleId: 'IE01', visitIndex: 0, section: 'S', actual: 'mild' })
        ]

        const corrections = generateCorrections(doc, errors)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'adlDifficultyLevel')
        expect(fix?.corrected).toBe('moderate')
      })

      it('maps pain 4-5 to mild to moderate', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'pain',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '20%',
            adlImpairment: 'severe difficulty',
            adlDifficultyLevel: 'severe',
            painScale: { worst: 6, best: 3, current: 4 } as PainScaleDetailed,
            painFrequency: 'Occasional',
            painFrequencyRange: '26% and 50%'
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({ ruleId: 'IE01', visitIndex: 0, section: 'S', actual: 'severe' })
        ]

        const corrections = generateCorrections(doc, errors)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'adlDifficultyLevel')
        expect(fix?.corrected).toBe('mild to moderate')
      })

      it('maps pain 1-3 to mild', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'pain',
            chronicityLevel: 'Acute',
            painTypes: ['Dull'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '10%',
            adlImpairment: 'severe difficulty',
            adlDifficultyLevel: 'severe',
            painScale: { worst: 4, best: 1, current: 3 } as PainScaleDetailed,
            painFrequency: 'Intermittent',
            painFrequencyRange: '1% and 25%'
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({ ruleId: 'IE01', visitIndex: 0, section: 'S', actual: 'severe' })
        ]

        const corrections = generateCorrections(doc, errors)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'adlDifficultyLevel')
        expect(fix?.corrected).toBe('mild')
      })
    })

    describe('IE02 and TX02 - tenderness', () => {
      it('generates tenderness fix for IE02 error', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'pain',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '40%',
            adlImpairment: 'moderate difficulty',
            painScale: { worst: 9, best: 6, current: 9 } as PainScaleDetailed,
            painFrequency: 'Constant',
            painFrequencyRange: '76% and 100%'
          },
          objective: {
            inspection: 'local skin no damage or rash',
            tightnessMuscles: { muscles: ['iliocostalis'], gradingScale: 'moderate' },
            tendernessMuscles: { muscles: ['iliocostalis'], scale: 2, scaleDescription: '+2' },
            spasmMuscles: { muscles: ['longissimus'], frequencyScale: 2, scaleDescription: '+2' },
            rom: { bodyPart: 'Lumbar', items: [] },
            tonguePulse: { tongue: 'pale', pulse: 'thready' }
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'IE02',
            visitIndex: 0,
            section: 'O',
            field: 'tenderness.scale',
            expected: '>= +4',
            actual: '+2'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'tenderness')
        expect(fix).toBeDefined()
        expect(fix?.corrected).toBe('+4')
      })

      it('generates tenderness fix for TX02 error', () => {
        const ieVisit = createBaseVisitRecord()
        const txVisit = createTXVisitRecord({
          subjective: {
            visitType: 'Follow up visit',
            chiefComplaint: 'improvement',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '40%',
            adlImpairment: 'moderate difficulty',
            painScale: { worst: 8, best: 5, current: 7 } as PainScaleDetailed,
            painFrequency: 'Frequent',
            painFrequencyRange: '51% and 75%'
          },
          objective: {
            inspection: 'local skin no damage or rash',
            tightnessMuscles: { muscles: ['iliocostalis'], gradingScale: 'moderate' },
            tendernessMuscles: { muscles: ['iliocostalis'], scale: 1, scaleDescription: '+1' },
            spasmMuscles: { muscles: ['longissimus'], frequencyScale: 2, scaleDescription: '+2' },
            rom: { bodyPart: 'Lumbar', items: [] },
            tonguePulse: { tongue: 'pale', pulse: 'thready' }
          }
        })
        const doc = createDocument([ieVisit, txVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'TX02',
            visitIndex: 1,
            section: 'O',
            field: 'tenderness.scale',
            expected: '>= +3',
            actual: '+1'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'tenderness')
        expect(fix).toBeDefined()
        expect(fix?.corrected).toBe('+3')
      })

      it('maps pain 9+ to tenderness +4', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'pain',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '50%',
            adlImpairment: 'severe difficulty',
            painScale: { worst: 10, best: 7, current: 9 } as PainScaleDetailed,
            painFrequency: 'Constant',
            painFrequencyRange: '76% and 100%'
          },
          objective: {
            inspection: 'local skin no damage or rash',
            tightnessMuscles: { muscles: ['iliocostalis'], gradingScale: 'severe' },
            tendernessMuscles: { muscles: ['iliocostalis'], scale: 2, scaleDescription: '+2' },
            spasmMuscles: { muscles: ['longissimus'], frequencyScale: 3, scaleDescription: '+3' },
            rom: { bodyPart: 'Lumbar', items: [] },
            tonguePulse: { tongue: 'pale', pulse: 'thready' }
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({ ruleId: 'IE02', visitIndex: 0, section: 'O', actual: '+2' })
        ]

        const corrections = generateCorrections(doc, errors)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'tenderness')
        expect(fix?.corrected).toBe('+4')
      })

      it('maps pain 7-8 to tenderness +3', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'pain',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '40%',
            adlImpairment: 'moderate difficulty',
            painScale: { worst: 8, best: 5, current: 7 } as PainScaleDetailed,
            painFrequency: 'Frequent',
            painFrequencyRange: '51% and 75%'
          },
          objective: {
            inspection: 'local skin no damage or rash',
            tightnessMuscles: { muscles: ['iliocostalis'], gradingScale: 'moderate' },
            tendernessMuscles: { muscles: ['iliocostalis'], scale: 1, scaleDescription: '+1' },
            spasmMuscles: { muscles: ['longissimus'], frequencyScale: 2, scaleDescription: '+2' },
            rom: { bodyPart: 'Lumbar', items: [] },
            tonguePulse: { tongue: 'pale', pulse: 'thready' }
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({ ruleId: 'IE02', visitIndex: 0, section: 'O', actual: '+1' })
        ]

        const corrections = generateCorrections(doc, errors)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'tenderness')
        expect(fix?.corrected).toBe('+3')
      })

      it('maps pain 5-6 to tenderness +2', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'pain',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '30%',
            adlImpairment: 'moderate difficulty',
            painScale: { worst: 7, best: 4, current: 5 } as PainScaleDetailed,
            painFrequency: 'Occasional',
            painFrequencyRange: '26% and 50%'
          },
          objective: {
            inspection: 'local skin no damage or rash',
            tightnessMuscles: { muscles: ['iliocostalis'], gradingScale: 'mild' },
            tendernessMuscles: { muscles: ['iliocostalis'], scale: 1, scaleDescription: '+1' },
            spasmMuscles: { muscles: ['longissimus'], frequencyScale: 2, scaleDescription: '+2' },
            rom: { bodyPart: 'Lumbar', items: [] },
            tonguePulse: { tongue: 'pale', pulse: 'thready' }
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({ ruleId: 'IE02', visitIndex: 0, section: 'O', actual: '+1' })
        ]

        const corrections = generateCorrections(doc, errors)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'tenderness')
        expect(fix?.corrected).toBe('+2')
      })
    })

    describe('T02 - symptomChange (improvement but worsened)', () => {
      it('generates symptomChange fix for T02 error', () => {
        const ieVisit = createBaseVisitRecord()
        const txVisit = createTXVisitRecord()
        const doc = createDocument([ieVisit, txVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'T02',
            visitIndex: 1,
            section: 'A',
            field: 'symptomChange',
            message: 'improvement but worsened',
            expected: 'no improvement claim',
            actual: 'improvement of symptom(s)'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'symptomChange')
        expect(fix).toBeDefined()
        expect(fix?.corrected).toBe('similar symptom(s) as last visit')
        expect(fix?.original).toBe('improvement of symptom(s)')
      })
    })

    describe('T03 - symptomChange (exacerbate but improved)', () => {
      it('generates symptomChange fix for T03 error', () => {
        const ieVisit = createBaseVisitRecord()
        const txVisit = createTXVisitRecord({
          assessment: {
            date: '01/22/2025',
            generalCondition: 'fair',
            symptomChange: 'exacerbate',
            physicalFindingChange: 'increased tightness',
            currentPattern: 'Qi Stagnation'
          }
        })
        const doc = createDocument([ieVisit, txVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'T03',
            visitIndex: 1,
            section: 'A',
            field: 'symptomChange',
            message: 'exacerbate but actually improved',
            expected: 'no exacerbate claim',
            actual: 'exacerbate of symptom(s)'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'symptomChange')
        expect(fix).toBeDefined()
        expect(fix?.corrected).toBe('similar symptom(s) as last visit')
        expect(fix?.original).toBe('exacerbate of symptom(s)')
      })
    })

    describe('T06 - progressReason', () => {
      it('generates progressReason fix for improvement with negative reason', () => {
        const ieVisit = createBaseVisitRecord()
        const txVisit = createTXVisitRecord({
          subjective: {
            visitType: 'Follow up visit',
            chiefComplaint: 'Patient reports: there is improvement of symptom(s) because of skipped treatments.',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '40%',
            adlImpairment: 'moderate difficulty',
            painScale: { worst: 8, best: 5, current: 7 } as PainScaleDetailed,
            painFrequency: 'Frequent',
            painFrequencyRange: '51% and 75%'
          }
        })
        const doc = createDocument([ieVisit, txVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'T06',
            visitIndex: 1,
            section: 'S',
            field: 'chiefComplaint',
            message: 'progressStatus=improvement but contains negative reason',
            expected: 'positive reason',
            actual: 'skipped treatments'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'progressReason')
        expect(fix).toBeDefined()
        expect(fix?.corrected).toBe('maintain regular treatments')
      })

      it('generates progressReason fix for exacerbate with positive reason', () => {
        const ieVisit = createBaseVisitRecord()
        const txVisit = createTXVisitRecord({
          subjective: {
            visitType: 'Follow up visit',
            chiefComplaint: 'Patient reports: there is exacerbate of symptom(s) because of maintain regular treatments.',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '40%',
            adlImpairment: 'moderate difficulty',
            painScale: { worst: 8, best: 5, current: 7 } as PainScaleDetailed,
            painFrequency: 'Frequent',
            painFrequencyRange: '51% and 75%'
          }
        })
        const doc = createDocument([ieVisit, txVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'T06',
            visitIndex: 1,
            section: 'S',
            field: 'chiefComplaint',
            message: 'progressStatus=exacerbate but contains positive reason',
            expected: 'negative reason',
            actual: 'maintain regular treatments'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'progressReason')
        expect(fix).toBeDefined()
        expect(fix?.corrected).toBe('discontinuous treatment')
      })
    })

    describe('T07 and X4 - electricalStimulation (Pacemaker)', () => {
      it('generates electricalStimulation fix for T07 error', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'pain',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '40%',
            adlImpairment: 'moderate difficulty',
            painScale: { worst: 8, best: 5, current: 7 } as PainScaleDetailed,
            painFrequency: 'Frequent',
            painFrequencyRange: '51% and 75%',
            medicalHistory: ['Pacemaker', 'Hypertension']
          },
          plan: {
            needleSpecs: [{ gauge: '30#', length: '1.5"' }],
            treatmentTime: 15,
            treatmentPosition: 'Back Points',
            acupoints: ['BL23', 'BL25'],
            electricalStimulation: true,
            treatmentPrinciples: 'Move Qi'
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'T07',
            visitIndex: 0,
            section: 'P',
            field: 'electricalStimulation',
            message: 'Pacemaker patient should not have electrical stimulation',
            expected: 'false',
            actual: 'true'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'electricalStimulation')
        expect(fix).toBeDefined()
        expect(fix?.corrected).toBe('without')
        expect(fix?.original).toBe('with')
      })

      it('generates electricalStimulation fix for X4 error', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'pain',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '40%',
            adlImpairment: 'moderate difficulty',
            painScale: { worst: 8, best: 5, current: 7 } as PainScaleDetailed,
            painFrequency: 'Frequent',
            painFrequencyRange: '51% and 75%',
            medicalHistory: ['Pacemaker']
          },
          plan: {
            needleSpecs: [{ gauge: '30#', length: '1.5"' }],
            treatmentTime: 15,
            treatmentPosition: 'Back Points',
            acupoints: ['BL23', 'BL25'],
            electricalStimulation: true,
            treatmentPrinciples: 'Move Qi'
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'X4',
            visitIndex: 0,
            section: 'P',
            field: 'electricalStimulation',
            message: 'Pacemaker contraindication',
            expected: 'false',
            actual: 'true'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'electricalStimulation')
        expect(fix).toBeDefined()
        expect(fix?.corrected).toBe('without')
      })
    })

    describe('TX05 - tonguePulse', () => {
      it('generates tonguePulse fix for TX05 error', () => {
        const ieVisit = createBaseVisitRecord({
          objective: {
            inspection: 'local skin no damage or rash',
            tightnessMuscles: { muscles: ['iliocostalis'], gradingScale: 'moderate' },
            tendernessMuscles: { muscles: ['iliocostalis'], scale: 3, scaleDescription: '+3' },
            spasmMuscles: { muscles: ['longissimus'], frequencyScale: 2, scaleDescription: '+2' },
            rom: { bodyPart: 'Lumbar', items: [] },
            tonguePulse: { tongue: 'pale, thin white coat', pulse: 'thready' }
          }
        })
        const txVisit = createTXVisitRecord({
          objective: {
            inspection: 'local skin no damage or rash',
            tightnessMuscles: { muscles: ['iliocostalis'], gradingScale: 'mild' },
            tendernessMuscles: { muscles: ['iliocostalis'], scale: 2, scaleDescription: '+2' },
            spasmMuscles: { muscles: ['longissimus'], frequencyScale: 2, scaleDescription: '+2' },
            rom: { bodyPart: 'Lumbar', items: [] },
            tonguePulse: { tongue: 'red, yellow coat', pulse: 'rapid' }
          }
        })
        const doc = createDocument([ieVisit, txVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'TX05',
            visitIndex: 1,
            section: 'O',
            field: 'tonguePulse',
            message: 'TX tongue/pulse inconsistent with IE baseline',
            expected: 'pale, thin white coat / thready',
            actual: 'red, yellow coat / rapid'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'tonguePulse')
        expect(fix).toBeDefined()
        expect(fix?.corrected).toBe('pale, thin white coat / thready')
        expect(fix?.original).toBe('red, yellow coat / rapid')
      })
    })

    describe('TX06 - goals (should be removed in TX)', () => {
      it('generates goals fix for TX06 error', () => {
        const ieVisit = createBaseVisitRecord()
        const txVisit = createTXVisitRecord({
          plan: {
            needleSpecs: [{ gauge: '30#', length: '1.5"' }],
            treatmentTime: 15,
            treatmentPosition: 'Back Points',
            acupoints: ['BL23', 'BL25'],
            electricalStimulation: true,
            treatmentPrinciples: 'Move Qi',
            shortTermGoal: {
              frequency: '12 treatments',
              painScaleTarget: '4/10',
              sensationScaleTarget: '30%',
              tightnessTarget: 'mild',
              tendernessTarget: '+2',
              spasmsTarget: '+1',
              strengthTarget: '4+/5'
            }
          }
        })
        const doc = createDocument([ieVisit, txVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'TX06',
            visitIndex: 1,
            section: 'P',
            field: 'goals',
            message: 'TX should not have short/long term goals',
            expected: 'no goals',
            actual: 'present'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'goals')
        expect(fix).toBeDefined()
        expect(fix?.corrected).toBe('removed')
        expect(fix?.original).toBe('present')
      })
    })
  })

  describe('formatSubjectiveText', () => {
    describe('IE format', () => {
      it('includes Visit Type header', () => {
        const ieVisit = createBaseVisitRecord()
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = []

        const corrections = generateCorrections(doc, errors)

        // No errors means no corrections generated
        expect(corrections).toHaveLength(0)
      })

      it('applies adlDifficultyLevel fix in output text', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'pain',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '40%',
            adlImpairment: 'mild difficulty',
            adlDifficultyLevel: 'mild',
            painScale: { worst: 9, best: 6, current: 9 } as PainScaleDetailed,
            painFrequency: 'Constant',
            painFrequencyRange: '76% and 100%'
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'IE01',
            visitIndex: 0,
            section: 'S',
            actual: 'mild'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        expect(corrections[0].correctedFullText).toContain('severe difficulty')
      })

      it('includes Chief Complaint with body part', () => {
        const ieVisit = createBaseVisitRecord()
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections[0].correctedFullText).toContain('Chief Complaint')
        expect(corrections[0].correctedFullText).toContain('lower back')
      })

      it('includes Radiation section', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'pain',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: true,
            muscleWeaknessScale: '40%',
            adlImpairment: 'mild',
            painScale: { worst: 8, best: 5, current: 7 } as PainScaleDetailed,
            painFrequency: 'Frequent',
            painFrequencyRange: '51% and 75%'
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections[0].correctedFullText).toContain('Radiation')
        expect(corrections[0].correctedFullText).toContain('radiates')
      })

      it('includes Pain Scale with worst/best/current', () => {
        const ieVisit = createBaseVisitRecord()
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections[0].correctedFullText).toContain('Pain Scale')
        expect(corrections[0].correctedFullText).toContain('Worst')
        expect(corrections[0].correctedFullText).toContain('Current')
      })

      it('includes ADL Impairment with activities', () => {
        const ieVisit = createBaseVisitRecord()
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections[0].correctedFullText).toContain('ADL Impairment')
        expect(corrections[0].correctedFullText).toContain('difficulty with')
      })

      it('includes Medical History for IE', () => {
        const ieVisit = createBaseVisitRecord({
          subjective: {
            visitType: 'INITIAL EVALUATION',
            chiefComplaint: 'pain',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '40%',
            adlImpairment: 'mild',
            painScale: { worst: 8, best: 5, current: 7 } as PainScaleDetailed,
            painFrequency: 'Frequent',
            painFrequencyRange: '51% and 75%',
            medicalHistory: ['Hypertension', 'Diabetes']
          }
        })
        const doc = createDocument([ieVisit])
        const errors: CheckError[] = [
          createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections[0].correctedFullText).toContain('Medical History')
        expect(corrections[0].correctedFullText).toContain('Hypertension')
      })
    })

    describe('TX format', () => {
      it('applies symptomChange fix in Chief Complaint', () => {
        const ieVisit = createBaseVisitRecord()
        const txVisit = createTXVisitRecord()
        const doc = createDocument([ieVisit, txVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'T02',
            visitIndex: 1,
            section: 'S',
            field: 'symptomChange'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        // T02 generates symptomChange fix which should appear in S section
        const fix = corrections[0].fieldFixes.find(f => f.field === 'symptomChange')
        expect(fix?.corrected).toBe('similar symptom(s) as last visit')
      })

      it('applies progressReason fix in Chief Complaint', () => {
        const ieVisit = createBaseVisitRecord()
        const txVisit = createTXVisitRecord({
          subjective: {
            visitType: 'Follow up visit',
            chiefComplaint: 'improvement of symptom(s) because of skipped treatments',
            chronicityLevel: 'Chronic',
            painTypes: ['Aching'],
            bodyPart: 'lower back',
            bodyPartNormalized: 'LBP',
            radiation: false,
            muscleWeaknessScale: '40%',
            adlImpairment: 'moderate',
            painScale: { worst: 8, best: 5, current: 7 } as PainScaleDetailed,
            painFrequency: 'Frequent',
            painFrequencyRange: '51% and 75%'
          }
        })
        const doc = createDocument([ieVisit, txVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'T06',
            visitIndex: 1,
            section: 'S',
            field: 'chiefComplaint',
            message: 'improvement with negative reason'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        expect(corrections).toHaveLength(1)
        const fix = corrections[0].fieldFixes.find(f => f.field === 'progressReason')
        expect(fix?.corrected).toBe('maintain regular treatments')
      })

      it('does not include Medical History', () => {
        const ieVisit = createBaseVisitRecord()
        const txVisit = createTXVisitRecord()
        const doc = createDocument([ieVisit, txVisit])
        const errors: CheckError[] = [
          createError({
            ruleId: 'TX01',
            visitIndex: 1,
            section: 'S'
          })
        ]

        const corrections = generateCorrections(doc, errors)

        // TX format should not include Medical History
        expect(corrections[0].correctedFullText).not.toContain('Medical History')
      })
    })
  })

  describe('formatObjectiveText', () => {
    it('applies tenderness fix in output', () => {
      const ieVisit = createBaseVisitRecord({
        subjective: {
          visitType: 'INITIAL EVALUATION',
          chiefComplaint: 'pain',
          chronicityLevel: 'Chronic',
          painTypes: ['Aching'],
          bodyPart: 'lower back',
          bodyPartNormalized: 'LBP',
          radiation: false,
          muscleWeaknessScale: '50%',
          adlImpairment: 'severe',
          painScale: { worst: 10, best: 7, current: 9 } as PainScaleDetailed,
          painFrequency: 'Constant',
          painFrequencyRange: '76% and 100%'
        },
        objective: {
          inspection: 'local skin no damage or rash',
          tightnessMuscles: { muscles: ['iliocostalis'], gradingScale: 'severe' },
          tendernessMuscles: { muscles: ['iliocostalis'], scale: 2, scaleDescription: '+2' },
          spasmMuscles: { muscles: ['longissimus'], frequencyScale: 3, scaleDescription: '+3' },
          rom: { bodyPart: 'Lumbar', items: [] },
          tonguePulse: { tongue: 'pale', pulse: 'thready' }
        }
      })
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({
          ruleId: 'IE02',
          visitIndex: 0,
          section: 'O',
          field: 'tenderness.scale',
          actual: '+2'
        })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(corrections).toHaveLength(1)
      expect(corrections[0].correctedFullText).toContain('+4 tenderness')
    })

    it('applies tonguePulse fix in output', () => {
      const ieVisit = createBaseVisitRecord({
        objective: {
          inspection: 'local skin no damage or rash',
          tightnessMuscles: { muscles: ['iliocostalis'], gradingScale: 'moderate' },
          tendernessMuscles: { muscles: ['iliocostalis'], scale: 3, scaleDescription: '+3' },
          spasmMuscles: { muscles: ['longissimus'], frequencyScale: 2, scaleDescription: '+2' },
          rom: { bodyPart: 'Lumbar', items: [] },
          tonguePulse: { tongue: 'pale, thin white coat', pulse: 'thready' }
        }
      })
      const txVisit = createTXVisitRecord({
        objective: {
          inspection: 'local skin no damage or rash',
          tightnessMuscles: { muscles: ['iliocostalis'], gradingScale: 'mild' },
          tendernessMuscles: { muscles: ['iliocostalis'], scale: 2, scaleDescription: '+2' },
          spasmMuscles: { muscles: ['longissimus'], frequencyScale: 2, scaleDescription: '+2' },
          rom: { bodyPart: 'Lumbar', items: [] },
          tonguePulse: { tongue: 'red', pulse: 'rapid' }
        }
      })
      const doc = createDocument([ieVisit, txVisit])
      const errors: CheckError[] = [
        createError({
          ruleId: 'TX05',
          visitIndex: 1,
          section: 'O',
          field: 'tonguePulse',
          expected: 'pale, thin white coat / thready',
          actual: 'red / rapid'
        })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(corrections).toHaveLength(1)
      expect(corrections[0].correctedFullText).toContain('pale, thin white coat')
      expect(corrections[0].correctedFullText).toContain('thready')
    })

    it('includes all objective sections', () => {
      const ieVisit = createBaseVisitRecord()
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({
          ruleId: 'IE02',
          visitIndex: 0,
          section: 'O'
        })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(corrections[0].correctedFullText).toContain('Inspection')
      expect(corrections[0].correctedFullText).toContain('Tightness')
      expect(corrections[0].correctedFullText).toContain('Tenderness')
      expect(corrections[0].correctedFullText).toContain('Spasm')
      expect(corrections[0].correctedFullText).toContain('ROM')
      expect(corrections[0].correctedFullText).toContain('Tongue')
      expect(corrections[0].correctedFullText).toContain('Pulse')
    })
  })

  describe('formatPlanText', () => {
    it('applies electricalStimulation fix (without E-Stim)', () => {
      const ieVisit = createBaseVisitRecord({
        subjective: {
          visitType: 'INITIAL EVALUATION',
          chiefComplaint: 'pain',
          chronicityLevel: 'Chronic',
          painTypes: ['Aching'],
          bodyPart: 'lower back',
          bodyPartNormalized: 'LBP',
          radiation: false,
          muscleWeaknessScale: '40%',
          adlImpairment: 'moderate',
          painScale: { worst: 8, best: 5, current: 7 } as PainScaleDetailed,
          painFrequency: 'Frequent',
          painFrequencyRange: '51% and 75%',
          medicalHistory: ['Pacemaker']
        },
        plan: {
          needleSpecs: [{ gauge: '30#', length: '1.5"' }],
          treatmentTime: 15,
          treatmentPosition: 'Back Points',
          acupoints: ['BL23', 'BL25'],
          electricalStimulation: true,
          treatmentPrinciples: 'Move Qi'
        }
      })
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({
          ruleId: 'T07',
          visitIndex: 0,
          section: 'P',
          field: 'electricalStimulation'
        })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(corrections).toHaveLength(1)
      expect(corrections[0].correctedFullText).toContain('Without E-Stim')
    })

    it('removes goals for TX with TX06 fix', () => {
      const ieVisit = createBaseVisitRecord()
      const txVisit = createTXVisitRecord({
        plan: {
          needleSpecs: [{ gauge: '30#', length: '1.5"' }],
          treatmentTime: 15,
          treatmentPosition: 'Back Points',
          acupoints: ['BL23', 'BL25'],
          electricalStimulation: true,
          treatmentPrinciples: 'Move Qi',
          shortTermGoal: {
            frequency: '12 treatments',
            painScaleTarget: '4/10',
            sensationScaleTarget: '30%',
            tightnessTarget: 'mild',
            tendernessTarget: '+2',
            spasmsTarget: '+1',
            strengthTarget: '4+/5'
          }
        }
      })
      const doc = createDocument([ieVisit, txVisit])
      const errors: CheckError[] = [
        createError({
          ruleId: 'TX06',
          visitIndex: 1,
          section: 'P',
          field: 'goals'
        })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(corrections).toHaveLength(1)
      // TX with TX06 fix should not contain goals
      expect(corrections[0].correctedFullText).not.toContain('Short Term Goal')
      expect(corrections[0].correctedFullText).not.toContain('Long Term Goal')
    })

    it('includes goals for IE without TX06 fix', () => {
      const ieVisit = createBaseVisitRecord({
        plan: {
          needleSpecs: [{ gauge: '30#', length: '1.5"' }],
          treatmentTime: 15,
          treatmentPosition: 'Back Points',
          acupoints: ['BL23', 'BL25'],
          electricalStimulation: true,
          shortTermGoal: {
            frequency: '12 treatments',
            painScaleTarget: '4-5/10',
            sensationScaleTarget: '30%',
            tightnessTarget: 'mild',
            tendernessTarget: '+2',
            spasmsTarget: '+1',
            strengthTarget: '4+/5'
          },
          longTermGoal: {
            frequency: '24 treatments',
            painScaleTarget: '2-3/10',
            sensationScaleTarget: '15%',
            tightnessTarget: 'mild',
            tendernessTarget: '+1',
            spasmsTarget: '+1',
            strengthTarget: '5/5',
            adlTarget: 'Improved'
          },
          treatmentPrinciples: 'Move Qi'
        }
      })
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({
          ruleId: 'T07',
          visitIndex: 0,
          section: 'P',
          field: 'electricalStimulation'
        })
      ]

      const corrections = generateCorrections(doc, errors)

      // IE should include goals
      expect(corrections[0].correctedFullText).toContain('Short Term Goal')
      expect(corrections[0].correctedFullText).toContain('Long Term Goal')
    })

    it('includes needle specifications', () => {
      const ieVisit = createBaseVisitRecord()
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({
          ruleId: 'T07',
          visitIndex: 0,
          section: 'P'
        })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(corrections[0].correctedFullText).toContain('Needle Specifications')
    })

    it('includes acupoints', () => {
      const ieVisit = createBaseVisitRecord()
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({
          ruleId: 'T07',
          visitIndex: 0,
          section: 'P'
        })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(corrections[0].correctedFullText).toContain('Acupoints')
      expect(corrections[0].correctedFullText).toContain('BL23')
    })
  })

  describe('Edge Cases', () => {
    it('handles visit with simple pain scale (value only)', () => {
      const ieVisit = createBaseVisitRecord({
        subjective: {
          visitType: 'INITIAL EVALUATION',
          chiefComplaint: 'pain',
          chronicityLevel: 'Chronic',
          painTypes: ['Aching'],
          bodyPart: 'lower back',
          bodyPartNormalized: 'LBP',
          radiation: false,
          muscleWeaknessScale: '40%',
          adlImpairment: 'mild',
          adlDifficultyLevel: 'mild',
          painScale: { value: 7 },
          painFrequency: 'Frequent',
          painFrequencyRange: '51% and 75%'
        }
      })
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(corrections).toHaveLength(1)
      const fix = corrections[0].fieldFixes.find(f => f.field === 'adlDifficultyLevel')
      expect(fix?.corrected).toBe('moderate to severe')
    })

    it('handles visit with range pain scale', () => {
      // Create base then override painScale to avoid deepMerge keeping 'current'
      const ieVisit = createBaseVisitRecord()
      // Directly replace painScale to ensure no 'current' field exists
      ieVisit.subjective.painScale = { value: 5, range: { min: 4, max: 6 } } as unknown as PainScaleDetailed
      ieVisit.subjective.adlImpairment = 'mild'
      ieVisit.subjective.adlDifficultyLevel = 'mild'
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(corrections).toHaveLength(1)
      // Should use range.max (6) for calculation -> moderate
      const fix = corrections[0].fieldFixes.find(f => f.field === 'adlDifficultyLevel')
      expect(fix?.corrected).toBe('moderate')
    })

    it('handles multiple errors of same type', () => {
      const ieVisit = createBaseVisitRecord()
      const txVisit1 = createTXVisitRecord({ assessment: { date: '01/22/2025', generalCondition: 'fair', symptomChange: 'improvement', physicalFindingChange: 'reduced', currentPattern: 'Qi' } })
      const txVisit2 = createTXVisitRecord({ assessment: { date: '01/29/2025', generalCondition: 'fair', symptomChange: 'improvement', physicalFindingChange: 'reduced', currentPattern: 'Qi' } })
      const doc = createDocument([ieVisit, txVisit1, txVisit2])
      const errors: CheckError[] = [
        createError({ id: 'e1', ruleId: 'TX01', visitIndex: 1, section: 'S', visitDate: '01/22/2025' }),
        createError({ id: 'e2', ruleId: 'TX01', visitIndex: 2, section: 'S', visitDate: '01/29/2025' })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(corrections).toHaveLength(2)
      expect(corrections[0].visitIndex).toBe(1)
      expect(corrections[1].visitIndex).toBe(2)
    })

    it('handles unknown body part normalization', () => {
      const ieVisit = createBaseVisitRecord({
        subjective: {
          visitType: 'INITIAL EVALUATION',
          chiefComplaint: 'pain in unknown area',
          chronicityLevel: 'Chronic',
          painTypes: ['Aching'],
          bodyPart: 'unknown area',
          bodyPartNormalized: 'UNKNOWN',
          radiation: false,
          muscleWeaknessScale: '40%',
          adlImpairment: 'mild',
          painScale: { worst: 8, best: 5, current: 7 } as PainScaleDetailed,
          painFrequency: 'Frequent',
          painFrequencyRange: '51% and 75%'
        }
      })
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
      ]

      // Should not throw, defaults to LBP patterns
      expect(() => generateCorrections(doc, errors)).not.toThrow()
      const corrections = generateCorrections(doc, errors)
      expect(corrections).toHaveLength(1)
    })

    it('handles visit without previous visit for TX checks', () => {
      const txVisit = createTXVisitRecord()
      const doc = createDocument([txVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'TX01', visitIndex: 0, section: 'S' })
      ]

      expect(() => generateCorrections(doc, errors)).not.toThrow()
      const corrections = generateCorrections(doc, errors)
      expect(corrections).toHaveLength(1)
    })

    it('handles error with invalid visitIndex gracefully', () => {
      const ieVisit = createBaseVisitRecord()
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE01', visitIndex: 99, section: 'S' })
      ]

      // Should not throw, just skip invalid index
      expect(() => generateCorrections(doc, errors)).not.toThrow()
      const corrections = generateCorrections(doc, errors)
      expect(corrections).toHaveLength(0)
    })

    it('handles empty muscle arrays', () => {
      const ieVisit = createBaseVisitRecord({
        objective: {
          inspection: 'local skin no damage or rash',
          tightnessMuscles: { muscles: [], gradingScale: 'moderate' },
          tendernessMuscles: { muscles: [], scale: 3, scaleDescription: '+3' },
          spasmMuscles: { muscles: [], frequencyScale: 2, scaleDescription: '+2' },
          rom: { bodyPart: 'Lumbar', items: [] },
          tonguePulse: { tongue: 'pale', pulse: 'thready' }
        }
      })
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE02', visitIndex: 0, section: 'O' })
      ]

      expect(() => generateCorrections(doc, errors)).not.toThrow()
      const corrections = generateCorrections(doc, errors)
      expect(corrections).toHaveLength(1)
    })

    it('handles empty painTypes array', () => {
      const ieVisit = createBaseVisitRecord({
        subjective: {
          visitType: 'INITIAL EVALUATION',
          chiefComplaint: 'pain',
          chronicityLevel: 'Chronic',
          painTypes: [],
          bodyPart: 'lower back',
          bodyPartNormalized: 'LBP',
          radiation: false,
          muscleWeaknessScale: '40%',
          adlImpairment: 'mild',
          painScale: { worst: 8, best: 5, current: 7 } as PainScaleDetailed,
          painFrequency: 'Frequent',
          painFrequencyRange: '51% and 75%'
        }
      })
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
      ]

      expect(() => generateCorrections(doc, errors)).not.toThrow()
      const corrections = generateCorrections(doc, errors)
      // Should default to 'aching'
      expect(corrections[0].correctedFullText).toContain('aching')
    })

    it('handles errors across all sections S, O, A, P', () => {
      const ieVisit = createBaseVisitRecord({
        subjective: {
          visitType: 'INITIAL EVALUATION',
          chiefComplaint: 'pain',
          chronicityLevel: 'Chronic',
          painTypes: ['Aching'],
          bodyPart: 'lower back',
          bodyPartNormalized: 'LBP',
          radiation: false,
          muscleWeaknessScale: '50%',
          adlImpairment: 'mild',
          painScale: { worst: 10, best: 7, current: 9 } as PainScaleDetailed,
          painFrequency: 'Constant',
          painFrequencyRange: '76% and 100%',
          medicalHistory: ['Pacemaker']
        },
        objective: {
          inspection: 'local skin no damage or rash',
          tightnessMuscles: { muscles: ['iliocostalis'], gradingScale: 'severe' },
          tendernessMuscles: { muscles: ['iliocostalis'], scale: 2, scaleDescription: '+2' },
          spasmMuscles: { muscles: ['longissimus'], frequencyScale: 3, scaleDescription: '+3' },
          rom: { bodyPart: 'Lumbar', items: [] },
          tonguePulse: { tongue: 'pale', pulse: 'thready' }
        },
        plan: {
          needleSpecs: [{ gauge: '30#', length: '1.5"' }],
          treatmentTime: 15,
          treatmentPosition: 'Back Points',
          acupoints: ['BL23', 'BL25'],
          electricalStimulation: true,
          treatmentPrinciples: 'Move Qi'
        }
      })
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ id: 'e1', ruleId: 'IE01', visitIndex: 0, section: 'S' }),
        createError({ id: 'e2', ruleId: 'IE02', visitIndex: 0, section: 'O' }),
        createError({ id: 'e3', ruleId: 'T07', visitIndex: 0, section: 'P' })
      ]

      const corrections = generateCorrections(doc, errors)

      // Should have 3 corrections for S, O, P sections
      expect(corrections.length).toBe(3)
      expect(corrections.map(c => c.section).sort()).toEqual(['O', 'P', 'S'])
    })
  })

  describe('CorrectionItem structure', () => {
    it('includes visitDate', () => {
      const ieVisit = createBaseVisitRecord()
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE01', visitIndex: 0, section: 'S', visitDate: '01/15/2025' })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(corrections[0].visitDate).toBe('01/15/2025')
    })

    it('includes visitIndex', () => {
      const ieVisit = createBaseVisitRecord()
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(corrections[0].visitIndex).toBe(0)
    })

    it('includes section', () => {
      const ieVisit = createBaseVisitRecord()
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(corrections[0].section).toBe('S')
    })

    it('includes errors array', () => {
      const ieVisit = createBaseVisitRecord()
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(corrections[0].errors).toHaveLength(1)
      expect(corrections[0].errors[0].ruleId).toBe('IE01')
    })

    it('includes fieldFixes array', () => {
      const ieVisit = createBaseVisitRecord()
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(Array.isArray(corrections[0].fieldFixes)).toBe(true)
      expect(corrections[0].fieldFixes.length).toBeGreaterThan(0)
    })

    it('includes correctedFullText string', () => {
      const ieVisit = createBaseVisitRecord()
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
      ]

      const corrections = generateCorrections(doc, errors)

      expect(typeof corrections[0].correctedFullText).toBe('string')
      expect(corrections[0].correctedFullText.length).toBeGreaterThan(0)
    })
  })

  describe('FieldFix structure', () => {
    it('includes field name', () => {
      const ieVisit = createBaseVisitRecord()
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
      ]

      const corrections = generateCorrections(doc, errors)
      const fix = corrections[0].fieldFixes[0]

      expect(fix.field).toBeDefined()
      expect(typeof fix.field).toBe('string')
    })

    it('includes original value', () => {
      const ieVisit = createBaseVisitRecord()
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE01', visitIndex: 0, section: 'S', actual: 'mild' })
      ]

      const corrections = generateCorrections(doc, errors)
      const fix = corrections[0].fieldFixes[0]

      expect(fix.original).toBeDefined()
    })

    it('includes corrected value', () => {
      const ieVisit = createBaseVisitRecord()
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
      ]

      const corrections = generateCorrections(doc, errors)
      const fix = corrections[0].fieldFixes[0]

      expect(fix.corrected).toBeDefined()
      expect(typeof fix.corrected).toBe('string')
    })

    it('includes reason', () => {
      const ieVisit = createBaseVisitRecord()
      const doc = createDocument([ieVisit])
      const errors: CheckError[] = [
        createError({ ruleId: 'IE01', visitIndex: 0, section: 'S' })
      ]

      const corrections = generateCorrections(doc, errors)
      const fix = corrections[0].fieldFixes[0]

      expect(fix.reason).toBeDefined()
      expect(typeof fix.reason).toBe('string')
    })
  })
})
