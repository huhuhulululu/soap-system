import type { OptumNoteDocument, VisitRecord } from '../types'
import type {
  CheckInput,
  CheckOutput,
  CheckError,
  RuleSeverity,
  TimelineEntry,
  ScoreBreakdown
} from './types'

type CorrectionsGenerator = (doc: OptumNoteDocument, errors: CheckError[]) => CheckOutput['corrections']

function loadCorrectionsGenerator(): CorrectionsGenerator | null {
  // Browser bundle must stay free of server-side template filesystem deps.
  if (typeof window !== 'undefined') return null

  try {
    const req = Function('return require')() as (id: string) => { generateCorrections?: CorrectionsGenerator }
    const mod = req('./correction-generator')
    return typeof mod.generateCorrections === 'function' ? mod.generateCorrections : null
  } catch {
    return null
  }
}

function severityFromPain(pain: number): 'severe' | 'moderate to severe' | 'moderate' | 'mild to moderate' | 'mild' {
  if (pain >= 9) return 'severe'
  if (pain >= 7) return 'moderate to severe'
  if (pain >= 6) return 'moderate'
  if (pain >= 4) return 'mild to moderate'
  return 'mild'
}

function scoreByStrength(str: string): number {
  const t = str.trim()
  const map: Record<string, number> = {
    '0/5': 0, '1/5': 1, '2/5': 2, '2+/5': 2.5, '3/5': 3, '3+/5': 3.5,
    '4-/5': 3.8, '4/5': 4, '4+/5': 4.5, '5/5': 5
  }
  return map[t] ?? 4
}

function parsePainCurrent(v: VisitRecord): number {
  const ps = v.subjective.painScale as any
  if (typeof ps?.current === 'number') return ps.current
  if (typeof ps?.value === 'number') return ps.value
  if (typeof ps?.range?.max === 'number') return ps.range.max
  return 7
}

function parseGoalPainTarget(raw?: string): number | null {
  if (!raw) return null
  const nums = raw.match(/\d+/g)?.map(Number) || []
  if (nums.length === 0) return null
  return Math.min(...nums)
}

function expectedTenderMinScaleByPain(pain: number): number {
  if (pain >= 9) return 4
  if (pain >= 7) return 3
  if (pain >= 5) return 2
  return 1
}

function avgRomSeverityRank(visit: VisitRecord): number {
  const rank: Record<string, number> = { severe: 0, moderate: 1, mild: 2, normal: 3 }
  if (!visit.objective.rom.items.length) return 0
  const total = visit.objective.rom.items.reduce((s, x) => s + (rank[(x.severity || '').toLowerCase()] ?? 1), 0)
  return total / visit.objective.rom.items.length
}

function isTonePatternConsistent(localPattern: string | undefined, tongue: string, pulse: string): boolean {
  const lp = (localPattern || '').toLowerCase()
  const t = (tongue || '').toLowerCase()
  const p = (pulse || '').toLowerCase()
  if (!lp) return true
  if (lp.includes('qi stagnation')) return t.includes('thin white coat') && (p.includes('string-taut') || p.includes('wiry'))
  if (lp.includes('blood stasis')) return t.includes('purple') && p.includes('deep')
  if (lp.includes('phlegm-damp')) return (t.includes('sticky') || t.includes('white')) && (p.includes('rolling') || p.includes('slippery'))
  return true
}

function parseAdlSeverity(adlText: string): string {
  const t = (adlText || '').toLowerCase()
  if (t.includes('moderate to severe')) return 'moderate to severe'
  if (t.includes('mild to moderate')) return 'mild to moderate'
  if (t.includes('severe')) return 'severe'
  if (t.includes('moderate')) return 'moderate'
  return 'mild'
}

function frequencyLevel(v: string): number {
  const t = (v || '').toLowerCase()
  if (t.includes('intermittent')) return 0
  if (t.includes('occasional')) return 1
  if (t.includes('frequent')) return 2
  return 3
}

function trend(cur: number, prev: number): '↓' | '→' | '↑' {
  if (cur < prev) return '↓'
  if (cur > prev) return '↑'
  return '→'
}

