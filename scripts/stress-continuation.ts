/**
 * 续写场景高压测试
 *
 * 模拟真实续写: 先生成 IE+TX1~TX2，再从 TX2 续写 TX3~TX5
 * 检查续写TX与输入TX之间的纵向一致性
 *
 * 用法: npx tsx scripts/stress-continuation.ts [--verbose]
 */

import {
  exportSOAPAsText,
  exportTXSeriesAsText,
} from '../src/index'
import type { GenerationContext, TXSeriesTextItem } from '../src/index'
import { generateTXSequenceStates, type TXSequenceOptions, type TXVisitState } from '../src/generator/tx-sequence-engine'
import { generateContinuation } from '../frontend/src/services/generator.js'

const VERBOSE = process.argv.includes('--verbose')

// ── 测试矩阵 ──
const CASES = [
  { bp: 'KNEE',     lat: 'bilateral', ins: 'OPTUM', chr: 'Chronic', local: 'Cold-Damp + Wind-Cold',        systemic: 'Kidney Yang Deficiency' },
  { bp: 'KNEE',     lat: 'bilateral', ins: 'WC',    chr: 'Chronic', local: 'Cold-Damp + Wind-Cold',        systemic: 'Kidney Yang Deficiency' },
  { bp: 'SHOULDER', lat: 'bilateral', ins: 'OPTUM', chr: 'Chronic', local: 'Qi Stagnation, Blood Stasis',  systemic: 'Qi & Blood Deficiency' },
  { bp: 'SHOULDER', lat: 'bilateral', ins: 'WC',    chr: 'Chronic', local: 'Qi Stagnation, Blood Stasis',  systemic: 'Qi & Blood Deficiency' },
  { bp: 'NECK',     lat: 'bilateral', ins: 'OPTUM', chr: 'Chronic', local: 'Qi Stagnation, Blood Stasis',  systemic: 'Liver Qi Stagnation' },
  { bp: 'LBP',      lat: 'bilateral', ins: 'OPTUM', chr: 'Chronic', local: 'Qi Stagnation, Blood Stasis',  systemic: 'Kidney Qi Deficiency' },
  { bp: 'KNEE',     lat: 'left',      ins: 'OPTUM', chr: 'Sub Acute', local: 'Qi Stagnation',              systemic: 'Qi Deficiency' },
  { bp: 'SHOULDER', lat: 'right',     ins: 'HF',    chr: 'Acute',  local: 'Blood Stasis',                  systemic: 'Blood Deficiency' },
] as const

interface Issue { severity: 'ERROR' | 'WARN'; tag: string; msg: string }

