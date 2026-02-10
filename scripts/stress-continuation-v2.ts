/**
 * 续写功能高压测试 v2 — 严格对齐 soap-generator.ts 静态/动态文本
 *
 * 覆盖 SPEC: specs/continuation-stress-test.spec.md v1.1
 * 用法: npx tsx scripts/stress-continuation-v2.ts [--verbose] [--bp KNEE] [--rounds 3]
 */

import {
  exportSOAPAsText,
  exportTXSeriesAsText,
} from '../src/index'
import type { GenerationContext, TXSeriesTextItem } from '../src/index'
import { generateTXSequenceStates, type TXVisitState } from '../src/generator/tx-sequence-engine'
import { generateContinuation } from '../frontend/src/services/generator.js'

// ── CLI ──
const args = process.argv.slice(2)
const VERBOSE = args.includes('--verbose')
const FILTER_BP = args.find((_, i, a) => a[i - 1] === '--bp') || ''
const ROUNDS = parseInt(args.find((_, i, a) => a[i - 1] === '--rounds') || '3')

// ── 常量 (镜像 soap-generator.ts) ──
const INSURANCE_NEEDLE: Record<string, 'full' | '97810'> = {
  NONE: 'full', WC: 'full', VC: 'full', ELDERPLAN: 'full',
  HF: '97810', OPTUM: '97810',
}
const BODY_PART_AREA: Record<string, string> = {
  SHOULDER: 'shoulder area', KNEE: 'Knee area', NECK: 'neck', LBP: 'lower back', ELBOW: 'elbow',
}
const BODY_PART_NAME: Record<string, string> = {
  SHOULDER: 'shoulder', KNEE: 'knee', NECK: 'neck', LBP: 'lower back', ELBOW: 'elbow',
}
const TIGHT_ORDER = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
const LOCAL_PATTERNS: Record<string, string> = {
  SHOULDER: 'Qi Stagnation, Blood Stasis', KNEE: 'Cold-Damp + Wind-Cold',
  NECK: 'Qi Stagnation, Blood Stasis', LBP: 'Qi Stagnation, Blood Stasis', ELBOW: 'Qi Stagnation',
}
const SYSTEMIC_PATTERNS: Record<string, string> = {
  SHOULDER: 'Qi & Blood Deficiency', KNEE: 'Kidney Yang Deficiency',
  NECK: 'Liver Qi Stagnation', LBP: 'Kidney Qi Deficiency', ELBOW: 'Qi Deficiency',
}

// ── 测试矩阵 ──
interface Case { bp: string; lat: string; ins: string; chr: string; startTx: number; genCount: number }
const BODY_PARTS = ['SHOULDER', 'KNEE', 'NECK', 'LBP', 'ELBOW']
const LATERALITIES = ['left', 'right', 'bilateral']
const INSURANCES = ['OPTUM', 'WC', 'HF']
const CHRONICITIES = ['Acute', 'Sub Acute', 'Chronic']

function buildCases(): Case[] {
  const cases: Case[] = []
  for (const bp of BODY_PARTS) {
    if (FILTER_BP && bp !== FILTER_BP.toUpperCase()) continue
    // 核心矩阵: bilateral × 每种保险 × Chronic
    for (const ins of INSURANCES) {
      cases.push({ bp, lat: 'bilateral', ins, chr: 'Chronic', startTx: 2, genCount: 3 })
    }
    // 侧别 × 慢性度
    for (const chr of CHRONICITIES) {
      cases.push({ bp, lat: 'left', ins: 'OPTUM', chr, startTx: 2, genCount: 3 })
    }
    // 边界: 尾段续写
    cases.push({ bp, lat: 'bilateral', ins: 'OPTUM', chr: 'Chronic', startTx: 9, genCount: 2 })
  }
  return cases
}

// ── Issue 收集 ──
interface Issue { ac: string; severity: 'ERROR' | 'WARN'; msg: string }
type E = (ac: string, msg: string) => void
type W = (ac: string, msg: string) => void

// ══════════════════════════════════════════════════════════════
//  审计: 纵向一致性 (AC-2 ~ AC-8)
// ══════════════════════════════════════════════════════════════

