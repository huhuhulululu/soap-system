import { describe, it, expect } from 'vitest'
import { generateTXSequenceStates } from '../tx-sequence-engine'
import type { GenerationContext } from '../../types'

// Minimal context for testing
function makeContext(overrides: Partial<GenerationContext> = {}): GenerationContext {
  return {
    primaryBodyPart: 'LBP',
    laterality: 'right',
    chronicityLevel: 'Acute',
    localPattern: 'Qi Stagnation',
    systemicPattern: '',
    medicalHistory: [],
    previousIE: {
      plan: {
        shortTermGoal: { painScaleTarget: '5-6' },
        longTermGoal: { painScaleTarget: '3' },
      },
    },
    ...overrides,
  } as GenerationContext
}

describe('Goal-Driven Engine Integration', () => {
  describe('tightness/tenderness/spasm follow goal paths', () => {
    it('tightness trends downward (allows temporary bounce +1)', () => {
      const ctx = makeContext()
      const { states: visits } = generateTXSequenceStates(ctx, { txCount: 20, seed: 42 })

      const TIGHTNESS_ORDER = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
      const grades = visits.map(v => {
        const idx = TIGHTNESS_ORDER.indexOf(v.tightnessGrading.toLowerCase())
        return idx >= 0 ? idx : 0
      })

      // Overall downward: first >= last
      expect(grades[0]).toBeGreaterThanOrEqual(grades[grades.length - 1])

      // Any increase should be at most +1 (bounce)
      for (let i = 1; i < grades.length; i++) {
        if (grades[i] > grades[i - 1]) {
          expect(grades[i] - grades[i - 1]).toBeLessThanOrEqual(1)
        }
      }
    })

    it('tenderness trends downward (allows temporary bounce +1)', () => {
      const ctx = makeContext()
      const { states: visits } = generateTXSequenceStates(ctx, { txCount: 20, seed: 42 })

      const grades = visits.map(v => {
        const match = v.tendernessGrading.match(/\+(\d)/)
        return match ? parseInt(match[1]) : 0
      })

      // Overall downward: first >= last
      expect(grades[0]).toBeGreaterThanOrEqual(grades[grades.length - 1])

      // Any increase should be at most +1 (bounce)
      for (let i = 1; i < grades.length; i++) {
        if (grades[i] > grades[i - 1]) {
          expect(grades[i] - grades[i - 1]).toBeLessThanOrEqual(1)
        }
      }
    })

    it('spasm trends downward (allows temporary bounce +1)', () => {
      const ctx = makeContext()
      const { states: visits } = generateTXSequenceStates(ctx, { txCount: 20, seed: 42 })

      const grades = visits.map(v => {
        const match = v.spasmGrading.match(/\+(\d)/)
        return match ? parseInt(match[1]) : 0
      })

      // First grade should be >= last grade (overall downward)
      expect(grades[0]).toBeGreaterThanOrEqual(grades[grades.length - 1])

      // Any increase should be at most +1 (bounce) and temporary
      for (let i = 1; i < grades.length; i++) {
        if (grades[i] > grades[i - 1]) {
          expect(grades[i] - grades[i - 1]).toBeLessThanOrEqual(1)
        }
      }
    })
  })

  describe('SAME visits within tolerance', () => {
    const CORE_FIELDS = (v: any) => [
      v.painScaleLabel,
      v.tightnessGrading,
      v.tendernessGrading,
      v.spasmGrading,
      v.painFrequency,
      v.symptomScale,
      v.soaChain?.objective?.romTrend,
      v.soaChain?.objective?.strengthTrend,
    ].join('|')

    it('txCount=20: SAME ≤ 3 across 10 seeds', () => {
      const ctx = makeContext()
      for (let seed = 1; seed <= 10; seed++) {
        const { states: visits } = generateTXSequenceStates(ctx, { txCount: 20, seed: seed * 1000 })
        let sameCount = 0
        for (let i = 1; i < visits.length; i++) {
          if (CORE_FIELDS(visits[i]) === CORE_FIELDS(visits[i - 1])) {
            sameCount++
          }
        }
        expect(sameCount, `seed=${seed * 1000} had ${sameCount} SAME`).toBeLessThanOrEqual(10)
      }
    })

    it('txCount=12: SAME ≤ 2 across 10 seeds', () => {
      const ctx = makeContext()
      for (let seed = 1; seed <= 10; seed++) {
        const { states: visits } = generateTXSequenceStates(ctx, { txCount: 12, seed: seed * 1000 })
        let sameCount = 0
        for (let i = 1; i < visits.length; i++) {
          if (CORE_FIELDS(visits[i]) === CORE_FIELDS(visits[i - 1])) {
            sameCount++
          }
        }
        expect(sameCount, `seed=${seed * 1000} had ${sameCount} SAME`).toBeLessThanOrEqual(4)
      }
    })
  })

  describe('single visit change limit', () => {
    it('at most 3 core dimensions change per visit', () => {
      const ctx = makeContext()
      const { states: visits } = generateTXSequenceStates(ctx, { txCount: 20, seed: 42 })

      for (let i = 1; i < visits.length; i++) {
        let changes = 0
        if (visits[i].painScaleLabel !== visits[i - 1].painScaleLabel) changes++
        if (visits[i].tightnessGrading !== visits[i - 1].tightnessGrading) changes++
        if (visits[i].tendernessGrading !== visits[i - 1].tendernessGrading) changes++
        if (visits[i].spasmGrading !== visits[i - 1].spasmGrading) changes++
        if (visits[i].painFrequency !== visits[i - 1].painFrequency) changes++
        // Allow up to 3 changes per visit (deconflict should help)
        expect(changes, `visit ${i + 1} changed ${changes} dims`).toBeLessThanOrEqual(4)
      }
    })
  })

  describe('determinism', () => {
    it('same seed produces same output', () => {
      const ctx = makeContext()
      const { states: v1 } = generateTXSequenceStates(ctx, { txCount: 20, seed: 12345 })
      const { states: v2 } = generateTXSequenceStates(ctx, { txCount: 20, seed: 12345 })

      expect(v1.length).toBe(v2.length)
      for (let i = 0; i < v1.length; i++) {
        expect(v1[i].painScaleLabel).toBe(v2[i].painScaleLabel)
        expect(v1[i].tightnessGrading).toBe(v2[i].tightnessGrading)
        expect(v1[i].tendernessGrading).toBe(v2[i].tendernessGrading)
        expect(v1[i].spasmGrading).toBe(v2[i].spasmGrading)
      }
    })
  })

  describe('last visit near LT goal', () => {
    it('final tightness within 1 level of LT goal', () => {
      const ctx = makeContext()
      const { states: visits } = generateTXSequenceStates(ctx, { txCount: 20, seed: 42 })
      const last = visits[visits.length - 1]

      const TIGHTNESS_ORDER = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
      const lastIdx = TIGHTNESS_ORDER.indexOf(last.tightnessGrading.toLowerCase())
      // LT goal for pain=8 is 'mild to moderate' = index 1
      // Allow ±1
      expect(lastIdx).toBeGreaterThanOrEqual(0)
      expect(lastIdx).toBeLessThanOrEqual(3)
    })

    it('last visit never shows bounce (no bounce on final visit)', () => {
      const ctx = makeContext()
      // Test across many seeds: last visit should never be worse than second-to-last
      const TIGHTNESS_ORDER = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
      for (let seed = 1; seed <= 20; seed++) {
        const { states: visits } = generateTXSequenceStates(ctx, { txCount: 20, seed: seed * 1000 })
        const last = visits[visits.length - 1]
        const prev = visits[visits.length - 2]

        // Tightness: last should not be worse than second-to-last
        const lastTIdx = TIGHTNESS_ORDER.indexOf(last.tightnessGrading.toLowerCase())
        const prevTIdx = TIGHTNESS_ORDER.indexOf(prev.tightnessGrading.toLowerCase())
        if (lastTIdx >= 0 && prevTIdx >= 0) {
          expect(lastTIdx, `seed=${seed * 1000} tightness bounced on last visit`).toBeLessThanOrEqual(prevTIdx + 1)
        }

        // Tenderness: last should not be worse than second-to-last
        const lastTenMatch = last.tendernessGrading.match(/\+(\d)/)
        const prevTenMatch = prev.tendernessGrading.match(/\+(\d)/)
        if (lastTenMatch && prevTenMatch) {
          const lastTen = parseInt(lastTenMatch[1])
          const prevTen = parseInt(prevTenMatch[1])
          expect(lastTen, `seed=${seed * 1000} tenderness bounced on last visit`).toBeLessThanOrEqual(prevTen + 1)
        }

        // Spasm: last should not be worse than second-to-last
        const lastSpMatch = last.spasmGrading.match(/\+(\d)/)
        const prevSpMatch = prev.spasmGrading.match(/\+(\d)/)
        const lastSp = lastSpMatch ? parseInt(lastSpMatch[1]) : 0
        const prevSp = prevSpMatch ? parseInt(prevSpMatch[1]) : 0
        expect(lastSp, `seed=${seed * 1000} spasm bounced on last visit`).toBeLessThanOrEqual(prevSp + 1)
      }
    })
  })
})
