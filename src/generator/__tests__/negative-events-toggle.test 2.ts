import { describe, it, expect } from 'vitest'
import { generateTXSequenceStates } from '../tx-sequence-engine'
import type { GenerationContext } from '../../types'

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

describe('Negative events toggle (allowNegativeEvents)', () => {
  describe('default (off): no negative symptomChange', () => {
    it('no exacerbate or came-back across 10 seeds × 11 visits', () => {
      const ctx = makeContext() // allowNegativeEvents defaults to undefined/false
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed })
        for (const s of states) {
          expect(
            s.symptomChange,
            `seed=${seed} v${s.visitIndex}: "${s.symptomChange}" is negative`,
          ).not.toMatch(/exacerbate|came back/)
        }
      }
    })

    it('only improvement or similar symptomChange', () => {
      const ctx = makeContext()
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed })
        for (const s of states) {
          const sc = s.symptomChange
          const isPositiveOrNeutral =
            sc.includes('improvement') || sc.includes('similar')
          expect(
            isPositiveOrNeutral,
            `seed=${seed} v${s.visitIndex}: "${sc}" is neither improvement nor similar`,
          ).toBe(true)
        }
      }
    })
  })

  describe('on: allows negative events ≤ 10%', () => {
    it('negative events appear but ≤ 10% across 10 seeds × 20 visits', () => {
      const ctx = makeContext({ allowNegativeEvents: true })
      let totalVisits = 0
      let negativeVisits = 0
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed })
        for (const s of states) {
          totalVisits++
          if (
            s.symptomChange.includes('exacerbate') ||
            s.symptomChange.includes('came back')
          ) {
            negativeVisits++
          }
        }
      }
      const rate = negativeVisits / totalVisits
      // Should have SOME negative events (> 0)
      expect(negativeVisits, 'no negative events at all').toBeGreaterThan(0)
      // But ≤ 10%
      expect(
        rate,
        `negative rate ${(rate * 100).toFixed(1)}% > 10%`,
      ).toBeLessThanOrEqual(0.10)
    })

    it('negative events never appear on visit 1', () => {
      const ctx = makeContext({ allowNegativeEvents: true })
      for (const seed of SEEDS) {
        const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed })
        expect(
          states[0].symptomChange,
          `seed=${seed} v1 is negative`,
        ).not.toMatch(/exacerbate|came back/)
      }
    })
  })
})
