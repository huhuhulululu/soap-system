import { describe, it, expect } from "vitest";
import {
  selectInitialMuscles,
  reduceMuscles,
  MUSCLE_COUNT,
  type SelectedMuscles,
} from "../muscle-selector";
import {
  TEMPLATE_MUSCLES,
  type BodyPartKey,
} from "../../shared/template-options";

const ALL_BODY_PARTS: BodyPartKey[] = [
  "LBP",
  "NECK",
  "SHOULDER",
  "KNEE",
  "ELBOW",
  "HIP",
  "THIGH",
];

const SEVERITIES = [
  "severe",
  "moderate to severe",
  "moderate",
  "mild to moderate",
  "mild",
] as const;

// ─── Subset constraint ─────────────────────────────────────────────

describe("subset constraint: spasm ⊆ tenderness ⊆ tightness", () => {
  for (const bp of ALL_BODY_PARTS) {
    for (const sev of SEVERITIES) {
      it(`${bp} / ${sev}`, () => {
        const result = selectInitialMuscles(bp, sev, 42);

        // tenderness ⊆ tightness
        for (const m of result.tenderness) {
          expect(result.tightness).toContain(m);
        }
        // spasm ⊆ tenderness
        for (const m of result.spasm) {
          expect(result.tenderness).toContain(m);
        }
      });
    }
  }
});

// ─── Severity → count correlation ──────────────────────────────────

describe("severity → count correlation", () => {
  for (const bp of ALL_BODY_PARTS) {
    for (const sev of SEVERITIES) {
      it(`${bp} / ${sev}: counts within expected range`, () => {
        const result = selectInitialMuscles(bp, sev, 99);
        const pools = TEMPLATE_MUSCLES[bp];
        const [tMin, tMax] = MUSCLE_COUNT[sev].tightness;
        const [dMin, dMax] = MUSCLE_COUNT[sev].tenderness;
        const [sMin, sMax] = MUSCLE_COUNT[sev].spasm;

        // Clamp to pool size
        const tClamped = Math.min(tMax, pools.tightness.length);
        const dClamped = Math.min(dMax, pools.tenderness.length);

        expect(result.tightness.length).toBeGreaterThanOrEqual(
          Math.min(tMin, pools.tightness.length),
        );
        expect(result.tightness.length).toBeLessThanOrEqual(tClamped);

        expect(result.tenderness.length).toBeGreaterThanOrEqual(
          Math.min(dMin, pools.tenderness.length),
        );
        expect(result.tenderness.length).toBeLessThanOrEqual(dClamped);

        // Spasm effective pool = intersection of spasm pool with
        // the actual tenderness selection (subset constraint),
        // so effective size can be smaller than pools.spasm.length
        const spasmPool = new Set<string>(pools.spasm as readonly string[]);
        const effectiveSpasmPool = result.tenderness.filter((m) =>
          spasmPool.has(m),
        ).length;
        const sClampedMax = Math.min(sMax, effectiveSpasmPool);
        const sClampedMin = Math.min(sMin, effectiveSpasmPool);

        expect(result.spasm.length).toBeGreaterThanOrEqual(sClampedMin);
        expect(result.spasm.length).toBeLessThanOrEqual(sClampedMax);
      });
    }
  }
});

// ─── Determinism ────────────────────────────────────────────────────

describe("determinism: same seed → same result", () => {
  for (const bp of ALL_BODY_PARTS) {
    it(`${bp}: identical with same seed`, () => {
      const a = selectInitialMuscles(bp, "moderate", 12345);
      const b = selectInitialMuscles(bp, "moderate", 12345);
      expect(a).toEqual(b);
    });

    it(`${bp}: different with different seed`, () => {
      const a = selectInitialMuscles(bp, "severe", 1);
      const b = selectInitialMuscles(bp, "severe", 9999);
      // With enough muscles, different seeds should produce different orders
      // (NECK only has 4 muscles so skip this check for tiny pools)
      const pool = TEMPLATE_MUSCLES[bp].tightness;
      if (pool.length > 4) {
        expect(a.tightness).not.toEqual(b.tightness);
      }
    });
  }
});

// ─── All names from TEMPLATE_MUSCLES ────────────────────────────────

describe("all muscle names come from TEMPLATE_MUSCLES", () => {
  for (const bp of ALL_BODY_PARTS) {
    it(`${bp}`, () => {
      const result = selectInitialMuscles(bp, "severe", 77);
      const pools = TEMPLATE_MUSCLES[bp];

      for (const m of result.tightness) {
        expect(pools.tightness).toContain(m);
      }
      for (const m of result.tenderness) {
        expect(pools.tenderness).toContain(m);
      }
      for (const m of result.spasm) {
        expect(pools.spasm).toContain(m);
      }
    });
  }
});

