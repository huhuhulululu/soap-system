import type { GenerationContext, SOAPNote } from '../../types'
import { generateTXSequenceStates } from '../tx-sequence-engine'

function createPreviousIE(currentPain: number = 8, shortTermGoal: string = '5-6'): SOAPNote {
  return {
    header: {
      patientId: 'P001',
      visitDate: '2026-02-08',
      noteType: 'IE',
      insuranceType: 'WC',
      visitNumber: 1
    },
    subjective: {
      visitType: 'INITIAL EVALUATION',
      chronicityLevel: 'Chronic',
      primaryBodyPart: { bodyPart: 'SHOULDER', laterality: 'bilateral' },
      secondaryBodyParts: [],
      painTypes: ['Aching'],
      painRadiation: 'without radiation',
      symptomDuration: { value: 2, unit: 'year(s)' },
      associatedSymptoms: ['soreness'],
      symptomPercentage: '70%',
      causativeFactors: ['age related/degenerative changes'],
      exacerbatingFactors: ['any strenuous activities'],
      relievingFactors: ['resting'],
      adlDifficulty: { level: 'moderate', activities: ['performing household chores'] },
      activityChanges: [],
      painScale: { worst: currentPain, best: currentPain - 2, current: currentPain },
      painFrequency: 'Constant (symptoms occur between 76% and 100% of the time)'
    },
    objective: {
      muscleTesting: {
        tightness: { muscles: ['upper trapezius'], gradingScale: 'moderate' },
        tenderness: { muscles: ['upper trapezius'], gradingScale: '(+2) = Patient states that the area is moderately tender' },
        spasm: { muscles: ['upper trapezius'], gradingScale: '(+2)=>2 but < 5 spontaneous spasms per hour.' }
      },
      rom: [{ movement: 'Abduction', strength: '4-/5', degrees: '120 degree(moderate)' }],
      inspection: ['weak muscles and dry skin without luster'],
      tonguePulse: { tongue: 'thin white coat', pulse: 'string-taut' }
    },
    assessment: {
      tcmDiagnosis: { localPattern: 'Qi Stagnation', systemicPattern: 'Kidney Qi Deficiency', bodyPart: 'shoulder' },
      treatmentPrinciples: { focusOn: 'focus', harmonize: 'Liver and Kidney', purpose: 'promote good essence' },
      evaluationArea: 'shoulder'
    },
    plan: {
      evaluationType: 'Initial Evaluation',
      contactTime: '20-30 mins',
      steps: [],
      shortTermGoal: {
        treatmentFrequency: 12,
        weeksDuration: '5-6 weeks',
        painScaleTarget: shortTermGoal,
        symptomTargets: []
      },
      longTermGoal: {
        treatmentFrequency: 8,
        weeksDuration: '5-6 weeks',
        painScaleTarget: '3-4',
        symptomTargets: []
      },
      needleProtocol: {
        needleSizes: ['30#x1.5"'],
        totalTime: 60,
        sections: []
      }
    },
    diagnosisCodes: [],
    procedureCodes: []
  }
}

