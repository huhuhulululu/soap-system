/**
 * 批量续写测试 — 严格按核心生产脚本审计标准
 *
 * 合规标准来源: demo-bilateral-shoulder-full-test.ts / demo-bilateral-knee-full-test.ts
 * 方法: 直接对生成器输出文本做 text.includes() + 对 state 做纵向/横向逻辑审计
 * 不经过 parser，不需要格式适配
 *
 * 用法: npx tsx scripts/batch-continuation-test.ts [--rounds 3] [--verbose]
 */

import {
  exportSOAPAsText,
  exportTXSeriesAsText,
} from '../src/index'
import type { GenerationContext, TXSeriesTextItem } from '../src/index'
import type { TXVisitState } from '../src/generator/tx-sequence-engine'

// ── CLI 参数 ──
const args = process.argv.slice(2)
const ROUNDS = parseInt(args.find((_, i, a) => a[i - 1] === '--rounds') || '3')
const VERBOSE = args.includes('--verbose')

// ── 测试矩阵 ──
const BODY_PARTS = ['SHOULDER', 'KNEE', 'NECK', 'LBP', 'ELBOW'] as const
const LATERALITIES = ['left', 'right', 'bilateral'] as const
const INSURANCES = ['OPTUM', 'WC', 'HF'] as const
const CHRONICITIES = ['Acute', 'Sub Acute', 'Chronic'] as const
const TX_COUNT = 11

const LOCAL_PATTERNS: Record<string, string> = {
  SHOULDER: 'Qi Stagnation, Blood Stasis',
  KNEE: 'Cold-Damp + Wind-Cold',
  NECK: 'Qi Stagnation, Blood Stasis',
  LBP: 'Qi Stagnation, Blood Stasis',
  ELBOW: 'Qi Stagnation',
}
const SYSTEMIC_PATTERNS: Record<string, string> = {
  SHOULDER: 'Qi & Blood Deficiency',
  KNEE: 'Kidney Yang Deficiency',
  NECK: 'Liver Qi Stagnation',
  LBP: 'Kidney Qi Deficiency',
  ELBOW: 'Qi Deficiency',
}

// ── 保险类型→针刺协议类型 (来自 soap-generator.ts INSURANCE_NEEDLE_MAP) ──
const IS_FULL_CODE: Record<string, boolean> = {
  NONE: true, WC: true, VC: true, ELDERPLAN: true,
  HF: false, OPTUM: false,
}
const BODY_AREA_TEXT: Record<string, string[]> = {
  SHOULDER: ['shoulder'],
  KNEE: ['Knee area', 'knee'],
  NECK: ['neck'],
  LBP: ['lower back', 'back'],
  ELBOW: ['elbow'],
}
// NECK/LBP bilateral 不分左右 ROM，只有一个 Cervical/Lumbar
const HAS_BILATERAL_ROM: Record<string, boolean> = {
  SHOULDER: true, KNEE: true, NECK: false, LBP: false, ELBOW: true,
}
// ELBOW 没有 Inspection 行
const HAS_INSPECTION: Record<string, boolean> = {
  SHOULDER: true, KNEE: true, NECK: true, LBP: true, ELBOW: false,
}
// NECK/LBP bilateral 针刺协议不写 "right neck"/"left neck"
const HAS_BILATERAL_NEEDLE_SIDES: Record<string, boolean> = {
  SHOULDER: true, KNEE: true, NECK: false, LBP: false, ELBOW: false,
}
const ROM_HEADER_TEXT: Record<string, string[]> = {
  SHOULDER: ['Shoulder Muscles Strength'],
  KNEE: ['Knee Muscles Strength'],
  NECK: ['Cervical Muscles Strength'],
  LBP: ['Lumbar Muscles Strength'],
  ELBOW: ['Elbow Muscles Strength'],
}

