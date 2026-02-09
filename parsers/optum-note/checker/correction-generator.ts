/**
 * Correction Generator
 * 基于检测到的错误，直接从 VisitRecord 生成修正后的纯文本
 *
 * 设计理念：
 * - 不依赖 soap-generator.ts，避免需要完整的 TXVisitState
 * - 直接从 VisitRecord 读取数据，应用修正值，输出纯文本
 * - 支持所有 7 种修正类型
 */

import type { OptumNoteDocument, VisitRecord, PainScaleDetailed, ROMItem } from '../types'
import type { CheckError, CorrectionItem, FieldFix } from './types'
import { BODY_PART_NAMES, MUSCLE_MAP, ADL_MAP } from '../../../src/generator/soap-generator'
import { severityFromPain, expectedTenderMinScaleByPain, type SeverityLevel } from '../../../src/shared/severity'
import { parseBodyPartString } from './bridge'

// ============ 类型定义 ============

interface FixMap {
  adlDifficultyLevel?: string
  tenderness?: string
  symptomChange?: string
  progressReason?: string
  electricalStimulation?: string
  tonguePulse?: string
  goals?: string
}

// ============ 辅助函数 ============

function parsePainCurrent(v: VisitRecord): number {
  const ps = v.subjective.painScale as PainScaleDetailed | { value?: number; range?: { max: number } }
  // 1. 优先使用 current (详细格式)
  if ('current' in ps && typeof ps.current === 'number') return ps.current
  // 2. 使用 range.max (范围格式)
  if ('range' in ps && ps.range && typeof ps.range.max === 'number') return ps.range.max
  // 3. 使用 value (简单格式)
  if ('value' in ps && typeof ps.value === 'number') return ps.value
  return 5
}

function normalizeBodyPart(bodyPart: string): string {
  const { bodyPart: bp } = parseBodyPartString(bodyPart)
  return bp
}

function formatLaterality(laterality?: string): string {
  if (!laterality || laterality === 'unspecified') return ''
  return laterality + ' '
}

function formatPainTypes(painTypes: string[]): string {
  if (painTypes.length === 0) return 'aching'
  if (painTypes.length === 1) return painTypes[0].toLowerCase()
  return painTypes.map(p => p.toLowerCase()).join(', ')
}

function formatMuscles(muscles: string[]): string {
  if (muscles.length === 0) return ''
  if (muscles.length === 1) return muscles[0]
  if (muscles.length === 2) return muscles.join(' and ')
  return muscles.slice(0, -1).join(', ') + ', and ' + muscles[muscles.length - 1]
}

function formatRomItems(items: ROMItem[]): string {
  return items
    .filter(item => item && typeof item === 'object')
    .map(item =>
      `  ${item.strength ?? 'N/A'} ${item.movement ?? 'N/A'}: ${item.degrees ?? 0}° (${item.severity ?? 'normal'})`
    )
    .join('\n')
}

