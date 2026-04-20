/**
 * Renderer 层内部共享 helper（W3 Step 3）
 *
 * 这些函数跨 2+ renderer 使用，或被 export.ts orchestrator 调用。
 * 与 src/generator/sub-engines/shared-helpers.ts 语义不同：
 * - sub-engines/shared-helpers: stage-level helpers（PRNG 相关）
 * - renderers/_shared: text-generation helpers（文案/HTML/ROM 计算）
 */

import type { BodyPart, GenerationContext } from "../../types";
import {
  SUPPORTED_IE_BODY_PARTS,
  SUPPORTED_TX_BODY_PARTS,
  romLimitFactor,
} from "../../shared/body-part-constants";
import {
  selectBestOptions,
  selectWeightedWithJitter,
  type WeightContext,
  type WeightedOption,
} from "../../parser/weight-system";
import { escapeHtmlEntities } from "../../shared/html-wrapper";
import { severityFromPain } from "../../shared/severity";
import type {
  BodyPartKey,
} from "../../shared/template-options";
import {
  TEMPLATE_PAIN_TYPES,
  TEMPLATE_TX_SYMPTOM_CHANGE,
  TEMPLATE_TX_REASON,
  TEMPLATE_TX_CONNECTOR,
  TEMPLATE_TX_GENERAL_CONDITION,
  TEMPLATE_TX_SYMPTOM_PRESENT,
  TEMPLATE_TX_WHAT_CHANGED,
  TEMPLATE_TX_PHYSICAL_CHANGE,
  TEMPLATE_TX_FINDING_TYPE,
  TEMPLATE_TX_TOLERATED,
  TEMPLATE_TX_RESPONSE,
  TEMPLATE_TX_PAIN_SCALE,
  TEMPLATE_TX_SYMPTOM_SCALE_OPTIONS,
  TEMPLATE_TX_LATERALITY,
  TEMPLATE_TX_NECK_DIRECTION,
} from "../../shared/template-options";
import type { TXVisitState } from "../tx-sequence-engine";

export type ROMDifficulty = "EASY" | "MEDIUM" | "HARD";

/** SOAP output format — "text" (plain) or "html" (with <br> line breaks). */
export type SOAPFormat = "text" | "html";

// ---------- TX renderer shared consts (used by subjective-tx / assessment-tx / plan-tx / needle-protocol) ----------
export const TX_SYMPTOM_CHANGE_OPTIONS = [...TEMPLATE_TX_SYMPTOM_CHANGE];
export const TX_REASON_OPTIONS = [...TEMPLATE_TX_REASON];
export const TX_CONNECTOR_OPTIONS = [...TEMPLATE_TX_CONNECTOR];
export const TX_GENERAL_CONDITION_OPTIONS = [...TEMPLATE_TX_GENERAL_CONDITION];
export const TX_SYMPTOM_PRESENT_OPTIONS = [...TEMPLATE_TX_SYMPTOM_PRESENT];
export const TX_WHAT_CHANGED_OPTIONS = [...TEMPLATE_TX_WHAT_CHANGED];
export const TX_PHYSICAL_CHANGE_OPTIONS = [...TEMPLATE_TX_PHYSICAL_CHANGE];
export const TX_FINDING_TYPE_OPTIONS = [...TEMPLATE_TX_FINDING_TYPE];
export const TX_TOLERATED_OPTIONS = [...TEMPLATE_TX_TOLERATED];
export const TX_RESPONSE_OPTIONS = [...TEMPLATE_TX_RESPONSE];
export const TX_POSITIVE_REASON_OPTIONS: readonly string[] =
  TEMPLATE_TX_REASON.slice(0, 8);
export const TX_NEGATIVE_REASON_OPTIONS: readonly string[] =
  TEMPLATE_TX_REASON.slice(10);
export const TX_MAINTENANCE_REASON_OPTIONS: readonly string[] = [
  TEMPLATE_TX_REASON[8],
  TEMPLATE_TX_REASON[9],
  TEMPLATE_TX_REASON[10],
  TEMPLATE_TX_REASON[23],
];
export const TX_PAIN_SCALE_OPTIONS = [...TEMPLATE_TX_PAIN_SCALE];
export const TX_PAIN_FREQUENCY_OPTIONS = [
  "Intermittent (symptoms occur less than 25% of the time)",
  "Occasional (symptoms occur between 26% and 50% of the time)",
  "Frequent (symptoms occur between 51% and 75% of the time)",
  "Constant (symptoms occur between 76% and 100% of the time)",
] as const;
export const TX_SYMPTOM_SCALE_OPTIONS = [...TEMPLATE_TX_SYMPTOM_SCALE_OPTIONS];
export const TX_SEVERITY_OPTIONS = [
  "severe",
  "moderate to severe",
  "moderate",
  "mild to moderate",
  "mild",
] as const;
export const TX_LATERALITY_OPTIONS = TEMPLATE_TX_LATERALITY;
export const TX_NECK_DIRECTION_OPTIONS = TEMPLATE_TX_NECK_DIRECTION;