// ── 结果收集 ──
interface Issue { visit: string; field: string; msg: string; severity: 'ERROR' | 'WARNING' }
interface TestResult {
  label: string; bodyPart: string; laterality: string; insurance: string; chronicity: string; round: number
  pass: boolean; crashed: boolean; error?: string
  templateIssues: Issue[]; logicIssues: Issue[]
}
const results: TestResult[] = []

// ══════════════════════════════════════════════════════════════
//  模板合规审计 (text.includes 方式，与生产脚本一致)
// ══════════════════════════════════════════════════════════════

function auditIE(text: string, bp: string, lat: string, ins: string, localPattern: string, systemicPattern: string): Issue[] {
  const issues: Issue[] = []
  const e = (field: string, msg: string) => issues.push({ visit: 'IE', field, msg, severity: 'ERROR' })
  const w = (field: string, msg: string) => issues.push({ visit: 'IE', field, msg, severity: 'WARNING' })

  // S — 来自 generateSubjective
  if (!text.includes('INITIAL EVALUATION')) e('S.noteType', '缺少 INITIAL EVALUATION')
  if (!text.includes('Patient c/o')) e('S.complaint', '缺少 Patient c/o')
  if (lat === 'bilateral' && !text.toLowerCase().includes('bilateral')) e('S.laterality', '缺少 bilateral')
  if (!BODY_AREA_TEXT[bp]?.some(k => text.toLowerCase().includes(k.toLowerCase()))) e('S.bodyPart', `缺少身体部位关键词`)
  if (!text.includes('Pain Scale:')) e('S.painScale', '缺少 Pain Scale:')
  if (!/Pain [Ff]requency:/i.test(text)) e('S.painFrequency', '缺少 Pain Frequency')
  if (!text.includes('without radiation')) w('S.radiation', '缺少 without radiation')
  // IE Pain Scale 默认值: SHOULDER=7/6/7-6, 其他=8/6/8
  if (bp === 'SHOULDER') {
    if (!text.includes('Worst: 7') || !text.includes('Best: 6')) w('S.painDefault', 'SHOULDER IE Pain 应为 7/6')
  } else {
    if (!text.includes('Worst: 8') || !text.includes('Best: 6')) w('S.painDefault', `${bp} IE Pain 应为 8/6`)
  }
  // ADL 格式: KNEE/LBP="difficulty with ADLs like", SHOULDER/NECK="difficulty of"
  if (bp === 'KNEE' || bp === 'LBP') {
    if (!text.includes('difficulty with ADLs like')) e('S.adlFormat', `${bp} IE ADL 应为 "difficulty with ADLs like"`)
  } else if (bp === 'SHOULDER' || bp === 'NECK') {
    if (!text.includes('difficulty of')) e('S.adlFormat', `${bp} IE ADL 应为 "difficulty of"`)
  }

  // O — 来自 generateObjective
  if (HAS_INSPECTION[bp]) {
    // SHOULDER: "Inspection:" 无空格; KNEE/LBP/NECK: "Inspection: " 有空格
    if (bp === 'SHOULDER') {
      if (!text.includes('Inspection:')) e('O.inspection', '缺少 Inspection:')
    } else {
      if (!text.includes('Inspection:')) e('O.inspection', '缺少 Inspection:')
    }
  }
  if (!text.includes('Muscles Testing:')) e('O.musclesTesting', '缺少 Muscles Testing:')
  if (!text.includes('Tightness muscles')) e('O.tightness', '缺少 Tightness muscles')
  if (!/Tenderness muscle/i.test(text)) e('O.tenderness', '缺少 Tenderness muscle')
  if (!text.includes('Muscles spasm')) e('O.spasm', '缺少 Muscles spasm')
  if (!text.toLowerCase().includes('tongue')) e('O.tongue', '缺少舌象')
  if (!text.toLowerCase().includes('pulse')) e('O.pulse', '缺少脉象')

  // bilateral ROM — SHOULDER/KNEE 分左右，ELBOW 用 Bilateral，NECK/LBP 不分
  if (lat === 'bilateral' && HAS_BILATERAL_ROM[bp]) {
    const romKeys = ROM_HEADER_TEXT[bp] || []
    if (romKeys.length > 0) {
      const hasRight = romKeys.some(k => text.includes('Right ' + k) || text.includes('Right' + k))
      const hasLeft = romKeys.some(k => text.includes('Left ' + k) || text.includes('Left' + k))
      const hasBilateral = romKeys.some(k => text.includes('Bilateral ' + k) || text.includes('Bilateral' + k))
      if (!hasRight && !hasLeft && !hasBilateral) e('O.rom', '缺少 bilateral ROM')
    }
  } else if (lat !== 'bilateral') {
    const romKeys = ROM_HEADER_TEXT[bp] || []
    if (romKeys.length > 0 && !romKeys.some(k => text.includes(k))) e('O.rom', '缺少 ROM')
  }

  // A — 来自 generateAssessment
  if (!text.includes('TCM Dx:')) e('A.tcmDx', '缺少 TCM Dx:')
  if (!text.includes(localPattern)) e('A.localPattern', `缺少局部证型 ${localPattern}`)
  if (!text.includes(systemicPattern)) e('A.systemicPattern', `缺少整体证型 ${systemicPattern}`)
  if (!text.includes('Acupuncture Eval was done today')) e('A.evalArea', '缺少 Acupuncture Eval')

  // P — 来自 generatePlanIE + generateNeedleProtocol
  if (!text.includes('Initial Evaluation')) e('P.evaluationType', '缺少 Initial Evaluation')
  if (!text.includes('Short Term Goal')) e('P.shortTermGoal', '缺少 Short Term Goal')
  if (!text.includes('Long Term Goal')) e('P.longTermGoal', '缺少 Long Term Goal')
  if (!text.includes('Select Needle Size')) e('P.needleSize', '缺少 Select Needle Size')
  if (!text.includes('Documentation')) e('P.documentation', '缺少 Documentation')

  // 针刺协议: full code (WC/VC/ELDERPLAN/NONE) 有 4 步; 97810 (OPTUM/HF) 单步
  const isFullCode = IS_FULL_CODE[ins] ?? false
  if (isFullCode) {
    if (!text.includes('Front Points:')) e('P.frontPoints', '缺少 Front Points:')
    if (!text.includes('Back Points')) e('P.backPoints', '缺少 Back Points')
    // bilateral + full code: SHOULDER/KNEE 有 right/left 在针刺步骤中
    if (lat === 'bilateral' && HAS_BILATERAL_NEEDLE_SIDES[bp]) {
      const bpLower = bp.toLowerCase()
      if (!text.includes('right ' + bpLower) && !text.includes('Right ' + bpLower)) e('P.needleRight', `缺少 right ${bpLower}`)
      if (!text.includes('left ' + bpLower) && !text.includes('Left ' + bpLower)) e('P.needleLeft', `缺少 left ${bpLower}`)
    }
  } else {
    // 97810 简化协议: 单步, Back Points only, 15 mins
    if (!text.includes('Back Points:')) e('P.backPoints', '缺少 Back Points:')
  }

  return issues
}