function formatNeedleSpecs(specs: { gauge: string; length: string }[]): string {
  return specs.map(s => `${s.gauge}x${s.length}`).join(', ')
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
          reason: `Pain=${pain} 应对应至少 +${minTender} 压痛级别`
        })
        break
      }

      case 'T02': {
        fixes.push({
          field: 'symptomChange',
          original: 'improvement of symptom(s)',
          corrected: 'similar symptom(s) as last visit',
          reason: '数值实际恶化，不应标注 improvement'
        })
        break
      }

      case 'T03': {
        fixes.push({
          field: 'symptomChange',
          original: 'exacerbate of symptom(s)',
          corrected: 'similar symptom(s) as last visit',
          reason: '数值实际改善，不应标注 exacerbate'
        })
        break
      }

      case 'T06': {
        const isImprovement = error.message.includes('improvement')
        fixes.push({
          field: 'progressReason',
          original: error.actual,
          corrected: isImprovement ? 'maintain regular treatments' : 'discontinuous treatment',
          reason: '进展状态与原因逻辑应一致'
        })
        break
      }

      case 'T07':
      case 'X4': {
        fixes.push({
          field: 'electricalStimulation',
          original: 'with',
          corrected: 'without',
          reason: 'Pacemaker 患者禁用电刺激'
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

function buildFixMap(fixes: FieldFix[]): FixMap {
  const map: FixMap = {}
  for (const fix of fixes) {
    switch (fix.field) {
      case 'adlDifficultyLevel':
        map.adlDifficultyLevel = fix.corrected
        break
      case 'tenderness':
        map.tenderness = fix.corrected
        break
      case 'symptomChange':
        map.symptomChange = fix.corrected
        break
      case 'progressReason':
        map.progressReason = fix.corrected
        break
      case 'electricalStimulation':
        map.electricalStimulation = fix.corrected
        break
      case 'tonguePulse':
        map.tonguePulse = fix.corrected
        break
      case 'goals':
        map.goals = fix.corrected
        break
    }
  }
  return map
}

// ============ 段落格式化函数 ============

function formatSubjectiveText(visit: VisitRecord, fixes: FixMap, ieVisit?: VisitRecord): string {
  const s = visit.subjective
  const isIE = s.visitType === 'INITIAL EVALUATION'
  const lines: string[] = []

  lines.push('=== SUBJECTIVE ===')
  lines.push('')

  lines.push(`Visit Type: ${s.visitType}`)
  lines.push('')

  const bodyPartNorm = normalizeBodyPart(s.bodyPartNormalized || s.bodyPart)
  const bodyPartDisplay = BODY_PART_NAMES[bodyPartNorm] || s.bodyPart
  const lateralityStr = formatLaterality(s.laterality)
  const painTypes = formatPainTypes(s.painTypes)

  if (isIE) {
    // IE Subjective
    lines.push(`Chief Complaint: Patient c/o ${s.chronicityLevel.toLowerCase()} pain ${lateralityStr}${bodyPartDisplay} which is ${painTypes}.`)
    lines.push('')

    if (s.radiation) {
      lines.push('Radiation: Pain radiates to surrounding areas.')
    } else {
      lines.push('Radiation: No radiation reported.')
    }
    lines.push('')

    // Pain Scale
    const ps = s.painScale as PainScaleDetailed
    if ('worst' in ps) {
      const bestDisplay = typeof ps.best === 'number'
        ? ps.best
        : (ps.best && typeof ps.best === 'object' && 'min' in ps.best && 'max' in ps.best
            ? `${ps.best.min}-${ps.best.max}`
            : '0')
      lines.push(`Pain Scale: Worst ${ps.worst}/10, Best ${bestDisplay}/10, Current ${ps.current}/10`)
    } else {
      const simple = s.painScale as { value?: number }
      lines.push(`Pain Scale: ${simple.value || 7}/10`)
    }
    lines.push('')

    // Pain Frequency
    lines.push(`Pain Frequency: ${s.painFrequency} (${s.painFrequencyRange} of day)`)
    lines.push('')

    // ADL Impairment - 应用修正
    const adlSeverity = fixes.adlDifficultyLevel || s.adlDifficultyLevel || 'moderate'
    const adlText = s.adlImpairment || ''
    if (adlText) {
      // 应用修正后的严重程度到原始描述
      const correctedAdl = adlText.replace(
        /(mild|moderate|severe)(\s+to\s+(mild|moderate|severe))?\s+difficulty/i,
        `${adlSeverity} difficulty`
      )
      lines.push(`ADL Impairment: ${correctedAdl}`)
    } else {
      // 回退到模板
      const adlActivities = ADL_MAP[bodyPartNorm] || ADL_MAP['LBP']
      lines.push(`ADL Impairment: Patient reports ${adlSeverity} difficulty with:`)
      for (const activity of adlActivities.slice(0, 4)) {
        lines.push(`  - ${activity}`)
      }
    }
    lines.push('')

    // Muscle Weakness
    lines.push(`Muscle Weakness: ${s.muscleWeaknessScale}`)
    lines.push('')

    // Medical History
    if (s.medicalHistory && s.medicalHistory.length > 0) {
      lines.push(`Medical History: ${s.medicalHistory.join(', ')}`)
    }

    // Walking Aid
    if (s.walkingAid) {
      lines.push(`Walking Aid: ${s.walkingAid}`)
    }
  } else {
    // TX Subjective
    const progressStatus = fixes.symptomChange || 'improvement of symptom(s)'
    const progressReason = fixes.progressReason || 'maintain regular treatments'

    lines.push(`Chief Complaint: Patient reports: there is ${progressStatus} because of ${progressReason}.`)
    lines.push('')

    // Pain Scale
    const psTx = s.painScale as PainScaleDetailed
    if ('worst' in psTx) {
      const bestDisplayTx = typeof psTx.best === 'number'
        ? psTx.best
        : (psTx.best && typeof psTx.best === 'object' && 'min' in psTx.best && 'max' in psTx.best
            ? `${psTx.best.min}-${psTx.best.max}`
            : '0')
      lines.push(`Pain Scale: Worst ${psTx.worst}/10, Best ${bestDisplayTx}/10, Current ${psTx.current}/10`)
    } else {
      const simple = s.painScale as { value?: number }
      lines.push(`Pain Scale: ${simple.value || 7}/10`)
    }
    lines.push('')

    // Pain Frequency
    lines.push(`Pain Frequency: ${s.painFrequency} (${s.painFrequencyRange} of day)`)
    lines.push('')

    // ADL Impairment - 应用修正
    const adlSeverityTx = fixes.adlDifficultyLevel || s.adlDifficultyLevel || 'moderate'
    const adlTextTx = s.adlImpairment || ''
    if (adlTextTx) {
      // 应用修正后的严重程度到原始描述
      const correctedAdl = adlTextTx.replace(
        /(mild|moderate|severe)(\s+to\s+(mild|moderate|severe))?\s+difficulty/i,
        `${adlSeverityTx} difficulty`
      )
      lines.push(`ADL Impairment: ${correctedAdl}`)
    } else {
      // 回退到模板
      const adlActivities = ADL_MAP[bodyPartNorm] || ADL_MAP['LBP']
      lines.push(`ADL Impairment: Patient reports ${adlSeverityTx} difficulty with:`)
      for (const activity of adlActivities.slice(0, 3)) {
        lines.push(`  - ${activity}`)
      }
    }
  }

  return lines.join('\n')
}

function formatObjectiveText(visit: VisitRecord, fixes: FixMap): string {
  const o = visit.objective
  const lines: string[] = []

  lines.push('=== OBJECTIVE ===')
  lines.push('')

  // Inspection
  lines.push(`Inspection: ${o?.inspection ?? 'No abnormalities noted'}`)
  lines.push('')

  // Tightness
  const tightness = o?.tightnessMuscles
  lines.push(`Tightness: ${tightness?.gradingScale ?? 'moderate'} tightness noted in:`)
  lines.push(`  ${formatMuscles(tightness?.muscles ?? [])}`)
  lines.push('')

  // Tenderness - 应用修正
  const tenderness = o?.tendernessMuscles
  const tenderScale = fixes.tenderness || `+${tenderness?.scale ?? 2}`
  lines.push(`Tenderness: ${tenderScale} tenderness noted along:`)
  lines.push(`  ${formatMuscles(tenderness?.muscles ?? [])}`)
  lines.push(`  Scale: ${tenderness?.scaleDescription ?? tenderScale + ' tenderness'}`)
  lines.push('')

  // Spasm
  const spasm = o?.spasmMuscles
  lines.push(`Spasm: +${spasm?.frequencyScale ?? 1} spasm noted in:`)
  lines.push(`  ${formatMuscles(spasm?.muscles ?? [])}`)
  lines.push(`  Scale: ${spasm?.scaleDescription ?? '+' + (spasm?.frequencyScale ?? 1) + ' spasm'}`)
  lines.push('')

  // ROM
  const rom = o?.rom
  lines.push(`ROM (${rom?.bodyPart ?? 'Affected Area'}):`)
  lines.push(formatRomItems(rom?.items ?? []))
  lines.push('')

  // Tongue & Pulse - 应用修正
  const tonguePulse = o?.tonguePulse
  if (fixes.tonguePulse) {
    // 支持对象格式和字符串格式
    let tongue: string
    let pulse: string
    if (typeof fixes.tonguePulse === 'object' && fixes.tonguePulse !== null) {
      // 对象格式 { tongue, pulse }
      const tpObj = fixes.tonguePulse as { tongue?: string; pulse?: string }
      tongue = tpObj.tongue || tonguePulse?.tongue || 'pale'
      pulse = tpObj.pulse || tonguePulse?.pulse || 'thready'
    } else {
      // 字符串格式 "tongue / pulse" 或 "tongue\npulse"
      const tpStr = String(fixes.tonguePulse)
      const parts = tpStr.includes('/') ? tpStr.split('/') : tpStr.split('\n')
      tongue = parts[0]?.trim() || tonguePulse?.tongue || 'pale'
      pulse = parts[1]?.trim() || tonguePulse?.pulse || 'thready'
    }
    lines.push(`Tongue: ${tongue}`)
    lines.push(`Pulse: ${pulse}`)
  } else {
    lines.push(`Tongue: ${tonguePulse?.tongue ?? 'pale, thin white coat'}`)
    lines.push(`Pulse: ${tonguePulse?.pulse ?? 'thready'}`)
  }

  return lines.join('\n')
}

function formatAssessmentText(visit: VisitRecord, fixes: FixMap): string {
  const a = visit.assessment
  const isIE = visit.subjective.visitType === 'INITIAL EVALUATION'
  const lines: string[] = []

  lines.push('=== ASSESSMENT ===')
  lines.push('')

  lines.push(`Date: ${a.date}`)
  lines.push('')

  lines.push(`General Condition: ${a.generalCondition}`)
  lines.push('')

  // Symptom Change - 应用修正
  const symptomChange = fixes.symptomChange || a.symptomChange
  lines.push(`Symptom Change: ${symptomChange}`)
  lines.push('')

  lines.push(`Physical Finding Change: ${a.physicalFindingChange}`)
  lines.push('')

  // TCM Diagnosis (IE only)
  if (isIE && a.tcmDiagnosis) {
    lines.push(`TCM Diagnosis: ${a.tcmDiagnosis.diagnosis}`)
    lines.push(`Pattern: ${a.tcmDiagnosis.pattern}`)
    lines.push(`Treatment Principles: ${a.tcmDiagnosis.treatmentPrinciples}`)
    lines.push('')
  }

  // Current Pattern
  lines.push(`Current Pattern: ${a.currentPattern}`)
  if (a.localPattern) {
    lines.push(`  Local: ${a.localPattern}`)
  }
  if (a.systemicPattern) {
    lines.push(`  Systemic: ${a.systemicPattern}`)
  }

  return lines.join('\n')
}

function formatPlanText(visit: VisitRecord, fixes: FixMap): string {
  const p = visit.plan
  const isIE = visit.subjective.visitType === 'INITIAL EVALUATION'
  const lines: string[] = []

  lines.push('=== PLAN ===')
  lines.push('')

  // Needle Protocol
  lines.push(`Needle Specifications: ${formatNeedleSpecs(p.needleSpecs ?? [])}`)
  lines.push('')

  lines.push(`Treatment Time: ${p.treatmentTime ?? 15} minutes`)
  lines.push(`Treatment Position: ${p.treatmentPosition ?? 'Standard Position'}`)
  lines.push('')

  // Acupoints
  lines.push(`Acupoints: ${(p.acupoints ?? []).join(', ') || 'None specified'}`)
  lines.push('')

  // Electrical Stimulation - 应用修正
  const hasEstim = fixes.electricalStimulation === 'without' ? false : p.electricalStimulation
  lines.push(`Electrical Stimulation: ${hasEstim ? 'With E-Stim' : 'Without E-Stim'}`)
  lines.push('')

  // Treatment Principles
  lines.push(`Treatment Principles: ${p.treatmentPrinciples ?? 'Standard treatment'}`)
  lines.push('')

  // Goals (IE only, respect removal fix)
  if (isIE && fixes.goals !== 'removed') {
    if (p.shortTermGoal) {
      lines.push('Short Term Goal:')
      lines.push(`  Frequency: ${p.shortTermGoal.frequency ?? 'Not specified'}`)
      lines.push(`  Pain Scale Target: ${p.shortTermGoal.painScaleTarget ?? 'Not specified'}`)
      lines.push(`  Sensation Scale Target: ${p.shortTermGoal.sensationScaleTarget ?? 'Not specified'}`)
      lines.push(`  Tightness Target: ${p.shortTermGoal.tightnessTarget ?? 'Not specified'}`)
      lines.push(`  Tenderness Target: ${p.shortTermGoal.tendernessTarget ?? 'Not specified'}`)
      lines.push(`  Spasms Target: ${p.shortTermGoal.spasmsTarget ?? 'Not specified'}`)
      lines.push(`  Strength Target: ${p.shortTermGoal.strengthTarget ?? 'Not specified'}`)
      if (p.shortTermGoal.romTarget) {
        lines.push(`  ROM Target: ${p.shortTermGoal.romTarget}`)
      }
      lines.push('')
    }

    if (p.longTermGoal) {
      lines.push('Long Term Goal:')
      lines.push(`  Frequency: ${p.longTermGoal.frequency ?? 'Not specified'}`)
      lines.push(`  Pain Scale Target: ${p.longTermGoal.painScaleTarget ?? 'Not specified'}`)
      lines.push(`  Sensation Scale Target: ${p.longTermGoal.sensationScaleTarget ?? 'Not specified'}`)
      lines.push(`  Tightness Target: ${p.longTermGoal.tightnessTarget ?? 'Not specified'}`)
      lines.push(`  Tenderness Target: ${p.longTermGoal.tendernessTarget ?? 'Not specified'}`)
      lines.push(`  Spasms Target: ${p.longTermGoal.spasmsTarget ?? 'Not specified'}`)
      lines.push(`  Strength Target: ${p.longTermGoal.strengthTarget ?? 'Not specified'}`)
      lines.push(`  ADL Target: ${p.longTermGoal.adlTarget ?? 'Improved function'}`)
    }
  }

  // Diagnosis Codes (all visits)
  if (visit.diagnosisCodes && visit.diagnosisCodes.length > 0) {
    lines.push('')
    lines.push('Diagnosis Codes:')
    for (const dx of visit.diagnosisCodes) {
      lines.push(`  ${dx.icd10}: ${dx.description}`)
    }
  }

  // Procedure Codes (all visits)
  if (visit.procedureCodes && visit.procedureCodes.length > 0) {
    lines.push('')
    lines.push('Procedure Codes:')
    for (const px of visit.procedureCodes) {
      lines.push(`  ${px.cpt}: ${px.description}`)
    }
  }

  return lines.join('\n')
}

// ============ 段落生成调度 ============

function generateCorrectedSection(
  section: 'S' | 'O' | 'A' | 'P',
  visit: VisitRecord,
  fixes: FixMap,
  ieVisit?: VisitRecord
): string {
  switch (section) {
    case 'S':
      return formatSubjectiveText(visit, fixes, ieVisit)
    case 'O':
      return formatObjectiveText(visit, fixes)
    case 'A':
      return formatAssessmentText(visit, fixes)
    case 'P':
      return formatPlanText(visit, fixes)
    default:
      return '[Unknown section]'
  }
}

// ============ 标记版生成 ============

/**
 * Generate annotated text with [CORRECTED: was "xxx"] markers
 * Appends correction markers at the end of lines containing corrected values
 */
function generateAnnotatedText(correctedFullText: string, fieldFixes: FieldFix[]): string {
  if (fieldFixes.length === 0) return correctedFullText

  let annotatedText = correctedFullText

  for (const fix of fieldFixes) {
    // Skip if original and corrected are the same
    if (fix.original === fix.corrected) continue

    // Find the line containing the corrected value and append marker
    const lines = annotatedText.split('\n')
    const correctedLower = fix.corrected.toLowerCase()

    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase()
      // Check if this line contains the corrected value
      if (lineLower.includes(correctedLower)) {
        // Avoid duplicate markers
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

  // 找到 IE visit 作为基线
  const ieVisit = visits.find(v => v.subjective.visitType === 'INITIAL EVALUATION')

  // 按 visit 分组错误
  const errorsByVisit = new Map<number, CheckError[]>()
  for (const error of errors) {
    const idx = error.visitIndex
    if (!errorsByVisit.has(idx)) {
      errorsByVisit.set(idx, [])
    }
    errorsByVisit.get(idx)!.push(error)
  }

  // 为每个有错误的 visit 生成修正
  for (const [visitIndex, visitErrors] of Array.from(errorsByVisit.entries())) {
    const visit = visits[visitIndex]
    if (!visit) continue

    const prevVisit = visitIndex > 0 ? visits[visitIndex - 1] : undefined

    // 按 section 分组
    const sectionErrors = {
      S: visitErrors.filter(e => e.section === 'S'),
      O: visitErrors.filter(e => e.section === 'O'),
      A: visitErrors.filter(e => e.section === 'A'),
      P: visitErrors.filter(e => e.section === 'P')
    }

    for (const [section, sectionErrorList] of Object.entries(sectionErrors)) {
      if (sectionErrorList.length === 0) continue

      // 计算修正
      const fieldFixes = computeFixes(visit, prevVisit, sectionErrorList)

      // 构建修正映射
      const fixMap = buildFixMap(fieldFixes)

      // 生成修正后的纯文本
      const correctedFullText = generateCorrectedSection(
        section as 'S' | 'O' | 'A' | 'P',
        visit,
        fixMap,
        ieVisit
      )

      // 生成带标记的版本
      const correctedAnnotatedText = generateAnnotatedText(correctedFullText, fieldFixes)

      corrections.push({
        visitDate: visit.assessment.date || '',
        visitIndex,
        section: section as 'S' | 'O' | 'A' | 'P',
        errors: sectionErrorList,
        fieldFixes,
        correctedFullText,
        correctedAnnotatedText
      })
    }
  }

  return corrections
}
