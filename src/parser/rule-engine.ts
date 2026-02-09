/**
 * 规则引擎
 * 将逻辑规则应用到下拉框选项权重计算
 */

import type {
  LogicRule,
  RuleCondition
} from './logic-rules'
import { getTemplateAlignedRules } from './template-rule-whitelist'
import { TEMPLATE_ONLY_RULES } from './template-logic-rules'

// ==================== 上下文类型定义 ====================

/**
 * 完整的患者/就诊上下文
 * 用于规则引擎评估条件
 */
export interface RuleContext {
  // 环境因素
  environment?: {
    weather?: 'cold' | 'hot' | 'humid' | 'dry' | 'rainy' | 'winter' | 'summer' | 'foggy' | 'windy' | 'spring'
    season?: 'spring' | 'summer' | 'autumn' | 'winter'
  }

  // 患者信息
  patient?: {
    age?: number
    occupation?: string
    habits?: string[]
    medicalHistory?: string[]
  }

  // Header 信息
  header?: {
    noteType?: 'IE' | 'TX'
    insuranceType?: 'NONE' | 'HF' | 'OPTUM' | 'WC' | 'VC' | 'ELDERPLAN'
  }

  // Subjective 部分
  subjective?: {
    chronicityLevel?: 'Acute' | 'Sub Acute' | 'Chronic'
    symptomChange?: string
    reason?: string
    reasonConnector?: string
    primaryBodyPart?: {
      bodyPart?: string
      laterality?: string
    }
    symptomDuration?: {
      value?: number | string
      unit?: string
    }
    adlDifficulty?: {
      level?: string
      activities?: string[]
    }
    painScale?: {
      worst?: number
      best?: number
      current?: number
    }
    painFrequency?: string
    painRadiation?: string
    medicalHistory?: string
    associatedSymptoms?: string[]
    relievingFactors?: string[]
    causativeFactors?: string[]
    exacerbatingFactors?: string[]
    painTypes?: string[]
  }

  // Objective 部分
  objective?: {
    tonguePulse?: {
      tongue?: string
      pulse?: string
    }
  }

  // Assessment 部分
  assessment?: {
    tcmDiagnosis?: {
      localPattern?: string
      systemicPattern?: string
    }
    localPattern?: string
    systemicPattern?: string
    changeFromLastVisit?: string
    generalCondition?: string
  }

  // Plan 部分
  plan?: {
    needleProtocol?: {
      totalTime?: number
      electricalStimulation?: 'with' | 'without'
    }
  }
}

/**
 * 权重效果结果
 */
export interface WeightEffect {
  targetField: string
  option: string
  weightChange: number
  reason: string
  ruleId: string
  ruleName: string
}

/**
 * 字段权重映射
 */
export interface FieldWeightMap {
  [field: string]: {
    [option: string]: {
      totalWeight: number
      appliedRules: Array<{
        ruleId: string
        ruleName: string
        weightChange: number
        reason: string
      }>
    }
  }
}

// ==================== 条件评估器 ====================

/**
 * 从上下文中获取嵌套字段值
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }

  return current
}

/**
 * 评估单个条件
 */
function evaluateCondition(condition: RuleCondition, context: RuleContext): boolean {
  const actualValue = getNestedValue(context as Record<string, unknown>, condition.field)

  if (actualValue === undefined || actualValue === null) {
    return false
  }

  switch (condition.operator) {
    case 'equals':
      // Bug #1 fix: Case-insensitive string comparison
      if (typeof actualValue === 'string' && typeof condition.value === 'string') {
        return actualValue.toLowerCase() === condition.value.toLowerCase()
      }
      return actualValue === condition.value

    case 'contains':
      if (typeof actualValue === 'string') {
        return actualValue.toLowerCase().includes(String(condition.value).toLowerCase())
      }
      if (Array.isArray(actualValue)) {
        return actualValue.some(v =>
          String(v).toLowerCase().includes(String(condition.value).toLowerCase())
        )
      }
      return false

    case 'in':
      if (Array.isArray(condition.value)) {
        return condition.value.includes(actualValue as string)
      }
      return false

    case 'gt': {
      // Bug #4 fix: Handle string numbers with parseFloat
      const numActual = typeof actualValue === 'number' ? actualValue : parseFloat(String(actualValue))
      const numCondition = typeof condition.value === 'number' ? condition.value : parseFloat(String(condition.value))
      return !isNaN(numActual) && !isNaN(numCondition) && numActual > numCondition
    }

    case 'lt': {
      const numActual = typeof actualValue === 'number' ? actualValue : parseFloat(String(actualValue))
      const numCondition = typeof condition.value === 'number' ? condition.value : parseFloat(String(condition.value))
      return !isNaN(numActual) && !isNaN(numCondition) && numActual < numCondition
    }

    case 'gte': {
      const numActual = typeof actualValue === 'number' ? actualValue : parseFloat(String(actualValue))
      const numCondition = typeof condition.value === 'number' ? condition.value : parseFloat(String(condition.value))
      return !isNaN(numActual) && !isNaN(numCondition) && numActual >= numCondition
    }

    case 'lte': {
      const numActual = typeof actualValue === 'number' ? actualValue : parseFloat(String(actualValue))
      const numCondition = typeof condition.value === 'number' ? condition.value : parseFloat(String(condition.value))
      return !isNaN(numActual) && !isNaN(numCondition) && numActual <= numCondition
    }

    default:
      return false
  }
}

