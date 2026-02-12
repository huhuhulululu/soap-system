/**
 * Generator smoke test — 验证合成数据生成器基本功能
 */
import { describe, it, expect } from 'vitest'
import { generateDocument, generatePerfectBatch, generateRuleInjectionBatch } from './generator'
import { checkDocument } from '../../../../parsers/optum-note/checker/note-checker'

describe('Generator Smoke', () => {
  it('generates a valid 12-visit document', () => {
    const doc = generateDocument()
    expect(doc.visits).toHaveLength(12)
    expect(doc.visits[0].subjective.visitType).toBe('INITIAL EVALUATION')
    expect(doc.visits[1].subjective.visitType).toBe('Follow up visit')
    expect(doc.header.patient.name).toBe('TEST, PATIENT')
  })

  it('perfect document passes checkDocument with high score', () => {
    const doc = generateDocument({ painStart: 8, bodyPart: 'LBP' })
    const result = checkDocument({ document: doc })
    // 完美文档应该没有 CRITICAL 错误
    const criticals = result.errors.filter(e => e.severity === 'CRITICAL')
    expect(criticals).toHaveLength(0)
    expect(result.summary.scoring.grade).not.toBe('FAIL')
  })

  it('pain decreases monotonically', () => {
    const doc = generateDocument({ painStart: 9, visitCount: 12 })
    const pains = doc.visits.map(v => (v.subjective.painScale as any).current)
    for (let i = 1; i < pains.length; i++) {
      expect(pains[i]).toBeLessThanOrEqual(pains[i - 1])
    }
  })

  it('error injection triggers target rule', () => {
    const doc = generateDocument({ injectErrors: [{ ruleId: 'IE08' }] })
    const result = checkDocument({ document: doc })
    const ie08 = result.errors.find(e => e.ruleId === 'IE08')
    expect(ie08).toBeDefined()
  })

  it('batch generation works', () => {
    const batch = generatePerfectBatch(5)
    expect(batch).toHaveLength(5)
    batch.forEach(doc => {
      expect(doc.visits.length).toBeGreaterThan(0)
    })
  })

  it('rule injection batch works', () => {
    const batch = generateRuleInjectionBatch(['IE01', 'IE08', 'TX05'], 2)
    expect(batch).toHaveLength(6)
    expect(batch.filter(b => b.ruleId === 'IE01')).toHaveLength(2)
  })
})
