import type { OptumNoteDocument, VisitRecord } from '../types'
import type {
  CheckInput,
  CheckOutput,
  CheckError,
  RuleSeverity,
  TimelineEntry,
  ScoreBreakdown
} from './types'
import { generateCorrections } from './correction-generator'
import { isTonguePatternConsistent, isPainTypeConsistentWithPattern } from '../../../src/shared/tcm-mappings'
import { isAdlConsistentWithBodyPart } from '../../../src/shared/adl-mappings'
import { severityFromPain, expectedTenderMinScaleByPain } from '../../../src/shared/severity'
import {
  extractPainCurrent,
  parseGoalPainTarget,
  parseAdlSeverity,
  parseStrengthScore,
  parseFrequencyLevel,
  parseProgressStatus,
  extractProgressReasons,
  compareSeverity,
} from '../../../src/shared/field-parsers'

function avgRomSeverityRank(visit: VisitRecord): number {
  const rank: Record<string, number> = { severe: 0, moderate: 1, mild: 2, normal: 3 }
  if (!visit.objective.rom.items.length) return 0
  const total = visit.objective.rom.items.reduce((s, x) => s + (rank[(x.severity || '').toLowerCase()] ?? 1), 0)
  return total / visit.objective.rom.items.length
}

function isTonePatternConsistent(localPattern: string | undefined, tongue: string, pulse: string): boolean {
  return isTonguePatternConsistent(localPattern, tongue, pulse)
}

function trend(cur: number, prev: number): '↓' | '→' | '↑' {
  if (cur < prev) return '↓'
  if (cur > prev) return '↑'
  return '→'
}

function err(params: Omit<CheckError, 'id'>): CheckError {
  return { id: `${params.ruleId}-${params.visitIndex}-${params.field}`, ...params }
}

function checkIE(visit: VisitRecord, visitIndex: number): CheckError[] {
  const errors: CheckError[] = []
  const date = visit.assessment.date || ''
  const pain = extractPainCurrent(visit.subjective.painScale)
  const expectedSev = severityFromPain(pain)
  const actualSev = parseAdlSeverity(visit.subjective.adlImpairment)

  // IE01: 用户可能指定任意 severity，不一定与 pain 对应，仅在差距 >= 4 级时提醒
  const ieSevOrder = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
  const ieExpIdx = ieSevOrder.indexOf(expectedSev)
  const ieActIdx = ieSevOrder.indexOf(actualSev)
  if (ieExpIdx >= 0 && ieActIdx >= 0 && Math.abs(ieExpIdx - ieActIdx) >= 4) {
    errors.push(err({
      ruleId: 'IE01',
      severity: 'LOW',
      visitDate: date,
      visitIndex,
      section: 'S',
      field: 'adlDifficultyLevel',
      ruleName: 'pain→severity 映射正确',
      message: `Pain=${pain} 与 ADL severity 不一致`,
      expected: expectedSev,
      actual: actualSev
    }))
  }

  const minTender = expectedTenderMinScaleByPain(pain)
  if (visit.objective.tendernessMuscles.scale < minTender) {
    errors.push(err({
      ruleId: 'IE02',
      severity: 'MEDIUM',
      visitDate: date,
      visitIndex,
      section: 'O',
      field: 'tenderness.scale',
      ruleName: 'pain→tenderness 合理',
      message: '当前 tenderness 级别低于 pain 对应区间',
      expected: `>= +${minTender}`,
      actual: `+${visit.objective.tendernessMuscles.scale}`
    }))
  }

  const romRank = avgRomSeverityRank(visit)
  if (pain >= 7 && romRank > 2.4) {
    errors.push(err({
      ruleId: 'IE03',
      severity: 'MEDIUM',
      visitDate: date,
      visitIndex,
      section: 'O',
      field: 'rom',
      ruleName: 'pain→ROM limitation 合理',
      message: '高疼痛下 ROM 受限程度过轻',
      expected: 'mild/moderate limitation',
      actual: 'mostly normal'
    }))
  }

  if (!isTonePatternConsistent(visit.assessment.localPattern || visit.assessment.tcmDiagnosis?.pattern, visit.objective.tonguePulse.tongue, visit.objective.tonguePulse.pulse)) {
    errors.push(err({
      ruleId: 'IE04',
      severity: 'MEDIUM',
      visitDate: date,
      visitIndex,
      section: 'O',
      field: 'tonguePulse',
      ruleName: '舌脉→证型一致',
      message: '舌脉与证型链不一致',
      expected: 'tone consistent with pattern',
      actual: `${visit.objective.tonguePulse.tongue} / ${visit.objective.tonguePulse.pulse}`
    }))
  }

  const st = parseGoalPainTarget(visit.plan.shortTermGoal?.painScaleTarget)
  if (st !== null && st >= pain) {
    errors.push(err({
      ruleId: 'IE05',
      severity: 'HIGH',
      visitDate: date,
      visitIndex,
      section: 'P',
      field: 'shortTermGoal.painScaleTarget',
      ruleName: 'short term goal pain target < current pain',
      message: '短期目标疼痛值应低于当前疼痛',
      expected: `< ${pain}`,
      actual: String(st)
    }))
  }

  const lt = parseGoalPainTarget(visit.plan.longTermGoal?.painScaleTarget)
  if (st !== null && lt !== null && lt >= st) {
    errors.push(err({
      ruleId: 'IE06',
      severity: 'HIGH',
      visitDate: date,
      visitIndex,
      section: 'P',
      field: 'longTermGoal.painScaleTarget',
      ruleName: 'long term goal pain target < short term target',
      message: '长期目标应严于短期目标',
      expected: `< ${st}`,
      actual: String(lt)
    }))
  }

  const hasDx = !!visit.assessment.tcmDiagnosis?.diagnosis && !!visit.assessment.tcmDiagnosis?.pattern
  if (!hasDx) {
    errors.push(err({
      ruleId: 'IE07',
      severity: 'HIGH',
      visitDate: date,
      visitIndex,
      section: 'A',
      field: 'tcmDiagnosis',
      ruleName: 'TCM diagnosis 完整',
      message: '初诊应包含 local + systemic 证型',
      expected: '完整 TCM diagnosis',
      actual: 'missing'
    }))
  }

  if (!visit.plan.acupoints || visit.plan.acupoints.length === 0) {
    errors.push(err({
      ruleId: 'IE08',
      severity: 'HIGH',
      visitDate: date,
      visitIndex,
      section: 'P',
      field: 'acupoints',
      ruleName: 'P 段 needle protocol 存在',
      message: '计划中缺少穴位信息',
      expected: 'non-empty acupoints',
      actual: 'empty'
    }))
  }

  return errors
}

