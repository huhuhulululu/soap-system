import { describe, it, expect } from 'vitest'
import { deriveAssessmentFromSOA } from '../tx-sequence-engine'

const VALID_PRESENT = [
  'slight improvement of symptom(s).',
  'improvement of symptom(s).',
  'exacerbate of symptom(s).',
  'no change.'
]
const VALID_PATIENT_CHANGE = [
  'decreased', 'slightly decreased', 'increased', 'slight increased', 'remained the same'
]
const VALID_WHAT_CHANGED = [
  'pain', 'pain frequency', 'pain duration', 'numbness sensation',
  'muscles weakness', 'muscles soreness sensation', 'muscles stiffness sensation',
  'heaviness sensation', 'difficulty in performing ADLs', 'as last time visit'
]
const VALID_PHYSICAL_CHANGE = [
  'reduced', 'slightly reduced', 'increased', 'slight increased', 'remained the same'
]
const VALID_FINDING_TYPE = [
  'local muscles tightness', 'local muscles tenderness', 'local muscles spasms',
  'local muscles trigger points', 'joint ROM', 'joint ROM limitation',
  'muscles strength', 'joints swelling', 'last visit'
]

const baseInput = {
  painDelta: 0.5,
  adlDelta: 0.3,
  frequencyImproved: false,
  visitIndex: 3,
  objectiveTightnessTrend: 'slightly reduced' as const,
  objectiveTendernessTrend: 'stable' as const,
  objectiveSpasmTrend: 'stable' as const,
  objectiveRomTrend: 'slightly improved' as const,
  objectiveStrengthTrend: 'stable' as const,
  cumulativePainDrop: 2.0,
  progress: 0.5,
}

describe('deriveAssessmentFromSOA', () => {
  describe('ASS-01: specific improvements in whatChanged', () => {
    it('selects "pain frequency" when frequency improved (hard rule preserved)', () => {
      const result = deriveAssessmentFromSOA({ ...baseInput, frequencyImproved: true })
      expect(result.whatChanged).toBe('pain frequency')
    })

    it('selects ADL-related option when adlDelta is dominant', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        adlDelta: 0.8,
        painDelta: 0.2,
        frequencyImproved: false,
      })
      expect(['difficulty in performing ADLs', 'muscles soreness sensation', 'muscles stiffness sensation']).toContain(result.whatChanged)
    })

    it('selects objective-related option when objective trends are strong and pain/adl weak', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        painDelta: 0.1,
        adlDelta: 0.05,
        frequencyImproved: false,
        objectiveRomTrend: 'improved',
        objectiveTightnessTrend: 'reduced',
      })
      expect(['muscles stiffness sensation', 'muscles soreness sensation']).toContain(result.whatChanged)
    })

    it('falls back to "pain" when no strong signal', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        painDelta: 0.4,
        adlDelta: 0.1,
        frequencyImproved: false,
        objectiveRomTrend: 'stable',
        objectiveTightnessTrend: 'stable',
        objectiveStrengthTrend: 'stable',
      })
      expect(result.whatChanged).toBe('pain')
    })

    it('findingType uses "joint ROM" at late progress with cumulative evidence', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        objectiveRomTrend: 'improved',
        progress: 0.75,
        cumulativePainDrop: 3.0,
      })
      expect(result.findingType).toBe('joint ROM')
    })

    it('findingType uses "joint ROM limitation" at early progress', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        objectiveRomTrend: 'improved',
        progress: 0.2,
        cumulativePainDrop: 0.5,
      })
      expect(result.findingType).toBe('joint ROM limitation')
    })
  })

  describe('ASS-02: cumulative progress gates language strength', () => {
    it('uses "improvement" + "decreased" for high cumulative at late progress', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        cumulativePainDrop: 4.0,
        progress: 0.75,
        painDelta: 0.3,
      })
      expect(result.present).toBe('improvement of symptom(s).')
      expect(result.patientChange).toBe('decreased')
    })

    it('uses "slight improvement" + "slightly decreased" for low cumulative at early progress', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        cumulativePainDrop: 0.5,
        progress: 0.15,
        painDelta: 0.3,
      })
      expect(result.present).toBe('slight improvement of symptom(s).')
      expect(result.patientChange).toBe('slightly decreased')
    })

    it('strong visit-level delta upgrades to "improvement" regardless of cumulative', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        cumulativePainDrop: 1.0,
        progress: 0.2,
        painDelta: 0.8,
      })
      expect(result.present).toBe('improvement of symptom(s).')
      expect(result.patientChange).toBe('decreased')
    })

    it('mid-progress with moderate cumulative but weak visit delta uses "slight"', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        cumulativePainDrop: 2.0,
        progress: 0.45,
        painDelta: 0.2,
      })
      expect(result.present).toBe('slight improvement of symptom(s).')
      expect(result.patientChange).toBe('slightly decreased')
    })
  })

  describe('ASS-03: all values from template options', () => {
    it('all returned values are from valid template options across varied inputs', () => {
      const inputs = [
        baseInput,
        { ...baseInput, painDelta: 0, adlDelta: 0, cumulativePainDrop: 0, progress: 0.1 },
        { ...baseInput, painDelta: 1.5, cumulativePainDrop: 5, progress: 0.9 },
        { ...baseInput, frequencyImproved: true, progress: 0.3 },
        { ...baseInput, objectiveRomTrend: 'stable' as const, objectiveTightnessTrend: 'stable' as const, objectiveStrengthTrend: 'stable' as const, objectiveTendernessTrend: 'stable' as const, objectiveSpasmTrend: 'stable' as const },
        { ...baseInput, objectiveStrengthTrend: 'improved' as const },
        { ...baseInput, objectiveTendernessTrend: 'reduced' as const },
        { ...baseInput, objectiveSpasmTrend: 'reduced' as const },
      ]
      for (const input of inputs) {
        const result = deriveAssessmentFromSOA(input)
        expect(VALID_PRESENT).toContain(result.present)
        expect(VALID_PATIENT_CHANGE).toContain(result.patientChange)
        expect(VALID_WHAT_CHANGED).toContain(result.whatChanged)
        expect(VALID_PHYSICAL_CHANGE).toContain(result.physicalChange)
        expect(VALID_FINDING_TYPE).toContain(result.findingType)
      }
    })
  })

  describe('physicalChange and findingType edge cases', () => {
    it('all objective stable → "remained the same" + fallback findingType', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        objectiveRomTrend: 'stable',
        objectiveStrengthTrend: 'stable',
        objectiveTightnessTrend: 'stable',
        objectiveTendernessTrend: 'stable',
        objectiveSpasmTrend: 'stable',
      })
      expect(result.physicalChange).toBe('remained the same')
      expect(result.findingType).toBe('joint ROM limitation')
    })

    it('only slight objective improvement → "slightly reduced"', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        objectiveRomTrend: 'slightly improved',
        objectiveStrengthTrend: 'stable',
        objectiveTightnessTrend: 'stable',
        objectiveTendernessTrend: 'stable',
        objectiveSpasmTrend: 'stable',
      })
      expect(result.physicalChange).toBe('slightly reduced')
    })

    it('strength trend non-stable → findingType "muscles strength"', () => {
      const result = deriveAssessmentFromSOA({
        ...baseInput,
        objectiveRomTrend: 'stable',
        objectiveStrengthTrend: 'improved',
      })
      expect(result.findingType).toBe('muscles strength')
    })
  })
})
