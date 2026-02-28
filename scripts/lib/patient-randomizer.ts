import type { GenerationContext } from '../../src/types';
import {
  TEMPLATE_PAIN_TYPES,
  TEMPLATE_AGGRAVATING,
  TEMPLATE_RELIEVING,
  TEMPLATE_CAUSATIVES,
  type BodyPartKey,
} from '../../src/shared/template-options';

// mulberry32 PRNG
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick<T>(rng: () => number, options: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return options[options.length - 1];
}

function pickN<T>(rng: () => number, arr: readonly T[], min: number, max: number): T[] {
  const n = min + Math.floor(rng() * (max - min + 1));
  const shuffled = [...arr].sort(() => rng() - 0.5);
  return shuffled.slice(0, n);
}

function normalClamped(rng: () => number, mu: number, sigma: number, lo: number, hi: number): number {
  let val: number;
  do {
    const u1 = rng() || 0.0001;
    const u2 = rng();
    val = mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  } while (val < lo || val > hi);
  return Math.round(val);
}

const LATERALITY_MAP: Record<string, { options: string[]; weights: number[] }> = {
  LBP:      { options: ['bilateral', 'unspecified'], weights: [40, 60] },
  NECK:     { options: ['bilateral', 'unspecified'], weights: [30, 70] },
  SHOULDER: { options: ['bilateral', 'left', 'right'], weights: [60, 20, 20] },
  KNEE:     { options: ['bilateral', 'left', 'right'], weights: [60, 20, 20] },
  ELBOW:    { options: ['left', 'right'], weights: [45, 55] },
  HIP:      { options: ['left', 'right'], weights: [50, 50] },
};

const LOCAL_PATTERNS = [
  'Qi Stagnation, Blood Stasis', 'Blood Stasis', 'Wind-Cold Invasion',
  'Cold-Damp + Wind-Cold', 'Qi Stagnation', 'Damp-Heat', 'Phlegm-Damp',
  'Liver Qi Stagnation', 'Blood Deficiency', 'Qi & Blood Deficiency',
  'LV/GB Damp-Heat', 'Phlegm-Heat',
] as const;
const LOCAL_WEIGHTS = [35, 20, 15, 10, 5, 4, 3, 2, 2, 2, 1, 1];

const SYSTEMIC_PATTERNS = [
  'Blood Deficiency', 'Kidney Yang Deficiency', 'Qi Deficiency',
  'Kidney Qi Deficiency', 'Kidney Yin Deficiency', 'Spleen Deficiency',
  'Qi & Blood Deficiency', 'Liver Yang Rising', 'Yin Deficiency Fire',
  'Kidney Essence Deficiency', 'LU & KI Deficiency', 'Wei Qi Deficiency',
  'LV/GB Fire', 'ST & Intestine Damp-Heat', 'Stomach Heat',
  'Food Retention', 'Ying & Wei Disharmony',
] as const;
const SYSTEMIC_WEIGHTS = [25, 20, 12, 8, 7, 5, 5, 4, 3, 2, 2, 2, 1, 1, 1, 1, 1];

type AssociatedSymptom = 'soreness' | 'weakness' | 'stiffness' | 'heaviness' | 'numbness';
const SYMPTOMS: AssociatedSymptom[] = ['soreness', 'stiffness', 'numbness', 'weakness', 'heaviness'];
const SYMPTOM_WEIGHTS = [35, 30, 15, 12, 8];

const PAIN_FREQUENCIES = [
  'Constant (symptoms occur between 76% and 100% of the time)',
  'Frequent (symptoms occur between 51% and 75% of the time)',
  'Occasional (symptoms occur between 26% and 50% of the time)',
  'Intermittent (symptoms occur less than 25% of the time)',
] as const;

const SYMPTOM_SCALES = [
  '90%-100%', '80%-90%', '70%-80%', '60%-70%', '50%-60%',
  '40%-50%', '30%-40%', '20%-30%',
] as const;

function deriveSeverity(pain: number): string {
  if (pain <= 3) return 'mild';
  if (pain <= 5) return 'mild to moderate';
  if (pain <= 6) return 'moderate';
  if (pain <= 7) return 'moderate to severe';
  return 'severe';
}

export function randomizePatientContext(
  bodyPart: string,
  seed: number,
): GenerationContext {
  const rng = mulberry32(seed);
  const bp = bodyPart as BodyPartKey;

  const age = normalClamped(rng, 65, 8, 50, 85);
  const gender = rng() < 0.6 ? 'Female' as const : 'Male' as const;
  const painCurrent = normalClamped(rng, 7, 1.5, 4, 9);
  const painWorst = Math.min(10, painCurrent + Math.floor(rng() * 2) + 1);
  const painBest = Math.max(1, painCurrent - Math.floor(rng() * 3) - 1);

  const chronicityLevel = weightedPick(rng,
    ['Chronic' as const, 'Sub Acute' as const, 'Acute' as const],
    [70, 20, 10],
  );

  const lat = LATERALITY_MAP[bodyPart] || { options: ['bilateral'], weights: [100] };
  const laterality = weightedPick(rng, lat.options, lat.weights) as GenerationContext['laterality'];

  const localPattern = weightedPick(rng, LOCAL_PATTERNS, LOCAL_WEIGHTS);
  const systemicPattern = weightedPick(rng, SYSTEMIC_PATTERNS, SYSTEMIC_WEIGHTS);

  const symptom = weightedPick(rng, SYMPTOMS, SYMPTOM_WEIGHTS);
  const painTypes = pickN(rng, TEMPLATE_PAIN_TYPES[bp] || ['Dull', 'Aching'], 1, 3);
  const painFrequency = weightedPick(rng, PAIN_FREQUENCIES, [40, 30, 20, 10]);
  const symptomScale = weightedPick(rng, SYMPTOM_SCALES, [5, 15, 30, 25, 15, 5, 3, 2]);

  const causatives = TEMPLATE_CAUSATIVES[bp];
  const causativeFactors = causatives ? pickN(rng, causatives, 1, 3) : undefined;

  const aggravating = TEMPLATE_AGGRAVATING[bp];
  const exacerbatingFactors = aggravating ? pickN(rng, aggravating, 2, 4) : undefined;

  const relieving = TEMPLATE_RELIEVING[bp];
  const relievingFactors = relieving ? pickN(rng, relieving, 1, 3) : undefined;

  const durationValue = String(normalClamped(rng, 6, 3, 1, 15));
  const durationUnit = weightedPick(rng,
    ['month(s)', 'year(s)', 'week(s)'],
    [50, 30, 20],
  );

  return {
    noteType: 'IE' as const,
    insuranceType: 'NONE' as const,
    primaryBodyPart: bodyPart as any,
    laterality,
    localPattern,
    systemicPattern,
    chronicityLevel,
    severityLevel: deriveSeverity(painCurrent) as any,
    age,
    gender,
    painCurrent,
    painWorst,
    painBest,
    painTypes,
    associatedSymptoms: [symptom],
    painFrequency,
    symptomScale,
    symptomDuration: { value: durationValue, unit: durationUnit },
    causativeFactors,
    exacerbatingFactors,
    relievingFactors,
  };
}
