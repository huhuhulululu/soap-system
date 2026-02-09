/**
 * SOAP 笔记验证器
 * 验证SOAP笔记的完整性和一致性
 */

import type {
  SOAPNote,
  ValidationResult,
  ValidationIssue,
  InsuranceType
} from '../types'
import { TCM_PATTERNS } from '../knowledge/tcm-patterns'

/**
 * 保险类型的CPT代码规则
 */
const INSURANCE_CPT_RULES: Record<InsuranceType, {
  allowedCodes: string[]
  maxUnits: Record<string, number>
  requiresElectricalStim: boolean
}> = {
  'NONE': {
    allowedCodes: ['97810', '97811', '97813', '97814'],
    maxUnits: { '97810': 1, '97811': 3, '97813': 1, '97814': 3 },
    requiresElectricalStim: false
  },
  'HF': {
    allowedCodes: ['97810'],
    maxUnits: { '97810': 1 },
    requiresElectricalStim: false
  },
  'OPTUM': {
    allowedCodes: ['97810'],
    maxUnits: { '97810': 1 },
    requiresElectricalStim: false
  },
  'WC': {
    allowedCodes: ['97810', '97811', '97813', '97814'],
    maxUnits: { '97810': 1, '97811': 3, '97813': 1, '97814': 3 },
    requiresElectricalStim: false
  },
  'VC': {
    allowedCodes: ['97810', '97811', '97813', '97814'],
    maxUnits: { '97810': 1, '97811': 3, '97813': 1, '97814': 3 },
    requiresElectricalStim: false
  },
  'ELDERPLAN': {
    allowedCodes: ['97810', '97811', '97813', '97814'],
    maxUnits: { '97810': 1, '97811': 3, '97813': 1, '97814': 3 },
    requiresElectricalStim: false
  }
}

/**
 * 验证 Subjective 部分
 */
function validateSubjective(note: SOAPNote): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // 检查必填字段
  if (!note.subjective.chronicityLevel) {
    issues.push({
      code: 'S001',
      severity: 'ERROR',
      message: '缺少慢性程度 (Acute/Sub Acute/Chronic)',
      field: 'subjective.chronicityLevel',
      section: 'S'
    })
  }

  if (!note.subjective.primaryBodyPart?.bodyPart) {
    issues.push({
      code: 'S002',
      severity: 'ERROR',
      message: '缺少主要疼痛部位',
      field: 'subjective.primaryBodyPart',
      section: 'S'
    })
  }

  if (!note.subjective.painTypes || note.subjective.painTypes.length === 0) {
    issues.push({
      code: 'S003',
      severity: 'ERROR',
      message: '缺少疼痛类型描述',
      field: 'subjective.painTypes',
      section: 'S'
    })
  }

  // 疼痛评分验证
  const { worst, best, current } = note.subjective.painScale
  if (worst < current) {
    issues.push({
      code: 'S004',
      severity: 'ERROR',
      message: '最差疼痛评分不能小于当前评分',
      field: 'subjective.painScale',
      section: 'S',
      suggestion: `建议: worst >= current (当前 worst=${worst}, current=${current})`
    })
  }

  if (best > current) {
    issues.push({
      code: 'S005',
      severity: 'WARNING',
      message: '最佳疼痛评分通常不应大于当前评分',
      field: 'subjective.painScale',
      section: 'S'
    })
  }

  if (worst > 10 || best > 10 || current > 10) {
    issues.push({
      code: 'S006',
      severity: 'ERROR',
      message: '疼痛评分必须在0-10之间',
      field: 'subjective.painScale',
      section: 'S'
    })
  }

  // ADL困难度与疼痛评分一致性
  const painLevel = current
  const adlLevel = note.subjective.adlDifficulty?.level

  if (painLevel >= 8 && adlLevel && !['severe', 'moderate to severe'].includes(adlLevel)) {
    issues.push({
      code: 'S007',
      severity: 'WARNING',
      message: '高疼痛评分(8+)通常对应severe或moderate to severe的ADL困难度',
      field: 'subjective.adlDifficulty.level',
      section: 'S',
      suggestion: `当前疼痛${painLevel}/10，建议ADL困难度为severe或moderate to severe`
    })
  }

  return issues
}

/**
 * 验证 Objective 部分
 */
