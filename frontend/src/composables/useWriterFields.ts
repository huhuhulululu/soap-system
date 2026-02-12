/**
 * 编写页字段与规则 composable
 * 从 WriterView 提取：fields 初始化、Field Sets、fieldTag/fieldLabel、getRecommendedOptions
 */
import { reactive } from 'vue'
import { TEMPLATE_ONLY_RULES } from '../../../src/parser/template-logic-rules.ts'

const FIXED_FIELDS = new Set([
  'subjective.chronicityLevel',
  'subjective.adlDifficulty.level',
  'assessment.generalCondition',
  'assessment.treatmentPrinciples.focusOn',
  'objective.muscleTesting.muscles',
  'plan.evaluationType',
  'plan.shortTermGoal.treatmentFrequency',
  'plan.needleProtocol.totalTime',
  'plan.needleProtocol.points',
])

const TX_ONLY_FIELDS = new Set([
  'subjective.symptomChange',
  'subjective.reasonConnector',
  'subjective.reason',
  'subjective.painScale',
])

const REQUIRED_FIELDS = new Set([
  'subjective.painScale.worst', 'subjective.painScale.best', 'subjective.painScale.current',
  'subjective.symptomDuration.value', 'subjective.symptomDuration.unit',
  'subjective.painRadiation', 'subjective.painTypes', 'subjective.associatedSymptoms',
  'subjective.causativeFactors', 'subjective.relievingFactors',
  'subjective.symptomScale', 'subjective.painFrequency',
])

const RULE_FIELDS = new Set([
  'subjective.symptomChange', 'subjective.reasonConnector', 'subjective.reason',
  'subjective.painScale', 'subjective.adlDifficulty.activities',
  'objective.muscleTesting.tightness.gradingScale', 'objective.muscleTesting.tenderness.gradingScale',
  'objective.spasmGrading', 'objective.tonguePulse.tongue', 'objective.tonguePulse.pulse',
  'plan.needleProtocol.electricalStimulation', 'objective.rom.degrees', 'objective.rom.strength',
  'assessment.tcmDiagnosis.localPattern', 'assessment.tcmDiagnosis.systemicPattern',
])

const MERGED_FIELDS = new Set([
  'subjective.painScale.worst', 'subjective.painScale.best', 'subjective.painScale.current',
  'subjective.symptomDuration.value', 'subjective.symptomDuration.unit',
  'subjective.symptomScale',
  'subjective.painFrequency',
])

const DERIVED_FIELDS = new Set([
  'objective.muscleTesting.tightness.gradingScale',
  'objective.muscleTesting.tenderness.gradingScale',
  'objective.spasmGrading',
  'objective.tonguePulse.tongue',
  'objective.tonguePulse.pulse',
  'plan.needleProtocol.electricalStimulation',
])

const MULTI_SELECT_FIELDS = new Set([
  'subjective.painTypes',
  'subjective.associatedSymptoms',
  'subjective.causativeFactors',
  'subjective.relievingFactors',
  'subjective.adlDifficulty.activities',
])

const FIELD_LABELS: Record<string, string> = {
  'subjective.symptomScale': '症状量表',
  'subjective.symptomDuration.value': '病程时长',
  'subjective.symptomDuration.unit': '时长单位',
  'subjective.adlDifficulty.level': 'ADL难度',
  'subjective.adlDifficulty.activities': 'ADL活动',
  'subjective.painScale.worst': '最痛评分',
  'subjective.painScale.best': '最轻评分',
  'subjective.painScale.current': '当前评分',
  'subjective.painFrequency': '疼痛频率',
  'subjective.painRadiation': '放射痛',
  'subjective.associatedSymptoms': '伴随症状',
  'subjective.causativeFactors': '病因',
  'subjective.exacerbatingFactors': '加重因素',
  'subjective.relievingFactors': '缓解因素',
  'subjective.symptomChange': '症状变化',
  'subjective.reasonConnector': '连接词',
  'subjective.reason': '原因',
  'subjective.painScale': '疼痛评分',
  'assessment.tcmDiagnosis.localPattern': '局部证型',
  'assessment.tcmDiagnosis.systemicPattern': '整体证型',
  'subjective.painTypes': '疼痛类型',
  'objective.tonguePulse.tongue': '舌象',
  'objective.tonguePulse.pulse': '脉象',
  'plan.needleProtocol.electricalStimulation': '电刺激',
  'objective.muscleTesting.tightness.gradingScale': '紧张度',
  'objective.muscleTesting.tenderness.gradingScale': '压痛度',
  'objective.spasmGrading': '痉挛度',
  'objective.rom.degrees': 'ROM角度',
  'objective.rom.strength': '肌力',
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k: string) => (o as Record<string, unknown>)?.[k], obj)
}

function fieldTag(fp: string): string {
  if (REQUIRED_FIELDS.has(fp)) return '*'
  if (RULE_FIELDS.has(fp)) return 'R'
  return ''
}

function fieldLabel(path: string): string {
  return FIELD_LABELS[path] || path.split('.').pop()!.replace(/([A-Z])/g, ' $1').trim()
}

function getRecommendedOptions(
  fields: Record<string, unknown>,
  fieldPath: string
): Array<{ option: string; weightChange: number; reason: string }> {
  const recommendations: Array<{ option: string; weightChange: number; reason: string }> = []
  for (const rule of TEMPLATE_ONLY_RULES) {
    const conditionsMet = rule.conditions.every(cond => {
      const val = getNestedValue(fields, cond.field)
      if (cond.operator === 'equals') return val === cond.value
      if (cond.operator === 'gte') return Number(val) >= Number(cond.value)
      if (cond.operator === 'lte') return Number(val) <= Number(cond.value)
      return false
    })
    if (!conditionsMet) continue
    for (const effect of rule.effects) {
      if (effect.targetField === fieldPath) {
        recommendations.push(
          ...effect.options.map(o => ({
            option: o,
            weightChange: effect.weightChange,
            reason: effect.reason,
          }))
        )
      }
    }
  }
  return recommendations.sort((a, b) => b.weightChange - a.weightChange)
}

export function useWriterFields(whitelist: Record<string, string[]>) {
  const fields = reactive<Record<string, string | string[]>>({})

  Object.keys(whitelist).forEach(key => {
    const opts = whitelist[key]
    if (MULTI_SELECT_FIELDS.has(key)) {
      fields[key] = opts.length > 0 ? [opts[0]] : []
    } else {
      fields[key] = Array.isArray(opts) && opts.length > 0 ? opts[0] : ''
    }
  })

  // 默认覆盖
  fields['subjective.symptomDuration.unit'] = 'year(s)'
  fields['subjective.symptomScale'] = '70%-80%'
  fields['subjective.chronicityLevel'] = 'Chronic'
  fields['subjective.adlDifficulty.level'] = 'moderate'
  fields['subjective.painFrequency'] = 'Constant (symptoms occur between 76% and 100% of the time)'

  return {
    fields,
    FIXED_FIELDS,
    TX_ONLY_FIELDS,
    REQUIRED_FIELDS,
    RULE_FIELDS,
    MERGED_FIELDS,
    DERIVED_FIELDS,
    MULTI_SELECT_FIELDS,
    FIELD_LABELS,
    fieldTag,
    fieldLabel,
    getRecommendedOptions: (fieldPath: string) => getRecommendedOptions(fields as unknown as Record<string, unknown>, fieldPath),
    getNestedValue: (obj: Record<string, unknown>, path: string) => getNestedValue(obj, path),
  }
}
