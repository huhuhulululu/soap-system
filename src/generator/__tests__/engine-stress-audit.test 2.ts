import { describe, it, expect } from 'vitest'
import { generateTXSequenceStates, type TXSequenceOptions } from '../tx-sequence-engine'
import type { GenerationContext } from '../../types'

const BODY_PARTS = ['LBP', 'NECK', 'SHOULDER', 'KNEE', 'ELBOW'] as const
const CHRONICITY = ['Acute', 'Sub-Acute', 'Chronic'] as const
const SEEDS = [42, 1000, 2000, 3000, 5000, 7777, 9999, 12345, 54321, 99999]

function makeContext(overrides: Partial<GenerationContext> = {}): GenerationContext {
  return {
    noteType: 'TX',
    insuranceType: 'NONE',
    primaryBodyPart: 'SHOULDER',
    laterality: 'left',
    localPattern: 'Qi Stagnation',
    systemicPattern: 'Kidney Yang Deficiency',
    chronicityLevel: 'Chronic',
    severityLevel: 'moderate to severe',
    painCurrent: 8,
    ...overrides,
  } as GenerationContext
}

// ============================================================
// 1. PRNG Determinism
// ============================================================
describe('Audit: PRNG Determinism', () => {
  it('same seed produces identical output across 50 runs', () => {
    const ctx = makeContext()
    const baseline = generateTXSequenceStates(ctx, { txCount: 11, seed: 42 })
    for (let i = 0; i < 50; i++) {
      const run = generateTXSequenceStates(ctx, { txCount: 11, seed: 42 })
      expect(run.states.map(s => s.painScaleCurrent)).toEqual(
        baseline.states.map(s => s.painScaleCurrent),
      )
      expect(run.states.map(s => s.reason)).toEqual(
        baseline.states.map(s => s.reason),
      )
      expect(run.states.map(s => s.symptomChange)).toEqual(
        baseline.states.map(s => s.symptomChange),
      )
    }
  })

  it('different seeds produce different output', () => {
    const ctx = makeContext()
    const results = SEEDS.slice(0, 5).map(seed =>
      generateTXSequenceStates(ctx, { txCount: 11, seed }),
    )
    // At least 4 out of 5 should have different pain sequences
    const painSeqs = results.map(r => r.states.map(s => s.painScaleCurrent).join(','))
    const uniqueSeqs = new Set(painSeqs)
    expect(uniqueSeqs.size).toBeGreaterThanOrEqual(4)
  })

  it('adjacent seeds (1000, 1001) produce different output', () => {
    const ctx = makeContext()
    const a = generateTXSequenceStates(ctx, { txCount: 11, seed: 1000 })
    const b = generateTXSequenceStates(ctx, { txCount: 11, seed: 1001 })
    const reasonsA = a.states.map(s => s.reason).join('|')
    const reasonsB = b.states.map(s => s.reason).join('|')
    expect(reasonsA).not.toEqual(reasonsB)
  })
})

// ============================================================
// 2. Monotonicity
// ============================================================
describe('Audit: Monotonicity', () => {
  it('pain never increases visit-over-visit (10 seeds × 5 body parts)', () => {
    for (const bp of BODY_PARTS) {
      const ctx = makeContext({ primaryBodyPart: bp })
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed })
        for (let i = 1; i < states.length; i++) {
          expect(
            states[i].painScaleCurrent,
            `${bp} seed=${seed} v${i + 1}: pain ${states[i].painScaleCurrent} > prev ${states[i - 1].painScaleCurrent}`,
          ).toBeLessThanOrEqual(states[i - 1].painScaleCurrent + 0.01) // tiny float tolerance
        }
      }
    }
  })

  it('strength never decreases (10 seeds × 5 body parts)', () => {
    const STRENGTH_ORDER = ['3-/5', '3/5', '3+/5', '4-/5', '4/5', '4+/5', '5/5']
    for (const bp of BODY_PARTS) {
      const ctx = makeContext({ primaryBodyPart: bp })
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed })
        for (let i = 1; i < states.length; i++) {
          const prev = STRENGTH_ORDER.indexOf(states[i - 1].strengthGrade ?? '4/5')
          const curr = STRENGTH_ORDER.indexOf(states[i].strengthGrade ?? '4/5')
          expect(
            curr,
            `${bp} seed=${seed} v${i + 1}: strength ${states[i].strengthGrade} < prev ${states[i - 1].strengthGrade}`,
          ).toBeGreaterThanOrEqual(prev)
        }
      }
    }
  })
})

