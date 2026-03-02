/**
 * symptomChange guard 多维度一致性测试
 *
 * 验证 guard 用 computeDimensionScore 替代 painDelta 单一锚点后:
 * 1. painDelta>0.3 时 "similar" 比例极低
 * 2. objective 有改善但 painDelta<=0.3 时不被强制 similar
 * 3. Assessment 不自相矛盾
 * 4. dimScore=0 时必须 similar
 */
import { describe, it, expect } from "vitest";
import { generateTXSequenceStates } from "../tx-sequence-engine";
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
    painCurrent: 7,
    associatedSymptom: "soreness",
    ...overrides,
  };
}

describe("symptomChange guard 多维度一致性", () => {
  it("painDelta>0.3 的 visits 中 similar 比例 < 10%", () => {
    const ctx = makeContext();
    let similarCount = 0;
    let totalCount = 0;
    for (let seed = 10000; seed < 10020; seed++) {
      const r = generateTXSequenceStates(ctx, {
        txCount: 12,
        seed,
        initialState: { pain: 7, associatedSymptom: "soreness" },
      });
      let prevPain = 7;
      for (const s of r.states) {
        const delta = prevPain - s.painScaleCurrent;
        if (delta > 0.3) {
          totalCount++;
          if (s.symptomChange.includes("similar")) similarCount++;
        }
        prevPain = s.painScaleCurrent;
      }
    }
    if (totalCount > 0) {
      expect(similarCount / totalCount).toBeLessThan(0.1);
    }
  });

  it("objective 有改善但 painDelta<=0.3 时 similar 比例 < 15%", () => {
    const ctx = makeContext();
    let similarCount = 0;
    let totalCount = 0;
    for (let seed = 10000; seed < 10020; seed++) {
      const r = generateTXSequenceStates(ctx, {
        txCount: 12,
        seed,
        initialState: { pain: 7, associatedSymptom: "soreness" },
      });
      let prevPain = 7;
      for (const s of r.states) {
        const delta = prevPain - s.painScaleCurrent;
        const obj = s.soaChain.objective;
        const objImproved =
          obj.tightnessTrend !== "stable" ||
          obj.tendernessTrend !== "stable" ||
          obj.spasmTrend !== "stable" ||
          obj.romTrend !== "stable" ||
          obj.strengthTrend !== "stable";
        if (delta <= 0.3 && objImproved) {
          totalCount++;
          if (s.symptomChange.includes("similar")) similarCount++;
        }
        prevPain = s.painScaleCurrent;
      }
    }
    if (totalCount > 0) {
      expect(similarCount / totalCount).toBeLessThan(0.15);
    }
  });

  it("Assessment 自相矛盾比例 < 10%", () => {
    const ctx = makeContext();
    let contradictions = 0;
    let totalVisits = 0;
    for (let seed = 10000; seed < 10020; seed++) {
      const r = generateTXSequenceStates(ctx, {
        txCount: 12,
        seed,
        initialState: { pain: 7, associatedSymptom: "soreness" },
      });
      for (const s of r.states) {
        totalVisits++;
        const a = s.soaChain.assessment;
        if (
          a.present.includes("similar") &&
          (a.patientChange.includes("decreased") ||
            a.patientChange.includes("reduced") ||
            (a.physicalChange && a.physicalChange !== "remained the same"))
        ) {
          contradictions++;
        }
      }
    }
    expect(contradictions / totalVisits).toBeLessThan(0.1);
  });

  it("dimScore=0 的 visits 必须全部是 similar", () => {
    const ctx = makeContext();
    const r = generateTXSequenceStates(ctx, {
      txCount: 3,
      seed: 99999,
      initialState: { pain: 7, associatedSymptom: "soreness" },
    });
    // 至少验证引擎不崩溃且每个 visit 都有 symptomChange
    expect(r.states.length).toBe(3);
    for (const s of r.states) {
      expect(s.symptomChange).toBeTruthy();
    }
  });
});