function auditLongitudinal(
  inputState: TXVisitState, inputText: string,
  states: TXVisitState[], texts: string[],
  bp: string, ins: string,
): Issue[] {
  const issues: Issue[] = []
  const e: E = (ac, msg) => issues.push({ ac, severity: 'ERROR', msg })
  const w: W = (ac, msg) => issues.push({ ac, severity: 'WARN', msg })
  if (!states.length) return issues

  const first = states[0]

  // ── AC-2: Pain ──
  // 容差 0.1: parser 返回整数 pain, 引擎内部用浮点+snap, 存在精度丢失
  // pain scale 最小有意义刻度为 1 分, 0.1 以内的差异属于噪声
  if (first.painScaleCurrent > inputState.painScaleCurrent + 0.1)
    e('AC-2.1', `续写TX${first.visitIndex} pain ${first.painScaleCurrent.toFixed(1)} > 输入TX ${inputState.painScaleCurrent.toFixed(1)}`)

  let prev = first.painScaleCurrent
  for (let i = 1; i < states.length; i++) {
    if (states[i].painScaleCurrent > prev + 0.01)
      e('AC-2.2', `TX${states[i].visitIndex} pain ${states[i].painScaleCurrent.toFixed(1)} > TX${states[i-1].visitIndex} ${prev.toFixed(1)}`)
    prev = states[i].painScaleCurrent
  }

  const delta = inputState.painScaleCurrent - first.painScaleCurrent
  if (delta < 0.5 || delta > 1.5)
    w('AC-2.3', `首次续写降幅 ${delta.toFixed(1)} 不在 [0.5, 1.5]`)

  if (states.length >= 3 && states.every(s => Math.abs(s.painScaleCurrent - first.painScaleCurrent) < 0.01))
    w('AC-2.4', `${states.length}个续写TX pain全部=${first.painScaleCurrent.toFixed(1)}`)

  for (const s of states) {
    const label = s.painScaleLabel
    const text = texts[states.indexOf(s)]
    if (!text.includes(`Pain Scale: ${label} /10`))
      e('AC-2.5', `TX${s.visitIndex} 文本缺少 "Pain Scale: ${label} /10"`)
  }

  // ── AC-3: Tenderness ──
  const tenderGrade = (grading: string): number => {
    const m = grading.match(/\+(\d)/)
    return m ? parseInt(m[1]) : -1
  }
  const inputTG = tenderGrade(inputState.tendernessGrading)
  const firstTG = tenderGrade(first.tendernessGrading)
  if (inputTG >= 0 && firstTG > inputTG)
    e('AC-3.1', `续写TX${first.visitIndex} tenderness +${firstTG} > 输入TX +${inputTG}`)

  let prevTG = firstTG
  for (let i = 1; i < states.length; i++) {
    const g = tenderGrade(states[i].tendernessGrading)
    if (g > prevTG && prevTG >= 0)
      e('AC-3.2', `TX${states[i].visitIndex} tenderness +${g} > TX${states[i-1].visitIndex} +${prevTG}`)
    if (g >= 0) prevTG = g
  }

  if (bp === 'KNEE') {
    for (const s of states) {
      if (s.tendernessGrading.includes('withdraws immediately'))
        e('AC-3.4', `TX${s.visitIndex} KNEE 使用了 SHOULDER 的 tenderness 文本`)
    }
  }
  if (bp === 'SHOULDER') {
    for (const s of states) {
      if (s.tendernessGrading.includes('noxious stimulus'))
        e('AC-3.5', `TX${s.visitIndex} SHOULDER 使用了 KNEE 的 tenderness 文本`)
    }
  }

  // ── AC-4: Tightness ──
  const tightIdx = (g: string) => TIGHT_ORDER.indexOf(g.toLowerCase())
  const inputTI = tightIdx(inputState.tightnessGrading)
  const firstTI = tightIdx(first.tightnessGrading)
  if (inputTI >= 0 && firstTI > inputTI)
    e('AC-4.1', `续写TX${first.visitIndex} tightness "${first.tightnessGrading}" > 输入TX "${inputState.tightnessGrading}"`)

  let prevTI = firstTI
  for (let i = 1; i < states.length; i++) {
    const ti = tightIdx(states[i].tightnessGrading)
    if (ti > prevTI && prevTI >= 0)
      e('AC-4.2', `TX${states[i].visitIndex} tightness "${states[i].tightnessGrading}" 回退`)
    if (ti >= 0) prevTI = ti
  }

  // ── AC-5: Spasm ──
  const spasmGrade = (g: string): number => {
    const m = g.match(/\([\+]?(\d)\)/)
    return m ? parseInt(m[1]) : -1
  }
  let prevSG = spasmGrade(first.spasmGrading)
  for (let i = 1; i < states.length; i++) {
    const sg = spasmGrade(states[i].spasmGrading)
    if (sg > prevSG && prevSG >= 0)
      e('AC-5.1', `TX${states[i].visitIndex} spasm +${sg} > TX${states[i-1].visitIndex} +${prevSG}`)
    if (sg >= 0) prevSG = sg
  }
  for (const s of states) {
    if (!/\([\+]?\d\)\s*=/.test(s.spasmGrading))
      e('AC-5.2', `TX${s.visitIndex} spasm 格式异常: "${s.spasmGrading.slice(0,30)}"`)
  }

  // ── AC-6: GeneralCondition ──
  for (const s of states) {
    if (s.generalCondition !== inputState.generalCondition)
      e('AC-6.1', `TX${s.visitIndex} generalCondition "${s.generalCondition}" ≠ 输入TX "${inputState.generalCondition}"`)
    if (!['good', 'fair', 'poor'].includes(s.generalCondition))
      e('AC-6.3', `TX${s.visitIndex} generalCondition "${s.generalCondition}" 非法`)
  }

  // ── AC-7: Tongue/Pulse ──
  const refTongue = first.tonguePulse.tongue
  const refPulse = first.tonguePulse.pulse
  for (const s of states) {
    if (s.tonguePulse.tongue !== refTongue || s.tonguePulse.pulse !== refPulse)
      e('AC-7.1', `TX${s.visitIndex} 舌脉不一致`)
  }
  for (let i = 0; i < texts.length; i++) {
    if (!texts[i].includes('tongue\n') || !texts[i].includes('pulse\n'))
      e('AC-7.2', `TX${states[i].visitIndex} 文本缺少 tongue/pulse 格式`)
  }

  // ── AC-8: SOA Chain ──
  for (const s of states) {
    const sub = s.soaChain.subjective
    const ass = s.soaChain.assessment
    if (sub.painChange === 'improved') {
      if (ass.present.includes('exacerbate') || ass.present.includes('no change'))
        e('AC-8.1', `TX${s.visitIndex} S好转但A="${ass.present}"`)
      if (ass.patientChange === 'increased' || ass.patientChange === 'remained the same')
        e('AC-8.2', `TX${s.visitIndex} S好转但A.patientChange="${ass.patientChange}"`)
    }
    const obj = s.soaChain.objective
    const anyImproved = obj.tightnessTrend !== 'stable' || obj.tendernessTrend !== 'stable' ||
                        obj.romTrend !== 'stable' || obj.strengthTrend !== 'stable'
    if (anyImproved && ass.physicalChange === 'remained the same')
      w('AC-8.3', `TX${s.visitIndex} O有变化但A.physicalChange="remained the same"`)
  }

  return issues
}

