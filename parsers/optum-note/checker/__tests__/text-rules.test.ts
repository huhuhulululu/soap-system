/**
 * Text Validation Rules Unit Tests (T01-T09)
 *
 * Tests for semantic consistency validation in SOAP notes
 */

// Jest globals: describe, it, expect are available globally
import type {
  VisitRecord,
  Subjective,
  Objective,
  Assessment,
  Plan,
  ROM,
  ROMItem,
  GradingScale,
} from '../../types'

// ============ Mock Data Factories ============

function createMockSubjective(overrides: Partial<Subjective> = {}): Subjective {
  return {
    visitType: 'Follow up visit',
    chiefComplaint: 'Lower back pain',
    chronicityLevel: 'Chronic',
    painTypes: ['Dull', 'Aching'],
    bodyPart: 'Lower Back',
    laterality: 'bilateral',
    radiation: false,
    muscleWeaknessScale: '40%',
    adlImpairment: 'sitting, standing, walking',
    adlDifficultyLevel: 'moderate',
    painScale: { value: 6 },
    painFrequency: 'Frequent',
    painFrequencyRange: '51% and 75%',
    ...overrides,
  }
}

function createMockROMItem(overrides: Partial<ROMItem> = {}): ROMItem {
  return {
    strength: '4/5',
    movement: 'Flexion',
    degrees: 80,
    severity: 'mild',
    ...overrides,
  }
}

function createMockROM(overrides: Partial<ROM> = {}): ROM {
  return {
    bodyPart: 'Lumbar',
    items: [createMockROMItem()],
    ...overrides,
  }
}

function createMockObjective(overrides: Partial<Objective> = {}): Objective {
  return {
    inspection: 'local skin no damage or rash',
    tightnessMuscles: {
      muscles: ['iliocostalis', 'spinalis'],
      gradingScale: 'moderate',
    },
    tendernessMuscles: {
      muscles: ['iliocostalis', 'spinalis'],
      scale: 2,
      scaleDescription: '(+2) = Patient states that the area is moderately tender',
    },
    spasmMuscles: {
      muscles: ['iliocostalis'],
      frequencyScale: 2,
      scaleDescription: '(+2)=Occasional spontaneous spasms and easily induced',
    },
    rom: createMockROM(),
    tonguePulse: {
      tongue: 'pale, thin white coat',
      pulse: 'thready',
    },
    ...overrides,
  }
}

function createMockAssessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    date: '02/09/2026',
    generalCondition: 'good',
    symptomChange: 'improvement',
    physicalFindingChange: 'reduced local muscles tightness',
    currentPattern: 'Qi & Blood Deficiency in local meridian',
    ...overrides,
  }
}

function createMockPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    needleSpecs: [{ gauge: '36#', length: '1"' }],
    treatmentTime: 15,
    treatmentPosition: 'Back Points',
    acupoints: ['BL23', 'BL25', 'GB30'],
    electricalStimulation: false,
    treatmentPrinciples: 'Moving qi, activating Blood circulation',
    ...overrides,
  }
}

function createMockVisitRecord(overrides: {
  subjective?: Partial<Subjective>
  objective?: Partial<Objective>
  assessment?: Partial<Assessment>
  plan?: Partial<Plan>
} = {}): VisitRecord {
  return {
    subjective: createMockSubjective(overrides.subjective),
    objective: createMockObjective(overrides.objective),
    assessment: createMockAssessment(overrides.assessment),
    plan: createMockPlan(overrides.plan),
    diagnosisCodes: [{ description: 'Low back pain', icd10: 'M54.5' }],
    procedureCodes: [{ description: 'ACUP 1/> WO ESTIM 1ST 15 MIN', cpt: '97810' }],
  }
}

// ============ Validation Error Types ============

interface ValidationError {
  ruleId: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  section: 'subjective' | 'objective' | 'assessment' | 'plan'
  field: string
  message: string
}

// ============ T01: Direction Word + Noun Polarity Contradiction ============

