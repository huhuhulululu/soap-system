/**
 * Shared helpers for the TX sequence sub-engine pipeline.
 *
 * Moved out of src/generator/tx-sequence-engine.ts during Tier B step 1
 * Phase B1.4 to break the module-cycle risk between tx-sequence-engine
 * (orchestrator) and stages/*.ts. These helpers are PURE — no RNG
 * capture, no mutable state. Behaviour is byte-identical to the original
 * definitions; snapshot regressions would indicate accidental drift.
 */

import type { GenerationContext, SeverityLevel } from "../../types";
import { getWeightedOptions, type RuleContext } from "../../parser/rule-engine";
import { getTemplateOptionsForField } from "../../parser/template-rule-whitelist";
import {
  TEMPLATE_TX_REASON,
  TEMPLATE_TX_ADVERSE,
  TEMPLATE_TX_WHAT_CHANGED,
  TEMPLATE_TX_FINDING_TYPE,
  TEMPLATE_TX_TOLERATED,
  TEMPLATE_TX_RESPONSE,
  TEMPLATE_NEEDLE_POINTS,
  NEEDLE_GROUP_SIZES,
  type NeedleGroups,
  type BodyPartKey,
} from "../../shared/template-options";

// ─── Primitive helpers ──────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Parse pain goal string ('3', '3-4', '4-5') to integer (lower bound) */
export function painGoalToInt(goal: string): number {
  const m = goal.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 5;
}

/** Parse symptomPct goal string ('(30%-40%)', '(40%-50%)') to decade index (3, 4, ...) */
export function symptomGoalToDecade(goal: string): number {
  const m = goal.match(/(\d+)/);
  return m ? Math.round(parseInt(m[1], 10) / 10) : 4;
}

/** Map ADL severity string to numeric level */
const ADL_SEVERITY_TO_NUM: Record<string, number> = {
  mild: 1,
  "mild-moderate": 2,
  moderate: 2,
  "moderate-severe": 3,
  severe: 4,
};
export function adlGoalToNum(goal: string): number {
  const normalized = goal.toLowerCase().replace(/\s+to\s+/g, "-");
  return ADL_SEVERITY_TO_NUM[normalized] ?? 2;
}

/** Map initial severity string to ADL numeric level */
export function severityToAdlLevel(severity: string): number {
  const map: Record<string, number> = {
    severe: 4,
    "moderate to severe": 4,
    moderate: 3,
    "mild to moderate": 2,
    mild: 1,
  };
  return map[severity] ?? 3;
}

/** Parse initial symptomScale string ('70%-80%', '60%') to decade index */
export function symptomScaleToDecade(scale: string): number {
  const m = scale.match(/(\d+)/);
  return m ? Math.round(parseInt(m[1], 10) / 10) : 7;
}

/** Map frequency string to numeric level */
export function frequencyToNum(freq: string): number {
  if (freq.includes("Constant")) return 3;
  if (freq.includes("Frequent")) return 2;
  if (freq.includes("Occasional")) return 1;
  if (freq.includes("Intermittent")) return 0;
  return 3;
}

export function parsePainTarget(
  target: string | undefined,
  fallback: number,
): number {
  if (!target) return fallback;
  const nums = (target.match(/\d+/g) || [])
    .map((n) => parseInt(n, 10))
    .filter((n) => !isNaN(n));
  if (nums.length === 0) return fallback;
  if (nums.length === 1) return nums[0];
  return (nums[0] + nums[1]) / 2;
}

/**
 * Map severity level to deterministic count for ADL / aggravating selection.
 */
export function severityToCount(
  severity: string,
  type: "adl" | "aggravating",
): number {
  const ADL_COUNTS: Record<string, number> = {
    severe: 5,
    "moderate to severe": 4,
    moderate: 3,
    "mild to moderate": 2,
    mild: 1,
  };
  const AGG_COUNTS: Record<string, number> = {
    severe: 3,
    "moderate to severe": 2,
    moderate: 2,
    "mild to moderate": 1,
    mild: 1,
  };
  const map = type === "adl" ? ADL_COUNTS : AGG_COUNTS;
  return map[severity] ?? 3;
}

/** Snap pain to dropdown grid (0.5 step labels) */
export function snapPainToGrid(rawPain: number): {
  value: number;
  label: string;
} {
  const clamped = Math.max(0, Math.min(10, rawPain));
  const floor = Math.floor(clamped);
  const frac = clamped - floor;

  if (frac >= 0.75) {
    const val = Math.min(10, floor + 1);
    return { value: val, label: `${val}` };
  } else if (frac >= 0.25) {
    const hi = Math.min(10, floor + 1);
    return { value: clamped, label: `${hi}-${floor}` };
  } else {
    return { value: floor, label: `${floor}` };
  }
}

