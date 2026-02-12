/**
 * Phase 4: Stress Tests
 * 1000+ 文档、随机模糊测试、极端值、并发处理
 */
import { describe, it, expect } from 'vitest'
import { generateDocument, generatePerfectBatch } from '../fixtures/generator'
import type { BodyPartKey, DocConfig } from '../fixtures/generator'
import { checkDocument } from '../../../../parsers/optum-note/checker/note-checker'

// ============ High Volume ============

describe('Stress: 1000 document batch', () => {
  it('1000 perfect documents all score 100', () => {
    const batch = generatePerfectBatch(1000)
    let failures = 0
    for (const doc of batch) {
      const result = checkDocument({ document: doc })
      if (result.summary.scoring.totalScore !== 100) failures++
    }
    expect(failures).toBe(0)
  })

  it('1000 documents checked in < 10 seconds', () => {
    const batch = generatePerfectBatch(1000)
    const start = performance.now()
    for (const doc of batch) {
      checkDocument({ document: doc })
    }
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(10000)
  })
})

// ============ Random Fuzzing ============

function randomBodyPart(): BodyPartKey {
  const parts: BodyPartKey[] = ['LBP', 'KNEE', 'SHOULDER', 'NECK']
  return parts[Math.floor(Math.random() * parts.length)]
}

function randomPain(): number {
  return Math.floor(Math.random() * 9) + 2 // 2-10
}

function randomLaterality(): 'left' | 'right' | 'bilateral' {
  const opts = ['left', 'right', 'bilateral'] as const
  return opts[Math.floor(Math.random() * opts.length)]
}

function randomConfig(): DocConfig {
  return {
    bodyPart: randomBodyPart(),
    painStart: randomPain(),
    laterality: randomLaterality(),
    visitCount: Math.floor(Math.random() * 20) + 4, // 4-23
  }
}

describe('Stress: random fuzzing', () => {
  it('200 random perfect documents all score 100', () => {
    let failures: string[] = []
    for (let i = 0; i < 200; i++) {
      const cfg = randomConfig()
      const doc = generateDocument(cfg)
      const result = checkDocument({ document: doc })
      if (result.summary.scoring.totalScore !== 100) {
        const errSummary = result.errors.map(e => `${e.ruleId}[${e.severity}]`).join(', ')
        failures.push(`#${i} ${cfg.bodyPart} pain=${cfg.painStart} lat=${cfg.laterality} v=${cfg.visitCount}: ${errSummary}`)
      }
    }
    expect(failures, failures.join('\n')).toHaveLength(0)
  })

  it('random configs never crash checkDocument', () => {
    for (let i = 0; i < 500; i++) {
      const cfg = randomConfig()
      const doc = generateDocument(cfg)
      expect(() => checkDocument({ document: doc })).not.toThrow()
    }
  })
})

// ============ Extreme Values ============

describe('Stress: extreme values', () => {
  it('painStart=10 all body parts', () => {
    const parts: BodyPartKey[] = ['LBP', 'KNEE', 'SHOULDER', 'NECK']
    for (const bp of parts) {
      const doc = generateDocument({ bodyPart: bp, painStart: 10 })
      const result = checkDocument({ document: doc })
      expect(result.summary.scoring.totalScore).toBe(100)
    }
  })

  it('painStart=2 all body parts', () => {
    const parts: BodyPartKey[] = ['LBP', 'KNEE', 'SHOULDER', 'NECK']
    for (const bp of parts) {
      const doc = generateDocument({ bodyPart: bp, painStart: 2 })
      const result = checkDocument({ document: doc })
      expect(result.summary.scoring.totalScore).toBe(100)
    }
  })

  it('visitCount=4 (minimum viable)', () => {
    const doc = generateDocument({ painStart: 8, visitCount: 4 })
    expect(() => checkDocument({ document: doc })).not.toThrow()
  })

  it('visitCount=36 (3x normal)', () => {
    const doc = generateDocument({ painStart: 8, visitCount: 36 })
    const result = checkDocument({ document: doc })
    expect(result.summary.scoring.totalScore).toBe(100)
  })

  it('hasPacemaker with all body parts', () => {
    const parts: BodyPartKey[] = ['LBP', 'KNEE', 'SHOULDER', 'NECK']
    for (const bp of parts) {
      const doc = generateDocument({ bodyPart: bp, painStart: 8, hasPacemaker: true })
      const result = checkDocument({ document: doc })
      const x4 = result.errors.filter(e => e.ruleId === 'X4')
      expect(x4).toHaveLength(0)
    }
  })
})

// ============ Determinism Under Load ============

describe('Stress: determinism', () => {
  it('same config produces identical results 100 times', () => {
    const cfg: DocConfig = { bodyPart: 'KNEE', painStart: 7, laterality: 'right' }
    const baseline = checkDocument({ document: generateDocument(cfg) })
    for (let i = 0; i < 100; i++) {
      const result = checkDocument({ document: generateDocument(cfg) })
      expect(result.summary.scoring.totalScore).toBe(baseline.summary.scoring.totalScore)
      expect(result.summary.scoring.grade).toBe(baseline.summary.scoring.grade)
      expect(result.errors.length).toBe(baseline.errors.length)
    }
  })
})

// ============ Multi-Injection Stress ============

describe('Stress: multi-injection combinations', () => {
  const injectionSets = [
    ['IE02', 'TX02', 'V01'],
    ['IE04', 'TX05', 'DX01'],
    ['IE08', 'O8', 'P2'],
    ['X1', 'X4', 'A5'],
    ['IE01', 'TX01', 'T08', 'V05'],
  ]

  for (const rules of injectionSets) {
    it(`${rules.join('+')} all detected`, () => {
      const doc = generateDocument({
        painStart: 8,
        bodyPart: 'LBP',
        injectErrors: rules.map(ruleId => ({ ruleId })),
      })
      const result = checkDocument({ document: doc })
      for (const ruleId of rules) {
        const matched = result.errors.filter(e => e.ruleId === ruleId)
        expect(matched.length, `${ruleId} should fire`).toBeGreaterThan(0)
      }
    })
  }
})

// ============ Memory Stability ============

describe('Stress: memory stability', () => {
  it('2000 generate+check cycles without memory issues', () => {
    for (let i = 0; i < 2000; i++) {
      const doc = generateDocument({ painStart: 8, bodyPart: 'LBP' })
      checkDocument({ document: doc })
    }
    // If we get here without OOM, test passes
    expect(true).toBe(true)
  })
})
