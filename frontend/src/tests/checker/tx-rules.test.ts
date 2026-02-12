/**
 * TX Rules Unit Tests (TX01-TX06, T02, T03, T06, T07)
 * 验证 Treatment Visit 规则的触发与通过
 */
import { describe, it, expect } from 'vitest'
import { generateDocument } from '../fixtures/generator'
import { checkDocument } from '../../../../parsers/optum-note/checker/note-checker'

function errorsFor(ruleId: string, config = {}) {
  const doc = generateDocument({ painStart: 8, bodyPart: 'LBP', ...config })
  const result = checkDocument({ document: doc })
  return result.errors.filter(e => e.ruleId === ruleId)
}

function injectedErrors(ruleId: string, config = {}) {
  const doc = generateDocument({ painStart: 8, bodyPart: 'LBP', ...config, injectErrors: [{ ruleId }] })
  const result = checkDocument({ document: doc })
  return result.errors.filter(e => e.ruleId === ruleId)
}

describe('TX Rules', () => {
  describe('TX01: ADL severity vs pain (TX visit)', () => {
    it('perfect document has no TX01 errors', () => {
      expect(errorsFor('TX01')).toHaveLength(0)
    })
    it('triggers when severity mismatch in TX visit', () => {
      expect(injectedErrors('TX01').length).toBeGreaterThan(0)
    })
  })

  describe('TX02: Tenderness vs pain (TX visit)', () => {
    it('perfect document has no TX02 errors', () => {
      expect(errorsFor('TX02')).toHaveLength(0)
    })
    it('triggers when tenderness too low in TX visit', () => {
      expect(injectedErrors('TX02').length).toBeGreaterThan(0)
    })
  })

  describe('TX03: Symptom change vs pain delta', () => {
    it('perfect document has no TX03 errors', () => {
      expect(errorsFor('TX03')).toHaveLength(0)
    })
    it('triggers when symptomChange contradicts pain delta', () => {
      expect(injectedErrors('TX03').length).toBeGreaterThan(0)
    })
  })

  describe('TX05: Tongue/pulse consistency across visits', () => {
    it('perfect document has no TX05 errors', () => {
      expect(errorsFor('TX05')).toHaveLength(0)
    })
    it('triggers when TX tongue/pulse differs from IE', () => {
      expect(injectedErrors('TX05').length).toBeGreaterThan(0)
    })
  })

  describe('TX06: Goals in TX visit (should not exist)', () => {
    it('perfect document has no TX06 errors', () => {
      expect(errorsFor('TX06')).toHaveLength(0)
    })
    it('triggers when TX visit contains goals', () => {
      expect(injectedErrors('TX06').length).toBeGreaterThan(0)
    })
  })
})

describe('T Rules (Text consistency)', () => {
  describe('T02: improvement + pain worsened', () => {
    it('perfect document has no T02 errors', () => {
      expect(errorsFor('T02')).toHaveLength(0)
    })
    it('triggers when improvement claimed but pain increased', () => {
      expect(injectedErrors('T02').length).toBeGreaterThan(0)
    })
  })

  describe('T03: exacerbate + pain improved', () => {
    it('perfect document has no T03 errors', () => {
      expect(errorsFor('T03')).toHaveLength(0)
    })
    it('triggers when exacerbate claimed but pain decreased', () => {
      expect(injectedErrors('T03').length).toBeGreaterThan(0)
    })
  })

  describe('T06: improvement + negative reason', () => {
    it('perfect document has no T06 errors', () => {
      expect(errorsFor('T06')).toHaveLength(0)
    })
    it('triggers when improvement with skipped treatments', () => {
      expect(injectedErrors('T06').length).toBeGreaterThan(0)
    })
  })

  describe('T07: Pacemaker + electrical stimulation', () => {
    it('perfect document has no T07 errors', () => {
      expect(errorsFor('T07')).toHaveLength(0)
    })
    it('triggers when pacemaker patient has electrical stim', () => {
      expect(injectedErrors('T07').length).toBeGreaterThan(0)
    })
  })
})
