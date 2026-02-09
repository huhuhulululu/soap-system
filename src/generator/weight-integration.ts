/**
 * 权重集成模块
 * 将规则引擎与HTML生成器连接
 */

import type { BodyPart, Laterality, InsuranceType } from '../types'
import {
  getWeightedOptions,
  selectTopOptions,
  createContext,
  RuleContext
} from '../parser/rule-engine'

// ==================== 上下文类型 ====================

export interface GeneratorContext {
  // 基础信息
  noteType: 'IE' | 'TX'
  insuranceType: InsuranceType

  // 身体部位
  bodyPart: BodyPart
  laterality: Laterality
  secondaryBodyParts?: BodyPart[]

  // 临床信息
  chronicityLevel?: 'Acute' | 'Sub Acute' | 'Chronic'
  painScore?: number
  severityLevel?: 'mild' | 'mild to moderate' | 'moderate' | 'moderate to severe' | 'severe'

  // TCM信息
  localPattern?: string
  systemicPattern?: string

  // 患者信息
  age?: number
  occupation?: string
  habits?: string[]
  medicalHistory?: string[]
  hasPacemaker?: boolean

  // 环境信息
  weather?: 'cold' | 'hot' | 'humid' | 'dry' | 'rainy' | 'winter' | 'summer' | 'foggy' | 'windy' | 'spring'

  // TX复诊信息
  changeFromLastVisit?: 'improvement' | 'no change' | 'exacerbate'
  visitNumber?: number
}

// ==================== 转换函数 ====================

/**
 * 将生成器上下文转换为规则引擎上下文
 */
export function toRuleContext(ctx: GeneratorContext): RuleContext {
  return createContext({
    insuranceType: ctx.insuranceType,
    noteType: ctx.noteType,
    bodyPart: ctx.bodyPart,
    localPattern: ctx.localPattern,
    systemicPattern: ctx.systemicPattern,
    painScore: ctx.painScore,
    chronicityLevel: ctx.chronicityLevel,
    age: ctx.age,
    occupation: ctx.occupation,
    weather: ctx.weather,
    hasPacemaker: ctx.hasPacemaker,
    changeFromLastVisit: ctx.changeFromLastVisit === 'improvement'
      ? 'improvement of symptom(s).'
      : ctx.changeFromLastVisit === 'exacerbate'
        ? 'exacerbate of symptom(s).'
        : undefined
  })
}

// ==================== 权重选择函数 ====================

/**
 * 选择单个最佳选项（带权重）
 */
export function selectWeightedSingle(
  fieldPath: string,
  options: readonly string[],
  ctx: GeneratorContext,
  fallback?: string
): string {
  const ruleContext = toRuleContext(ctx)
  const weighted = getWeightedOptions(fieldPath, [...options], ruleContext)

  if (weighted.length > 0 && weighted[0].weight > 50) {
    return weighted[0].option
  }

  return fallback || options[0]
}

/**
 * 选择多个最佳选项（带权重）
 */
export function selectWeightedMultiple(
  fieldPath: string,
  options: readonly string[],
  ctx: GeneratorContext,
  count: number = 2,
  fallback?: string[]
): string[] {
  const ruleContext = toRuleContext(ctx)
  const weighted = selectTopOptions(fieldPath, [...options], ruleContext, count, 40)

  if (weighted.length > 0) {
    return weighted.map(w => w.option)
  }

  return fallback || options.slice(0, count)
}

/**
 * 获取带权重排序的完整选项列表
 */
export function getWeightedOptionsList(
  fieldPath: string,
  options: readonly string[],
  ctx: GeneratorContext
): Array<{ option: string; weight: number; isRecommended: boolean }> {
  const ruleContext = toRuleContext(ctx)
  const weighted = getWeightedOptions(fieldPath, [...options], ruleContext)

  return weighted.map(w => ({
    option: w.option,
    weight: w.weight,
    isRecommended: w.weight > 60
  }))
}

// ==================== Subjective 权重选择 ====================

/**
 * 选择疼痛类型（基于证型和身体部位）
 */
export function selectPainTypes(
  options: readonly string[],
  ctx: GeneratorContext,
  count: number = 2
): string[] {
  return selectWeightedMultiple('subjective.painTypes', options, ctx, count, ['Aching', 'Dull'])
}

/**
 * 选择病因（基于年龄、职业、天气）
 */
export function selectCausativeFactors(
  options: readonly string[],
  ctx: GeneratorContext,
  count: number = 1
): string[] {
  return selectWeightedMultiple('subjective.causativeFactors', options, ctx, count, ['age related/degenerative changes'])
}