function auditContinuation(
  inputTxState: TXVisitState,
  inputTxText: string,
  continuedStates: TXVisitState[],
  continuedTexts: string[],
  bp: string,
  ins: string,
): Issue[] {
  const issues: Issue[] = []
  const e = (tag: string, msg: string) => issues.push({ severity: 'ERROR', tag, msg })
  const w = (tag: string, msg: string) => issues.push({ severity: 'WARN', tag, msg })

  const first = continuedStates[0]
  if (!first) return issues

  // ── 1. Pain 纵向: 续写TX不应比输入TX更痛 ──
  if (first.painScaleCurrent > inputTxState.painScaleCurrent + 0.01) {
    e('PAIN_REBOUND', `续写TX${first.visitIndex} pain ${first.painScaleCurrent.toFixed(1)} > 输入TX pain ${inputTxState.painScaleCurrent.toFixed(1)}`)
  }
  // Pain 停滞: 所有续写TX的pain完全相同
  const allPainSame = continuedStates.every(s => Math.abs(s.painScaleCurrent - first.painScaleCurrent) < 0.01)
  if (allPainSame && continuedStates.length >= 3) {
    w('PAIN_STAGNANT', `${continuedStates.length}个续写TX pain全部=${first.painScaleCurrent.toFixed(1)}`)
  }

  // ── 2. Tenderness 纵向: 不应恶化 ──
  const inputTenderMatch = inputTxState.tendernessGrading.match(/\+(\d)/)
  const firstTenderMatch = first.tendernessGrading.match(/\+(\d)/)
  if (inputTenderMatch && firstTenderMatch) {
    const inputGrade = parseInt(inputTenderMatch[1])
    const firstGrade = parseInt(firstTenderMatch[1])
    if (firstGrade > inputGrade) {
      e('TENDER_REBOUND', `续写TX${first.visitIndex} tenderness +${firstGrade} > 输入TX +${inputGrade}`)
    }
  }

  // ── 3. Tightness 纵向: 不应恶化 ──
  const TIGHT_ORDER = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
  const inputTightIdx = TIGHT_ORDER.indexOf(inputTxState.tightnessGrading.toLowerCase())
  const firstTightIdx = TIGHT_ORDER.indexOf(first.tightnessGrading.toLowerCase())
  if (inputTightIdx >= 0 && firstTightIdx > inputTightIdx) {
    e('TIGHT_REBOUND', `续写TX${first.visitIndex} tightness "${first.tightnessGrading}" > 输入TX "${inputTxState.tightnessGrading}"`)
  }

  // ── 4. GeneralCondition 一致性 ──
  if (first.generalCondition !== inputTxState.generalCondition) {
    w('GC_CHANGE', `generalCondition 从 "${inputTxState.generalCondition}" 变为 "${first.generalCondition}"`)
  }

  // ── 5. 针刺协议: 时间不应突变 ──
  const inputHas60 = inputTxText.includes('60 mins')
  const firstHas60 = continuedTexts[0]?.includes('60 mins')
  const firstHas15 = continuedTexts[0]?.includes('15 mins')
  if (inputHas60 && firstHas15) {
    e('NEEDLE_DEGRADE', `针刺协议从60min退化为15min`)
  }

  // ── 6. 文本中 painTypes 突变检查 ──
  const extractPainTypes = (text: string): string[] => {
    const m = text.match(/Patient still c\/o\s+(.+?)\s+pain/i)
    if (!m) return []
    return m[1].split(/,\s*/).map(s => s.trim().toLowerCase())
  }
  const inputPainTypes = extractPainTypes(inputTxText)
  const firstPainTypes = extractPainTypes(continuedTexts[0] || '')
  if (inputPainTypes.length > 0 && firstPainTypes.length > 0) {
    const overlap = inputPainTypes.filter(t => firstPainTypes.includes(t))
    if (overlap.length === 0) {
      e('PAINTYPE_MUTATE', `painTypes 完全突变: 输入[${inputPainTypes}] → 续写[${firstPainTypes}]`)
    }
  }

  // ── 7. Inspection 突变检查 ──
  const extractInspection = (text: string): string => {
    const m = text.match(/Inspection:\s*(.+?)(?:\n|$)/i)
    return m ? m[1].trim() : ''
  }
  const inputInsp = extractInspection(inputTxText)
  const firstInsp = extractInspection(continuedTexts[0] || '')
  if (inputInsp && firstInsp && inputInsp !== firstInsp) {
    w('INSPECT_CHANGE', `inspection 从 "${inputInsp}" 变为 "${firstInsp}"`)
  }

  // ── 8. symptomScale 不应恶化 ──
  const extractScale = (text: string): number | null => {
    const m = text.match(/scale as (\d+)%/)
    return m ? parseInt(m[1]) : null
  }
  const inputScale = extractScale(inputTxText)
  const firstScale = extractScale(continuedTexts[0] || '')
  if (inputScale != null && firstScale != null && firstScale > inputScale) {
    e('SCALE_WORSEN', `symptomScale 恶化: ${inputScale}% → ${firstScale}%`)
  }

  // ── 9. 续写TX之间 pain 单调递减 ──
  let prevPain = first.painScaleCurrent
  for (let i = 1; i < continuedStates.length; i++) {
    if (continuedStates[i].painScaleCurrent > prevPain + 0.01) {
      e('PAIN_INTER_REBOUND', `TX${continuedStates[i].visitIndex} pain ${continuedStates[i].painScaleCurrent.toFixed(1)} > TX${continuedStates[i-1].visitIndex} ${prevPain.toFixed(1)}`)
    }
    prevPain = continuedStates[i].painScaleCurrent
  }

  // ── 10. Assessment 拼写检查 ──
  for (const text of continuedTexts) {
    if (text.includes('Assesment') && !text.includes('Assessment')) {
      w('SPELLING', 'Assessment 拼写为 Assesment')
    }
  }

  // ── 11. 语法检查 ──
  for (const text of continuedTexts) {
    if (text.includes('continue to be emphasize')) {
      w('GRAMMAR', '"continue to be emphasize" 语法错误')
    }
  }

  return issues
}