// ============================================================
// 3. S-O-A Consistency
// ============================================================
describe('Audit: S-O-A Consistency', () => {
  it('painChange=improved requires at least one non-stable objective trend OR pain actually dropped (10 seeds × 5 bp)', () => {
    let violations = 0
    let total = 0
    for (const bp of BODY_PARTS) {
      const ctx = makeContext({ primaryBodyPart: bp })
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed })
        for (let i = 1; i < states.length; i++) {
          const s = states[i]
          if (!s.soaChain) continue
          total++
          if (s.soaChain.subjective.painChange === 'improved') {
            const o = s.soaChain.objective
            const anyObjChange =
              o.tightnessTrend !== 'stable' ||
              o.tendernessTrend !== 'stable' ||
              o.spasmTrend !== 'stable' ||
              o.romTrend !== 'stable' ||
              o.strengthTrend !== 'stable'
            const painDropped = s.painScaleCurrent < states[i - 1].painScaleCurrent
            if (!anyObjChange && !painDropped) violations++
          }
        }
      }
    }
    // Allow ≤ 2% violations (edge cases at plateau boundaries)
    const rate = total > 0 ? violations / total : 0
    expect(rate, `S-O-A violations: ${violations}/${total} = ${(rate * 100).toFixed(1)}%`).toBeLessThanOrEqual(0.02)
  })

  it('painChange=similar → assessment.present contains "similar"', () => {
    for (const bp of BODY_PARTS) {
      const ctx = makeContext({ primaryBodyPart: bp })
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed })
        for (const s of states) {
          if (!s.soaChain) continue
          if (s.soaChain.subjective.painChange === 'similar') {
            expect(
              s.soaChain.assessment.present,
              `${bp} seed=${seed} v${s.visitIndex}: similar painChange but assessment="${s.soaChain.assessment.present}"`,
            ).toContain('similar')
          }
        }
      }
    }
  })

  it('reason matches symptomChange category', () => {
    const POSITIVE_KEYWORDS = ['pain', 'activity', 'energy', 'sleep', 'freely', 'improved', 'reduced', 'easier', 'decreased', 'comfortably', 'tolerance', 'rotation', 'stability', 'grip', 'well-being', 'stress', 'muscle tension', 'stiffness', 'headache', 'reaching', 'behind back', 'bend', 'lift', 'walking', 'stair', 'forearm']
    const NEGATIVE_KEYWORDS = ['rest', 'work', 'phone', 'computer', 'posture', 'heavy', 'exercise', 'cold', 'skipped', 'stopped', 'discontinuous', 'weak']
    let mismatches = 0
    let total = 0
    for (const seed of SEEDS) {
      const ctx = makeContext()
      const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed })
      for (const s of states) {
        total++
        const sc = s.symptomChange || ''
        const r = s.reason.toLowerCase()
        if (sc.includes('improvement') && !sc.includes('came back')) {
          // Should be positive reason
          if (NEGATIVE_KEYWORDS.some(k => r.includes(k))) mismatches++
        } else if (sc.includes('exacerbate')) {
          // Should be negative reason
          if (POSITIVE_KEYWORDS.some(k => r.includes(k))) mismatches++
        }
      }
    }
    const rate = total > 0 ? mismatches / total : 0
    expect(rate, `reason↔symptomChange mismatches: ${mismatches}/${total}`).toBe(0)
  })
})

// ============================================================
// 4. Boundary Conditions
// ============================================================
describe('Audit: Boundary Conditions', () => {
  it('txCount=1 produces exactly 1 valid visit', () => {
    const ctx = makeContext()
    const { states } = generateTXSequenceStates(ctx, { txCount: 1, seed: 42 })
    expect(states).toHaveLength(1)
    expect(states[0].visitIndex).toBe(1)
    expect(states[0].painScaleCurrent).toBeGreaterThan(0)
    expect(states[0].reason).toBeTruthy()
  })

  it('txCount=30 produces 30 valid visits with no NaN/undefined', () => {
    const ctx = makeContext()
    const { states } = generateTXSequenceStates(ctx, { txCount: 30, seed: 42 })
    expect(states).toHaveLength(30)
    for (const s of states) {
      expect(s.visitIndex).toBeGreaterThan(0)
      expect(Number.isNaN(s.painScaleCurrent)).toBe(false)
      expect(s.painScaleLabel).toBeTruthy()
      expect(s.severityLevel).toBeTruthy()
      expect(s.symptomChange).toBeTruthy()
      expect(s.reason).toBeTruthy()
      expect(s.tightnessGrading).toBeTruthy()
      expect(s.tendernessGrading).toBeTruthy()
      expect(s.spasmGrading).toBeTruthy()
    }
  })

  it('painCurrent=10 (max) handles correctly', () => {
    const ctx = makeContext({ painCurrent: 10 })
    const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed: 42 })
    expect(states[0].painScaleCurrent).toBeLessThanOrEqual(10)
    expect(states[states.length - 1].painScaleCurrent).toBeLessThan(10)
  })

  it('painCurrent=3 (low) never goes below 0', () => {
    const ctx = makeContext({ painCurrent: 3 })
    const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed: 42 })
    for (const s of states) {
      expect(s.painScaleCurrent, `v${s.visitIndex} pain=${s.painScaleCurrent}`).toBeGreaterThanOrEqual(0)
    }
  })

  it('all 5 body parts × 3 chronicity levels produce valid output', () => {
    for (const bp of BODY_PARTS) {
      for (const ch of CHRONICITY) {
        const ctx = makeContext({
          primaryBodyPart: bp,
          chronicityLevel: ch,
          painCurrent: bp === 'ELBOW' ? 6 : 8,
        })
        const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed: 42 })
        expect(states.length, `${bp}/${ch}`).toBe(11)
        for (const s of states) {
          expect(Number.isNaN(s.painScaleCurrent), `${bp}/${ch} v${s.visitIndex} NaN pain`).toBe(false)
          expect(s.reason, `${bp}/${ch} v${s.visitIndex} empty reason`).toBeTruthy()
          expect(s.symptomChange, `${bp}/${ch} v${s.visitIndex} empty symptomChange`).toBeTruthy()
        }
      }
    }
  })

  it('every visit has required soaChain fields', () => {
    const ctx = makeContext()
    const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed: 42 })
    for (const s of states) {
      expect(s.soaChain, `v${s.visitIndex} missing soaChain`).toBeDefined()
      expect(s.soaChain!.subjective.painChange).toBeTruthy()
      expect(s.soaChain!.objective.tightnessTrend).toBeTruthy()
      expect(s.soaChain!.objective.tendernessTrend).toBeTruthy()
      expect(s.soaChain!.objective.spasmTrend).toBeTruthy()
      expect(s.soaChain!.objective.romTrend).toBeTruthy()
      expect(s.soaChain!.objective.strengthTrend).toBeTruthy()
      expect(s.soaChain!.assessment.present).toBeTruthy()
    }
  })
})