/**
 * 选择加重因素（基于身体部位）
 */
export function selectExacerbatingFactors(
  options: readonly string[],
  ctx: GeneratorContext,
  count: number = 2
): string[] {
  return selectWeightedMultiple('subjective.exacerbatingFactors', options, ctx, count)
}

/**
 * 选择ADL困难程度（基于疼痛评分）
 */
export function selectADLDifficultyLevel(
  options: readonly string[],
  ctx: GeneratorContext
): string {
  return selectWeightedSingle('subjective.adlDifficulty.level', options, ctx, 'moderate')
}

/**
 * 选择ADL活动（基于身体部位）
 */
export function selectADLActivities(
  options: readonly string[],
  ctx: GeneratorContext,
  count: number = 2
): string[] {
  return selectWeightedMultiple('subjective.adlDifficulty.activities', options, ctx, count)
}

/**
 * 选择疼痛频率（基于严重程度）
 */
export function selectPainFrequency(
  options: readonly string[],
  ctx: GeneratorContext
): string {
  return selectWeightedSingle('subjective.painFrequency', options, ctx)
}

/**
 * 选择症状持续时间单位（基于慢性程度）
 */
export function selectDurationUnit(
  options: readonly string[],
  ctx: GeneratorContext
): string {
  return selectWeightedSingle('subjective.symptomDuration.unit', options, ctx)
}

// ==================== Objective 权重选择 ====================

/**
 * 选择肌肉（基于身体部位）
 */
export function selectMuscles(
  options: readonly string[],
  ctx: GeneratorContext,
  count: number = 3
): string[] {
  return selectWeightedMultiple('objective.muscleTesting.muscles', options, ctx, count)
}

/**
 * 选择紧张度分级（基于严重程度）
 */
export function selectTightnessGrading(
  options: readonly string[],
  ctx: GeneratorContext
): string {
  return selectWeightedSingle('objective.muscleTesting.tightness.gradingScale', options, ctx, 'moderate')
}

/**
 * 选择压痛分级（基于疼痛评分）
 */
export function selectTendernessGrading(
  options: readonly string[],
  ctx: GeneratorContext
): string {
  return selectWeightedSingle('objective.muscleTesting.tenderness.gradingScale', options, ctx)
}

/**
 * 选择舌象（基于证型）
 */
export function selectTongue(
  options: readonly string[],
  ctx: GeneratorContext
): string {
  return selectWeightedSingle('objective.tonguePulse.tongue', options, ctx)
}

/**
 * 选择脉象（基于证型）
 */
export function selectPulse(
  options: readonly string[],
  ctx: GeneratorContext
): string {
  return selectWeightedSingle('objective.tonguePulse.pulse', options, ctx)
}

// ==================== Assessment 权重选择 ====================

/**
 * 选择局部证型（基于症状和身体部位）
 */
export function selectLocalPattern(
  options: readonly string[],
  ctx: GeneratorContext
): string {
  if (ctx.localPattern && options.includes(ctx.localPattern)) {
    return ctx.localPattern
  }
  return selectWeightedSingle('assessment.tcmDiagnosis.localPattern', options, ctx, 'Qi Stagnation')
}

/**
 * 选择全身证型（基于年龄和体质）
 */
export function selectSystemicPattern(
  options: readonly string[],
  ctx: GeneratorContext
): string {
  if (ctx.systemicPattern && options.includes(ctx.systemicPattern)) {
    return ctx.systemicPattern
  }
  return selectWeightedSingle('assessment.tcmDiagnosis.systemicPattern', options, ctx, 'Kidney Qi Deficiency')
}

/**
 * 选择治疗原则（基于证型）
 */
export function selectTreatmentPrinciples(
  options: readonly string[],
  ctx: GeneratorContext,
  count: number = 2
): string[] {
  return selectWeightedMultiple('assessment.treatmentPrinciples.focusOn', options, ctx, count)
}

/**
 * 选择整体状态（TX复诊）
 */
export function selectGeneralCondition(
  options: readonly string[],
  ctx: GeneratorContext
): string {
  return selectWeightedSingle('assessment.generalCondition', options, ctx, 'fair')
}

// ==================== Plan 权重选择 ====================

/**
 * 选择治疗频率（基于慢性程度和严重程度）
 */
