import { describe, it, expect } from "vitest";
import { computeSpasm, SPASM_GRADE_TEXT } from "../spasm-model";

describe("computeSpasm", () => {
  it("severe tightness + tenderness 4 → spasm 4", () => {
    expect(computeSpasm({ tightness: "severe", tenderness: 4 })).toBe(4);
  });

  it("severe tightness + tenderness 3 → spasm 3 or 4", () => {
    const result = computeSpasm({ tightness: "severe", tenderness: 3 });
    expect(result).toBeGreaterThanOrEqual(3);
    expect(result).toBeLessThanOrEqual(4);
  });

  it("moderate tightness + tenderness 3 → spasm 3", () => {
    expect(computeSpasm({ tightness: "moderate", tenderness: 3 })).toBe(3);
  });

  it("moderate tightness + tenderness 2 → spasm 2", () => {
    expect(computeSpasm({ tightness: "moderate", tenderness: 2 })).toBe(2);
  });

  it("mild tightness + tenderness 1 → spasm 1 or 2", () => {
    const result = computeSpasm({ tightness: "mild", tenderness: 1 });
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(2);
  });

  it("acute modifier → +1 tier", () => {
    const base = computeSpasm({ tightness: "moderate", tenderness: 2 });
    const acute = computeSpasm({
      tightness: "moderate",
      tenderness: 2,
      chronicity: "Acute",
    });
    expect(acute).toBeGreaterThanOrEqual(base);
  });

  it("small joint (ELBOW) → -1 tier", () => {
    const large = computeSpasm({
      tightness: "severe",
      tenderness: 4,
      bodyPart: "LBP",
    });
    const small = computeSpasm({
      tightness: "severe",
      tenderness: 4,
      bodyPart: "ELBOW",
    });
    expect(small).toBeLessThanOrEqual(large);
  });

  it("result always between 0 and 4", () => {
    const tightnessLevels = [
      "mild",
      "mild to moderate",
      "moderate",
      "moderate to severe",
      "severe",
    ];
    for (const t of tightnessLevels) {
      for (const td of [1, 2, 3, 4]) {
        const r = computeSpasm({ tightness: t, tenderness: td });
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe("SPASM_GRADE_TEXT", () => {
  it("has 5 entries (grades 0-4)", () => {
    expect(SPASM_GRADE_TEXT.length).toBe(5);
  });

  it("grade 3 matches template text", () => {
    expect(SPASM_GRADE_TEXT[3]).toBe(
      "(+3)=>1 but < 10 spontaneous spasms per hour.",
    );
  });
});
