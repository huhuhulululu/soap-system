import {
  TEMPLATE_MUSCLES,
  type BodyPartKey,
} from "../shared/template-options";
import { createSeededRng } from "../shared/seeded-rng";

// ─── Types ──────────────────────────────────────────────────────────

export interface SelectedMuscles {
  readonly tightness: readonly string[];
  readonly tenderness: readonly string[];
  readonly spasm: readonly string[];
}

interface CountRange {
  readonly tightness: readonly [number, number];
  readonly tenderness: readonly [number, number];
  readonly spasm: readonly [number, number];
}

// ─── Severity → count ranges ────────────────────────────────────────

export const MUSCLE_COUNT: Record<string, CountRange> = {
  severe: {
    tightness: [5, 6],
    tenderness: [4, 5],
    spasm: [3, 4],
  },
  "moderate to severe": {
    tightness: [4, 5],
    tenderness: [3, 4],
    spasm: [2, 3],
  },
  moderate: {
    tightness: [3, 4],
    tenderness: [2, 3],
    spasm: [1, 2],
  },
  "mild to moderate": {
    tightness: [2, 3],
    tenderness: [1, 2],
    spasm: [0, 1],
  },
  mild: {
    tightness: [1, 2],
    tenderness: [1, 1],
    spasm: [0, 0],
  },
};

// Ordered from most severe to least — used by reduceMuscles
const SEVERITY_ORDER = [
  "severe",
  "moderate to severe",
  "moderate",
  "mild to moderate",
  "mild",
] as const;

// ─── Helpers ────────────────────────────────────────────────────────

function shuffled(arr: readonly string[], rng: () => number): string[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function pickCount(
  rng: () => number,
  min: number,
  max: number,
  poolSize: number,
): number {
  const clampedMin = Math.min(min, poolSize);
  const clampedMax = Math.min(max, poolSize);
  if (clampedMin === clampedMax) return clampedMin;
  return clampedMin + Math.floor(rng() * (clampedMax - clampedMin + 1));
}

// ─── selectInitialMuscles ───────────────────────────────────────────

export function selectInitialMuscles(
  bodyPart: string,
  severity: string,
  seed: number,
): SelectedMuscles {
  const pools = TEMPLATE_MUSCLES[bodyPart as BodyPartKey];
  if (!pools) {
    throw new Error(`Unknown body part: ${bodyPart}`);
  }

  const counts = MUSCLE_COUNT[severity];
  if (!counts) {
    throw new Error(`Unknown severity: ${severity}`);
  }

  const { rng } = createSeededRng(seed);

  // 1. Shuffle tightness pool, pick N
  const shuffledTightness = shuffled(pools.tightness, rng);
  const tCount = pickCount(
    rng,
    counts.tightness[0],
    counts.tightness[1],
    shuffledTightness.length,
  );
  const tightness = shuffledTightness.slice(0, tCount);

  // 2. Tenderness: intersect tightness selection with tenderness pool,
  //    preserving the shuffled order from tightness
  const tendernessPool = new Set(pools.tenderness as readonly string[]);
  const tendernessEligible = tightness.filter((m) => tendernessPool.has(m));
  const dCount = pickCount(
    rng,
    counts.tenderness[0],
    counts.tenderness[1],
    tendernessEligible.length,
  );
  const tenderness = tendernessEligible.slice(0, dCount);

  // 3. Spasm: intersect tenderness selection with spasm pool,
  //    preserving order from tenderness
  const spasmPool = new Set(pools.spasm as readonly string[]);
  const spasmEligible = tenderness.filter((m) => spasmPool.has(m));
  const sCount = pickCount(
    rng,
    counts.spasm[0],
    counts.spasm[1],
    spasmEligible.length,
  );
  const spasm = spasmEligible.slice(0, sCount);

  return { tightness, tenderness, spasm };
}

// ─── reduceMuscles ──────────────────────────────────────────────────

function severityIndex(severity: string): number {
  const idx = SEVERITY_ORDER.indexOf(severity as (typeof SEVERITY_ORDER)[number]);
  if (idx === -1) {
    throw new Error(`Unknown severity: ${severity}`);
  }
  return idx;
}

export function reduceMuscles(
  current: SelectedMuscles,
  newSeverity: string,
): SelectedMuscles {
  const counts = MUSCLE_COUNT[newSeverity];
  if (!counts) {
    throw new Error(`Unknown severity: ${newSeverity}`);
  }

  // Same or higher severity → no change
  // (We can't detect "same" from counts alone, so compare by max counts)
  const tMax = counts.tightness[1];
  const dMax = counts.tenderness[1];
  const sMax = counts.spasm[1];

  if (
    current.tightness.length <= tMax &&
    current.tenderness.length <= dMax &&
    current.spasm.length <= sMax
  ) {
    return current;
  }

  // Trim from end (core muscles = front of list, recover last = end)
  const newTightness = current.tightness.slice(
    0,
    Math.min(current.tightness.length, tMax),
  );

  // Tenderness must remain subset of tightness after trim
  const tightnessSet = new Set(newTightness);
  const filteredTenderness = current.tenderness.filter((m) =>
    tightnessSet.has(m),
  );
  const newTenderness = filteredTenderness.slice(
    0,
    Math.min(filteredTenderness.length, dMax),
  );

  // Spasm must remain subset of tenderness after trim
  const tendernessSet = new Set(newTenderness);
  const filteredSpasm = current.spasm.filter((m) => tendernessSet.has(m));
  const newSpasm = filteredSpasm.slice(
    0,
    Math.min(filteredSpasm.length, sMax),
  );

  return {
    tightness: newTightness,
    tenderness: newTenderness,
    spasm: newSpasm,
  };
}
