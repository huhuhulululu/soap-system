/**
 * Shared Module Unit Tests
 * 验证 severity, tcm-mappings, adl-mappings 共享模块
 */
import { describe, it, expect } from 'vitest'
import { severityFromPain, expectedTenderMinScaleByPain } from '../../../../src/shared/severity'
import { isTonguePatternConsistent, isPainTypeConsistentWithPattern } from '../../../../src/shared/tcm-mappings'
import { isAdlConsistentWithBodyPart, ADL_ACTIVITIES } from '../../../../src/shared/adl-mappings'

describe('severity.ts', () => {
  describe('severityFromPain', () => {
    it('pain 9-10 → severe', () => {
      expect(severityFromPain(9)).toBe('severe')
      expect(severityFromPain(10)).toBe('severe')
    })
    it('pain 7-8 → moderate to severe', () => {
      expect(severityFromPain(8)).toMatch(/moderate|severe/)
      expect(severityFromPain(7)).toMatch(/moderate|severe/)
    })
    it('pain 4-6 → moderate', () => {
      expect(severityFromPain(6)).toMatch(/moderate/)
      expect(severityFromPain(5)).toMatch(/moderate/)
    })
    it('pain 1-3 → mild', () => {
      expect(severityFromPain(3)).toMatch(/mild/)
      expect(severityFromPain(1)).toMatch(/mild/)
    })
  })

  describe('expectedTenderMinScaleByPain', () => {
    it('high pain → high tenderness', () => {
      expect(expectedTenderMinScaleByPain(9)).toBeGreaterThanOrEqual(3)
      expect(expectedTenderMinScaleByPain(8)).toBeGreaterThanOrEqual(3)
    })
    it('low pain → lower tenderness', () => {
      expect(expectedTenderMinScaleByPain(3)).toBeLessThanOrEqual(3)
    })
    it('returns value between 1 and 4', () => {
      for (let p = 0; p <= 10; p++) {
        const t = expectedTenderMinScaleByPain(p)
        expect(t).toBeGreaterThanOrEqual(1)
        expect(t).toBeLessThanOrEqual(4)
      }
    })
  })
})

describe('tcm-mappings.ts', () => {
  describe('isTonguePatternConsistent', () => {
    it('Qi Stagnation + pale thin white coat + wiry → consistent', () => {
      expect(isTonguePatternConsistent('Qi Stagnation', 'pale, thin white coat', 'wiry')).toBe(true)
    })
    it('Blood Stasis + purple + choppy → consistent', () => {
      expect(isTonguePatternConsistent('Blood Stasis', 'purple, thin coat', 'choppy')).toBe(true)
    })
    it('Qi Stagnation + red yellow coat + rapid → inconsistent', () => {
      expect(isTonguePatternConsistent('Qi Stagnation', 'red, yellow coat', 'rapid')).toBe(false)
    })
  })

  describe('isPainTypeConsistentWithPattern', () => {
    it('Blood Stasis + Pricking → consistent', () => {
      const result = isPainTypeConsistentWithPattern('Blood Stasis', ['Pricking'])
      expect(result.consistent).toBe(true)
    })
    it('Blood Stasis + Dull only → inconsistent', () => {
      const result = isPainTypeConsistentWithPattern('Blood Stasis', ['Dull'])
      if (result.expected.length > 0) {
        expect(result.consistent).toBe(false)
      }
    })
    it('Qi Stagnation + Dull/Aching → consistent', () => {
      const result = isPainTypeConsistentWithPattern('Qi Stagnation', ['Dull', 'Aching'])
      expect(result.consistent).toBe(true)
    })
  })
})

describe('adl-mappings.ts', () => {
  describe('ADL_ACTIVITIES', () => {
    it('has entries for LBP, KNEE, SHOULDER, NECK', () => {
      expect(ADL_ACTIVITIES.LBP.length).toBeGreaterThan(0)
      expect(ADL_ACTIVITIES.KNEE.length).toBeGreaterThan(0)
      expect(ADL_ACTIVITIES.SHOULDER.length).toBeGreaterThan(0)
      expect(ADL_ACTIVITIES.NECK.length).toBeGreaterThan(0)
    })
  })

  describe('isAdlConsistentWithBodyPart', () => {
    it('LBP + Standing for long periods → consistent', () => {
      const result = isAdlConsistentWithBodyPart('LBP', 'difficulty with Standing for long periods of time')
      expect(result.consistent).toBe(true)
    })
    it('KNEE + Going up and down stairs → consistent', () => {
      const result = isAdlConsistentWithBodyPart('KNEE', 'difficulty with Going up and down stairs')
      expect(result.consistent).toBe(true)
    })
    it('SHOULDER + holding the pot → consistent', () => {
      const result = isAdlConsistentWithBodyPart('SHOULDER', 'difficulty with holding the pot for cooking')
      expect(result.consistent).toBe(true)
    })
    it('NECK + Tilting head → consistent', () => {
      const result = isAdlConsistentWithBodyPart('NECK', 'difficulty with Tilting head to talking the phone')
      expect(result.consistent).toBe(true)
    })
    it('LBP + generic text without keywords → inconsistent', () => {
      const result = isAdlConsistentWithBodyPart('LBP', 'some generic text')
      expect(result.consistent).toBe(false)
    })
    it('unknown bodyPart → consistent (no keywords)', () => {
      const result = isAdlConsistentWithBodyPart('UNKNOWN_BODY', 'anything')
      expect(result.consistent).toBe(true)
    })
  })
})
