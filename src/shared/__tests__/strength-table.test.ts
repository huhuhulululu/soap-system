import {
  STRENGTH_LADDER,
  PATCHED_BASE_GRADES,
  strengthFromPain,
  strengthToIndex,
} from "../strength-table";

describe("strength-table", () => {
  it("STRENGTH_LADDER is ordered weakest to strongest (max 4+/5)", () => {
    expect(STRENGTH_LADDER).toEqual([
      "3-/5",
      "3/5",
      "3+/5",
      "4-/5",
      "4/5",
      "4+/5",
    ]);
  });

  it("strengthFromPain: pain 0 → 4+/5 (template max), pain 8 → 3+/5, pain 10 → 3/5", () => {
    expect(strengthFromPain(0)).toBe("4+/5");
    expect(strengthFromPain(8)).toBe("3+/5");
    expect(strengthFromPain(10)).toBe("3/5");
  });

  it("strengthToIndex round-trips with STRENGTH_LADDER", () => {
    for (let i = 0; i < STRENGTH_LADDER.length; i++) {
      expect(strengthToIndex(STRENGTH_LADDER[i])).toBe(i);
    }
  });

  it("PATCHED_BASE_GRADES has 11 entries (pain 0-10)", () => {
    expect(PATCHED_BASE_GRADES.length).toBe(11);
  });

  it("strengthToIndex handles shorthand like '4' → index of '4/5'", () => {
    expect(strengthToIndex("4")).toBe(STRENGTH_LADDER.indexOf("4/5"));
    expect(strengthToIndex("4+")).toBe(STRENGTH_LADDER.indexOf("4+/5"));
    expect(strengthToIndex("3+")).toBe(STRENGTH_LADDER.indexOf("3+/5"));
  });

  it("strengthToIndex maps legacy 5/5 to current max 4+/5", () => {
    expect(strengthToIndex("5/5")).toBe(STRENGTH_LADDER.length - 1);
    expect(strengthToIndex("5")).toBe(STRENGTH_LADDER.length - 1);
  });

  it("strengthToIndex returns 4 (4/5) for unknown grades", () => {
    expect(strengthToIndex("unknown")).toBe(4);
  });

  it("strengthFromPain clamps to 0-10 (max 4+/5)", () => {
    expect(strengthFromPain(-5)).toBe("4+/5");
    expect(strengthFromPain(15)).toBe("3/5");
  });
});
