import type { GenerationContext, SeverityLevel } from "../types";
import { getWeightedOptions, type RuleContext } from "../parser/rule-engine";
import { getTemplateOptionsForField } from "../parser/template-rule-whitelist";
import {
  inferCondition,
  inferProgressMultiplier,
  inferInitialAdjustments,
} from "../knowledge/medical-history-engine";
import { computeGoalPaths, type GoalPaths } from "./goal-path-calculator";
import { computePatchedGoals } from "./objective-patch";
import {
  STRENGTH_LADDER,
  strengthToIndex,
  strengthFromPain,
} from "../shared/strength-table";
import { createSeededRng } from "../shared/seeded-rng";
import {
  TEMPLATE_MUSCLES,
  TEMPLATE_ADL,
  type BodyPartKey,
} from "../shared/template-options";
import { selectInitialMuscles, reduceMuscles } from "./muscle-selector";
import {
  getADLWeightsByMuscles,
  getAggravatingWeightsByMuscles,
} from "../shared/muscle-adl-affinity";

export interface TXSequenceOptions {
  txCount: number;
  seed?: number;
  /** 从第几个 TX 开始生成（1-based）。省略时从 1 开始。 */
  startVisitIndex?: number;
  /** 从用户最后一个 TX 提取的实际状态，作为续写起点。 */
  initialState?: {
    pain: number;
    tightness: number;
    tenderness: number;
    spasm: number;
    frequency: number;
    painTypes?: string[];
    associatedSymptom?: string;
    symptomScale?: string;
    generalCondition?: string;
    inspection?: string;
    tightnessGrading?: string;
    tendernessGrade?: string;
    tonguePulse?: { tongue: string; pulse: string };
    acupoints?: string[];
    electricalStimulation?: boolean;
    treatmentTime?: number;
  };
}

/** Parse pain goal string ('3', '3-4', '4-5') to integer (lower bound) */
function painGoalToInt(goal: string): number {
  const m = goal.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 5;
}

