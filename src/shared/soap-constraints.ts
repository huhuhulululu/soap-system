/**
 * Shared SOAP Constraints — Writer 自检规则
 * 从 note-checker.ts 提取的纯验证函数，运行在 TXVisitState + GenerationContext 上
 * 不依赖 PDF 解析，不依赖 VisitRecord 类型
 */

import { severityFromPain, expectedTenderMinScaleByPain } from './severity'
import { isPainTypeConsistentWithPattern, isTonguePatternConsistent } from './tcm-mappings'

// ============ Types ============

export type ConstraintSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM'

export interface ConstraintError {
  ruleId: string
  severity: ConstraintSeverity
  visitIndex: number
  message: string
  expected: string
  actual: string
}

/** Writer 端每个 visit 的结构化数据 (从 TXVisitState 提取) */
export interface VisitSnapshot {
  visitIndex: number
  isIE: boolean
  painScaleCurrent: number
  severityLevel: string
  symptomChange: string
  reason: string
  generalCondition: string
  tightnessGrading: string
  tendernessGrading: string
  spasmGrading: string
  painFrequency: string
  associatedSymptom: string
  needlePoints: string[]
  tonguePulse: { tongue: string; pulse: string }
  electricalStimulation?: boolean
  hasGoals?: boolean
}

/** 从 GenerationContext 提取的不变字段 */
export interface ContextSnapshot {
  painCurrent: number
  localPattern: string
  systemicPattern: string
  painTypes: string[]
  hasPacemaker: boolean
  bodyPart: string
  fixedTonguePulse?: { tongue: string; pulse: string }
}

// ============ Parsers ============

function parseTendernessScale(grading: string): number {
  const m = grading.match(/\+(\d)/)
  return m ? parseInt(m[1], 10) : 2
}

function parseSpasmScale(grading: string): number {
  const m = grading.match(/\+(\d)/)
  return m ? parseInt(m[1], 10) : 2
}

const SEVERITY_RANK: Record<string, number> = {
  mild: 1, 'mild to moderate': 2, moderate: 3, 'moderate to severe': 4, severe: 5,
}

function severityRank(s: string): number {
  return SEVERITY_RANK[s.toLowerCase()] ?? 3
}

const FREQUENCY_RANK: Record<string, number> = {
  intermittent: 0, occasional: 1, frequent: 2, constant: 3,
}

function frequencyRank(f: string): number {
  const lower = f.toLowerCase()
  for (const [key, rank] of Object.entries(FREQUENCY_RANK)) {
    if (lower.includes(key)) return rank
  }
  return 2
}

const SYMPTOM_RANK: Record<string, number> = {
  soreness: 1, stiffness: 2, heaviness: 3, weakness: 4, numbness: 4,
}

// ============ Single-Visit Checks ============