function checkTX(visit: VisitRecord, ieVisit: VisitRecord | undefined, prevVisit: VisitRecord | undefined, visitIndex: number): CheckError[] {
  const errors: CheckError[] = []
  const date = visit.assessment.date || ''
  const pain = extractPainCurrent(visit.subjective.painScale)
  const expectedSev = severityFromPain(pain)
  const actualSev = parseAdlSeverity(visit.subjective.adlImpairment)

  // ADL 降档容差: 允许 severity 低 2 档 (Generator 在 late visits 合法降档)
  const sevOrder = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
  const expectedIdx = sevOrder.indexOf(expectedSev)
  const actualIdx = sevOrder.indexOf(actualSev)
  const withinTwoLevelsDown = expectedIdx >= 0 && actualIdx >= 0 && expectedIdx - actualIdx <= 2 && expectedIdx - actualIdx >= 0

  if (actualSev !== expectedSev
    && !(actualSev === 'moderate to severe' && expectedSev === 'moderate')
    && !withinTwoLevelsDown) {
    errors.push(err({
      ruleId: 'TX01',
      severity: 'MEDIUM',
      visitDate: date,
      visitIndex,
      section: 'S',
      field: 'adlDifficultyLevel',
      ruleName: 'pain→severity 映射正确',
      message: `Pain=${pain} 与 ADL severity 不一致`,
      expected: expectedSev,
      actual: actualSev
    }))
  }

  const minTender = expectedTenderMinScaleByPain(pain)
  if (visit.objective.tendernessMuscles.scale < minTender) {
    errors.push(err({
      ruleId: 'TX02',
      severity: 'MEDIUM',
      visitDate: date,
      visitIndex,
      section: 'O',
      field: 'tenderness.scale',
      ruleName: 'pain→tenderness 合理',
      message: '当前 tenderness 级别低于 pain 对应区间',
      expected: `>= +${minTender}`,
      actual: `+${visit.objective.tendernessMuscles.scale}`
    }))
  }

  if (prevVisit) {
    const prevPain = extractPainCurrent(prevVisit.subjective.painScale)
    const delta = pain - prevPain
    const saysImprove = /improvement/i.test(visit.assessment.symptomChange || '')
    if (saysImprove && delta > 0) {
      errors.push(err({
        ruleId: 'TX03',
        severity: 'MEDIUM',
        visitDate: date,
        visitIndex,
        section: 'A',
        field: 'symptomChange',
        ruleName: 'symptomChange 描述与 pain delta 一致',
        message: '标注改善但疼痛上升',
        expected: `pain <= ${prevPain}`,
        actual: `${pain}`
      }))
    }
  }

  // T02: 改善描述 + 数值恶化矛盾 (CRITICAL)
  // 跳过 IE→TX1 过渡: IE 用 severityLevel 派生, TX 用 painCurrent 派生, 两者可能不一致
  const prevIsIE = prevVisit?.subjective.visitType === 'INITIAL EVALUATION'
  if (prevVisit && !prevIsIE) {
    const saysImprove = /improvement/i.test(visit.assessment.symptomChange || '')
    if (saysImprove) {
      const prevPain = extractPainCurrent(prevVisit.subjective.painScale)
      const prevTenderness = prevVisit.objective.tendernessMuscles.scale
      const prevTightness = prevVisit.objective.tightnessMuscles.gradingScale
      const curTenderness = visit.objective.tendernessMuscles.scale
      const curTightness = visit.objective.tightnessMuscles.gradingScale

      const painWorsened = pain > prevPain
      const tendernessWorsened = curTenderness > prevTenderness
      const tightnessWorsened = compareSeverity(curTightness, prevTightness) > 0

      if (painWorsened || tendernessWorsened || tightnessWorsened) {
        const worsenedIndicators: string[] = []
        if (painWorsened) worsenedIndicators.push(`pain: ${prevPain}→${pain}`)
        if (tendernessWorsened) worsenedIndicators.push(`tenderness: +${prevTenderness}→+${curTenderness}`)
        if (tightnessWorsened) worsenedIndicators.push(`tightness: ${prevTightness}→${curTightness}`)

        errors.push(err({
          ruleId: 'T02',
          severity: 'CRITICAL',
          visitDate: date,
          visitIndex,
          section: 'A',
          field: 'symptomChange',
          ruleName: '改善描述与数值变化一致',
          message: '标注 improvement 但数值实际恶化',
          expected: 'pain/tenderness/tightness 不恶化',
          actual: worsenedIndicators.join(', ')
        }))
      }
    }
  }

  // T03: 恶化描述 + 数值改善矛盾 (CRITICAL)
  if (prevVisit) {
    const saysExacerbate = /exacerbate/i.test(visit.assessment.symptomChange || '')
    if (saysExacerbate) {
      const prevPain = extractPainCurrent(prevVisit.subjective.painScale)
      const prevTenderness = prevVisit.objective.tendernessMuscles.scale
      const prevTightness = prevVisit.objective.tightnessMuscles.gradingScale
      const curTenderness = visit.objective.tendernessMuscles.scale
      const curTightness = visit.objective.tightnessMuscles.gradingScale

      const painImproved = pain < prevPain
      const tendernessImproved = curTenderness < prevTenderness
      const tightnessImproved = compareSeverity(curTightness, prevTightness) < 0

      if (painImproved || tendernessImproved || tightnessImproved) {
        const improvedIndicators: string[] = []
        if (painImproved) improvedIndicators.push(`pain: ${prevPain}→${pain}`)
        if (tendernessImproved) improvedIndicators.push(`tenderness: +${prevTenderness}→+${curTenderness}`)
        if (tightnessImproved) improvedIndicators.push(`tightness: ${prevTightness}→${curTightness}`)

        errors.push(err({
          ruleId: 'T03',
          severity: 'CRITICAL',
          visitDate: date,
          visitIndex,
          section: 'A',
          field: 'symptomChange',
          ruleName: '恶化描述与数值变化一致',
          message: '标注 exacerbate 但数值实际改善',
          expected: 'pain/tenderness/tightness 不改善',
          actual: improvedIndicators.join(', ')
        }))
      }
    }
  }

  if (prevVisit) {
    const prevGc = (prevVisit.assessment.generalCondition || '').toLowerCase()
    const curGc = (visit.assessment.generalCondition || '').toLowerCase()
    if (prevGc === 'good' && curGc === 'poor') {
      errors.push(err({
        ruleId: 'TX04',
        severity: 'MEDIUM',
        visitDate: date,
        visitIndex,
        section: 'A',
        field: 'generalCondition',
        ruleName: 'generalCondition 合理',
        message: 'generalCondition 跨 visit 变化过大',
        expected: 'stable or mild drift',
        actual: `${prevGc} -> ${curGc}`
      }))
    }
  }

  if (ieVisit) {
    const ieTongue = ieVisit.objective.tonguePulse.tongue
    const iePulse = ieVisit.objective.tonguePulse.pulse
    // fuzzy match: 提取关键词，任一关键词匹配即通过
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const extractKeywords = (s: string) => norm(s).split(/[,;/\s]+/).filter(w => w.length > 2)
    const keywordMatch = (a: string, b: string) => {
      const na = norm(a), nb = norm(b)
      if (na.includes(nb) || nb.includes(na)) return true
      const ka = extractKeywords(a), kb = extractKeywords(b)
      return ka.some(w => nb.includes(w)) || kb.some(w => na.includes(w))
    }
    const tongueMatch = keywordMatch(visit.objective.tonguePulse.tongue, ieTongue)
    const pulseMatch = keywordMatch(visit.objective.tonguePulse.pulse, iePulse)
    if (!tongueMatch || !pulseMatch) {
      errors.push(err({
        ruleId: 'TX05',
        severity: 'HIGH',
        visitDate: date,
        visitIndex,
        section: 'O',
        field: 'tonguePulse',
        ruleName: '舌脉→证型一致',
        message: 'TX 舌脉与 IE 基线不一致',
        expected: `${ieTongue} / ${iePulse}`,
        actual: `${visit.objective.tonguePulse.tongue} / ${visit.objective.tonguePulse.pulse}`
      }))
    }
  }

  if (visit.plan.shortTermGoal || visit.plan.longTermGoal) {
    errors.push(err({
      ruleId: 'TX06',
      severity: 'CRITICAL',
      visitDate: date,
      visitIndex,
      section: 'P',
      field: 'goals',
      ruleName: '不应出现 short/long term goal',
      message: 'TX 不应携带 IE goals',
      expected: 'no short/long term goals',
      actual: 'present'
    }))
  }

  // T06: 进展状态 + 原因逻辑矛盾 (MEDIUM)
  const progressStatus = parseProgressStatus(visit.subjective.chiefComplaint)
  const progressReasons = extractProgressReasons(visit.subjective.chiefComplaint)

  if (progressStatus === 'improvement' && progressReasons.negative.length > 0) {
    errors.push(err({
      ruleId: 'T06',
      severity: 'MEDIUM',
      visitDate: date,
      visitIndex,
      section: 'S',
      field: 'chiefComplaint',
      ruleName: '进展状态 + 原因逻辑一致',
      message: 'progressStatus=improvement 但包含负向原因',
      expected: '正向原因 (maintain regular treatments, reduced level of pain, etc.)',
      actual: `负向原因: ${progressReasons.negative.join(', ')}`
    }))
  }

  if (progressStatus === 'exacerbate' && progressReasons.positive.length > 0) {
    errors.push(err({
      ruleId: 'T06',
      severity: 'MEDIUM',
      visitDate: date,
      visitIndex,
      section: 'S',
      field: 'chiefComplaint',
      ruleName: '进展状态 + 原因逻辑一致',
      message: 'progressStatus=exacerbate 但包含正向原因',
      expected: '负向原因 (skipped treatments, intense work, bad posture, etc.)',
      actual: `正向原因: ${progressReasons.positive.join(', ')}`
    }))
  }

  // T07: Pacemaker + 电刺激矛盾 (CRITICAL)
  // 检查 medicalHistory 是否包含 Pacemaker
  const hasPacemakerInHistory = ieVisit?.subjective.medicalHistory?.some(
    h => h.toLowerCase().includes('pacemaker')
  ) || visit.subjective.medicalHistory?.some(
    h => h.toLowerCase().includes('pacemaker')
  )

  if (hasPacemakerInHistory && visit.plan.electricalStimulation) {
    errors.push(err({
      ruleId: 'T07',
      severity: 'CRITICAL',
      visitDate: date,
      visitIndex,
      section: 'P',
      field: 'electricalStimulation',
      ruleName: 'Pacemaker + 电刺激矛盾',
      message: 'medicalHistory 包含 Pacemaker 但 electricalStimulation=true',
      expected: 'electricalStimulation = false',
      actual: 'electricalStimulation = true'
    }))
  }

  return errors
}

