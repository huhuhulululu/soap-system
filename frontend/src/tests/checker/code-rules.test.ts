/**
 * Code Rules Unit Tests (DX01-DX04, CPT01-CPT03)
 * 验证诊断编码和操作编码规则
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

describe('Diagnosis Code Rules', () => {
  describe('DX01: ICD matches bodyPart', () => {
    it('perfect document has no DX01 errors', () => {
      expect(errorsFor('DX01')).toHaveLength(0)
    })
    it('triggers when ICD does not match bodyPart', () => {
      expect(injectedErrors('DX01').length).toBeGreaterThan(0)
    })
  })

  describe('DX02: ICD consistent across visits', () => {
    it('perfect document has no DX02 errors', () => {
      expect(errorsFor('DX02')).toHaveLength(0)
    })
    it('triggers when ICD changes between visits', () => {
      expect(injectedErrors('DX02').length).toBeGreaterThan(0)
    })
  })

  describe('DX03: ICD codes present', () => {
    it('perfect document has no DX03 errors', () => {
      expect(errorsFor('DX03')).toHaveLength(0)
    })
    it('triggers when ICD codes missing', () => {
      expect(injectedErrors('DX03').length).toBeGreaterThan(0)
    })
  })

  describe('DX04: ICD laterality', () => {
    it('perfect bilateral document has no DX04 errors', () => {
      expect(errorsFor('DX04', { laterality: 'bilateral' })).toHaveLength(0)
    })
    it('perfect right-side document has no DX04 errors', () => {
      expect(errorsFor('DX04', { laterality: 'right' })).toHaveLength(0)
    })
    it('perfect left-side document has no DX04 errors', () => {
      expect(errorsFor('DX04', { laterality: 'left' })).toHaveLength(0)
    })
  })
})

describe('CPT Code Rules', () => {
  describe('CPT01: CPT codes present', () => {
    it('perfect document has no CPT01 errors', () => {
      expect(errorsFor('CPT01')).toHaveLength(0)
    })
    it('triggers when CPT codes missing', () => {
      expect(injectedErrors('CPT01').length).toBeGreaterThan(0)
    })
  })

  describe('CPT02: Electrical stimulation CPT match', () => {
    it('perfect document has no CPT02 errors', () => {
      expect(errorsFor('CPT02')).toHaveLength(0)
    })
    it('triggers when estim plan but no estim CPT', () => {
      expect(injectedErrors('CPT02').length).toBeGreaterThan(0)
    })
  })
})