// ══════════════════════════════════════════════════════════════
//  主流程
// ══════════════════════════════════════════════════════════════

console.log(`\n🔥 续写场景高压测试`)
console.log(`   测试用例: ${CASES.length}`)
console.log(`   方法: 生成 IE+TX1~TX2 → 拼接文本 → generateContinuation 续写 TX3~TX5\n`)

let totalErrors = 0
let totalWarns = 0
let totalCases = 0
let passedCases = 0

for (const c of CASES) {
  totalCases++
  const label = `${c.bp}/${c.lat}/${c.ins}/${c.chr}`

  // Step 1: 生成 IE + TX1~TX2
  const ieCtx: GenerationContext = {
    noteType: 'IE', insuranceType: c.ins as any, primaryBodyPart: c.bp as any,
    laterality: c.lat as any, localPattern: c.local, systemicPattern: c.systemic,
    chronicityLevel: c.chr as any, severityLevel: 'moderate to severe', hasPacemaker: false,
  }
  const ieText = exportSOAPAsText(ieCtx)

  const txCtx: GenerationContext = { ...ieCtx, noteType: 'TX' }
  const fullSeries = exportTXSeriesAsText(txCtx, { txCount: 11 })
  const tx1 = fullSeries[0]
  const tx2 = fullSeries[1]

  // Step 2: 拼接 IE + TX1 + TX2 文本 (加 header + section 冒号，模拟 PDF 格式)
  const header = 'DOE, JOHN (DOB: 01/01/1980 ID: 1234567890) Date of Service: 01/15/2025 Printed on: 01/15/2025'
  const fixSection = (t: string) => t
    .replace(/^Subjective\n/m, 'Subjective:\n')
    .replace(/^Objective\n/m, 'Objective:\n')
    .replace(/^Assess?ment\n/m, 'Assessment:\n')
    .replace(/^Plan\n/m, 'Plan:\n')
  const combinedText = header + '\n' + fixSection(ieText) + '\n\n' + fixSection(tx1.text) + '\n\n' + fixSection(tx2.text)

  // Step 3: 续写
  const result = generateContinuation(combinedText, {
    insuranceType: c.ins,
    treatmentTime: 60,
    generateCount: 3,
  })

  if (result.error) {
    console.log(`  💥 ${label}: ${result.error}`)
    totalErrors++
    continue
  }

  // Step 4: 审计
  const continuedStates = result.visits.map((v: any) => v.state)
  const continuedTexts = result.visits.map((v: any) => v.text)
  const issues = auditContinuation(tx2.state, tx2.text, continuedStates, continuedTexts, c.bp, c.ins)

  const errors = issues.filter(i => i.severity === 'ERROR')
  const warns = issues.filter(i => i.severity === 'WARN')
  totalErrors += errors.length
  totalWarns += warns.length

  if (errors.length === 0) passedCases++

  const icon = errors.length === 0 ? '✅' : '❌'
  console.log(`  ${icon} ${label}  E=${errors.length} W=${warns.length}  (续写${result.visits.length}个TX, 已有${result.existingTxCount}个)`)

  if (VERBOSE || errors.length > 0) {
    for (const i of issues) {
      const sev = i.severity === 'ERROR' ? '🔴' : '🟡'
      console.log(`      ${sev} [${i.tag}] ${i.msg}`)
    }
  }
}

// ── 汇总 ──
console.log('\n' + '='.repeat(70))
console.log(`📊 续写高压测试汇总`)
console.log('='.repeat(70))
console.log(`  总用例: ${totalCases}`)
console.log(`  ✅ 通过: ${passedCases}`)
console.log(`  ❌ 失败: ${totalCases - passedCases}`)
console.log(`  总 ERROR: ${totalErrors}`)
console.log(`  总 WARN: ${totalWarns}`)
console.log(`  通过率: ${(passedCases / totalCases * 100).toFixed(1)}%`)
console.log()

process.exit(passedCases === totalCases ? 0 : 1)