function avgRom(visit: VisitRecord): number {
  if (!visit.objective.rom.items.length) return 0
  const sum = visit.objective.rom.items.reduce((s, x) => s + (x.degrees || 0), 0)
  return sum / visit.objective.rom.items.length
}

function avgStrength(visit: VisitRecord): number {
  if (!visit.objective.rom.items.length) return 0
  const sum = visit.objective.rom.items.reduce((s, x) => s + parseStrengthScore(x.strength), 0)
  return sum / visit.objective.rom.items.length
}

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a.map(x => x.toLowerCase()))
  const sb = new Set(b.map(x => x.toLowerCase()))
  const inter = [...sa].filter(x => sb.has(x)).length
  const uni = new Set([...sa, ...sb]).size
  return uni === 0 ? 1 : inter / uni
}

function checkSequence(visits: VisitRecord[]): CheckError[] {
  const errors: CheckError[] = []
  for (let i = 1; i < visits.length; i++) {
    const prev = visits[i - 1]
    const cur = visits[i]
    const date = cur.assessment.date || ''
    const idx = i

    const prevPain = extractPainCurrent(prev.subjective.painScale)
    const curPain = extractPainCurrent(cur.subjective.painScale)
    const prevIsIE = prev.subjective.visitType === 'INITIAL EVALUATION'
    // 跳过 IE→TX1 过渡: IE 和 TX 使用不同的 tightness/tenderness 派生逻辑
    if (prevIsIE) continue
    if (curPain > prevPain + 1) {
      errors.push(err({
        ruleId: 'V01', severity: 'HIGH', visitDate: date, visitIndex: idx,
        section: 'S', field: 'painScale', ruleName: 'pain 不回升',
        message: '疼痛分值不应回升', expected: `<= ${prevPain + 1}`, actual: `${curPain}`
      }))
    }

    if (cur.objective.tendernessMuscles.scale > prev.objective.tendernessMuscles.scale + 1) {
      errors.push(err({
        ruleId: 'V02', severity: 'HIGH', visitDate: date, visitIndex: idx,
        section: 'O', field: 'tenderness', ruleName: 'tenderness 不回升',
        message: 'Tenderness scale 回升', expected: `<= +${prev.objective.tendernessMuscles.scale + 1}`, actual: `+${cur.objective.tendernessMuscles.scale}`
      }))
    }

    const sevDelta = compareSeverity(cur.objective.tightnessMuscles.gradingScale, prev.objective.tightnessMuscles.gradingScale)
    if (sevDelta > 1) {
      errors.push(err({
        ruleId: 'V03', severity: 'HIGH', visitDate: date, visitIndex: idx,
        section: 'O', field: 'tightness', ruleName: 'tightness 不恶化',
        message: 'Tightness grading 恶化', expected: `<= 1 level above ${prev.objective.tightnessMuscles.gradingScale}`, actual: cur.objective.tightnessMuscles.gradingScale
      }))
    }

    if (cur.objective.spasmMuscles.frequencyScale > prev.objective.spasmMuscles.frequencyScale + 1) {
      errors.push(err({
        ruleId: 'V04', severity: 'HIGH', visitDate: date, visitIndex: idx,
        section: 'O', field: 'spasm', ruleName: 'spasm 不回升',
        message: 'Spasm scale 回升', expected: `<= +${prev.objective.spasmMuscles.frequencyScale + 1}`, actual: `+${cur.objective.spasmMuscles.frequencyScale}`
      }))
    }

    const prevRom = avgRom(prev)
    const curRom = avgRom(cur)
    if (curRom < prevRom - 3) {
      errors.push(err({
        ruleId: 'V05', severity: 'HIGH', visitDate: date, visitIndex: idx,
        section: 'O', field: 'rom', ruleName: 'ROM 不下降',
        message: 'ROM 平均值下降', expected: `>= ${(prevRom - 3).toFixed(1)}`, actual: curRom.toFixed(1)
      }))
    }

    const prevStr = avgStrength(prev)
    const curStr = avgStrength(cur)
    if (curStr < prevStr - 0.3) {
      errors.push(err({
        ruleId: 'V06', severity: 'MEDIUM', visitDate: date, visitIndex: idx,
        section: 'O', field: 'strength', ruleName: 'strength 不下降',
        message: '肌力平均值下降', expected: `>= ${(prevStr - 0.3).toFixed(2)}`, actual: curStr.toFixed(2)
      }))
    }

    if (parseFrequencyLevel(cur.subjective.painFrequency) > parseFrequencyLevel(prev.subjective.painFrequency) + 1) {
      errors.push(err({
        ruleId: 'V07', severity: 'MEDIUM', visitDate: date, visitIndex: idx,
        section: 'S', field: 'painFrequency', ruleName: 'frequency 不增加',
        message: '疼痛频率分级增加', expected: `<= 1 level above ${prev.subjective.painFrequency}`, actual: cur.subjective.painFrequency
      }))
    }

    const saysImprove = /improvement/i.test(cur.assessment.symptomChange || '')
    if (saysImprove && curPain > prevPain + 1) {
      errors.push(err({
        ruleId: 'V08', severity: 'MEDIUM', visitDate: date, visitIndex: idx,
        section: 'A', field: 'symptomChange', ruleName: 'S 说 improvement 但 pain 实际上升',
        message: '纵向矛盾：写改善但 pain 回升', expected: `pain <= ${prevPain + 1}`, actual: String(curPain)
      }))
    }

    const pOverlap = jaccard(prev.plan.acupoints || [], cur.plan.acupoints || [])
    if (pOverlap < 0.4) {
      errors.push(err({
        ruleId: 'V09', severity: 'HIGH', visitDate: date, visitIndex: idx,
        section: 'P', field: 'acupoints', ruleName: 'P 段跨 TX 穴位大变化',
        message: '连续 TX 穴位重叠度过低', expected: 'overlap >= 0.4', actual: pOverlap.toFixed(2)
      }))
    }

    // T08: ADL severity 单调性 - 应逐渐改善，允许 1 级波动
    const prevAdlSeverity = parseAdlSeverity(prev.subjective.adlImpairment)
    const curAdlSeverity = parseAdlSeverity(cur.subjective.adlImpairment)
    const adlSeverityDelta = compareSeverity(curAdlSeverity, prevAdlSeverity)
    if (adlSeverityDelta > 1) {
      errors.push(err({
        ruleId: 'T08', severity: 'HIGH', visitDate: date, visitIndex: idx,
        section: 'S', field: 'adlImpairment', ruleName: 'ADL severity 单调性',
        message: 'ADL severity 不应恶化', expected: `<= 1 level above ${prevAdlSeverity}`, actual: curAdlSeverity
      }))
    }

    // T09: 伴随症状级别单调性 - 应逐渐改善
    const extractAssociatedSymptom = (cc: string): string | null => {
      const match = cc.match(/muscles (weakness|soreness|heaviness|numbness|stiffness)/)
      return match ? match[1] : null
    }
    const symptomRanks: Record<string, number> = {
      soreness: 1,
      stiffness: 2,
      heaviness: 3,
      weakness: 4,
      numbness: 4
    }
    const prevSymptom = extractAssociatedSymptom(prev.subjective.chiefComplaint)
    const curSymptom = extractAssociatedSymptom(cur.subjective.chiefComplaint)
    if (prevSymptom && curSymptom) {
      const prevRank = symptomRanks[prevSymptom] ?? 0
      const curRank = symptomRanks[curSymptom] ?? 0
      if (curRank > prevRank + 1) {
        errors.push(err({
          ruleId: 'T09', severity: 'MEDIUM', visitDate: date, visitIndex: idx,
          section: 'S', field: 'chiefComplaint', ruleName: '伴随症状级别单调性',
          message: '伴随症状严重程度不应恶化', expected: `<= ${prevSymptom}(${prevRank})+1`, actual: `${curSymptom}(${curRank})`
        }))
      }
    }
  }

  return errors
}

