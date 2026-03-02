/**
 * Muscle → ADL affinity mapping.
 *
 * When specific muscles are tight/tender, certain ADL activities
 * are more likely to be impaired (reverse direction: Muscle→ADL).
 *
 * All muscle names and ADL names MUST match template-options.ts exactly.
 */

import { type BodyPartKey, TEMPLATE_AGGRAVATING } from "./template-options";

// ─── Types ──────────────────────────────────────────────────────────

export interface WeightedADL {
  readonly adl: string;
  readonly weight: number;
}

export interface WeightedAggravating {
  readonly aggravating: string;
  readonly weight: number;
}

type MuscleADLMap = Record<string, string[]>;

// ─── LBP ────────────────────────────────────────────────────────────

const LBP_AFFINITY: MuscleADLMap = {
  "Quadratus Lumborum": ["Bending over to wear/tie a shoe", "Lifting objects"],
  longissimus: [
    "Standing for long periods of time",
    "sitting for long periods of time",
  ],
  iliocostalis: [
    "Standing for long periods of time",
    "sitting for long periods of time",
  ],
  spinalis: [
    "Standing for long periods of time",
    "sitting for long periods of time",
  ],
  "Gluteal Muscles": [
    "Getting out of bed",
    "Rising from a chair",
    "Going up and down stairs",
  ],
  "Iliopsoas Muscle": [
    "Walking for long periods of time",
    "Standing for long periods of time",
  ],
  "The Multifidus muscles": [
    "Bending over to wear/tie a shoe",
    "Lifting objects",
  ],
};

// ─── NECK ───────────────────────────────────────────────────────────

const NECK_AFFINITY: MuscleADLMap = {
  Trapezius: [
    "turning the head when crossing the street",
    "carry/handing grocery bags",
  ],
  "sternocleidomastoid muscles": [
    "tilting head to talking the phone",
    "looking down watching steps",
  ],
  "Levator Scapulae": [
    "sit and watching TV over 20 mins",
    "reading newspaper/book",
  ],
  "Scalene anterior / med / posterior": ["gargling", "showering"],
};

// ─── SHOULDER ───────────────────────────────────────────────────────

const SHOULDER_AFFINITY: MuscleADLMap = {
  "upper trapezius": [
    "raising up the hand to comb hair",
    "reach top of cabinet to get object(s)",
  ],
  "levator scapula": [
    "raising up the hand to comb hair",
    "reach top of cabinet to get object(s)",
  ],
  supraspinatus: [
    "abduct arm get the objects from other people",
    "Overhead activities",
  ],
  "middle deltoid": [
    "abduct arm get the objects from other people",
    "Overhead activities",
  ],
  "bicep long head": [
    "pushing/pulling cart, box, door",
    "handing/carrying moderate objects",
  ],
  "deltoid ant fibres": [
    "pushing/pulling cart, box, door",
    "handing/carrying moderate objects",
  ],
  rhomboids: [
    "reach to back to unzip",
    "touch opposite side shoulder to put coat on",
  ],
  "greater tuberosity": ["put on/take off the clothes", "doing laundry"],
  "lesser tuberosity": ["put on/take off the clothes", "doing laundry"],
  "AC joint": ["put on/take off the clothes", "doing laundry"],
};

// ─── KNEE ───────────────────────────────────────────────────────────

const KNEE_AFFINITY: MuscleADLMap = {
  "Gluteus Maximus": ["Going up and down stairs", "Rising from a chair"],
  "Gluteus medius / minimus": [
    "Going up and down stairs",
    "Rising from a chair",
  ],
  "Hamstrings muscle group": [
    "bending knee to sit position",
    "Standing for long periods of time",
  ],
  "Rectus Femoris": [
    "bending knee to sit position",
    "Standing for long periods of time",
  ],
  "Gastronemius muscle": ["Walking for long periods of time"],
  "Tibialis Post/ Anterior": ["Walking for long periods of time"],
  "Iliotibial Band ITB": ["bending down put in/out of the shoes"],
};

// ─── HIP (also used for THIGH) ─────────────────────────────────────

const HIP_AFFINITY: MuscleADLMap = {
  piriformis: ["Going up and down stairs", "Rising from a chair"],
  "gluteus maximus": ["Going up and down stairs", "Rising from a chair"],
  iliopsoas: ["Bending over to wear/tie a shoe", "Lifting objects"],
  TFL: ["Sitting or standing for long periods of time"],
  "IT band": ["Sitting or standing for long periods of time"],
  quadriceps: ["performing household chores", "long hours of driving"],
  "rectus femoris": ["performing household chores", "long hours of driving"],
  hamstrings: ["performing household chores", "long hours of driving"],
};

// ─── ELBOW ──────────────────────────────────────────────────────────

const ELBOW_AFFINITY: MuscleADLMap = {
  "Lattisimus dorsi": [
    "holding the pot for cooking",
    "performing household chores",
  ],
  "Erector spinae": ["working long time in front of computer"],
  Hamstrings: ["long hours of driving"],
  "Gluteus Maximus": ["long hours of driving"],
};

// ─── Exported map ───────────────────────────────────────────────────

export const MUSCLE_ADL_AFFINITY: Record<string, MuscleADLMap> = {
  LBP: LBP_AFFINITY,
  NECK: NECK_AFFINITY,
  SHOULDER: SHOULDER_AFFINITY,
  KNEE: KNEE_AFFINITY,
  ELBOW: ELBOW_AFFINITY,
  HIP: HIP_AFFINITY,
  THIGH: HIP_AFFINITY,
};

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Given selected muscles and a body part, return ADL activities
 * weighted by how many of the selected muscles map to them.
 * Sorted descending by weight.
 */
export function getADLWeightsByMuscles(
  selectedMuscles: readonly string[],
  bodyPart: string,
): readonly WeightedADL[] {
  const map = MUSCLE_ADL_AFFINITY[bodyPart];
  if (!map || selectedMuscles.length === 0) return [];

  const counts = new Map<string, number>();
  for (const muscle of selectedMuscles) {
    const adls = map[muscle];
    if (!adls) continue;
    for (const adl of adls) {
      counts.set(adl, (counts.get(adl) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([adl, weight]) => ({ adl, weight }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Given selected muscles and a body part, return aggravating factors
 * weighted by how many of the selected muscles map to them.
 * Only returns items that appear in both the affinity map AND
 * TEMPLATE_AGGRAVATING for that body part.
 * Sorted descending by weight.
 */
export function getAggravatingWeightsByMuscles(
  selectedMuscles: readonly string[],
  bodyPart: string,
): readonly WeightedAggravating[] {
  const map = MUSCLE_ADL_AFFINITY[bodyPart];
  if (!map || selectedMuscles.length === 0) return [];

  const counts = new Map<string, number>();
  for (const muscle of selectedMuscles) {
    const adls = map[muscle];
    if (!adls) continue;
    for (const adl of adls) {
      counts.set(adl, (counts.get(adl) ?? 0) + 1);
    }
  }

  const aggravatingSet = new Set(
    TEMPLATE_AGGRAVATING[bodyPart as BodyPartKey] ?? [],
  );

  return Array.from(counts.entries())
    .filter(([adl]) => aggravatingSet.has(adl))
    .map(([aggravating, weight]) => ({ aggravating, weight }))
    .sort((a, b) => b.weight - a.weight);
}