// ══════════════════════════════════════════════════════════════
//  审计: 针刺协议 (AC-9)
// ══════════════════════════════════════════════════════════════

function auditNeedle(
  inputText: string, texts: string[], states: TXVisitState[],
  bp: string, ins: string, lat: string,
): Issue[] {
  const issues: Issue[] = []
  const e: E = (ac, msg) => issues.push({ ac, severity: 'ERROR', msg })

  const isFullCode = INSURANCE_NEEDLE[ins] === 'full'
  const inputHas60 = inputText.includes('60 mins')

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i]
    const vi = states[i].visitIndex

    if (inputHas60 && t.includes('15 mins') && !t.includes('60 mins'))
      e('AC-9.1', `TX${vi} 从60min退化为15min`)

    if (!isFullCode) {
      if (!t.includes('Total Operation Time: 15 mins'))
        e('AC-9.2', `TX${vi} OPTUM/HF 应为15min`)
      if (!t.includes('without electrical stimulation'))
        e('AC-9.2', `TX${vi} 97810 应含 "without electrical stimulation"`)
      if (t.includes('Front Points:'))
        e('AC-9.2', `TX${vi} 97810 不应有 Front Points`)
    } else {
      if (!t.includes('Total Operation Time: 60 mins'))
        e('AC-9.3', `TX${vi} WC full code 应为60min`)
      if (!t.includes('Front Points:'))
        e('AC-9.3', `TX${vi} full code 缺少 Front Points`)
      if (!t.includes('Back Points'))
        e('AC-9.3', `TX${vi} full code 缺少 Back Points`)

      // Step 4 电刺激规则
      if (bp === 'KNEE' && !t.includes('left knee without electrical stimulation'))
        e('AC-9.4', `TX${vi} KNEE Step4 应硬编码 "left knee without electrical stimulation"`)
      if (bp === 'SHOULDER') {
        // SHOULDER bodyPartName = 'shoulder' → "for left shoulder without"
        // 但实际代码用 bodyPartName = 'Shoulder' (BODY_PART_NAMES 是小写 'shoulder')
        // 检查: "left shoulder without electrical stimulation" 或 "left Shoulder without"
        if (!t.includes('left shoulder without electrical stimulation') &&
            !t.includes('left Shoulder without electrical stimulation'))
          e('AC-9.5', `TX${vi} SHOULDER Step4 应硬编码 without`)
      }
      if (bp === 'NECK' && !t.includes('without electrical stimulation'))
        e('AC-9.6', `TX${vi} NECK Step4 应含 without electrical stimulation`)

      // bilateral 侧别
      if (lat === 'bilateral') {
        if (bp === 'KNEE') {
          if (!t.includes('right knee')) e('AC-9.8', `TX${vi} 缺少 "right knee"`)
          if (!t.includes('left knee')) e('AC-9.8', `TX${vi} 缺少 "left knee"`)
        }
        if (bp === 'SHOULDER') {
          const hasR = t.includes('right shoulder') || t.includes('right Shoulder')
          const hasL = t.includes('left shoulder') || t.includes('left Shoulder')
          if (!hasR) e('AC-9.9', `TX${vi} 缺少 "right shoulder"`)
          if (!hasL) e('AC-9.9', `TX${vi} 缺少 "left shoulder"`)
        }
        if (bp === 'NECK') {
          if (t.includes('right neck') || t.includes('left neck'))
            e('AC-9.10', `TX${vi} NECK 不应含侧别`)
        }
        if (bp === 'LBP') {
          if (t.includes('right lower back') || t.includes('left lower back'))
            e('AC-9.10', `TX${vi} LBP 不应含侧别`)
        }
      }
    }
  }
  return issues
}

// ══════════════════════════════════════════════════════════════
//  审计: 续写衔接 (AC-10 ~ AC-13)
// ══════════════════════════════════════════════════════════════

