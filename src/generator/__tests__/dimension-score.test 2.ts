import { describe, it, expect } from "vitest";
import { computeDimensionScore } from "../tx-sequence-engine";

function stableInput() {
  return {
    painDelta: 0,
    symptomScaleChanged: false,
    severityChanged: false,
    frequencyImproved: false,
    adlImproved: false,
    tightnessTrend: "stable" as const,
    tendernessTrend: "stable" as const,
    spasmTrend: "stable" as const,
    romTrend: "stable" as const,
    strengthTrend: "stable" as const,
  };
}

describe("computeDimensionScore", () => {
  it("all stable → score=0, changedDims=[]", () => {
    const result = computeDimensionScore(stableInput());
    expect(result.score).toBe(0);
    expect(result.changedDims).toEqual([]);
  });

  it("only painDelta=0.5 → score~0.063 (0.25*0.5/2.0), changedDims=['pain']", () => {
    const result = computeDimensionScore({
      ...stableInput(),
      painDelta: 0.5,
    });
    // 0.25 * min(0.5/2.0, 1.0) = 0.25 * 0.25 = 0.0625 → rounded to 0.063
    expect(result.score).toBeCloseTo(0.063, 2);
    expect(result.changedDims).toEqual(["pain"]);
  });

  it("painDelta=0, tightness reduced + ROM improved → score=0.20, changedDims contains tightness+ROM", () => {
    const result = computeDimensionScore({
      ...stableInput(),
      tightnessTrend: "reduced",
      romTrend: "improved",
    });
    expect(result.score).toBe(0.2);
    expect(result.changedDims).toContain("tightness");
    expect(result.changedDims).toContain("ROM");
  });

  it("symptomScale + severity changed → score>=0.2", () => {
    const result = computeDimensionScore({
      ...stableInput(),
      symptomScaleChanged: true,
      severityChanged: true,
    });
    // 0.12 + 0.12 = 0.24
    expect(result.score).toBeGreaterThanOrEqual(0.2);
    expect(result.changedDims).toContain("symptomScale");
    expect(result.changedDims).toContain("severity");
  });

  it("multi-dimension improvement → score>=0.7, changedDims.length>=6", () => {
    const result = computeDimensionScore({
      painDelta: 1.0,
      symptomScaleChanged: true,
      severityChanged: true,
      frequencyImproved: true,
      adlImproved: true,
      tightnessTrend: "reduced",
      tendernessTrend: "reduced",
      spasmTrend: "reduced",
      romTrend: "improved",
      strengthTrend: "improved",
    });
    expect(result.score).toBeGreaterThanOrEqual(0.7);
    expect(result.changedDims.length).toBeGreaterThanOrEqual(6);
  });

  it("slightly reduced/improved contributes half weight (0.05 vs 0.10)", () => {
    const full = computeDimensionScore({
      ...stableInput(),
      tightnessTrend: "reduced",
    });
    const slight = computeDimensionScore({
      ...stableInput(),
      tightnessTrend: "slightly reduced",
    });
    expect(full.score).toBe(0.1);
    expect(slight.score).toBe(0.05);
    expect(full.changedDims).toContain("tightness");
    expect(slight.changedDims).toContain("tightness");
  });
});
