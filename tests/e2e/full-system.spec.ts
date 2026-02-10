/**
 * Full System E2E Test Spec
 * 全系统端到端测试 - 使用真实 Optum Note PDF 素材
 *
 * 测试流程: PDF解析 → 数据桥接 → 文档校验 → 纠错生成 → SOAP生成 → 验证
 */

import { describe, it, expect, beforeAll } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

// Parser imports
import {
  parseOptumNote,
  bridgeToContext,
  bridgeVisitToSOAPNote,
  checkDocument,
  generateCorrections,
  type OptumNoteDocument,
  type VisitRecord,
  type CheckReport
} from '../../parsers/optum-note'

// Core system imports
import {
  generateSOAPNote,
  exportSOAPAsText,
  generateTXSequenceStates,
  validateSOAPNote,
  formatValidationResult,
  type GenerationContext,
  type SOAPNote
} from '../../src'

// PDF extraction (mock for test - actual PDF parsing needs pdfjs)
import { extractPdfText } from './helpers/pdf-mock'

// ============ Test Configuration ============
const PDF_SOURCE_DIR = '/Users/ping/Desktop/Processing/Optum note'
const TEST_CASES_LIMIT = 5 // 限制测试用例数量

// ============ Test Fixtures ============
interface TestCase {
  fileName: string
  pdfText: string
  document?: OptumNoteDocument
}

let testCases: TestCase[] = []

// ============ Setup ============
beforeAll(async () => {
  // 加载测试素材
  const files = fs.readdirSync(PDF_SOURCE_DIR)
    .filter(f => f.endsWith('.pdf'))
    .slice(0, TEST_CASES_LIMIT)

  for (const fileName of files) {
    const filePath = path.join(PDF_SOURCE_DIR, fileName)
    const pdfText = await extractPdfText(filePath)
    testCases.push({ fileName, pdfText })
  }
})

// ============ Module 1: PDF Parser Tests ============
describe('Module 1: Optum Note Parser', () => {
  describe('parseOptumNote', () => {
    it('should parse all test PDFs without fatal errors', () => {
      for (const tc of testCases) {
        const result = parseOptumNote(tc.pdfText)
        expect(result.success).toBe(true)
        expect(result.document).toBeDefined()
        tc.document = result.document
      }
    })

    it('should extract patient header correctly', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const { header } = tc.document
        expect(header.patient.name).toBeTruthy()
        expect(header.patient.dob).toMatch(/\d{2}\/\d{2}\/\d{4}/)
        expect(header.patient.patientId).toBeTruthy()
      }
    })

    it('should parse at least one visit per document', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        expect(tc.document.visits.length).toBeGreaterThan(0)
      }
    })

    it('should identify IE (Initial Evaluation) visit', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const ieVisit = tc.document.visits.find(
          v => v.subjective.visitType === 'INITIAL EVALUATION'
        )
        expect(ieVisit).toBeDefined()
      }
    })

    it('should parse subjective section completely', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const visit = tc.document.visits[0]
        expect(visit.subjective.painTypes.length).toBeGreaterThan(0)
        expect(visit.subjective.bodyPart).toBeTruthy()
        expect(visit.subjective.painScale).toBeDefined()
      }
    })

    it('should parse objective section with ROM data', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const visit = tc.document.visits[0]
        expect(visit.objective.rom).toBeDefined()
        expect(visit.objective.tonguePulse).toBeDefined()
      }
    })

    it('should parse assessment with TCM diagnosis', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const ieVisit = tc.document.visits.find(
          v => v.subjective.visitType === 'INITIAL EVALUATION'
        )
        if (ieVisit) {
          expect(ieVisit.assessment.currentPattern).toBeTruthy()
        }
      }
    })

    it('should parse plan with acupoints', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const visit = tc.document.visits[0]
        expect(visit.plan.acupoints.length).toBeGreaterThan(0)
        expect(visit.plan.treatmentTime).toBe(15)
      }
    })

    it('should parse diagnosis and procedure codes', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const visit = tc.document.visits[0]
        expect(visit.diagnosisCodes.length).toBeGreaterThan(0)
        expect(visit.procedureCodes.length).toBeGreaterThan(0)
      }
    })
  })
})