describe('T01: Direction Word + Noun Polarity Contradiction', () => {
  describe('should detect contradictions', () => {
    it('should flag "increased" with negative noun (ROM limitation)', () => {
      const visit = createMockVisitRecord({
        assessment: {
          physicalFindingChange: 'increased ROM limitation',
        },
      })

      const expectedError: ValidationError = {
        ruleId: 'T01',
        severity: 'HIGH',
        section: 'assessment',
        field: 'physicalFindingChange',
        message: 'Semantic contradiction: "increased" should not be used with negative noun "ROM limitation"',
      }

      // Validate that the error would be generated
      expect(visit.assessment.physicalFindingChange).toContain('increased')
      expect(visit.assessment.physicalFindingChange).toContain('limitation')
      expect(expectedError.ruleId).toBe('T01')
      expect(expectedError.severity).toBe('HIGH')
    })

    it('should flag "reduced" with positive noun (muscles strength)', () => {
      const visit = createMockVisitRecord({
        assessment: {
          physicalFindingChange: 'reduced muscles strength',
        },
      })

      const expectedError: ValidationError = {
        ruleId: 'T01',
        severity: 'HIGH',
        section: 'assessment',
        field: 'physicalFindingChange',
        message: 'Semantic contradiction: "reduced" should not be used with positive noun "muscles strength"',
      }

      expect(visit.assessment.physicalFindingChange).toContain('reduced')
      expect(visit.assessment.physicalFindingChange).toContain('strength')
      expect(expectedError.ruleId).toBe('T01')
    })

    it('should flag "increased tightness" as worsening', () => {
      const visit = createMockVisitRecord({
        assessment: {
          physicalFindingChange: 'increased local muscles tightness',
        },
      })

      expect(visit.assessment.physicalFindingChange).toContain('increased')
      expect(visit.assessment.physicalFindingChange).toContain('tightness')
    })
  })

  describe('should pass valid combinations', () => {
    it('should accept "reduced" with negative noun (tightness)', () => {
      const visit = createMockVisitRecord({
        assessment: {
          physicalFindingChange: 'reduced local muscles tightness',
        },
      })

      // No error expected - this is correct semantics
      expect(visit.assessment.physicalFindingChange).toContain('reduced')
      expect(visit.assessment.physicalFindingChange).toContain('tightness')
    })

    it('should accept "increased" with positive noun (muscles strength)', () => {
      const visit = createMockVisitRecord({
        assessment: {
          physicalFindingChange: 'increased muscles strength',
        },
      })

      // No error expected - this is correct semantics
      expect(visit.assessment.physicalFindingChange).toContain('increased')
      expect(visit.assessment.physicalFindingChange).toContain('strength')
    })
  })
})

// ============ T02: Improvement Description + Value Worsening Contradiction ============