function checkSingleVisit(visit: VisitSnapshot, ctx: ContextSnapshot): ConstraintError[] {
  const errors: ConstraintError[] = []
  const { visitIndex: idx, painScaleCurrent: pain } = visit

  // TX01: pain→severity mapping
  const expectedSev = severityFromPain(pain)
  if (visit.severityLevel !== expectedSev) {
    errors.push({
      ruleId: 'TX01', severity: 'MEDIUM', visitIndex: idx,
      message: `Pain=${pain} 与 severity 不一致`,
      expected: expectedSev, actual: visit.severityLevel,
    })
  }

  // TX02: pain→tenderness mapping
  const minTender = expectedTenderMinScaleByPain(pain)
  const actualTender = parseTendernessScale(visit.tendernessGrading)
  if (actualTender < minTender) {
    errors.push({
      ruleId: 'TX02', severity: 'MEDIUM', visitIndex: idx,
      message: `Tenderness +${actualTender} 低于 pain=${pain} 对应最低值`,
      expected: `>= +${minTender}`, actual: `+${actualTender}`,
    })
  }

  // T07/X4: pacemaker + electrical stimulation
  if (ctx.hasPacemaker && visit.electricalStimulation) {
    errors.push({
      ruleId: 'T07', severity: 'CRITICAL', visitIndex: idx,
      message: 'Pacemaker 禁忌电刺激',
      expected: 'no electrical stimulation', actual: 'with electrical stimulation',
    })
  }

  // S2: moved to checkContext (context-level, runs once)

  // X1: pain→tightness→tenderness chain
  const tightLower = visit.tightnessGrading.toLowerCase()
  if (pain >= 7 && !tightLower.includes('moderate') && !tightLower.includes('severe')) {
    errors.push({
      ruleId: 'X1', severity: 'CRITICAL', visitIndex: idx,
      message: `Pain=${pain} 但 tightness 过低`,
      expected: 'moderate or severe', actual: visit.tightnessGrading,
    })
  }
  if (pain <= 4 && (tightLower.includes('severe') || actualTender > 2)) {
    errors.push({
      ruleId: 'X1', severity: 'CRITICAL', visitIndex: idx,
      message: `Pain=${pain} 但 tightness/tenderness 过高`,
      expected: 'mild tightness, +1~+2 tenderness', actual: `${visit.tightnessGrading}/+${actualTender}`,
    })
  }

  // X3: pattern→tongue/pulse (IE only)
  if (visit.isIE && ctx.localPattern) {
    if (!isTonguePatternConsistent(ctx.localPattern, visit.tonguePulse.tongue, visit.tonguePulse.pulse)) {
      errors.push({
        ruleId: 'X3', severity: 'CRITICAL', visitIndex: idx,
        message: '舌脉与证型不一致',
        expected: `match ${ctx.localPattern}`, actual: `${visit.tonguePulse.tongue} / ${visit.tonguePulse.pulse}`,
      })
    }
  }

  // P2: acupoints count
  if (visit.needlePoints.length === 0 || visit.needlePoints.length > 20) {
    errors.push({
      ruleId: 'P2', severity: 'CRITICAL', visitIndex: idx,
      message: '穴位数量不合理',
      expected: '2-20', actual: String(visit.needlePoints.length),
    })
  }

  // T06: symptomChange + reason logic
  const isImprovement = visit.symptomChange.toLowerCase().includes('improvement')
  const isExacerbate = visit.symptomChange.toLowerCase().includes('exacerbate')
  const negativeReasons = ['skipped', 'discontinuous', 'intense work', 'bad posture', 'cold weather', 'overexertion']
  const positiveReasons = ['maintain regular', 'reduced level', 'energy level', 'improved sleep', 'consistent']
  const reasonLower = visit.reason.toLowerCase()

  if (isImprovement && negativeReasons.some(r => reasonLower.includes(r))) {
    errors.push({
      ruleId: 'T06', severity: 'MEDIUM', visitIndex: idx,
      message: 'improvement 但原因为负向',
      expected: '正向原因', actual: visit.reason,
    })
  }
  if (isExacerbate && positiveReasons.some(r => reasonLower.includes(r))) {
    errors.push({
      ruleId: 'T06', severity: 'MEDIUM', visitIndex: idx,
      message: 'exacerbate 但原因为正向',
      expected: '负向原因', actual: visit.reason,
    })
  }

  return errors
}

// ============ Cross-Visit Sequence Checks ============