function err(params: Omit<CheckError, 'id'>): CheckError {
  return { id: `${params.ruleId}-${params.visitIndex}-${params.field}`, ...params }
}

function compareSeverity(cur: string, prev: string): number {
  const order = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
  const c = order.indexOf(cur)
  const p = order.indexOf(prev)
  if (c < 0 || p < 0) return 0
  return c - p
}

function checkIE(visit: VisitRecord, visitIndex: number): CheckError[] {
  const errors: CheckError[] = []
  const date = visit.assessment.date || ''
  const pain = parsePainCurrent(visit)
  const expectedSev = severityFromPain(pain)
  const actualSev = parseAdlSeverity(visit.subjective.adlImpairment)

  if (actualSev !== expectedSev && !(actualSev === 'moderate to severe' && expectedSev === 'moderate')) {
    errors.push(err({
      ruleId: 'IE01',
      severity: 'HIGH',
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
      severity: 'MEDIUM',
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
      severity: 'LOW',
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
  const pain = parsePainCurrent(visit)
  const expectedSev = severityFromPain(pain)
  const actualSev = parseAdlSeverity(visit.subjective.adlImpairment)

  if (actualSev !== expectedSev && !(actualSev === 'moderate to severe' && expectedSev === 'moderate')) {
    errors.push(err({
      ruleId: 'TX01',
      severity: 'HIGH',
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
    const prevPain = parsePainCurrent(prevVisit)
    const delta = pain - prevPain
    const saysImprove = /improvement/i.test(visit.assessment.symptomChange || '')
    if (saysImprove && delta > 0) {
      errors.push(err({
        ruleId: 'TX03',
        severity: 'CRITICAL',
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

  if (prevVisit) {
    const prevGc = (prevVisit.assessment.generalCondition || '').toLowerCase()
    const curGc = (visit.assessment.generalCondition || '').toLowerCase()
    if (prevGc === 'good' && curGc === 'poor') {
      errors.push(err({
        ruleId: 'TX04',
        severity: 'LOW',
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
    if (visit.objective.tonguePulse.tongue !== ieTongue || visit.objective.tonguePulse.pulse !== iePulse) {
      errors.push(err({
        ruleId: 'TX05',
        severity: 'MEDIUM',
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
      severity: 'LOW',
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

  return errors
}

function avgRom(visit: VisitRecord): number {
  if (!visit.objective.rom.items.length) return 0
  const sum = visit.objective.rom.items.reduce((s, x) => s + (x.degrees || 0), 0)
  return sum / visit.objective.rom.items.length
}

function avgStrength(visit: VisitRecord): number {
  if (!visit.objective.rom.items.length) return 0
  const sum = visit.objective.rom.items.reduce((s, x) => s + scoreByStrength(x.strength), 0)
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

    const prevPain = parsePainCurrent(prev)
    const curPain = parsePainCurrent(cur)
    if (curPain > prevPain) {
      errors.push(err({
        ruleId: 'V01', severity: 'CRITICAL', visitDate: date, visitIndex: idx,
        section: 'S', field: 'painScale', ruleName: 'pain 不回升',
        message: '疼痛分值不应回升', expected: `<= ${prevPain}`, actual: `${curPain}`
      }))
    }

    if (cur.objective.tendernessMuscles.scale > prev.objective.tendernessMuscles.scale) {
      errors.push(err({
        ruleId: 'V02', severity: 'HIGH', visitDate: date, visitIndex: idx,
        section: 'O', field: 'tenderness', ruleName: 'tenderness 不回升',
        message: 'Tenderness scale 回升', expected: `<= +${prev.objective.tendernessMuscles.scale}`, actual: `+${cur.objective.tendernessMuscles.scale}`
      }))
    }

    const sevDelta = compareSeverity(cur.objective.tightnessMuscles.gradingScale, prev.objective.tightnessMuscles.gradingScale)
    if (sevDelta > 0) {
      errors.push(err({
        ruleId: 'V03', severity: 'HIGH', visitDate: date, visitIndex: idx,
        section: 'O', field: 'tightness', ruleName: 'tightness 不恶化',
        message: 'Tightness grading 恶化', expected: `<= ${prev.objective.tightnessMuscles.gradingScale}`, actual: cur.objective.tightnessMuscles.gradingScale
      }))
    }

    if (cur.objective.spasmMuscles.frequencyScale > prev.objective.spasmMuscles.frequencyScale) {
      errors.push(err({
        ruleId: 'V04', severity: 'MEDIUM', visitDate: date, visitIndex: idx,
        section: 'O', field: 'spasm', ruleName: 'spasm 不回升',
        message: 'Spasm scale 回升', expected: `<= +${prev.objective.spasmMuscles.frequencyScale}`, actual: `+${cur.objective.spasmMuscles.frequencyScale}`
      }))
    }

    const prevRom = avgRom(prev)
    const curRom = avgRom(cur)
    if (curRom < prevRom) {
      errors.push(err({
        ruleId: 'V05', severity: 'HIGH', visitDate: date, visitIndex: idx,
        section: 'O', field: 'rom', ruleName: 'ROM 不下降',
        message: 'ROM 平均值下降', expected: `>= ${prevRom.toFixed(1)}`, actual: curRom.toFixed(1)
      }))
    }

    const prevStr = avgStrength(prev)
    const curStr = avgStrength(cur)
    if (curStr < prevStr) {
      errors.push(err({
        ruleId: 'V06', severity: 'MEDIUM', visitDate: date, visitIndex: idx,
        section: 'O', field: 'strength', ruleName: 'strength 不下降',
        message: '肌力平均值下降', expected: `>= ${prevStr.toFixed(2)}`, actual: curStr.toFixed(2)
      }))
    }

    if (frequencyLevel(cur.subjective.painFrequency) > frequencyLevel(prev.subjective.painFrequency)) {
      errors.push(err({
        ruleId: 'V07', severity: 'MEDIUM', visitDate: date, visitIndex: idx,
        section: 'S', field: 'painFrequency', ruleName: 'frequency 不增加',
        message: '疼痛频率分级增加', expected: `<= ${prev.subjective.painFrequency}`, actual: cur.subjective.painFrequency
      }))
    }

    const saysImprove = /improvement/i.test(cur.assessment.symptomChange || '')
    if (saysImprove && curPain > prevPain) {
      errors.push(err({
        ruleId: 'V08', severity: 'CRITICAL', visitDate: date, visitIndex: idx,
        section: 'A', field: 'symptomChange', ruleName: 'S 说 improvement 但 pain 实际上升',
        message: '纵向矛盾：写改善但 pain 回升', expected: `pain <= ${prevPain}`, actual: String(curPain)
      }))
    }

    const pOverlap = jaccard(prev.plan.acupoints || [], cur.plan.acupoints || [])
    if (pOverlap < 0.4) {
      errors.push(err({
        ruleId: 'V09', severity: 'LOW', visitDate: date, visitIndex: idx,
        section: 'P', field: 'acupoints', ruleName: 'P 段跨 TX 穴位大变化',
        message: '连续 TX 穴位重叠度过低', expected: 'overlap >= 0.4', actual: pOverlap.toFixed(2)
      }))
    }
  }

  return errors
}

function penalty(sev: RuleSeverity, table: Record<RuleSeverity, number>): number {
  return table[sev]
}

function scoreDocument(errors: CheckError[], txCount: number): ScoreBreakdown {
  const ie = errors.filter(e => /^IE/.test(e.ruleId))
  const tx = errors.filter(e => /^TX/.test(e.ruleId))
  const v = errors.filter(e => /^V/.test(e.ruleId))

  const iePenaltyMap: Record<RuleSeverity, number> = { CRITICAL: 25, HIGH: 15, MEDIUM: 8, LOW: 3 }
  const txPenaltyMap: Record<RuleSeverity, number> = { CRITICAL: 15, HIGH: 8, MEDIUM: 4, LOW: 1 }
  const vPenaltyMap: Record<RuleSeverity, number> = { CRITICAL: 20, HIGH: 10, MEDIUM: 5, LOW: 2 }

  const iePenalty = ie.reduce((s, e) => s + penalty(e.severity, iePenaltyMap), 0)
  const txPenalty = tx.reduce((s, e) => s + penalty(e.severity, txPenaltyMap), 0) / Math.max(txCount, 1)
  const vPenalty = v.reduce((s, e) => s + penalty(e.severity, vPenaltyMap), 0)

  const ieConsistency = Math.max(0, 100 - iePenalty)
  const txConsistency = Math.max(0, 100 - txPenalty)
  const timelineLogic = Math.max(0, 100 - vPenalty)
  const totalScore = Math.max(0, Math.round((ieConsistency * 0.35) + (txConsistency * 0.30) + (timelineLogic * 0.35)))

  const grade: 'PASS' | 'WARNING' | 'FAIL' = totalScore >= 80 ? 'PASS' : totalScore >= 60 ? 'WARNING' : 'FAIL'
  return { ieConsistency, txConsistency, timelineLogic, totalScore, grade }
}

function buildTimeline(visits: VisitRecord[], errors: CheckError[]): TimelineEntry[] {
  return visits.map((v, i) => {
    const prev = i > 0 ? visits[i - 1] : undefined
    const pain = parsePainCurrent(v)
    const prevPain = prev ? parsePainCurrent(prev) : pain
    const curT = v.objective.tendernessMuscles.scale
    const prevT = prev ? prev.objective.tendernessMuscles.scale : curT
    const curTight = v.objective.tightnessMuscles.gradingScale
    const prevTight = prev ? prev.objective.tightnessMuscles.gradingScale : curTight
    const curSpasm = v.objective.spasmMuscles.frequencyScale
    const prevSpasm = prev ? prev.objective.spasmMuscles.frequencyScale : curSpasm
    const curF = frequencyLevel(v.subjective.painFrequency)
    const prevF = prev ? frequencyLevel(prev.subjective.painFrequency) : curF
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
  KNEE:       ['M17', 'M25.56', 'M25.46', 'M25.36', 'M76.5', 'M23', 'M22'],
  SHOULDER:   ['M25.51', 'M75', 'M79.61'],
  ELBOW:      ['M25.52', 'M77.0', 'M77.1'],
  NECK:       ['M54.2', 'M54.6', 'M47.81', 'M50'],
  LBP:        ['M54.5', 'M54.4', 'M54.3', 'M47.8', 'M51'],
  UPPER_BACK: ['M54.6', 'M54.2'],
  HIP:        ['M25.55', 'M16'],
}

const LATERALITY_ICD_SUFFIX: Record<string, string[]> = {
  right:     ['1', '91'],
  left:      ['2', '92'],
  bilateral: ['3', '93'],
}

const CPT_ESTIM = ['97813', '97814']
const CPT_NO_ESTIM = ['97810', '97811']

function checkCodes(visits: VisitRecord[]): CheckError[] {
  const errors: CheckError[] = []
  let prevDxCodes: string[] = []

  for (let i = 0; i < visits.length; i++) {
    const v = visits[i]
    const date = v.assessment.date || ''
    const isIE = v.subjective.visitType === 'INITIAL EVALUATION'
    const dx = v.diagnosisCodes
    const px = v.procedureCodes

    // DX03: must have at least one ICD
    if (dx.length === 0) {
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
            ruleId: 'DX01', severity: 'HIGH', visitDate: date, visitIndex: i,
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
            ruleId: 'DX04', severity: 'LOW', visitDate: date, visitIndex: i,
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
          ruleId: 'DX02', severity: 'MEDIUM', visitDate: date, visitIndex: i,
          section: 'A', field: 'diagnosisCodes', ruleName: 'ICD 跨 visit 一致',
          message: 'ICD 编码与上次就诊差异过大',
          expected: 'overlap >= 50%', actual: `${Math.round(overlap / total * 100)}%`
        }))
      }
    }
    prevDxCodes = curDxCodes

    // CPT01: must have at least one CPT
    if (px.length === 0) {
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
        ruleId: 'CPT03', severity: 'MEDIUM', visitDate: date, visitIndex: i,
        section: 'P', field: 'procedureCodes', ruleName: 'CPT↔时间 units 匹配',
        message: `操作时间 ${time}min 超过 15min 但缺少额外 unit CPT`,
        expected: '>= 2 acupuncture CPTs', actual: String(acuCpts.length)
      }))
    }

    // CPT04: IE should have eval code, TX should have treatment code
    const cptList = px.map(p => p.cpt)
    if (isIE && !cptList.includes('97811') && cptList.some(c => CPT_NO_ESTIM.includes(c) || CPT_ESTIM.includes(c))) {
      errors.push(err({
        ruleId: 'CPT04', severity: 'MEDIUM', visitDate: date, visitIndex: i,
        section: 'P', field: 'procedureCodes', ruleName: 'IE/TX CPT 类型正确',
        message: '初诊应使用 eval 码 97811 而非 treatment 码',
        expected: '97811', actual: cptList.join(',')
      }))
    }
  }

  return errors
}

function checkGeneratorRules(visits: VisitRecord[], insuranceType: string, treatmentTime: number): CheckError[] {
  const errors: CheckError[] = []

  for (let i = 0; i < visits.length; i++) {
    const v = visits[i]
    const date = v.assessment.date || ''
    const pain = parsePainCurrent(v)
    const isIE = v.subjective.visitType === 'INITIAL EVALUATION'

    // S2: painTypes vs localPattern
    if (v.subjective.painTypes.length > 0 && v.assessment.localPattern) {
      const painMap: Record<string, string[]> = {
        'Blood Stasis': ['pricking', 'Shooting'],
        'Cold-Damp': ['Freezing', 'Aching'],
        'Wind-Cold': ['Freezing', 'Aching'],
        'Qi Stagnation': ['Dull', 'Aching'],
        'Qi & Blood Deficiency': ['Dull', 'weighty']
      }
      const pattern = v.assessment.localPattern
      const expectedPains = Object.entries(painMap).find(([key]) => pattern.includes(key))?.[1] || []
      if (expectedPains.length > 0) {
        const hasOverlap = v.subjective.painTypes.some(p => expectedPains.includes(p))
        if (!hasOverlap) {
          errors.push(err({
            ruleId: 'S2', severity: 'MEDIUM', visitDate: date, visitIndex: i,
            section: 'S', field: 'painTypes', ruleName: 'painTypes vs localPattern',
            message: 'Pain types do not match local pattern', expected: expectedPains.join('/'), actual: v.subjective.painTypes.join(',')
          }))
        }
      }
    }

    // S3: ADL activities vs bodyPart
    if (v.subjective.adlImpairment && v.subjective.bodyPartNormalized) {
      const adlKeywords: Record<string, string[]> = {
        KNEE: ['stair', 'walk', 'stand', 'bend', 'sit', 'cook'],
        SHOULDER: ['cook', 'household', 'computer', 'driving', 'laundry', 'reach', 'comb', 'coat'],
        NECK: ['TV', 'phone', 'head', 'driving', 'gargling'],
        LBP: ['stand', 'walk', 'bend', 'chair', 'bed', 'stair', 'lift']
      }
      const keywords = adlKeywords[v.subjective.bodyPartNormalized.toUpperCase()] || []
      if (keywords.length > 0) {
        const hasKeyword = keywords.some(k => v.subjective.adlImpairment.toLowerCase().includes(k.toLowerCase()))
        if (!hasKeyword) {
          errors.push(err({
            ruleId: 'S3', severity: 'LOW', visitDate: date, visitIndex: i,
            section: 'S', field: 'adlImpairment', ruleName: 'ADL activities vs bodyPart',
            message: 'ADL description missing relevant activities', expected: keywords.join('/'), actual: 'no match'
          }))
        }
      }
    }

    // S6: Associated symptom monotonic across visits
    if (i > 0) {
      const extractSymptom = (cc: string) => {
        const match = cc.match(/muscles (weakness|soreness|heaviness|numbness|stiffness)/)
        return match ? match[1] : null
      }
      const ranks = { numbness: 4, weakness: 4, heaviness: 3, stiffness: 2, soreness: 1 }
      const curSymptom = extractSymptom(v.subjective.chiefComplaint)
      const prevSymptom = extractSymptom(visits[i-1].subjective.chiefComplaint)
      if (curSymptom && prevSymptom) {
        const curRank = ranks[curSymptom as keyof typeof ranks] || 0
        const prevRank = ranks[prevSymptom as keyof typeof ranks] || 0
        if (curRank > prevRank) {
          errors.push(err({
            ruleId: 'S6', severity: 'MEDIUM', visitDate: date, visitIndex: i,
            section: 'S', field: 'chiefComplaint', ruleName: 'Associated symptom monotonic',
            message: 'Associated symptom severity increased', expected: `<= ${prevSymptom}`, actual: curSymptom
          }))
        }
      }
    }

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
          ruleId: 'S7', severity: 'LOW', visitDate: date, visitIndex: i,
          section: 'S', field: 'muscleWeaknessScale', ruleName: 'muscleWeaknessScale vs pain',
          message: 'Muscle weakness scale too low for pain level', expected: pain >= 7 ? '>=40%' : '>=20%', actual: `${weakness}%`
        }))
      }
    }

    // O1: ROM degrees vs pain
    const normalDegrees: Record<string, Record<string, number>> = {
      knee: { flexion: 130, extension: 0 },
      lbp: { flexion: 90, extension: 30, rotation: 45 },
      shoulder: { flexion: 180, extension: 60, abduction: 180, rotation: 90 },
      neck: { flexion: 50, extension: 60, rotation: 80 }
    }
    const limitFactor = pain >= 8 ? 0.77 : pain >= 6 ? 0.85 : pain >= 3 ? 0.95 : 1.0
    const bodyPart = (v.subjective.bodyPartNormalized || '').toLowerCase()
    const normals = normalDegrees[bodyPart] || {}
    
    for (const rom of v.objective.rom.items) {
      const movement = rom.movement.toLowerCase()
      const normal = normals[movement] || (movement.includes('abduction') ? 180 : 90)
      const expected = normal * limitFactor
      if (rom.degrees > expected * 1.25 || rom.degrees < expected * 0.5) {
        errors.push(err({
          ruleId: 'O1', severity: 'MEDIUM', visitDate: date, visitIndex: i,
          section: 'O', field: 'rom.degrees', ruleName: 'ROM degrees vs pain',
          message: 'ROM degrees inconsistent with pain level', expected: `${expected.toFixed(0)}±25%`, actual: String(rom.degrees)
        }))
      }
    }

    // O2: ROM limitation label vs degrees ratio
    for (const rom of v.objective.rom.items) {
      const movement = rom.movement.toLowerCase()
      const normal = normals[movement] || 90
      const ratio = rom.degrees / normal
      const severity = rom.severity?.toLowerCase()
      if ((severity === 'normal' && ratio < 0.85) || 
          (severity === 'severe' && ratio > 0.55) ||
          (severity === 'mild' && (ratio < 0.5 || ratio > 0.95))) {
        errors.push(err({
          ruleId: 'O2', severity: 'HIGH', visitDate: date, visitIndex: i,
          section: 'O', field: 'rom.severity', ruleName: 'ROM limitation label vs degrees',
          message: 'ROM severity label inconsistent with degrees', expected: 'consistent label', actual: `${severity} at ${(ratio*100).toFixed(0)}%`
        }))
      }
    }

    // O3: Strength vs ROM limitation direction
    for (const rom of v.objective.rom.items) {
      const strength = scoreByStrength(rom.strength)
      const severity = rom.severity?.toLowerCase()
      if ((severity === 'severe' && strength > 4) || (severity === 'normal' && strength < 4)) {
        errors.push(err({
          ruleId: 'O3', severity: 'MEDIUM', visitDate: date, visitIndex: i,
          section: 'O', field: 'rom.strength', ruleName: 'Strength vs ROM limitation',
          message: 'Strength inconsistent with ROM severity', expected: severity === 'severe' ? '<=4' : '>=4', actual: String(strength)
        }))
      }
    }

    // O8: Muscles belong to bodyPart
    if (v.subjective.bodyPartNormalized) {
      const muscleKeywords: Record<string, string[]> = {
        KNEE: ['gluteus', 'piriformis', 'quadratus', 'adductor', 'ITB', 'rectus', 'gastronemius', 'hamstring', 'tibialis', 'plantar', 'achilles', 'femoris'],
        SHOULDER: ['trapezius', 'tuberosity', 'AC joint', 'levator', 'rhomboid', 'deltoid', 'bicep', 'supraspinatus', 'triceps', 'infraspinatus', 'subscapularis'],
        NECK: ['scalene', 'levator', 'trapezius', 'sternocleidomastoid', 'semispinalis', 'splenius', 'suboccipital'],
        LBP: ['iliocostalis', 'spinalis', 'longissimus', 'iliopsoas', 'quadratus', 'gluteal', 'multifidus']
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
              ruleId: 'O9', severity: 'HIGH', visitDate: date, visitIndex: i,
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
            ruleId: 'A5', severity: 'MEDIUM', visitDate: date, visitIndex: i,
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
              ruleId: 'P1', severity: 'LOW', visitDate: date, visitIndex: i,
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
        ruleId: 'P2', severity: 'LOW', visitDate: date, visitIndex: i,
        section: 'P', field: 'acupoints', ruleName: 'Acupoints reasonable count',
        message: 'Acupoints count unreasonable', expected: '2-20', actual: String(v.plan.acupoints?.length || 0)
      }))
    }

    // X1: Full chain Pain→Severity→Tightness→Tenderness consistency
    const expectedTightness = pain >= 7 ? 'moderate' : 'mild'
    const expectedTenderness = pain >= 7 ? 2 : pain <= 4 ? 2 : 1
    const actualTightness = v.objective.tightnessMuscles.gradingScale.toLowerCase()
    const actualTenderness = v.objective.tendernessMuscles.scale
    
    if ((pain >= 7 && !actualTightness.includes('moderate') && !actualTightness.includes('severe')) ||
        (pain <= 4 && (actualTightness.includes('severe') || actualTenderness > 2))) {
      errors.push(err({
        ruleId: 'X1', severity: 'HIGH', visitDate: date, visitIndex: i,
        section: 'O', field: 'tightness/tenderness', ruleName: 'Pain→Severity→Tightness→Tenderness chain',
        message: 'Inconsistent pain-tightness-tenderness chain', expected: `pain ${pain} → moderate tightness/+${expectedTenderness}`, actual: `${actualTightness}/+${actualTenderness}`
      }))
    }

    // X2: Pain→ROM→Strength chain
    const avgRomSev = avgRomSeverityRank(v)
    if ((pain >= 8 && avgRomSev > 2.5) || (pain <= 3 && avgRomSev < 0.5)) {
      errors.push(err({
        ruleId: 'X2', severity: 'MEDIUM', visitDate: date, visitIndex: i,
        section: 'O', field: 'rom', ruleName: 'Pain→ROM→Strength chain',
        message: 'ROM severity inconsistent with pain', expected: pain >= 8 ? 'not normal' : 'not severe', actual: avgRomSev > 2.5 ? 'mostly normal' : 'mostly severe'
      }))
    }

    // X3: Pattern→Tongue/Pulse→Treatment Principles chain (IE only)
    if (isIE && (v.assessment.localPattern || v.assessment.systemicPattern)) {
      const patternTongue: Record<string, string> = {
        'Blood Stasis': 'purple',
        'Qi Stagnation': 'thin white',
        'Cold-Damp': 'white',
        'Qi & Blood Deficiency': 'pale',
        'Kidney Yang': 'pale',
        'Phlegm': 'sticky'
      }
      const patterns = [v.assessment.localPattern, v.assessment.systemicPattern].filter(Boolean)
      for (const pattern of patterns) {
        const expectedTongue = Object.entries(patternTongue).find(([key]) => pattern!.includes(key))?.[1]
        if (expectedTongue && !v.objective.tonguePulse.tongue.toLowerCase().includes(expectedTongue)) {
          errors.push(err({
            ruleId: 'X3', severity: 'MEDIUM', visitDate: date, visitIndex: i,
            section: 'O', field: 'tonguePulse', ruleName: 'Pattern→Tongue/Pulse chain',
            message: 'Tongue inconsistent with pattern', expected: expectedTongue, actual: v.objective.tonguePulse.tongue
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

  const correctionsGenerator = loadCorrectionsGenerator()

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
    corrections: correctionsGenerator ? correctionsGenerator(doc, errors) : []
  }
}
