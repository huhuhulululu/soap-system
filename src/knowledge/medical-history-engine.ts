/**
 * 病史关联引擎
 * 病史 → 中医辨证推荐 / generalCondition / progress系数 / 初始值修正 / 特殊约束
 */

import type { BodyPart } from '../types'

// ==================== 类型定义 ====================

export interface MedicalHistoryProfile {
  /** 维度1: 证型推荐 (权重排序) */
  recommendedSystemicPatterns: Array<{ pattern: string; weight: number; reason: string }>
  /** 维度2: generalCondition */
  conditionImpact: 'good' | 'fair' | 'poor'
  conditionReasons: string[]
  /** 维度3: progress 系数 (0.7~1.0) */
  progressMultiplier: number
  progressReasons: string[]
  /** 维度4: 初始值修正 */
  initialAdjustments: {
    severityBump: number       // +1 = 加重一档
    romDeficitBump: number     // +0.1 = ROM 基线更差
    spasmBump: number          // +1 = spasm 基线更高
  }
  /** 维度5: 特殊约束 */
  constraints: {
    forceNoElectricalStim: boolean    // Pacemaker
    cautionElectricalStim: boolean    // Metal Implant
    cautionNeedleDepth: boolean       // Osteoporosis
  }
}

// ==================== 维度1: 病史 → 证型权重映射 ====================

interface PatternWeight {
  condition: string
  pattern: string
  weight: number
  reason: string
}