export function selectTreatmentFrequency(
  options: readonly string[],
  ctx: GeneratorContext
): string {
  return selectWeightedSingle('plan.shortTermGoal.treatmentFrequency', options, ctx, '12')
}

/**
 * 选择穴位（基于身体部位和证型）
 */
export function selectAcupoints(
  options: readonly string[],
  ctx: GeneratorContext,
  count: number = 4
): string[] {
  return selectWeightedMultiple('plan.needleProtocol.points', options, ctx, count)
}

/**
 * 选择电刺激（基于禁忌症）
 */
export function selectElectricalStimulation(
  options: readonly string[],
  ctx: GeneratorContext
): string {
  // 起搏器禁忌
  if (ctx.hasPacemaker) {
    return 'without'
  }
  // HF/OPTUM保险限制
  if (ctx.insuranceType === 'HF' || ctx.insuranceType === 'OPTUM') {
    return 'without'
  }
  return selectWeightedSingle('plan.needleProtocol.electricalStimulation', options, ctx, 'with')
}

/**
 * 选择治疗时间（基于保险类型）
 */
export function selectOperationTime(
  options: readonly string[],
  ctx: GeneratorContext
): string {
  // HF/OPTUM保险硬性限制15分钟
  if (ctx.insuranceType === 'HF' || ctx.insuranceType === 'OPTUM') {
    return '15'
  }
  return selectWeightedSingle('plan.needleProtocol.totalTime', options, ctx, '60')
}

// ==================== 综合推荐 ====================

/**
 * 生成完整的权重推荐报告
 */
export function generateWeightedRecommendations(ctx: GeneratorContext): {
  subjective: {
    painTypes: string[]
    causativeFactors: string[]
    adlLevel: string
    painFrequency: string
  }
  objective: {
    tightnessGrading: string
    tendernessGrading: string
    tongue: string
    pulse: string
  }
  assessment: {
    localPattern: string
    systemicPattern: string
    treatmentPrinciples: string[]
  }
  plan: {
    treatmentFrequency: string
    operationTime: string
    electricalStimulation: string
  }
} {
  // 默认选项列表
  const painTypeOptions = ['Dull', 'Burning', 'Freezing', 'Shooting', 'Tingling', 'Stabbing', 'Aching', 'weighty', 'cold']
  const causativeOptions = ['age related/degenerative changes', 'overworking in computer', 'lifting too much weight', 'weather change']
  const adlOptions = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
  const frequencyOptions = ['Intermittent', 'Occasional', 'Frequent', 'Constant']
  const tightnessOptions = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
  const tendernessOptions = ['(+1)', '(+2)', '(+3)', '(+4)']
  const tongueOptions = ['thin white coat', 'purple', 'pale', 'red']
  const pulseOptions = ['string-taut', 'deep', 'thready', 'rapid']
  const localPatterns = ['Qi Stagnation', 'Blood Stasis', 'Wind-Cold Invasion', 'Phlegm-Damp', 'Damp-Heat']
  const systemicPatterns = ['Kidney Yang Deficiency', 'Kidney Yin Deficiency', 'Qi Deficiency', 'Blood Deficiency']
  const principleOptions = ['moving qi', 'activating Blood circulation', 'expelling pathogens', 'drain the dampness']
  const frequencyNumOptions = ['6', '8', '10', '12']
  const timeOptions = ['15', '30', '45', '60']
  const eStimOptions = ['with', 'without']

  return {
    subjective: {
      painTypes: selectPainTypes(painTypeOptions, ctx),
      causativeFactors: selectCausativeFactors(causativeOptions, ctx),
      adlLevel: selectADLDifficultyLevel(adlOptions, ctx),
      painFrequency: selectPainFrequency(frequencyOptions, ctx)
    },
    objective: {
      tightnessGrading: selectTightnessGrading(tightnessOptions, ctx),
      tendernessGrading: selectTendernessGrading(tendernessOptions, ctx),
      tongue: selectTongue(tongueOptions, ctx),
      pulse: selectPulse(pulseOptions, ctx)
    },
    assessment: {
      localPattern: selectLocalPattern(localPatterns, ctx),
      systemicPattern: selectSystemicPattern(systemicPatterns, ctx),
      treatmentPrinciples: selectTreatmentPrinciples(principleOptions, ctx)
    },
    plan: {
      treatmentFrequency: selectTreatmentFrequency(frequencyNumOptions, ctx),
      operationTime: selectOperationTime(timeOptions, ctx),
      electricalStimulation: selectElectricalStimulation(eStimOptions, ctx)
    }
  }
}
