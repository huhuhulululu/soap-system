import { describe, it, expect } from "vitest";
import { isPainTypeConsistentWithPattern } from "../tcm-mappings";

describe("isPainTypeConsistentWithPattern (soft warning)", () => {
  it("returns consistent: true when pain types match pattern", () => {
    const result = isPainTypeConsistentWithPattern("Blood Stasis", [
      "Pricking",
      "Dull",
    ]);
    expect(result.consistent).toBe(true);
    expect(result.warning).toBeUndefined();
    expect(result.expected).toEqual(["Pricking", "Shooting"]);
  });

  it("returns consistent: true even when pain types do NOT match pattern", () => {
    const result = isPainTypeConsistentWithPattern("Blood Stasis", [
      "Burning",
      "Dull",
    ]);
    expect(result.consistent).toBe(true);
    expect(result.expected).toEqual(["Pricking", "Shooting"]);
  });

  it("includes warning when pain types do not match expected", () => {
    const result = isPainTypeConsistentWithPattern("Blood Stasis", [
      "Burning",
      "Dull",
    ]);
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain("Burning, Dull");
    expect(result.warning).toContain("Pricking");
  });

  it("has no warning when pain types match expected", () => {
    const result = isPainTypeConsistentWithPattern("Cold-Damp", ["Freezing"]);
    expect(result.consistent).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it("returns consistent: true with empty expected for unknown pattern", () => {
    const result = isPainTypeConsistentWithPattern("Unknown Pattern", [
      "Burning",
    ]);
    expect(result.consistent).toBe(true);
    expect(result.expected).toEqual([]);
    expect(result.warning).toBeUndefined();
  });

  it("handles case-insensitive matching", () => {
    const result = isPainTypeConsistentWithPattern("Blood Stasis", [
      "pricking",
    ]);
    expect(result.consistent).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it("handles compound patterns — matches first entry via includes()", () => {
    // 'Qi Stagnation, Blood Stasis'.includes('Blood Stasis') matches first
    const result = isPainTypeConsistentWithPattern(
      "Qi Stagnation, Blood Stasis",
      ["Pricking"],
    );
    expect(result.consistent).toBe(true);
    expect(result.warning).toBeUndefined();
    expect(result.expected).toEqual(["Pricking", "Shooting"]);
  });
});