const HISTORY_PATTERN_WEIGHTS: PatternWeight[] = [
  // Diabetes → 阴虚/气血两虚
  { condition: 'Diabetes', pattern: 'Kidney Yin Deficiency', weight: 40, reason: '消渴病阴虚为本' },
  { condition: 'Diabetes', pattern: 'Qi & Blood Deficiency', weight: 30, reason: '糖尿病久病耗气伤血' },
  // Hypertension → 肝阳上亢
  { condition: 'Hypertension', pattern: 'Liver Yang Rising', weight: 50, reason: '高血压肝阳上亢' },
  { condition: 'Hypertension', pattern: 'Kidney Yang Deficiency', weight: -30, reason: '高血压非阳虚' },
  // Heart Disease / Heart Murmur → 气血不足
  { condition: 'Heart Disease', pattern: 'Qi & Blood Deficiency', weight: 40, reason: '心脏病气血不足' },
  { condition: 'Heart Disease', pattern: 'Qi Deficiency', weight: 30, reason: '心气虚' },
  { condition: 'Heart Murmur', pattern: 'Qi Deficiency', weight: 35, reason: '心杂音气虚' },
  // Stroke → 气血亏虚 + 肝阳
  { condition: 'Stroke', pattern: 'Qi & Blood Deficiency', weight: 40, reason: '中风后气虚血瘀' },
  { condition: 'Stroke', pattern: 'Liver Yang Rising', weight: 30, reason: '中风肝阳暴亢后遗' },
  // Anemia → 血虚
  { condition: 'Anemia', pattern: 'Blood Deficiency', weight: 50, reason: '贫血即血虚' },
  { condition: 'Anemia', pattern: 'Qi & Blood Deficiency', weight: 40, reason: '贫血气血两虚' },
  // Thyroid → 阳虚(甲减) / 阴虚火旺(甲亢)
  { condition: 'Thyroid', pattern: 'Kidney Yang Deficiency', weight: 30, reason: '甲减阳虚倾向' },
  { condition: 'Thyroid', pattern: 'Yin Deficiency Fire', weight: 25, reason: '甲亢阴虚火旺倾向' },
  // Kidney Disease → 肾虚
  { condition: 'Kidney Disease', pattern: 'Kidney Qi Deficiency', weight: 45, reason: '肾病肾气虚' },
  { condition: 'Kidney Disease', pattern: 'Kidney Yang Deficiency', weight: 35, reason: '肾病肾阳虚' },
  // Liver Disease → 肝胆湿热
  { condition: 'Liver Disease', pattern: 'LV/GB Damp-Heat', weight: 45, reason: '肝病湿热蕴结' },
  // Osteoporosis → 肾精亏虚
  { condition: 'Osteoporosis', pattern: 'Kidney Essence Deficiency', weight: 50, reason: '骨质疏松肾精亏虚' },
  { condition: 'Osteoporosis', pattern: 'Kidney Yang Deficiency', weight: 30, reason: '骨质疏松肾阳不足' },
  // Asthma / Lung Disease → 肺肾两虚
  { condition: 'Asthma', pattern: 'LU & KI Deficiency', weight: 45, reason: '哮喘肺肾两虚' },
  { condition: 'Lung Disease', pattern: 'LU & KI Deficiency', weight: 40, reason: '肺病肺肾两虚' },
  { condition: 'Lung Disease', pattern: 'Wei Qi Deficiency', weight: 30, reason: '肺病卫气不固' },
  // Parkinson → 肝风/血虚
  { condition: 'Parkinson', pattern: 'Liver Yang Rising', weight: 35, reason: '帕金森肝风内动' },
  { condition: 'Parkinson', pattern: 'Blood Deficiency', weight: 30, reason: '帕金森血虚生风' },
  // stomach trouble → 脾虚/胃肠湿热
  { condition: 'stomach trouble', pattern: 'Spleen Deficiency', weight: 45, reason: '胃病脾虚' },
  { condition: 'stomach trouble', pattern: 'ST & Intestine Damp-Heat', weight: 35, reason: '胃病胃肠湿热' },
  // Smoking → 阴虚
  { condition: 'Smoking', pattern: 'Yin Deficiency Fire', weight: 25, reason: '吸烟伤阴' },
  { condition: 'Smoking', pattern: 'LU Wind-Heat', weight: 20, reason: '吸烟肺热' },
  // Alcohol → 湿热
  { condition: 'Alcohol', pattern: 'LV/GB Damp-Heat', weight: 35, reason: '饮酒伤肝湿热' },
  { condition: 'Alcohol', pattern: 'Damp-Heat', weight: 25, reason: '饮酒湿热内蕴' },
  // Hyperlipidemia / Cholesterol → 痰湿
  { condition: 'Hyperlipidemia', pattern: 'Phlegm-Damp', weight: 45, reason: '高脂血症痰湿' },
  { condition: 'Hyperlipidemia', pattern: 'Spleen Deficiency', weight: 25, reason: '高脂脾虚失运' },
  { condition: 'Cholesterol', pattern: 'Phlegm-Damp', weight: 40, reason: '高胆固醇痰湿' },
  // Herniated Disk → 肾阳虚 (LBP/NECK 部位关联)
  { condition: 'Herniated Disk', pattern: 'Kidney Yang Deficiency', weight: 30, reason: '椎间盘突出肾阳不足' },
  { condition: 'Herniated Disk', pattern: 'Qi & Blood Deficiency', weight: 20, reason: '椎间盘突出气血瘀滞' },
  // Fractures → 气血两虚 (骨折耗气伤血)
  { condition: 'Fractures', pattern: 'Qi & Blood Deficiency', weight: 30, reason: '骨折耗气伤血' },
  // Prostate → 肾气虚
  { condition: 'Prostate', pattern: 'Kidney Qi Deficiency', weight: 35, reason: '前列腺肾气虚' },
]

// ==================== 局部证型推导权重 (疼痛/症状/部位/慢性度 → 局部证型) ====================

interface LocalPatternWeight {
  pattern: string
  weight: number
  reason: string
}