function auditTX(text: string, idx: number, bp: string, lat: string, localPattern: string, ins: string): Issue[] {
  const issues: Issue[] = []
  const label = `TX${idx}`
  const e = (field: string, msg: string) => issues.push({ visit: label, field, msg, severity: 'ERROR' })
  const w = (field: string, msg: string) => issues.push({ visit: label, field, msg, severity: 'WARNING' })

  // S — 来自 generateSubjectiveTX
  if (!text.includes('Follow up visit')) e('S.noteType', '缺少 Follow up visit')
  if (!text.includes('Patient reports:')) e('S.patientReports', '缺少 Patient reports:')
  if (!text.includes('improvement of symptom(s)')) e('S.symptomChange', '非好转分支')
  if (!text.includes('Patient still c/o')) e('S.continuedSymptom', '缺少 Patient still c/o')
  if (!text.includes('Pain Scale:') || !text.includes('/10')) e('S.painScale', '缺少 Pain Scale 格式')
  if (!text.includes('Pain frequency:')) e('S.painFrequency', '缺少 Pain frequency:')

  // O — 来自 generateObjective
  if (HAS_INSPECTION[bp] && !/Inspection:/i.test(text)) e('O.inspection', '缺少 Inspection:')
  if (!text.includes('Muscles Testing:')) e('O.musclesTesting', '缺少 Muscles Testing:')
  if (!text.toLowerCase().includes('tongue')) e('O.tongue', '缺少舌象')
  if (!text.toLowerCase().includes('pulse')) e('O.pulse', '缺少脉象')

  // bilateral ROM
  if (lat === 'bilateral' && HAS_BILATERAL_ROM[bp]) {
    const romKeys = ROM_HEADER_TEXT[bp] || []
    if (romKeys.length > 0) {
      const hasRight = romKeys.some(k => text.includes('Right ' + k) || text.includes('Right' + k))
      const hasLeft = romKeys.some(k => text.includes('Left ' + k) || text.includes('Left' + k))
      const hasBilateral = romKeys.some(k => text.includes('Bilateral ' + k) || text.includes('Bilateral' + k))
      if (!hasRight && !hasLeft && !hasBilateral) e('O.rom', '缺少 bilateral ROM')
    }
  }

  // A — 来自 generateAssessmentTX (各部位格式不同)
  if (bp === 'KNEE' || bp === 'SHOULDER') {
    if (!text.includes('continues treatment for in')) e('A.continueTreatment', `缺少 "continues treatment for in"`)
  } else if (bp === 'NECK') {
    if (!text.includes('continue treatment for neck area')) e('A.continueTreatment', '缺少 NECK 格式')
  } else {
    if (!/continues treatment for/i.test(text)) e('A.continueTreatment', '缺少 continues treatment for')
  }
  if (!text.includes('general condition is')) e('A.generalCondition', '缺少 general condition is')
  if (!text.includes('compared with last treatment')) e('A.comparison', '缺少 compared with last treatment')
  if (!text.includes('Patient tolerated')) e('A.tolerated', '缺少 Patient tolerated')
  if (!text.includes('No adverse side effect')) e('A.noAdverse', '缺少 No adverse side effect')
  if (!text.includes(localPattern)) e('A.localPattern', `缺少局部证型`)

  // P — 来自 generatePlanTX + generateNeedleProtocol
  if (!text.includes("Today's treatment principles:")) e('P.treatmentPrinciples', '缺少治则')
  if (!text.includes('Select Needle Size')) e('P.needleSize', '缺少针号')
  if (!text.includes('Documentation')) e('P.documentation', '缺少 Documentation')

  const isFullCode = IS_FULL_CODE[ins] ?? false
  if (isFullCode) {
    if (!text.includes('Front Points:')) e('P.frontPoints', '缺少 Front Points:')
    if (!text.includes('Back Points')) e('P.backPoints', '缺少 Back Points')
    if (lat === 'bilateral' && HAS_BILATERAL_NEEDLE_SIDES[bp]) {
      const bpLower = bp.toLowerCase()
      if (!text.includes('right ' + bpLower) && !text.includes('Right ' + bpLower)) e('P.needleRight', `缺少 right ${bpLower}`)
      if (!text.includes('left ' + bpLower) && !text.includes('Left ' + bpLower)) e('P.needleLeft', `缺少 left ${bpLower}`)
    }
    if ((lat === 'bilateral' && (bp === 'SHOULDER' || bp === 'KNEE')) || bp === 'NECK') {
      const step4 = text.match(/4\..+?without electrical stimulation/s)
      if (!step4) w('P.step4Estim', 'Step 4 应为 without electrical stimulation')
    }
  } else {
    if (!text.includes('without electrical stimulation')) e('P.noEstim', '97810 协议应为 without electrical stimulation')
  }

  return issues
}

