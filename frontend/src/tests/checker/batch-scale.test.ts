/**
 * Phase 3: Large-Scale Batch Tests
 * 100+ 文档批量验证、全组合覆盖、性能基准
 */
import { describe, it, expect } from 'vitest'
import { generateDocument, generatePerfectBatch, generateRuleInjectionBatch } from '../fixtures/generator'
import type { BodyPartKey } from '../fixtures/generator'
import { checkDocument } from '../../../../parsers/optum-note/checker/note-checker'

// ============ Full Combination Matrix ============

describe('Full body part × pain level matrix', () => {
  const bodyParts: BodyPartKey[] = ['LBP', 'KNEE', 'SHOULDER', 'NECK']
  const painLevels = [2, 3, 4, 5, 6, 7, 8, 9, 10]
  const lateralities = ['left', 'right', 'bilateral'] as const

  for (const bp of bodyParts) {
    for (const pain of painLevels) {
      it(`${bp} pain=${pain} → score 100`, () => {
        const doc = generateDocument({ bodyPart: bp, painStart: pain })
        const result = checkDocument({ document: doc })
        expect(result.summary.scoring.totalScore).toBe(100)
        expect(result.errors).toHaveLength(0)
      })
    }
  }

  // Laterality × body part (subset to keep count reasonable)
  for (const bp of bodyParts) {
    for (const lat of lateralities) {
      it(`${bp} ${lat} → score 100`, () => {
        const doc = generateDocument({ bodyPart: bp, painStart: 8, laterality: lat })
        const result = checkDocument({ document: doc })
        expect(result.summary.scoring.totalScore).toBe(100)
      })
    }
  }
})

// ============ Batch 100 Perfect Documents ============

describe('Batch: 100 perfect documents', () => {
  it('all 100 score 100 PASS', () => {
    const batch = generatePerfectBatch(100)
    expect(batch).toHaveLength(100)
    let passCount = 0
    for (const doc of batch) {
      const result = checkDocument({ document: doc })
      if (result.summary.scoring.totalScore === 100 && result.summary.scoring.grade === 'PASS') {
        passCount++
      }
    }
    expect(passCount).toBe(100)
  })

  it('mixed body parts batch all pass', () => {
    const bodyParts: BodyPartKey[] = ['LBP', 'KNEE', 'SHOULDER', 'NECK']
    const docs = bodyParts.flatMap(bp =>
      Array.from({ length: 25 }, () => generateDocument({ bodyPart: bp, painStart: 8 }))
    )
    expect(docs).toHaveLength(100)
    for (const doc of docs) {
      const result = checkDocument({ document: doc })
      expect(result.summary.scoring.totalScore).toBe(100)
    }
  })
})

// ============ Injection Coverage Matrix ============

describe('Injection coverage: all supported rules', () => {
  const supportedRules = [
    'IE01', 'IE02', 'IE04', 'IE05', 'IE06', 'IE07', 'IE08',
    'TX01', 'TX02', 'TX03', 'TX05', 'TX06',
    'T02', 'T03', 'T06', 'T07', 'T08',
    'V01', 'V02', 'V03', 'V04', 'V05', 'V06', 'V07', 'V09',
    'DX01', 'DX02', 'DX03', 'CPT01', 'CPT02',
    'S2', 'O8', 'O9', 'A5', 'P1', 'P2',
    'X1', 'X3', 'X4',
  ]

  for (const ruleId of supportedRules) {
    it(`${ruleId} injection triggers error`, () => {
      const doc = generateDocument({ painStart: 8, bodyPart: 'LBP', injectErrors: [{ ruleId }] })
      const result = checkDocument({ document: doc })
      const matched = result.errors.filter(e => e.ruleId === ruleId)
      expect(matched.length, `${ruleId} should fire`).toBeGreaterThan(0)
    })
  }
})

// ============ Score Distribution ============

describe('Score distribution across configs', () => {
  it('perfect docs always score exactly 100', () => {
    const configs = [
      { bodyPart: 'LBP' as const, painStart: 3 },
      { bodyPart: 'LBP' as const, painStart: 8 },
      { bodyPart: 'KNEE' as const, painStart: 5 },
      { bodyPart: 'KNEE' as const, painStart: 10 },
      { bodyPart: 'SHOULDER' as const, painStart: 7 },
      { bodyPart: 'NECK' as const, painStart: 9 },
    ]
    const scores = configs.map(cfg => {
      const doc = generateDocument(cfg)
      return checkDocument({ document: doc }).summary.scoring.totalScore
    })
    expect(scores.every(s => s === 100)).toBe(true)
  })

  it('single injection → score < 100', () => {
    const doc = generateDocument({ painStart: 8, injectErrors: [{ ruleId: 'IE02' }] })
    const result = checkDocument({ document: doc })
    expect(result.summary.scoring.totalScore).toBeLessThan(100)
  })
})

// ============ Performance Benchmark ============

describe('Performance: throughput benchmark', () => {
  it('100 documents checked in < 2 seconds', () => {
    const docs = generatePerfectBatch(100)
    const start = performance.now()
    for (const doc of docs) {
      checkDocument({ document: doc })
    }
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(2000)
  })

  it('single document check < 50ms', () => {
    const doc = generateDocument({ painStart: 8 })
    const start = performance.now()
    checkDocument({ document: doc })
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(50)
  })

  it('generation + check pipeline < 5ms per doc (avg over 50)', () => {
    const start = performance.now()
    for (let i = 0; i < 50; i++) {
      const doc = generateDocument({ painStart: 8, bodyPart: 'LBP' })
      checkDocument({ document: doc })
    }
    const avgMs = (performance.now() - start) / 50
    expect(avgMs).toBeLessThan(5)
  })
})