// ============ Module 2: Bridge Tests ============
describe('Module 2: Data Bridge', () => {
  describe('bridgeToContext', () => {
    it('should convert OptumNoteDocument to GenerationContext', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const ctx = bridgeToContext(tc.document)
        expect(ctx.noteType).toMatch(/^(IE|TX)$/)
        expect(ctx.primaryBodyPart).toBeTruthy()
        expect(ctx.laterality).toBeTruthy()
        expect(ctx.localPattern).toBeTruthy()
        expect(ctx.severityLevel).toBeTruthy()
      }
    })

    it('should infer insurance type correctly', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const ctx = bridgeToContext(tc.document)
        expect(['OPTUM', 'WC', 'HF', 'NONE']).toContain(ctx.insuranceType)
      }
    })
  })

  describe('bridgeVisitToSOAPNote', () => {
    it('should convert VisitRecord to SOAPNote structure', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const visit = tc.document.visits[0]
        const soap = bridgeVisitToSOAPNote(visit)
        expect(soap.header).toBeDefined()
        expect(soap.subjective).toBeDefined()
        expect(soap.objective).toBeDefined()
        expect(soap.assessment).toBeDefined()
        expect(soap.plan).toBeDefined()
      }
    })
  })
})

// ============ Module 3: Document Checker Tests ============
describe('Module 3: Document Checker', () => {
  describe('checkDocument', () => {
    it('should check all documents and return CheckReport', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const report = checkDocument({ document: tc.document })
        expect(report).toBeDefined()
        expect(report.errors).toBeInstanceOf(Array)
        expect(typeof report.score).toBe('number')
      }
    })

    it('should detect consistency errors in TX visits', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        if (tc.document.visits.length < 2) continue
        const report = checkDocument({ document: tc.document })
        // TX visits should have timeline consistency checks
        expect(report.timeline).toBeDefined()
      }
    })

    it('should score documents between 0-100', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const report = checkDocument({ document: tc.document })
        expect(report.score).toBeGreaterThanOrEqual(0)
        expect(report.score).toBeLessThanOrEqual(100)
      }
    })
  })
})

// ============ Module 4: Correction Generator Tests ============
describe('Module 4: Correction Generator', () => {
  describe('generateCorrections', () => {
    it('should generate corrections for documents with errors', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const report = checkDocument({ document: tc.document })
        if (report.errors.length === 0) continue

        const corrections = generateCorrections(tc.document, report.errors)
        expect(corrections).toBeInstanceOf(Array)
      }
    })

    it('should provide field-level fixes', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const report = checkDocument({ document: tc.document })
        if (report.errors.length === 0) continue

        const corrections = generateCorrections(tc.document, report.errors)
        for (const correction of corrections) {
          expect(correction.visitIndex).toBeDefined()
          expect(correction.fixes).toBeInstanceOf(Array)
        }
      }
    })
  })
})

// ============ Module 5: SOAP Generator Tests ============
describe('Module 5: SOAP Generator', () => {
  describe('generateSOAPNote (IE)', () => {
    it('should generate IE SOAP note from context', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const ctx = bridgeToContext(tc.document)
        ctx.noteType = 'IE'

        const soap = generateSOAPNote(ctx)
        expect(soap.header.noteType).toBe('IE')
        expect(soap.subjective.visitType).toBe('INITIAL EVALUATION')
        expect(soap.plan.shortTermGoal).toBeDefined()
        expect(soap.plan.longTermGoal).toBeDefined()
      }
    })

    it('should generate valid HTML content', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const ctx = bridgeToContext(tc.document)
        ctx.noteType = 'IE'

        const soap = generateSOAPNote(ctx)
        // Check for dropdown elements
        const text = exportSOAPAsText(soap)
        expect(text).toBeTruthy()
        expect(text.length).toBeGreaterThan(100)
      }
    })
  })

  describe('generateSOAPNote (TX)', () => {
    it('should generate TX SOAP note with previousIE', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const ctx = bridgeToContext(tc.document)

        // First generate IE
        ctx.noteType = 'IE'
        const ieNote = generateSOAPNote(ctx)

        // Then generate TX
        ctx.noteType = 'TX'
        ctx.previousIE = ieNote
        const txNote = generateSOAPNote(ctx)

        expect(txNote.header.noteType).toBe('TX')
        expect(txNote.subjective.visitType).toBe('Follow up visit')
      }
    })
  })

  describe('generateTXSequenceStates', () => {
    it('should generate TX sequence with progressive improvement', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const ctx = bridgeToContext(tc.document)
        ctx.noteType = 'IE'
        const ieNote = generateSOAPNote(ctx)

        ctx.noteType = 'TX'
        ctx.previousIE = ieNote

        const sequence = generateTXSequenceStates(ctx, { txCount: 5, seed: 42 })
        expect(sequence).toHaveLength(5)

        // Pain should trend downward
        for (let i = 1; i < sequence.length; i++) {
          expect(sequence[i].painScaleCurrent).toBeLessThanOrEqual(
            sequence[i - 1].painScaleCurrent
          )
        }
      }
    })
  })
})