function checkSequence(visits: VisitSnapshot[]): ConstraintError[] {
  const errors: ConstraintError[] = []

  for (let i = 1; i < visits.length; i++) {
    const prev = visits[i - 1]
    const cur = visits[i]
    const idx = cur.visitIndex

    // V01: pain monotonic
    if (cur.painScaleCurrent > prev.painScaleCurrent) {
      errors.push({
        ruleId: 'V01', severity: 'HIGH', visitIndex: idx,
        message: '疼痛分值回升',
        expected: `<= ${prev.painScaleCurrent}`, actual: String(cur.painScaleCurrent),
      })
    }

    // V02: tenderness monotonic
    const prevTender = parseTendernessScale(prev.tendernessGrading)
    const curTender = parseTendernessScale(cur.tendernessGrading)
    if (curTender > prevTender) {
      errors.push({
        ruleId: 'V02', severity: 'HIGH', visitIndex: idx,
        message: 'Tenderness 回升',
        expected: `<= +${prevTender}`, actual: `+${curTender}`,
      })
    }

    // V03: tightness monotonic
    const prevTightRank = severityRank(prev.tightnessGrading)
    const curTightRank = severityRank(cur.tightnessGrading)
    if (curTightRank > prevTightRank) {
      errors.push({
        ruleId: 'V03', severity: 'HIGH', visitIndex: idx,
        message: 'Tightness 恶化',
        expected: `<= ${prev.tightnessGrading}`, actual: cur.tightnessGrading,
      })
    }

    // V04: spasm monotonic
    const prevSpasm = parseSpasmScale(prev.spasmGrading)
    const curSpasm = parseSpasmScale(cur.spasmGrading)
    if (curSpasm > prevSpasm) {
      errors.push({
        ruleId: 'V04', severity: 'HIGH', visitIndex: idx,
        message: 'Spasm 回升',
        expected: `<= +${prevSpasm}`, actual: `+${curSpasm}`,
      })
    }

    // V07: frequency monotonic
    const prevFreq = frequencyRank(prev.painFrequency)
    const curFreq = frequencyRank(cur.painFrequency)
    if (curFreq > prevFreq) {
      errors.push({
        ruleId: 'V07', severity: 'MEDIUM', visitIndex: idx,
        message: '疼痛频率增加',
        expected: `<= ${prev.painFrequency}`, actual: cur.painFrequency,
      })
    }

    // V08: removed — redundant with T02 (superset: pain + tenderness + tightness)

    // V09: acupoint overlap >= 0.4
    const prevArr = prev.needlePoints.map(p => p.toLowerCase())
    const curArr = cur.needlePoints.map(p => p.toLowerCase())
    const curSet = new Set(curArr)
    const inter = prevArr.filter(x => curSet.has(x)).length
    const union = new Set(prevArr.concat(curArr)).size
    const overlap = union === 0 ? 1 : inter / union
    if (overlap < 0.4) {
      errors.push({
        ruleId: 'V09', severity: 'HIGH', visitIndex: idx,
        message: '连续 TX 穴位重叠度过低',
        expected: 'overlap >= 0.4', actual: overlap.toFixed(2),
      })
    }

    // T08: ADL severity monotonic (via severityLevel)
    if (severityRank(cur.severityLevel) > severityRank(prev.severityLevel)) {
      errors.push({
        ruleId: 'T08', severity: 'HIGH', visitIndex: idx,
        message: 'ADL severity 恶化',
        expected: `<= ${prev.severityLevel}`, actual: cur.severityLevel,
      })
    }

    // T09: associated symptom rank monotonic
    const prevSymRank = SYMPTOM_RANK[prev.associatedSymptom.toLowerCase()] ?? 0
    const curSymRank = SYMPTOM_RANK[cur.associatedSymptom.toLowerCase()] ?? 0
    if (curSymRank > prevSymRank && prevSymRank > 0) {
      errors.push({
        ruleId: 'T09', severity: 'MEDIUM', visitIndex: idx,
        message: '伴随症状严重程度恶化',
        expected: `<= ${prev.associatedSymptom}`, actual: cur.associatedSymptom,
      })
    }

    // T02: improvement + pain worsened
    if (cur.symptomChange.toLowerCase().includes('improvement')) {
      const painWorsened = cur.painScaleCurrent > prev.painScaleCurrent
      const tenderWorsened = curTender > prevTender
      const tightWorsened = curTightRank > prevTightRank
      if (painWorsened || tenderWorsened || tightWorsened) {
        const indicators: string[] = []
        if (painWorsened) indicators.push(`pain: ${prev.painScaleCurrent}→${cur.painScaleCurrent}`)
        if (tenderWorsened) indicators.push(`tenderness: +${prevTender}→+${curTender}`)
        if (tightWorsened) indicators.push(`tightness: ${prev.tightnessGrading}→${cur.tightnessGrading}`)
        errors.push({
          ruleId: 'T02', severity: 'CRITICAL', visitIndex: idx,
          message: '标注 improvement 但数值恶化',
          expected: '数值不恶化', actual: indicators.join(', '),
        })
      }
    }

    // T03: exacerbate + values improved
    if (cur.symptomChange.toLowerCase().includes('exacerbate')) {
      const painImproved = cur.painScaleCurrent < prev.painScaleCurrent
      const tenderImproved = curTender < prevTender
      const tightImproved = curTightRank < prevTightRank
      if (painImproved || tenderImproved || tightImproved) {
        const indicators: string[] = []
        if (painImproved) indicators.push(`pain: ${prev.painScaleCurrent}→${cur.painScaleCurrent}`)
        if (tenderImproved) indicators.push(`tenderness: +${prevTender}→+${curTender}`)
        if (tightImproved) indicators.push(`tightness: ${prev.tightnessGrading}→${cur.tightnessGrading}`)
        errors.push({
          ruleId: 'T03', severity: 'CRITICAL', visitIndex: idx,
          message: '标注 exacerbate 但数值改善',
          expected: '数值不改善', actual: indicators.join(', '),
        })
      }
    }
  }

  return errors
}

