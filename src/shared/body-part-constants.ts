/**
 * Shared Body Part Constants — 统一身体部位相关映射
 *
 * Canonical source: template-options.ts — these re-exports maintain backward compatibility
 *
 * 来源合并：
 * - template-options.ts: TEMPLATE_MUSCLES, TEMPLATE_ADL (权威版本，来自 MDLand 模板)
 * - soap-generator.ts: ROM_MAP (权威版本，Task 19 将迁移)
 * - note-checker.ts:   ICD_BODY_MAP, LATERALITY_ICD_SUFFIX
 *
 * 注意：objective-generator.ts 的 MUSCLE_CONFIGS 已确认为孤立文件（零调用方），不纳入。
 */

import type { BodyPart, Laterality } from "../types";
import { TEMPLATE_MUSCLES, TEMPLATE_ADL } from "./template-options";

// ============ 肌肉映射 ============

/**
 * 身体部位 → 肌肉列表
 * 用于 SOAP 文本生成（Objective 段肌肉测试）和权重系统
 *
 * Derived from TEMPLATE_MUSCLES.tightness for body parts in template-options.
 * Body parts not in template (WRIST, ANKLE, UPPER_BACK, MIDDLE_BACK, MID_LOW_BACK)
 * retain their original values until templates are added.
 */
export const BODY_PART_MUSCLES: Record<string, string[]> = {
  // Derived from TEMPLATE_MUSCLES
  ...Object.fromEntries(
    Object.entries(TEMPLATE_MUSCLES).map(([k, v]) => [k, [...v.tightness]]),
  ),
  // Not yet in template — keep original values
  WRIST: [
    "Flexor carpi radialis",
    "Flexor carpi ulnaris",
    "Extensor carpi radialis",
    "Extensor carpi ulnaris",
  ],
  ANKLE: [
    "Gastrocnemius",
    "Soleus",
    "Tibialis anterior",
    "Peroneus longus/brevis",
  ],
  UPPER_BACK: [
    "Rhomboids",
    "Middle Trapezius",
    "Erector spinae (thoracic)",
    "Latissimus dorsi",
  ],
  MIDDLE_BACK: [
    "Rhomboids",
    "Middle Trapezius",
    "Erector Spinae",
    "Latissimus Dorsi",
    "Serratus Posterior",
    "Multifidus",
  ],
  MID_LOW_BACK: [
    "iliocostalis",
    "spinalis",
    "longissimus",
    "Iliopsoas Muscle",
    "Quadratus Lumborum",
    "Gluteal Muscles",
    "The Multifidus muscles",
    "Rhomboids",
    "Middle Trapezius",
    "Erector Spinae",
    "Latissimus Dorsi",
    "Serratus Posterior",
  ],
};

// ============ ADL 映射 ============

/**
 * 身体部位 → ADL（日常活动困难）列表
 * 用于 SOAP 文本生成（Subjective 段 ADL 困难描述）
 *
 * Derived from TEMPLATE_ADL for body parts in template-options.
 * Body parts not in template retain their original values.
 */
export const BODY_PART_ADL: Record<string, string[]> = {
  // Derived from TEMPLATE_ADL (cast readonly to mutable for backward compat)
  ...Object.fromEntries(
    Object.entries(TEMPLATE_ADL).map(([k, v]) => [k, [...v]]),
  ),
  // Not yet in template — keep original values
  WRIST: ["Typing", "Gripping objects", "Writing", "Cooking", "Opening jars"],
  ANKLE: [
    "Walking",
    "Running",
    "Going up/down stairs",
    "Driving",
    "Standing on tiptoes",
  ],
  UPPER_BACK: [
    "Sitting for long periods",
    "Reaching overhead",
    "Carrying bags",
    "Deep breathing",
  ],
  MIDDLE_BACK: [
    "Sitting for long periods",
    "Twisting motions",
    "Bending forward",
    "Lifting objects",
    "Deep breathing",
    "Reaching overhead",
  ],
  MID_LOW_BACK: [
    "Standing for long periods of time",
    "Walking for long periods of time",
    "Bending over to wear/tie a shoe",
    "Rising from a chair",
    "Getting out of bed",
    "Going up and down stairs",
    "Lifting objects",
    "Sitting for long periods",
    "Twisting motions",
    "Bending forward",
  ],
};