function penalty(sev: RuleSeverity, table: Record<RuleSeverity, number>): number {
  return table[sev]
}

function scoreDocument(errors: CheckError[], txCount: number): ScoreBreakdown {
  // 新评分逻辑：有 CRITICAL 即 FAIL
  const hasCritical = errors.some(e => e.severity === 'CRITICAL')

  if (hasCritical) {
    return {
      ieConsistency: 0,
      txConsistency: 0,
      timelineLogic: 0,
      totalScore: 0,
      grade: 'FAIL'
    }
  }

  // 无 CRITICAL 时，按 HIGH/MEDIUM 扣分
  const penaltyMap: Record<RuleSeverity, number> = { CRITICAL: 0, HIGH: 15, MEDIUM: 8, LOW: 0 }
  const totalPenalty = errors.reduce((s, e) => s + penaltyMap[e.severity], 0)
  const totalScore = Math.max(0, 100 - totalPenalty)

  const grade: 'PASS' | 'WARNING' | 'FAIL' = totalScore >= 80 ? 'PASS' : totalScore >= 60 ? 'WARNING' : 'FAIL'

  return {
    ieConsistency: totalScore,
    txConsistency: totalScore,
    timelineLogic: totalScore,
    totalScore,
    grade
  }
}

function buildTimeline(visits: VisitRecord[], errors: CheckError[]): TimelineEntry[] {
  return visits.map((v, i) => {
    const prev = i > 0 ? visits[i - 1] : undefined
    const pain = extractPainCurrent(v.subjective.painScale)
    const prevPain = prev ? extractPainCurrent(prev.subjective.painScale) : pain
    const curT = v.objective.tendernessMuscles.scale
    const prevT = prev ? prev.objective.tendernessMuscles.scale : curT
    const curTight = v.objective.tightnessMuscles.gradingScale
    const prevTight = prev ? prev.objective.tightnessMuscles.gradingScale : curTight
    const curSpasm = v.objective.spasmMuscles.frequencyScale
    const prevSpasm = prev ? prev.objective.spasmMuscles.frequencyScale : curSpasm
    const curF = parseFrequencyLevel(v.subjective.painFrequency)
    const prevF = prev ? parseFrequencyLevel(prev.subjective.painFrequency) : curF
    const curRom = avgRom(v)
    const prevRom = prev ? avgRom(prev) : curRom
    const curStrength = avgStrength(v)
    const prevStrength = prev ? avgStrength(prev) : curStrength

    const byVisit = errors.filter(e => e.visitIndex === i)

    return {
      visitDate: v.assessment.date || '',
      visitIndex: i,
      visitType: v.subjective.visitType === 'INITIAL EVALUATION' ? 'IE' : 'TX',
      indicators: {
        pain: { value: pain, label: String(pain), trend: trend(pain, prevPain), ok: pain <= prevPain },
        tenderness: { value: `+${curT}`, trend: trend(curT, prevT), ok: curT <= prevT },
        tightness: { value: curTight, trend: compareSeverity(curTight, prevTight) < 0 ? '↓' : compareSeverity(curTight, prevTight) > 0 ? '↑' : '→', ok: compareSeverity(curTight, prevTight) <= 0 },
        spasm: { value: `+${curSpasm}`, trend: trend(curSpasm, prevSpasm), ok: curSpasm <= prevSpasm },
        frequency: { value: v.subjective.painFrequency, trend: trend(curF, prevF), ok: curF <= prevF },
        rom: { summary: curRom.toFixed(1), trend: trend(curRom, prevRom), ok: curRom >= prevRom },
        strength: { summary: curStrength.toFixed(2), trend: trend(curStrength, prevStrength), ok: curStrength >= prevStrength }
      },
      errors: byVisit
    }
  })
}

// ============ ICD / CPT Code Checks ============

const ICD_BODY_MAP: Record<string, string[]> = {
  KNEE: ['M17', 'M25.56', 'M25.46', 'M25.36', 'M76.5', 'M23', 'M22'],
  SHOULDER: ['M25.51', 'M75', 'M79.61'],
  ELBOW: ['M25.52', 'M77.0', 'M77.1'],
  NECK: ['M54.2', 'M54.6', 'M47.81', 'M50'],
  LBP: ['M54.5', 'M54.4', 'M54.3', 'M47.8', 'M51'],
  UPPER_BACK: ['M54.6', 'M54.2'],
  HIP: ['M25.55', 'M16'],
}

const LATERALITY_ICD_SUFFIX: Record<string, string[]> = {
  right: ['1', '91'],
  left: ['2', '92'],
  bilateral: ['3', '93'],
}

const CPT_ESTIM = ['97813', '97814']
const CPT_NO_ESTIM = ['97810', '97811']

