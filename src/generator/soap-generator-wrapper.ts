/**
 * soap-generator 包装层
 * IE 路径：重新拼接（Plan 全新生成），Subjective 仅 1 处 Pain Scale 替换
 * TX 路径：完全透传
 */
import type { GenerationContext, SOAPNote } from '../types'
import type { TXVisitState, TXSequenceOptions } from './tx-sequence-engine'
import type { TXSeriesTextItem } from './soap-generator'
import {
  generateSubjective as _generateSubjective,
  generateObjective,
  generateAssessment,
  generateSubjectiveTX,
  generateAssessmentTX,
  generatePlanTX,
  generateNeedleProtocol,
  generateSOAPNote as _generateSOAPNote,
  exportSOAPAsText as _exportSOAPAsText,
  exportTXSeriesAsText as _exportTXSeriesAsText,
} from './soap-generator'
import { calculateDynamicGoals, calculateIEPainScale, parsePainFromSeverity } from './goals-calculator'

// ===== Subjective：仅 1 处 Pain Scale 替换 =====

const PAIN_SCALE_PATTERNS: Record<string, RegExp> = {
  SHOULDER: /Pain Scale: Worst: 7 ; Best: 6 ; Current: 7-6/,
  DEFAULT:  /Pain Scale: Worst: 8 ; Best: 6 ; Current: 8/,
}

function patchSubjective(text: string, context: GenerationContext): string {
  if (context.noteType !== 'IE') return text
  const painScale = calculateIEPainScale(context.severityLevel, context.primaryBodyPart)
  const replacement = `Pain Scale: Worst: ${painScale.worst} ; Best: ${painScale.best} ; Current: ${painScale.current}`
  const pattern = PAIN_SCALE_PATTERNS[context.primaryBodyPart] || PAIN_SCALE_PATTERNS['DEFAULT']
  return text.replace(pattern, replacement)
}

// ===== Plan IE：全新生成，零文本替换 =====

function generateDynamicPlanIE(context: GenerationContext): string {
  const bp = context.primaryBodyPart
  const goals = calculateDynamicGoals(context.severityLevel, bp)
  const formatTightLT = (level: string) => level.replace(/ to /g, '-')

  let plan = `Initial Evaluation - Personal one on one contact with the patient (total 20-30 mins)\n`
  plan += `1. Greeting patient.\n`
  plan += `2. Detail explanation from patient of past medical history and current symptom.\n`
  plan += `3. Initial evaluation examination of the patient current condition.\n`
  plan += `4. Explanation with patient for medical decision/treatment plan.\n\n`

  plan += `Short Term Goal (RELIEF TREATMENT FREQUENCY: 12 treatments in 5-6 weeks):\n`

  if (bp === 'KNEE' || bp === 'SHOULDER' || bp === 'LBP' || bp === 'NECK') {
    plan += `Decrease Pain Scale to${goals.pain.st}.\n`
    plan += `Decrease soreness sensation Scale to ${goals.soreness.st}\n`
    plan += `Decrease Muscles Tightness to ${goals.tightness.st}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.st}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.st}\n`
    plan += `Increase Muscles Strength to${goals.strength.st}\n\n`
  } else {
    plan += `Decrease Pain Scale to ${goals.pain.st}.\n`
    plan += `Decrease soreness sensation Scale to 50%\n`
    plan += `Decrease Muscles Tightness to ${goals.tightness.st}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.st}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.st}\n`
    plan += `Increase Muscles Strength to ${goals.strength.st}\n\n`
  }

  plan += `Long Term Goal (ADDITIONAL MAINTENANCE & SUPPORTING TREATMENTS FREQUENCY: 8 treatments in 5-6 weeks):\n`

  if (bp === 'KNEE' || bp === 'SHOULDER' || bp === 'LBP' || bp === 'NECK') {
    plan += `Decrease Pain Scale to${goals.pain.lt}\n`
    plan += `Decrease soreness sensation Scale to ${goals.soreness.lt}\n`
    plan += `Decrease Muscles Tightness to ${formatTightLT(goals.tightness.lt)}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.lt}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.lt}\n`
    plan += `Increase Muscles Strength to${goals.strength.lt}\n`
    plan += `Increase ROM 60%\n`
    plan += `Decrease impaired Activities of Daily Living to ${formatTightLT(goals.tightness.lt)}.`
  } else {
    plan += `Decrease Pain Scale to ${goals.pain.lt}\n`
    plan += `Decrease soreness sensation Scale to 30%\n`
    plan += `Decrease Muscles Tightness to ${formatTightLT(goals.tightness.lt)}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.lt}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.lt}\n`
    plan += `Increase Muscles Strength to ${goals.strength.lt}\n`
    plan += `Increase ROM 60%\n`
    plan += `Decrease impaired Activities of Daily Living to ${formatTightLT(goals.tightness.lt)}.`
  }

  return plan
}

// ===== SOAPNote 结构体修补 =====

function patchSOAPNote(note: SOAPNote, context: GenerationContext): SOAPNote {
  if (context.noteType !== 'IE') return note
  const painScale = calculateIEPainScale(context.severityLevel, context.primaryBodyPart)
  const goals = calculateDynamicGoals(context.severityLevel, context.primaryBodyPart)

  note.subjective.painScale = {
    worst: parseInt(painScale.worst) || 8,
    best: parseInt(painScale.best) || 6,
    current: parsePainFromSeverity(context.severityLevel),
  }
  note.plan.shortTermGoal.painScaleTarget = goals.pain.st
  note.plan.longTermGoal.painScaleTarget = goals.pain.lt
  return note
}

// ===== 导出函数 =====

export function generateSubjective(context: GenerationContext): string {
  return patchSubjective(_generateSubjective(context), context)
}

export function generatePlanIE(context: GenerationContext): string {
  return generateDynamicPlanIE(context)
}

export function generateSOAPNote(context: GenerationContext): SOAPNote {
  return patchSOAPNote(_generateSOAPNote(context), context)
}

export function exportSOAPAsText(context: GenerationContext, visitState?: TXVisitState): string {
  if (context.noteType === 'TX') {
    return _exportSOAPAsText(context, visitState)
  }
  // IE：重新拼接
  const subjective = patchSubjective(_generateSubjective(context), context)
  const objective = generateObjective(context)
  const assessment = generateAssessment(context)
  const plan = generateDynamicPlanIE(context)
  const needleProtocol = generateNeedleProtocol(context)

  let output = `Subjective\n${subjective}\n\n`
  output += `Objective\n${objective}\n\n`
  output += `Assessment\n${assessment}\n\n`
  output += `Plan\n${plan}\n\n`
  output += needleProtocol
  return output
}

export function exportTXSeriesAsText(
  context: GenerationContext, options: TXSequenceOptions
): TXSeriesTextItem[] {
  return _exportTXSeriesAsText(context, options)
}

// 透传不需要修改的函数
export {
  generateObjective,
  generateAssessment,
  generateSubjectiveTX,
  generateAssessmentTX,
  generatePlanTX,
  generateNeedleProtocol,
} from './soap-generator'