// ============ ROM 正常值映射 ============

export type ROMDifficulty = "EASY" | "MEDIUM" | "HARD";

export interface ROMMovement {
  movement: string;
  normalDegrees: number;
  difficulty: ROMDifficulty;
}

/**
 * 身体部位 → ROM 测试项目（运动名称 + 正常角度 + 难度）
 *
 * 合并自 soap-generator.ts:281 ROM_MAP
 */
export const BODY_PART_ROM: Record<string, ROMMovement[]> = {
  LBP: [
    { movement: "Flexion", normalDegrees: 90, difficulty: "MEDIUM" },
    { movement: "Extension", normalDegrees: 30, difficulty: "HARD" },
    { movement: "Rotation to Right", normalDegrees: 45, difficulty: "MEDIUM" },
    { movement: "Rotation to Left", normalDegrees: 45, difficulty: "MEDIUM" },
    { movement: "Flexion to the Right", normalDegrees: 30, difficulty: "EASY" },
    { movement: "Flexion to the Left", normalDegrees: 30, difficulty: "EASY" },
  ],
  NECK: [
    {
      movement: "Extension (look up)",
      normalDegrees: 60,
      difficulty: "MEDIUM",
    },
    { movement: "Flexion (look down)", normalDegrees: 50, difficulty: "EASY" },
    {
      movement: "Rotation to Right (look to right)",
      normalDegrees: 80,
      difficulty: "MEDIUM",
    },
    {
      movement: "Rotation to Left (look to left)",
      normalDegrees: 80,
      difficulty: "MEDIUM",
    },
    {
      movement: "Flexion to the Right (bending right)",
      normalDegrees: 45,
      difficulty: "EASY",
    },
    {
      movement: "Flexion to the Left (bending left)",
      normalDegrees: 45,
      difficulty: "EASY",
    },
  ],
  SHOULDER: [
    { movement: "Abduction", normalDegrees: 180, difficulty: "HARD" },
    { movement: "Horizontal Adduction", normalDegrees: 45, difficulty: "EASY" },
    { movement: "Flexion", normalDegrees: 180, difficulty: "HARD" },
    { movement: "Extension", normalDegrees: 60, difficulty: "MEDIUM" },
    { movement: "External Rotation", normalDegrees: 90, difficulty: "MEDIUM" },
    { movement: "Internal Rotation", normalDegrees: 90, difficulty: "MEDIUM" },
  ],
  KNEE: [
    { movement: "Flexion(fully bent)", normalDegrees: 130, difficulty: "HARD" },
    {
      movement: "Extension(fully straight)",
      normalDegrees: 0,
      difficulty: "EASY",
    },
  ],
  HIP: [
    { movement: "Flexion", normalDegrees: 120, difficulty: "MEDIUM" },
    { movement: "Extension", normalDegrees: 30, difficulty: "HARD" },
    { movement: "Abduction", normalDegrees: 45, difficulty: "MEDIUM" },
    { movement: "Adduction", normalDegrees: 30, difficulty: "EASY" },
    { movement: "Internal Rotation", normalDegrees: 45, difficulty: "HARD" },
    { movement: "External Rotation", normalDegrees: 45, difficulty: "MEDIUM" },
  ],
  ELBOW: [
    { movement: "Flexion", normalDegrees: 150, difficulty: "EASY" },
    { movement: "Extension", normalDegrees: 0, difficulty: "EASY" },
    { movement: "Supination", normalDegrees: 90, difficulty: "MEDIUM" },
    { movement: "Pronation", normalDegrees: 90, difficulty: "MEDIUM" },
  ],
  WRIST: [
    { movement: "Flexion", normalDegrees: 80, difficulty: "MEDIUM" },
    { movement: "Extension", normalDegrees: 70, difficulty: "MEDIUM" },
    { movement: "Radial Deviation", normalDegrees: 20, difficulty: "HARD" },
    { movement: "Ulnar Deviation", normalDegrees: 30, difficulty: "HARD" },
  ],
  ANKLE: [
    { movement: "Dorsiflexion", normalDegrees: 20, difficulty: "HARD" },
    { movement: "Plantarflexion", normalDegrees: 50, difficulty: "MEDIUM" },
    { movement: "Inversion", normalDegrees: 35, difficulty: "MEDIUM" },
    { movement: "Eversion", normalDegrees: 15, difficulty: "HARD" },
  ],
  MIDDLE_BACK: [
    { movement: "Flexion", normalDegrees: 90, difficulty: "MEDIUM" },
    { movement: "Extension", normalDegrees: 30, difficulty: "HARD" },
    { movement: "Rotation to Right", normalDegrees: 45, difficulty: "MEDIUM" },
    { movement: "Rotation to Left", normalDegrees: 45, difficulty: "MEDIUM" },
  ],
  MID_LOW_BACK: [
    { movement: "Flexion", normalDegrees: 90, difficulty: "MEDIUM" },
    { movement: "Extension", normalDegrees: 30, difficulty: "HARD" },
    { movement: "Rotation to Right", normalDegrees: 45, difficulty: "MEDIUM" },
    { movement: "Rotation to Left", normalDegrees: 45, difficulty: "MEDIUM" },
    { movement: "Flexion to the Right", normalDegrees: 30, difficulty: "EASY" },
    { movement: "Flexion to the Left", normalDegrees: 30, difficulty: "EASY" },
  ],
};

