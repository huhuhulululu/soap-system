import { deriveSubSeed, type SubEngineKind } from "../sub-seed";

describe("deriveSubSeed", () => {
  const KINDS: SubEngineKind[] = ["pain", "muscles", "rom", "reason", "symptom"];

  test("deterministic: same inputs produce same output", () => {
    expect(deriveSubSeed(12345, "pain", 3)).toBe(deriveSubSeed(12345, "pain", 3));
    expect(deriveSubSeed(0, "reason", 0)).toBe(deriveSubSeed(0, "reason", 0));
  });

  test("different kind → different seed (same mainSeed + visitIndex)", () => {
    const byKind = new Set(KINDS.map((k) => deriveSubSeed(42, k, 5)));
    expect(byKind.size).toBe(KINDS.length);
  });

  test("different visitIndex → different seed (same mainSeed + kind)", () => {
    const byVisit = new Set(
      Array.from({ length: 25 }, (_, i) => deriveSubSeed(100001, "pain", i)),
    );
    expect(byVisit.size).toBe(25);
  });

  test("different mainSeed → different seed (same kind + visit)", () => {
    const byMain = new Set(
      [1, 2, 3, 100, 1000, 99999].map((s) =>
        deriveSubSeed(s, "muscles", 7),
      ),
    );
    expect(byMain.size).toBe(6);
  });

  test("no collision in realistic input space (2000 random triples)", () => {
    const seen = new Set<number>();
    let collisions = 0;
    for (let mainSeed of [
      100001, 100002, 100003, 100004, 100005, 100006, 100007, 100008,
      100009, 100010, 100011, 100012, 100013, 100014, 100015, 100016,
      100017, 100018, 100019, 100020, 100021, 100022, 100023, 100024,
      100025, 100026, 100027, 100028, 100029, 100030,
    ]) {
      for (const kind of KINDS) {
        for (let visitIndex = 1; visitIndex <= 20; visitIndex++) {
          const v = deriveSubSeed(mainSeed, kind, visitIndex);
          if (seen.has(v)) collisions++;
          seen.add(v);
        }
      }
    }
    const total = 30 * KINDS.length * 20; // = 3000
    expect(seen.size).toBe(total);
    expect(collisions).toBe(0);
  });

  test("returns 32-bit unsigned integer", () => {
    for (let s = 0; s < 100; s++) {
      const v = deriveSubSeed(s, "pain", s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
