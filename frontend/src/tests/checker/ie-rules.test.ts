/**
 * IE Rules Unit Tests (IE01-IE08)
 * 验证 Initial Evaluation 规则的触发与通过
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

describe('IE Rules', () => {
  describe('IE01: ADL severity vs pain', () => {
    it('perfect document has no IE01 errors', () => {
      expect(errorsFor('IE01')).toHaveLength(0)
    })
    it('triggers when severity too low for pain', () => {
      expect(injectedErrors('IE01').length).toBeGreaterThan(0)
    })
  })

  describe('IE02: Tenderness vs pain', () => {
    it('perfect document has no IE02 errors', () => {
      expect(errorsFor('IE02')).toHaveLength(0)
    })
    it('triggers when tenderness too low', () => {
      expect(injectedErrors('IE02').length).toBeGreaterThan(0)
    })
  })

  describe('IE04: Tongue/pulse vs pattern', () => {
    it('perfect document has no IE04 errors', () => {
      expect(errorsFor('IE04')).toHaveLength(0)
    })
    it('triggers when tongue/pulse mismatch pattern', () => {
      expect(injectedErrors('IE04').length).toBeGreaterThan(0)
    })
  })

  describe('IE05: Short-term goal pain target', () => {
    it('perfect document has no IE05 errors', () => {
      expect(errorsFor('IE05')).toHaveLength(0)
    })
    it('triggers when ST goal >= current pain', () => {
      expect(injectedErrors('IE05').length).toBeGreaterThan(0)
    })
  })

  describe('IE06: Long-term goal vs short-term goal', () => {
    it('perfect document has no IE06 errors', () => {
      expect(errorsFor('IE06')).toHaveLength(0)
    })
    it('triggers when LT goal >= ST goal', () => {
      expect(injectedErrors('IE06').length).toBeGreaterThan(0)
    })
  })

  describe('IE07: TCM diagnosis present', () => {
    it('perfect document has no IE07 errors', () => {
      expect(errorsFor('IE07')).toHaveLength(0)
    })
    it('triggers when tcmDiagnosis missing', () => {
      expect(injectedErrors('IE07').length).toBeGreaterThan(0)
    })
  })

  describe('IE08: Acupoints present', () => {
    it('perfect document has no IE08 errors', () => {
      expect(errorsFor('IE08')).toHaveLength(0)
    })
    it('triggers when acupoints empty', () => {
      expect(injectedErrors('IE08').length).toBeGreaterThan(0)
    })
  })

  describe('Cross-body-part IE validation', () => {
    const bodyParts = ['LBP', 'KNEE', 'SHOULDER', 'NECK'] as const
    for (const bp of bodyParts) {
      it(`perfect ${bp} document has no IE errors`, () => {
        const doc = generateDocument({ painStart: 8, bodyPart: bp })
        const result = checkDocument({ document: doc })
        const ieErrors = result.errors.filter(e => e.ruleId.startsWith('IE'))
        expect(ieErrors).toHaveLength(0)
      })
    }
  })
})