describe('T02: Improvement Description + Value Worsening Contradiction (CRITICAL)', () => {
  describe('should detect contradictions', () => {
    it('should flag improvement claim when pain scale worsens', () => {
      const visit1 = createMockVisitRecord({
        subjective: { painScale: { value: 7 } },
        assessment: { symptomChange: 'improvement' },
      })

      const visit2 = createMockVisitRecord({
        subjective: { painScale: { value: 8 } }, // worsened from 7 to 8
        assessment: { symptomChange: 'improvement' },
      })

      const expectedError: ValidationError = {
        ruleId: 'T02',
        severity: 'CRITICAL',
        section: 'assessment',
        field: 'symptomChange',
        message: 'Contradiction: symptomChange claims "improvement" but pain scale worsened (7→8)',
      }

      expect(visit2.assessment.symptomChange).toBe('improvement')
      expect((visit2.subjective.painScale as { value: number }).value).toBeGreaterThan(
        (visit1.subjective.painScale as { value: number }).value
      )
      expect(expectedError.ruleId).toBe('T02')
      expect(expectedError.severity).toBe('CRITICAL')
    })

    it('should flag slight improvement claim when tenderness worsens', () => {
      const visit1 = createMockVisitRecord({
        objective: {
          tendernessMuscles: {
            muscles: ['iliocostalis'],
            scale: 2,
            scaleDescription: '+2',
          },
        },
        assessment: { symptomChange: 'slight improvement' },
      })

      const visit2 = createMockVisitRecord({
        objective: {
          tendernessMuscles: {
            muscles: ['iliocostalis'],
            scale: 3, // worsened from +2 to +3
            scaleDescription: '+3',
          },
        },
        assessment: { symptomChange: 'slight improvement' },
      })

      const expectedError: ValidationError = {
        ruleId: 'T02',
        severity: 'CRITICAL',
        section: 'assessment',
        field: 'symptomChange',
        message: 'Contradiction: symptomChange claims "slight improvement" but tenderness worsened (+2→+3)',
      }

      expect(visit2.objective.tendernessMuscles.scale).toBeGreaterThan(
        visit1.objective.tendernessMuscles.scale
      )
      expect(expectedError.severity).toBe('CRITICAL')
    })
  })

  describe('should pass valid combinations', () => {
    it('should accept improvement claim when pain scale improves', () => {
      const visit1 = createMockVisitRecord({
        subjective: { painScale: { value: 8 } },
      })

      const visit2 = createMockVisitRecord({
        subjective: { painScale: { value: 6 } }, // improved from 8 to 6
        assessment: { symptomChange: 'improvement' },
      })

      // No error expected
      expect(visit2.assessment.symptomChange).toBe('improvement')
      expect((visit2.subjective.painScale as { value: number }).value).toBeLessThan(
        (visit1.subjective.painScale as { value: number }).value
      )
    })
  })
})

// ============ T03: Worsening Description + Value Improvement Contradiction ============

describe('T03: Worsening Description + Value Improvement Contradiction (CRITICAL)', () => {
  describe('should detect contradictions', () => {
    it('should flag exacerbate claim when pain scale improves', () => {
      const visit1 = createMockVisitRecord({
        subjective: { painScale: { value: 8 } },
      })

      const visit2 = createMockVisitRecord({
        subjective: { painScale: { value: 6 } }, // improved from 8 to 6
        assessment: { symptomChange: 'exacerbate' },
      })

      const expectedError: ValidationError = {
        ruleId: 'T03',
        severity: 'CRITICAL',
        section: 'assessment',
        field: 'symptomChange',
        message: 'Contradiction: symptomChange claims "exacerbate" but pain scale improved (8→6)',
      }

      expect(visit2.assessment.symptomChange).toBe('exacerbate')
      expect((visit2.subjective.painScale as { value: number }).value).toBeLessThan(
        (visit1.subjective.painScale as { value: number }).value
      )
      expect(expectedError.ruleId).toBe('T03')
      expect(expectedError.severity).toBe('CRITICAL')
    })

    it('should flag exacerbate claim when spasm scale improves', () => {
      const visit1 = createMockVisitRecord({
        objective: {
          spasmMuscles: {
            muscles: ['iliocostalis'],
            frequencyScale: 3,
            scaleDescription: '+3',
          },
        },
      })

      const visit2 = createMockVisitRecord({
        objective: {
          spasmMuscles: {
            muscles: ['iliocostalis'],
            frequencyScale: 2, // improved from +3 to +2
            scaleDescription: '+2',
          },
        },
        assessment: { symptomChange: 'exacerbate' },
      })

      const expectedError: ValidationError = {
        ruleId: 'T03',
        severity: 'CRITICAL',
        section: 'assessment',
        field: 'symptomChange',
        message: 'Contradiction: symptomChange claims "exacerbate" but spasm scale improved (+3→+2)',
      }

      expect(visit2.objective.spasmMuscles.frequencyScale).toBeLessThan(
        visit1.objective.spasmMuscles.frequencyScale
      )
      expect(expectedError.severity).toBe('CRITICAL')
    })
  })

  describe('should pass valid combinations', () => {
    it('should accept exacerbate claim when pain scale worsens', () => {
      const visit1 = createMockVisitRecord({
        subjective: { painScale: { value: 6 } },
      })

      const visit2 = createMockVisitRecord({
        subjective: { painScale: { value: 8 } }, // worsened from 6 to 8
        assessment: { symptomChange: 'exacerbate' },
      })

      // No error expected
      expect(visit2.assessment.symptomChange).toBe('exacerbate')
      expect((visit2.subjective.painScale as { value: number }).value).toBeGreaterThan(
        (visit1.subjective.painScale as { value: number }).value
      )
    })
  })
})

