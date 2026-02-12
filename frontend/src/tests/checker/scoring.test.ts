/**
 * Scoring Logic Unit Tests
 * 验证评分公式、等级判定
 */
import { describe, it, expect } from 'vitest'
import { generateDocument, generatePerfectBatch } from '../fixtures/generator'
import { checkDocument } from '../../../../parsers/optum-note/checker/note-checker'

describe('Scoring', () => {
  it('perfect document scores 100 PASS', () => {
    const doc = generateDocument({ painStart: 8, bodyPart: 'LBP' })
    const result = checkDocument({ document: doc })
    expect(result.summary.scoring.totalScore).toBe(100)
    expect(result.summary.scoring.grade).toBe('PASS')
    expect(result.errors).toHaveLength(0)
  })

  it('deterministic: same document always produces same score', () => {
    const doc = generateDocument({ painStart: 8 })
    const r1 = checkDocument({ document: doc })
    const r2 = checkDocument({ document: doc })
    expect(r1.summary.scoring.totalScore).toBe(r2.summary.scoring.totalScore)
    expect(r1.summary.scoring.grade).toBe(r2.summary.scoring.grade)
    expect(r1.errors.length).toBe(r2.errors.length)
  })

  it('CRITICAL error → grade FAIL', () => {
    const doc = generateDocument({ painStart: 8, injectErrors: [{ ruleId: 'IE08' }] })
    const result = checkDocument({ document: doc })
    const hasCritical = result.errors.some(e => e.severity === 'CRITICAL')
    expect(hasCritical).toBe(true)
    expect(result.summary.scoring.grade).toBe('FAIL')
  })

  it('more errors → lower score (monotonicity)', () => {
    const doc0 = generateDocument({ painStart: 8 })
    const doc1 = generateDocument({ painStart: 8, injectErrors: [{ ruleId: 'TX03' }] })
    const doc2 = generateDocument({ painStart: 8, injectErrors: [{ ruleId: 'TX03' }, { ruleId: 'V01', visitIndex: 3 }] })
    const s0 = checkDocument({ document: doc0 }).summary.scoring.totalScore
    const s1 = checkDocument({ document: doc1 }).summary.scoring.totalScore
    const s2 = checkDocument({ document: doc2 }).summary.scoring.totalScore
    expect(s0).toBeGreaterThanOrEqual(s1)
    expect(s1).toBeGreaterThanOrEqual(s2)
  })

  it('batch of 10 perfect documents all score 100', () => {
    const batch = generatePerfectBatch(10)
    for (const doc of batch) {
      const result = checkDocument({ document: doc })
      expect(result.summary.scoring.totalScore).toBe(100)
      expect(result.summary.scoring.grade).toBe('PASS')
    }
  })
})

describe('Scoring across body parts', () => {
  const bodyParts = ['LBP', 'KNEE', 'SHOULDER', 'NECK'] as const
  for (const bp of bodyParts) {
    it(`${bp} perfect document scores 100`, () => {
      const doc = generateDocument({ painStart: 8, bodyPart: bp })
      const result = checkDocument({ document: doc })
      expect(result.summary.scoring.totalScore).toBe(100)
      expect(result.summary.scoring.grade).toBe('PASS')
    })
  }
})

describe('Scoring across pain levels', () => {
  for (const pain of [3, 5, 7, 8, 9]) {
    it(`painStart=${pain} perfect document scores 100`, () => {
      const doc = generateDocument({ painStart: pain })
      const result = checkDocument({ document: doc })
      expect(result.summary.scoring.totalScore).toBe(100)
    })
  }
})