function validateObjective(note: SOAPNote): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // 检查肌肉测试
  if (!note.objective.muscleTesting.tightness.muscles?.length) {
    issues.push({
      code: 'O001',
      severity: 'ERROR',
      message: '缺少肌肉紧张度测试',
      field: 'objective.muscleTesting.tightness',
      section: 'O'
    })
  }

  if (!note.objective.muscleTesting.tenderness.muscles?.length) {
    issues.push({
      code: 'O002',
      severity: 'ERROR',
      message: '缺少肌肉压痛测试',
      field: 'objective.muscleTesting.tenderness',
      section: 'O'
    })
  }

  // 检查ROM评估
  if (!note.objective.rom || note.objective.rom.length === 0) {
    issues.push({
      code: 'O003',
      severity: 'ERROR',
      message: '缺少ROM活动度评估',
      field: 'objective.rom',
      section: 'O'
    })
  }

  // 检查舌脉
  if (!note.objective.tonguePulse?.tongue) {
    issues.push({
      code: 'O004',
      severity: 'WARNING',
      message: '缺少舌象描述',
      field: 'objective.tonguePulse.tongue',
      section: 'O'
    })
  }

  if (!note.objective.tonguePulse?.pulse) {
    issues.push({
      code: 'O005',
      severity: 'WARNING',
      message: '缺少脉象描述',
      field: 'objective.tonguePulse.pulse',
      section: 'O'
    })
  }

  return issues
}

/**
 * 验证 Assessment 部分 - TCM 一致性
 */
function validateAssessment(note: SOAPNote): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const { localPattern, systemicPattern } = note.assessment.tcmDiagnosis

  // 检查证型是否存在
  if (!TCM_PATTERNS[localPattern]) {
    issues.push({
      code: 'A001',
      severity: 'ERROR',
      message: `未知的局部证型: ${localPattern}`,
      field: 'assessment.tcmDiagnosis.localPattern',
      section: 'A',
      suggestion: `有效的局部证型: ${Object.keys(TCM_PATTERNS).filter(k => TCM_PATTERNS[k].type === 'local').join(', ')}`
    })
  }

  if (systemicPattern && !TCM_PATTERNS[systemicPattern]) {
    issues.push({
      code: 'A002',
      severity: 'ERROR',
      message: `未知的整体证型: ${systemicPattern}`,
      field: 'assessment.tcmDiagnosis.systemicPattern',
      section: 'A',
      suggestion: `有效的整体证型: ${Object.keys(TCM_PATTERNS).filter(k => TCM_PATTERNS[k].type === 'systemic').join(', ')}`
    })
  }

  // 验证舌象与证型一致性
  const pattern = TCM_PATTERNS[localPattern]
  if (pattern && note.objective.tonguePulse?.tongue) {
    const tongue = note.objective.tonguePulse.tongue.toLowerCase()
    const matchesTongue = pattern.tongue.some(t => tongue.includes(t.toLowerCase()))

    if (!matchesTongue) {
      issues.push({
        code: 'A003',
        severity: 'WARNING',
        message: `舌象 "${note.objective.tonguePulse.tongue}" 与证型 "${localPattern}" 不完全匹配`,
        field: 'objective.tonguePulse.tongue',
        section: 'A',
        suggestion: `${localPattern}证型常见舌象: ${pattern.tongue.join(', ')}`
      })
    }
  }

  // 验证脉象与证型一致性
  if (pattern && note.objective.tonguePulse?.pulse) {
    const pulse = note.objective.tonguePulse.pulse.toLowerCase()
    const matchesPulse = pattern.pulse.some(p => pulse.includes(p.toLowerCase()))

    if (!matchesPulse) {
      issues.push({
        code: 'A004',
        severity: 'WARNING',
        message: `脉象 "${note.objective.tonguePulse.pulse}" 与证型 "${localPattern}" 不完全匹配`,
        field: 'objective.tonguePulse.pulse',
        section: 'A',
        suggestion: `${localPattern}证型常见脉象: ${pattern.pulse.join(', ')}`
      })
    }
  }

  // 验证治则与证型一致性
  if (pattern && note.assessment.treatmentPrinciples?.focusOn) {
    const focusOn = note.assessment.treatmentPrinciples.focusOn.toLowerCase()
    const matchesPrinciple = pattern.treatmentPrinciples.some(p =>
      focusOn.includes(p.toLowerCase()) || p.toLowerCase().includes(focusOn)
    )

    if (!matchesPrinciple) {
      issues.push({
        code: 'A005',
        severity: 'WARNING',
        message: `治则 "${note.assessment.treatmentPrinciples.focusOn}" 与证型 "${localPattern}" 可能不匹配`,
        field: 'assessment.treatmentPrinciples.focusOn',
        section: 'A',
        suggestion: `${localPattern}证型推荐治则: ${pattern.treatmentPrinciples.join(', ')}`
      })
    }
  }

  return issues
}

