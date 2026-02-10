/**
 * Correction Generator - 使用标准 SOAP 生成器
 * 基于检测到的错误，调用 exportSOAPAsText 生成修正后的完整 SOAP 文本
 */

import type { OptumNoteDocument, VisitRecord } from '../types'
import type { CheckError, CorrectionItem, FieldFix } from './types'
import { bridgeToContext, bridgeVisitToSOAPNote } from './bridge'
import { exportSOAPAsText } from '../../../src/generator/soap-generator'
import type { GenerationContext } from '../../../src/types'
import { severityFromPain, expectedTenderMinScaleByPain } from '../../../src/shared/severity'

// ============ 辅助函数 ============

function parsePainCurrent(v: VisitRecord): number {
  const ps = v.subjective.painScale as any
  if ('current' in ps && typeof ps.current === 'number') return ps.current
  if ('range' in ps && ps.range && typeof ps.range.max === 'number') return ps.range.max
  if ('value' in ps && typeof ps.value === 'number') return ps.value
  return 7
}

// ============ 修正计算 ============

function computeFixes(visit: VisitRecord, prevVisit: VisitRecord | undefined, errors: CheckError[]): FieldFix[] {
  const fixes: FieldFix[] = []
  const pain = parsePainCurrent(visit)

  for (const error of errors) {
    switch (error.ruleId) {
      case 'IE01':
      case 'TX01': {
        const correctedSeverity = severityFromPain(pain)
        fixes.push({
          field: 'adlDifficultyLevel',
          original: error.actual,
          corrected: correctedSeverity,
          reason: `Pain=${pain} 应对应 ${correctedSeverity} 严重程度`
        })
        break
      }

      case 'IE02':
      case 'TX02': {
        const minTender = expectedTenderMinScaleByPain(pain)
        fixes.push({
          field: 'tenderness',
          original: error.actual,
          corrected: `+${minTender}`,
          reason: `Pain=${pain} 应对应 +${minTender} tenderness`
        })
        break
      }

      case 'TX03': {
        fixes.push({
          field: 'symptomChange',
          original: error.actual,
          corrected: error.expected,
          reason: '基于疼痛变化趋势修正'
        })
        break
      }

      case 'TX04': {
        fixes.push({
          field: 'progressReason',
          original: error.actual,
          corrected: error.expected,
          reason: '修正进展原因以匹配状态'
        })
        break
      }

      case 'IE03': {
        fixes.push({
          field: 'electricalStimulation',
          original: 'true',
          corrected: 'false',
          reason: 'Pacemaker 禁忌电刺激'
        })
        break
      }

      case 'TX05': {
        fixes.push({
          field: 'tonguePulse',
          original: error.actual,
          corrected: error.expected,
          reason: 'TX 舌脉应与 IE 基线一致'
        })
        break
      }

      case 'TX06': {
        fixes.push({
          field: 'goals',
          original: 'present',
          corrected: 'removed',
          reason: 'TX 不应携带 short/long term goals'
        })
        break
      }
    }
  }

  return fixes
}

// ============ 应用修正到 Context ============

function applyFixesToContext(
  context: GenerationContext,
  visit: VisitRecord,
  fixes: FieldFix[]
): GenerationContext {
  const updatedContext = { ...context }

  for (const fix of fixes) {
    switch (fix.field) {
      case 'adlDifficultyLevel':
        updatedContext.severityLevel = fix.corrected as any
        break
      case 'electricalStimulation':
        // 这个在 plan 中处理，context 已有 hasPacemaker 标记
        break
      // 其他修正在 visitState 中处理
    }
  }

  return updatedContext
}

// ============ 生成修正后的 SOAP 文本 ============

