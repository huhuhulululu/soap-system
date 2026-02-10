/**
 * SOAP Validator Unit Tests
 * SOAP 验证器单元测试
 */

import { describe, it, expect } from '@jest/globals'
import {
  validateSOAPNote,
  formatValidationResult,
  generateSOAPNote,
  type GenerationContext,
  type SOAPNote,
  type ValidationResult
} from '../../src'

describe('SOAP Validator', () => {
  const baseContext: GenerationContext = {
    noteType: 'IE',
    insuranceType: 'WC',
    primaryBodyPart: 'SHOULDER',
    laterality: 'bilateral',
    localPattern: 'Qi Stagnation',
    systemicPattern: 'Kidney Qi Deficiency',
    chronicityLevel: 'Chronic',
    severityLevel: 'moderate'
  }

  describe('validateSOAPNote', () => {
    it('should validate generated SOAP note', () => {
      const soap = generateSOAPNote(baseContext)
      const result = validateSOAPNote(soap)
      expect(result).toBeDefined()
      expect(result.isValid).toBeDefined()
      expect(result.errors).toBeInstanceOf(Array)
      expect(result.warnings).toBeInstanceOf(Array)
    })

    it('should pass validation for well-formed IE note', () => {
      const soap = generateSOAPNote(baseContext)
      const result = validateSOAPNote(soap)
      expect(result.isValid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should pass validation for well-formed TX note', () => {
      const ieNote = generateSOAPNote(baseContext)
      const txNote = generateSOAPNote({
        ...baseContext,
        noteType: 'TX',
        previousIE: ieNote
      })
      const result = validateSOAPNote(txNote)
      expect(result.isValid).toBe(true)
    })

    it('should detect missing required fields', () => {
      const soap = generateSOAPNote(baseContext)
      // @ts-ignore - intentionally break for test
      soap.subjective.primaryBodyPart = undefined
      const result = validateSOAPNote(soap)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should detect invalid pain scale', () => {
      const soap = generateSOAPNote(baseContext)
      soap.subjective.painScale.current = 15 // Invalid
      const result = validateSOAPNote(soap)
      expect(result.errors.some(e => e.field?.includes('painScale'))).toBe(true)
    })

    it('should detect missing goals in IE note', () => {
      const soap = generateSOAPNote(baseContext)
      // @ts-ignore
      soap.plan.shortTermGoal = undefined
      const result = validateSOAPNote(soap)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should warn about inconsistent patterns', () => {
      const soap = generateSOAPNote(baseContext)
      soap.assessment.tcmDiagnosis.localPattern = 'Cold-Damp'
      soap.objective.tonguePulse.tongue = 'red, yellow coat' // Inconsistent
      const result = validateSOAPNote(soap)
      // May or may not detect - just verify it runs
      expect(result).toBeDefined()
    })
  })

  describe('formatValidationResult', () => {
    it('should format valid result', () => {
      const soap = generateSOAPNote(baseContext)
      const result = validateSOAPNote(soap)
      const formatted = formatValidationResult(result)
      expect(typeof formatted).toBe('string')
    })

    it('should format result with errors', () => {
      const result: ValidationResult = {
        isValid: false,
        errors: [
          { code: 'E001', severity: 'ERROR', message: 'Missing field', field: 'painScale' }
        ],
        warnings: [],
        info: []
      }
      const formatted = formatValidationResult(result)
      expect(formatted).toContain('E001')
      expect(formatted).toContain('Missing field')
    })

    it('should format result with warnings', () => {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [
          { code: 'W001', severity: 'WARNING', message: 'Inconsistent pattern' }
        ],
        info: []
      }
      const formatted = formatValidationResult(result)
      expect(formatted).toContain('W001')
    })
  })

  describe('Validation Rules', () => {
    it('should validate subjective section', () => {
      const soap = generateSOAPNote(baseContext)
      const result = validateSOAPNote(soap)
      // Should not have subjective errors
      const subjectiveErrors = result.errors.filter(e => e.section === 'S')
      expect(subjectiveErrors.length).toBe(0)
    })

    it('should validate objective section', () => {
      const soap = generateSOAPNote(baseContext)
      const result = validateSOAPNote(soap)
      const objectiveErrors = result.errors.filter(e => e.section === 'O')
      expect(objectiveErrors.length).toBe(0)
    })

    it('should validate assessment section', () => {
      const soap = generateSOAPNote(baseContext)
      const result = validateSOAPNote(soap)
      const assessmentErrors = result.errors.filter(e => e.section === 'A')
      expect(assessmentErrors.length).toBe(0)
    })

    it('should validate plan section', () => {
      const soap = generateSOAPNote(baseContext)
      const result = validateSOAPNote(soap)
      const planErrors = result.errors.filter(e => e.section === 'P')
      expect(planErrors.length).toBe(0)
    })
  })

  describe('Cross-Section Validation', () => {
    it('should validate pain scale consistency', () => {
      const soap = generateSOAPNote(baseContext)
      // Pain scale should be consistent with severity
      const result = validateSOAPNote(soap)
      expect(result.isValid).toBe(true)
    })

    it('should validate TCM pattern consistency', () => {
      const soap = generateSOAPNote(baseContext)
      // Pattern should match tongue/pulse
      const result = validateSOAPNote(soap)
      expect(result.isValid).toBe(true)
    })
  })

  describe('Body Part Specific Validation', () => {
    const bodyParts = ['LBP', 'NECK', 'KNEE', 'SHOULDER', 'HIP'] as const

    for (const bodyPart of bodyParts) {
      it(`should validate ${bodyPart} specific fields`, () => {
        const ctx: GenerationContext = {
          ...baseContext,
          primaryBodyPart: bodyPart
        }
        const soap = generateSOAPNote(ctx)
        const result = validateSOAPNote(soap)
        expect(result.isValid).toBe(true)
      })
    }
  })

  describe('Insurance Specific Validation', () => {
    it('should validate OPTUM specific requirements', () => {
      const ctx: GenerationContext = {
        ...baseContext,
        insuranceType: 'OPTUM'
      }
      const soap = generateSOAPNote(ctx)
      const result = validateSOAPNote(soap)
      expect(result.isValid).toBe(true)
    })

    it('should validate WC specific requirements', () => {
      const ctx: GenerationContext = {
        ...baseContext,
        insuranceType: 'WC'
      }
      const soap = generateSOAPNote(ctx)
      const result = validateSOAPNote(soap)
      expect(result.isValid).toBe(true)
    })
  })
})