describe('tx-sequence-engine', () => {
  const baseContext: GenerationContext = {
    noteType: 'TX',
    insuranceType: 'WC',
    primaryBodyPart: 'SHOULDER',
    laterality: 'bilateral',
    localPattern: 'Qi Stagnation',
    systemicPattern: 'Kidney Qi Deficiency',
    chronicityLevel: 'Chronic',
    severityLevel: 'moderate',
    previousIE: createPreviousIE()
  }

  it('generates improvement-only symptom change across TX sequence', () => {
    const visits = generateTXSequenceStates(baseContext, { txCount: 5, seed: 7 })
    expect(visits).toHaveLength(5)
    visits.forEach(v => {
      expect(v.symptomChange).toBe('improvement of symptom(s)')
    })
  })

  it('moves pain trend toward short-term goal without worsening between visits', () => {
    const visits = generateTXSequenceStates(baseContext, { txCount: 6, seed: 11 })
    const target = 5.5

    for (let i = 1; i < visits.length; i++) {
      expect(visits[i].painScaleCurrent).toBeLessThanOrEqual(visits[i - 1].painScaleCurrent)
    }

    const firstDistance = Math.abs(visits[0].painScaleCurrent - target)
    const lastDistance = Math.abs(visits[visits.length - 1].painScaleCurrent - target)
    expect(lastDistance).toBeLessThanOrEqual(firstDistance)
  })

  it('keeps longitudinal progress non-decreasing', () => {
    const visits = generateTXSequenceStates(baseContext, { txCount: 8, seed: 12 })
    for (let i = 1; i < visits.length; i++) {
      expect(visits[i].progress).toBeGreaterThanOrEqual(visits[i - 1].progress)
    }
  })

  it('keeps bilateral side progress misaligned', () => {
    const visits = generateTXSequenceStates(baseContext, { txCount: 4, seed: 21 })
    const hasAsymmetry = visits.some(v => {
      if (!v.sideProgress) return false
      return Math.abs(v.sideProgress.left - v.sideProgress.right) > 0.01
    })
    expect(hasAsymmetry).toBe(true)
  })

  it('injects non-repeatable objective factors per visit', () => {
    const visits = generateTXSequenceStates(baseContext, { txCount: 5, seed: 99 })
    expect(visits).toHaveLength(5)

    visits.forEach(v => {
      expect(v.objectiveFactors.sessionGapDays).toBeGreaterThanOrEqual(1)
      expect(v.objectiveFactors.sessionGapDays).toBeLessThanOrEqual(8)
      expect(v.objectiveFactors.sleepLoad).toBeGreaterThanOrEqual(0)
      expect(v.objectiveFactors.sleepLoad).toBeLessThanOrEqual(1)
      expect(v.objectiveFactors.workloadLoad).toBeGreaterThanOrEqual(0)
      expect(v.objectiveFactors.workloadLoad).toBeLessThanOrEqual(1)
      expect(v.objectiveFactors.weatherExposureLoad).toBeGreaterThanOrEqual(0)
      expect(v.objectiveFactors.weatherExposureLoad).toBeLessThanOrEqual(1)
      expect(v.objectiveFactors.adherenceLoad).toBeGreaterThanOrEqual(0)
      expect(v.objectiveFactors.adherenceLoad).toBeLessThanOrEqual(1)
    })

    const uniqueFactorSets = new Set(
      visits.map(v => JSON.stringify(v.objectiveFactors))
    )
    expect(uniqueFactorSets.size).toBeGreaterThan(1)
  })

  it('keeps S -> O -> A chain aligned for each visit', () => {
    const visits = generateTXSequenceStates(baseContext, { txCount: 5, seed: 5 })

    visits.forEach(v => {
      expect(v.soaChain.subjective.painChange).toBe('improved')
      expect(v.soaChain.subjective.adlChange).toBe('improved')

      expect(v.soaChain.assessment.present.toLowerCase()).toContain('improvement')
      expect(
        ['decreased', 'slightly decreased'].some(k =>
          v.soaChain.assessment.patientChange.toLowerCase().includes(k)
        )
      ).toBe(true)

      const changedByPainOrAdl = ['pain', 'difficulty in performing adls', 'pain frequency'].some(k =>
        v.soaChain.assessment.whatChanged.toLowerCase().includes(k)
      )
      expect(changedByPainOrAdl).toBe(true)

      const physicalSynced = ['reduced', 'slightly reduced', 'remained the same'].some(k =>
        v.soaChain.assessment.physicalChange.toLowerCase().includes(k)
      )
      expect(physicalSynced).toBe(true)

      if (v.soaChain.subjective.frequencyChange === 'improved') {
        expect(v.soaChain.assessment.whatChanged.toLowerCase()).toContain('pain frequency')
      }
    })
  })

  it('keeps associated symptom non-worsening through visits', () => {
    const visits = generateTXSequenceStates(baseContext, { txCount: 6, seed: 42 })

    const symptomRank = (symptom: string): number => {
      const s = symptom.toLowerCase()
      if (s.includes('numbness') || s.includes('weakness')) return 4
      if (s.includes('heaviness')) return 3
      if (s.includes('stiffness')) return 2
      if (s.includes('soreness')) return 1
      return 2
    }

    for (let i = 1; i < visits.length; i++) {
      const prev = symptomRank(visits[i - 1].associatedSymptom)
      const cur = symptomRank(visits[i].associatedSymptom)
      expect(cur).toBeLessThanOrEqual(prev)
    }
  })
})
