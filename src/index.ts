/**
 * SOAP 系统主入口
 */

// 类型导出
export * from './types'

// 知识库导出
export { TCM_PATTERNS, getLocalPatterns, getSystemicPatterns, getTreatmentPrinciples } from './knowledge/tcm-patterns'

// 解析器导出
export { parseTemplate, extractDropdowns, parseOptions, extractMusclesByBodyPart, extractROMTests } from './parser/dropdown-parser'
export type { ParsedDropdown, TemplateParseResult } from './parser/dropdown-parser'

// 权重系统导出
export {
  calculateWeights,
  selectBestOption,
  selectBestOptions,
  weightPainTypes,
  weightSeverityLevel,
  weightTreatmentPrinciples,
  weightAcupoints,
  weightMuscles,
  weightAdl,
  weightElectricalStimulation,
  weightOperationTime
} from './parser/weight-system'
export type { WeightContext, WeightedOption } from './parser/weight-system'

// 逻辑规则导出
export {
  ALL_LOGIC_RULES,
  ENVIRONMENTAL_CAUSE_RULES,
  LIFESTYLE_CAUSE_RULES,
  TCM_PATTERN_RULES,
  PAIN_SEVERITY_RULES,
  CHRONICITY_RULES,
  INSURANCE_RULES,
  CONTRAINDICATION_RULES,
  BODY_PART_RULES,
  FOLLOWUP_RULES,
  RULE_STATS
} from './parser/logic-rules'
export type { LogicRule, RuleCondition, RuleEffect } from './parser/logic-rules'

// 规则引擎导出
export {
  applyRules,
  aggregateWeights,
  getWeightedOptions,
  selectBestOption as selectBestOptionByRule,
  selectTopOptions,
  generateRuleReport,
  generateFieldWeightDetail,
  createContext
} from './parser/rule-engine'
export type { RuleContext, WeightEffect, FieldWeightMap } from './parser/rule-engine'

// 生成器导出
export {
  generateSOAPNote,
  exportSOAPAsText,
  generateSubjective,
  generateObjective,
  generateAssessment,
  generatePlanIE,
  generateSubjectiveTX,
  generateAssessmentTX,
  generatePlanTX,
  generateNeedleProtocol,
  exportTXSeriesAsText
} from './generator/soap-generator'
export type { TXSeriesTextItem } from './generator/soap-generator'
export { generateTXSequenceStates } from './generator/tx-sequence-engine'
export type { TXSequenceOptions, TXVisitState } from './generator/tx-sequence-engine'

// 验证器导出
export { validateSOAPNote, formatValidationResult } from './validator/soap-validator'
