import { describe, it, expect } from 'vitest'
import { generateTXSequenceStates, type TXSequenceOptions } from '../tx-sequence-engine'
import type { GenerationContext } from '../../types'

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
  }
}

describe('Phase 3: Reason diversity (shuffle bag)', () => {
  it('reason repeat rate ≤ 15% across 10 seeds (11 visits)', () => {
    const ctx = makeContext()
    for (let seed = 1; seed <= 10; seed++) {
      const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed: seed * 1000 })
      const reasons = states.map(s => s.reason)
      const uniqueReasons = new Set(reasons)
      const repeatRate = 1 - uniqueReasons.size / reasons.length
      expect(repeatRate, `seed=${seed * 1000} repeatRate=${(repeatRate * 100).toFixed(0)}%`).toBeLessThanOrEqual(0.15)
    }
  })

  it('reason repeat rate ≤ 20% across 10 seeds (20 visits)', () => {
    const ctx = makeContext()
    for (let seed = 1; seed <= 10; seed++) {
      const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed: seed * 1000 })
      const reasons = states.map(s => s.reason)
      const uniqueReasons = new Set(reasons)
      const repeatRate = 1 - uniqueReasons.size / reasons.length
      expect(repeatRate, `seed=${seed * 1000} repeatRate=${(repeatRate * 100).toFixed(0)}%`).toBeLessThanOrEqual(0.20)
    }
  })

  it('no 3 consecutive identical reasons across 10 seeds', () => {
    const ctx = makeContext()
    for (let seed = 1; seed <= 10; seed++) {
      const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed: seed * 1000 })
      for (let i = 2; i < states.length; i++) {
        const triple = states[i].reason === states[i-1].reason && states[i-1].reason === states[i-2].reason
        expect(triple, `seed=${seed * 1000} visit=${i+1}: 3x "${states[i].reason}"`).toBe(false)
      }
    }
  })

  it('neutral reasons (similar visits) are not always "continuous treatment"', () => {
    const ctx = makeContext()
    let totalSimilar = 0
    let continuousTreatmentCount = 0
    for (let seed = 1; seed <= 10; seed++) {
      const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed: seed * 1000 })
      for (const s of states) {
        if (s.symptomChange?.includes('similar')) {
          totalSimilar++
          if (s.reason === 'continuous treatment') continuousTreatmentCount++
        }
      }
    }
    // "continuous treatment" should not dominate similar visits (< 60%)
    if (totalSimilar > 0) {
      const ratio = continuousTreatmentCount / totalSimilar
      expect(ratio, `continuous treatment ratio: ${(ratio * 100).toFixed(0)}%`).toBeLessThan(0.6)
    }
  })

  it('all 5 body parts have reason repeat rate ≤ 20%', () => {
    const bodyParts = ['LBP', 'NECK', 'SHOULDER', 'KNEE', 'ELBOW']
    for (const bp of bodyParts) {
      const ctx = makeContext({
        primaryBodyPart: bp,
        painCurrent: bp === 'ELBOW' ? 6 : bp === 'NECK' ? 7 : 8,
      })
      const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed: 42 })
      const reasons = states.map(s => s.reason)
      const uniqueReasons = new Set(reasons)
      const repeatRate = 1 - uniqueReasons.size / reasons.length
      expect(repeatRate, `${bp} repeatRate=${(repeatRate * 100).toFixed(0)}%`).toBeLessThanOrEqual(0.20)
    }
  })
})