/** Parse symptomPct goal string ('(30%-40%)', '(40%-50%)') to decade index (3, 4, ...) */
function symptomGoalToDecade(goal: string): number {
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
function adlGoalToNum(goal: string): number {
  // Normalize various formats
  const normalized = goal.toLowerCase().replace(/\s+to\s+/g, "-");
  return ADL_SEVERITY_TO_NUM[normalized] ?? 2;
}

/** Map initial severity string to ADL numeric level */
function severityToAdlLevel(severity: string): number {
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
function symptomScaleToDecade(scale: string): number {
  const m = scale.match(/(\d+)/);
  return m ? Math.round(parseInt(m[1], 10) / 10) : 7;
}

/** Map frequency string to numeric level */
function frequencyToNum(freq: string): number {
  if (freq.includes("Constant")) return 3;
  if (freq.includes("Frequent")) return 2;
  if (freq.includes("Occasional")) return 1;
  if (freq.includes("Intermittent")) return 0;
  return 3;
}

export interface TXVisitState {
  visitIndex: number;
  progress: number;
  painScaleCurrent: number;
  /** 吸附到模板下拉框有效刻度的标签 (如 "8", "8-7", "7", "7-6") */
  painScaleLabel: string;
  severityLevel: SeverityLevel;
  symptomChange: string;
  reasonConnector: string;
  reason: string;
  associatedSymptom: string;
  painFrequency: string;
  generalCondition: string;
  treatmentFocus: string;
  tightnessGrading: string;
  tendernessGrading: string;
  spasmGrading: string;
  tightMuscles: readonly string[];
  tenderMuscles: readonly string[];
  spasmMuscles: readonly string[];
  adlItems: readonly string[];
  aggravatingItems: readonly string[];
  /** Engine-scheduled strength grade (e.g. '3+/5', '4/5') — overrides objective-patch bumpStrength */
  strengthGrade?: string;
  needlePoints: string[];
  /** 舌脉信息，从 IE 继承保持一致 */
  tonguePulse: {
    tongue: string;
    pulse: string;
  };
  /** 续写继承字段 */
  painTypes?: string[];
  inspection?: string;
  symptomScale?: string;
  electricalStimulation?: boolean;
  treatmentTime?: number;
  sideProgress?: {
    left: number;
    right: number;
  };
  objectiveFactors: {
    sessionGapDays: number;
    sleepLoad: number;
    workloadLoad: number;
    weatherExposureLoad: number;
    adherenceLoad: number;
  };
  soaChain: {
    subjective: {
      painChange: "improved" | "similar" | "worsened";
      adlChange: "improved" | "stable";
      frequencyChange: "improved" | "stable";
    };
    objective: {
      tightnessTrend: "reduced" | "slightly reduced" | "stable";
      tendernessTrend: "reduced" | "slightly reduced" | "stable";
      spasmTrend: "reduced" | "slightly reduced" | "stable";
      romTrend: "improved" | "slightly improved" | "stable";
      strengthTrend: "improved" | "slightly improved" | "stable";
    };
    assessment: {
      present: string;
      patientChange: string;
      whatChanged: string;
      physicalChange: string;
      findingType: string;
      tolerated: string;
      response: string;
      adverseEffect: string;
    };
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parsePainTarget(target: string | undefined, fallback: number): number {
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
 * Uses the base (lower) count per severity tier.
 */
function severityToCount(
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

/**
 * 模板 Pain Scale 下拉框有效选项 (来自 ppnSelectComboSingle)
 * 选项: 10|10-9|9|9-8|8|8-7|7|7-6|6|6-5|5|5-4|4|4-3|3|3-2|2|2-1|1|1-0|0
 *
 * 刻度是整数 (10,9,8,...,0)
 * "X-(X-1)" 是过渡范围, 代表"在 X 和 X-1 之间"
 *
 * 吸附逻辑 (0.5 步进):
 *   raw >= N+0.75        → N+1 (整数)
 *   N+0.25 <= raw < N+0.75 → "(N+1)-N" (范围)
 *   raw < N+0.25         → N (整数)
 */
export function snapPainToGrid(rawPain: number): {
  value: number;
  label: string;
} {
  const clamped = Math.max(0, Math.min(10, rawPain));
  const floor = Math.floor(clamped);
  const frac = clamped - floor;

  if (frac >= 0.75) {
    // 接近上一个整数
    const val = Math.min(10, floor + 1);
    return { value: val, label: `${val}` };
  } else if (frac >= 0.25) {
    // 在两个整数之间 → 范围标签 "(floor+1)-floor"
    // value 用实际 rawPain 而非上界, 确保纵向约束能检测到下降
    const hi = Math.min(10, floor + 1);
    return { value: clamped, label: `${hi}-${floor}` };
  } else {
    // 接近当前整数
    return { value: floor, label: `${floor}` };
  }
}

/**
 * Symptom% 吸附 — 与 snapPainToGrid 同逻辑，10% 为一档
 *
 * 整数十位 → "60%", 中间值 → "50%-60%"
 * 输入: rawPct (0-100 的连续值)
 */
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

function severityFromPain(pain: number): SeverityLevel {
  // 与模板整数刻度对齐:
  // 9-10 → severe
  // 7-8  → moderate to severe
  // 6    → moderate
  // 4-5  → mild to moderate
  // 0-3  → mild
  if (pain >= 9) return "severe";
  if (pain >= 7) return "moderate to severe";
  if (pain >= 6) return "moderate";
  if (pain >= 4) return "mild to moderate";
  return "mild";
}

function findTemplateOption(
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

/**
 * ASS-01/02/03: Evidence-based assessment field selection.
 *
 * Derives assessment template values from S/O chain data + cumulative context.
 * All returned strings are from existing TX_*_OPTIONS arrays (ASS-03).
 *
 * ASS-01: whatChanged picks the most-improved metric, not a fixed rotation.
 * ASS-02: present/patientChange strength gated by cumulative evidence + progress.
 */
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
  // ASS-02: cumulative context
  cumulativePainDrop: number; // startPain - currentPain (total from IE baseline)
  progress: number; // 0-1 normalized visit progress
  bodyPart: string; // e.g. "NECK", "SHOULDER", "ELBOW", "LBP", "KNEE"
  // Task 4: multi-dimension inputs
  dimScore: number; // composite dimension change score from computeDimensionScore
  changedDims: string[]; // which dimensions changed
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
  // ASS-02: cumulative + visit-level + dimScore gates language strength
  const strongCumulative =
    input.cumulativePainDrop >= 2.5 && input.progress >= 0.4;
  const visitLevelStrong = input.dimScore >= 0.3;

  const present =
    input.dimScore === 0
      ? "similar symptom(s) as last visit."
      : strongCumulative || visitLevelStrong
        ? "improvement of symptom(s)."
        : "slight improvement of symptom(s).";

  const patientChange =
    input.dimScore === 0
      ? "remained the same"
      : strongCumulative || visitLevelStrong
        ? "decreased"
        : "slightly decreased";

  // ASS-01 + REAL-01: evidence-based whatChanged — collect ALL S-side improved dimensions
  const whatChanged = (() => {
    const parts: string[] = [];

    // Hard chain rule preserved: S frequency improved → A must mention "pain frequency"
    if (input.frequencyImproved) parts.push("pain frequency");

    // Pain improved
    if (input.painDelta > 0.3 && !input.frequencyImproved) {
      parts.push("pain");
    }

    // ADL improved
    if (input.adlDelta > 0.2) {
      parts.push("difficulty in performing ADLs");
    }

    // S-side: symptomScale changed
    if (input.symptomScaleChanged) {
      parts.push("muscles soreness sensation");
    }

    // S-side: severity changed
    if (input.severityChanged) {
      parts.push("severity level");
    }

    // NECK-specific: dizziness/headache/migraine available when O-side improved
    const hasStrongObjective =
      input.objectiveRomTrend === "improved" ||
      input.objectiveStrengthTrend === "improved" ||
      input.objectiveTightnessTrend === "reduced";

    if (input.bodyPart === "NECK" && hasStrongObjective && parts.length < 3) {
      const neckOptions = ["dizziness", "headache", "migraine"];
      parts.push(neckOptions[input.visitIndex % neckOptions.length]);
    }

    // Fallback: dimScore > 0 but no S-side parts collected
    if (parts.length === 0 && input.dimScore > 0) {
      parts.push("pain");
    }

    // Fallback: at least one item
    if (parts.length === 0) return "pain";

    // Join: "pain frequency, difficulty in performing ADLs and muscles soreness sensation"
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  })();

  // Physical change: same logic as before — derived from objective trends
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

  const physicalChange = !hasAnyObjectiveImprove
    ? "remained the same"
    : strongPhysicalImprove
      ? "reduced"
      : "slightly reduced";

  // ASS-01 + REAL-02: findingType lists ALL changed dimensions
  const findingType = (() => {
    const parts: string[] = [];

    if (input.objectiveRomTrend !== "stable") {
      const isLimitationOnly =
        input.bodyPart === "SHOULDER" || input.bodyPart === "ELBOW";
      parts.push(
        !isLimitationOnly &&
          input.progress >= 0.6 &&
          input.cumulativePainDrop >= 2.0
          ? "joint ROM"
          : "joint ROM limitation",
      );
    }
    if (input.objectiveStrengthTrend !== "stable")
      parts.push("muscles strength");
    if (input.objectiveTightnessTrend !== "stable")
      parts.push("local muscles tightness");
    if (input.objectiveTendernessTrend !== "stable")
      parts.push("local muscles tenderness");
    if (input.objectiveSpasmTrend !== "stable")
      parts.push("local muscles spasms");

    if (parts.length === 0) return "joint ROM limitation";
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  })();

  // Phase F: tolerated/response/adverseEffect 按 visitIndex 轮换
  const TOLERATED_OPTIONS = [
    "session",
    "treatment",
    "acupuncture session",
    "acupuncture treatment",
  ];
  const RESPONSE_OPTIONS = [
    "well",
    "with good positioning technique",
    "with good draping technique",
    "with positive verbal response",
    "with good response",
    "with positive response",
    "with good outcome in reducing spasm",
    "with excellent outcome due reducing pain",
    "with good outcome in improving ROM",
    "good outcome in improving ease with functional mobility",
    "with increase ease with functional mobility",
    "with increase ease with function",
  ];
  const ADVERSE_OPTIONS = [
    "No adverse side effect post treatment.",
    "No adverse reaction reported after treatment.",
    "Patient reported no adverse effects following treatment.",
    "No negative side effects observed post treatment.",
  ];

  const tolerated =
    TOLERATED_OPTIONS[input.visitIndex % TOLERATED_OPTIONS.length];
  // response: 根据 objective 改善情况选择相关的 response
  const responseIdx = (() => {
    if (strongPhysicalImprove) {
      // 有明显改善时，选择描述改善的 response
      const improveResponses = [6, 7, 8, 9, 10, 11]; // reducing spasm, reducing pain, improving ROM, etc.
      return improveResponses[input.visitIndex % improveResponses.length];
    }
    // 一般情况轮换前 6 个通用 response
    return input.visitIndex % 6;
  })();
  const response = RESPONSE_OPTIONS[responseIdx] || "well";
  const adverseEffect =
    ADVERSE_OPTIONS[input.visitIndex % ADVERSE_OPTIONS.length];

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

function buildRuleContext(
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

function addProgressBias(
  fieldPath: string,
  weighted: Array<{ option: string; weight: number; reasons: string[] }>,
  progress: number,
): Array<{ option: string; weight: number; reasons: string[] }> {
  const isLate = progress >= 0.67;
  const isMid = progress >= 0.34 && progress < 0.67;
  const isEarly = progress < 0.34;

  return weighted
    .map((item) => {
      let bias = 0;
      const text = item.option.toLowerCase();

      if (fieldPath === "subjective.symptomChange") {
        // 遵循现有规则：早期允许多样性，后期倾向改善
        if (text.includes("improvement of symptom"))
          bias += isLate ? 60 : isMid ? 25 : 5;
        if (text.includes("exacerbate")) bias -= 70; // 加重少见
        if (text.includes("similar")) bias -= isLate ? 60 : isMid ? 25 : 0;
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

      // generalCondition 不再参与进度偏置
      // 它是基于患者基础体质(年龄/基础病/证型)的固定属性，在循环外一次性确定

      if (fieldPath === "subjective.painFrequency") {
        if (isLate && text.includes("occasional")) bias += 35;
        if (isMid && text.includes("frequent")) bias += 20;
        if (!isLate && text.includes("constant")) bias += 15;
      }

      if (fieldPath === "objective.muscleTesting.tightness.gradingScale") {
        if (isLate && text === "mild") bias += 40;
        if (isMid && text === "moderate") bias += 25;
        // 修复: 好转分支中 "severe" 在中后期应强制压低
        if (text === "severe") bias -= isMid ? 50 : isLate ? 80 : 10;
        if (text === "moderate to severe") bias -= isMid ? 30 : isLate ? 60 : 5;
      }

      if (fieldPath === "objective.muscleTesting.tenderness.gradingScale") {
        if (isLate && (text.includes("+1") || text.includes("mild")))
          bias += 40;
        if (isMid && text.includes("+2")) bias += 25;
        // 修复: +4 在中后期强制压低
        if (text.includes("+4") || text.includes("severe tenderness"))
          bias -= isMid ? 50 : isLate ? 80 : 15;
        if (text.includes("+3") && !text.includes("+3)"))
          bias -= isLate ? 40 : 10;
      }

      return { ...item, weight: item.weight + bias };
    })
    .sort((a, b) => b.weight - a.weight);
}

function pickSingle(
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

function pickMultiple(
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

export interface TXSequenceResult {
  states: TXVisitState[];
  /** 用于复现的 seed，传回 options.seed 即可得到相同结果 */
  seed: number;
}

export function generateTXSequenceStates(
  context: GenerationContext,
  options: TXSequenceOptions,
): TXSequenceResult {
  const txCount = Math.max(1, options.txCount);
  const startIdx = options.startVisitIndex || 1;
  const remainingTx = txCount - startIdx + 1;
  const { rng, seed: actualSeed } = createSeededRng(options.seed);

  const ieStartPain = context.previousIE?.subjective?.painScale?.current ?? 8;
  const startPain = options.initialState?.pain ?? ieStartPain;
  // 与 objective-patch 对齐: pain<=3 最优, pain<=6 积极目标, pain>=7 康复曲线
  const stFallback =
    ieStartPain <= 3
      ? 1
      : ieStartPain <= 6
        ? 2
        : Math.ceil(
            ieStartPain -
              (ieStartPain - Math.max(2, ieStartPain * 0.25)) *
                (1 - (1 - 0.55) * (1 - 0.55)),
          );
  // REAL-01: chronic-aware — no txCount threshold, applies whenever chronicityLevel=Chronic
  const chronicCapsEnabled =
    context.chronicityLevel === "Chronic" && !context.disableChronicCaps;
  const chronicEndRatio = chronicCapsEnabled ? 0.55 : 0.25;
  const ltFallback =
    ieStartPain <= 6
      ? 1
      : Math.ceil(Math.max(2, ieStartPain * chronicEndRatio));
  const shortTermTarget = parsePainTarget(
    context.previousIE?.plan?.shortTermGoal?.painScaleTarget,
    stFallback,
  );
  const longTermTarget = parsePainTarget(
    context.previousIE?.plan?.longTermGoal?.painScaleTarget,
    ltFallback,
  );
  // 续写时: 如果起点已接近短期目标，切换到长期目标
  const targetPain =
    startPain - shortTermTarget < 1.5 ? longTermTarget : shortTermTarget;

  // 病史推断: progress 系数 + 初始值修正
  const medHistory = context.medicalHistory || [];
  const baseMultiplier = inferProgressMultiplier(medHistory, context.age);
  // REAL-01: chronic-aware dampener — slower progression for chronic patients
  const chronicDampener = chronicCapsEnabled ? 0.72 : 1.0;
  const progressMultiplier = baseMultiplier * chronicDampener;
  const medAdjustments = inferInitialAdjustments(
    medHistory,
    context.primaryBodyPart,
  );

  let prevPain = startPain;
  let prevPainScaleLabel = snapPainToGrid(startPain).label;
  // PLAT-01: consecutive identical pain label counter
  let consecutiveSameLabel = 0;
  // Reason rotation: independent counter for improvement visits
  let improvementCount = 0;
  let positiveShuffleBag: string[] = [];
  let neutralShuffleBag: string[] = [];
  let cameBackShuffleBag: string[] = [];
  let lastUsedReason = "";
  let prevProgress = startIdx > 1 ? (startIdx - 1) / txCount : 0;
  let prevAdl = 3.5;
  let prevFrequency = options.initialState?.frequency ?? 3;
  let prevSymptomDecade = symptomScaleToDecade(
    options.initialState?.symptomScale || "70%",
  );
  // Tightness/Tenderness/Spasm 初始值: 从 pain 推导 + 病史修正
  const initSeverity = severityFromPain(startPain);
  // Muscle selection: separate seed to avoid shifting main PRNG sequence
  const hasMuscleTemplate = context.primaryBodyPart in TEMPLATE_MUSCLES;
  const initialMuscles = hasMuscleTemplate
    ? selectInitialMuscles(
        context.primaryBodyPart,
        initSeverity,
        actualSeed + 1000,
      )
    : {
        tightness: [] as string[],
        tenderness: [] as string[],
        spasm: [] as string[],
      };
  const severityToInit: Record<string, number> = {
    severe: 4,
    "moderate to severe": 3.5,
    moderate: 3,
    "mild to moderate": 2,
    mild: 1,
  };
  const initObjLevel = severityToInit[initSeverity] ?? 3;
  let prevTightness =
    options.initialState?.tightness ?? Math.round(initObjLevel);
  let prevTenderness =
    options.initialState?.tenderness ?? Math.round(initObjLevel);
  let prevSpasm = Math.min(
    3,
    (options.initialState?.spasm ?? Math.min(3, Math.round(initObjLevel))) +
      medAdjustments.spasmBump,
  );
  let prevRomDeficit = Math.min(0.7, 0.42 + medAdjustments.romDeficitBump);
  let prevStrengthDeficit = 0.35;
  // 纵向单调约束追踪变量
  let prevPainForSeverity = startPain;
  let prevSeverity: SeverityLevel = severityFromPain(
    options.initialState?.pain ?? 8,
  );
  let prevSeverityForAdl: SeverityLevel = prevSeverity;
  let prevAdlImproved = false;
  let prevTightnessGrading = options.initialState?.tightnessGrading ?? "";
  let prevTendernessGrade = options.initialState?.tendernessGrade ?? "";
  let prevAssociatedSymptom = options.initialState?.associatedSymptom ?? "";

  // === generalCondition: 基于病史+年龄+证型的固定属性 ===
  const fixedGeneralCondition: string = (() => {
    if (options.initialState?.generalCondition)
      return options.initialState.generalCondition;
    if (context.baselineCondition) return context.baselineCondition;
    // 使用病史推断引擎
    return inferCondition(
      context.medicalHistory || [],
      context.age,
      context.systemicPattern,
    );
  })();

  // === tonguePulse: 从 IE 继承或从 localPattern 推导（与 IE 生成器使用相同的 TONE_MAP 值） ===
  // 舌脉是患者体质的固定属性，TX 访问应与 IE 保持一致
  const PATTERN_TONGUE_DEFAULTS: Record<
    string,
    { tongue: string; pulse: string }
  > = {
    // === 局部证型 ===
    "Qi Stagnation": { tongue: "thin white coat", pulse: "string-taut" },
    "Liver Qi Stagnation": { tongue: "thin white coat", pulse: "string-taut" },
    "Blood Stasis": { tongue: "purple", pulse: "deep" },
    "Qi Stagnation, Blood Stasis": {
      tongue: "purple, thin white coat",
      pulse: "string-taut",
    },
    "Blood Deficiency": { tongue: "pale, thin dry coat", pulse: "hesitant" },
    "Qi & Blood Deficiency": {
      tongue: "pale, thin white coat",
      pulse: "thready",
    },
    "Wind-Cold Invasion": {
      tongue: "thin white coat",
      pulse: "superficial, tense",
    },
    "Cold-Damp + Wind-Cold": { tongue: "thick, white coat", pulse: "deep" },
    "LV/GB Damp-Heat": {
      tongue: "yellow, sticky (red), thick coat",
      pulse: "rolling rapid (forceful)",
    },
    "Phlegm-Damp": {
      tongue: "big tongue with white sticky coat",
      pulse: "string-taut",
    },
    "Phlegm-Heat": {
      tongue: "yellow, sticky (red), thick coat",
      pulse: "rolling rapid (forceful)",
    },
    "Damp-Heat": {
      tongue: "yellow, sticky (red), thick coat",
      pulse: "rolling rapid (forceful)",
    },
    // === 整体证型 ===
    "Kidney Yang Deficiency": { tongue: "delicate, white coat", pulse: "deep" },
    "Kidney Yin Deficiency": { tongue: "cracked", pulse: "thready" },
    "Kidney Qi Deficiency": {
      tongue: "pale, thin white coat",
      pulse: "thready",
    },
    "Kidney Essence Deficiency": { tongue: "cracked", pulse: "thready" },
    "Qi Deficiency": { tongue: "pale, thin white coat", pulse: "thready" },
    "Spleen Deficiency": { tongue: "pale, thin white coat", pulse: "thready" },
    "Liver Yang Rising": { tongue: "thin yellow", pulse: "superficial rapid" },
  };
  const fixedTonguePulse: { tongue: string; pulse: string } = (() => {
    const ieTonguePulse = context.previousIE?.objective?.tonguePulse;
    if (ieTonguePulse?.tongue && ieTonguePulse?.pulse) {
      return {
        tongue: ieTonguePulse.tongue,
        pulse: ieTonguePulse.pulse,
      };
    }
    // fallback: 从 localPattern 或 systemicPattern 推导，与 IE TONE_MAP 保持一致
    const patternDefault =
      PATTERN_TONGUE_DEFAULTS[context.localPattern || ""] ||
      PATTERN_TONGUE_DEFAULTS[context.systemicPattern || ""];
    if (patternDefault) return patternDefault;
    return {
      tongue: "Pink with thin white coating",
      pulse: "Even and moderate",
    };
  })();

  const visits: TXVisitState[] = [];
  // V09: 穴位纵向继承 — 首次选定后 100% 复用，保证 Jaccard=1.0
  let fixedNeedlePoints: string[] = options.initialState?.acupoints || [];

  // Bounce tracking: 上一次是否 bounce，用于下一次强制回落
  let prevTightnessBounced = false;
  let prevTendernessBounced = false;
  let prevSpasmBounced = false;

  // Goal-driven path: 计算每个维度在哪些 visit 降一级
  const TIGHTNESS_TO_NUM: Record<string, number> = {
    mild: 1,
    "mild to moderate": 2,
    moderate: 3,
    "moderate to severe": 4,
    severe: 5,
  };
  const patchedGoals = computePatchedGoals(
    startPain,
    initSeverity,
    context.primaryBodyPart || "LBP",
    "soreness",
    {
      medicalHistory: medHistory,
      age: context.age,
    },
  );
  const goalPaths = computeGoalPaths(
    {
      tightness: {
        start: prevTightness,
        st: TIGHTNESS_TO_NUM[patchedGoals.tightness.st] ?? 3,
        lt: TIGHTNESS_TO_NUM[patchedGoals.tightness.lt] ?? 2,
      },
      tenderness: {
        start: prevTenderness,
        st: patchedGoals.tenderness.st,
        lt: patchedGoals.tenderness.lt,
      },
      spasm: {
        start: prevSpasm,
        st: patchedGoals.spasm.st,
        lt: patchedGoals.spasm.lt,
      },
      strength: {
        start:
          strengthToIndex(strengthFromPain(startPain)) +
          (context.chronicityLevel === "Chronic" ||
          context.baselineCondition === "poor"
            ? -1
            : 0),
        st: strengthToIndex(patchedGoals.strength.st),
        lt: strengthToIndex(patchedGoals.strength.lt),
      },
      pain: {
        start: Math.round(startPain),
        st: painGoalToInt(patchedGoals.pain.st),
        lt: painGoalToInt(patchedGoals.pain.lt),
      },
      frequency: {
        start:
          options.initialState?.frequency ??
          frequencyToNum(context.painFrequency || ""),
        st: 1, // Occasional
        lt: 0, // Intermittent
      },
      symptomScale: {
        start: symptomScaleToDecade(
          options.initialState?.symptomScale || "70%",
        ),
        st: symptomGoalToDecade(patchedGoals.symptomPct.st),
        lt: symptomGoalToDecade(patchedGoals.symptomPct.lt),
      },
      adlA: {
        start: severityToAdlLevel(initSeverity),
        st: adlGoalToNum(patchedGoals.adl.st),
        lt: adlGoalToNum(patchedGoals.adl.lt),
      },
      adlB: {
        start:
          context.primaryBodyPart === "LBP"
            ? 0
            : severityToAdlLevel(initSeverity),
        st:
          context.primaryBodyPart === "LBP"
            ? 0
            : adlGoalToNum(patchedGoals.adl.st),
        lt:
          context.primaryBodyPart === "LBP"
            ? 0
            : adlGoalToNum(patchedGoals.adl.lt),
      },
    },
    txCount,
    rng,
    {
      painEarlyGuard: Math.ceil(txCount * (chronicCapsEnabled ? 0.3 : 0.2)),
      symptomScaleEarlyGuard: Math.ceil(txCount * 0.2),
    },
  );

  // Discrete strength level from goal-path-calculator (index into STRENGTH_LADDER)
  let prevStrengthLevel = Math.max(0, goalPaths.strength.startValue);

  for (let i = startIdx; i <= txCount; i++) {
    // progress 基于总疗程进度，而不是当前批次
    const progressLinear = i / txCount;
    // S曲线: sqrt 加速早期进度 + smoothstep 平滑过渡
    const acc = Math.sqrt(progressLinear);
    const progressBase = 3 * acc * acc - 2 * acc * acc * acc;
    const progressNoise = (rng() - 0.5) * 0.08;
    const rawProgress = clamp(
      progressBase * progressMultiplier + progressNoise,
      0.05,
      1.0,
    );
    const progress = Math.max(prevProgress, rawProgress);
    prevProgress = progress;

    const objectiveFactors = {
      sessionGapDays: Math.max(1, Math.round(1 + rng() * 7)),
      sleepLoad: Number((rng() * 1.0).toFixed(2)),
      workloadLoad: Number((rng() * 1.0).toFixed(2)),
      weatherExposureLoad: Number((rng() * 1.0).toFixed(2)),
      adherenceLoad: Number((rng() * 1.0).toFixed(2)),
    };

    const disruption =
      objectiveFactors.sleepLoad * 0.12 +
      objectiveFactors.workloadLoad * 0.1 +
      objectiveFactors.weatherExposureLoad * 0.1 +
      objectiveFactors.adherenceLoad * 0.12 +
      clamp((objectiveFactors.sessionGapDays - 3) / 10, 0, 0.4);

    // Preserve rng() call for PRNG sequence compatibility (was painNoise)
    const _painRng = (rng() - 0.5) * 0.2 + disruption * 0.08;
    void _painRng;

    // Pain: discrete scheduling from goal-path-calculator
    const painIsScheduledDrop = goalPaths.pain.changeVisits.includes(i);
    // When scheduled, drop by ~0.8 (enough to cross a grid line); add micro-variation from progress
    const painDropAmount = painIsScheduledDrop ? 0.6 + progress * 0.3 : 0;
    let painScaleCurrent = clamp(
      prevPain - painDropAmount,
      goalPaths.pain.ltGoal,
      startPain,
    );
    // Monotonic constraint
    painScaleCurrent = Math.min(prevPain, painScaleCurrent);
    const snapped = snapPainToGrid(painScaleCurrent);
    let painScaleLabel = snapped.label;

    // Between scheduled drops, allow half-step transitions for natural feel
    if (!painIsScheduledDrop && prevPain - Math.floor(prevPain) > 0.3) {
      // Snap down to integer if we're in a half-step
      const intPain = Math.floor(prevPain);
      if (intPain >= goalPaths.pain.ltGoal) {
        painScaleCurrent = intPain;
        painScaleLabel = snapPainToGrid(painScaleCurrent).label;
      }
    }

    const painDelta = prevPain - painScaleCurrent;
    prevPain = painScaleCurrent;

    // Preserve rng() calls for PRNG sequence compatibility (was adlExpected + adlNoise)
    const _adlRng1 = 0.18 + rng() * 0.2;
    const _adlRng2 = (rng() - 0.5) * 0.12;
    void _adlRng1;
    void _adlRng2;

    // ADL: discrete scheduling from goal-path-calculator
    const adlADrop = goalPaths.adlA.changeVisits.includes(i);
    const adlBDrop = goalPaths.adlB.changeVisits.includes(i);
    const adlImproved = adlADrop || adlBDrop;

    // severityLevel: 基于 pain，ADL 改善时最多降 1 档，纵向只降不升
    const baseSeverity = severityFromPain(prevPainForSeverity);
    const severityOrder: SeverityLevel[] = [
      "mild",
      "mild to moderate",
      "moderate",
      "moderate to severe",
      "severe",
    ];
    let severityLevel = baseSeverity;
    if (prevAdlImproved && progress > 0.5) {
      const baseIdx = severityOrder.indexOf(baseSeverity);
      if (baseIdx > 0) {
        severityLevel = severityOrder[baseIdx - 1];
      }
    }
    // 纵向约束: severity 只降不升
    const curSevIdx = severityOrder.indexOf(severityLevel);
    const prevSevIdx = severityOrder.indexOf(prevSeverity);
    if (curSevIdx > prevSevIdx && prevSevIdx >= 0) {
      severityLevel = prevSeverity;
    }
    const prevSeveritySnapshot = prevSeverity;
    prevSeverity = severityLevel;
    prevPainForSeverity = painScaleCurrent;
    prevAdlImproved = adlImproved;

    // Muscle reduction: pure (no RNG), trims based on current severity
    const visitMuscles = reduceMuscles(initialMuscles, severityLevel);

    // ADL/aggravating: deterministic from muscle weights (no RNG)
    const bp = context.primaryBodyPart as BodyPartKey;
    const validADL = new Set(TEMPLATE_ADL[bp] ?? []);
    const adlWeights = getADLWeightsByMuscles(
      visitMuscles.tightness as string[],
      context.primaryBodyPart,
    );
    const adlCount = severityToCount(prevSeverityForAdl, "adl");
    const adlItems = adlWeights
      .filter((w) => validADL.has(w.adl))
      .slice(0, adlCount)
      .map((w) => w.adl);

    const aggWeights = getAggravatingWeightsByMuscles(
      visitMuscles.tightness as string[],
      context.primaryBodyPart,
    );
    const aggCount = severityToCount(prevSeverityForAdl, "aggravating");
    prevSeverityForAdl = severityLevel;
    const aggravatingItems = aggWeights
      .slice(0, aggCount)
      .map((w) => w.aggravating);

    // Frequency: discrete scheduling from goal-path-calculator
    // Preserve rng() call for PRNG sequence compatibility
    const _freqRng = rng();
    void _freqRng;
    const freqIsScheduledDrop = goalPaths.frequency.changeVisits.includes(i);
    const nextFrequency = freqIsScheduledDrop
      ? Math.max(0, prevFrequency - 1)
      : prevFrequency;
    const frequencyImproved = nextFrequency < prevFrequency;
    prevFrequency = nextFrequency;

    // Goal-driven: tightness/tenderness/spasm 由 goal path 驱动
    const snappedForGrade = snapPainToGrid(painScaleCurrent);
    const painInt = parseInt(snappedForGrade.label, 10);
    // Floor micro-fluctuation: 维度到 goal 附近时偶尔回弹 +1，模拟非线性恢复
    const bounceRng = rng();
    const bounceEnabled =
      txCount >= 12 && i > Math.max(3, Math.round(goalPaths.stBoundary * 0.6));
    const bounceProbability = 0.25;
    // Tightness
    let nextTightness: number;
    let tightnessBounced = false;
    const tightIsScheduledDrop = goalPaths.tightness.changeVisits.includes(i);
    if (tightIsScheduledDrop) {
      // Goal path drop: always from the non-bounced baseline
      const baseline = prevTightnessBounced ? prevTightness - 1 : prevTightness;
      nextTightness = Math.max(1, baseline - 1);
    } else if (prevTightnessBounced) {
      // Bounce return: go back to pre-bounce value
      nextTightness = Math.max(1, prevTightness - 1);
    } else if (
      bounceEnabled &&
      bounceRng < bounceProbability &&
      prevTightness <= goalPaths.tightness.stGoal &&
      !goalPaths.tightness.changeVisits.includes(i + 1) &&
      i < txCount
    ) {
      // Don't bounce if next visit is a scheduled drop
      nextTightness = prevTightness + 1;
      tightnessBounced = true;
    } else {
      nextTightness = prevTightness;
    }
    prevTightnessBounced = tightnessBounced;
    // Tenderness
    const tenderBounceRng = rng();
    let nextTenderness: number;
    let tendernessBounced = false;
    const tenderIsScheduledDrop = goalPaths.tenderness.changeVisits.includes(i);
    if (tenderIsScheduledDrop) {
      const baseline = prevTendernessBounced
        ? prevTenderness - 1
        : prevTenderness;
      nextTenderness = Math.max(1, baseline - 1);
    } else if (prevTendernessBounced) {
      nextTenderness = Math.max(1, prevTenderness - 1);
    } else if (
      bounceEnabled &&
      tenderBounceRng < bounceProbability &&
      prevTenderness <= goalPaths.tenderness.stGoal &&
      !goalPaths.tenderness.changeVisits.includes(i + 1) &&
      i < txCount
    ) {
      nextTenderness = prevTenderness + 1;
      tendernessBounced = true;
    } else {
      nextTenderness = prevTenderness;
    }
    prevTendernessBounced = tendernessBounced;
    const tightnessTrend: "reduced" | "slightly reduced" | "stable" =
      prevTightnessBounced
        ? "stable" // bounce return 不是真正改善
        : nextTightness < prevTightness
          ? "reduced"
          : "stable";
    const tendernessTrend: "reduced" | "slightly reduced" | "stable" =
      prevTendernessBounced
        ? "stable" // bounce return 不是真正改善
        : nextTenderness < prevTenderness
          ? "reduced"
          : "stable";
    prevTightness = nextTightness;
    prevTenderness = nextTenderness;

    // Goal-driven spasm with bounce
    const spasmBounceRng = rng();
    let nextSpasm: number;
    let spasmBounced = false;
    const spasmIsScheduledDrop = goalPaths.spasm.changeVisits.includes(i);
    if (spasmIsScheduledDrop) {
      const baseline = prevSpasmBounced ? prevSpasm - 1 : prevSpasm;
      nextSpasm = Math.max(0, baseline - 1);
    } else if (prevSpasmBounced) {
      nextSpasm = Math.max(0, prevSpasm - 1);
    } else if (
      bounceEnabled &&
      spasmBounceRng < bounceProbability &&
      prevSpasm <= goalPaths.spasm.stGoal &&
      !goalPaths.spasm.changeVisits.includes(i + 1) &&
      i < txCount
    ) {
      nextSpasm = prevSpasm + 1;
      spasmBounced = true;
    } else {
      nextSpasm = prevSpasm;
    }
    prevSpasmBounced = spasmBounced;
    // Consume rng() to maintain PRNG sequence
    rng();
    const spasmTrend: "reduced" | "slightly reduced" | "stable" =
      prevSpasmBounced
        ? "stable" // bounce return 不是真正改善
        : nextSpasm < prevSpasm
          ? "reduced"
          : "stable";
    prevSpasm = nextSpasm;

    // ROM/Strength: 独立进度，滞后于 pain，互相联动
    // REAL-01: chronic patients have slower ROM/Strength recovery
    const romDampener = chronicCapsEnabled ? 0.75 : 0.85;
    const strengthDampener = chronicCapsEnabled ? 0.7 : 0.95;
    const romProgress = progress * romDampener;
    const strengthProgress = romProgress * strengthDampener;
    const nextRomDeficit = clamp(
      Math.min(
        prevRomDeficit,
        prevRomDeficit - (0.03 + rng() * 0.05) * (romProgress > 0.2 ? 1 : 0.3),
      ),
      0.08,
      0.6,
    );
    // Preserve rng() call for PRNG sequence compatibility (was used by deficit calc)
    const _strengthRng = 0.02 + rng() * 0.04;
    void _strengthRng;

    // Strength: discrete scheduling from goal-path-calculator (no regression possible)
    const strengthIsScheduledRise = goalPaths.strength.changeVisits.includes(i);
    const nextStrengthLevel = strengthIsScheduledRise
      ? Math.min(prevStrengthLevel + 1, STRENGTH_LADDER.length - 1)
      : prevStrengthLevel;
    let strengthGrade =
      STRENGTH_LADDER[nextStrengthLevel] ?? STRENGTH_LADDER[prevStrengthLevel];

    let romTrend: "improved" | "slightly improved" | "stable" =
      nextRomDeficit < prevRomDeficit - 0.055
        ? "improved"
        : nextRomDeficit < prevRomDeficit
          ? "slightly improved"
          : "stable";
    let strengthTrend: "improved" | "slightly improved" | "stable" =
      nextStrengthLevel > prevStrengthLevel ? "improved" : "stable";

    // Phase 3: plateau 条件修正 — 只在真正停滞时压制 ROM/Strength
    // 旧逻辑: painSame 就压制 → 13/19 visits 被压制，太激进
    // 新逻辑: 多条件组合，且后期允许 ROM 或 Strength 其中一个变化
    const anyDimChanged =
      tightnessTrend !== "stable" ||
      tendernessTrend !== "stable" ||
      spasmTrend !== "stable" ||
      frequencyImproved ||
      painDelta > 0.2;
    const plateau =
      !anyDimChanged && painScaleLabel === prevPainScaleLabel && progress > 0.5;
    if (plateau) {
      // 即使 plateau，后期也随机保留一个趋势，避免完全停滞
      if (progress > 0.7) {
        if (rng() > 0.5) {
          strengthTrend = "stable";
        } else {
          romTrend = "stable";
        }
      } else {
        romTrend = "stable";
        strengthTrend = "stable";
      }
    }
    prevPainScaleLabel = painScaleLabel;
    prevRomDeficit = nextRomDeficit;
    prevStrengthLevel = nextStrengthLevel;

    const isBilateral = context.laterality === "bilateral";
    let sideProgress: TXVisitState["sideProgress"] | undefined = undefined;
    if (isBilateral) {
      const asym = 0.06 + rng() * 0.12;
      const dominantLeft = i % 2 === 0;
      const left = clamp(progress + (dominantLeft ? asym : -asym), 0.01, 0.99);
      const right = clamp(progress + (dominantLeft ? -asym : asym), 0.01, 0.99);
      sideProgress = { left, right };
    }

    const ruleContext = buildRuleContext(
      context,
      painScaleCurrent,
      severityLevel,
    );

    // --- Phase 1: 选 symptomChange (用初始 ruleContext) ---
    let symptomChange = pickSingle(
      "subjective.symptomChange",
      ruleContext,
      progress,
      rng,
      "improvement of symptom(s)",
    );

    // --- Negative events gate ---
    // Default (allowNegativeEvents=false): block all exacerbate/came-back
    // When enabled: allow ≤10% negative visits, never on visit 1
    const isNegativeSC =
      symptomChange.includes("exacerbate") ||
      symptomChange.includes("came back");
    if (isNegativeSC) {
      if (!context.allowNegativeEvents || i === startIdx) {
        // Block: replace with similar
        symptomChange = "similar symptom(s) as last visit";
      } else {
        // Cap at ~10%: use rng to probabilistically allow
        // With bias=-70 for exacerbate and bias=-55/-15 for came-back,
        // they're already rare; this is a hard cap safety net
        const negativeRoll = rng();
        if (negativeRoll > 0.1) {
          symptomChange = "similar symptom(s) as last visit";
        }
      }
    }

    // --- T02/T03 硬约束守卫: symptomChange 与综合维度变化一致 ---
    const objectiveImproved =
      tightnessTrend !== "stable" ||
      tendernessTrend !== "stable" ||
      romTrend !== "stable" ||
      strengthTrend !== "stable" ||
      spasmTrend !== "stable";
    const symptomScaleChanged = goalPaths.symptomScale.changeVisits.includes(i);
    const severityChanged = severityLevel !== prevSeveritySnapshot;

    const dimScore = computeDimensionScore({
      painDelta,
      symptomScaleChanged,
      severityChanged,
      frequencyImproved,
      adlImproved,
      tightnessTrend,
      tendernessTrend,
      spasmTrend,
      romTrend,
      strengthTrend,
    });

    if (dimScore.score === 0) {
      // 所有维度都没变: 强制 similar
      if (!symptomChange.includes("similar")) {
        symptomChange = "similar symptom(s) as last visit";
      }
    } else if (dimScore.score > 0 && symptomChange.includes("similar")) {
      // 有维度变化但 pickSingle 选了 similar: 纠正为 improvement
      symptomChange = "improvement of symptom(s)";
    } else if (dimScore.score >= 0.15 && symptomChange.includes("exacerbate")) {
      // 明显改善但说 exacerbate: 纠正
      symptomChange = "improvement of symptom(s)";
    }

    // 后期强制改善
    if (
      progress > 0.7 &&
      dimScore.score > 0 &&
      !symptomChange.includes("improvement of symptom")
    ) {
      symptomChange = "improvement of symptom(s)";
    }

    // --- Phase 2: 用实际 symptomChange 重建 ruleContext，选 reason ---
    const reasonRuleContext = {
      ...ruleContext,
      subjective: { ...ruleContext.subjective, symptomChange },
    };
    const reasonConnector = pickSingle(
      "subjective.reasonConnector",
      reasonRuleContext,
      progress,
      rng,
      "because of",
    );
    const reason = pickSingle(
      "subjective.reason",
      reasonRuleContext,
      progress,
      rng,
      "energy level improved",
    );

    // --- reason↔symptomChange 一致性硬约束 ---
    const isImprovement =
      symptomChange.includes("improvement") &&
      !symptomChange.includes("came back");
    const isExacerbate = symptomChange.includes("exacerbate");
    const isSimilar = symptomChange.includes("similar");
    const isCameBack = symptomChange.includes("came back");

    // Body-part-specific positive reasons for diversity
    const BODY_PART_POSITIVE: Record<string, string[]> = {
      LBP: [
        "can bend and lift with less discomfort",
        "sitting tolerance has improved",
        "walking distance increased without pain",
      ],
      NECK: [
        "neck rotation range has improved",
        "less headache related to neck tension",
        "can look over shoulder more easily",
      ],
      SHOULDER: [
        "overhead reaching is easier",
        "can reach behind back more comfortably",
        "shoulder stiffness has decreased",
      ],
      KNEE: [
        "stair climbing is less painful",
        "can walk longer distances comfortably",
        "knee stability has improved",
      ],
      ELBOW: [
        "grip strength has improved",
        "can lift objects with less elbow pain",
        "forearm tension has decreased",
      ],
    };
    const bodySpecific =
      BODY_PART_POSITIVE[context.primaryBodyPart] ?? BODY_PART_POSITIVE.LBP;
    const POSITIVE_REASONS = new Set([
      "can move joint more freely and with less pain",
      "physical activity no longer causes distress",
      "reduced level of pain",
      "less difficulty performing daily activities",
      "energy level improved",
      "sleep quality improved",
      "more energy level throughout the day",
      "overall well-being has improved",
      "stress level has decreased",
      "muscle tension has reduced noticeably",
      ...bodySpecific,
    ]);
    const NEGATIVE_REASONS = new Set([
      "did not have good rest",
      "intense work",
      "excessive time using cell phone",
      "excessive time using computer",
      "bad posture",
      "carrying/lifting heavy object(s)",
      "lack of exercise",
      "exposure to cold air",
      "skipped treatments",
      "stopped treatment for a while",
      "discontinuous treatment",
      "weak constitution",
    ]);

    // Phase D: reason 轮换 — 避免总是同一个 reason
    const POSITIVE_REASONS_LIST = Array.from(POSITIVE_REASONS);
    const NEUTRAL_REASONS = [
      "continuous treatment",
      "still need more treatments to reach better effect",
      "body is adjusting to treatment",
      "consistent treatment schedule",
      "gradual recovery process",
      "treatment plan is on track",
      "patient compliance with treatment",
      "steady progress with current protocol",
      "body needs time to consolidate gains",
      "recovery plateau is expected at this stage",
      "maintaining current functional level",
    ];
    const CAME_BACK_REASONS = [
      "continuous treatment",
      "discontinuous treatment",
      "skipped treatments",
      "stopped treatment for a while",
      "did not follow home care instructions",
      "overexertion between visits",
      "irregular treatment schedule",
    ];

    let finalReason = reason;
    let finalConnector = reasonConnector;
    if (isImprovement) {
      // Shuffle bag with anti-repeat: refill when empty, exclude last-used on refill
      if (positiveShuffleBag.length === 0) {
        positiveShuffleBag = POSITIVE_REASONS_LIST.filter(
          (r) => r !== lastUsedReason,
        );
        if (positiveShuffleBag.length === 0)
          positiveShuffleBag = [...POSITIVE_REASONS_LIST];
      }
      const pickIdx = Math.floor(rng() * positiveShuffleBag.length);
      finalReason = positiveShuffleBag[pickIdx];
      positiveShuffleBag = [
        ...positiveShuffleBag.slice(0, pickIdx),
        ...positiveShuffleBag.slice(pickIdx + 1),
      ];
      // 2nd reason pick
      let reason2 = "";
      if (positiveShuffleBag.length > 0) {
        const pickIdx2 = Math.floor(rng() * positiveShuffleBag.length);
        reason2 = positiveShuffleBag[pickIdx2];
        positiveShuffleBag = [
          ...positiveShuffleBag.slice(0, pickIdx2),
          ...positiveShuffleBag.slice(pickIdx2 + 1),
        ];
      } else {
        rng(); // consume to keep PRNG sequence
      }
      finalReason = reason2 ? `${finalReason} and ${reason2}` : finalReason;
      lastUsedReason = finalReason;
      // Improvement connector variation
      const improvementConnectors = ["because of", "due to"];
      finalConnector =
        improvementConnectors[
          Math.floor(rng() * improvementConnectors.length)
        ] || "because of";
      improvementCount++;
    } else if (isExacerbate) {
      if (!NEGATIVE_REASONS.has(finalReason))
        finalReason = "did not have good rest";
      if (finalConnector !== "due to" && finalConnector !== "because of")
        finalConnector = "due to";
      rng(); // consume to match 2nd-reason pick in other branches
    } else if (isSimilar) {
      // Shuffle bag with anti-repeat for neutral reasons
      if (neutralShuffleBag.length === 0) {
        neutralShuffleBag = NEUTRAL_REASONS.filter((r) => r !== lastUsedReason);
        if (neutralShuffleBag.length === 0)
          neutralShuffleBag = [...NEUTRAL_REASONS];
      }
      const pickIdx = Math.floor(rng() * neutralShuffleBag.length);
      finalReason = neutralShuffleBag[pickIdx];
      neutralShuffleBag = [
        ...neutralShuffleBag.slice(0, pickIdx),
        ...neutralShuffleBag.slice(pickIdx + 1),
      ];
      // 2nd reason pick
      let reason2 = "";
      if (neutralShuffleBag.length > 0) {
        const pickIdx2 = Math.floor(rng() * neutralShuffleBag.length);
        reason2 = neutralShuffleBag[pickIdx2];
        neutralShuffleBag = [
          ...neutralShuffleBag.slice(0, pickIdx2),
          ...neutralShuffleBag.slice(pickIdx2 + 1),
        ];
      } else {
        rng(); // consume to keep PRNG sequence
      }
      finalReason = reason2 ? `${finalReason} and ${reason2}` : finalReason;
      lastUsedReason = finalReason;
      // Similar connector variation
      const similarConnectors = ["and", "may related of"];
      finalConnector =
        similarConnectors[Math.floor(rng() * similarConnectors.length)] ||
        "and";
    } else if (isCameBack) {
      // Shuffle bag for came-back reasons
      if (cameBackShuffleBag.length === 0) {
        cameBackShuffleBag = CAME_BACK_REASONS.filter(
          (r) => r !== lastUsedReason,
        );
        if (cameBackShuffleBag.length === 0)
          cameBackShuffleBag = [...CAME_BACK_REASONS];
      }
      const pickIdx = Math.floor(rng() * cameBackShuffleBag.length);
      finalReason = cameBackShuffleBag[pickIdx];
      cameBackShuffleBag = [
        ...cameBackShuffleBag.slice(0, pickIdx),
        ...cameBackShuffleBag.slice(pickIdx + 1),
      ];
      // 2nd reason pick
      let reason2 = "";
      if (cameBackShuffleBag.length > 0) {
        const pickIdx2 = Math.floor(rng() * cameBackShuffleBag.length);
        reason2 = cameBackShuffleBag[pickIdx2];
        cameBackShuffleBag = [
          ...cameBackShuffleBag.slice(0, pickIdx2),
          ...cameBackShuffleBag.slice(pickIdx2 + 1),
        ];
      } else {
        rng(); // consume to keep PRNG sequence
      }
      finalReason = reason2 ? `${finalReason} and ${reason2}` : finalReason;
      lastUsedReason = finalReason;
      finalConnector = "due to";
    }

    // Associated Symptom: 继承用户输入(initialState)，后期逐步减轻
    // associatedSymptom: 种类固定不变，只有 scale % 随 progress 变化
    // 保留条件 rng() 调用以维持 PRNG 序列（原降级逻辑在此条件下调用 rng()）
    const _prevSymptomRank = (() => {
      const s = prevAssociatedSymptom.toLowerCase();
      if (s.includes("numbness") || s.includes("weakness")) return 4;
      if (s.includes("heaviness")) return 3;
      if (s.includes("stiffness")) return 2;
      if (s.includes("soreness")) return 1;
      return 2;
    })();
    if (progress > 0.5 && _prevSymptomRank > 1) {
      rng(); // consume to keep PRNG sequence
    }
    const associatedSymptom =
      options.initialState?.associatedSymptom ||
      prevAssociatedSymptom ||
      "soreness";
    prevAssociatedSymptom = associatedSymptom;
    const painFrequency = pickSingle(
      "subjective.painFrequency",
      ruleContext,
      progress,
      rng,
      "Frequent (symptoms occur between 51% and 75% of the time)",
    );
    // generalCondition 是患者基础体质的固定属性，不参与逐次选择
    const generalCondition = fixedGeneralCondition;
    const treatmentFocus = pickSingle(
      "assessment.treatmentPrinciples.focusOn",
      ruleContext,
      progress,
      rng,
      "focus",
    );

    // --- Tightness grading: goal-driven, derived from numeric nextTightness ---
    const TIGHTNESS_ORDER = [
      "mild",
      "mild to moderate",
      "moderate",
      "moderate to severe",
      "severe",
    ];
    // Consume rng() to maintain PRNG sequence (was used by old ceiling/jitter logic)
    rng();
    rng();
    // Map numeric value to grading text (nextTightness: 1=mild, 2=mild-mod, 3=moderate, 4=mod-sev, 5=severe)
    const tightnessIdx = Math.max(0, Math.min(4, nextTightness - 1));
    let tightnessGrading = TIGHTNESS_ORDER[tightnessIdx]
      .split(" ")
      .map((w: string, wi: number) =>
        wi === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w,
      )
      .join(" ");
    // 纵向约束: tightnessGrading 不允许比上一次更差
    if (prevTightnessGrading !== "") {
      const prevIdx = TIGHTNESS_ORDER.indexOf(
        prevTightnessGrading.toLowerCase(),
      );
      const curIdx = TIGHTNESS_ORDER.indexOf(tightnessGrading.toLowerCase());
      if (prevIdx >= 0 && curIdx > prevIdx) {
        tightnessGrading = prevTightnessGrading;
      }
    }
    prevTightnessGrading = tightnessGrading;

    // --- Tenderness grading: goal-driven, derived from numeric nextTenderness ---
    const SHOULDER_TENDERNESS_OPTIONS: Record<
      string,
      { order: number; text: string }
    > = {
      "+4": {
        order: 4,
        text: "(+4) = Patient complains of severe tenderness, withdraws immediately in response to test pressure, and is unable to bear sustained pressure",
      },
      "+3": {
        order: 3,
        text: "(+3) = Patient complains of considerable tenderness and withdraws momentarily in response to the test pressure",
      },
      "+2": {
        order: 2,
        text: "(+2) = Patient states that the area is moderately tender",
      },
      "+1": {
        order: 1,
        text: "(+1)=Patient states that the area is mildly tender-annoying",
      },
    };
    const KNEE_TENDERNESS_OPTIONS: Record<
      string,
      { order: number; text: string }
    > = {
      "+4": {
        order: 4,
        text: "(+4) = There is severe tenderness and withdrawal response from the patient when there is noxious stimulus",
      },
      "+3": {
        order: 3,
        text: "(+3) = There is severe tenderness with withdrawal",
      },
      "+2": {
        order: 2,
        text: "(+2) = There is mild tenderness with grimace and flinch to moderate palpation",
      },
      "+1": { order: 1, text: "(+1)= There is mild tenderness to palpation" },
      "0": { order: 0, text: "(0) = No tenderness" },
    };
    const tenderOptions =
      context.primaryBodyPart === "KNEE"
        ? KNEE_TENDERNESS_OPTIONS
        : SHOULDER_TENDERNESS_OPTIONS;
    // Consume rng() to maintain PRNG sequence (was used by old ceiling/jitter logic)
    rng();
    rng();
    // Map numeric nextTenderness to grade key
    const targetTenderGrade = "+" + nextTenderness;
    let tendernessGrading =
      tenderOptions[targetTenderGrade]?.text ||
      tenderOptions["+2"]?.text ||
      "(+2) = Patient states that the area is moderately tender";
    // 纵向约束: tenderness 不允许比上一次更差
    if (prevTendernessGrade !== "") {
      const prevOrder = tenderOptions[prevTendernessGrade]?.order ?? 3;
      const curOrder = tenderOptions[targetTenderGrade]?.order ?? 2;
      if (curOrder > prevOrder) {
        tendernessGrading =
          tenderOptions[prevTendernessGrade]?.text || tendernessGrading;
        // 保持 prevTendernessGrade 不变 — 追踪实际显示的 grade
      } else {
        prevTendernessGrade = targetTenderGrade;
      }
    } else {
      prevTendernessGrade = targetTenderGrade;
    }

    // V09: 穴位纵向继承 — 首次选穴后所有 TX 复用
    if (fixedNeedlePoints.length === 0) {
      fixedNeedlePoints = pickMultiple(
        "plan.needleProtocol.points",
        6,
        ruleContext,
        progress,
        rng,
      );
    }
    const needlePoints = fixedNeedlePoints;

    const SPASM_TEXTS = [
      "(0)=No spasm",
      "(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.",
      "(+2)=Occasional spontaneous spasms and easily induced spasms.",
      "(+3)=>1 but < 10 spontaneous spasms per hour.",
      "(+4)=>10 spontaneous spasms per hour.",
    ];
    let spasmGrading = SPASM_TEXTS[nextSpasm] || SPASM_TEXTS[3];

    const frequencyByLevel = [
      "Intermittent (symptoms occur less than 25% of the time)",
      "Occasional (symptoms occur between 26% and 50% of the time)",
      "Frequent (symptoms occur between 51% and 75% of the time)",
      "Constant (symptoms occur between 76% and 100% of the time)",
    ];
    let chainFrequency = findTemplateOption(
      "subjective.painFrequency",
      [frequencyByLevel[prevFrequency]],
      painFrequency,
    );

    // ASS-02: cumulative pain drop from IE baseline
    const cumulativePainDrop = startPain - painScaleCurrent;

    const adlDelta = adlImproved ? 1 : 0;
    const assessmentFromChain = deriveAssessmentFromSOA({
      painDelta,
      adlDelta,
      frequencyImproved,
      visitIndex: i,
      objectiveTightnessTrend: tightnessTrend,
      objectiveTendernessTrend: tendernessTrend,
      objectiveSpasmTrend: spasmTrend,
      objectiveRomTrend: romTrend,
      objectiveStrengthTrend: strengthTrend,
      cumulativePainDrop,
      progress,
      bodyPart: context.primaryBodyPart || "LBP",
      dimScore: dimScore.score,
      changedDims: dimScore.changedDims,
      symptomScaleChanged,
      severityChanged,
    });

    // SymptomScale: extract from inline to allow output-layer cap
    const symptomDrop = goalPaths.symptomScale.changeVisits.includes(i);
    if (symptomDrop) {
      prevSymptomDecade = Math.max(1, prevSymptomDecade - 1);
    }
    let visitSymptomScale = snapSymptomToGrid(prevSymptomDecade * 10);

    const OUTPUT_CAP = 4;
    // --- Output-layer cap: max 4 output dimension changes per visit ---
    // goalPaths scheduling is preserved; we only defer the *display* of low-priority dims.
    if (visits.length > 0) {
      const prev = visits[visits.length - 1];
      const outputChanges: string[] = [];
      if (painScaleCurrent !== prev.painScaleCurrent)
        outputChanges.push("pain");
      if (severityLevel !== prev.severityLevel) outputChanges.push("sev");
      if (visitSymptomScale !== prev.symptomScale)
        outputChanges.push("symScale");
      if (chainFrequency !== prev.painFrequency) outputChanges.push("freq");
      if (strengthGrade !== prev.strengthGrade) outputChanges.push("str");
      if (adlItems.length !== (prev.adlItems?.length ?? 0))
        outputChanges.push("adl");
      if (tightnessGrading !== prev.tightnessGrading)
        outputChanges.push("tight");
      if (tendernessGrading !== prev.tendernessGrading)
        outputChanges.push("tend");
      if (spasmGrading !== prev.spasmGrading) outputChanges.push("spasm");

      if (outputChanges.length > OUTPUT_CAP) {
        // Defer lowest-priority goalPaths dims by reverting to previous values
        // Priority (defer first → last): spasm, tenderness, tightness, strength, frequency, symptomScale
        // Never defer: pain, severity, adl (cascade-critical)
        const deferOrder = [
          "spasm",
          "tend",
          "tight",
          "str",
          "freq",
          "symScale",
        ];
        let excess = outputChanges.length - OUTPUT_CAP;
        for (const dim of deferOrder) {
          if (excess <= 0) break;
          if (!outputChanges.includes(dim)) continue;
          switch (dim) {
            case "spasm":
              spasmGrading = prev.spasmGrading;
              break;
            case "tend":
              tendernessGrading = prev.tendernessGrading;
              break;
            case "tight":
              tightnessGrading = prev.tightnessGrading;
              break;
            case "str": // strength can't easily revert (ladder index), skip
              continue;
            case "freq":
              chainFrequency = prev.painFrequency;
              break;
            case "symScale":
              visitSymptomScale = prev.symptomScale ?? visitSymptomScale;
              break;
          }
          excess--;
        }
      }
    }

    visits.push({
      visitIndex: i,
      progress,
      painScaleCurrent,
      painScaleLabel,
      severityLevel,
      symptomChange,
      reasonConnector: finalConnector,
      reason: finalReason,
      associatedSymptom,
      painFrequency: chainFrequency,
      generalCondition,
      treatmentFocus,
      tightnessGrading,
      tendernessGrading,
      spasmGrading,
      tightMuscles: visitMuscles.tightness,
      tenderMuscles: visitMuscles.tenderness,
      spasmMuscles: visitMuscles.spasm,
      adlItems,
      aggravatingItems,
      strengthGrade,
      needlePoints,
      tonguePulse: fixedTonguePulse,
      painTypes: options.initialState?.painTypes,
      inspection: options.initialState?.inspection,
      symptomScale: visitSymptomScale,
      electricalStimulation: options.initialState?.electricalStimulation,
      treatmentTime: options.initialState?.treatmentTime,
      sideProgress,
      objectiveFactors,
      soaChain: {
        subjective: {
          painChange: symptomChange.includes("improvement")
            ? "improved"
            : symptomChange.includes("similar")
              ? "similar"
              : "worsened",
          adlChange: adlImproved ? "improved" : "stable",
          frequencyChange: frequencyImproved ? "improved" : "stable",
        },
        objective: {
          tightnessTrend,
          tendernessTrend,
          spasmTrend,
          romTrend,
          strengthTrend,
        },
        assessment:
          dimScore.score === 0
            ? {
                ...assessmentFromChain,
                present: "similar symptom(s) as last visit.",
              }
            : assessmentFromChain,
      },
    });
  }

  return { states: visits, seed: actualSeed };
}