function auditContinuity(
  inputState: TXVisitState, inputText: string,
  states: TXVisitState[], texts: string[],
  bp: string, lat: string,
): Issue[] {
  const issues: Issue[] = []
  const e: E = (ac, msg) => issues.push({ ac, severity: 'ERROR', msg })
  const w: W = (ac, msg) => issues.push({ ac, severity: 'WARN', msg })
  if (!states.length) return issues

  // ── AC-10: PainTypes ──
  const extractPT = (t: string) => {
    const m = t.match(/Patient still c\/o\s+(.+?)\s+pain/i)
    return m ? m[1].split(/,\s*/).map(s => s.trim().toLowerCase()) : []
  }
  const inputPT = extractPT(inputText)
  const firstPT = extractPT(texts[0] || '')
  if (inputPT.length > 0 && firstPT.length > 0) {
    if (!inputPT.some(t => firstPT.includes(t)))
      e('AC-10.1', `painTypes 完全突变: [${inputPT}] → [${firstPT}]`)
  }

  // ── AC-11: Inspection ──
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i]; const vi = states[i].visitIndex
    if (bp === 'SHOULDER') {
      // "Inspection:" 无空格, 在 Muscles Testing 前
      if (!t.includes('Inspection:'))
        e('AC-11.1', `TX${vi} SHOULDER 缺少 "Inspection:"`)
      const inspIdx = t.indexOf('Inspection:')
      const mtIdx = t.indexOf('Muscles Testing:')
      if (inspIdx >= 0 && mtIdx >= 0 && inspIdx > mtIdx)
        e('AC-11.3', `TX${vi} SHOULDER Inspection 应在 Muscles Testing 前`)
    } else if (bp === 'KNEE' || bp === 'LBP' || bp === 'NECK') {
      if (!t.includes('Inspection: '))
        e('AC-11.2', `TX${vi} ${bp} 缺少 "Inspection: " (有空格)`)
      // 应在 ROM 后 (ROM 标题含 "Muscles Strength")
      const romIdx = t.lastIndexOf('Muscles Strength')
      const inspIdx = t.indexOf('Inspection: ')
      if (romIdx >= 0 && inspIdx >= 0 && inspIdx < romIdx)
        e('AC-11.4', `TX${vi} ${bp} Inspection 应在 ROM 后`)
    } else if (bp === 'ELBOW') {
      if (t.includes('Inspection:') || t.includes('Inspection '))
        e('AC-11.5', `TX${vi} ELBOW 不应有 Inspection`)
    }
  }

  // ── AC-12: SymptomScale ──
  const extractScale = (t: string): number | null => {
    const m = t.match(/scale as (\d+)%/)
    return m ? parseInt(m[1]) : null
  }
  const inputScale = extractScale(inputText)
  const firstScale = extractScale(texts[0] || '')
  if (inputScale != null && firstScale != null && firstScale > inputScale)
    e('AC-12.1', `symptomScale 恶化: ${inputScale}% → ${firstScale}%`)

  let prevScale = firstScale
  for (let i = 1; i < texts.length; i++) {
    const s = extractScale(texts[i] || '')
    if (prevScale != null && s != null && s > prevScale)
      w('AC-12.2', `TX${states[i].visitIndex} symptomScale ${s}% > ${prevScale}%`)
    if (s != null) prevScale = s
  }

  // ── AC-13: Bilateral sideProgress ──
  if (lat === 'bilateral') {
    let allSame = true
    for (const s of states) {
      if (!s.sideProgress)
        e('AC-13.1', `TX${s.visitIndex} bilateral 缺少 sideProgress`)
      else if (Math.abs(s.sideProgress.left - s.sideProgress.right) >= 0.01)
        allSame = false
    }
    if (allSame && states.length > 1 && states[0].sideProgress)
      e('AC-13.2', `bilateral 左右侧进度完全相同`)
  } else {
    for (const s of states) {
      if (s.sideProgress)
        w('AC-13.3', `TX${s.visitIndex} 非bilateral 不应有 sideProgress`)
    }
  }

  return issues
}

// ══════════════════════════════════════════════════════════════
//  审计: 模板合规 (AC-14 ~ AC-18)
// ══════════════════════════════════════════════════════════════