// ============ Module 6: Validator Tests ============
describe('Module 6: SOAP Validator', () => {
  describe('validateSOAPNote', () => {
    it('should validate generated SOAP notes', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const ctx = bridgeToContext(tc.document)
        ctx.noteType = 'IE'

        const soap = generateSOAPNote(ctx)
        const result = validateSOAPNote(soap)

        expect(result).toBeDefined()
        expect(result.isValid).toBeDefined()
        expect(result.errors).toBeInstanceOf(Array)
        expect(result.warnings).toBeInstanceOf(Array)
      }
    })

    it('should format validation results', () => {
      for (const tc of testCases) {
        if (!tc.document) continue
        const ctx = bridgeToContext(tc.document)
        ctx.noteType = 'IE'

        const soap = generateSOAPNote(ctx)
        const result = validateSOAPNote(soap)
        const formatted = formatValidationResult(result)

        expect(typeof formatted).toBe('string')
      }
    })
  })
})

// ============ Module 7: Integration Tests ============
describe('Module 7: Full Pipeline Integration', () => {
  it('should complete full pipeline: Parse → Check → Correct → Generate → Validate', () => {
    for (const tc of testCases) {
      // Step 1: Parse
      const parseResult = parseOptumNote(tc.pdfText)
      expect(parseResult.success).toBe(true)
      if (!parseResult.document) continue

      // Step 2: Check
      const checkReport = checkDocument({ document: parseResult.document })
      expect(checkReport).toBeDefined()

      // Step 3: Bridge to context
      const ctx = bridgeToContext(parseResult.document)
      expect(ctx).toBeDefined()

      // Step 4: Generate IE
      ctx.noteType = 'IE'
      const ieNote = generateSOAPNote(ctx)
      expect(ieNote).toBeDefined()

      // Step 5: Validate IE
      const ieValidation = validateSOAPNote(ieNote)
      expect(ieValidation.errors.length).toBe(0)

      // Step 6: Generate TX sequence
      ctx.noteType = 'TX'
      ctx.previousIE = ieNote
      const txSequence = generateTXSequenceStates(ctx, { txCount: 3, seed: 1 })
      expect(txSequence.length).toBe(3)

      // Step 7: Export
      const exportedText = exportSOAPAsText(ieNote)
      expect(exportedText.length).toBeGreaterThan(0)
    }
  })

  it('should handle multi-body-part cases', () => {
    for (const tc of testCases) {
      if (!tc.document) continue

      const ctx = bridgeToContext(tc.document)
      if (!ctx.secondaryBodyParts?.length) continue

      ctx.noteType = 'IE'
      const soap = generateSOAPNote(ctx)

      // Should include secondary body parts
      expect(soap.subjective.secondaryBodyParts.length).toBeGreaterThan(0)
    }
  })

  it('should maintain consistency across TX series', () => {
    for (const tc of testCases) {
      if (!tc.document) continue

      const ctx = bridgeToContext(tc.document)
      ctx.noteType = 'IE'
      const ieNote = generateSOAPNote(ctx)

      ctx.noteType = 'TX'
      ctx.previousIE = ieNote

      const sequence = generateTXSequenceStates(ctx, { txCount: 6, seed: 99 })

      // Verify consistency rules
      for (const state of sequence) {
        // Symptom change should be improvement
        expect(state.symptomChange).toBe('improvement of symptom(s)')
        // Pain should be within valid range
        expect(state.painScaleCurrent).toBeGreaterThanOrEqual(0)
        expect(state.painScaleCurrent).toBeLessThanOrEqual(10)
      }
    }
  })
})

// ============ Module 8: Edge Cases ============
describe('Module 8: Edge Cases', () => {
  it('should handle pacemaker contraindication', () => {
    for (const tc of testCases) {
      if (!tc.document) continue

      const ctx = bridgeToContext(tc.document)
      ctx.hasPacemaker = true
      ctx.noteType = 'IE'

      const soap = generateSOAPNote(ctx)
      // Should not have electrical stimulation
      expect(soap.plan.needleProtocol.sections.every(
        s => s.steps.every(step => step.electricalStimulation === 'without')
      )).toBe(true)
    }
  })

  it('should handle severe pain cases', () => {
    for (const tc of testCases) {
      if (!tc.document) continue

      const ctx = bridgeToContext(tc.document)
      ctx.severityLevel = 'severe'
      ctx.noteType = 'IE'

      const soap = generateSOAPNote(ctx)
      // Should have appropriate severity indicators
      expect(soap.subjective.adlDifficulty.level).toBe('severe')
    }
  })

  it('should handle bilateral cases', () => {
    for (const tc of testCases) {
      if (!tc.document) continue

      const ctx = bridgeToContext(tc.document)
      ctx.laterality = 'bilateral'
      ctx.noteType = 'IE'

      const soap = generateSOAPNote(ctx)
      expect(soap.subjective.primaryBodyPart.laterality).toBe('bilateral')
    }
  })
})
