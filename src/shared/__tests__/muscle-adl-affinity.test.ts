import { describe, expect, it } from "vitest";
import {
  type BodyPartKey,
  TEMPLATE_ADL,
  TEMPLATE_AGGRAVATING,
  TEMPLATE_MUSCLES,
} from "../template-options";
import {
  MUSCLE_ADL_AFFINITY,
  getADLWeightsByMuscles,
  getAggravatingWeightsByMuscles,
} from "../muscle-adl-affinity";

const ALL_BODY_PARTS: BodyPartKey[] = [
  "LBP",
  "NECK",
  "SHOULDER",
  "KNEE",
  "ELBOW",
  "HIP",
  "THIGH",
];

// ─── MUSCLE_ADL_AFFINITY structure ──────────────────────────────────

describe("MUSCLE_ADL_AFFINITY", () => {
  it("has entries for all body parts", () => {
    for (const bp of ALL_BODY_PARTS) {
      expect(MUSCLE_ADL_AFFINITY[bp]).toBeDefined();
      expect(Object.keys(MUSCLE_ADL_AFFINITY[bp]).length).toBeGreaterThan(0);
    }
  });

  it("THIGH reuses HIP affinity", () => {
    expect(MUSCLE_ADL_AFFINITY.THIGH).toBe(MUSCLE_ADL_AFFINITY.HIP);
  });

  it("every muscle key exists in TEMPLATE_MUSCLES (tightness or tenderness)", () => {
    for (const bp of ALL_BODY_PARTS) {
      if (bp === "THIGH") continue; // shares HIP, muscle names match HIP_THIGH_MUSCLES
      const muscles = TEMPLATE_MUSCLES[bp];
      const validMuscles = new Set([
        ...muscles.tightness,
        ...muscles.tenderness,
      ]);
      for (const muscle of Object.keys(MUSCLE_ADL_AFFINITY[bp])) {
        expect(
          validMuscles.has(muscle),
          `"${muscle}" not found in TEMPLATE_MUSCLES.${bp}`,
        ).toBe(true);
      }
    }
  });

  it("every ADL value exists in TEMPLATE_ADL or TEMPLATE_AGGRAVATING for that body part", () => {
    for (const bp of ALL_BODY_PARTS) {
      // THIGH reuses HIP affinity — ADL values validated against HIP's lists
      const lookupBp = bp === "THIGH" ? "HIP" : bp;
      const validADLs = new Set([
        ...TEMPLATE_ADL[lookupBp],
        ...TEMPLATE_AGGRAVATING[lookupBp],
      ]);
      for (const [muscle, adls] of Object.entries(MUSCLE_ADL_AFFINITY[bp])) {
        for (const adl of adls) {
          expect(
            validADLs.has(adl),
            `ADL "${adl}" for muscle "${muscle}" not in TEMPLATE_ADL/TEMPLATE_AGGRAVATING.${lookupBp}`,
          ).toBe(true);
        }
      }
    }
  });

  it("no duplicate ADLs per muscle", () => {
    for (const bp of ALL_BODY_PARTS) {
      for (const [muscle, adls] of Object.entries(MUSCLE_ADL_AFFINITY[bp])) {
        const unique = new Set(adls);
        expect(unique.size, `Duplicate ADL in ${bp}.${muscle}`).toBe(
          adls.length,
        );
      }
    }
  });
});

// ─── Clinical mapping spot checks ───────────────────────────────────

describe("clinical mapping correctness", () => {
  it("LBP: Quadratus Lumborum → bending/lifting", () => {
    const adls = MUSCLE_ADL_AFFINITY.LBP["Quadratus Lumborum"];
    expect(adls).toContain("Bending over to wear/tie a shoe");
    expect(adls).toContain("Lifting objects");
  });

  it("LBP: Gluteal Muscles → stairs/bed/chair", () => {
    const adls = MUSCLE_ADL_AFFINITY.LBP["Gluteal Muscles"];
    expect(adls).toContain("Getting out of bed");
    expect(adls).toContain("Rising from a chair");
    expect(adls).toContain("Going up and down stairs");
  });

  it("NECK: Trapezius → turning head, carry bags", () => {
    const adls = MUSCLE_ADL_AFFINITY.NECK["Trapezius"];
    expect(adls).toContain("turning the head when crossing the street");
    expect(adls).toContain("carry/handing grocery bags");
  });

  it("NECK: Scalene anterior / med / posterior → gargling, showering", () => {
    const adls = MUSCLE_ADL_AFFINITY.NECK["Scalene anterior / med / posterior"];
    expect(adls).toContain("gargling");
    expect(adls).toContain("showering");
  });

  it("SHOULDER: upper trapezius → comb hair, reach cabinet", () => {
    const adls = MUSCLE_ADL_AFFINITY.SHOULDER["upper trapezius"];
    expect(adls).toContain("raising up the hand to comb hair");
    expect(adls).toContain("reach top of cabinet to get object(s)");
  });

  it("SHOULDER: rhomboids → unzip, put coat on", () => {
    const adls = MUSCLE_ADL_AFFINITY.SHOULDER["rhomboids"];
    expect(adls).toContain("reach to back to unzip");
    expect(adls).toContain("touch opposite side shoulder to put coat on");
  });

  it("KNEE: Iliotibial Band ITB → shoes", () => {
    const adls = MUSCLE_ADL_AFFINITY.KNEE["Iliotibial Band ITB"];
    expect(adls).toContain("bending down put in/out of the shoes");
  });

  it("HIP: piriformis → stairs, chair", () => {
    const adls = MUSCLE_ADL_AFFINITY.HIP["piriformis"];
    expect(adls).toContain("Going up and down stairs");
    expect(adls).toContain("Rising from a chair");
  });

  it("ELBOW: Lattisimus dorsi → cooking, chores", () => {
    const adls = MUSCLE_ADL_AFFINITY.ELBOW["Lattisimus dorsi"];
    expect(adls).toContain("holding the pot for cooking");
    expect(adls).toContain("performing household chores");
  });
});