/** Symptom% snap — 10% decade labels */
export function snapSymptomToGrid(rawPct: number): string {
  const clamped = Math.max(10, Math.min(100, rawPct));
  const decade = Math.floor(clamped / 10) * 10;
  const frac = (clamped - decade) / 10;

  if (frac >= 0.75) {
    return `${Math.min(100, decade + 10)}%`;
  } else if (frac >= 0.25) {
    return `${decade}%-${Math.min(100, decade + 10)}%`;
  } else {
    return `${decade}%`;
  }
}

/** Local severityFromPain mirrors src/shared/severity.ts; kept here byte-identical
 *  during Tier B step 1 to guarantee zero PRNG shift. Tier B step 2+ may unify. */
export function severityFromPain(pain: number): SeverityLevel {
  if (pain >= 9) return "severe";
  if (pain >= 7) return "moderate to severe";
  if (pain >= 6) return "moderate";
  if (pain >= 4) return "mild to moderate";
  return "mild";
}

export function findTemplateOption(
  fieldPath: string,
  preferred: string[],
  fallback: string,
): string {
  const options = getTemplateOptionsForField(fieldPath);
  if (options.length === 0) return fallback;
  const lowerMap = new Map(options.map((o) => [o.toLowerCase(), o]));
  for (const p of preferred) {
    const hit = lowerMap.get(p.toLowerCase());
    if (hit) return hit;
  }
  return options[0];
}

// ─── Rule-context + dimScore ────────────────────────────────────────

export function buildRuleContext(
  ctx: GenerationContext,
  painScaleCurrent: number,
  severityLevel: SeverityLevel,
): RuleContext {
  return {
    header: {
      noteType: "TX",
      insuranceType: ctx.insuranceType,
    },
    subjective: {
      chronicityLevel: ctx.chronicityLevel,
      primaryBodyPart: {
        bodyPart: ctx.primaryBodyPart,
        laterality: ctx.laterality,
      },
      painScale: {
        current: painScaleCurrent,
      },
      symptomChange: "improvement of symptom(s)",
      adlDifficulty: {
        level: severityLevel,
      },
    },
    assessment: {
      tcmDiagnosis: {
        localPattern: ctx.localPattern,
        systemicPattern: ctx.systemicPattern,
      },
    },
    patient: {
      medicalHistory: ctx.hasPacemaker ? ["Pacemaker"] : [],
    },
  };
}

export function computeDimensionScore(input: {
  painDelta: number;
  symptomScaleChanged: boolean;
  severityChanged: boolean;
  frequencyImproved: boolean;
  adlImproved: boolean;
  tightnessTrend: "reduced" | "slightly reduced" | "stable";
  tendernessTrend: "reduced" | "slightly reduced" | "stable";
  spasmTrend: "reduced" | "slightly reduced" | "stable";
  romTrend: "improved" | "slightly improved" | "stable";
  strengthTrend: "improved" | "slightly improved" | "stable";
}): { score: number; changedDims: string[] } {
  const changedDims: string[] = [];
  let score = 0;

  if (input.painDelta > 0) {
    const painContrib = Math.min(input.painDelta / 2.0, 1.0) * 0.25;
    score += painContrib;
    changedDims.push("pain");
  }

  if (input.symptomScaleChanged) {
    score += 0.12;
    changedDims.push("symptomScale");
  }

  if (input.severityChanged) {
    score += 0.12;
    changedDims.push("severity");
  }

  if (input.frequencyImproved) {
    score += 0.15;
    changedDims.push("frequency");
  }

  if (input.adlImproved) {
    score += 0.1;
    changedDims.push("ADL");
  }

  const trendDims = [
    { name: "tightness", trend: input.tightnessTrend, full: "reduced" },
    { name: "tenderness", trend: input.tendernessTrend, full: "reduced" },
    { name: "spasm", trend: input.spasmTrend, full: "reduced" },
    { name: "ROM", trend: input.romTrend, full: "improved" },
    { name: "strength", trend: input.strengthTrend, full: "improved" },
  ];

  for (const d of trendDims) {
    if (d.trend === d.full) {
      score += 0.1;
      changedDims.push(d.name);
    } else if (d.trend !== "stable") {
      score += 0.05;
      changedDims.push(d.name);
    }
  }

  return { score: Math.round(score * 1000) / 1000, changedDims };
}

// ─── Weighted picks ─────────────────────────────────────────────────