// ══════════════════════════════════════════════════════════════
//  逻辑一致性审计 (直接读 state，与生产脚本一致)
// ══════════════════════════════════════════════════════════════

const SEV_ORDER = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
const TIGHT_ORDER = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']

function auditLogic(series: TXSeriesTextItem[], lat: string): Issue[] {
  const issues: Issue[] = []
  const e = (visit: string, detail: string) => issues.push({ visit, field: 'logic', msg: detail, severity: 'ERROR' })
  const w = (visit: string, detail: string) => issues.push({ visit, field: 'logic', msg: detail, severity: 'WARNING' })

  // 5.1 疼痛单调递减
  let prevPain = 10
  for (const item of series) {
    if (item.state.painScaleCurrent > prevPain + 0.01) {
      e(`TX${item.visitIndex}`, `疼痛反弹: ${item.state.painScaleCurrent.toFixed(1)} > ${prevPain.toFixed(1)}`)
    }
    prevPain = item.state.painScaleCurrent
  }
  const finalPain = series[series.length - 1].state.painScaleCurrent
  if (finalPain > 7) w('TX11', `最终疼痛 ${finalPain.toFixed(1)} 仍较高`)

  // 5.2 severity 单调
  let prevSevIdx = 4
  for (const item of series) {
    const idx = SEV_ORDER.indexOf(item.state.severityLevel)
    if (idx >= 0 && idx > prevSevIdx) {
      w(`TX${item.visitIndex}`, `severity 反弹: "${item.state.severityLevel}"`)
    }
    if (idx >= 0) prevSevIdx = idx
  }

  // 5.3 横向链: S → O → A
  for (const item of series) {
    const s = item.state.soaChain.subjective
    const a = item.state.soaChain.assessment
    if (s.painChange === 'improved') {
      if (a.present.includes('exacerbate') || a.present.includes('no change')) {
        e(`TX${item.visitIndex}`, `S 好转但 A "${a.present}"`)
      }
      if (a.patientChange === 'increased' || a.patientChange === 'remained the same') {
        e(`TX${item.visitIndex}`, `S 好转但 A.patientChange="${a.patientChange}"`)
      }
    }
    const o = item.state.soaChain.objective
    const anyObjImproved = o.tightnessTrend !== 'stable' || o.tendernessTrend !== 'stable' || o.romTrend !== 'stable' || o.strengthTrend !== 'stable'
    if (anyObjImproved && a.physicalChange === 'remained the same') {
      w(`TX${item.visitIndex}`, `O 有变化但 A.physicalChange="remained the same"`)
    }
  }

  // 5.4 bilateral 不对齐
  if (lat === 'bilateral' && series.length > 1) {
    let allSame = true
    for (const item of series) {
      if (!item.state.sideProgress) {
        e(`TX${item.visitIndex}`, '双侧缺少 sideProgress')
      } else if (Math.abs(item.state.sideProgress.left - item.state.sideProgress.right) >= 0.01) {
        allSame = false
      }
    }
    if (allSame) e('全部TX', '左右侧进度完全相同')
  }

  // 5.5 Plan 跨访次不变
  const planTexts = series.map(item => {
    const idx = item.text.indexOf('Plan\n')
    return idx >= 0 ? item.text.slice(idx) : ''
  })
  for (let i = 1; i < planTexts.length; i++) {
    if (planTexts[i] !== planTexts[0]) {
      w(`TX${i + 1}`, 'Plan 内容与 TX1 不一致')
      break
    }
  }

  // 5.6 generalCondition 跨访次一致
  const conditions = series.map(i => i.state.generalCondition)
  if (!conditions.every(c => c === conditions[0])) {
    e('全部TX', `generalCondition 不一致: ${[...new Set(conditions)].join(', ')}`)
  }

  // 5.7 Tightness grading 纵向单调
  let prevTightIdx = -1
  for (const item of series) {
    const idx = TIGHT_ORDER.indexOf(item.state.tightnessGrading.toLowerCase())
    if (prevTightIdx >= 0 && idx > prevTightIdx) {
      e(`TX${item.visitIndex}`, `Tightness 回退: "${item.state.tightnessGrading}"`)
    }
    if (idx >= 0) prevTightIdx = idx
  }

  // 5.8 文本中 Pain Scale 与 state 一致
  for (const item of series) {
    const painStr = item.state.painScaleCurrent.toFixed(1)
    const painInt = Math.round(item.state.painScaleCurrent)
    if (!item.text.includes(`${painStr} /10`) && !item.text.includes(`${painInt} /10`)) {
      w(`TX${item.visitIndex}`, `文本 Pain Scale 与 state (${painStr}) 不匹配`)
    }
  }

  return issues
}

