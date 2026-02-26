import { describe, it, expect } from "vitest";
import { createSeededRng } from "../seeded-rng";

describe("createSeededRng", () => {
  it("deterministic: same seed → same sequence", () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    for (let i = 0; i < 100; i++) {
      expect(a.rng()).toBe(b.rng());
    }
  });

  it("different seeds → different sequences", () => {
    const a = createSeededRng(42);
    const b = createSeededRng(99);
    const same = Array.from({ length: 10 }, () => a.rng() === b.rng());
    expect(same.every(Boolean)).toBe(false);
  });

  it("returns values in [0, 1)", () => {
    const { rng } = createSeededRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
