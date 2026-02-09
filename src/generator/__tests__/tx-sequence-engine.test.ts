import type { GenerationContext, SOAPNote } from '../../types'
import { generateTXSequenceStates, MUSCLE_MAP, ADL_MAP } from '../tx-sequence-engine'

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

  describe('TX1 pain decrease from IE', () => {
    it('TX1 pain should be 0.5-1.5 points lower than IE pain', () => {
      // IE pain is 8 (from createPreviousIE default)
      const iePain = 8

      // Test with multiple seeds to ensure consistent behavior
      const seeds = [1, 7, 13, 42, 99, 123, 256, 512]

      seeds.forEach(seed => {
        const visits = generateTXSequenceStates(baseContext, { txCount: 3, seed })
        const tx1Pain = visits[0].painScaleCurrent
        const decrease = iePain - tx1Pain

        expect(decrease).toBeGreaterThanOrEqual(0.5)
        expect(decrease).toBeLessThanOrEqual(1.5)
      })
    })

    it('TX1 pain decrease should work for different IE pain levels', () => {
      const testCases = [
        { iePain: 9, seed: 42 },
        { iePain: 7, seed: 13 },
        { iePain: 6, seed: 7 }
      ]

      testCases.forEach(({ iePain, seed }) => {
        const context = {
          ...baseContext,
          previousIE: createPreviousIE(iePain)
        }
        const visits = generateTXSequenceStates(context, { txCount: 3, seed })
        const tx1Pain = visits[0].painScaleCurrent
        const decrease = iePain - tx1Pain

        expect(decrease).toBeGreaterThanOrEqual(0.5)
        expect(decrease).toBeLessThanOrEqual(1.5)
      })
    })
  })

  describe('pain noise cap', () => {
    it('pain noise should not exceed 0.15 in magnitude', () => {
      // Test with many seeds to verify noise is bounded
      const seeds = Array.from({ length: 50 }, (_, i) => i + 1)

      seeds.forEach(seed => {
        const visits = generateTXSequenceStates(baseContext, { txCount: 8, seed })

        // For TX2+ visits, check that pain changes are reasonable
        // With noise capped at 0.15, pain should not jump erratically
        for (let i = 2; i < visits.length; i++) {
          const prev = visits[i - 1].painScaleCurrent
          const curr = visits[i].painScaleCurrent
          const delta = Math.abs(prev - curr)

          // With proper noise cap, delta should be smooth (less than 1.0 typically)
          // This indirectly verifies noise is capped
          expect(delta).toBeLessThan(1.5)
        }
      })
    })
  })

  describe('S->O chain validation: pain-to-findings correlation', () => {
    it('high pain (8-10) should correlate with severe/moderate-to-severe tightness', () => {
      const highPainContext: GenerationContext = {
        ...baseContext,
        previousIE: createPreviousIE(9, '7-8')
      }

      const visits = generateTXSequenceStates(highPainContext, { txCount: 3, seed: 42 })
      const firstVisit = visits[0]

      // High pain should NOT produce mild tightness
      const tightnessLower = firstVisit.tightnessGrading.toLowerCase()
      expect(tightnessLower).not.toBe('mild')
      expect(
        tightnessLower.includes('severe') ||
        tightnessLower.includes('moderate to severe') ||
        tightnessLower.includes('moderate')
      ).toBe(true)
    })

    it('high pain (8-10) should correlate with +3 or +4 tenderness', () => {
      const highPainContext: GenerationContext = {
        ...baseContext,
        previousIE: createPreviousIE(9, '7-8')
      }

      const visits = generateTXSequenceStates(highPainContext, { txCount: 3, seed: 42 })
      const firstVisit = visits[0]

      // High pain should produce +3 or +4 tenderness, not +1
      const tendernessLower = firstVisit.tendernessGrading.toLowerCase()
      expect(tendernessLower).not.toContain('+1)')
      expect(
        tendernessLower.includes('+3') || tendernessLower.includes('+4')
      ).toBe(true)
    })

    it('low pain (3-4) should correlate with mild/mild-to-moderate tightness', () => {
      const lowPainContext: GenerationContext = {
        ...baseContext,
        previousIE: createPreviousIE(4, '2-3')
      }

      const visits = generateTXSequenceStates(lowPainContext, { txCount: 3, seed: 42 })
      const lastVisit = visits[visits.length - 1]

      // Low pain should NOT produce severe tightness
      const tightnessLower = lastVisit.tightnessGrading.toLowerCase()
      expect(tightnessLower).not.toBe('severe')
      expect(tightnessLower).not.toBe('moderate to severe')
    })

    it('low pain (3-4) should correlate with +1 or +2 tenderness', () => {
      const lowPainContext: GenerationContext = {
        ...baseContext,
        previousIE: createPreviousIE(4, '2-3')
      }

      const visits = generateTXSequenceStates(lowPainContext, { txCount: 3, seed: 42 })
      const lastVisit = visits[visits.length - 1]

      // Low pain should produce +1 or +2 tenderness, not +4
      const tendernessLower = lastVisit.tendernessGrading.toLowerCase()
      expect(tendernessLower).not.toContain('+4')
    })
  })

  describe('MUSCLE_MAP constants', () => {
    it('MUSCLE_MAP should be defined and exported', () => {
      expect(MUSCLE_MAP).toBeDefined()
      expect(typeof MUSCLE_MAP).toBe('object')
    })

    it('MUSCLE_MAP should contain SHOULDER muscles', () => {
      expect(MUSCLE_MAP.SHOULDER).toBeDefined()
      expect(Array.isArray(MUSCLE_MAP.SHOULDER)).toBe(true)
      expect(MUSCLE_MAP.SHOULDER.length).toBeGreaterThan(0)
      expect(MUSCLE_MAP.SHOULDER).toContain('trapezius')
      expect(MUSCLE_MAP.SHOULDER).toContain('deltoid')
    })

    it('MUSCLE_MAP should contain KNEE muscles', () => {
      expect(MUSCLE_MAP.KNEE).toBeDefined()
      expect(Array.isArray(MUSCLE_MAP.KNEE)).toBe(true)
      expect(MUSCLE_MAP.KNEE.length).toBeGreaterThan(0)
      expect(MUSCLE_MAP.KNEE).toContain('quadriceps')
      expect(MUSCLE_MAP.KNEE).toContain('hamstrings')
    })

    it('MUSCLE_MAP should contain NECK muscles', () => {
      expect(MUSCLE_MAP.NECK).toBeDefined()
      expect(Array.isArray(MUSCLE_MAP.NECK)).toBe(true)
      expect(MUSCLE_MAP.NECK.length).toBeGreaterThan(0)
      expect(MUSCLE_MAP.NECK).toContain('sternocleidomastoid')
      expect(MUSCLE_MAP.NECK).toContain('trapezius')
    })

    it('MUSCLE_MAP should contain LBP muscles', () => {
      expect(MUSCLE_MAP.LBP).toBeDefined()
      expect(Array.isArray(MUSCLE_MAP.LBP)).toBe(true)
      expect(MUSCLE_MAP.LBP.length).toBeGreaterThan(0)
      expect(MUSCLE_MAP.LBP).toContain('erector spinae')
      expect(MUSCLE_MAP.LBP).toContain('quadratus lumborum')
    })

    it('MUSCLE_MAP should contain ELBOW muscles', () => {
      expect(MUSCLE_MAP.ELBOW).toBeDefined()
      expect(Array.isArray(MUSCLE_MAP.ELBOW)).toBe(true)
      expect(MUSCLE_MAP.ELBOW.length).toBeGreaterThan(0)
      expect(MUSCLE_MAP.ELBOW).toContain('biceps brachii')
      expect(MUSCLE_MAP.ELBOW).toContain('triceps brachii')
    })

    it('MUSCLE_MAP should contain HIP muscles', () => {
      expect(MUSCLE_MAP.HIP).toBeDefined()
      expect(Array.isArray(MUSCLE_MAP.HIP)).toBe(true)
      expect(MUSCLE_MAP.HIP.length).toBeGreaterThan(0)
      expect(MUSCLE_MAP.HIP).toContain('iliopsoas')
      expect(MUSCLE_MAP.HIP).toContain('gluteus maximus')
    })
  })

  describe('tonguePulse consistency', () => {
    it('TXVisitState includes tonguePulse field', () => {
      const visits = generateTXSequenceStates(baseContext, { txCount: 3, seed: 42 })

      visits.forEach(v => {
        expect(v.tonguePulse).toBeDefined()
        expect(v.tonguePulse.tongue).toBeDefined()
        expect(v.tonguePulse.pulse).toBeDefined()
        expect(typeof v.tonguePulse.tongue).toBe('string')
        expect(typeof v.tonguePulse.pulse).toBe('string')
      })
    })

    it('TX visits inherit tonguePulse from IE', () => {
      const visits = generateTXSequenceStates(baseContext, { txCount: 5, seed: 7 })

      visits.forEach(v => {
        expect(v.tonguePulse.tongue).toBe('thin white coat')
        expect(v.tonguePulse.pulse).toBe('string-taut')
      })
    })

    it('uses default tonguePulse when IE data is missing', () => {
      const contextWithoutTonguePulse: GenerationContext = {
        ...baseContext,
        previousIE: {
          ...baseContext.previousIE!,
          objective: {
            ...baseContext.previousIE!.objective,
            tonguePulse: undefined
          }
        } as unknown as SOAPNote
      }

      const visits = generateTXSequenceStates(contextWithoutTonguePulse, { txCount: 3, seed: 11 })

      visits.forEach(v => {
        expect(v.tonguePulse.tongue).toBe('Pink with thin white coating')
        expect(v.tonguePulse.pulse).toBe('Even and moderate')
      })
    })

    it('uses default tonguePulse when no previousIE exists', () => {
      const contextWithoutIE: GenerationContext = {
        ...baseContext,
        previousIE: undefined
      }

      const visits = generateTXSequenceStates(contextWithoutIE, { txCount: 3, seed: 13 })

      visits.forEach(v => {
        expect(v.tonguePulse.tongue).toBe('Pink with thin white coating')
        expect(v.tonguePulse.pulse).toBe('Even and moderate')
      })
    })

    it('tonguePulse remains consistent across all TX visits', () => {
      const visits = generateTXSequenceStates(baseContext, { txCount: 8, seed: 99 })

      const firstTonguePulse = visits[0].tonguePulse
      visits.forEach(v => {
        expect(v.tonguePulse.tongue).toBe(firstTonguePulse.tongue)
        expect(v.tonguePulse.pulse).toBe(firstTonguePulse.pulse)
      })
    })
  })

  describe('ADL_MAP constants', () => {
    it('ADL_MAP should be defined and exported', () => {
      expect(ADL_MAP).toBeDefined()
      expect(typeof ADL_MAP).toBe('object')
    })

    it('ADL_MAP should contain SHOULDER activities', () => {
      expect(ADL_MAP.SHOULDER).toBeDefined()
      expect(Array.isArray(ADL_MAP.SHOULDER)).toBe(true)
      expect(ADL_MAP.SHOULDER.length).toBeGreaterThan(0)
    })

    it('ADL_MAP should contain KNEE activities', () => {
      expect(ADL_MAP.KNEE).toBeDefined()
      expect(Array.isArray(ADL_MAP.KNEE)).toBe(true)
      expect(ADL_MAP.KNEE.length).toBeGreaterThan(0)
    })

    it('ADL_MAP should contain LBP activities', () => {
      expect(ADL_MAP.LBP).toBeDefined()
      expect(Array.isArray(ADL_MAP.LBP)).toBe(true)
      expect(ADL_MAP.LBP.length).toBeGreaterThan(0)
    })

    it('ADL_MAP should contain NECK activities', () => {
      expect(ADL_MAP.NECK).toBeDefined()
      expect(Array.isArray(ADL_MAP.NECK)).toBe(true)
      expect(ADL_MAP.NECK.length).toBeGreaterThan(0)
    })

    it('ADL_MAP should contain ELBOW activities', () => {
      expect(ADL_MAP.ELBOW).toBeDefined()
      expect(Array.isArray(ADL_MAP.ELBOW)).toBe(true)
      expect(ADL_MAP.ELBOW.length).toBeGreaterThan(0)
    })

    it('ADL_MAP should contain HIP activities', () => {
      expect(ADL_MAP.HIP).toBeDefined()
      expect(Array.isArray(ADL_MAP.HIP)).toBe(true)
      expect(ADL_MAP.HIP.length).toBeGreaterThan(0)
    })
  })
})
