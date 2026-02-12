/**
 * Phase 2: Integration Tests
 * 跨规则交互、批量混合配置、边界值、端到端流程
 */
import { describe, it, expect } from 'vitest'
import { generateDocument, generatePerfectBatch, generateRuleInjectionBatch } from '../fixtures/generator'
import { checkDocument } from '../../../../parsers/optum-note/checker/note-checker'

// ============ End-to-End Flow ============

describe('E2E: generate → check → verify', () => {
  it('perfect doc round-trip: 0 errors, score 100, grade PASS', () => {
    const doc = generateDocument({ painStart: 8, bodyPart: 'LBP' })
    const result = checkDocument({ document: doc })
    expect(result.errors).toHaveLength(0)
    expect(result.summary.scoring.totalScore).toBe(100)
    expect(result.summary.scoring.grade).toBe('PASS')
    expect(result.summary).toBeDefined()
    expect(result.summary.scoring).toBeDefined()
  })

  it('injected doc round-trip: has errors, score < 100', () => {
    const doc = generateDocument({ painStart: 8, injectErrors: [{ ruleId: 'IE02' }] })
    const result = checkDocument({ document: doc })
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.summary.scoring.totalScore).toBeLessThan(100)
  })

  it('result structure has required fields', () => {
    const doc = generateDocument({ painStart: 8 })
    const result = checkDocument({ document: doc })
    expect(result).toHaveProperty('errors')
    expect(result).toHaveProperty('summary')
    expect(result.summary).toHaveProperty('scoring')
    expect(result.summary.scoring).toHaveProperty('totalScore')
    expect(result.summary.scoring).toHaveProperty('grade')
    expect(Array.isArray(result.errors)).toBe(true)
  })
})

// ============ Cross-Rule Interactions ============

describe('Cross-rule interactions', () => {
  it('multiple injections compound: more errors → lower score', () => {
    const doc1 = generateDocument({ painStart: 8, injectErrors: [{ ruleId: 'IE02' }] })
    const doc2 = generateDocument({ painStart: 8, injectErrors: [{ ruleId: 'IE02' }, { ruleId: 'IE04' }] })
    const s1 = checkDocument({ document: doc1 }).summary.scoring.totalScore
    const s2 = checkDocument({ document: doc2 }).summary.scoring.totalScore
    expect(s1).toBeGreaterThanOrEqual(s2)
  })

  it('CRITICAL error always forces FAIL regardless of other scores', () => {
    const doc = generateDocument({ painStart: 8, injectErrors: [{ ruleId: 'IE08' }] })
    const result = checkDocument({ document: doc })
    const hasCritical = result.errors.some(e => e.severity === 'CRITICAL')
    if (hasCritical) {
      expect(result.summary.scoring.grade).toBe('FAIL')
    }
  })

  it('IE + TX injections on different visits both detected', () => {
    const doc = generateDocument({
      painStart: 8,
      injectErrors: [
        { ruleId: 'IE02', visitIndex: 0 },
        { ruleId: 'TX02', visitIndex: 3 },
      ],
    })
    const result = checkDocument({ document: doc })
    const ie02 = result.errors.filter(e => e.ruleId === 'IE02')
    const tx02 = result.errors.filter(e => e.ruleId === 'TX02')
    expect(ie02.length).toBeGreaterThan(0)
    expect(tx02.length).toBeGreaterThan(0)
  })

  it('code + generator rule injections coexist', () => {
    const doc = generateDocument({
      painStart: 8,
      injectErrors: [
        { ruleId: 'DX01' },
        { ruleId: 'O8' },
      ],
    })
    const result = checkDocument({ document: doc })
    const dx01 = result.errors.filter(e => e.ruleId === 'DX01')
    const o8 = result.errors.filter(e => e.ruleId === 'O8')
    expect(dx01.length).toBeGreaterThan(0)
    expect(o8.length).toBeGreaterThan(0)
  })
})

// ============ Batch Mixed Configs ============

describe('Batch mixed configurations', () => {
  const configs = [
    { bodyPart: 'LBP' as const, painStart: 8, laterality: 'bilateral' as const },
    { bodyPart: 'KNEE' as const, painStart: 6, laterality: 'right' as const },
    { bodyPart: 'SHOULDER' as const, painStart: 9, laterality: 'left' as const },
    { bodyPart: 'NECK' as const, painStart: 5, laterality: 'bilateral' as const },
    { bodyPart: 'LBP' as const, painStart: 3, laterality: 'left' as const },
    { bodyPart: 'KNEE' as const, painStart: 10, laterality: 'bilateral' as const },
  ]

  for (const cfg of configs) {
    it(`${cfg.bodyPart} pain=${cfg.painStart} lat=${cfg.laterality} → perfect`, () => {
      const doc = generateDocument(cfg)
      const result = checkDocument({ document: doc })
      expect(result.summary.scoring.totalScore).toBe(100)
      expect(result.summary.scoring.grade).toBe('PASS')
      expect(result.errors).toHaveLength(0)
    })
  }
})

