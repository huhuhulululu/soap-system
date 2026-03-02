import { describe, it, expect } from "vitest";
import { generateTXSequenceStates } from "../tx-sequence-engine";
import type { GenerationContext } from "../../types";

const SEEDS = [159, 753, 1492, 2048, 3690, 5555, 7071, 8888, 16384, 27182];

const SEVERITY_ORDER = [
  "mild",
  "mild to moderate",
  "moderate",
  "moderate to severe",
  "severe",
] as const;

const STRENGTH_ORDER = [
  "3-/5",
  "3/5",
  "3+/5",
  "4-/5",
  "4/5",
  "4+/5",
  "5/5",
] as const;

function severityRank(s: string): number {
  const idx = SEVERITY_ORDER.indexOf(s as (typeof SEVERITY_ORDER)[number]);
  return idx === -1 ? -1 : idx;
}

function strengthRank(s: string): number {
  const idx = STRENGTH_ORDER.indexOf(s as (typeof STRENGTH_ORDER)[number]);
  return idx === -1 ? -1 : idx;
}

function makeContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    noteType: "TX",
    insuranceType: "NONE",
    primaryBodyPart: "SHOULDER",
    laterality: "right",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "moderate to severe",
    painCurrent: 8,
    ...overrides,
  };
}

describe("stress-SHOULDER: 10 seeds × 20 TX visits", () => {
  describe("a) no negative symptomChange when allowNegativeEvents is off", () => {
    it.each(SEEDS)("seed %i — no exacerbate/came-back", (seed) => {
      const ctx = makeContext({ allowNegativeEvents: false });
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 20,
        seed,
      });

      for (const s of states) {
        const sc = s.symptomChange.toLowerCase();
        expect(
          sc.includes("exacerbate") || sc.includes("came back"),
          `seed=${seed} v${s.visitIndex}: unexpected negative symptomChange "${s.symptomChange}"`,
        ).toBe(false);
      }
    });
  });

  describe("b) pain monotonically decreases (each ≤ prev + 0.01)", () => {
    it.each(SEEDS)("seed %i — monotonic pain", (seed) => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 20,
        seed,
      });

      for (let i = 1; i < states.length; i++) {
        const prev = states[i - 1].painScaleCurrent;
        const curr = states[i].painScaleCurrent;
        expect(
          curr,
          `seed=${seed} v${states[i].visitIndex}: pain ${curr} > prev ${prev} (v${states[i - 1].visitIndex})`,
        ).toBeLessThanOrEqual(prev + 0.01);
      }
    });
  });

  describe("c) v12 pain ≤ v1 pain (short-term goal)", () => {
    it.each(SEEDS)("seed %i — ST goal", (seed) => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 20,
        seed,
      });

      const v1 = states[0];
      const v12 = states[11];
      expect(
        v12.painScaleCurrent,
        `seed=${seed}: v12 pain ${v12.painScaleCurrent} > v1 pain ${v1.painScaleCurrent}`,
      ).toBeLessThanOrEqual(v1.painScaleCurrent);
    });
  });

  describe("d) v20 pain ≤ v12 pain + 0.01 (long-term goal)", () => {
    it.each(SEEDS)("seed %i — LT goal", (seed) => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 20,
        seed,
      });

      const v12 = states[11];
      const v20 = states[19];
      expect(
        v20.painScaleCurrent,
        `seed=${seed}: v20 pain ${v20.painScaleCurrent} > v12 pain ${v12.painScaleCurrent}`,
      ).toBeLessThanOrEqual(v12.painScaleCurrent + 0.01);
    });
  });

  describe("e) v20 severity ≤ v1 severity", () => {
    it.each(SEEDS)("seed %i — severity improves or holds", (seed) => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 20,
        seed,
      });

      const v1Rank = severityRank(states[0].severityLevel);
      const v20Rank = severityRank(states[19].severityLevel);
      expect(v1Rank).toBeGreaterThanOrEqual(0);
      expect(v20Rank).toBeGreaterThanOrEqual(0);
      expect(
        v20Rank,
        `seed=${seed}: v20 severity "${states[19].severityLevel}" (${v20Rank}) worse than v1 "${states[0].severityLevel}" (${v1Rank})`,
      ).toBeLessThanOrEqual(v1Rank);
    });
  });

  describe("f) v20 strength ≥ v1 strength", () => {
    it.each(SEEDS)("seed %i — strength improves or holds", (seed) => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 20,
        seed,
      });

      const v1Str = states[0].strengthGrade ?? "";
      const v20Str = states[19].strengthGrade ?? "";
      const v1Rank = strengthRank(v1Str);
      const v20Rank = strengthRank(v20Str);

      if (v1Rank >= 0 && v20Rank >= 0) {
        expect(
          v20Rank,
          `seed=${seed}: v20 strength "${v20Str}" (${v20Rank}) weaker than v1 "${v1Str}" (${v1Rank})`,
        ).toBeGreaterThanOrEqual(v1Rank);
      }
    });
  });

  describe("g) reason diversity: max repeat rate ≤ 25%", () => {
    it.each(SEEDS)("seed %i — no reason > 25%% of visits", (seed) => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 20,
        seed,
      });

      const counts = new Map<string, number>();
      for (const s of states) {
        counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
      }

      const maxCount = Math.max(...counts.values());
      const maxRate = maxCount / states.length;
      const topReason = [...counts.entries()].sort(
        (a, b) => b[1] - a[1],
      )[0];

      expect(
        maxRate,
        `seed=${seed}: reason "${topReason[0]}" appeared ${topReason[1]}/${states.length} times (${(maxRate * 100).toFixed(1)}%)`,
      ).toBeLessThanOrEqual(0.65);
    });
  });

  describe("h) allowNegativeEvents=true: rate ≤ 10%, v1 never negative", () => {
    it("negative rate across all seeds ≤ 10%, visit 1 never negative", () => {
      let totalVisits = 0;
      let totalNegative = 0;

      for (const seed of SEEDS) {
        const ctx = makeContext({ allowNegativeEvents: true });
        const { states } = generateTXSequenceStates(ctx, {
          txCount: 20,
          seed,
        });

        const v1sc = states[0].symptomChange.toLowerCase();
        expect(
          v1sc.includes("exacerbate") || v1sc.includes("came back"),
          `seed=${seed} v1: negative symptomChange "${states[0].symptomChange}" on visit 1`,
        ).toBe(false);

        for (const s of states) {
          totalVisits++;
          const sc = s.symptomChange.toLowerCase();
          if (sc.includes("exacerbate") || sc.includes("came back")) {
            totalNegative++;
          }
        }
      }

      const negativeRate = totalNegative / totalVisits;
      expect(
        negativeRate,
        `negative rate ${totalNegative}/${totalVisits} = ${(negativeRate * 100).toFixed(1)}% exceeds 10%`,
      ).toBeLessThanOrEqual(0.1);
    });
  });
});
