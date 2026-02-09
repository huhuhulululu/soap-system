import type { SOAPNote } from '../../types'
import { validateSOAPNote, formatValidationResult } from '../soap-validator'

function makeValidNote(): SOAPNote {
  return {
    header: {
      patientId: 'P001',
      visitDate: '2026-02-08',
      noteType: 'IE',
      insuranceType: 'WC'
    },
    subjective: {
      visitType: 'INITIAL EVALUATION',
      chronicityLevel: 'Chronic',
      primaryBodyPart: { bodyPart: 'KNEE', laterality: 'bilateral' },
      secondaryBodyParts: [],
      painTypes: ['Stabbing', 'Aching'],
      painRadiation: 'without radiation',
      symptomDuration: { value: 3, unit: 'month(s)' },
      associatedSymptoms: ['soreness'],
      symptomPercentage: '70%',
      causativeFactors: ['age related/degenerative changes'],
      exacerbatingFactors: ['any strenuous activities'],
      relievingFactors: ['Resting'],
      adlDifficulty: {
        level: 'moderate',
        activities: ['Going up and down stairs']
      },
      activityChanges: ['decrease outside activity'],
      painScale: { worst: 8, best: 6, current: 7 },
      painFrequency: 'Constant (symptoms occur between 76% and 100% of the time)'
    },
    objective: {
      muscleTesting: {
        tightness: { muscles: ['Quadriceps'], gradingScale: 'moderate' },
        tenderness: { muscles: ['Quadriceps'], gradingScale: '+3' },
        spasm: { muscles: ['Quadriceps'], gradingScale: '+2' }
      },
      rom: [{ movement: 'Flexion', strength: '4-/5', degrees: '90 Degrees(moderate)' }],
      inspection: ['joint swelling'],
      tonguePulse: {
        tongue: 'purple',
        pulse: 'deep'
      }
    },
    assessment: {
      tcmDiagnosis: {
        localPattern: 'Blood Stasis',
        systemicPattern: 'Kidney Yang Deficiency',
        bodyPart: 'knee'
      },
      treatmentPrinciples: {
        focusOn: 'activating Blood circulation to dissipate blood stagnant',
        harmonize: 'Liver and Kidney',
        purpose: 'promote healthy joint'
      },
      evaluationArea: 'bilateral knee'
    },
    plan: {
      evaluationType: 'Initial Evaluation',
      contactTime: '60',
      steps: ['Greeting patient', 'Evaluation', 'Treatment'],
      shortTermGoal: {
        treatmentFrequency: 12,
        weeksDuration: '5-6',
        painScaleTarget: '5-6',
        symptomTargets: [{ symptom: 'soreness', targetValue: '70%' }]
      },
      longTermGoal: {
        treatmentFrequency: 8,
        weeksDuration: '5-6',
        painScaleTarget: '3',
        symptomTargets: [{ symptom: 'soreness', targetValue: '50%' }]
      },
      needleProtocol: {
        needleSizes: ['34#x1"', '30#x1.5"'],
        totalTime: 60,
        sections: []
      }
    },
    diagnosisCodes: [
      { icd10: 'M25.569', description: 'Knee pain', bodyPart: 'KNEE', laterality: 'bilateral' }
    ],
    procedureCodes: [
      { cpt: '97810', description: 'Acupuncture, initial 15 min', units: 1, electricalStimulation: false }
    ]
  }
}

describe('soap-validator (template boundary)', () => {
  it('passes a valid note', () => {
    const result = validateSOAPNote(makeValidNote())
    expect(result.isValid).toBe(true)
    expect(result.errors.length).toBe(0)
  })

  it('fails when pain scale worst is lower than current', () => {
    const note = makeValidNote()
    note.subjective.painScale = { worst: 5, best: 3, current: 7 }

    const result = validateSOAPNote(note)
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.code === 'S004')).toBe(true)
  })

  it('fails HF note with unsupported CPT code', () => {
    const note = makeValidNote()
    note.header.insuranceType = 'HF'
    note.procedureCodes = [
      { cpt: '97811', description: 'Acupuncture, additional 15 min', units: 1, electricalStimulation: false }
    ]

    const result = validateSOAPNote(note)
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.code === 'P005')).toBe(true)
  })

  it('formats validation result text', () => {
    const note = makeValidNote()
    note.subjective.painScale = { worst: 5, best: 3, current: 7 }
    const result = validateSOAPNote(note)
    const formatted = formatValidationResult(result)

    expect(formatted).toContain('验证失败')
    expect(formatted).toContain('S004')
  })
})