function auditTemplate(
  texts: string[], states: TXVisitState[],
  bp: string, lat: string, ins: string, localPattern: string,
): Issue[] {
  const issues: Issue[] = []
  const e: E = (ac, msg) => issues.push({ ac, severity: 'ERROR', msg })
  const w: W = (ac, msg) => issues.push({ ac, severity: 'WARN', msg })

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i]; const vi = states[i].visitIndex; const s = states[i]
    const pfx = `TX${vi}`

    // ── AC-18: Section 结构 ──
    if (!t.includes('Subjective\n')) e('AC-18.1', `${pfx} 缺少 "Subjective\\n"`)
    if (!t.includes('Objective\n')) e('AC-18.2', `${pfx} 缺少 "Objective\\n"`)
    if (!t.includes('Assessment\n')) e('AC-18.3', `${pfx} 缺少 "Assessment\\n"`)
    if (!t.includes('Plan\n')) e('AC-18.4', `${pfx} 缺少 "Plan\\n"`)
    // 顺序
    const sIdx = t.indexOf('Subjective\n')
    const oIdx = t.indexOf('Objective\n')
    const aIdx = t.indexOf('Assessment\n')
    const pIdx = t.indexOf('Plan\n')
    if (sIdx >= 0 && oIdx >= 0 && aIdx >= 0 && pIdx >= 0) {
      if (!(sIdx < oIdx && oIdx < aIdx && aIdx < pIdx))
        e('AC-18.5', `${pfx} SOAP 顺序错误`)
    }

    // ── AC-14: Subjective ──
    if (!t.includes('Follow up visit\n')) e('AC-14.1', `${pfx} 缺少 "Follow up visit"`)
    if (!t.includes('Patient reports: there is ')) e('AC-14.2', `${pfx} 缺少 "Patient reports: there is "`)
    if (!t.includes('improvement of symptom(s)')) e('AC-14.3', `${pfx} 缺少 "improvement of symptom(s)"`)
    if (!t.includes('Patient still c/o ')) e('AC-14.4', `${pfx} 缺少 "Patient still c/o "`)

    // Pain 介词 + bodyPart
    if (bp === 'KNEE') {
      if (!t.includes(`pain in ${lat === 'bilateral' ? 'bilateral' : lat} Knee area`))
        e('AC-14.6', `${pfx} KNEE 缺少正确的 pain 介词格式`)
    } else if (bp === 'SHOULDER') {
      if (!t.includes(`pain in ${lat === 'bilateral' ? 'bilateral' : lat} shoulder area`))
        e('AC-14.6', `${pfx} SHOULDER 缺少正确的 pain 介词格式`)
    } else if (bp === 'NECK') {
      if (lat === 'bilateral') {
        if (!t.includes('pain in neck area'))
          e('AC-14.7', `${pfx} NECK bilateral 应为 "pain in neck area"`)
      }
    } else if (bp === 'LBP') {
      if (!t.includes('pain on lower back area'))
        e('AC-14.8', `${pfx} LBP 应为 "pain on lower back area"`)
    }

    if (!t.includes('without radiation, associated with muscles '))
      e('AC-14.9', `${pfx} 缺少 "without radiation, associated with muscles "`)
    if (!/\(scale as \d+%\)/.test(t))
      e('AC-14.10', `${pfx} 缺少 "(scale as N%)"`)

    // ADL 格式
    if (bp === 'KNEE') {
      // "difficulty {adl}" 无 "of" — 但不能误匹配 "difficulty of"
      if (t.includes('difficulty of ') && !t.includes('difficulty with'))
        e('AC-14.11', `${pfx} KNEE ADL 不应有 "of"`)
    } else if (bp === 'SHOULDER' || bp === 'NECK') {
      if (!t.includes('difficulty of '))
        e('AC-14.12', `${pfx} ${bp} ADL 应含 "difficulty of"`)
    } else if (bp === 'LBP') {
      if (!t.includes('difficulty with ADLs like'))
        e('AC-14.13', `${pfx} LBP ADL 应含 "difficulty with ADLs like"`)
    }

    // Pain Scale 格式
    if (!t.includes('Pain Scale: ') || !t.includes(' /10'))
      e('AC-14.14', `${pfx} 缺少 "Pain Scale: X /10"`)
    // Pain frequency 小写 f
    if (!t.includes('Pain frequency: '))
      e('AC-14.15', `${pfx} 缺少 "Pain frequency: " (小写f)`)

    // ── AC-15: Objective ──
    if (!t.includes('Muscles Testing:\n'))
      e('AC-15.1', `${pfx} 缺少 "Muscles Testing:"`)
    if (!t.includes('Tightness muscles noted along '))
      e('AC-15.2', `${pfx} 缺少 "Tightness muscles noted along "`)
    if (!t.includes('Grading Scale: '))
      e('AC-15.3', `${pfx} 缺少 "Grading Scale: "`)
    // Tenderness text 按身体部位 (TENDERNESS_TEXT_MAP: KNEE/LBP=单数, SHOULDER/NECK/DEFAULT=复数)
    if (bp === 'KNEE' || bp === 'LBP') {
      if (!t.includes('Tenderness muscle noted along'))
        e('AC-15.4', `${pfx} ${bp} 缺少 "Tenderness muscle noted along" (单数)`)
    } else {
      if (!t.includes('Tenderness muscles noted along'))
        e('AC-15.4', `${pfx} ${bp} 缺少 "Tenderness muscles noted along" (复数)`)
    }
    // Tenderness label: KNEE="Tenderness Scale:", 其他="Grading Scale:"
    if (bp === 'KNEE') {
      if (!t.includes('Tenderness Scale:'))
        e('AC-15.5', `${pfx} KNEE 缺少 "Tenderness Scale:"`)
    } else {
      // 注意: "Grading Scale:" 同时用于 tightness 和 tenderness, 只需确认存在
    }
    if (!t.includes('Muscles spasm noted along '))
      e('AC-15.6', `${pfx} 缺少 "Muscles spasm noted along "`)
    if (!t.includes('Frequency Grading Scale:'))
      e('AC-15.7', `${pfx} 缺少 "Frequency Grading Scale:"`)

    // bilateral ROM
    if (lat === 'bilateral') {
      if (bp === 'KNEE') {
        if (!t.includes('Right Knee Muscles Strength') || !t.includes('Left Knee Muscles Strength'))
          e('AC-15.8', `${pfx} bilateral KNEE 缺少双侧 ROM`)
      } else if (bp === 'SHOULDER') {
        if (!t.includes('Right Shoulder Muscles Strength') || !t.includes('Left Shoulder Muscles Strength'))
          e('AC-15.9', `${pfx} bilateral SHOULDER 缺少双侧 ROM`)
      }
    }
    if (bp === 'NECK' && !t.includes('Cervical Muscles Strength'))
      e('AC-15.10', `${pfx} NECK 缺少 "Cervical Muscles Strength"`)
    if (bp === 'LBP' && !t.includes('Lumbar Muscles Strength'))
      e('AC-15.11', `${pfx} LBP 缺少 "Lumbar Muscles Strength"`)

    // 舌脉格式
    if (!t.includes('tongue\n') || !t.includes('pulse\n'))
      e('AC-15.12', `${pfx} 缺少 "tongue\\n...pulse\\n..." 格式`)

    // ── AC-16: Assessment ──
    if (bp === 'KNEE' || bp === 'SHOULDER') {
      if (!t.includes(`continues treatment for in ${lat}`))
        e('AC-16.1', `${pfx} ${bp} 缺少 "continues treatment for in ${lat}"`)
    } else if (bp === 'NECK') {
      if (!t.includes('Patient continue treatment for neck area'))
        e('AC-16.2', `${pfx} NECK 缺少 "Patient continue treatment for neck area"`)
    } else if (bp === 'LBP') {
      if (!t.includes('continues treatment for lower back area'))
        e('AC-16.3', `${pfx} LBP 缺少 "continues treatment for lower back area"`)
    }
    if (!t.includes("general condition is "))
      e('AC-16.4', `${pfx} 缺少 "general condition is"`)
    if (!t.includes('compared with last treatment'))
      e('AC-16.5', `${pfx} 缺少 "compared with last treatment"`)
    if (!t.includes('Patient tolerated '))
      e('AC-16.8', `${pfx} 缺少 "Patient tolerated"`)
    if (!t.includes('No adverse side effect post treatment'))
      e('AC-16.9', `${pfx} 缺少 "No adverse side effect post treatment"`)
    if (!t.includes(localPattern))
      e('AC-16.10', `${pfx} 缺少局部证型 "${localPattern}"`)

    // ── AC-17: Plan ──
    if (!t.includes("Today's treatment principles:\n"))
      e('AC-17.1', `${pfx} 缺少 "Today's treatment principles:"`)
    if (!t.includes('to speed up the recovery, soothe the tendon'))
      e('AC-17.2', `${pfx} 缺少治则尾句`)
    if (!t.includes('Select Needle Size'))
      e('AC-17.3', `${pfx} 缺少 "Select Needle Size"`)
    if (!t.includes('Daily acupuncture treatment for '))
      e('AC-17.4', `${pfx} 缺少 "Daily acupuncture treatment for"`)
    if (!t.includes('Documentation'))
      e('AC-17.5', `${pfx} 缺少 "Documentation"`)
    if (!t.includes('Removing and properly disposing of needles'))
      e('AC-17.6', `${pfx} 缺少 "Removing and properly disposing of needles"`)
    if (!t.includes('Post treatment service and education patient'))
      e('AC-17.7', `${pfx} 缺少 "Post treatment service..."`)
    if (!t.includes('Greeting patient, Review of the chart'))
      e('AC-17.8', `${pfx} TX Step1 缺少 "Greeting patient, Review of the chart"`)

    // ── AC-19: 文本质量 ──
    if (t.includes('Assesment') && !t.includes('Assessment'))
      w('AC-19.1', `${pfx} 拼写错误 "Assesment"`)
    if (t.includes('continue to be emphasize'))
      w('AC-19.2', `${pfx} 语法错误 "continue to be emphasize"`)
  }

  return issues
}