/** 疼痛类型 → 局部证型 */
const PAIN_TYPE_PATTERN_WEIGHTS: Array<{ painType: string } & LocalPatternWeight> = [
  { painType: 'Stabbing', pattern: 'Blood Stasis', weight: 50, reason: '刺痛=瘀血' },
  { painType: 'Shooting', pattern: 'Blood Stasis', weight: 30, reason: '窜痛=瘀血' },
  { painType: 'pricking', pattern: 'Blood Stasis', weight: 35, reason: '针刺痛=瘀血' },
  { painType: 'Aching', pattern: 'Qi Stagnation', weight: 40, reason: '胀痛=气滞' },
  { painType: 'Squeezing', pattern: 'Qi Stagnation', weight: 35, reason: '挤压痛=气滞' },
  { painType: 'Dull', pattern: 'Qi & Blood Deficiency', weight: 30, reason: '隐痛=虚证' },
  { painType: 'Dull', pattern: 'Blood Deficiency', weight: 25, reason: '隐痛=血虚' },
  { painType: 'Burning', pattern: 'Damp-Heat', weight: 40, reason: '灼痛=湿热' },
  { painType: 'Burning', pattern: 'LV/GB Damp-Heat', weight: 30, reason: '灼痛=肝胆湿热' },
  { painType: 'Freezing', pattern: 'Cold-Damp + Wind-Cold', weight: 40, reason: '冷痛=寒湿' },
  { painType: 'Freezing', pattern: 'Wind-Cold Invasion', weight: 35, reason: '冷痛=风寒' },
  { painType: 'cold', pattern: 'Cold-Damp + Wind-Cold', weight: 40, reason: '冷痛=寒湿' },
  { painType: 'cold', pattern: 'Wind-Cold Invasion', weight: 35, reason: '冷痛=风寒' },
  { painType: 'weighty', pattern: 'Phlegm-Damp', weight: 35, reason: '重痛=痰湿' },
  { painType: 'weighty', pattern: 'Cold-Damp + Wind-Cold', weight: 25, reason: '重感=寒湿' },
  { painType: 'Tingling', pattern: 'Blood Deficiency', weight: 25, reason: '麻痛=血虚' },
  { painType: 'pin & needles', pattern: 'Blood Deficiency', weight: 25, reason: '麻刺=血虚' },
  { painType: 'Cramping', pattern: 'Liver Qi Stagnation', weight: 30, reason: '拘挛=肝气郁结' },
]

/** 伴随症状 → 局部证型 */
const SYMPTOM_PATTERN_WEIGHTS: Array<{ symptom: string } & LocalPatternWeight> = [
  { symptom: 'numbness', pattern: 'Blood Deficiency', weight: 25, reason: '麻木=血虚不荣' },
  { symptom: 'numbness', pattern: 'Qi & Blood Deficiency', weight: 20, reason: '麻木=气血不足' },
  { symptom: 'weakness', pattern: 'Qi & Blood Deficiency', weight: 25, reason: '无力=气血两虚' },
  { symptom: 'stiffness', pattern: 'Cold-Damp + Wind-Cold', weight: 25, reason: '僵硬=寒湿凝滞' },
  { symptom: 'stiffness', pattern: 'Wind-Cold Invasion', weight: 20, reason: '僵硬=风寒袭络' },
  { symptom: 'heaviness', pattern: 'Phlegm-Damp', weight: 25, reason: '沉重=痰湿' },
  { symptom: 'soreness', pattern: 'Qi Stagnation', weight: 15, reason: '酸痛=气滞(最中性)' },
]