// ============ ROM 受限因子 ============

/**
 * 疼痛 → ROM 受限因子（线性插值）
 * 控制点: pain 0→1.00, 3→0.95, 6→0.85, 8→0.77, 10→0.60
 *
 * 合并自 soap-generator.ts:358 getLimitationFactor
 */
export function romLimitFactor(painLevel: number): number {
  const breakpoints = [
    { pain: 0, factor: 1.0 },
    { pain: 3, factor: 0.95 },
    { pain: 6, factor: 0.85 },
    { pain: 8, factor: 0.77 },
    { pain: 10, factor: 0.6 },
  ];

  const p = Math.max(0, Math.min(10, painLevel));
  if (p <= breakpoints[0].pain) return breakpoints[0].factor;
  if (p >= breakpoints[breakpoints.length - 1].pain)
    return breakpoints[breakpoints.length - 1].factor;

  for (let i = 0; i < breakpoints.length - 1; i++) {
    const lo = breakpoints[i];
    const hi = breakpoints[i + 1];
    if (p >= lo.pain && p <= hi.pain) {
      const t = (p - lo.pain) / (hi.pain - lo.pain);
      return lo.factor + t * (hi.factor - lo.factor);
    }
  }
  return 0.85;
}

// ============ ICD 编码映射 ============

/**
 * 身体部位 → ICD-10 编码前缀
 *
 * 合并自 note-checker.ts:736 ICD_BODY_MAP
 */
export const ICD_BODY_MAP: Record<string, string[]> = {
  KNEE: ["M17", "M25.56", "M25.46", "M25.36", "M76.5", "M23", "M22"],
  SHOULDER: ["M25.51", "M75", "M79.61"],
  ELBOW: ["M25.52", "M77.0", "M77.1"],
  NECK: ["M54.2", "M54.6", "M47.81", "M50"],
  LBP: ["M54.5", "M54.4", "M54.3", "M47.8", "M51"],
  UPPER_BACK: ["M54.6", "M54.2"],
  HIP: ["M25.55", "M16"],
  MID_LOW_BACK: ["M54.5", "M54.4", "M54.3", "M47.8", "M51", "M54.6"],
};

/**
 * 侧别 → ICD-10 后缀
 *
 * 合并自 note-checker.ts:746 LATERALITY_ICD_SUFFIX
 */
export const ICD_LATERALITY_SUFFIX: Record<string, string[]> = {
  right: ["1", "91"],
  left: ["2", "92"],
  bilateral: ["3", "93"],
};

// ============ 针具号数 ============

/**
 * 身体部位 → 有效针具号数
 *
 * 注：当前 note-checker.ts 中尚无 validGauges 常量（未来可补充）
 */
export const BODY_PART_NEEDLE_GAUGES: Record<string, string[]> = {
  KNEE: ["36#", "34#", "30#"],
  SHOULDER: ["36#", "34#", "30#"],
  ELBOW: ["36#", "34#"],
  NECK: ["36#", "34#"],
  LBP: ["36#", "34#", "30#"],
  HIP: ["36#", "34#", "30#"],
  UPPER_BACK: ["36#", "34#"],
  MIDDLE_BACK: ["36#", "34#"],
  MID_LOW_BACK: ["36#", "34#", "30#"],
};