function checkCodes(visits: VisitRecord[]): CheckError[] {
  const errors: CheckError[] = []
  let prevDxCodes: string[] = []

  // Writer 模式检测: 所有 visits 都没有编码 → 跳过 DX03/CPT01
  const allMissingDx = visits.every(v => v.diagnosisCodes.length === 0)
  const allMissingCpt = visits.every(v => v.procedureCodes.length === 0)

  for (let i = 0; i < visits.length; i++) {
    const v = visits[i]
    const date = v.assessment.date || ''
    const isIE = v.subjective.visitType === 'INITIAL EVALUATION'
    const dx = v.diagnosisCodes
    const px = v.procedureCodes

    // DX03: must have at least one ICD (Writer 模式全缺时跳过)
    if (dx.length === 0 && !allMissingDx) {
      errors.push(err({
        ruleId: 'DX03', severity: 'HIGH', visitDate: date, visitIndex: i,
        section: 'A', field: 'diagnosisCodes', ruleName: 'ICD 编码存在',
        message: '缺少 ICD-10 诊断编码', expected: '>= 1', actual: '0'
      }))
    }

    // DX01: ICD matches bodyPart
    const bp = (v.subjective.bodyPartNormalized || '').toUpperCase()
    const allowedPrefixes = ICD_BODY_MAP[bp] || []
    if (dx.length > 0 && allowedPrefixes.length > 0) {
      for (const d of dx) {
        const matches = allowedPrefixes.some(p => d.icd10.startsWith(p))
        if (!matches) {
          errors.push(err({
            ruleId: 'DX01', severity: 'CRITICAL', visitDate: date, visitIndex: i,
            section: 'A', field: 'diagnosisCodes', ruleName: 'ICD→bodyPart 匹配',
            message: `ICD ${d.icd10} 与主诉部位 ${bp} 不匹配`,
            expected: allowedPrefixes.join('/'), actual: d.icd10
          }))
        }
      }
    }

    // DX04: laterality check
    const lat = v.subjective.laterality || 'unspecified'
    const expectedSuffixes = LATERALITY_ICD_SUFFIX[lat]
    if (expectedSuffixes && dx.length > 0) {
      for (const d of dx) {
        const lastChar = d.icd10.slice(-1)
        if (/\d/.test(lastChar) && !expectedSuffixes.includes(lastChar)) {
          errors.push(err({
            ruleId: 'DX04', severity: 'CRITICAL', visitDate: date, visitIndex: i,
            section: 'A', field: 'diagnosisCodes', ruleName: 'ICD laterality 一致',
            message: `ICD ${d.icd10} laterality 与 ${lat} 不一致`,
            expected: `suffix ${expectedSuffixes.join('/')}`, actual: lastChar
          }))
        }
      }
    }

    // DX02: cross-visit ICD consistency
    const curDxCodes = dx.map(d => d.icd10).sort()
    if (prevDxCodes.length > 0 && curDxCodes.length > 0) {
      const overlap = curDxCodes.filter(c => prevDxCodes.includes(c)).length
      const total = new Set([...curDxCodes, ...prevDxCodes]).size
      if (total > 0 && overlap / total < 0.5) {
        errors.push(err({
          ruleId: 'DX02', severity: 'CRITICAL', visitDate: date, visitIndex: i,
          section: 'A', field: 'diagnosisCodes', ruleName: 'ICD 跨 visit 一致',
          message: 'ICD 编码与上次就诊差异过大',
          expected: 'overlap >= 50%', actual: `${Math.round(overlap / total * 100)}%`
        }))
      }
    }
    prevDxCodes = curDxCodes

    // CPT01: must have at least one CPT (Writer 模式全缺时跳过)
    if (px.length === 0 && !allMissingCpt) {
      errors.push(err({
        ruleId: 'CPT01', severity: 'HIGH', visitDate: date, visitIndex: i,
        section: 'P', field: 'procedureCodes', ruleName: 'CPT 编码存在',
        message: '缺少 CPT 操作编码', expected: '>= 1', actual: '0'
      }))
    }

    // CPT02: electrical stimulation ↔ CPT match
    const hasEstimCpt = px.some(p => CPT_ESTIM.includes(p.cpt))
    const hasNoEstimCpt = px.some(p => CPT_NO_ESTIM.includes(p.cpt))
    const planEstim = v.plan.electricalStimulation
    if (planEstim && !hasEstimCpt && hasNoEstimCpt) {
      errors.push(err({
        ruleId: 'CPT02', severity: 'CRITICAL', visitDate: date, visitIndex: i,
        section: 'P', field: 'procedureCodes', ruleName: 'CPT↔电刺激匹配',
        message: 'Plan 写 with electrical stimulation 但 CPT 无 97813/97814',
        expected: '97813/97814', actual: px.map(p => p.cpt).join(',')
      }))
    }
    if (!planEstim && hasEstimCpt && !hasNoEstimCpt) {
      errors.push(err({
        ruleId: 'CPT02', severity: 'CRITICAL', visitDate: date, visitIndex: i,
        section: 'P', field: 'procedureCodes', ruleName: 'CPT↔电刺激匹配',
        message: 'Plan 写 without electrical stimulation 但 CPT 含 97813/97814',
        expected: '97810/97811', actual: px.map(p => p.cpt).join(',')
      }))
    }

    // CPT03: treatment time vs units
    const time = v.plan.treatmentTime
    const acuCpts = px.filter(p => [...CPT_ESTIM, ...CPT_NO_ESTIM].includes(p.cpt))
    if (time > 15 && acuCpts.length < 2) {
      errors.push(err({
        ruleId: 'CPT03', severity: 'CRITICAL', visitDate: date, visitIndex: i,
        section: 'P', field: 'procedureCodes', ruleName: 'CPT↔时间 units 匹配',
        message: `操作时间 ${time}min 超过 15min 但缺少额外 unit CPT`,
        expected: '>= 2 acupuncture CPTs', actual: String(acuCpts.length)
      }))
    }

    // CPT04: IE/TX CPT 类型验证
    // IE 可使用 97810（首针）或 97811（额外时间），两者都是合法的
    // 此规则不再强制 IE 必须用 97811
  }

  return errors
}

// ============ Text Consistency Checks ============

// Negative nouns: value decrease = improvement, should pair with "reduced"
const NEGATIVE_NOUNS = ['tightness', 'tenderness', 'spasms', 'spasm', 'rom limitation', 'limitation']

// Positive nouns: value increase = improvement, should pair with "increased"
const POSITIVE_NOUNS = ['strength', 'rom']

function extractTextDescriptions(visit: VisitRecord): string[] {
  const texts: string[] = []

  if (visit.assessment.symptomChange) {
    texts.push(visit.assessment.symptomChange.toLowerCase())
  }

  const assessment = visit.assessment as unknown as Record<string, unknown>
  if (typeof assessment.physicalFindings === 'string') {
    texts.push(assessment.physicalFindings.toLowerCase())
  }
  if (typeof assessment.progressNote === 'string') {
    texts.push(assessment.progressNote.toLowerCase())
  }

  return texts
}