// ══════════════════════════════════════════════════════════════
//  主流程
// ══════════════════════════════════════════════════════════════

const cases = buildCases()
const totalRuns = cases.length * ROUNDS

console.log(`\n🔥 续写高压测试 v2 (SPEC v1.1)`)
console.log(`   用例: ${cases.length} × ${ROUNDS}轮 = ${totalRuns} 次`)
console.log(`   方法: 生成 IE+TX1~TXn → 拼接文本 → generateContinuation 续写\n`)

interface RunResult {
  label: string; pass: boolean; crashed: boolean; error?: string
  issues: Issue[]
}
const results: RunResult[] = []
let done = 0

for (const c of cases) {
  for (let round = 1; round <= ROUNDS; round++) {
    done++
    const label = `${c.bp}/${c.lat}/${c.ins}/${c.chr}/TX${c.startTx}+${c.genCount}/R${round}`
    const local = LOCAL_PATTERNS[c.bp] || 'Qi Stagnation'
    const systemic = SYSTEMIC_PATTERNS[c.bp] || 'Qi Deficiency'

    try {
      // 1. 生成 IE + TX1~TXn
      const ieCtx: GenerationContext = {
        noteType: 'IE', insuranceType: c.ins as any, primaryBodyPart: c.bp as any,
        laterality: c.lat as any, localPattern: local, systemicPattern: systemic,
        chronicityLevel: c.chr as any, severityLevel: 'moderate to severe', hasPacemaker: false,
      }
      const ieText = exportSOAPAsText(ieCtx)
      const txCtx: GenerationContext = { ...ieCtx, noteType: 'TX' }
      const fullSeries = exportTXSeriesAsText(txCtx, { txCount: 11 })

      // 取前 startTx 个 TX
      const inputTxs = fullSeries.slice(0, c.startTx)
      const lastInputTx = inputTxs[inputTxs.length - 1]

      // 2. 拼接文本 (模拟 PDF 格式)
      const header = 'DOE, JOHN (DOB: 01/01/1980 ID: 1234567890) Date of Service: 01/15/2025 Printed on: 01/15/2025'
      const fix = (t: string) => t
        .replace(/^Subjective\n/m, 'Subjective:\n')
        .replace(/^Objective\n/m, 'Objective:\n')
        .replace(/^Assess?ment\n/m, 'Assessment:\n')
        .replace(/^Plan\n/m, 'Plan:\n')
      let combined = header + '\n' + fix(ieText)
      for (const tx of inputTxs) combined += '\n\n' + fix(tx.text)

      // 3. 续写
      const result = generateContinuation(combined, {
        insuranceType: c.ins,
        treatmentTime: 60,
        generateCount: c.genCount,
      })

      if (result.error) {
        results.push({ label, pass: false, crashed: true, error: result.error, issues: [] })
        console.log(`  💥 [${done}/${totalRuns}] ${label}: ${result.error}`)
        continue
      }

      // AC-1 基础检查
      const ac1: Issue[] = []
      const e1: E = (ac, msg) => ac1.push({ ac, severity: 'ERROR', msg })
      if (result.context?.noteType !== 'TX') e1('AC-1.5', `noteType="${result.context?.noteType}"`)
      if (!result.context?.previousIE) e1('AC-1.6', 'previousIE 为空')
      if (result.parseSummary?.existingTxCount !== c.startTx)
        e1('AC-1.3', `existingTxCount=${result.parseSummary?.existingTxCount} 期望=${c.startTx}`)
      if (result.parseSummary?.toGenerate > 11 - c.startTx)
        e1('AC-1.4', `toGenerate=${result.parseSummary?.toGenerate} > ${11 - c.startTx}`)

      // 4. 审计
      const contStates: TXVisitState[] = result.visits.map((v: any) => v.state)
      const contTexts: string[] = result.visits.map((v: any) => v.text)

      const allIssues = [
        ...ac1,
        ...auditLongitudinal(lastInputTx.state, lastInputTx.text, contStates, contTexts, c.bp, c.ins),
        ...auditNeedle(lastInputTx.text, contTexts, contStates, c.bp, c.ins, c.lat),
        ...auditContinuity(lastInputTx.state, lastInputTx.text, contStates, contTexts, c.bp, c.lat),
        ...auditTemplate(contTexts, contStates, c.bp, c.lat, c.ins, local),
      ]

      const errors = allIssues.filter(i => i.severity === 'ERROR')
      const pass = errors.length === 0
      results.push({ label, pass, crashed: false, issues: allIssues })

      const icon = pass ? '✅' : '❌'
      const warns = allIssues.filter(i => i.severity === 'WARN').length
      if (!pass || VERBOSE) {
        console.log(`  ${icon} [${done}/${totalRuns}] ${label}  E=${errors.length} W=${warns}  (续写${result.visits.length}个TX)`)
        if (VERBOSE || !pass) {
          for (const iss of allIssues.filter(x => x.severity === 'ERROR').slice(0, 10)) {
            console.log(`      🔴 [${iss.ac}] ${iss.msg}`)
          }
          if (VERBOSE) {
            for (const iss of allIssues.filter(x => x.severity === 'WARN').slice(0, 5)) {
              console.log(`      🟡 [${iss.ac}] ${iss.msg}`)
            }
          }
        }
      } else if (done % 30 === 0) {
        process.stdout.write(`  ⏳ ${done}/${totalRuns}...\n`)
      }
    } catch (err: any) {
      results.push({ label, pass: false, crashed: true, error: err.message || String(err), issues: [] })
      console.log(`  💥 [${done}/${totalRuns}] ${label}: ${(err.message || '').slice(0, 80)}`)
    }
  }
}