export function addProgressBias(
  fieldPath: string,
  weighted: Array<{ option: string; weight: number; reasons: string[] }>,
  progress: number,
): Array<{ option: string; weight: number; reasons: string[] }> {
  const isLate = progress >= 0.67;
  const isMid = progress >= 0.34 && progress < 0.67;

  return weighted
    .map((item) => {
      let bias = 0;
      const text = item.option.toLowerCase();

      if (fieldPath === "subjective.symptomChange") {
        if (text.includes("improvement of symptom"))
          bias += isLate ? 60 : isMid ? 25 : 5;
        if (text.includes("exacerbate")) bias -= 70;
        if (text.includes("came back")) bias -= isLate ? 55 : isMid ? 15 : -5;
      }

      if (fieldPath === "subjective.reason") {
        if (
          !isLate &&
          (text.includes("energy level improved") ||
            text.includes("sleep quality improved"))
        )
          bias += 35;
        if (isMid && text.includes("reduced level of pain")) bias += 30;
        if (
          isLate &&
          text.includes("less difficulty performing daily activities")
        )
          bias += 40;
      }

      if (fieldPath === "subjective.painFrequency") {
        if (isLate && text.includes("occasional")) bias += 35;
        if (isMid && text.includes("frequent")) bias += 20;
        if (!isLate && text.includes("constant")) bias += 15;
      }

      if (fieldPath === "objective.muscleTesting.tightness.gradingScale") {
        if (isLate && text === "mild") bias += 40;
        if (isMid && text === "moderate") bias += 25;
        if (text === "severe") bias -= isMid ? 50 : isLate ? 80 : 10;
        if (text === "moderate to severe") bias -= isMid ? 30 : isLate ? 60 : 5;
      }

      if (fieldPath === "objective.muscleTesting.tenderness.gradingScale") {
        if (isLate && (text.includes("+1") || text.includes("mild")))
          bias += 40;
        if (isMid && text.includes("+2")) bias += 25;
        if (text.includes("+4") || text.includes("severe tenderness"))
          bias -= isMid ? 50 : isLate ? 80 : 15;
        if (text.includes("+3") && !text.includes("+3)"))
          bias -= isLate ? 40 : 10;
      }

      return { ...item, weight: item.weight + bias };
    })
    .sort((a, b) => b.weight - a.weight);
}

export function pickSingle(
  fieldPath: string,
  ruleContext: RuleContext,
  progress: number,
  rng: () => number,
  fallback: string,
): string {
  const options = getTemplateOptionsForField(fieldPath);
  if (options.length === 0) return fallback;

  const weighted = getWeightedOptions(fieldPath, options, ruleContext);
  const withBias = addProgressBias(fieldPath, weighted, progress);
  const top = withBias.slice(0, Math.min(3, withBias.length));
  if (top.length === 0) return fallback;

  const total = top.reduce((sum, item) => sum + Math.max(1, item.weight), 0);
  let roll = rng() * total;
  for (const item of top) {
    roll -= Math.max(1, item.weight);
    if (roll <= 0) return item.option;
  }
  return top[0].option;
}

export function pickMultiple(
  fieldPath: string,
  count: number,
  ruleContext: RuleContext,
  progress: number,
  rng: () => number,
): string[] {
  const options = getTemplateOptionsForField(fieldPath);
  if (options.length === 0) return [];
  const weighted = getWeightedOptions(fieldPath, options, ruleContext);
  const withBias = addProgressBias(fieldPath, weighted, progress);
  const shuffledTop = withBias
    .slice(0, Math.min(8, withBias.length))
    .sort(() => rng() - 0.5);
  return shuffledTop.slice(0, count).map((x) => x.option);
}