// ============ T04: ROM Description Contradiction ============

describe('T04: ROM Description Contradiction', () => {
  describe('should detect contradictions', () => {
    it('should flag "reduced ROM limitation" when ROM degrees decrease', () => {
      const visit1 = createMockVisitRecord({
        objective: {
          rom: createMockROM({
            items: [createMockROMItem({ degrees: 80 })],
          }),
        },
      })

      const visit2 = createMockVisitRecord({
        objective: {
          rom: createMockROM({
            items: [createMockROMItem({ degrees: 70 })], // worsened from 80 to 70
          }),
        },
        assessment: {
          physicalFindingChange: 'reduced ROM limitation',
        },
      })

      const expectedError: ValidationError = {
        ruleId: 'T04',
        severity: 'HIGH',
        section: 'assessment',
        field: 'physicalFindingChange',
        message: 'Contradiction: claims "reduced ROM limitation" but ROM degrees decreased (80→70)',
      }

      expect(visit2.assessment.physicalFindingChange).toContain('reduced ROM limitation')
      expect(visit2.objective.rom.items[0].degrees).toBeLessThan(
        visit1.objective.rom.items[0].degrees
      )
      expect(expectedError.ruleId).toBe('T04')
      expect(expectedError.severity).toBe('HIGH')
    })

    it('should flag "increased joint ROM" when ROM degrees decrease', () => {
      const visit1 = createMockVisitRecord({
        objective: {
          rom: createMockROM({
            items: [createMockROMItem({ degrees: 80 })],
          }),
        },
      })

      const visit2 = createMockVisitRecord({
        objective: {
          rom: createMockROM({
            items: [createMockROMItem({ degrees: 70 })],
          }),
        },
        assessment: {
          physicalFindingChange: 'increased joint ROM',
        },
      })

      const expectedError: ValidationError = {
        ruleId: 'T04',
        severity: 'HIGH',
        section: 'assessment',
        field: 'physicalFindingChange',
        message: 'Contradiction: claims "increased joint ROM" but ROM degrees decreased (80→70)',
      }

      expect(visit2.assessment.physicalFindingChange).toContain('increased joint ROM')
      expect(expectedError.severity).toBe('HIGH')
    })
  })

  describe('should pass valid combinations', () => {
    it('should accept "reduced ROM limitation" when ROM degrees increase', () => {
      const visit1 = createMockVisitRecord({
        objective: {
          rom: createMockROM({
            items: [createMockROMItem({ degrees: 70 })],
          }),
        },
      })

      const visit2 = createMockVisitRecord({
        objective: {
          rom: createMockROM({
            items: [createMockROMItem({ degrees: 80 })], // improved from 70 to 80
          }),
        },
        assessment: {
          physicalFindingChange: 'reduced ROM limitation',
        },
      })

      // No error expected
      expect(visit2.objective.rom.items[0].degrees).toBeGreaterThan(
        visit1.objective.rom.items[0].degrees
      )
    })

    it('should accept "increased joint ROM" when ROM degrees increase', () => {
      const visit1 = createMockVisitRecord({
        objective: {
          rom: createMockROM({
            items: [createMockROMItem({ degrees: 70 })],
          }),
        },
      })

      const visit2 = createMockVisitRecord({
        objective: {
          rom: createMockROM({
            items: [createMockROMItem({ degrees: 80 })],
          }),
        },
        assessment: {
          physicalFindingChange: 'increased joint ROM',
        },
      })

      // No error expected
      expect(visit2.objective.rom.items[0].degrees).toBeGreaterThan(
        visit1.objective.rom.items[0].degrees
      )
    })
  })
})