function checkTextConsistency(visits: VisitRecord[]): CheckError[] {
  const errors: CheckError[] = []

  for (let i = 0; i < visits.length; i++) {
    const visit = visits[i]
    const date = visit.assessment.date || ''
    const texts = extractTextDescriptions(visit)
    const fullText = texts.join(' ')

    // T01: Direction word + noun polarity contradiction
    // Check for "increased" + negative noun (contradiction)
    for (const noun of NEGATIVE_NOUNS) {
      const increasedPattern = new RegExp(`increased\\s+(?:\\w+\\s+)*${noun}`, 'i')
      if (increasedPattern.test(fullText)) {
        errors.push(err({
          ruleId: 'T01',
          severity: 'HIGH',
          visitDate: date,
          visitIndex: i,
          section: 'A',
          field: 'textDescription',
          ruleName: '方向词 + 名词极性矛盾',
          message: `语义矛盾: "increased ${noun}" 应为 "reduced ${noun}"`,
          expected: `reduced ${noun}`,
          actual: `increased ${noun}`
        }))
      }
    }

    // Check for "reduced" + positive noun (contradiction)
    for (const noun of POSITIVE_NOUNS) {
      if (noun === 'rom') {
        // Skip "rom" if it's part of "rom limitation"
        const reducedRomLimitationPattern = /reduced\s+(?:\w+\s+)*rom\s+limitation/i
        const reducedRomPattern = /reduced\s+(?:\w+\s+)*(?:joint\s+)?rom(?!\s+limitation)/i
        if (reducedRomPattern.test(fullText) && !reducedRomLimitationPattern.test(fullText)) {
          errors.push(err({
            ruleId: 'T01',
            severity: 'HIGH',
            visitDate: date,
            visitIndex: i,
            section: 'A',
            field: 'textDescription',
            ruleName: '方向词 + 名词极性矛盾',
            message: '语义矛盾: "reduced ROM" 应为 "increased ROM"',
            expected: 'increased ROM',
            actual: 'reduced ROM'
          }))
        }
      } else {
        const reducedPattern = new RegExp(`reduced\\s+(?:\\w+\\s+)*${noun}`, 'i')
        if (reducedPattern.test(fullText)) {
          errors.push(err({
            ruleId: 'T01',
            severity: 'HIGH',
            visitDate: date,
            visitIndex: i,
            section: 'A',
            field: 'textDescription',
            ruleName: '方向词 + 名词极性矛盾',
            message: `语义矛盾: "reduced ${noun}" 应为 "increased ${noun}"`,
            expected: `increased ${noun}`,
            actual: `reduced ${noun}`
          }))
        }
      }
    }

    // T04 and T05: Check against previous visit for actual value changes
    if (i > 0) {
      const prevVisit = visits[i - 1]
      const prevRom = avgRom(prevVisit)
      const curRom = avgRom(visit)
      const prevStr = avgStrength(prevVisit)
      const curStr = avgStrength(visit)

      // T04: ROM description contradiction
      const reducedRomLimitationPattern = /reduced\s+(?:\w+\s+)*(?:rom\s+)?limitation/i
      const increasedRomPattern = /increased\s+(?:\w+\s+)*(?:joint\s+)?rom(?!\s+limitation)/i

      if (reducedRomLimitationPattern.test(fullText) && curRom < prevRom) {
        errors.push(err({
          ruleId: 'T04',
          severity: 'HIGH',
          visitDate: date,
          visitIndex: i,
          section: 'A',
          field: 'romDescription',
          ruleName: 'ROM 描述矛盾',
          message: '文本描述 "reduced ROM limitation" 但 ROM 实际下降',
          expected: `ROM >= ${prevRom.toFixed(1)}`,
          actual: `ROM = ${curRom.toFixed(1)}`
        }))
      }

      if (increasedRomPattern.test(fullText) && curRom < prevRom) {
        errors.push(err({
          ruleId: 'T04',
          severity: 'HIGH',
          visitDate: date,
          visitIndex: i,
          section: 'A',
          field: 'romDescription',
          ruleName: 'ROM 描述矛盾',
          message: '文本描述 "increased joint ROM" 但 ROM 实际下降',
          expected: `ROM >= ${prevRom.toFixed(1)}`,
          actual: `ROM = ${curRom.toFixed(1)}`
        }))
      }

      // T05: Strength description contradiction
      const increasedStrengthPattern = /increased\s+(?:\w+\s+)*strength/i

      if (increasedStrengthPattern.test(fullText) && curStr < prevStr) {
        errors.push(err({
          ruleId: 'T05',
          severity: 'HIGH',
          visitDate: date,
          visitIndex: i,
          section: 'A',
          field: 'strengthDescription',
          ruleName: '肌力描述矛盾',
          message: '文本描述 "increased muscles strength" 但 strength 实际下降',
          expected: `strength >= ${prevStr.toFixed(2)}`,
          actual: `strength = ${curStr.toFixed(2)}`
        }))
      }
    }
  }

  return errors
}