// ── AC-20: 边界条件 (单独测试) ──
console.log('\n── 边界条件测试 ──')
const boundaryIssues: Issue[] = []
try {
  // AC-1.7: 空文本
  const r1 = generateContinuation('', { generateCount: 1 })
  if (!r1.error) boundaryIssues.push({ ac: 'AC-1.7', severity: 'ERROR', msg: '空文本未返回 error' })
  else console.log(`  ✅ AC-1.7 空文本 → "${r1.error.slice(0, 40)}"`)

  // AC-1.8: 无 IE — parser 可能先报解析失败
  const r2 = generateContinuation('TREATMENT NOTE #1\nSUBJECTIVE:\nPain: 5/10', { generateCount: 1 })
  if (!r2.error)
    boundaryIssues.push({ ac: 'AC-1.8', severity: 'ERROR', msg: `无IE应返回error` })
  else console.log(`  ✅ AC-1.8 无IE → "${r2.error.slice(0, 50)}"`)

  // AC-20.3: generateCount 超量截断
  const ieCtx3: GenerationContext = {
    noteType: 'IE', insuranceType: 'OPTUM', primaryBodyPart: 'KNEE',
    laterality: 'bilateral', localPattern: 'Cold-Damp + Wind-Cold',
    systemicPattern: 'Kidney Yang Deficiency', chronicityLevel: 'Chronic',
    severityLevel: 'moderate to severe', hasPacemaker: false,
  }
  const ieText3 = exportSOAPAsText(ieCtx3)
  const header3 = 'DOE, JOHN (DOB: 01/01/1980 ID: 1234567890) Date of Service: 01/15/2025 Printed on: 01/15/2025'
  const fix3 = (t: string) => t.replace(/^Subjective\n/m, 'Subjective:\n').replace(/^Objective\n/m, 'Objective:\n').replace(/^Assess?ment\n/m, 'Assessment:\n').replace(/^Plan\n/m, 'Plan:\n')
  const r3 = generateContinuation(header3 + '\n' + fix3(ieText3), { generateCount: 50 })
  if (r3.error) boundaryIssues.push({ ac: 'AC-20.3', severity: 'ERROR', msg: `超量截断不应报错: "${r3.error}"` })
  else if (r3.visits.length > 11) boundaryIssues.push({ ac: 'AC-20.3', severity: 'ERROR', msg: `超量未截断: ${r3.visits.length}` })
  else console.log(`  ✅ AC-20.3 超量截断 → ${r3.visits.length}个TX`)
} catch (err: any) {
  boundaryIssues.push({ ac: 'AC-20', severity: 'ERROR', msg: `边界测试崩溃: ${err.message}` })
}