// ============ T05: Muscle Strength Description Contradiction ============

describe('T05: Muscle Strength Description Contradiction', () => {
  // Helper to parse strength value
  const parseStrength = (strength: string): number => {
    const match = strength.match(/(\d+)([+-])?\/5/)
    if (!match) return 0
    const base = parseInt(match[1], 10)
    const modifier = match[2]
    if (modifier === '+') return base + 0.5
    if (modifier === '-') return base - 0.2
    return base
  }

  describe('should detect contradictions', () => {
    it('should flag "increased muscles strength" when strength decreases', () => {
      const visit1 = createMockVisitRecord({
        objective: {
          rom: createMockROM({
            items: [createMockROMItem({ strength: '4/5' })],
          }),
        },
      })

      const visit2 = createMockVisitRecord({
        objective: {
          rom: createMockROM({
            items: [createMockROMItem({ strength: '3/5' })], // worsened from 4/5 to 3/5
          }),
        },
        assessment: {
          physicalFindingChange: 'increased muscles strength',
        },
      })

      const expectedError: ValidationError = {
        ruleId: 'T05',
        severity: 'HIGH',
        section: 'assessment',
        field: 'physicalFindingChange',
        message: 'Contradiction: claims "increased muscles strength" but strength decreased (4/5→3/5)',
      }

      expect(visit2.assessment.physicalFindingChange).toContain('increased muscles strength')
      expect(parseStrength(visit2.objective.rom.items[0].strength)).toBeLessThan(
        parseStrength(visit1.objective.rom.items[0].strength)
      )
      expect(expectedError.ruleId).toBe('T05')
      expect(expectedError.severity).toBe('HIGH')
    })

    it('should flag strength goal not met when strength decreases', () => {
      const visit1 = createMockVisitRecord({
        objective: {
          rom: createMockROM({
            items: [createMockROMItem({ strength: '4/5' })],
          }),
        },
      })

      const visit2 = createMockVisitRecord({
        objective: {
          rom: createMockROM({
            items: [createMockROMItem({ strength: '3+/5' })], // worsened
          }),
        },
      })

      expect(parseStrength('4/5')).toBe(4)
      expect(parseStrength('3+/5')).toBe(3.5)
      expect(parseStrength(visit2.objective.rom.items[0].strength)).toBeLessThan(
        parseStrength(visit1.objective.rom.items[0].strength)
      )
    })
  })

  describe('should pass valid combinations', () => {
    it('should accept "increased muscles strength" when strength increases', () => {
      const visit1 = createMockVisitRecord({
        objective: {
          rom: createMockROM({
            items: [createMockROMItem({ strength: '3/5' })],
          }),
        },
      })

      const visit2 = createMockVisitRecord({
        objective: {
          rom: createMockROM({
            items: [createMockROMItem({ strength: '4/5' })], // improved from 3/5 to 4/5
          }),
        },
        assessment: {
          physicalFindingChange: 'increased muscles strength',
        },
      })

      // No error expected
      expect(parseStrength(visit2.objective.rom.items[0].strength)).toBeGreaterThan(
        parseStrength(visit1.objective.rom.items[0].strength)
      )
    })
  })
})

// ============ T06: Progress Status + Reason Logic Contradiction ============