/** 部位 → 局部证型 */
const BODY_PART_PATTERN_WEIGHTS: Array<{ bodyPart: string } & LocalPatternWeight> = [
  { bodyPart: 'LBP', pattern: 'Qi Stagnation', weight: 20, reason: '腰痛最常见气滞' },
  { bodyPart: 'LBP', pattern: 'Blood Stasis', weight: 15, reason: '腰部久病入络' },
  { bodyPart: 'NECK', pattern: 'Qi Stagnation', weight: 20, reason: '颈痛常见气滞' },
  { bodyPart: 'NECK', pattern: 'Wind-Cold Invasion', weight: 15, reason: '颈为风之门户' },
  { bodyPart: 'SHOULDER', pattern: 'Qi Stagnation', weight: 15, reason: '肩痛常见气滞' },
  { bodyPart: 'SHOULDER', pattern: 'Blood Stasis', weight: 15, reason: '肩部血瘀' },
  { bodyPart: 'SHOULDER', pattern: 'Wind-Cold Invasion', weight: 10, reason: '冻结肩' },
  { bodyPart: 'KNEE', pattern: 'Damp-Heat', weight: 20, reason: '膝关节易受湿热' },
  { bodyPart: 'KNEE', pattern: 'Cold-Damp + Wind-Cold', weight: 20, reason: '膝部寒湿' },
  { bodyPart: 'KNEE', pattern: 'Phlegm-Damp', weight: 15, reason: '膝部痰湿' },
  { bodyPart: 'ELBOW', pattern: 'Qi Stagnation', weight: 20, reason: '肘痛气滞' },
  { bodyPart: 'ELBOW', pattern: 'Blood Stasis', weight: 15, reason: '肘部血瘀' },
  { bodyPart: 'HIP', pattern: 'Qi Stagnation', weight: 15, reason: '髋痛气滞' },
  { bodyPart: 'HIP', pattern: 'Cold-Damp + Wind-Cold', weight: 15, reason: '髋部深层寒湿' },
]

/** 慢性程度 → 局部证型 */
const CHRONICITY_PATTERN_WEIGHTS: Array<{ chronicityLevel: string } & LocalPatternWeight> = [
  { chronicityLevel: 'Chronic', pattern: 'Blood Stasis', weight: 15, reason: '久病必瘀' },
  { chronicityLevel: 'Chronic', pattern: 'Qi & Blood Deficiency', weight: 10, reason: '久病耗伤气血' },
  { chronicityLevel: 'Acute', pattern: 'Wind-Cold Invasion', weight: 10, reason: '新发多外邪' },
  { chronicityLevel: 'Acute', pattern: 'Qi Stagnation', weight: 5, reason: '新发气机不畅' },
]

// ==================== 维度2: generalCondition 推断 ====================

const SEVERE_CONDITIONS = ['Stroke', 'Parkinson', 'Kidney Disease', 'Heart Disease', 'Liver Disease']
const CHRONIC_CONDITIONS = ['Diabetes', 'Hypertension', 'Lung Disease', 'Asthma', 'Anemia', 'Thyroid']
const LIFESTYLE_CONDITIONS = ['Smoking', 'Alcohol']

export function inferCondition(
  medicalHistory: string[],
  age?: number,
  systemicPattern?: string
): 'good' | 'fair' | 'poor' {
  let score = 0

  // 严重疾病 +3
  score += medicalHistory.filter(h => SEVERE_CONDITIONS.includes(h)).length * 3

  // 慢性病 +1
  score += medicalHistory.filter(h => CHRONIC_CONDITIONS.includes(h)).length

  // 生活习惯 +0.5
  score += medicalHistory.filter(h => LIFESTYLE_CONDITIONS.includes(h)).length * 0.5

  // 其他有影响的病史 +0.5
  const otherImpact = ['Osteoporosis', 'Fractures', 'Herniated Disk', 'Hyperlipidemia', 'Cholesterol']
  score += medicalHistory.filter(h => otherImpact.includes(h)).length * 0.5

  // 年龄修正
  if (age && age >= 75) score += 1.5
  else if (age && age >= 65) score += 0.5

  // 整体证型修正 (重度虚证额外 +0.5)
  if (systemicPattern) {
    const sp = systemicPattern.toLowerCase()
    if (sp.includes('essence deficiency') || sp.includes('yin deficiency fire')) score += 0.5
  }

  if (score >= 2.5) return 'poor'
  if (score >= 1) return 'fair'
  return 'good'
}

// ==================== 维度3: progress 系数 ====================