// ══════════════════════════════════════════════════════════════
//  单组合测试
// ══════════════════════════════════════════════════════════════

function runCase(label: string, bp: string, lat: string, ins: string, chr: string, round: number): TestResult {
  const r: TestResult = { label, bodyPart: bp, laterality: lat, insurance: ins, chronicity: chr, round, pass: false, crashed: false, templateIssues: [], logicIssues: [] }
  try {
    const ieCtx: GenerationContext = {
      noteType: 'IE', insuranceType: ins as any, primaryBodyPart: bp as any, laterality: lat as any,
      localPattern: LOCAL_PATTERNS[bp], systemicPattern: SYSTEMIC_PATTERNS[bp],
      chronicityLevel: chr as any, severityLevel: 'moderate to severe', hasPacemaker: false,
    }
    const ieText = exportSOAPAsText(ieCtx)
    r.templateIssues.push(...auditIE(ieText, bp, lat, ins, LOCAL_PATTERNS[bp], SYSTEMIC_PATTERNS[bp]))

    const txCtx: GenerationContext = { ...ieCtx, noteType: 'TX' }
    const series = exportTXSeriesAsText(txCtx, { txCount: TX_COUNT })
    for (const item of series) {
      r.templateIssues.push(...auditTX(item.text, item.visitIndex, bp, lat, LOCAL_PATTERNS[bp], ins))
    }

    r.logicIssues.push(...auditLogic(series, lat))

    const errors = [...r.templateIssues, ...r.logicIssues].filter(i => i.severity === 'ERROR')
    r.pass = errors.length === 0
  } catch (e: any) {
    r.crashed = true
    r.error = e.message || String(e)
  }
  return r
}