// ─── getADLWeightsByMuscles ─────────────────────────────────────────

describe("getADLWeightsByMuscles", () => {
  it("returns empty array when no muscles selected", () => {
    expect(getADLWeightsByMuscles([], "LBP")).toEqual([]);
  });

  it("returns empty array for unknown body part", () => {
    expect(getADLWeightsByMuscles(["foo"], "UNKNOWN" as BodyPartKey)).toEqual(
      [],
    );
  });

  it("returns weighted ADLs sorted by weight descending", () => {
    const result = getADLWeightsByMuscles(
      ["Gluteal Muscles", "Iliopsoas Muscle"],
      "LBP",
    );
    expect(result.length).toBeGreaterThan(0);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].weight).toBeGreaterThanOrEqual(result[i].weight);
    }
  });

  it("ADLs referenced by more muscles get higher weight", () => {
    // longissimus + Iliopsoas Muscle both map to "Standing for long periods of time"
    // but only Iliopsoas maps to "Walking for long periods of time"
    const result = getADLWeightsByMuscles(
      ["longissimus", "Iliopsoas Muscle"],
      "LBP",
    );
    const standing = result.find(
      (r) => r.adl === "Standing for long periods of time",
    );
    const walking = result.find(
      (r) => r.adl === "Walking for long periods of time",
    );
    expect(standing).toBeDefined();
    expect(walking).toBeDefined();
    // standing is referenced by both muscles → weight 2, walking by 1
    expect(standing!.weight).toBeGreaterThan(walking!.weight);
  });

  it("ignores muscles not in the affinity map", () => {
    const result = getADLWeightsByMuscles(["nonexistent_muscle"], "LBP");
    expect(result).toEqual([]);
  });

  it("each result has adl and weight properties", () => {
    const result = getADLWeightsByMuscles(["Quadratus Lumborum"], "LBP");
    for (const item of result) {
      expect(item).toHaveProperty("adl");
      expect(item).toHaveProperty("weight");
      expect(typeof item.adl).toBe("string");
      expect(typeof item.weight).toBe("number");
    }
  });
});

// ─── getAggravatingWeightsByMuscles ─────────────────────────────────

describe("getAggravatingWeightsByMuscles", () => {
  it("returns empty array when no muscles selected", () => {
    expect(getAggravatingWeightsByMuscles([], "SHOULDER")).toEqual([]);
  });

  it("returns weighted aggravating factors sorted by weight descending", () => {
    const result = getAggravatingWeightsByMuscles(
      ["supraspinatus", "middle deltoid"],
      "SHOULDER",
    );
    expect(result.length).toBeGreaterThan(0);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].weight).toBeGreaterThanOrEqual(result[i].weight);
    }
  });

  it("supraspinatus + middle deltoid → Overhead activities has weight", () => {
    const result = getAggravatingWeightsByMuscles(
      ["supraspinatus", "middle deltoid"],
      "SHOULDER",
    );
    const overhead = result.find(
      (r) => r.aggravating === "Overhead activities",
    );
    expect(overhead).toBeDefined();
    expect(overhead!.weight).toBeGreaterThan(0);
  });

  it("each result has aggravating and weight properties", () => {
    const result = getAggravatingWeightsByMuscles(["Trapezius"], "NECK");
    for (const item of result) {
      expect(item).toHaveProperty("aggravating");
      expect(item).toHaveProperty("weight");
      expect(typeof item.aggravating).toBe("string");
      expect(typeof item.weight).toBe("number");
    }
  });
});