function checkGeneratorRules(visits: VisitRecord[], insuranceType: string, treatmentTime: number): CheckError[] {
  const errors: CheckError[] = []

  for (let i = 0; i < visits.length; i++) {
    const v = visits[i]
    const date = v.assessment.date || ''
    const pain = extractPainCurrent(v.subjective.painScale)
    const isIE = v.subjective.visitType === 'INITIAL EVALUATION'

    // S2: painTypes vs localPattern — 降级为 LOW (Writer 模式下用户自选 painTypes)
    if (v.subjective.painTypes.length > 0 && v.assessment.localPattern) {
      const { consistent, expected } = isPainTypeConsistentWithPattern(v.assessment.localPattern, v.subjective.painTypes)
      if (expected.length > 0 && !consistent) {
        errors.push(err({
          ruleId: 'S2', severity: 'LOW', visitDate: date, visitIndex: i,
          section: 'S', field: 'painTypes', ruleName: 'painTypes vs localPattern',
          message: 'Pain types do not match local pattern', expected: expected.join('/'), actual: v.subjective.painTypes.join(',')
        }))
      }
    }

    // S3: ADL activities vs bodyPart
    if (v.subjective.adlImpairment && v.subjective.bodyPartNormalized) {
      const { consistent, keywords } = isAdlConsistentWithBodyPart(v.subjective.bodyPartNormalized, v.subjective.adlImpairment)
      if (keywords.length > 0 && !consistent) {
        errors.push(err({
          ruleId: 'S3', severity: 'MEDIUM', visitDate: date, visitIndex: i,
          section: 'S', field: 'adlImpairment', ruleName: 'ADL activities vs bodyPart',
          message: 'ADL description missing relevant activities', expected: keywords.slice(0, 6).join('/'), actual: 'no match'
        }))
      }
    }

    // S6: 已删除 — 与 T09 (checkSequence) 重复，保留 T09 避免双重扣分

    // S7: muscleWeaknessScale vs pain
    if (v.subjective.muscleWeaknessScale) {
      const parsePercent = (scale: string) => {
        const match = scale.match(/(\d+)(?:%|-(\d+)%)?/)
        if (!match) return 0
        return match[2] ? (parseInt(match[1]) + parseInt(match[2])) / 2 : parseInt(match[1])
      }
      const weakness = parsePercent(v.subjective.muscleWeaknessScale)
      if ((pain >= 7 && weakness < 40) || (pain >= 5 && weakness < 20)) {
        errors.push(err({
          ruleId: 'S7', severity: 'HIGH', visitDate: date, visitIndex: i,
          section: 'S', field: 'muscleWeaknessScale', ruleName: 'muscleWeaknessScale vs pain',
          message: 'Muscle weakness scale too low for pain level', expected: pain >= 7 ? '>=40%' : '>=20%', actual: `${weakness}%`
        }))
      }
    }

    // O1: ROM degrees vs pain
    const normalDegrees: Record<string, Record<string, number>> = {
      knee: { flexion: 130, extension: 0 },
      lbp: { flexion: 90, extension: 30, rotation: 45, 'lateral flexion': 30 },
      shoulder: { flexion: 180, extension: 60, abduction: 180, rotation: 90 },
      neck: { flexion: 50, extension: 60, rotation: 80, 'lateral flexion': 45 }
    }
    const limitFactor = pain >= 8 ? 0.77 : pain >= 6 ? 0.85 : pain >= 3 ? 0.95 : 1.0
    const bodyPart = (v.subjective.bodyPartNormalized || '').toLowerCase()
    const normals = normalDegrees[bodyPart] || {}

    // fuzzy movement lookup: 'Rotation to Right' → matches 'rotation'
    // Sort keys longest-first so 'lateral flexion' matches before 'flexion'
    const findNormal = (movementName: string): number => {
      const m = movementName.toLowerCase()
      // exact match first
      if (normals[m] !== undefined) return normals[m]
      // detect side-bending: "flexion to the right/left" = lateral flexion
      if (m.includes('flexion to')) {
        return normals['lateral flexion'] ?? 30
      }
      // fuzzy: check if movement contains any key, longest keys first
      const sortedKeys = Object.keys(normals).sort((a, b) => b.length - a.length)
      for (const key of sortedKeys) {
        if (m.includes(key)) return normals[key]
      }
      // fallback
      return m.includes('abduction') ? 180 : 90
    }
    for (const rom of v.objective.rom.items) {
      const normal = findNormal(rom.movement)
      // 跳过 normalDegrees≤0 的运动 (如 KNEE Extension normal=0)，百分比校验无意义
      if (normal <= 0) continue
      const expected = normal * limitFactor
      if (rom.degrees > expected * 1.4 || rom.degrees < expected * 0.4) {
        errors.push(err({
          ruleId: 'O1', severity: 'HIGH', visitDate: date, visitIndex: i,
          section: 'O', field: 'rom.degrees', ruleName: 'ROM degrees vs pain',
          message: 'ROM degrees inconsistent with pain level', expected: `${expected.toFixed(0)}±25%`, actual: String(rom.degrees)
        }))
      }
    }

    // O2: ROM limitation label vs degrees ratio
    for (const rom of v.objective.rom.items) {
      const normal = findNormal(rom.movement)
      const ratio = rom.degrees / normal
      const severity = rom.severity?.toLowerCase()
      if ((severity === 'normal' && ratio < 0.85) ||
        (severity === 'severe' && ratio > 0.55) ||
        (severity === 'mild' && (ratio < 0.5 || ratio > 0.95))) {
        errors.push(err({
          ruleId: 'O2', severity: 'HIGH', visitDate: date, visitIndex: i,
          section: 'O', field: 'rom.severity', ruleName: 'ROM limitation label vs degrees',
          message: 'ROM severity label inconsistent with degrees', expected: 'consistent label', actual: `${severity} at ${(ratio * 100).toFixed(0)}%`
        }))
      }
    }

    // O3: Strength vs ROM limitation direction
    for (const rom of v.objective.rom.items) {
      const strength = parseStrengthScore(rom.strength)
      const severity = rom.severity?.toLowerCase()
      if ((severity === 'severe' && strength > 4) || (severity === 'normal' && strength < 4)) {
        errors.push(err({
          ruleId: 'O3', severity: 'HIGH', visitDate: date, visitIndex: i,
          section: 'O', field: 'rom.strength', ruleName: 'Strength vs ROM limitation',
          message: 'Strength inconsistent with ROM severity', expected: severity === 'severe' ? '<=4' : '>=4', actual: String(strength)
        }))
      }
    }

    // O8: Muscles belong to bodyPart
    if (v.subjective.bodyPartNormalized) {
      const muscleKeywords: Record<string, string[]> = {
        KNEE: ['gluteus', 'piriformis', 'quadratus', 'adductor', 'ITB', 'rectus', 'gastronemius', 'hamstring', 'tibialis', 'plantar', 'achilles', 'femoris', 'popliteal', 'patella', 'sartorius', 'vastus', 'intrinsic', 'foot'],
        SHOULDER: ['trapezius', 'tuberosity', 'AC joint', 'levator', 'rhomboid', 'deltoid', 'bicep', 'supraspinatus', 'triceps', 'infraspinatus', 'subscapularis', 'teres', 'pectoralis', 'coracobrachialis'],
        NECK: ['scalene', 'levator', 'trapezius', 'sternocleidomastoid', 'semispinalis', 'splenius', 'suboccipital', 'longus'],
        LBP: ['iliocostalis', 'spinalis', 'longissimus', 'iliopsoas', 'quadratus', 'gluteal', 'multifidus', 'erector', 'piriformis'],
        ELBOW: ['brachioradialis', 'extensor', 'flexor', 'supinator', 'pronator', 'bicep', 'triceps', 'anconeus', 'wrist'],
        HIP: ['gluteus', 'gluteal', 'piriformis', 'iliopsoas', 'tensor', 'adductor', 'hamstring', 'rectus', 'sartorius', 'quadratus', 'obturator']
      }
      const keywords = muscleKeywords[v.subjective.bodyPartNormalized.toUpperCase()] || []
      if (keywords.length > 0) {
        const allMuscles = [...v.objective.tightnessMuscles.muscles, ...v.objective.tendernessMuscles.muscles, ...v.objective.spasmMuscles.muscles]
        for (const muscle of allMuscles) {
          const matches = keywords.some(k => muscle.toLowerCase().includes(k.toLowerCase()))
          if (!matches) {
            errors.push(err({
              ruleId: 'O8', severity: 'HIGH', visitDate: date, visitIndex: i,
              section: 'O', field: 'muscles', ruleName: 'Muscles belong to bodyPart',
              message: 'Muscle does not belong to body part', expected: keywords.join('/'), actual: muscle
            }))
          }
        }
      }
    }

    // O9: ROM movement belongs to bodyPart
    if (v.subjective.bodyPartNormalized) {
      const validMovements: Record<string, string[]> = {
        KNEE: ['flexion', 'extension'],
        SHOULDER: ['abduction', 'adduction', 'flexion', 'extension', 'rotation'],
        NECK: ['flexion', 'extension', 'rotation'],
        LBP: ['flexion', 'extension', 'rotation']
      }
      const valid = validMovements[v.subjective.bodyPartNormalized.toUpperCase()] || []
      if (valid.length > 0) {
        for (const rom of v.objective.rom.items) {
          const matches = valid.some(m => rom.movement.toLowerCase().includes(m))
          if (!matches) {
            errors.push(err({
              ruleId: 'O9', severity: 'CRITICAL', visitDate: date, visitIndex: i,
              section: 'O', field: 'rom.movement', ruleName: 'ROM movement belongs to bodyPart',
              message: 'ROM movement invalid for body part', expected: valid.join('/'), actual: rom.movement
            }))
          }
        }
      }
    }

    // A5: localPattern consistent across visits
    if (!isIE && i > 0) {
      const ieVisit = visits.find(v => v.subjective.visitType === 'INITIAL EVALUATION')
      if (ieVisit?.assessment.localPattern && v.assessment.localPattern) {
        const iePattern = ieVisit.assessment.localPattern.toLowerCase()
        const curPattern = v.assessment.localPattern.toLowerCase()
        if (!curPattern.includes(iePattern) && !iePattern.includes(curPattern)) {
          errors.push(err({
            ruleId: 'A5', severity: 'CRITICAL', visitDate: date, visitIndex: i,
            section: 'A', field: 'localPattern', ruleName: 'localPattern consistent across visits',
            message: 'Local pattern inconsistent with IE', expected: iePattern, actual: curPattern
          }))
        }
      }
    }

    // P1: Needle gauge vs bodyPart
    if (v.subjective.bodyPartNormalized) {
      const validGauges: Record<string, number[]> = {
        KNEE: [30, 34],
        SHOULDER: [30, 34, 36],
        NECK: [30, 34, 36],
        LBP: [30, 34]
      }
      const valid = validGauges[v.subjective.bodyPartNormalized.toUpperCase()] || []
      if (valid.length > 0) {
        for (const spec of v.plan.needleSpecs) {
          const gauge = parseInt(spec.gauge.replace('#', ''))
          if (!valid.includes(gauge)) {
            errors.push(err({
              ruleId: 'P1', severity: 'CRITICAL', visitDate: date, visitIndex: i,
              section: 'P', field: 'needleSpecs.gauge', ruleName: 'Needle gauge vs bodyPart',
              message: 'Invalid needle gauge for body part', expected: valid.join('/'), actual: String(gauge)
            }))
          }
        }
      }
    }

    // P2: Check acupoints count
    if (!v.plan.acupoints || v.plan.acupoints.length === 0 || v.plan.acupoints.length > 20) {
      errors.push(err({
        ruleId: 'P2', severity: 'CRITICAL', visitDate: date, visitIndex: i,
        section: 'P', field: 'acupoints', ruleName: 'Acupoints reasonable count',
        message: 'Acupoints count unreasonable', expected: '2-20', actual: String(v.plan.acupoints?.length || 0)
      }))
    }

    // X1: Full chain Pain→Severity→Tightness→Tenderness consistency
    // 跳过 IE (V0): IE 的 tightness/tenderness 由用户指定的 severityLevel 派生，不一定与 pain 一致
    if (!isIE) {
      const expectedTenderness = expectedTenderMinScaleByPain(pain)
      const actualTightness = v.objective.tightnessMuscles.gradingScale.toLowerCase()
      const actualTenderness = v.objective.tendernessMuscles.scale

      if ((pain >= 8 && !actualTightness.includes('moderate') && !actualTightness.includes('severe') && !actualTightness.includes('mild to moderate')) ||
        (pain <= 3 && (actualTightness.includes('severe') || actualTenderness > 3))) {
        errors.push(err({
          ruleId: 'X1', severity: 'CRITICAL', visitDate: date, visitIndex: i,
          section: 'O', field: 'tightness/tenderness', ruleName: 'Pain→Severity→Tightness→Tenderness chain',
          message: 'Inconsistent pain-tightness-tenderness chain', expected: `pain ${pain} → tightness/+${expectedTenderness}`, actual: `${actualTightness}/+${actualTenderness}`
        }))
      }
    }

    // X2: Pain→ROM→Strength chain
    const avgRomSev = avgRomSeverityRank(v)
    if ((pain >= 8 && avgRomSev > 2.5) || (pain <= 3 && avgRomSev < 0.5)) {
      errors.push(err({
        ruleId: 'X2', severity: 'CRITICAL', visitDate: date, visitIndex: i,
        section: 'O', field: 'rom', ruleName: 'Pain→ROM→Strength chain',
        message: 'ROM severity inconsistent with pain', expected: pain >= 8 ? 'not normal' : 'not severe', actual: avgRomSev > 2.5 ? 'mostly normal' : 'mostly severe'
      }))
    }

    // X3: Pattern→Tongue/Pulse→Treatment Principles chain (IE only)
    if (isIE && (v.assessment.localPattern || v.assessment.systemicPattern)) {
      // patternTongue: 对齐 Generator TONE_MAP，用关键词子串匹配
      const patternTongue: Record<string, string[]> = {
        'Blood Stasis': ['purple', 'dark', 'dusk'],
        'Qi Stagnation': ['thin white', 'white coat', 'white coating', 'purplish', 'dusk'],
        'Liver Qi': ['thin white', 'white coat', 'white coating', 'purplish', 'dusk'],
        'Cold-Damp': ['white', 'thick white', 'greasy', 'slippery'],
        'Wind-Cold': ['white', 'thin white'],
        'Damp-Heat': ['yellow', 'greasy', 'sticky', 'red'],
        'Qi & Blood Deficiency': ['pale', 'thin white', 'thin dry', 'tooth marks'],
        'Blood Deficiency': ['pale', 'thin dry'],
        'Kidney Yang': ['pale', 'thin white', 'white coat', 'white coating', 'delicate', 'swollen'],
        'Kidney Yin': ['red', 'thin', 'cracked', 'rootless', 'moisture', 'furless', 'little coat'],
        'Kidney Qi': ['pale', 'thin white', 'tooth marks'],
        'Kidney Essence': ['cracked', 'rootless', 'red', 'moisture'],
        'Phlegm': ['sticky', 'greasy', 'thick', 'big tongue', 'white sticky'],
        'Qi Deficiency': ['pale', 'thin white', 'tooth marks'],
        'Liver Yang': ['red', 'thin yellow', 'yellow', 'white'],
        'Spleen Deficiency': ['pale', 'thin white', 'tooth-marked', 'tooth marks']
      }
      // 使用两个 pattern，但只要其中一个匹配即可 (组合规则)
      const patterns = [v.assessment.localPattern, v.assessment.systemicPattern].filter(Boolean)
      const tongue = v.objective.tonguePulse.tongue.toLowerCase()
      let anyPatternMatched = false
      for (const pattern of patterns) {
        const expectedTongues = Object.entries(patternTongue).find(([key]) => pattern!.includes(key))?.[1]
        if (expectedTongues && expectedTongues.some(t => tongue.includes(t))) {
          anyPatternMatched = true
          break
        }
        if (!expectedTongues) anyPatternMatched = true // 未知 pattern 不检查
      }
      if (!anyPatternMatched && patterns.length > 0) {
        const allExpected = patterns.flatMap(p => {
          const e = Object.entries(patternTongue).find(([key]) => p!.includes(key))?.[1]
          return e || []
        })
        if (allExpected.length > 0) {
          errors.push(err({
            ruleId: 'X3', severity: 'CRITICAL', visitDate: date, visitIndex: i,
            section: 'O', field: 'tonguePulse', ruleName: 'Pattern→Tongue/Pulse chain',
            message: 'Tongue inconsistent with pattern', expected: allExpected.join('/'), actual: v.objective.tonguePulse.tongue
          }))
        }
      }
    }

    // X4: Pacemaker→Electrical Stimulation
    const hasPacemaker = (v.subjective.medicalHistory?.some(h => h.toLowerCase().includes('pacemaker')) ||
      v.subjective.chiefComplaint.toLowerCase().includes('pacemaker'))
    if (hasPacemaker && v.plan.electricalStimulation) {
      errors.push(err({
        ruleId: 'X4', severity: 'CRITICAL', visitDate: date, visitIndex: i,
        section: 'P', field: 'electricalStimulation', ruleName: 'Pacemaker→Electrical Stimulation',
        message: 'Electrical stimulation contraindicated with pacemaker', expected: 'false', actual: 'true'
      }))
    }
  }

  return errors
}

