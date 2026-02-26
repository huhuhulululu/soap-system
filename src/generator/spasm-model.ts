export interface SpasmInput {
  readonly tightness: string;
  readonly tenderness: number;
  readonly chronicity?: string;
  readonly bodyPart?: string;
  readonly age?: number;
}

const TIGHTNESS_TO_NUM: Readonly<Record<string, number>> = {
  mild: 1,
  "mild to moderate": 2,
  moderate: 3,
  "moderate to severe": 4,
  severe: 5,
};

const SMALL_JOINTS: readonly string[] = [
  "KNEE",
  "ELBOW",
  "WRIST",
  "ANKLE",
  "HAND",
  "FOOT",
];

const LARGE_MUSCLE_GROUPS: readonly string[] = [
  "LBP",
  "NECK",
  "HIP",
  "SHOULDER",
  "UPPER_BACK",
  "MIDDLE_BACK",
  "MID_LOW_BACK",
  "THIGH",
];

/** Spasm grade text matching MDLand template options (indices 0-4) */
export const SPASM_GRADE_TEXT: readonly string[] = [
  "(0)=No spasm",
  "(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.",
  "(+2)=Occasional spontaneous spasms and easily induced spasms.",
  "(+3)=>1 but < 10 spontaneous spasms per hour.",
  "(+4)=>10 spontaneous spasms per hour.",
];

function baseSpasm(tightnessNum: number, tenderness: number): number {
  const tightMapped = Math.max(0, Math.round((tightnessNum / 5) * 4));
  return Math.round((tightMapped + tenderness) / 2);
}

/**
 * Compute spasm grade (0-4) from tightness + tenderness + modifiers.
 *
 * Base: average of mapped tightness (1-5 → 0-4) and tenderness (1-4).
 * Modifiers: Acute +1, small joints -1, large muscle groups maintain
 * minimum at tenderness level when tightness is high, age >70 -1.
 */
export function computeSpasm(input: SpasmInput): number {
  const tNum = TIGHTNESS_TO_NUM[input.tightness] ?? 3;
  let spasm = baseSpasm(tNum, input.tenderness);

  if (input.chronicity === "Acute") {
    spasm += 1;
  }

  if (input.bodyPart && SMALL_JOINTS.includes(input.bodyPart)) {
    spasm -= 1;
  }

  if (input.bodyPart && LARGE_MUSCLE_GROUPS.includes(input.bodyPart)) {
    if (tNum >= 4) {
      spasm = Math.max(spasm, input.tenderness);
    }
  }

  if (input.age != null && input.age > 70) {
    spasm -= 1;
  }

  return Math.max(0, Math.min(4, spasm));
}