const SLOW_HEALERS: Record<string, number> = {
  'Stroke': 0.85,
  'Parkinson': 0.85,
  'Diabetes': 0.92,
  'Kidney Disease': 0.90,
  'Anemia': 0.93,
  'Osteoporosis': 0.93,
  'Smoking': 0.95,
  'Alcohol': 0.95,
  'Heart Disease': 0.93,
  'Liver Disease': 0.92,
  'Lung Disease': 0.93,
}

export function inferProgressMultiplier(medicalHistory: string[], age?: number): number {
  let multiplier = 1.0

  for (const [condition, factor] of Object.entries(SLOW_HEALERS)) {
    if (medicalHistory.includes(condition)) {
      multiplier = Math.min(multiplier, factor)
    }
  }

  // 多病叠加衰减 (每多一种慢性病 -2%)
  const conditionCount = medicalHistory.filter(h => h !== 'N/A' && h !== 'Smoking' && h !== 'Alcohol').length
  if (conditionCount >= 3) multiplier *= 0.96
  if (conditionCount >= 5) multiplier *= 0.94

  // 年龄衰减
  if (age && age >= 75) multiplier *= 0.90
  else if (age && age >= 65) multiplier *= 0.95

  return Math.max(0.70, multiplier)
}

// ==================== 维度4: 初始值修正 ====================

export function inferInitialAdjustments(
  medicalHistory: string[],
  bodyPart?: BodyPart
): { severityBump: number; romDeficitBump: number; spasmBump: number } {
  let severityBump = 0
  let romDeficitBump = 0
  let spasmBump = 0

  // Herniated Disk + LBP/NECK → ROM 更差, severity 加重
  if (medicalHistory.includes('Herniated Disk') && (bodyPart === 'LBP' || bodyPart === 'NECK')) {
    severityBump += 1
    romDeficitBump += 0.10
  }

  // Joint Replacement + 对应关节 → ROM 基线受限
  if (medicalHistory.includes('Joint Replacement') && (bodyPart === 'KNEE' || bodyPart === 'HIP' || bodyPart === 'SHOULDER')) {
    romDeficitBump += 0.15
  }

  // Fractures + 对应部位 → severity 加重
  if (medicalHistory.includes('Fractures')) {
    severityBump += 1
    romDeficitBump += 0.05
  }

  // Parkinson → spasm 基线更高 (震颤)
  if (medicalHistory.includes('Parkinson')) {
    spasmBump += 1
  }

  // Stroke → severity 加重, ROM 更差
  if (medicalHistory.includes('Stroke')) {
    severityBump += 1
    romDeficitBump += 0.10
  }

  return { severityBump, romDeficitBump, spasmBump }
}

// ==================== 维度5: 特殊约束 ====================

export function inferConstraints(medicalHistory: string[]): {
  forceNoElectricalStim: boolean
  cautionElectricalStim: boolean
  cautionNeedleDepth: boolean
} {
  return {
    forceNoElectricalStim: medicalHistory.includes('Pacemaker'),
    cautionElectricalStim: medicalHistory.includes('Joint Replacement') || medicalHistory.includes('Fractures'),
    cautionNeedleDepth: medicalHistory.includes('Osteoporosis')
  }
}

// ==================== 综合推断函数 ====================

