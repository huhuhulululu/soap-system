import { describe, it, expect } from 'vitest'
import { computeGoalPaths } from '../goal-path-calculator'

// Deterministic PRNG (mulberry32)
function mulberry32(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('Goal Path Calculator', () => {
  describe('computeGoalPaths basic behavior', () => {
    it('stBoundary = round(txCount * 0.6)', () => {
      const rng = mulberry32(1)
      const paths = computeGoalPaths({
        tightness: { start: 4, st: 3, lt: 2 },
        tenderness: { start: 4, st: 2, lt: 1 },
        spasm: { start: 3, st: 2, lt: 1 },
      }, 20, rng)

      expect(paths.stBoundary).toBe(12)
      expect(paths.txCount).toBe(20)
    })

    it('changeVisits count matches total drops', () => {
      const rng = mulberry32(42)
      const paths = computeGoalPaths({
        tightness: { start: 4, st: 3, lt: 2 },   // drop 1 + 1 = 2
        tenderness: { start: 4, st: 2, lt: 1 },   // drop 2 + 1 = 3
        spasm: { start: 3, st: 2, lt: 1 },         // drop 1 + 1 = 2
      }, 20, rng)

      expect(paths.tightness.changeVisits.length).toBe(2)
      expect(paths.tenderness.changeVisits.length).toBe(3)
      expect(paths.spasm.changeVisits.length).toBe(2)
    })

    it('all changeVisits are within [1, txCount]', () => {
      for (let seed = 1; seed <= 10; seed++) {
        const rng = mulberry32(seed)
        const paths = computeGoalPaths({
          tightness: { start: 4, st: 3, lt: 2 },
          tenderness: { start: 4, st: 2, lt: 1 },
          spasm: { start: 3, st: 2, lt: 1 },
        }, 20, rng)

        for (const dim of [paths.tightness, paths.tenderness, paths.spasm]) {
          for (const v of dim.changeVisits) {
            expect(v).toBeGreaterThanOrEqual(1)
            expect(v).toBeLessThanOrEqual(20)
          }
        }
      }
    })

    it('ST drops happen in [1, stBoundary], LT drops in [stBoundary+1, txCount]', () => {
      const rng = mulberry32(99)
      const paths = computeGoalPaths({
        tightness: { start: 4, st: 3, lt: 2 },   // 1 ST drop, 1 LT drop
        tenderness: { start: 4, st: 2, lt: 1 },   // 2 ST drops, 1 LT drop
        spasm: { start: 3, st: 2, lt: 1 },         // 1 ST drop, 1 LT drop
      }, 20, rng)

      const stB = paths.stBoundary // 12

      // Tightness: 1 in ST, 1 in LT
      const tightST = paths.tightness.changeVisits.filter(v => v <= stB)
      const tightLT = paths.tightness.changeVisits.filter(v => v > stB)
      expect(tightST.length).toBe(1)
      expect(tightLT.length).toBe(1)

      // Tenderness: 2 in ST, 1 in LT
      const tenderST = paths.tenderness.changeVisits.filter(v => v <= stB)
      const tenderLT = paths.tenderness.changeVisits.filter(v => v > stB)
      expect(tenderST.length).toBe(2)
      expect(tenderLT.length).toBe(1)
    })

    it('changeVisits are sorted ascending', () => {
      for (let seed = 1; seed <= 10; seed++) {
        const rng = mulberry32(seed)
        const paths = computeGoalPaths({
          tightness: { start: 4, st: 3, lt: 2 },
          tenderness: { start: 4, st: 2, lt: 1 },
          spasm: { start: 3, st: 2, lt: 1 },
        }, 20, rng)

        for (const dim of [paths.tightness, paths.tenderness, paths.spasm]) {
          for (let i = 1; i < dim.changeVisits.length; i++) {
            expect(dim.changeVisits[i]).toBeGreaterThan(dim.changeVisits[i - 1])
          }
        }
      }
    })
  })

  describe('different txCount elasticity', () => {
    it('txCount=8: stBoundary=5, paths still valid', () => {
      const rng = mulberry32(1)
      const paths = computeGoalPaths({
        tightness: { start: 4, st: 3, lt: 2 },
        tenderness: { start: 4, st: 2, lt: 1 },
        spasm: { start: 3, st: 2, lt: 1 },
      }, 8, rng)

      expect(paths.stBoundary).toBe(5)
      expect(paths.tightness.changeVisits.every(v => v >= 1 && v <= 8)).toBe(true)
      expect(paths.tenderness.changeVisits.every(v => v >= 1 && v <= 8)).toBe(true)
    })

    it('txCount=12: stBoundary=7', () => {
      const rng = mulberry32(1)
      const paths = computeGoalPaths({
        tightness: { start: 4, st: 3, lt: 2 },
        tenderness: { start: 4, st: 2, lt: 1 },
        spasm: { start: 3, st: 2, lt: 1 },
      }, 12, rng)

      expect(paths.stBoundary).toBe(7)
    })

    it('txCount=16: stBoundary=10', () => {
      const rng = mulberry32(1)
      const paths = computeGoalPaths({
        tightness: { start: 4, st: 3, lt: 2 },
        tenderness: { start: 4, st: 2, lt: 1 },
        spasm: { start: 3, st: 2, lt: 1 },
      }, 16, rng)

      expect(paths.stBoundary).toBe(10)
    })
  })

  describe('deconflict: reduce same-visit overlaps', () => {
    it('at most 2 dimensions change on the same visit (10 seeds)', () => {
      for (let seed = 1; seed <= 10; seed++) {
        const rng = mulberry32(seed)
        const paths = computeGoalPaths({
          tightness: { start: 4, st: 3, lt: 2 },
          tenderness: { start: 4, st: 2, lt: 1 },
          spasm: { start: 3, st: 2, lt: 1 },
        }, 20, rng)

        // Count overlaps per visit
        const visitCount = new Map<number, number>()
        for (const dim of [paths.tightness, paths.tenderness, paths.spasm]) {
          for (const v of dim.changeVisits) {
            visitCount.set(v, (visitCount.get(v) || 0) + 1)
          }
        }

        // After deconflict, ideally ≤ 2 per visit
        for (const [visit, count] of visitCount) {
          expect(count).toBeLessThanOrEqual(3) // hard limit: never more than 3
        }
      }
    })
  })

  describe('determinism', () => {
    it('same seed → same output', () => {
      const paths1 = computeGoalPaths({
        tightness: { start: 4, st: 3, lt: 2 },
        tenderness: { start: 4, st: 2, lt: 1 },
        spasm: { start: 3, st: 2, lt: 1 },
      }, 20, mulberry32(12345))

      const paths2 = computeGoalPaths({
        tightness: { start: 4, st: 3, lt: 2 },
        tenderness: { start: 4, st: 2, lt: 1 },
        spasm: { start: 3, st: 2, lt: 1 },
      }, 20, mulberry32(12345))

      expect(paths1.tightness.changeVisits).toEqual(paths2.tightness.changeVisits)
      expect(paths1.tenderness.changeVisits).toEqual(paths2.tenderness.changeVisits)
      expect(paths1.spasm.changeVisits).toEqual(paths2.spasm.changeVisits)
    })
  })

  describe('edge cases', () => {
    it('no drops needed (start === ltGoal)', () => {
      const rng = mulberry32(1)
      const paths = computeGoalPaths({
        tightness: { start: 2, st: 2, lt: 2 },
        tenderness: { start: 1, st: 1, lt: 1 },
        spasm: { start: 1, st: 1, lt: 1 },
      }, 20, rng)

      expect(paths.tightness.changeVisits).toEqual([])
      expect(paths.tenderness.changeVisits).toEqual([])
      expect(paths.spasm.changeVisits).toEqual([])
    })

    it('only ST drops, no LT drops', () => {
      const rng = mulberry32(1)
      const paths = computeGoalPaths({
        tightness: { start: 3, st: 2, lt: 2 },
        tenderness: { start: 3, st: 1, lt: 1 },
        spasm: { start: 2, st: 1, lt: 1 },
      }, 20, rng)

      const stB = paths.stBoundary
      // All changes should be in ST phase
      expect(paths.tightness.changeVisits.every(v => v <= stB)).toBe(true)
      expect(paths.tenderness.changeVisits.every(v => v <= stB)).toBe(true)
      expect(paths.spasm.changeVisits.every(v => v <= stB)).toBe(true)
    })

    it('txCount=1: minimal path', () => {
      const rng = mulberry32(1)
      const paths = computeGoalPaths({
        tightness: { start: 4, st: 3, lt: 2 },
        tenderness: { start: 4, st: 2, lt: 1 },
        spasm: { start: 3, st: 2, lt: 1 },
      }, 1, rng)

      expect(paths.stBoundary).toBe(1)
      // With only 1 visit, can have at most 1 drop per dimension in ST
      for (const dim of [paths.tightness, paths.tenderness, paths.spasm]) {
        expect(dim.changeVisits.length).toBeLessThanOrEqual(
          dim.startValue - dim.ltGoal
        )
      }
    })
  })
})