/**
 * 评估规则的所有条件（AND逻辑）
 */
function evaluateRule(rule: LogicRule, context: RuleContext): boolean {
  if (rule.conditions.length === 0) {
    return false
  }

  return rule.conditions.every(condition => evaluateCondition(condition, context))
}

// ==================== 规则引擎核心 ====================

/**
 * 获取所有逻辑规则
 */
function getAllRules(): LogicRule[] {
  const candidateRules: LogicRule[] = TEMPLATE_ONLY_RULES

  // 严格模板模式: 仅保留字段与选项均来自模板动态信息的规则
  return getTemplateAlignedRules(candidateRules)
}

/**
 * 应用所有匹配的规则，返回权重效果列表
 */
export function applyRules(context: RuleContext): WeightEffect[] {
  const effects: WeightEffect[] = []
  const allRules = getAllRules()

  for (const rule of allRules) {
    if (evaluateRule(rule, context)) {
      for (const effect of rule.effects) {
        for (const option of effect.options) {
          effects.push({
            targetField: effect.targetField,
            option,
            weightChange: effect.weightChange,
            reason: effect.reason,
            ruleId: rule.id,
            ruleName: rule.name
          })
        }
      }
    }
  }

  return effects
}

/**
 * 将权重效果聚合为字段权重映射
 */
export function aggregateWeights(effects: WeightEffect[]): FieldWeightMap {
  const fieldMap: FieldWeightMap = {}

  for (const effect of effects) {
    if (!fieldMap[effect.targetField]) {
      fieldMap[effect.targetField] = {}
    }

    if (!fieldMap[effect.targetField][effect.option]) {
      fieldMap[effect.targetField][effect.option] = {
        totalWeight: 0,
        appliedRules: []
      }
    }

    fieldMap[effect.targetField][effect.option].totalWeight += effect.weightChange
    fieldMap[effect.targetField][effect.option].appliedRules.push({
      ruleId: effect.ruleId,
      ruleName: effect.ruleName,
      weightChange: effect.weightChange,
      reason: effect.reason
    })
  }

  return fieldMap
}

/**
 * 计算指定字段的加权选项
 */
export function getWeightedOptions(
  fieldPath: string,
  availableOptions: string[],
  context: RuleContext,
  baseWeight: number = 50
): Array<{ option: string; weight: number; reasons: string[]; isForbidden?: boolean }> {
  const effects = applyRules(context)
  const fieldMap = aggregateWeights(effects)

  const fieldWeights = fieldMap[fieldPath] || {}

  // Bug #6 fix: Only return weights for options that exist in availableOptions
  const availableSet = new Set(availableOptions)

  return availableOptions.map(option => {
    const optionData = fieldWeights[option]
    const additionalWeight = optionData?.totalWeight || 0
    const reasons = optionData?.appliedRules.map(r => r.reason) || []

    // Bug #7 fix: Mark options with negative total weight as forbidden
    const finalWeight = baseWeight + additionalWeight
    const isForbidden = finalWeight < 0 || additionalWeight < -baseWeight

    return {
      option,
      weight: Math.max(0, Math.min(100, finalWeight)),
      reasons,
      isForbidden
    }
  })
  // Bug #7 fix: Filter out forbidden options from results, then sort
  .filter(item => !item.isForbidden)
  .sort((a, b) => b.weight - a.weight)
}

