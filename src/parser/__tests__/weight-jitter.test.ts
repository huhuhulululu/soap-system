import {
  selectWeightedWithJitter,
  type WeightedOption,
} from "../weight-system";
import { createSeededRng } from "../../shared/seeded-rng";

describe("selectWeightedWithJitter", () => {
  const weighted: WeightedOption[] = [
    { option: "A", weight: 90, reasons: [] },
    { option: "B", weight: 89, reasons: [] },
    { option: "C", weight: 88, reasons: [] },
    { option: "D", weight: 87, reasons: [] },
    { option: "E", weight: 86, reasons: [] },
    { option: "F", weight: 70, reasons: [] },
  ];

  it("same seed should produce the same selection", () => {
    const { rng: rng1 } = createSeededRng(42);
    const { rng: rng2 } = createSeededRng(42);

    const a = selectWeightedWithJitter(weighted, 3, rng1);
    const b = selectWeightedWithJitter(weighted, 3, rng2);

    expect(a).toEqual(b);
  });

  it("different seeds should produce varied selections in close-weight band", () => {
    const outputs = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const { rng } = createSeededRng(seed);
      outputs.add(selectWeightedWithJitter(weighted, 3, rng).join("|"));
    }

    expect(outputs.size).toBeGreaterThan(1);
  });

  it("large weight gaps should keep highest-priority options first", () => {
    const gapped: WeightedOption[] = [
      { option: "top", weight: 100, reasons: [] },
      { option: "second", weight: 95, reasons: [] },
      { option: "third", weight: 80, reasons: [] },
      { option: "fourth", weight: 79, reasons: [] },
    ];

    for (const seed of [3, 9, 42, 99, 2024]) {
      const { rng } = createSeededRng(seed);
      expect(selectWeightedWithJitter(gapped, 2, rng)).toEqual([
        "top",
        "second",
      ]);
    }
  });
});