// ============ Context-Level Checks (run once) ============

function checkContext(ctx: ContextSnapshot): ConstraintError[] {
  const errors: ConstraintError[] = []

  // S2: painTypes vs localPattern (context-level, not per-visit)
  if (ctx.painTypes.length > 0 && ctx.localPattern) {
    const { consistent, expected } = isPainTypeConsistentWithPattern(ctx.localPattern, ctx.painTypes)
    if (expected.length > 0 && !consistent) {
      errors.push({
        ruleId: 'S2', severity: 'MEDIUM', visitIndex: 0,
        message: '疼痛类型与证型不匹配',
        expected: expected.join('/'), actual: ctx.painTypes.join(', '),
      })
    }
  }

  return errors
}

// ============ Scoring ============

export interface ValidationResult {
  errors: ConstraintError[]
  score: number
  grade: 'PASS' | 'WARNING' | 'FAIL'
  criticalCount: number
  highCount: number
  mediumCount: number
}

function scoreErrors(errors: ConstraintError[]): Pick<ValidationResult, 'score' | 'grade' | 'criticalCount' | 'highCount' | 'mediumCount'> {
  const criticalCount = errors.filter(e => e.severity === 'CRITICAL').length
  const highCount = errors.filter(e => e.severity === 'HIGH').length
  const mediumCount = errors.filter(e => e.severity === 'MEDIUM').length

  if (criticalCount > 0) {
    return { score: 0, grade: 'FAIL', criticalCount, highCount, mediumCount }
  }

  const penalty = highCount * 15 + mediumCount * 8
  const score = Math.max(0, 100 - penalty)
  const grade = score >= 80 ? 'PASS' : score >= 60 ? 'WARNING' : 'FAIL'
  return { score, grade, criticalCount, highCount, mediumCount }
}

// ============ Main Export ============

/** 对 Writer 生成的 visit 序列运行自检 */
export function validateGeneratedSequence(
  visits: VisitSnapshot[],
  ctx: ContextSnapshot
): ValidationResult {
  const ctxErrors = checkContext(ctx)
  const singleErrors = visits.flatMap(v => checkSingleVisit(v, ctx))
  const seqErrors = checkSequence(visits)
  const allErrors = [...ctxErrors, ...singleErrors, ...seqErrors]
  return { errors: allErrors, ...scoreErrors(allErrors) }
}

/** 从 TXVisitState 构建 VisitSnapshot (bridge) */
export function visitStateToSnapshot(
  state: {
    visitIndex: number
    painScaleCurrent: number
    severityLevel: string
    symptomChange: string
    reason: string
    generalCondition: string
    tightnessGrading: string
    tendernessGrading: string
    spasmGrading: string
    painFrequency: string
    associatedSymptom: string
    needlePoints: string[]
    tonguePulse: { tongue: string; pulse: string }
    electricalStimulation?: boolean
  }
): VisitSnapshot {
  return {
    visitIndex: state.visitIndex,
    isIE: false,
    painScaleCurrent: state.painScaleCurrent,
    severityLevel: state.severityLevel,
    symptomChange: state.symptomChange,
    reason: state.reason,
    generalCondition: state.generalCondition,
    tightnessGrading: state.tightnessGrading,
    tendernessGrading: state.tendernessGrading,
    spasmGrading: state.spasmGrading,
    painFrequency: state.painFrequency,
    associatedSymptom: state.associatedSymptom,
    needlePoints: state.needlePoints,
    tonguePulse: state.tonguePulse,
    electricalStimulation: state.electricalStimulation,
  }
}

/** 从 GenerationContext 构建 ContextSnapshot (bridge) */
export function contextToSnapshot(
  ctx: {
    painCurrent: number
    localPattern: string
    systemicPattern: string
    painTypes: string[]
    hasPacemaker: boolean
    primaryBodyPart: string
  }
): ContextSnapshot {
  return {
    painCurrent: ctx.painCurrent,
    localPattern: ctx.localPattern,
    systemicPattern: ctx.systemicPattern,
    painTypes: ctx.painTypes,
    hasPacemaker: ctx.hasPacemaker,
    bodyPart: ctx.primaryBodyPart,
  }
}