/** 根据疼痛类型、伴随症状、部位、慢性程度推荐局部证型 (权重排序) */
export function inferLocalPatterns(
  painTypes: string[],
  associatedSymptoms: string[],
  bodyPart: string,
  chronicityLevel?: 'Acute' | 'Sub Acute' | 'Chronic'
): Array<{ pattern: string; weight: number; reason: string }> {
  const weightMap = new Map<string, { weight: number; reasons: string[] }>()

  for (const pt of painTypes) {
    for (const rule of PAIN_TYPE_PATTERN_WEIGHTS) {
      if (rule.painType === pt) {
        const existing = weightMap.get(rule.pattern) || { weight: 0, reasons: [] }
        existing.weight += rule.weight
        existing.reasons.push(rule.reason)
        weightMap.set(rule.pattern, existing)
      }
    }
  }
  for (const sym of associatedSymptoms) {
    for (const rule of SYMPTOM_PATTERN_WEIGHTS) {
      if (rule.symptom === sym) {
        const existing = weightMap.get(rule.pattern) || { weight: 0, reasons: [] }
        existing.weight += rule.weight
        existing.reasons.push(rule.reason)
        weightMap.set(rule.pattern, existing)
      }
    }
  }
  for (const rule of BODY_PART_PATTERN_WEIGHTS) {
    if (rule.bodyPart === bodyPart) {
      const existing = weightMap.get(rule.pattern) || { weight: 0, reasons: [] }
      existing.weight += rule.weight
      existing.reasons.push(rule.reason)
      weightMap.set(rule.pattern, existing)
    }
  }
  if (chronicityLevel) {
    for (const rule of CHRONICITY_PATTERN_WEIGHTS) {
      if (rule.chronicityLevel === chronicityLevel) {
        const existing = weightMap.get(rule.pattern) || { weight: 0, reasons: [] }
        existing.weight += rule.weight
        existing.reasons.push(rule.reason)
        weightMap.set(rule.pattern, existing)
      }
    }
  }

  return Array.from(weightMap.entries())
    .map(([pattern, data]) => ({
      pattern,
      weight: data.weight,
      reason: data.reasons.join('; ')
    }))
    .filter(item => item.weight > 0)
    .sort((a, b) => b.weight - a.weight)
}

/** 根据病史推荐整体证型 (权重排序) */
export function inferSystemicPatterns(
  medicalHistory: string[],
  age?: number
): Array<{ pattern: string; weight: number; reason: string }> {
  if (!medicalHistory || medicalHistory.length === 0 || (medicalHistory.length === 1 && medicalHistory[0] === 'N/A')) {
    return []
  }

  const weightMap = new Map<string, { weight: number; reasons: string[] }>()

  for (const rule of HISTORY_PATTERN_WEIGHTS) {
    if (medicalHistory.includes(rule.condition)) {
      const existing = weightMap.get(rule.pattern) || { weight: 0, reasons: [] }
      existing.weight += rule.weight
      existing.reasons.push(rule.reason)
      weightMap.set(rule.pattern, existing)
    }
  }

  // 年龄加权: 高龄增加虚证权重
  if (age && age >= 65) {
    const elderBoost = [
      { pattern: 'Kidney Yang Deficiency', weight: 15 },
      { pattern: 'Kidney Qi Deficiency', weight: 10 },
      { pattern: 'Qi & Blood Deficiency', weight: 10 },
    ]
    for (const b of elderBoost) {
      const existing = weightMap.get(b.pattern) || { weight: 0, reasons: [] }
      existing.weight += b.weight
      existing.reasons.push('高龄虚证倾向')
      weightMap.set(b.pattern, existing)
    }
  }

  return Array.from(weightMap.entries())
    .map(([pattern, data]) => ({
      pattern,
      weight: data.weight,
      reason: data.reasons.join('; ')
    }))
    .filter(item => item.weight > 0)
    .sort((a, b) => b.weight - a.weight)
}

/** 完整的病史推断 Profile */
export function inferMedicalProfile(
  medicalHistory: string[],
  age?: number,
  bodyPart?: BodyPart,
  systemicPattern?: string
): MedicalHistoryProfile {
  return {
    recommendedSystemicPatterns: inferSystemicPatterns(medicalHistory, age),
    conditionImpact: inferCondition(medicalHistory, age, systemicPattern),
    conditionReasons: medicalHistory.filter(h => h !== 'N/A'),
    progressMultiplier: inferProgressMultiplier(medicalHistory, age),
    progressReasons: medicalHistory.filter(h => SLOW_HEALERS[h] !== undefined),
    initialAdjustments: inferInitialAdjustments(medicalHistory, bodyPart),
    constraints: inferConstraints(medicalHistory)
  }
}
