/**
 * SOAP Generator Unit Tests
 * SOAP 生成器单元测试
 */

import { describe, it, expect, beforeAll } from '@jest/globals'
import {
  generateSOAPNote,
  exportSOAPAsText,
  type GenerationContext,
  type SOAPNote
} from '../../src'

describe('SOAP Generator', () => {
  const baseIEContext: GenerationContext = {
    noteType: 'IE',
    insuranceType: 'WC',
    primaryBodyPart: 'SHOULDER',
    laterality: 'bilateral',
    localPattern: 'Qi Stagnation',
    systemicPattern: 'Kidney Qi Deficiency',
    chronicityLevel: 'Chronic',
    severityLevel: 'moderate'
  }

  describe('generateSOAPNote (IE)', () => {
    it('should generate complete IE SOAP note', () => {
      const soap = generateSOAPNote(baseIEContext)
      expect(soap.header.noteType).toBe('IE')
      expect(soap.subjective).toBeDefined()
      expect(soap.objective).toBeDefined()
      expect(soap.assessment).toBeDefined()
      expect(soap.plan).toBeDefined()
    })

    it('should include short-term and long-term goals', () => {
      const soap = generateSOAPNote(baseIEContext)
      expect(soap.plan.shortTermGoal).toBeDefined()
      expect(soap.plan.longTermGoal).toBeDefined()
      expect(soap.plan.shortTermGoal.treatmentFrequency).toBeGreaterThan(0)
    })

    it('should generate needle protocol', () => {
      const soap = generateSOAPNote(baseIEContext)
      expect(soap.plan.needleProtocol).toBeDefined()
      expect(soap.plan.needleProtocol.needleSizes.length).toBeGreaterThan(0)
      expect(soap.plan.needleProtocol.totalTime).toBeGreaterThan(0)
    })

    it('should set correct body part', () => {
      const soap = generateSOAPNote(baseIEContext)
      expect(soap.subjective.primaryBodyPart.bodyPart).toBe('SHOULDER')
      expect(soap.subjective.primaryBodyPart.laterality).toBe('bilateral')
    })

    it('should set correct severity', () => {
      const soap = generateSOAPNote(baseIEContext)
      expect(soap.subjective.adlDifficulty.level).toBe('moderate')
    })
  })

  describe('generateSOAPNote (TX)', () => {
    let ieNote: SOAPNote

    beforeAll(() => {
      ieNote = generateSOAPNote(baseIEContext)
    })

    it('should generate TX SOAP note with correct type', () => {
      const txContext: GenerationContext = {
        ...baseIEContext,
        noteType: 'TX',
        previousIE: ieNote
      }
      const soap = generateSOAPNote(txContext)
      expect(soap.header.noteType).toBe('TX')
      expect(soap.subjective.visitType).toBe('Follow up visit')
      // TX notes may or may not have goals depending on implementation
      expect(soap.plan).toBeDefined()
    })
  })

  describe('exportSOAPAsText', () => {
    it('should export IE SOAP note as text', () => {
      const text = exportSOAPAsText(baseIEContext)
      expect(typeof text).toBe('string')
      expect(text.length).toBeGreaterThan(100)
    })

    it('should include all sections', () => {
      const text = exportSOAPAsText(baseIEContext)
      expect(text).toContain('Subjective')
      expect(text).toContain('Objective')
      expect(text).toContain('Assessment')
      expect(text).toContain('Plan')
    })

    it('should export TX SOAP note as text', () => {
      const ieNote = generateSOAPNote(baseIEContext)
      const txContext: GenerationContext = {
        ...baseIEContext,
        noteType: 'TX',
        previousIE: ieNote
      }
      const text = exportSOAPAsText(txContext)
      expect(text).toContain('Subjective')
    })
  })

  describe('Body Part Variations', () => {
    const bodyParts = ['LBP', 'NECK', 'KNEE', 'SHOULDER'] as const

    for (const bodyPart of bodyParts) {
      it(`should generate SOAP for ${bodyPart}`, () => {
        const ctx: GenerationContext = {
          ...baseIEContext,
          primaryBodyPart: bodyPart
        }
        const soap = generateSOAPNote(ctx)
        expect(soap.subjective.primaryBodyPart.bodyPart).toBe(bodyPart)
      })
    }
  })

  describe('Laterality Variations', () => {
    const lateralities = ['left', 'right', 'bilateral'] as const

    for (const laterality of lateralities) {
      it(`should generate SOAP for ${laterality}`, () => {
        const ctx: GenerationContext = {
          ...baseIEContext,
          laterality
        }
        const soap = generateSOAPNote(ctx)
        expect(soap.subjective.primaryBodyPart.laterality).toBe(laterality)
      })
    }
  })

  describe('Severity Variations', () => {
    const severities = ['mild', 'moderate', 'severe'] as const

    for (const severity of severities) {
      it(`should generate SOAP for ${severity} severity`, () => {
        const ctx: GenerationContext = {
          ...baseIEContext,
          severityLevel: severity
        }
        const soap = generateSOAPNote(ctx)
        expect(soap.subjective.adlDifficulty.level).toBe(severity)
      })
    }
  })

  describe('Insurance Variations', () => {
    const insurances = ['WC', 'OPTUM', 'HF'] as const

    for (const insurance of insurances) {
      it(`should generate SOAP for ${insurance} insurance`, () => {
        const ctx: GenerationContext = {
          ...baseIEContext,
          insuranceType: insurance
        }
        const soap = generateSOAPNote(ctx)
        expect(soap.header.insuranceType).toBe(insurance)
      })
    }
  })

  describe('Pacemaker Contraindication', () => {
    it('should not use electrical stimulation with pacemaker', () => {
      const ctx: GenerationContext = {
        ...baseIEContext,
        hasPacemaker: true
      }
      const soap = generateSOAPNote(ctx)
      // Check needle protocol sections
      for (const section of soap.plan.needleProtocol.sections) {
        for (const step of section.steps) {
          expect(step.electricalStimulation).toBe('without')
        }
      }
    })
  })
})