/**
 * 选择最佳选项（权重最高）
 */
export function selectBestOption(
  fieldPath: string,
  availableOptions: string[],
  context: RuleContext
): { option: string; weight: number; reasons: string[] } | null {
  const weighted = getWeightedOptions(fieldPath, availableOptions, context)
  return weighted.length > 0 ? weighted[0] : null
}

/**
 * 选择多个最佳选项
 */
export function selectTopOptions(
  fieldPath: string,
  availableOptions: string[],
  context: RuleContext,
  count: number = 3,
  minWeight: number = 30
): Array<{ option: string; weight: number; reasons: string[] }> {
  const weighted = getWeightedOptions(fieldPath, availableOptions, context)
  return weighted
    .filter(w => w.weight >= minWeight)
    .slice(0, count)
}

// ==================== 调试与报告 ====================

/**
 * 生成规则评估报告
 */
export function generateRuleReport(context: RuleContext): string {
  const allRules = getAllRules()
  const matchedRules: LogicRule[] = []
  const unmatchedRules: LogicRule[] = []

  for (const rule of allRules) {
    if (evaluateRule(rule, context)) {
      matchedRules.push(rule)
    } else {
      unmatchedRules.push(rule)
    }
  }

  let report = `=== 规则评估报告 ===\n\n`
  report += `总规则数: ${allRules.length}\n`
  report += `匹配规则: ${matchedRules.length}\n`
  report += `未匹配规则: ${unmatchedRules.length}\n\n`

  report += `--- 匹配的规则 ---\n`
  for (const rule of matchedRules) {
    report += `\n[${rule.id}] ${rule.name}\n`
    report += `  ${rule.description}\n`
    report += `  效果:\n`
    for (const effect of rule.effects) {
      report += `    → ${effect.targetField}: ${effect.options.join(', ')} (${effect.weightChange > 0 ? '+' : ''}${effect.weightChange})\n`
      report += `      原因: ${effect.reason}\n`
    }
  }

  return report
}

/**
 * 生成字段权重详情
 */
export function generateFieldWeightDetail(
  fieldPath: string,
  availableOptions: string[],
  context: RuleContext
): string {
  const weighted = getWeightedOptions(fieldPath, availableOptions, context)

  let detail = `=== ${fieldPath} 权重详情 ===\n\n`

  for (const item of weighted) {
    detail += `[${item.weight}] ${item.option}\n`
    if (item.reasons.length > 0) {
      for (const reason of item.reasons) {
        detail += `    - ${reason}\n`
      }
    }
  }

  return detail
}

// ==================== 便捷函数 ====================

/**
 * 快速创建常见上下文
 */
export function createContext(params: {
  insuranceType?: 'NONE' | 'HF' | 'OPTUM' | 'WC' | 'VC' | 'ELDERPLAN'
  noteType?: 'IE' | 'TX'
  bodyPart?: string
  localPattern?: string
  systemicPattern?: string
  painScore?: number
  chronicityLevel?: 'Acute' | 'Sub Acute' | 'Chronic'
  age?: number
  occupation?: string
  weather?: 'cold' | 'hot' | 'humid' | 'dry' | 'rainy' | 'winter' | 'summer' | 'foggy' | 'windy' | 'spring'
  hasPacemaker?: boolean
  changeFromLastVisit?: string
}): RuleContext {
  const context: RuleContext = {
    header: {
      noteType: params.noteType,
      insuranceType: params.insuranceType
    },
    environment: {
      weather: params.weather
    },
    patient: {
      age: params.age,
      occupation: params.occupation,
      medicalHistory: params.hasPacemaker ? ['Pacemaker'] : []
    },
    subjective: {
      chronicityLevel: params.chronicityLevel,
      primaryBodyPart: {
        bodyPart: params.bodyPart
      },
      painScale: {
        current: params.painScore
      },
      medicalHistory: params.hasPacemaker ? 'Pacemaker' : undefined
    },
    assessment: {
      tcmDiagnosis: {
        localPattern: params.localPattern,
        systemicPattern: params.systemicPattern
      },
      changeFromLastVisit: params.changeFromLastVisit
    }
  }

  return context
}