// ---------- TX renderer shared helpers ----------

export function resolveTxBodyPartKey(bodyPart: BodyPart): BodyPartKey {
  if (bodyPart === "MID_LOW_BACK" || bodyPart === "MIDDLE_BACK") {
    return "LBP";
  }
  if (bodyPart in TEMPLATE_PAIN_TYPES) {
    return bodyPart as BodyPartKey;
  }
  return "LBP";
}

export function applyTxReasonChain(
  weightedReasons: WeightedOption[],
  selectedChange: string,
  context: GenerationContext,
): WeightedOption[] {
  const change = selectedChange.toLowerCase();
  const isImproved =
    change.includes("improvement") && !change.includes("came back");
  const isRelapse = change.includes("came back");
  const isExacerbate = change.includes("exacerbate");
  const isDeficiencyPattern = (context.systemicPattern || "").includes(
    "Deficiency",
  );

  return weightedReasons
    .map((item) => {
      let bonus = 0;
      const extraReasons: string[] = [];

      if (
        isImproved &&
        (item.option === "energy level improved" ||
          item.option === "more energy level throughout the day" ||
          item.option === "sleep quality improved")
      ) {
        bonus += 45;
        extraReasons.push("复诊改善优先匹配模板精力/睡眠改善");
      } else if (
        isImproved &&
        TX_POSITIVE_REASON_OPTIONS.includes(item.option)
      ) {
        bonus += 25;
        extraReasons.push("复诊改善优先匹配模板正向原因");
      }
      if (
        isImproved &&
        isDeficiencyPattern &&
        (item.option === "energy level improved" ||
          item.option === "more energy level throughout the day")
      ) {
        bonus += 30;
        extraReasons.push("虚证改善优先匹配模板精力改善");
      }
      if (isRelapse && TX_MAINTENANCE_REASON_OPTIONS.includes(item.option)) {
        bonus += 40;
        extraReasons.push("复诊反复优先匹配模板持续治疗原因");
      }
      if (isExacerbate && TX_NEGATIVE_REASON_OPTIONS.includes(item.option)) {
        bonus += 35;
        extraReasons.push("复诊加重优先匹配模板负向原因");
      }

      return {
        ...item,
        weight: item.weight + bonus,
        reasons:
          extraReasons.length > 0
            ? [...item.reasons, ...extraReasons]
            : item.reasons,
      };
    })
    .sort((a, b) => b.weight - a.weight);
}