/** V09: 4-group needle point selection with deterministic seed */
export function selectNeedleGroups(
  bp: BodyPartKey,
  seedValue: number,
): NeedleGroups {
  const entry = TEMPLATE_NEEDLE_POINTS[bp] ?? TEMPLATE_NEEDLE_POINTS.LBP;
  const sizes = NEEDLE_GROUP_SIZES[bp] ?? NEEDLE_GROUP_SIZES.LBP;
  const [f1Size, f2Size, b1Size, b2Size] = sizes;

  const deterministicShuffle = (pool: readonly string[], seed: number): string[] => {
    const arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) {
      const j =
        Math.abs(Math.round(Math.sin(seed * (i + 1)) * 10000)) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const frontShuffled = deterministicShuffle(entry.frontPool, seedValue);
  const backShuffled = deterministicShuffle(entry.backPool, seedValue + 0.5);

  const front1 = frontShuffled.slice(0, f1Size);
  const front2 = frontShuffled.slice(f1Size, f1Size + f2Size);
  const back1 = backShuffled.slice(0, b1Size);
  const back2 = backShuffled.slice(b1Size, b1Size + b2Size);

  return { front1, front2, back1, back2 };
}

// ─── Assessment synthesis ───────────────────────────────────────────

export function deriveAssessmentFromSOA(input: {
  painDelta: number;
  adlDelta: number;
  frequencyImproved: boolean;
  visitIndex: number;
  objectiveTightnessTrend: "reduced" | "slightly reduced" | "stable";
  objectiveTendernessTrend: "reduced" | "slightly reduced" | "stable";
  objectiveSpasmTrend: "reduced" | "slightly reduced" | "stable";
  objectiveRomTrend: "improved" | "slightly improved" | "stable";
  objectiveStrengthTrend: "improved" | "slightly improved" | "stable";
  cumulativePainDrop: number;
  progress: number;
  bodyPart: string;
  dimScore: number;
  changedDims: string[];
  associatedSymptom?: string;
  symptomScaleChanged: boolean;
  severityChanged: boolean;
}): {
  present: string;
  patientChange: string;
  whatChanged: string;
  physicalChange: string;
  findingType: string;
  tolerated: string;
  response: string;
  adverseEffect: string;
} {
  const uniqueOrdered = (parts: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of parts) {
      const key = p.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  };

  const strongCumulative =
    input.cumulativePainDrop >= 2.5 && input.progress >= 0.4;
  const visitLevelStrong = input.dimScore >= 0.3;

  const present =
    input.dimScore === 0
      ? "no change."
      : strongCumulative || visitLevelStrong
        ? "improvement of symptom(s)."
        : "slight improvement of symptom(s).";

  const patientChange =
    input.dimScore === 0
      ? "remained the same"
      : strongCumulative || visitLevelStrong
        ? "decreased"
        : "slightly decreased";

  const symptomToWhatChanged: Record<string, string> = {
    soreness: TEMPLATE_TX_WHAT_CHANGED[5],
    stiffness: TEMPLATE_TX_WHAT_CHANGED[6],
    heaviness: TEMPLATE_TX_WHAT_CHANGED[7],
    weakness: TEMPLATE_TX_WHAT_CHANGED[4],
    numbness: TEMPLATE_TX_WHAT_CHANGED[3],
  };
  const symptomWhatChanged =
    symptomToWhatChanged[input.associatedSymptom ?? "soreness"] ??
    TEMPLATE_TX_WHAT_CHANGED[5];

  const whatChanged = (() => {
    const parts: string[] = [];

    if (input.frequencyImproved) parts.push(TEMPLATE_TX_WHAT_CHANGED[1]);

    if (input.painDelta > 0.3 && !input.frequencyImproved) {
      parts.push(TEMPLATE_TX_WHAT_CHANGED[0]);
    }

    if (input.adlDelta > 0.2) {
      parts.push(TEMPLATE_TX_WHAT_CHANGED[8]);
    }

    if (input.symptomScaleChanged) {
      parts.push(symptomWhatChanged);
    }

    if (input.severityChanged) {
      parts.push(TEMPLATE_TX_WHAT_CHANGED[6]);
    }

    const hasStrongObjective =
      input.objectiveRomTrend === "improved" ||
      input.objectiveStrengthTrend === "improved" ||
      input.objectiveTightnessTrend === "reduced";

    if (input.bodyPart === "NECK" && hasStrongObjective && parts.length < 3) {
      const neckOptions = [
        TEMPLATE_TX_WHAT_CHANGED[6],
        TEMPLATE_TX_WHAT_CHANGED[4],
        TEMPLATE_TX_WHAT_CHANGED[3],
      ];
      parts.push(neckOptions[input.visitIndex % neckOptions.length]);
    }

    if (parts.length === 0 && input.dimScore > 0) {
      const dimToWhatChanged: Record<string, string> = {
        pain: TEMPLATE_TX_WHAT_CHANGED[0],
        frequency: TEMPLATE_TX_WHAT_CHANGED[1],
        symptomScale: symptomWhatChanged,
        severity: TEMPLATE_TX_WHAT_CHANGED[6],
        ADL: TEMPLATE_TX_WHAT_CHANGED[8],
        tightness: TEMPLATE_TX_WHAT_CHANGED[6],
        tenderness: TEMPLATE_TX_WHAT_CHANGED[6],
        spasm: TEMPLATE_TX_WHAT_CHANGED[6],
        strength: TEMPLATE_TX_WHAT_CHANGED[4],
        ROM: TEMPLATE_TX_WHAT_CHANGED[6],
      };
      const mapped = input.changedDims.map((d) => dimToWhatChanged[d]).find(Boolean);
      if (mapped) parts.push(mapped);
    }

    if (parts.length === 0) return TEMPLATE_TX_WHAT_CHANGED[9];

    const normalizedParts = uniqueOrdered(parts);
    if (normalizedParts.length === 1) return normalizedParts[0];
    return (
      normalizedParts.slice(0, -1).join(", ") +
      " and " +
      normalizedParts[normalizedParts.length - 1]
    );
  })();

  const strongPhysicalImprove =
    input.objectiveRomTrend === "improved" ||
    input.objectiveStrengthTrend === "improved" ||
    input.objectiveTightnessTrend === "reduced" ||
    input.objectiveTendernessTrend === "reduced" ||
    input.objectiveSpasmTrend === "reduced";

  const hasAnyObjectiveImprove =
    input.objectiveRomTrend !== "stable" ||
    input.objectiveStrengthTrend !== "stable" ||
    input.objectiveTightnessTrend !== "stable" ||
    input.objectiveTendernessTrend !== "stable" ||
    input.objectiveSpasmTrend !== "stable";

  const reduceParts: string[] = [];
  const increaseParts: string[] = [];

  if (input.objectiveRomTrend !== "stable") {
    reduceParts.push(TEMPLATE_TX_FINDING_TYPE[4]);
  }
  if (input.objectiveTightnessTrend !== "stable")
    reduceParts.push(TEMPLATE_TX_FINDING_TYPE[0]);
  if (input.objectiveTendernessTrend !== "stable")
    reduceParts.push(TEMPLATE_TX_FINDING_TYPE[1]);
  if (input.objectiveSpasmTrend !== "stable")
    reduceParts.push(TEMPLATE_TX_FINDING_TYPE[2]);
  if (input.objectiveStrengthTrend !== "stable")
    increaseParts.push(TEMPLATE_TX_FINDING_TYPE[5]);

  const reduceWord = strongPhysicalImprove ? "reduced" : "slightly reduced";
  const increaseWord = strongPhysicalImprove ? "increased" : "slight increased";

  const joinParts = (parts: string[]) => {
    const normalized = uniqueOrdered(parts);
    if (normalized.length === 1) return normalized[0];
    return (
      normalized.slice(0, -1).join(", ") +
      " and " +
      normalized[normalized.length - 1]
    );
  };

  const physicalChange = (() => {
    if (!hasAnyObjectiveImprove) return "remained the same";
    if (reduceParts.length > 0 && increaseParts.length > 0) {
      return `${reduceWord} ${joinParts(reduceParts)} and ${increaseWord} ${joinParts(increaseParts)}`;
    }
    if (increaseParts.length > 0) return increaseWord;
    return reduceWord;
  })();

  const findingType = (() => {
    const allParts = uniqueOrdered([...reduceParts, ...increaseParts]);
    if (allParts.length === 0) return TEMPLATE_TX_FINDING_TYPE[4];
    return joinParts(allParts);
  })();

  const TOLERATED_OPTIONS = [...TEMPLATE_TX_TOLERATED];
  const RESPONSE_OPTIONS = [...TEMPLATE_TX_RESPONSE];

  const tolerated =
    TOLERATED_OPTIONS[input.visitIndex % TOLERATED_OPTIONS.length];
  const response = (() => {
    if (!strongPhysicalImprove && input.painDelta <= 0) {
      return RESPONSE_OPTIONS[input.visitIndex % 6] || "well";
    }
    const candidates: number[] = [];
    if (input.objectiveSpasmTrend !== "stable") candidates.push(6);
    if (input.painDelta > 0) candidates.push(7);
    if (input.objectiveRomTrend !== "stable") candidates.push(8);
    if (input.adlDelta > 0.2) candidates.push(9, 10);
    if (input.objectiveStrengthTrend !== "stable") candidates.push(11);
    if (
      candidates.length === 0 &&
      (input.objectiveTightnessTrend !== "stable" ||
        input.objectiveTendernessTrend !== "stable")
    ) {
      candidates.push(4, 5);
    }
    if (candidates.length === 0) {
      return RESPONSE_OPTIONS[input.visitIndex % 6] || "well";
    }
    return (
      RESPONSE_OPTIONS[candidates[input.visitIndex % candidates.length]] ||
      "well"
    );
  })();
  const adverseEffect = TEMPLATE_TX_ADVERSE;

  return {
    present,
    patientChange,
    whatChanged,
    physicalChange,
    findingType,
    tolerated,
    response,
    adverseEffect,
  };
}