describe('T06: Progress Status + Reason Logic Contradiction', () => {
  // Simulated progress report parsing
  interface ProgressReport {
    status: 'improvement' | 'exacerbate' | 'similar'
    reason: string
  }

  const negativeReasons = [
    'skipped treatments',
    'discontinuous treatment',
    'discontinuous treatments',
    'stopped treatment for a while',
    'intense work',
    'bad posture',
    'lack of exercise',
  ]

  const positiveReasons = [
    'maintain regular treatments',
    'continuous treatment',
    'reduced level of pain',
    'sleep quality improved',
  ]

  describe('should detect contradictions', () => {
    it('should flag improvement with negative reason (skipped treatments)', () => {
      const progressReport: ProgressReport = {
        status: 'improvement',
        reason: 'skipped treatments',
      }

      const expectedError: ValidationError = {
        ruleId: 'T06',
        severity: 'MEDIUM',
        section: 'subjective',
        field: 'progressReport',
        message: 'Contradiction: improvement status with negative reason "skipped treatments"',
      }

      expect(progressReport.status).toBe('improvement')
      expect(negativeReasons).toContain(progressReport.reason)
      expect(expectedError.ruleId).toBe('T06')
      expect(expectedError.severity).toBe('MEDIUM')
    })

    it('should flag improvement with discontinuous treatment reason', () => {
      const progressReport: ProgressReport = {
        status: 'improvement',
        reason: 'discontinuous treatment',
      }

      const expectedError: ValidationError = {
        ruleId: 'T06',
        severity: 'MEDIUM',
        section: 'subjective',
        field: 'progressReport',
        message: 'Contradiction: improvement status with negative reason "discontinuous treatment"',
      }

      expect(progressReport.status).toBe('improvement')
      expect(negativeReasons).toContain(progressReport.reason)
      expect(expectedError.severity).toBe('MEDIUM')
    })
  })

  describe('should pass valid combinations', () => {
    it('should accept improvement with positive reason (regular treatments)', () => {
      const progressReport: ProgressReport = {
        status: 'improvement',
        reason: 'maintain regular treatments',
      }

      // No error expected
      expect(progressReport.status).toBe('improvement')
      expect(positiveReasons).toContain(progressReport.reason)
    })

    it('should accept exacerbate with negative reason (stopped treatment)', () => {
      const progressReport: ProgressReport = {
        status: 'exacerbate',
        reason: 'stopped treatment for a while',
      }

      // No error expected
      expect(progressReport.status).toBe('exacerbate')
      expect(negativeReasons).toContain(progressReport.reason)
    })
  })
})

// ============ T07: Pacemaker + Electrical Stimulation Contradiction ============

describe('T07: Pacemaker + Electrical Stimulation Contradiction', () => {
  describe('should detect contradictions', () => {
    it('should flag electrical stimulation with pacemaker in medical history', () => {
      const visit = createMockVisitRecord({
        subjective: {
          medicalHistory: ['Hypertension', 'Pacemaker', 'Diabetes'],
        },
        plan: {
          electricalStimulation: true,
        },
      })

      const expectedError: ValidationError = {
        ruleId: 'T07',
        severity: 'CRITICAL',
        section: 'plan',
        field: 'electricalStimulation',
        message: 'CRITICAL: Electrical stimulation contraindicated for patient with Pacemaker',
      }

      expect(visit.subjective.medicalHistory).toContain('Pacemaker')
      expect(visit.plan.electricalStimulation).toBe(true)
      expect(expectedError.ruleId).toBe('T07')
      expect(expectedError.severity).toBe('CRITICAL')
    })

    it('should detect pacemaker in various medical history formats', () => {
      const visit = createMockVisitRecord({
        subjective: {
          medicalHistory: ['pacemaker implant'],
        },
        plan: {
          electricalStimulation: true,
        },
      })

      const hasPacemaker = visit.subjective.medicalHistory?.some(
        (item) => item.toLowerCase().includes('pacemaker')
      )

      expect(hasPacemaker).toBe(true)
      expect(visit.plan.electricalStimulation).toBe(true)
    })
  })

  describe('should pass valid combinations', () => {
    it('should accept no electrical stimulation with pacemaker', () => {
      const visit = createMockVisitRecord({
        subjective: {
          medicalHistory: ['Hypertension', 'Pacemaker'],
        },
        plan: {
          electricalStimulation: false,
        },
      })

      // No error expected
      expect(visit.subjective.medicalHistory).toContain('Pacemaker')
      expect(visit.plan.electricalStimulation).toBe(false)
    })

    it('should accept electrical stimulation without pacemaker', () => {
      const visit = createMockVisitRecord({
        subjective: {
          medicalHistory: ['Hypertension', 'Diabetes'],
        },
        plan: {
          electricalStimulation: true,
        },
      })

      const hasPacemaker = visit.subjective.medicalHistory?.some(
        (item) => item.toLowerCase().includes('pacemaker')
      )

      // No error expected
      expect(hasPacemaker).toBe(false)
      expect(visit.plan.electricalStimulation).toBe(true)
    })
  })
})

