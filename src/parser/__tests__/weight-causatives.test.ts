import { describe, it, expect } from "vitest";
import { calculateWeights, selectBestOptions } from "../weight-system";
import { TEMPLATE_CAUSATIVES } from "../../shared/template-options";

describe("causatives weight selection", () => {
  it("causatives should NOT all have the same weight (default 50)", () => {
    const pool = [...TEMPLATE_CAUSATIVES["LBP"]];
    const ctx = {
      bodyPart: "LBP",
      laterality: "bilateral",
      localPattern: "Qi Stagnation",
      systemicPattern: "Kidney Yang Deficiency",
      chronicityLevel: "Chronic",
      severityLevel: "moderate to severe",
      painScale: 7,
    };
    const weighted = calculateWeights("subjective.causativeFactors", pool, ctx);
    const uniqueWeights = new Set(weighted.map((w) => w.weight));
    expect(
      uniqueWeights.size,
      "all causatives have same weight — no differentiation",
    ).toBeGreaterThan(1);
  });

  it("Chronic LBP should select 2-3 causatives, not just 1", () => {
    const pool = [...TEMPLATE_CAUSATIVES["LBP"]];
    const ctx = {
      bodyPart: "LBP",
      laterality: "bilateral",
      localPattern: "Qi Stagnation",
      systemicPattern: "Kidney Yang Deficiency",
      chronicityLevel: "Chronic",
      severityLevel: "moderate to severe",
      painScale: 7,
    };
    const weighted = calculateWeights("subjective.causativeFactors", pool, ctx);
    const selected = selectBestOptions(weighted, 2);
    expect(selected.length).toBeGreaterThanOrEqual(2);
  });

  it("age-related should rank higher for chronic patients", () => {
    const pool = [...TEMPLATE_CAUSATIVES["LBP"]];
    const ctx = {
      bodyPart: "LBP",
      laterality: "bilateral",
      localPattern: "Qi Stagnation",
      systemicPattern: "Kidney Yang Deficiency",
      chronicityLevel: "Chronic",
      severityLevel: "moderate to severe",
      painScale: 7,
    };
    const weighted = calculateWeights("subjective.causativeFactors", pool, ctx);
    const ageRelated = weighted.find(
      (w) => w.option === "age related/degenerative changes",
    );
    expect(ageRelated).toBeDefined();
    expect(ageRelated!.weight).toBeGreaterThan(50);
  });

  it("selected causatives should vary across body parts", () => {
    const results = new Set<string>();
    for (const bp of ["LBP", "NECK", "SHOULDER", "KNEE"] as const) {
      const pool = [
        ...(TEMPLATE_CAUSATIVES[bp] || TEMPLATE_CAUSATIVES["LBP"]),
      ];
      const ctx = {
        bodyPart: bp,
        laterality: "bilateral" as const,
        localPattern: "Qi Stagnation",
        systemicPattern: "Kidney Yang Deficiency",
        chronicityLevel: "Chronic",
        severityLevel: "moderate to severe",
        painScale: 7,
      };
      const weighted = calculateWeights(
        "subjective.causativeFactors",
        pool,
        ctx,
      );
      const selected = selectBestOptions(weighted, 2);
      results.add(selected.join("|"));
    }
    // At least 2 different combinations across 4 body parts
    expect(results.size).toBeGreaterThanOrEqual(2);
  });

  it("NECK should boost posture/computer-related causatives", () => {
    const pool = [...TEMPLATE_CAUSATIVES["NECK"]];
    const ctx = {
      bodyPart: "NECK",
      laterality: "bilateral",
      localPattern: "Qi Stagnation",
      systemicPattern: "Kidney Yang Deficiency",
      chronicityLevel: "Chronic",
      severityLevel: "moderate to severe",
      painScale: 7,
    };
    const weighted = calculateWeights("subjective.causativeFactors", pool, ctx);
    const posture = weighted.find((w) =>
      w.option.includes("bad posture") || w.option.includes("computer"),
    );
    expect(posture).toBeDefined();
    expect(posture!.weight).toBeGreaterThan(50);
  });
});
