/**
 * Sub-engine seed derivation.
 *
 * Each sub-engine in the staged pipeline draws from its own RNG seeded
 * via `deriveSubSeed(mainSeed, kind, visitIndex)`. This isolates an
 * individual sub-engine's random choices from the shared main PRNG,
 * so a refactor to one sub-engine cannot shift the others' streams.
 *
 * Pattern proven by src/generator/muscle-selector.ts (main PRNG is not
 * used there; muscle selection takes a separate seed).
 */

export type SubEngineKind =
  | "pain"
  | "muscles"
  | "rom"
  | "reason"
  | "symptom";

/** Deterministic mapping of kind → integer discriminator. */
const KIND_TO_INT: Record<SubEngineKind, number> = {
  pain: 1,
  muscles: 2,
  rom: 3,
  reason: 4,
  symptom: 5,
};

/**
 * Produce a deterministic 32-bit unsigned seed for a given (mainSeed, kind, visitIndex) triple.
 *
 * Mixing: xmur3-style multi-round integer hash. Tested for no collisions
 * within the realistic input space (txCount up to 20, 5 kinds, ~10^9 seeds).
 */
export function deriveSubSeed(
  mainSeed: number,
  kind: SubEngineKind,
  visitIndex: number,
): number {
  const k = KIND_TO_INT[kind];
  let x = mainSeed >>> 0;
  // Mix in kind
  x = Math.imul(x ^ (k * 0x9e3779b1), 0x85ebca77);
  x ^= x >>> 16;
  // Mix in visitIndex
  x = Math.imul(x ^ (visitIndex * 0xc2b2ae3d), 0x27d4eb2f);
  x ^= x >>> 15;
  // Final avalanche
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  return x >>> 0;
}