// ─── reduceMuscles ──────────────────────────────────────────────────

describe("reduceMuscles", () => {
  it("same severity → returns unchanged reference", () => {
    const original = selectInitialMuscles("LBP", "severe", 42);
    const reduced = reduceMuscles(original, "severe");
    expect(reduced).toBe(original);
  });

  it("lower severity → fewer muscles", () => {
    const original = selectInitialMuscles("SHOULDER", "severe", 42);
    const reduced = reduceMuscles(original, "mild");

    expect(reduced.tightness.length).toBeLessThanOrEqual(
      original.tightness.length,
    );
    expect(reduced.tenderness.length).toBeLessThanOrEqual(
      original.tenderness.length,
    );
    expect(reduced.spasm.length).toBeLessThanOrEqual(original.spasm.length);
  });

  it("preserves core muscles (front of list)", () => {
    const original = selectInitialMuscles("KNEE", "severe", 42);
    const reduced = reduceMuscles(original, "mild");

    // Reduced tightness should be a prefix of original tightness
    for (let i = 0; i < reduced.tightness.length; i++) {
      expect(reduced.tightness[i]).toBe(original.tightness[i]);
    }
    for (let i = 0; i < reduced.tenderness.length; i++) {
      expect(reduced.tenderness[i]).toBe(original.tenderness[i]);
    }
    for (let i = 0; i < reduced.spasm.length; i++) {
      expect(reduced.spasm[i]).toBe(original.spasm[i]);
    }
  });

  it("maintains subset constraint after reduction", () => {
    const original = selectInitialMuscles("LBP", "severe", 42);
    const reduced = reduceMuscles(original, "mild to moderate");

    for (const m of reduced.tenderness) {
      expect(reduced.tightness).toContain(m);
    }
    for (const m of reduced.spasm) {
      expect(reduced.tenderness).toContain(m);
    }
  });

  it("does not mutate original", () => {
    const original = selectInitialMuscles("HIP", "severe", 42);
    const snapshot = {
      tightness: [...original.tightness],
      tenderness: [...original.tenderness],
      spasm: [...original.spasm],
    };
    reduceMuscles(original, "mild");
    expect(original.tightness).toEqual(snapshot.tightness);
    expect(original.tenderness).toEqual(snapshot.tenderness);
    expect(original.spasm).toEqual(snapshot.spasm);
  });

  it("progressive reduction: severe → moderate → mild", () => {
    const severe = selectInitialMuscles("LBP", "severe", 42);
    const moderate = reduceMuscles(severe, "moderate");
    const mild = reduceMuscles(moderate, "mild");

    expect(moderate.tightness.length).toBeLessThanOrEqual(
      severe.tightness.length,
    );
    expect(mild.tightness.length).toBeLessThanOrEqual(
      moderate.tightness.length,
    );
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────

describe("edge cases", () => {
  it("ELBOW: different tightness/tenderness pools handled correctly", () => {
    const result = selectInitialMuscles("ELBOW", "severe", 42);

    // Tenderness must still be subset of tightness
    for (const m of result.tenderness) {
      expect(result.tightness).toContain(m);
    }
  });

  it("HIP: spasm pool is smaller than tightness pool", () => {
    const result = selectInitialMuscles("HIP", "severe", 42);

    // Spasm count clamped to HIP_THIGH_SPASM_MUSCLES (3 muscles)
    expect(result.spasm.length).toBeLessThanOrEqual(3);
  });

  it("NECK: small pool (4 muscles) still works at severe", () => {
    const result = selectInitialMuscles("NECK", "severe", 42);
    expect(result.tightness.length).toBeLessThanOrEqual(4);
    expect(result.tightness.length).toBeGreaterThanOrEqual(1);
  });

  it("monotonic severity ordering: higher severity → more muscles", () => {
    const seed = 42;
    for (const bp of ALL_BODY_PARTS) {
      const mild = selectInitialMuscles(bp, "mild", seed);
      const moderate = selectInitialMuscles(bp, "moderate", seed);
      const severe = selectInitialMuscles(bp, "severe", seed);

      expect(severe.tightness.length).toBeGreaterThanOrEqual(
        moderate.tightness.length,
      );
      expect(moderate.tightness.length).toBeGreaterThanOrEqual(
        mild.tightness.length,
      );
    }
  });
});