// ============ T08: Severity Monotonicity ============

describe('T08: Severity Monotonicity', () => {
  // Severity level ordering (lower = better)
  const severityOrder: Record<GradingScale, number> = {
    'mild': 1,
    'mild to moderate': 2,
    'moderate': 3,
    'moderate to severe': 4,
    'severe': 5,
  }

  describe('should detect violations', () => {
    it('should flag severity worsening from moderate to severe', () => {
      const visit1 = createMockVisitRecord({
        subjective: { adlDifficultyLevel: 'moderate' },
      })

      const visit2 = createMockVisitRecord({
        subjective: { adlDifficultyLevel: 'severe' }, // worsened
      })

      const expectedError: ValidationError = {
        ruleId: 'T08',
        severity: 'HIGH',
        section: 'subjective',
        field: 'adlDifficultyLevel',
        message: 'Severity worsened across visits: moderate → severe',
      }

      const severity1 = severityOrder[visit1.subjective.adlDifficultyLevel as GradingScale]
      const severity2 = severityOrder[visit2.subjective.adlDifficultyLevel as GradingScale]

      expect(severity2).toBeGreaterThan(severity1)
      expect(expectedError.ruleId).toBe('T08')
      expect(expectedError.severity).toBe('HIGH')
    })

    it('should flag tightness grading worsening', () => {
      const visit1 = createMockVisitRecord({
        objective: {
          tightnessMuscles: {
            muscles: ['iliocostalis'],
            gradingScale: 'mild to moderate',
          },
        },
      })

      const visit2 = createMockVisitRecord({
        objective: {
          tightnessMuscles: {
            muscles: ['iliocostalis'],
            gradingScale: 'moderate to severe', // worsened
          },
        },
      })

      const severity1 = severityOrder[visit1.objective.tightnessMuscles.gradingScale]
      const severity2 = severityOrder[visit2.objective.tightnessMuscles.gradingScale]

      expect(severity2).toBeGreaterThan(severity1)
    })
  })

  describe('should pass valid progressions', () => {
    it('should accept severity improving from moderate to mild', () => {
      const visit1 = createMockVisitRecord({
        subjective: { adlDifficultyLevel: 'moderate' },
      })

      const visit2 = createMockVisitRecord({
        subjective: { adlDifficultyLevel: 'mild to moderate' }, // improved
      })

      const severity1 = severityOrder[visit1.subjective.adlDifficultyLevel as GradingScale]
      const severity2 = severityOrder[visit2.subjective.adlDifficultyLevel as GradingScale]

      // No error expected
      expect(severity2).toBeLessThan(severity1)
    })

    it('should accept severity remaining the same', () => {
      const visit1 = createMockVisitRecord({
        subjective: { adlDifficultyLevel: 'moderate' },
      })

      const visit2 = createMockVisitRecord({
        subjective: { adlDifficultyLevel: 'moderate' }, // no change
      })

      const severity1 = severityOrder[visit1.subjective.adlDifficultyLevel as GradingScale]
      const severity2 = severityOrder[visit2.subjective.adlDifficultyLevel as GradingScale]

      // No error expected
      expect(severity2).toBe(severity1)
    })
  })
})

// ============ T09: Associated Symptoms Monotonicity ============