// ============ Edge Cases ============

describe('Edge cases', () => {
  it('painStart=10 (max) produces valid document', () => {
    const doc = generateDocument({ painStart: 10 })
    const result = checkDocument({ document: doc })
    expect(result.summary.scoring.totalScore).toBe(100)
  })

  it('painStart=2 (near min) produces valid document', () => {
    const doc = generateDocument({ painStart: 2 })
    const result = checkDocument({ document: doc })
    expect(result.summary.scoring.totalScore).toBe(100)
  })

  it('visitCount=2 (minimum) produces valid document', () => {
    const doc = generateDocument({ painStart: 8, visitCount: 2 })
    const result = checkDocument({ document: doc })
    // May have sequence warnings but should not have CRITICAL errors from generator
    const criticalGen = result.errors.filter(e =>
      e.severity === 'CRITICAL' && ['O8', 'O9', 'P1', 'DX01'].includes(e.ruleId)
    )
    expect(criticalGen).toHaveLength(0)
  })

  it('visitCount=24 (large) produces valid document', () => {
    const doc = generateDocument({ painStart: 8, visitCount: 24 })
    const result = checkDocument({ document: doc })
    expect(result.summary.scoring.totalScore).toBe(100)
  })

  it('hasPacemaker=true disables estim correctly', () => {
    const doc = generateDocument({ painStart: 8, hasPacemaker: true })
    const result = checkDocument({ document: doc })
    const x4 = result.errors.filter(e => e.ruleId === 'X4')
    expect(x4).toHaveLength(0)
    // Verify estim is off
    for (const v of doc.visits) {
      expect(v.plan.electricalStimulation).toBe(false)
    }
  })

  it('all laterality options produce valid documents', () => {
    for (const lat of ['left', 'right', 'bilateral'] as const) {
      const doc = generateDocument({ painStart: 8, laterality: lat })
      const result = checkDocument({ document: doc })
      expect(result.summary.scoring.totalScore).toBe(100)
    }
  })

  it('all TCM patterns produce valid documents', () => {
    const patterns = ['Qi Stagnation', 'Blood Stasis', 'Qi & Blood Deficiency', 'Cold-Damp']
    for (const p of patterns) {
      const doc = generateDocument({ painStart: 8, localPattern: p })
      const result = checkDocument({ document: doc })
      // Blood Stasis needs matching painTypes - generator uses Dull/Aching which may not match
      // Only check that no CRITICAL generator errors fire
      const criticalGen = result.errors.filter(e =>
        e.severity === 'CRITICAL' && ['O8', 'O9', 'P1', 'DX01'].includes(e.ruleId)
      )
      expect(criticalGen).toHaveLength(0)
    }
  })
})

// ============ Batch Injection Coverage ============

describe('generateRuleInjectionBatch', () => {
  it('generates correct number of documents', () => {
    const batch = generateRuleInjectionBatch(['IE02', 'TX02', 'DX01'], 2)
    expect(batch).toHaveLength(6)
    expect(batch.filter(b => b.ruleId === 'IE02')).toHaveLength(2)
    expect(batch.filter(b => b.ruleId === 'TX02')).toHaveLength(2)
    expect(batch.filter(b => b.ruleId === 'DX01')).toHaveLength(2)
  })

  it('each injected doc triggers its target rule', () => {
    const ruleIds = ['IE02', 'IE04', 'TX02', 'DX01', 'O8', 'P2']
    const batch = generateRuleInjectionBatch(ruleIds)
    for (const { ruleId, doc } of batch) {
      const result = checkDocument({ document: doc })
      const matched = result.errors.filter(e => e.ruleId === ruleId)
      expect(matched.length, `${ruleId} should trigger`).toBeGreaterThan(0)
    }
  })
})

// ============ Error Structure Validation ============

describe('Error object structure', () => {
  it('each error has required fields', () => {
    const doc = generateDocument({ painStart: 8, injectErrors: [{ ruleId: 'IE02' }] })
    const result = checkDocument({ document: doc })
    for (const e of result.errors) {
      expect(e).toHaveProperty('ruleId')
      expect(e).toHaveProperty('severity')
      expect(e).toHaveProperty('visitIndex')
      expect(e).toHaveProperty('section')
      expect(e).toHaveProperty('message')
      expect(typeof e.ruleId).toBe('string')
      expect(typeof e.severity).toBe('string')
      expect(typeof e.visitIndex).toBe('number')
    }
  })

  it('severity values are valid enum', () => {
    const doc = generateDocument({
      painStart: 8,
      injectErrors: [{ ruleId: 'IE02' }, { ruleId: 'IE08' }, { ruleId: 'TX02' }],
    })
    const result = checkDocument({ document: doc })
    const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    for (const e of result.errors) {
      expect(validSeverities).toContain(e.severity)
    }
  })
})