// ── AC-21: 性能 ──
console.log('\n── 性能测试 ──')
const perfIssues: Issue[] = []
try {
  const ieCtxP: GenerationContext = {
    noteType: 'IE', insuranceType: 'OPTUM', primaryBodyPart: 'KNEE',
    laterality: 'bilateral', localPattern: 'Cold-Damp + Wind-Cold',
    systemicPattern: 'Kidney Yang Deficiency', chronicityLevel: 'Chronic',
    severityLevel: 'moderate to severe', hasPacemaker: false,
  }
  const ieTextP = exportSOAPAsText(ieCtxP)
  const txCtxP: GenerationContext = { ...ieCtxP, noteType: 'TX' }
  const seriesP = exportTXSeriesAsText(txCtxP, { txCount: 11 })
  const headerP = 'DOE, JOHN (DOB: 01/01/1980 ID: 1234567890) Date of Service: 01/15/2025 Printed on: 01/15/2025'
  const fixP = (t: string) => t.replace(/^Subjective\n/m, 'Subjective:\n').replace(/^Objective\n/m, 'Objective:\n').replace(/^Assess?ment\n/m, 'Assessment:\n').replace(/^Plan\n/m, 'Plan:\n')
  let combinedP = headerP + '\n' + fixP(ieTextP) + '\n\n' + fixP(seriesP[0].text) + '\n\n' + fixP(seriesP[1].text)

  const t0 = performance.now()
  const rP = generateContinuation(combinedP, { generateCount: 3 })
  const elapsed = performance.now() - t0
  if (elapsed > 2000) perfIssues.push({ ac: 'AC-21.1', severity: 'WARN', msg: `单次耗时 ${elapsed.toFixed(0)}ms > 2000ms` })
  console.log(`  ${elapsed <= 2000 ? '✅' : '🟡'} AC-21.1 单次续写3TX: ${elapsed.toFixed(0)}ms`)
} catch (err: any) {
  perfIssues.push({ ac: 'AC-21', severity: 'WARN', msg: `性能测试崩溃: ${err.message}` })
}

// ══════════════════════════════════════════════════════════════
//  汇总
// ══════════════════════════════════════════════════════════════

const allBoundaryAndPerf = [...boundaryIssues, ...perfIssues]
const passed = results.filter(r => r.pass)
const crashed = results.filter(r => r.crashed)
const failed = results.filter(r => !r.pass && !r.crashed)

console.log('\n' + '='.repeat(80))
console.log('📊 续写高压测试 v2 汇总')
console.log('='.repeat(80))
console.log(`\n  矩阵测试: ${results.length}`)
console.log(`  ✅ 通过: ${passed.length}`)
console.log(`  ❌ 失败: ${failed.length}`)
console.log(`  💥 崩溃: ${crashed.length}`)
console.log(`  通过率: ${(passed.length / results.length * 100).toFixed(1)}%`)
console.log(`  边界/性能: ${allBoundaryAndPerf.filter(i => i.severity === 'ERROR').length}E / ${allBoundaryAndPerf.filter(i => i.severity === 'WARN').length}W`)

// 高频错误 Top 20
const errFreq = new Map<string, number>()
for (const r of [...failed, ...crashed]) {
  for (const i of r.issues.filter(x => x.severity === 'ERROR')) {
    const key = `[${i.ac}] ${i.msg.replace(/TX\d+/g, 'TX*').slice(0, 80)}`
    errFreq.set(key, (errFreq.get(key) || 0) + 1)
  }
  if (r.error) {
    const key = `[CRASH] ${r.error.slice(0, 80)}`
    errFreq.set(key, (errFreq.get(key) || 0) + 1)
  }
}
for (const i of allBoundaryAndPerf.filter(x => x.severity === 'ERROR')) {
  const key = `[${i.ac}] ${i.msg.slice(0, 80)}`
  errFreq.set(key, (errFreq.get(key) || 0) + 1)
}

if (errFreq.size > 0) {
  const top = [...errFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  console.log('\n--- 高频错误 Top 20 ---')
  for (const [msg, count] of top) {
    console.log(`  [${count}x] ${msg}`)
  }
}

// 按 AC 分类统计
const acStats = new Map<string, { e: number; w: number }>()
for (const r of results) {
  for (const i of r.issues) {
    const acGroup = i.ac.replace(/\.\d+$/, '')
    const s = acStats.get(acGroup) || { e: 0, w: 0 }
    if (i.severity === 'ERROR') s.e++; else s.w++
    acStats.set(acGroup, s)
  }
}
if (acStats.size > 0) {
  console.log('\n--- 按 AC 分类 ---')
  for (const [ac, s] of [...acStats.entries()].sort()) {
    if (s.e > 0) console.log(`  ${ac}: ${s.e}E / ${s.w}W`)
  }
}

// 按身体部位
if (failed.length + crashed.length > 0) {
  console.log('\n--- 按身体部位 ---')
  for (const bp of BODY_PARTS) {
    const sub = results.filter(r => r.label.startsWith(bp + '/'))
    const f = sub.filter(r => !r.pass).length
    if (f > 0) console.log(`  ${bp}: ${sub.length - f}/${sub.length} 通过`)
  }
}

const totalErrors = results.reduce((s, r) => s + r.issues.filter(i => i.severity === 'ERROR').length, 0)
  + allBoundaryAndPerf.filter(i => i.severity === 'ERROR').length
const totalWarns = results.reduce((s, r) => s + r.issues.filter(i => i.severity === 'WARN').length, 0)
  + allBoundaryAndPerf.filter(i => i.severity === 'WARN').length

console.log(`\n  总 ERROR: ${totalErrors}`)
console.log(`  总 WARN: ${totalWarns}`)
console.log('\n' + (totalErrors === 0 ? '🎉 全部通过！' : '⛔ 存在问题，请查看上方详情。'))
process.exit(totalErrors === 0 ? 0 : 1)