/**
 * 验证 Plan 部分
 */
function validatePlan(note: SOAPNote): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const insuranceRules = INSURANCE_CPT_RULES[note.header.insuranceType]

  // IE必须有完整的治疗目标
  if (note.header.noteType === 'IE') {
    if (!note.plan.shortTermGoal) {
      issues.push({
        code: 'P001',
        severity: 'ERROR',
        message: 'IE笔记必须包含短期治疗目标',
        field: 'plan.shortTermGoal',
        section: 'P'
      })
    }

    if (!note.plan.longTermGoal) {
      issues.push({
        code: 'P002',
        severity: 'ERROR',
        message: 'IE笔记必须包含长期治疗目标',
        field: 'plan.longTermGoal',
        section: 'P'
      })
    }
  }

  // 验证针刺时间与保险类型一致性
  const needleTime = note.plan.needleProtocol?.totalTime
  if (needleTime) {
    if (['HF', 'OPTUM'].includes(note.header.insuranceType)) {
      if (needleTime !== 15) {
        issues.push({
          code: 'P003',
          severity: 'ERROR',
          message: `${note.header.insuranceType}保险仅支持15分钟单次针刺(97810)`,
          field: 'plan.needleProtocol.totalTime',
          section: 'P',
          suggestion: '应使用15分钟单次针刺协议'
        })
      }
    } else {
      if (needleTime < 60 && needleTime !== 15) {
        issues.push({
          code: 'P004',
          severity: 'WARNING',
          message: '全代码保险建议使用60分钟完整针刺协议',
          field: 'plan.needleProtocol.totalTime',
          section: 'P'
        })
      }
    }
  }

  // 验证CPT代码
  for (const proc of note.procedureCodes) {
    if (!insuranceRules.allowedCodes.includes(proc.cpt)) {
      issues.push({
        code: 'P005',
        severity: 'ERROR',
        message: `CPT代码 ${proc.cpt} 不被 ${note.header.insuranceType} 保险支持`,
        field: 'procedureCodes',
        section: 'P',
        suggestion: `支持的代码: ${insuranceRules.allowedCodes.join(', ')}`
      })
    }

    const maxUnits = insuranceRules.maxUnits[proc.cpt]
    if (maxUnits && proc.units > maxUnits) {
      issues.push({
        code: 'P006',
        severity: 'ERROR',
        message: `CPT代码 ${proc.cpt} 的单位数 ${proc.units} 超过最大允许值 ${maxUnits}`,
        field: 'procedureCodes',
        section: 'P'
      })
    }
  }

  return issues
}

/**
 * 完整验证 SOAP 笔记
 */
export function validateSOAPNote(note: SOAPNote): ValidationResult {
  const allIssues: ValidationIssue[] = [
    ...validateSubjective(note),
    ...validateObjective(note),
    ...validateAssessment(note),
    ...validatePlan(note)
  ]

  const errors = allIssues.filter(i => i.severity === 'ERROR')
  const warnings = allIssues.filter(i => i.severity === 'WARNING')
  const info = allIssues.filter(i => i.severity === 'INFO')

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    info
  }
}

/**
 * 格式化验证结果为可读文本
 */
export function formatValidationResult(result: ValidationResult): string {
  let output = ''

  if (result.isValid) {
    output += '✅ 验证通过\n\n'
  } else {
    output += '❌ 验证失败\n\n'
  }

  if (result.errors.length > 0) {
    output += '🔴 错误:\n'
    for (const error of result.errors) {
      output += `  [${error.code}] ${error.message}\n`
      if (error.suggestion) {
        output += `      💡 ${error.suggestion}\n`
      }
    }
    output += '\n'
  }

  if (result.warnings.length > 0) {
    output += '🟡 警告:\n'
    for (const warning of result.warnings) {
      output += `  [${warning.code}] ${warning.message}\n`
      if (warning.suggestion) {
        output += `      💡 ${warning.suggestion}\n`
      }
    }
    output += '\n'
  }

  if (result.info.length > 0) {
    output += '🔵 信息:\n'
    for (const info of result.info) {
      output += `  [${info.code}] ${info.message}\n`
    }
  }

  return output
}