export function checkDocument(input: CheckInput): CheckOutput {
  const doc = input.document
  const visits = doc.visits
  const errors: CheckError[] = []

  const ieVisit = visits.find(v => v.subjective.visitType === 'INITIAL EVALUATION')
  if (!ieVisit) {
    errors.push(err({
      ruleId: 'DOC01', severity: 'CRITICAL', visitDate: '', visitIndex: 0,
      section: 'S', field: 'visitType', ruleName: '缺少初诊记录',
      message: '文档中未发现 IE 记录', expected: 'at least one IE', actual: 'none'
    }))
  }

  visits.forEach((visit, idx) => {
    if (visit.subjective.visitType === 'INITIAL EVALUATION') {
      errors.push(...checkIE(visit, idx))
    } else {
      errors.push(...checkTX(visit, ieVisit, idx > 0 ? visits[idx - 1] : undefined, idx))
    }
  })

  errors.push(...checkSequence(visits))
  errors.push(...checkCodes(visits))
  errors.push(...checkGeneratorRules(visits, input.insuranceType || 'OPTUM', input.treatmentTime || 15))

  const txCount = visits.filter(v => v.subjective.visitType !== 'INITIAL EVALUATION').length
  const scoring = scoreDocument(errors, txCount)

  const critical = errors.filter(e => e.severity === 'CRITICAL').length
  const high = errors.filter(e => e.severity === 'HIGH').length
  const medium = errors.filter(e => e.severity === 'MEDIUM').length
  const low = errors.filter(e => e.severity === 'LOW').length

  return {
    patient: doc.header.patient,
    summary: {
      totalVisits: visits.length,
      visitDateRange: {
        first: visits[0]?.assessment?.date || doc.header.dateOfService,
        last: visits[visits.length - 1]?.assessment?.date || doc.header.dateOfService
      },
      errorCount: {
        critical,
        high,
        medium,
        low,
        total: errors.length
      },
      scoring
    },
    timeline: buildTimeline(visits, errors),
    errors,
    corrections: generateCorrections(doc, errors)
  }
}