function generateCorrectedSOAP(
  document: OptumNoteDocument,
  visit: VisitRecord,
  visitIndex: number,
  fixes: FieldFix[]
): string {
  // 1. 从 document 构建 context
  const ieIndex = document.visits.findIndex(v => v.subjective.visitType === 'INITIAL EVALUATION')
  const context = bridgeToContext(document, ieIndex)

  // 2. 应用修正
  const correctedContext = applyFixesToContext(context, visit, fixes)

  // 3. 判断是 IE 还是 TX
  const isIE = visit.subjective.visitType === 'INITIAL EVALUATION'

  if (isIE) {
    // IE: 直接调用标准生成器（不需要 visitState）
    correctedContext.noteType = 'IE'
    return exportSOAPAsText(correctedContext)
  } else {
    // TX: 需要从 visit 构建 visitState
    correctedContext.noteType = 'TX'

    // 从 VisitRecord 提取 visitState 关键字段
    const visitState = {
      visitIndex,
      progress: 0.5, // 简化处理
      painScaleCurrent: parsePainCurrent(visit),
      painScaleLabel: String(parsePainCurrent(visit)),
      severityLevel: correctedContext.severityLevel,
      symptomChange: fixes.find(f => f.field === 'symptomChange')?.corrected || 'improvement of symptom(s)',
      reasonConnector: 'because of',
      reason: fixes.find(f => f.field === 'progressReason')?.corrected || 'maintain regular treatments',
      associatedSymptom: 'soreness',
      painFrequency: visit.subjective.painFrequency || 'Frequent',
      generalCondition: 'good',
      treatmentFocus: 'focus',
      tightnessGrading: visit.objective.tightnessMuscles?.gradingScale || 'moderate',
      tendernessGrading: visit.objective.tendernessMuscles?.scaleDescription || '(+2) = Patient states that the area is moderately tender',
      spasmGrading: visit.objective.spasmMuscles?.scaleDescription || '(+2)=Occasional spontaneous spasms',
      needlePoints: visit.plan.acupoints || ['LI4', 'LI11', 'GB34'],
      tonguePulse: visit.objective.tonguePulse || { tongue: 'pale', pulse: 'thready' },
      objectiveFactors: {
        sessionGapDays: 3,
        sleepLoad: 0.5,
        workloadLoad: 0.5,
        weatherExposureLoad: 0.3,
        adherenceLoad: 0.2
      },
      soaChain: {
        subjective: {
          painChange: 'improved' as const,
          adlChange: 'improved' as const,
          frequencyChange: 'stable' as const
        },
        objective: {
          tightnessTrend: 'reduced' as const,
          tendernessTrend: 'reduced' as const,
          romTrend: 'improved' as const,
          strengthTrend: 'improved' as const
        },
        assessment: {
          present: 'improvement of symptom(s).',
          patientChange: 'decreased',
          whatChanged: 'pain',
          physicalChange: 'reduced',
          findingType: 'local muscles tightness'
        }
      }
    }

    // 调用标准生成器
    return exportSOAPAsText(correctedContext, visitState as any)
  }
}

// ============ 标记修正 ============

function addCorrectionMarkers(soapText: string, fixes: FieldFix[]): string {
  if (fixes.length === 0) return soapText

  let annotatedText = soapText

  for (const fix of fixes) {
    if (fix.original === fix.corrected) continue

    const lines = annotatedText.split('\n')
    const correctedLower = fix.corrected.toLowerCase()

    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase()
      if (lineLower.includes(correctedLower)) {
        if (!lines[i].includes('[CORRECTED:')) {
          lines[i] = `${lines[i]} [CORRECTED: was "${fix.original}"]`
        }
        break
      }
    }

    annotatedText = lines.join('\n')
  }

  return annotatedText
}

// ============ 主导出函数 ============

export function generateCorrections(document: OptumNoteDocument, errors: CheckError[]): CorrectionItem[] {
  const corrections: CorrectionItem[] = []
  const visits = document.visits

  // 按 visit 分组错误
  const errorsByVisit = new Map<number, CheckError[]>()
  for (const error of errors) {
    const idx = error.visitIndex
    if (!errorsByVisit.has(idx)) {
      errorsByVisit.set(idx, [])
    }
    errorsByVisit.get(idx)!.push(error)
  }

  // 为每个有错误的 visit 生成完整的修正后 SOAP
  for (const [visitIndex, visitErrors] of Array.from(errorsByVisit.entries())) {
    const visit = visits[visitIndex]
    if (!visit) continue

    const prevVisit = visitIndex > 0 ? visits[visitIndex - 1] : undefined

    // 计算所有修正（不按 section 分组）
    const fieldFixes = computeFixes(visit, prevVisit, visitErrors)

    // 使用标准生成器生成完整的修正后 SOAP
    const correctedFullText = generateCorrectedSOAP(document, visit, visitIndex, fieldFixes)

    // 添加修正标记
    const correctedAnnotatedText = addCorrectionMarkers(correctedFullText, fieldFixes)

    // 生成单个修正项（包含完整 SOAP，不再按 section 分割）
    corrections.push({
      visitDate: visit.assessment.date || '',
      visitIndex,
      section: 'S', // 标记为 S，但实际包含完整 SOAP
      errors: visitErrors,
      fieldFixes,
      correctedFullText,
      correctedAnnotatedText
    })
  }

  return corrections
}