// ══════════════════════════════════════════════════════════════
//  主流程
// ══════════════════════════════════════════════════════════════

console.log(`\n🔬 批量续写测试 (核心生产脚本审计标准)`)
console.log(`   身体部位: ${BODY_PARTS.join(', ')}`)
console.log(`   侧别: ${LATERALITIES.join(', ')}`)
console.log(`   保险: ${INSURANCES.join(', ')}`)
console.log(`   慢性度: ${CHRONICITIES.join(', ')}`)
console.log(`   每组合重复: ${ROUNDS} 轮`)
const totalCases = BODY_PARTS.length * LATERALITIES.length * INSURANCES.length * CHRONICITIES.length * ROUNDS
console.log(`   总测试数: ${totalCases}\n`)

let done = 0
for (const bp of BODY_PARTS) {
  for (const lat of LATERALITIES) {
    for (const ins of INSURANCES) {
      for (const chr of CHRONICITIES) {
        for (let round = 1; round <= ROUNDS; round++) {
          const label = `${bp}/${lat}/${ins}/${chr}/R${round}`
          const r = runCase(label, bp, lat, ins, chr, round)
          results.push(r)
          done++
          if (r.crashed) {
            console.log(`  💥 [${done}/${totalCases}] ${label} ERROR: ${r.error}`)
          } else if (VERBOSE || !r.pass) {
            const tplErr = r.templateIssues.filter(i => i.severity === 'ERROR').length
            const tplWarn = r.templateIssues.filter(i => i.severity === 'WARNING').length
            const logErr = r.logicIssues.filter(i => i.severity === 'ERROR').length
            const logWarn = r.logicIssues.filter(i => i.severity === 'WARNING').length
            const icon = r.pass ? '✅' : '❌'
            console.log(`  ${icon} [${done}/${totalCases}] ${label}  tpl=${tplErr}E/${tplWarn}W  logic=${logErr}E/${logWarn}W`)
            if (!r.pass && VERBOSE) {
              for (const i of [...r.templateIssues, ...r.logicIssues].filter(x => x.severity === 'ERROR')) {
                console.log(`      ⤷ [${i.visit}] ${i.field}: ${i.msg}`)
              }
            }
          } else if (done % 50 === 0) {
            process.stdout.write(`  ⏳ ${done}/${totalCases}...\n`)
          }
        }
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  汇总
// ══════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(80))
console.log('📊 汇总报告')
console.log('='.repeat(80))

const passed = results.filter(r => r.pass)
const crashed = results.filter(r => r.crashed)
const failed = results.filter(r => !r.pass && !r.crashed)

console.log(`\n  总计: ${results.length}`)
console.log(`  ✅ 通过: ${passed.length}`)
console.log(`  ❌ 失败: ${failed.length}`)
console.log(`  💥 崩溃: ${crashed.length}`)
console.log(`  通过率: ${(passed.length / results.length * 100).toFixed(1)}%`)

if (failed.length + crashed.length > 0) {
  console.log('\n--- 按身体部位 ---')
  for (const bp of BODY_PARTS) {
    const sub = results.filter(r => r.bodyPart === bp)
    const f = sub.filter(r => !r.pass).length
    console.log(`  ${bp}: ${sub.length - f}/${sub.length} 通过`)
  }
  console.log('\n--- 按侧别 ---')
  for (const lat of LATERALITIES) {
    const sub = results.filter(r => r.laterality === lat)
    const f = sub.filter(r => !r.pass).length
    console.log(`  ${lat}: ${sub.length - f}/${sub.length} 通过`)
  }
  console.log('\n--- 按保险 ---')
  for (const ins of INSURANCES) {
    const sub = results.filter(r => r.insurance === ins)
    const f = sub.filter(r => !r.pass).length
    console.log(`  ${ins}: ${sub.length - f}/${sub.length} 通过`)
  }

  // 高频错误 Top 20
  const errFreq = new Map<string, number>()
  for (const r of [...failed, ...crashed]) {
    for (const i of [...r.templateIssues, ...r.logicIssues].filter(x => x.severity === 'ERROR')) {
      const key = i.field + ': ' + i.msg.replace(/TX\d+/, 'TX*')
      errFreq.set(key, (errFreq.get(key) || 0) + 1)
    }
    if (r.error) errFreq.set('CRASH: ' + r.error.slice(0, 80), (errFreq.get('CRASH: ' + r.error.slice(0, 80)) || 0) + 1)
  }
  const topErrors = [...errFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  console.log('\n--- 高频错误 Top 20 ---')
  for (const [msg, count] of topErrors) {
    console.log(`  [${count}x] ${msg}`)
  }
}

if (crashed.length > 0) {
  console.log('\n--- 崩溃详情 ---')
  const seen = new Set<string>()
  for (const r of crashed) {
    const key = `${r.bodyPart}/${r.laterality}: ${r.error}`
    if (!seen.has(key)) { seen.add(key); console.log(`  💥 ${key}`) }
  }
}

console.log('\n' + (passed.length === results.length ? '🎉 全部通过！' : '⛔ 存在问题，请查看上方详情。'))
process.exit(passed.length === results.length ? 0 : 1)