export function hasText(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeTxPatientChange(
  rawValue: string,
  options: readonly string[],
): string {
  if (options.includes(rawValue)) return rawValue;
  const normalized = rawValue.toLowerCase();
  if (normalized === "decreased" && options.includes("reduced")) {
    return "reduced";
  }
  if (
    normalized === "slightly decreased" &&
    options.includes("slightly reduced")
  ) {
    return "slightly reduced";
  }
  if (normalized === "reduced" && options.includes("decreased")) {
    return "decreased";
  }
  if (
    normalized === "slightly reduced" &&
    options.includes("slightly decreased")
  ) {
    return "slightly decreased";
  }
  return rawValue;
}

export function buildTxWeightContext(
  context: GenerationContext,
  visitState?: TXVisitState,
): WeightContext {
  const painScale = visitState?.painScaleCurrent ?? context.painCurrent ?? 8;
  return {
    bodyPart: context.primaryBodyPart,
    localPattern: context.localPattern || "Qi Stagnation",
    systemicPattern: context.systemicPattern || "",
    chronicityLevel: context.chronicityLevel || "Chronic",
    severityLevel:
      visitState?.severityLevel ||
      context.severityLevel ||
      severityFromPain(painScale),
    insuranceType: context.insuranceType,
    painScale,
    hasPacemaker: context.hasPacemaker,
  };
}

// ---------- end TX shared ----------

/** 校验当前 noteType + bodyPart 组合是否在支持白名单 */
export function assertTemplateSupported(context: GenerationContext): void {
  const isTX = context.noteType === "TX";
  const supported = isTX ? SUPPORTED_TX_BODY_PARTS : SUPPORTED_IE_BODY_PARTS;
  if (supported.has(context.primaryBodyPart)) return;

  const allowed = Array.from(supported).join(", ");
  const mode = isTX ? "TX" : "IE";
  throw new Error(
    `Unsupported ${mode} body part "${context.primaryBodyPart}". Allowed: ${allowed}.`,
  );
}

/**
 * 难度因子 (来自 v9.0)
 * EASY=1.0, MEDIUM=0.9, HARD=0.8
 */
export function getDifficultyFactor(difficulty: ROMDifficulty): number {
  const factors: Record<ROMDifficulty, number> = {
    EASY: 1.0,
    MEDIUM: 0.9,
    HARD: 0.8,
  };
  return factors[difficulty];
}

/**
 * 肌力等级 - 根据 Pain 和 difficulty 计算
 * Pain 高 → Strength 低
 */
export function getStrengthByPainAndDifficulty(
  painLevel: number,
  difficulty: ROMDifficulty,
): string {
  // Pain 0-3: 4+/5, Pain 4-5: 4+/5, Pain 6-7: 4/5, Pain 8-9: 4-/5, Pain 10: 3+/5
  // Template max is 4+/5 — no 5/5 in dropdown
  const baseGrades = [
    "4+/5",
    "4+/5",
    "4+/5",
    "4+/5",
    "4+/5",
    "4+/5",
    "4/5",
    "4/5",
    "4-/5",
    "4-/5",
    "3+/5",
  ];
  const painInt = Math.round(Math.min(painLevel, 10));
  const baseGrade = baseGrades[painInt];

  // HARD difficulty 再降一级 (cap at 4+/5, no 5/5)
  if (difficulty === "HARD") {
    const ladder = ["3/5", "3+/5", "4-/5", "4/5", "4+/5"];
    const idx = ladder.indexOf(baseGrade);
    return idx > 0 ? ladder[idx - 1] : "3/5";
  }
  return baseGrade;
}

/**
 * 受限程度分级 (来自 v9.0)
 */
export function calculateLimitation(romValue: number, normalRom: number): string {
  if (normalRom <= 0) return "normal";
  const ratio = romValue / normalRom;
  if (ratio >= 0.9) return "normal";
  if (ratio >= 0.75) return "mild";
  if (ratio >= 0.5) return "moderate";
  return "severe";
}

/**
 * 计算单个运动的 ROM (v9.0 核心公式)
 * ROM = normalDegrees × limitationFactor(pain) × difficultyFactor
 * 然后四舍五入到 5 的倍数
 */
export function calculateRomValue(
  normalDegrees: number,
  painLevel: number,
  difficulty: ROMDifficulty,
): number {
  const limitFactor = romLimitFactor(painLevel);
  const diffFactor = getDifficultyFactor(difficulty);
  const raw = normalDegrees * limitFactor * diffFactor;
  return Math.round(raw / 5) * 5;
}

/**
 * 辅助函数：获取配置值，按身体部位查找，回退到 DEFAULT
 */
export function getConfig<T>(map: Record<string, T>, bodyPart: string): T {
  return map[bodyPart] ?? map["DEFAULT"] ?? Object.values(map)[0];
}

export function suppressSwellReasonInText(value?: string): string | undefined {
  if (value === "reduced joint stiffness and swelling") {
    return "reduced level of pain";
  }
  return value;
}

export function suppressSwellInspectionInText(value?: string): string | undefined {
  if (value === "joint swelling") {
    return "local skin no damage or rash";
  }
  return value;
}

export function suppressSwellRadiationInText(value?: string): string | undefined {
  if (value === "with local swollen") {
    return "without radiation";
  }
  return value;
}

export function pickWeightedOptions(
  weighted: WeightedOption[],
  count: number,
  rng?: () => number,
): string[] {
  if (rng) return selectWeightedWithJitter(weighted, count, rng);
  return selectBestOptions(weighted, count);
}

export function withHtmlLineBreaks(text: string): string {
  return text.split("\n").map((line) => line.trimEnd()).join("<br>");
}

export function plainToHtmlSection(text: string): string {
  return withHtmlLineBreaks(escapeHtmlEntities(text));
}