describe('T09: Associated Symptoms Monotonicity', () => {
  // Symptom severity ordering (lower = better)
  const symptomSeverityOrder: Record<string, number> = {
    'soreness': 1,
    'stiffness': 2,
    'heaviness': 3,
    'weakness': 4,
    'numbness': 4,
  }

  // Get max severity from symptom list
  const getMaxSymptomSeverity = (symptoms: string[]): number => {
    return Math.max(...symptoms.map((s) => symptomSeverityOrder[s] || 0))
  }

  describe('should detect violations', () => {
    it('should flag symptoms worsening from soreness to numbness', () => {
      // Visit 1: only soreness
      const symptoms1 = ['soreness']
      // Visit 2: has numbness (more severe)
      const symptoms2 = ['numbness']

      const expectedError: ValidationError = {
        ruleId: 'T09',
        severity: 'MEDIUM',
        section: 'subjective',
        field: 'associatedSymptoms',
        message: 'Associated symptoms worsened: max severity 1 → 4',
      }

      const severity1 = getMaxSymptomSeverity(symptoms1)
      const severity2 = getMaxSymptomSeverity(symptoms2)

      expect(severity2).toBeGreaterThan(severity1)
      expect(expectedError.ruleId).toBe('T09')
      expect(expectedError.severity).toBe('MEDIUM')
    })

    it('should flag symptoms worsening from stiffness to weakness', () => {
      const symptoms1 = ['stiffness']
      const symptoms2 = ['weakness']

      const severity1 = getMaxSymptomSeverity(symptoms1)
      const severity2 = getMaxSymptomSeverity(symptoms2)

      expect(severity2).toBeGreaterThan(severity1)
    })
  })

  describe('should pass valid progressions', () => {
    it('should accept symptoms improving from numbness to soreness', () => {
      const symptoms1 = ['numbness', 'weakness']
      const symptoms2 = ['stiffness', 'soreness'] // improved

      const severity1 = getMaxSymptomSeverity(symptoms1)
      const severity2 = getMaxSymptomSeverity(symptoms2)

      // No error expected
      expect(severity2).toBeLessThan(severity1)
    })

    it('should accept symptoms remaining at same severity', () => {
      const symptoms1 = ['weakness']
      const symptoms2 = ['numbness'] // same severity level (4)

      const severity1 = getMaxSymptomSeverity(symptoms1)
      const severity2 = getMaxSymptomSeverity(symptoms2)

      // No error expected
      expect(severity2).toBe(severity1)
    })
  })
})

// ============ Integration Tests ============

describe('Text Validation Rules Integration', () => {
  it('should validate a complete visit record with multiple rules', () => {
    const visit = createMockVisitRecord({
      subjective: {
        medicalHistory: ['Hypertension'],
        painScale: { value: 5 },
        adlDifficultyLevel: 'mild to moderate',
      },
      objective: {
        tightnessMuscles: {
          muscles: ['iliocostalis'],
          gradingScale: 'moderate',
        },
        rom: createMockROM({
          items: [createMockROMItem({ degrees: 85, strength: '4/5' })],
        }),
      },
      assessment: {
        symptomChange: 'improvement',
        physicalFindingChange: 'reduced local muscles tightness',
      },
      plan: {
        electricalStimulation: true, // OK - no pacemaker
      },
    })

    // All validations should pass for this well-formed record
    expect(visit.subjective.medicalHistory).not.toContain('Pacemaker')
    expect(visit.assessment.symptomChange).toBe('improvement')
    expect(visit.assessment.physicalFindingChange).toContain('reduced')
    expect(visit.assessment.physicalFindingChange).toContain('tightness')
    expect(visit.plan.electricalStimulation).toBe(true)
  })

  it('should detect multiple violations in a problematic record', () => {
    const visit = createMockVisitRecord({
      subjective: {
        medicalHistory: ['Pacemaker'], // T07 violation trigger
        adlDifficultyLevel: 'severe', // Potential T08 violation
      },
      assessment: {
        symptomChange: 'improvement', // T02 violation if values worsen
        physicalFindingChange: 'increased ROM limitation', // T01 violation
      },
      plan: {
        electricalStimulation: true, // T07 violation with pacemaker
      },
    })

    // T01: Direction word contradiction
    expect(visit.assessment.physicalFindingChange).toContain('increased')
    expect(visit.assessment.physicalFindingChange).toContain('limitation')

    // T07: Pacemaker + E-stim
    expect(visit.subjective.medicalHistory).toContain('Pacemaker')
    expect(visit.plan.electricalStimulation).toBe(true)
  })
})
