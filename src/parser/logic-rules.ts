/**
 * 兼容层: 逻辑规则导出
 *
 * 说明:
 * - 历史版本曾包含大量模板外规则(环境/职业/生活习惯等),
 *   会在 template alignment 审计中产生大量越界告警。
 * - 当前主生成链只允许模板动态字段内的规则。
 * - 因此此文件保留原有导出名以保持 API 兼容,
 *   但实际规则源统一为 TEMPLATE_ONLY_RULES。
 */

import { TEMPLATE_ONLY_RULES } from './template-logic-rules'

// ==================== 逻辑关系定义 ====================

export interface LogicRule {
  id: string
  name: string
  description: string
  conditions: RuleCondition[]
  effects: RuleEffect[]
}

export interface RuleCondition {
  field: string
  operator: 'equals' | 'contains' | 'in' | 'gt' | 'lt' | 'gte' | 'lte'
  value: string | number | string[]
}

export interface RuleEffect {
  targetField: string
  options: string[]
  weightChange: number
  reason: string
}

// ==================== 历史分类导出(兼容占位) ====================

export const ENVIRONMENTAL_CAUSE_RULES: LogicRule[] = []
export const LIFESTYLE_CAUSE_RULES: LogicRule[] = []
export const TCM_PATTERN_RULES: LogicRule[] = []
export const PAIN_SEVERITY_RULES: LogicRule[] = []
export const CHRONICITY_RULES: LogicRule[] = []
export const INSURANCE_RULES: LogicRule[] = []
export const CONTRAINDICATION_RULES: LogicRule[] = []
export const BODY_PART_RULES: LogicRule[] = []
export const FOLLOWUP_RULES: LogicRule[] = []

// 当前生效规则集: 严格模板对齐
export const ALL_LOGIC_RULES: LogicRule[] = TEMPLATE_ONLY_RULES

export const RULE_STATS = {
  environmental: ENVIRONMENTAL_CAUSE_RULES.length,
  lifestyle: LIFESTYLE_CAUSE_RULES.length,
  tcmPattern: TCM_PATTERN_RULES.length,
  painSeverity: PAIN_SEVERITY_RULES.length,
  chronicity: CHRONICITY_RULES.length,
  insurance: INSURANCE_RULES.length,
  contraindication: CONTRAINDICATION_RULES.length,
  bodyPart: BODY_PART_RULES.length,
  followup: FOLLOWUP_RULES.length,
  totalRules: ALL_LOGIC_RULES.length
}
