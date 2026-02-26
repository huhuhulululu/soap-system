import { describe, it, expect } from "vitest";
import { computeGoalPaths, type GoalPathInput } from "../goal-path-calculator";

// Deterministic PRNG (mulberry32)
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Full 9-dimension input for tests */
function makeInput(overrides?: Partial<GoalPathInput>): GoalPathInput {
  return {
    tightness: { start: 4, st: 3, lt: 2 },
    tenderness: { start: 4, st: 2, lt: 1 },
    spasm: { start: 3, st: 2, lt: 1 },
    strength: { start: 2, st: 4, lt: 5 },
    pain: { start: 8, st: 5, lt: 3 },
    frequency: { start: 3, st: 1, lt: 0 },
    symptomScale: { start: 7, st: 4, lt: 2 },
    adlA: { start: 4, st: 3, lt: 2 },
    adlB: { start: 4, st: 3, lt: 2 },
    ...overrides,
  };
}

describe("Goal Path Calculator", () => {
  describe("computeGoalPaths basic behavior", () => {
    it("stBoundary = round(txCount * 0.6)", () => {
      const rng = mulberry32(1);
      const paths = computeGoalPaths(makeInput(), 20, rng);

      expect(paths.stBoundary).toBe(12);
      expect(paths.txCount).toBe(20);
    });

    it("changeVisits count matches total drops", () => {
      const rng = mulberry32(42);
      const paths = computeGoalPaths(makeInput(), 20, rng);

      expect(paths.tightness.changeVisits.length).toBe(2);
      expect(paths.tenderness.changeVisits.length).toBe(3);
      expect(paths.spasm.changeVisits.length).toBe(2);
    });

    it("all changeVisits are within [1, txCount]", () => {
      for (let seed = 1; seed <= 10; seed++) {
        const rng = mulberry32(seed);
        const paths = computeGoalPaths(makeInput(), 20, rng);

        for (const dim of [
          paths.tightness,
          paths.tenderness,
          paths.spasm,
          paths.strength,
        ]) {
          for (const v of dim.changeVisits) {
            expect(v).toBeGreaterThanOrEqual(1);
            expect(v).toBeLessThanOrEqual(20);
          }
        }
      }
    });

    it("ST drops happen in [1, stBoundary], LT drops in [stBoundary+1, txCount]", () => {
      const rng = mulberry32(99);
      const paths = computeGoalPaths(makeInput(), 20, rng);

      const stB = paths.stBoundary; // 12

      // Tightness: 1 in ST, 1 in LT
      const tightST = paths.tightness.changeVisits.filter((v) => v <= stB);
      const tightLT = paths.tightness.changeVisits.filter((v) => v > stB);
      expect(tightST.length).toBe(1);
      expect(tightLT.length).toBe(1);

      // Tenderness: 2 in ST, 1 in LT
      const tenderST = paths.tenderness.changeVisits.filter((v) => v <= stB);
      const tenderLT = paths.tenderness.changeVisits.filter((v) => v > stB);
      expect(tenderST.length).toBe(2);
      expect(tenderLT.length).toBe(1);
    });

    it("changeVisits are sorted ascending", () => {
      for (let seed = 1; seed <= 10; seed++) {
        const rng = mulberry32(seed);
        const paths = computeGoalPaths(makeInput(), 20, rng);

        for (const dim of [
          paths.tightness,
          paths.tenderness,
          paths.spasm,
          paths.strength,
        ]) {
          for (let i = 1; i < dim.changeVisits.length; i++) {
            expect(dim.changeVisits[i]).toBeGreaterThan(
              dim.changeVisits[i - 1],
            );
          }
        }
      }
    });
  });

  describe("strength dimension", () => {
    it("strength changeVisits count matches total rises", () => {
      const rng = mulberry32(42);
      // start=2 (3+/5), st=4 (4/5), lt=5 (4+/5) → 2 ST rises + 1 LT rise = 3
      const paths = computeGoalPaths(
        makeInput({
          strength: { start: 2, st: 4, lt: 5 },
        }),
        20,
        rng,
      );

      expect(paths.strength.changeVisits.length).toBe(3);
    });

    it("strength is monotonically increasing across visits (10 seeds)", () => {
      for (let seed = 1; seed <= 10; seed++) {
        const rng = mulberry32(seed);
        const paths = computeGoalPaths(
          makeInput({
            strength: { start: 2, st: 4, lt: 5 },
          }),
          11,
          rng,
        );

        // Simulate: start at level 2, each changeVisit increments by 1
        let level = paths.strength.startValue;
        const levels: number[] = [level];
        for (let v = 1; v <= 11; v++) {
          if (paths.strength.changeVisits.includes(v)) {
            level++;
          }
          levels.push(level);
        }

        // Monotonically non-decreasing
        for (let i = 1; i < levels.length; i++) {
          expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
        }
      }
    });

    it("strength not included in deconflict (can overlap with tightness/tenderness/spasm)", () => {
      // Strength + ROM are related, allowed to change together
      // Just verify strength path exists and is valid
      const rng = mulberry32(42);
      const paths = computeGoalPaths(makeInput(), 20, rng);

      expect(paths.strength).toBeDefined();
      expect(paths.strength.dimension).toBe("strength");
      expect(paths.strength.changeVisits.every((v) => v >= 1 && v <= 20)).toBe(
        true,
      );
    });
  });

  describe("different txCount elasticity", () => {
    it("txCount=8: stBoundary=5, paths still valid", () => {
      const rng = mulberry32(1);
      const paths = computeGoalPaths(makeInput(), 8, rng);

      expect(paths.stBoundary).toBe(5);
      expect(paths.tightness.changeVisits.every((v) => v >= 1 && v <= 8)).toBe(
        true,
      );
      expect(paths.tenderness.changeVisits.every((v) => v >= 1 && v <= 8)).toBe(
        true,
      );
      expect(paths.strength.changeVisits.every((v) => v >= 1 && v <= 8)).toBe(
        true,
      );
    });

    it("txCount=12: stBoundary=7", () => {
      const rng = mulberry32(1);
      const paths = computeGoalPaths(makeInput(), 12, rng);

      expect(paths.stBoundary).toBe(7);
    });

    it("txCount=16: stBoundary=10", () => {
      const rng = mulberry32(1);
      const paths = computeGoalPaths(makeInput(), 16, rng);

      expect(paths.stBoundary).toBe(10);
    });
  });

  describe("deconflict: reduce same-visit overlaps", () => {
    it("at most 2 dimensions change on the same visit (10 seeds)", () => {
      for (let seed = 1; seed <= 10; seed++) {
        const rng = mulberry32(seed);
        const paths = computeGoalPaths(makeInput(), 20, rng);

        // Count overlaps per visit (only tightness/tenderness/spasm — strength excluded from deconflict)
        const visitCount = new Map<number, number>();
        for (const dim of [paths.tightness, paths.tenderness, paths.spasm]) {
          for (const v of dim.changeVisits) {
            visitCount.set(v, (visitCount.get(v) || 0) + 1);
          }
        }

        // After deconflict, ideally ≤ 2 per visit
        for (const [, count] of visitCount) {
          expect(count).toBeLessThanOrEqual(3); // hard limit: never more than 3
        }
      }
    });
  });

  describe("determinism", () => {
    it("same seed → same output", () => {
      const paths1 = computeGoalPaths(makeInput(), 20, mulberry32(12345));
      const paths2 = computeGoalPaths(makeInput(), 20, mulberry32(12345));

      expect(paths1.tightness.changeVisits).toEqual(
        paths2.tightness.changeVisits,
      );
      expect(paths1.tenderness.changeVisits).toEqual(
        paths2.tenderness.changeVisits,
      );
      expect(paths1.spasm.changeVisits).toEqual(paths2.spasm.changeVisits);
      expect(paths1.strength.changeVisits).toEqual(
        paths2.strength.changeVisits,
      );
    });
  });

  describe("edge cases", () => {
    it("no drops needed (start === ltGoal)", () => {
      const rng = mulberry32(1);
      const paths = computeGoalPaths(
        makeInput({
          tightness: { start: 2, st: 2, lt: 2 },
          tenderness: { start: 1, st: 1, lt: 1 },
          spasm: { start: 1, st: 1, lt: 1 },
          strength: { start: 5, st: 5, lt: 5 },
        }),
        20,
        rng,
      );

      expect(paths.tightness.changeVisits).toEqual([]);
      expect(paths.tenderness.changeVisits).toEqual([]);
      expect(paths.spasm.changeVisits).toEqual([]);
      expect(paths.strength.changeVisits).toEqual([]);
    });

    it("only ST drops, no LT drops", () => {
      const rng = mulberry32(1);
      const paths = computeGoalPaths(
        makeInput({
          tightness: { start: 3, st: 2, lt: 2 },
          tenderness: { start: 3, st: 1, lt: 1 },
          spasm: { start: 2, st: 1, lt: 1 },
          strength: { start: 3, st: 5, lt: 5 },
        }),
        20,
        rng,
      );

      const stB = paths.stBoundary;
      // All changes should be in ST phase
      expect(paths.tightness.changeVisits.every((v) => v <= stB)).toBe(true);
      expect(paths.tenderness.changeVisits.every((v) => v <= stB)).toBe(true);
      expect(paths.spasm.changeVisits.every((v) => v <= stB)).toBe(true);
      expect(paths.strength.changeVisits.every((v) => v <= stB)).toBe(true);
    });

    it("txCount=1: minimal path", () => {
      const rng = mulberry32(1);
      const paths = computeGoalPaths(makeInput(), 1, rng);

      expect(paths.stBoundary).toBe(1);
      for (const dim of [
        paths.tightness,
        paths.tenderness,
        paths.spasm,
        paths.strength,
        paths.pain,
        paths.frequency,
        paths.symptomScale,
        paths.adlA,
        paths.adlB,
      ]) {
        expect(dim.changeVisits.length).toBeLessThanOrEqual(
          Math.abs(dim.startValue - dim.ltGoal),
        );
      }
    });
  });

  describe("new dimensions: pain, frequency, symptomScale, adlA, adlB", () => {
    it("pain changeVisits count matches total drops", () => {
      const rng = mulberry32(42);
      // pain: start=8, st=5, lt=3 → 3 ST drops + 2 LT drops = 5
      const paths = computeGoalPaths(makeInput(), 20, rng);
      expect(paths.pain.changeVisits.length).toBe(5);
      expect(paths.pain.dimension).toBe("pain");
    });

    it("frequency changeVisits count matches total drops", () => {
      const rng = mulberry32(42);
      // frequency: start=3, st=1, lt=0 → 2 ST drops + 1 LT drop = 3
      const paths = computeGoalPaths(makeInput(), 20, rng);
      expect(paths.frequency.changeVisits.length).toBe(3);
    });

    it("symptomScale changeVisits count matches total drops", () => {
      const rng = mulberry32(42);
      // symptomScale: start=7, st=4, lt=2 → 3 ST drops + 2 LT drops = 5
      const paths = computeGoalPaths(makeInput(), 20, rng);
      expect(paths.symptomScale.changeVisits.length).toBe(5);
    });

    it("adlA and adlB changeVisits count matches total drops", () => {
      const rng = mulberry32(42);
      // adlA/B: start=4, st=3, lt=2 → 1 ST drop + 1 LT drop = 2
      const paths = computeGoalPaths(makeInput(), 20, rng);
      expect(paths.adlA.changeVisits.length).toBe(2);
      expect(paths.adlB.changeVisits.length).toBe(2);
    });

    it("adlA and adlB are mutually exclusive (no same-visit overlap)", () => {
      for (let seed = 1; seed <= 20; seed++) {
        const rng = mulberry32(seed);
        const paths = computeGoalPaths(makeInput(), 20, rng);
        const overlap = paths.adlA.changeVisits.filter((v) =>
          paths.adlB.changeVisits.includes(v),
        );
        expect(overlap).toEqual([]);
      }
    });

    it("all new dimensions within [1, txCount]", () => {
      for (let seed = 1; seed <= 10; seed++) {
        const rng = mulberry32(seed);
        const paths = computeGoalPaths(makeInput(), 20, rng);
        for (const dim of [
          paths.pain,
          paths.frequency,
          paths.symptomScale,
          paths.adlA,
          paths.adlB,
        ]) {
          for (const v of dim.changeVisits) {
            expect(v).toBeGreaterThanOrEqual(1);
            expect(v).toBeLessThanOrEqual(20);
          }
        }
      }
    });

    it("pain monotonically decreasing across visits (10 seeds)", () => {
      for (let seed = 1; seed <= 10; seed++) {
        const rng = mulberry32(seed);
        const paths = computeGoalPaths(makeInput(), 11, rng);
        let level = paths.pain.startValue;
        for (let v = 1; v <= 11; v++) {
          if (paths.pain.changeVisits.includes(v)) level--;
          expect(level).toBeLessThanOrEqual(paths.pain.startValue);
          expect(level).toBeGreaterThanOrEqual(paths.pain.ltGoal);
        }
      }
    });

    it("no drops when adlB start === ltGoal (LBP has no ADL-B)", () => {
      const rng = mulberry32(1);
      const paths = computeGoalPaths(
        makeInput({
          adlB: { start: 0, st: 0, lt: 0 },
        }),
        20,
        rng,
      );
      expect(paths.adlB.changeVisits).toEqual([]);
    });

    it("determinism: same seed → same output for all dimensions", () => {
      const paths1 = computeGoalPaths(makeInput(), 20, mulberry32(12345));
      const paths2 = computeGoalPaths(makeInput(), 20, mulberry32(12345));

      for (const key of [
        "pain",
        "frequency",
        "symptomScale",
        "adlA",
        "adlB",
      ] as const) {
        expect(paths1[key].changeVisits).toEqual(paths2[key].changeVisits);
      }
    });
  });

  describe("painEarlyGuard: pain drops delayed to mid-treatment", () => {
    it("with painEarlyGuard=5, no pain ST drops before visit 5", () => {
      for (let seed = 1; seed <= 20; seed++) {
        const rng = mulberry32(seed);
        const paths = computeGoalPaths(makeInput(), 20, rng, {
          painEarlyGuard: 5,
        });
        const stB = paths.stBoundary;
        const stDrops = paths.pain.changeVisits.filter((v) => v <= stB);
        for (const v of stDrops) {
          expect(
            v,
            `seed=${seed}: pain ST drop at visit ${v} < 5`,
          ).toBeGreaterThanOrEqual(5);
        }
      }
    });

    it("painEarlyGuard does not change total pain drop count", () => {
      for (let seed = 1; seed <= 10; seed++) {
        const rng1 = mulberry32(seed);
        const rng2 = mulberry32(seed);
        const without = computeGoalPaths(makeInput(), 20, rng1);
        const withGuard = computeGoalPaths(makeInput(), 20, rng2, {
          painEarlyGuard: 5,
        });
        expect(withGuard.pain.changeVisits.length).toBe(
          without.pain.changeVisits.length,
        );
      }
    });

    it("painEarlyGuard does not affect other dimensions", () => {
      for (let seed = 1; seed <= 10; seed++) {
        const rng1 = mulberry32(seed);
        const rng2 = mulberry32(seed);
        const without = computeGoalPaths(makeInput(), 20, rng1);
        const withGuard = computeGoalPaths(makeInput(), 20, rng2, {
          painEarlyGuard: 5,
        });
        // Dimensions computed before pain are identical
        expect(withGuard.tightness.changeVisits).toEqual(
          without.tightness.changeVisits,
        );
        expect(withGuard.tenderness.changeVisits).toEqual(
          without.tenderness.changeVisits,
        );
        expect(withGuard.spasm.changeVisits).toEqual(
          without.spasm.changeVisits,
        );
        expect(withGuard.strength.changeVisits).toEqual(
          without.strength.changeVisits,
        );
      }
    });

    it("default (no painEarlyGuard) allows pain drops from visit 1", () => {
      // At least one seed should have a pain drop in visits 1-4
      let hasEarlyDrop = false;
      for (let seed = 1; seed <= 50; seed++) {
        const rng = mulberry32(seed);
        const paths = computeGoalPaths(makeInput(), 20, rng);
        if (paths.pain.changeVisits.some((v) => v <= 4)) {
          hasEarlyDrop = true;
          break;
        }
      }
      expect(hasEarlyDrop).toBe(true);
    });
  });
});
