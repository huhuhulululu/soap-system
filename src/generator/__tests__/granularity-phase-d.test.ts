/**
 * 阶段 D 测试: Subjective 动态关联
 *
 * 验证:
 * 1. symptomChange 不仅依赖 painDelta，也考虑 objective trends
 * 2. connector 词在序列中有变化（不锁死同一个）
 * 3. reason 在序列中有变化
 * 4. 当 pain 不变但 objective 改善时，symptomChange 可以是 improvement
 */
import { describe, it, expect } from "vitest";
import {
  generateTXSequenceStates,
  snapPainToGrid,
} from "../tx-sequence-engine";
import type { GenerationContext } from "../../types";

function makeContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    noteType: "TX",
    insuranceType: "OPTUM",
    primaryBodyPart: "LBP",
    laterality: "bilateral",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "moderate to severe",
    painCurrent: 8,
    associatedSymptom: "soreness",
    ...overrides,
  };
}

describe("阶段D: symptomChange 多维度驱动", () => {
  it("20-visit 中 symptomChange 唯一值 ≥ 2", () => {
    const ctx = makeContext({ painCurrent: 8 });
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 800001,
      initialState: { pain: 8, associatedSymptom: "soreness" },
    });

    const changes = new Set(result.states.map((s) => s.symptomChange));
    expect(changes.size).toBeGreaterThanOrEqual(2);
  });

  it("pain 不变但 objective 改善时可以出现 improvement", () => {
    // 用多个 seed 测试，至少有一个 seed 在 pain 平台期出现 improvement
    const seeds = [800010, 800011, 800012, 800013, 800014];
    let found = false;

    for (const seed of seeds) {
      const ctx = makeContext({ painCurrent: 8 });
      const result = generateTXSequenceStates(ctx, {
        txCount: 20,
        seed,
        initialState: { pain: 8, associatedSymptom: "soreness" },
      });

      for (let i = 1; i < result.states.length; i++) {
        const prev = result.states[i - 1];
        const curr = result.states[i];
        const painSame =
          snapPainToGrid(curr.painScaleCurrent).label ===
          snapPainToGrid(prev.painScaleCurrent).label;
        const hasImprovement = curr.symptomChange.includes("improvement");
        const objImproved =
          curr.soaChain.objective.tightnessTrend !== "stable" ||
          curr.soaChain.objective.tendernessTrend !== "stable" ||
          curr.soaChain.objective.romTrend !== "stable" ||
          curr.soaChain.objective.strengthTrend !== "stable";

        if (painSame && hasImprovement && objImproved) {
          found = true;
          break;
        }
      }
      if (found) break;
    }
    expect(found).toBe(true);
  });
});

describe("阶段D: connector 词变化", () => {
  it("20-visit 中 connector 唯一值 ≥ 2", () => {
    const ctx = makeContext({ painCurrent: 8 });
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 800002,
      initialState: { pain: 8, associatedSymptom: "soreness" },
    });

    const connectors = new Set(result.states.map((s) => s.reasonConnector));
    expect(connectors.size).toBeGreaterThanOrEqual(2);
  });
});

describe("阶段D: reason 变化", () => {
  it("20-visit 中 reason 唯一值 ≥ 2", () => {
    const ctx = makeContext({ painCurrent: 8 });
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 800003,
      initialState: { pain: 8, associatedSymptom: "soreness" },
    });

    const reasons = new Set(result.states.map((s) => s.reason));
    expect(reasons.size).toBeGreaterThanOrEqual(2);
  });

  it("improvement 类 reason 有多种表达 (≥ 3)", () => {
    const ctx = makeContext({ painCurrent: 8 });
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 800004,
      initialState: { pain: 8, associatedSymptom: "soreness" },
    });

    const improvementReasons = new Set(
      result.states
        .filter((s) => s.symptomChange.includes("improvement"))
        .map((s) => s.reason),
    );
    // improvement 类 reason 应该有多种（不总是 energy level improved）
    expect(improvementReasons.size).toBeGreaterThanOrEqual(3);
  });

  it("similar 类 reason 不总是 maintain regular treatments", () => {
    const seeds = [800020, 800021, 800022, 800023, 800024];
    let totalSimilarReasons = new Set<string>();

    for (const seed of seeds) {
      const ctx = makeContext({ painCurrent: 8 });
      const result = generateTXSequenceStates(ctx, {
        txCount: 20,
        seed,
        initialState: { pain: 8, associatedSymptom: "soreness" },
      });

      result.states
        .filter((s) => s.symptomChange.includes("similar"))
        .forEach((s) => totalSimilarReasons.add(s.reason));
    }
    // "similar" 类 reason 应该有 ≥ 2 种（不总是 maintain regular treatments）
    expect(totalSimilarReasons.size).toBeGreaterThanOrEqual(2);
  });

  it('"maintain regular treatments" should never appear for similar symptom changes', () => {
    const seeds = [42, 100, 256, 314, 628, 999, 1337, 2718, 3141, 7961];

    for (const seed of seeds) {
      const ctx = makeContext({ painCurrent: 8 });
      const result = generateTXSequenceStates(ctx, {
        txCount: 20,
        seed,
        initialState: { pain: 8, associatedSymptom: "soreness" },
      });

      const similarWithMaintain = result.states.filter(
        (s) =>
          s.symptomChange.includes("similar") &&
          s.reason === "maintain regular treatments",
      );
      expect(
        similarWithMaintain.length,
        `seed=${seed}: "maintain regular treatments" found ${similarWithMaintain.length} times for similar`,
      ).toBe(0);
    }
  });
});

describe("early visit stability: severity and symptomScale", () => {
  it("severity does not drop in first 2 visits (v1-v2) across 20 seeds", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const result = generateTXSequenceStates(makeContext(), {
        txCount: 11,
        seed,
        initialState: { pain: 8, associatedSymptom: "soreness" },
      });

      const v1Severity = result.states[0].severityLevel;
      const v2Severity = result.states[1].severityLevel;
      expect(
        v2Severity,
        `seed=${seed}: severity changed from ${v1Severity} to ${v2Severity} at v2`,
      ).toBe(v1Severity);
    }
  });

  it("symptomScale does not drop in first 2 visits (v1-v2) across 20 seeds", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const result = generateTXSequenceStates(makeContext(), {
        txCount: 11,
        seed,
        initialState: { pain: 8, associatedSymptom: "soreness" },
      });

      const v1Scale = result.states[0].symptomScale;
      const v2Scale = result.states[1].symptomScale;
      expect(
        v2Scale,
        `seed=${seed}: symptomScale changed from ${v1Scale} to ${v2Scale} at v2`,
      ).toBe(v1Scale);
    }
  });
});
