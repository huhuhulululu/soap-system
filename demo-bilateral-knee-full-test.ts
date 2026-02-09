/**
 * 双膝痛完整测试: 1 IE + 11 TX
 * 模板合规性审计 + 逻辑一致性审计 (KNEE 专用)
 */
import {
  exportSOAPAsText,
  exportTXSeriesAsText,
} from './src/index'
import type { GenerationContext, TXSeriesTextItem } from './src/index'
import type { TXVisitState } from './src/generator/tx-sequence-engine'

// ===================== 1. 上下文定义 =====================

const kneeIEContext: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'WC',
  primaryBodyPart: 'KNEE',
  secondaryBodyParts: ['LBP'],
  laterality: 'bilateral',
  localPattern: 'Cold-Damp + Wind-Cold',
  systemicPattern: 'Kidney Yang Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  hasPacemaker: false
}

const kneeTXContext: GenerationContext = {
  noteType: 'TX',
  insuranceType: 'WC',
  primaryBodyPart: 'KNEE',
  laterality: 'bilateral',
  localPattern: 'Cold-Damp + Wind-Cold',
  systemicPattern: 'Kidney Yang Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  hasPacemaker: false
}

// ===================== 2. 生成 IE =====================

console.log('='.repeat(100))
console.log('【IE】双侧膝盖痛初诊 (Initial Evaluation - Bilateral Knee Pain)')
console.log('='.repeat(100))
const ieText = exportSOAPAsText(kneeIEContext)
console.log(ieText)
console.log('\n')

// ===================== 3. 生成 11 TX =====================

const txSeries = exportTXSeriesAsText(kneeTXContext, { txCount: 11 })

txSeries.forEach((item: TXSeriesTextItem) => {
  console.log('='.repeat(100))
  console.log(`【TX ${item.visitIndex}/11】双侧膝盖痛第 ${item.visitIndex} 次复诊`)
  console.log(`  进度: ${(item.state.progress * 100).toFixed(1)}% | 疼痛: ${item.state.painScaleCurrent}/10 | 严重度: ${item.state.severityLevel}`)
  if (item.state.sideProgress) {
    console.log(`  左侧进度: ${(item.state.sideProgress.left * 100).toFixed(1)}% | 右侧进度: ${(item.state.sideProgress.right * 100).toFixed(1)}%`)
  }
  console.log(`  扰动因子: gap=${item.state.objectiveFactors.sessionGapDays}d, sleep=${item.state.objectiveFactors.sleepLoad}, work=${item.state.objectiveFactors.workloadLoad}`)
  console.log('='.repeat(100))
  console.log(item.text)
  console.log('\n')
})

// ===================== 4. 模板合规性审计 (KNEE 专用) =====================

console.log('\n')
console.log('#'.repeat(100))
console.log('##  KNEE 模板合规性审计 (Template Compliance Audit)')
console.log('#'.repeat(100))

interface AuditIssue {
  visit: string
  section: string
  field: string
  issue: string
  severity: 'ERROR' | 'WARNING'
}

const issues: AuditIssue[] = []

// --- 4.1 IE 模板审计 (KNEE) ---
function auditKneeIE(text: string) {
  const label = 'IE'

  // Subjective
  if (!text.includes('INITIAL EVALUATION')) issues.push({ visit: label, section: 'S', field: 'noteType', issue: '缺少 "INITIAL EVALUATION"', severity: 'ERROR' })
  if (!text.includes('Patient c/o')) issues.push({ visit: label, section: 'S', field: 'complaint', issue: '缺少 "Patient c/o"', severity: 'ERROR' })
  if (!text.includes('bilateral')) issues.push({ visit: label, section: 'S', field: 'laterality', issue: '缺少 "bilateral"', severity: 'ERROR' })
  // KNEE 模板: "Knee area" 而非 "knee area"
  if (!text.includes('Knee area')) issues.push({ visit: label, section: 'S', field: 'bodyPart', issue: '缺少 "Knee area" (K大写)', severity: 'ERROR' })
  if (!text.includes('without radiation')) issues.push({ visit: label, section: 'S', field: 'radiation', issue: '缺少 "without radiation"', severity: 'WARNING' })
  if (!text.includes('Pain Scale:')) issues.push({ visit: label, section: 'S', field: 'painScale', issue: '缺少 "Pain Scale:"', severity: 'ERROR' })
  if (!text.includes('Pain Frequency:') && !text.includes('Pain frequency:')) issues.push({ visit: label, section: 'S', field: 'painFrequency', issue: '缺少疼痛频率', severity: 'ERROR' })
  // KNEE IE ADL 格式: "There is [severity] difficulty with ADLs like [活动]" (非 TX 的 "impaired performing ADL's")
  if (!text.includes('difficulty with ADLs like')) {
    issues.push({ visit: label, section: 'S', field: 'ADL', issue: '缺少 KNEE IE ADL 格式 "difficulty with ADLs like"', severity: 'ERROR' })
  }
  // KNEE ADL 格式: "difficulty" 后无 "of"
  if (text.includes("difficulty of") && !text.includes('shoulder')) {
    issues.push({ visit: label, section: 'S', field: 'ADLFormat', issue: 'KNEE ADL 格式应为 "difficulty [活动]" 而非 "difficulty of [活动]"', severity: 'ERROR' })
  }
  if (!text.includes('Walking aid')) issues.push({ visit: label, section: 'S', field: 'walkingAid', issue: '缺少 "Walking aid"', severity: 'WARNING' })
  // KNEE: 缓解因素格式 "Changing positions, Resting, Massage can temporarily relieve the pain."
  if (!text.includes('can temporarily relieve the pain')) issues.push({ visit: label, section: 'S', field: 'relieving', issue: '缺少缓解因素', severity: 'WARNING' })
  // KNEE: "aggravated by" 后有 "." (空格+句号)
  if (!text.includes('aggravated by')) issues.push({ visit: label, section: 'S', field: 'aggravated', issue: '缺少 "aggravated by"', severity: 'ERROR' })
  // KNEE: "due to" 连词 (非 "because of")
  if (!text.includes('due to')) issues.push({ visit: label, section: 'S', field: 'connector', issue: '缺少 "due to" 连词', severity: 'WARNING' })

  // Objective
  if (!text.includes('Muscles Testing:')) issues.push({ visit: label, section: 'O', field: 'musclesTesting', issue: '缺少 "Muscles Testing:"', severity: 'ERROR' })
  if (!text.includes('Tightness muscles')) issues.push({ visit: label, section: 'O', field: 'tightness', issue: '缺少 Tightness', severity: 'ERROR' })
  // KNEE: "Tenderness muscle" (单数)
  if (!text.includes('Tenderness muscle noted along')) issues.push({ visit: label, section: 'O', field: 'tenderness', issue: '缺少 "Tenderness muscle noted along" (单数)', severity: 'ERROR' })
  // KNEE: "Tenderness Scale:" (非 "Grading Scale:")
  if (!text.includes('Tenderness Scale:')) issues.push({ visit: label, section: 'O', field: 'tendernessLabel', issue: '缺少 "Tenderness Scale:" (KNEE 专用标签)', severity: 'ERROR' })
  if (!text.includes('Muscles spasm')) issues.push({ visit: label, section: 'O', field: 'spasm', issue: '缺少 Muscles spasm', severity: 'ERROR' })
  // KNEE 双侧 ROM
  if (!text.includes('Right Knee Muscles Strength and Joint ROM')) issues.push({ visit: label, section: 'O', field: 'romRight', issue: '缺少 Right Knee ROM', severity: 'ERROR' })
  if (!text.includes('Left Knee Muscles Strength and Joint ROM')) issues.push({ visit: label, section: 'O', field: 'romLeft', issue: '缺少 Left Knee ROM', severity: 'ERROR' })
  // KNEE ROM 格式: "Flexion(fully bent):" 和 "Extension(fully straight):"
  if (!text.includes('Flexion(fully bent):')) issues.push({ visit: label, section: 'O', field: 'romFlexion', issue: '缺少 "Flexion(fully bent):" 格式', severity: 'ERROR' })
  if (!text.includes('Extension(fully straight):')) issues.push({ visit: label, section: 'O', field: 'romExtension', issue: '缺少 "Extension(fully straight):" 格式', severity: 'ERROR' })
  // KNEE: Inspection 在 ROM 之后
  if (!text.includes('Inspection:')) issues.push({ visit: label, section: 'O', field: 'inspection', issue: '缺少 "Inspection:"', severity: 'ERROR' })
  if (!text.includes('joint swelling')) issues.push({ visit: label, section: 'O', field: 'inspectionContent', issue: '缺少 "joint swelling" (KNEE 默认)', severity: 'WARNING' })
  // KNEE: Inspection 顺序 — ROM 应在 Inspection 之前
  const romIdx = text.indexOf('Right Knee Muscles Strength')
  const inspIdx = text.indexOf('Inspection:')
  if (romIdx > 0 && inspIdx > 0 && inspIdx < romIdx) {
    issues.push({ visit: label, section: 'O', field: 'inspectionOrder', issue: 'KNEE 模板 Inspection 应在 ROM 之后', severity: 'ERROR' })
  }
  if (!text.includes('tongue')) issues.push({ visit: label, section: 'O', field: 'tongue', issue: '缺少舌象', severity: 'ERROR' })
  if (!text.includes('pulse')) issues.push({ visit: label, section: 'O', field: 'pulse', issue: '缺少脉象', severity: 'ERROR' })

  // Assessment
  if (!text.includes('TCM Dx:')) issues.push({ visit: label, section: 'A', field: 'tcmDx', issue: '缺少 "TCM Dx:"', severity: 'ERROR' })
  // KNEE: "Bilateral knee pain due to" (无连字符, 无 "area")
  if (!text.includes('Bilateral knee pain due to')) issues.push({ visit: label, section: 'A', field: 'kneeFormat', issue: 'KNEE Assessment 应为 "Bilateral knee pain due to" (无连字符)', severity: 'ERROR' })
  if (!text.includes('Cold-Damp + Wind-Cold')) issues.push({ visit: label, section: 'A', field: 'localPattern', issue: '缺少局部证型', severity: 'ERROR' })
  if (!text.includes('Kidney Yang Deficiency')) issues.push({ visit: label, section: 'A', field: 'systemicPattern', issue: '缺少整体证型', severity: 'ERROR' })
  // KNEE: "Acupuncture Eval was done today on bilateral knee area."
  if (!text.includes('Acupuncture Eval was done today on bilateral knee area')) {
    issues.push({ visit: label, section: 'A', field: 'evalArea', issue: '缺少 "on bilateral knee area" 评估位置', severity: 'ERROR' })
  }

  // Plan
  if (!text.includes('Initial Evaluation')) issues.push({ visit: label, section: 'P', field: 'evaluationType', issue: '缺少 "Initial Evaluation"', severity: 'ERROR' })
  if (!text.includes('Short Term Goal')) issues.push({ visit: label, section: 'P', field: 'shortTermGoal', issue: '缺少短期目标', severity: 'ERROR' })
  if (!text.includes('Long Term Goal')) issues.push({ visit: label, section: 'P', field: 'longTermGoal', issue: '缺少长期目标', severity: 'ERROR' })
  // KNEE 专用针号
  if (!text.includes('Select Needle Size : 34#x1" ,30# x1.5",30# x2"')) {
    issues.push({ visit: label, section: 'P', field: 'needleSize', issue: 'KNEE 针号格式不符', severity: 'ERROR' })
  }
  if (!text.includes('right knee')) issues.push({ visit: label, section: 'P', field: 'needleRight', issue: '针刺协议缺少 "right knee"', severity: 'ERROR' })
  if (!text.includes('left knee')) issues.push({ visit: label, section: 'P', field: 'needleLeft', issue: '针刺协议缺少 "left knee"', severity: 'ERROR' })
  // KNEE 穴位
  if (!text.includes('GB33, GB34, GB36')) issues.push({ visit: label, section: 'P', field: 'frontRightPoints', issue: '缺少 KNEE 前穴 GB33/GB34/GB36', severity: 'ERROR' })
  if (!text.includes('SP9, XI YAN, HE DING, A SHI POINT')) issues.push({ visit: label, section: 'P', field: 'frontLeftPoints', issue: '缺少 KNEE 前穴 SP9/XI YAN/HE DING', severity: 'ERROR' })
  if (!text.includes('BL40, BL57')) issues.push({ visit: label, section: 'P', field: 'backRightPoints', issue: '缺少 KNEE 后穴 BL40/BL57', severity: 'ERROR' })
  if (!text.includes('BL23, BL55, A SHI POINTS')) issues.push({ visit: label, section: 'P', field: 'backLeftPoints', issue: '缺少 KNEE 后穴 BL23/BL55/A SHI POINTS', severity: 'ERROR' })
  // Step 4 无电刺激
  const step4Match = text.match(/4\..+?left knee (with|without) electrical stimulation/)
  if (step4Match && step4Match[1] !== 'without') {
    issues.push({ visit: label, section: 'P', field: 'step4Estim', issue: 'Step 4 应为 "without electrical stimulation"', severity: 'ERROR' })
  }
  if (!text.includes('Documentation')) issues.push({ visit: label, section: 'P', field: 'documentation', issue: '缺少 "Documentation"', severity: 'ERROR' })
}

// --- 4.2 TX 模板审计 (KNEE) ---
function auditKneeTX(text: string, visitIdx: number, state: TXVisitState) {
  const label = `TX${visitIdx}`

  // Subjective
  if (!text.includes('Follow up visit')) issues.push({ visit: label, section: 'S', field: 'noteType', issue: '缺少 "Follow up visit"', severity: 'ERROR' })
  if (!text.includes('Patient reports:')) issues.push({ visit: label, section: 'S', field: 'patientReports', issue: '缺少 "Patient reports:"', severity: 'ERROR' })
  if (!text.includes('improvement of symptom(s)')) issues.push({ visit: label, section: 'S', field: 'symptomChange', issue: '非好转分支', severity: 'ERROR' })
  if (!text.includes('Patient still c/o')) issues.push({ visit: label, section: 'S', field: 'continuedSymptom', issue: '缺少 "Patient still c/o"', severity: 'ERROR' })
  if (!text.includes('Knee area')) issues.push({ visit: label, section: 'S', field: 'bodyPart', issue: '缺少 "Knee area"', severity: 'ERROR' })
  if (!text.includes('Pain Scale:') || !text.includes('/10')) issues.push({ visit: label, section: 'S', field: 'painScale', issue: '缺少 Pain Scale 格式', severity: 'ERROR' })
  if (!text.includes('Pain frequency:')) issues.push({ visit: label, section: 'S', field: 'painFrequency', issue: '缺少 "Pain frequency:" (小写 f)', severity: 'ERROR' })
  // KNEE TX ADL: "difficulty" 后无 "of"
  const adlSection = text.slice(text.indexOf('Patient still c/o'), text.indexOf('Pain Scale:'))
  if (adlSection.includes('difficulty of')) {
    issues.push({ visit: label, section: 'S', field: 'ADLFormat', issue: 'KNEE TX ADL 应为 "difficulty [活动]" 而非 "difficulty of"', severity: 'ERROR' })
  }

  // Objective
  if (!text.includes('Muscles Testing:')) issues.push({ visit: label, section: 'O', field: 'musclesTesting', issue: '缺少 "Muscles Testing:"', severity: 'ERROR' })
  // KNEE: "Tenderness muscle" (单数)
  if (!text.includes('Tenderness muscle noted along')) issues.push({ visit: label, section: 'O', field: 'tendernessFormat', issue: '应为 "Tenderness muscle noted along" (单数)', severity: 'ERROR' })
  if (!text.includes('Right Knee')) issues.push({ visit: label, section: 'O', field: 'rightROM', issue: '缺少 Right Knee ROM', severity: 'ERROR' })
  if (!text.includes('Left Knee')) issues.push({ visit: label, section: 'O', field: 'leftROM', issue: '缺少 Left Knee ROM', severity: 'ERROR' })
  if (!text.includes('Flexion(fully bent):')) issues.push({ visit: label, section: 'O', field: 'romFlexion', issue: '缺少 "Flexion(fully bent):"', severity: 'ERROR' })
  // KNEE: Inspection 在 ROM 之后, 格式 "Inspection: " (有空格)
  if (!text.includes('Inspection: ')) issues.push({ visit: label, section: 'O', field: 'inspectionFormat', issue: 'KNEE Inspection 应为 "Inspection: " (冒号后有空格)', severity: 'ERROR' })
  if (!text.includes('tongue')) issues.push({ visit: label, section: 'O', field: 'tongue', issue: '缺少舌象', severity: 'ERROR' })
  if (!text.includes('pulse')) issues.push({ visit: label, section: 'O', field: 'pulse', issue: '缺少脉象', severity: 'ERROR' })

  // Assessment (TX)
  // KNEE TX: "The patient continues treatment for in bilateral knee area today."
  if (!text.includes('continues treatment for in bilateral knee area today')) {
    issues.push({ visit: label, section: 'A', field: 'continueTreatment', issue: '缺少 "continues treatment for in bilateral knee area today"', severity: 'ERROR' })
  }
  if (!text.includes("general condition is")) issues.push({ visit: label, section: 'A', field: 'generalCondition', issue: '缺少 general condition', severity: 'ERROR' })
  if (!text.includes('compared with last treatment')) issues.push({ visit: label, section: 'A', field: 'comparison', issue: '缺少比较', severity: 'ERROR' })
  if (!text.includes('Patient tolerated')) issues.push({ visit: label, section: 'A', field: 'tolerated', issue: '缺少耐受', severity: 'ERROR' })
  if (!text.includes('No adverse side effect')) issues.push({ visit: label, section: 'A', field: 'noAdverse', issue: '缺少无不良反应', severity: 'ERROR' })
  if (!text.includes('Cold-Damp + Wind-Cold')) issues.push({ visit: label, section: 'A', field: 'localPattern', issue: '缺少局部证型', severity: 'ERROR' })

  // Plan (TX)
  if (!text.includes("Today's treatment principles:")) issues.push({ visit: label, section: 'P', field: 'treatmentPrinciples', issue: '缺少治则', severity: 'ERROR' })
  if (!text.includes('Select Needle Size')) issues.push({ visit: label, section: 'P', field: 'needleSize', issue: '缺少针号', severity: 'ERROR' })
  if (!text.includes('right knee')) issues.push({ visit: label, section: 'P', field: 'needleRight', issue: '缺少 "right knee"', severity: 'ERROR' })
  if (!text.includes('left knee')) issues.push({ visit: label, section: 'P', field: 'needleLeft', issue: '缺少 "left knee"', severity: 'ERROR' })
  if (!text.includes('Documentation')) issues.push({ visit: label, section: 'P', field: 'documentation', issue: '缺少 "Documentation"', severity: 'ERROR' })

  // Tenderness 量表应使用 KNEE 格式
  const tenderLine = text.match(/(?:Tenderness Scale|Grading Scale):.*?\./s)
  if (tenderLine) {
    const tLine = tenderLine[0]
    // KNEE 格式: "There is..." 而非 SHOULDER 格式: "Patient complains..."
    if (tLine.includes('Patient complains') || tLine.includes('Patient states')) {
      issues.push({ visit: label, section: 'O', field: 'tendernessScale', issue: 'Tenderness 使用了 SHOULDER 格式, 应为 KNEE 格式 "There is..."', severity: 'ERROR' })
    }
  }
}

// 执行审计
auditKneeIE(ieText)
txSeries.forEach((item: TXSeriesTextItem) => {
  auditKneeTX(item.text, item.visitIndex, item.state)
})

const errorCount = issues.filter(i => i.severity === 'ERROR').length
const warningCount = issues.filter(i => i.severity === 'WARNING').length

console.log(`\n审计结果: ${errorCount} 错误, ${warningCount} 警告`)
if (issues.length === 0) {
  console.log('✅ KNEE 模板合规性审计全部通过！')
} else {
  issues.forEach(i => {
    const icon = i.severity === 'ERROR' ? '❌' : '⚠️'
    console.log(`  ${icon} [${i.visit}] ${i.section}.${i.field}: ${i.issue}`)
  })
}

// ===================== 5. 逻辑一致性审计 =====================

console.log('\n')
console.log('#'.repeat(100))
console.log('##  逻辑一致性审计 (Logic Consistency Audit)')
console.log('#'.repeat(100))

interface LogicIssue {
  type: 'HORIZONTAL' | 'VERTICAL' | 'BILATERAL'
  visit: string
  detail: string
  severity: 'ERROR' | 'WARNING'
}

const logicIssues: LogicIssue[] = []

// --- 5.1 纵向趋势: 疼痛收敛 ---
console.log('\n--- 5.1 纵向趋势: 疼痛收敛 ---')
let prevPain = 8
txSeries.forEach((item: TXSeriesTextItem) => {
  const pain = item.state.painScaleCurrent
  console.log(`  TX${item.visitIndex}: pain=${pain.toFixed(1)}, severity=${item.state.severityLevel}, progress=${(item.state.progress * 100).toFixed(1)}%`)
  if (pain > prevPain + 0.01) {
    logicIssues.push({ type: 'VERTICAL', visit: `TX${item.visitIndex}`, detail: `疼痛反弹: ${pain.toFixed(1)} > 上次 ${prevPain.toFixed(1)}`, severity: 'ERROR' })
  }
  prevPain = pain
})
const finalPain = txSeries[txSeries.length - 1].state.painScaleCurrent
if (finalPain > 7) {
  logicIssues.push({ type: 'VERTICAL', visit: 'TX11', detail: `最终疼痛 ${finalPain} 仍较高`, severity: 'WARNING' })
}

// --- 5.2 severity 单调 ---
console.log('\n--- 5.2 severity 单调 ---')
const severityOrder = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
let prevSevIdx = severityOrder.indexOf('moderate to severe')
txSeries.forEach((item: TXSeriesTextItem) => {
  const sevIdx = severityOrder.indexOf(item.state.severityLevel)
  console.log(`  TX${item.visitIndex}: severity=${item.state.severityLevel}, pain=${item.state.painScaleCurrent.toFixed(1)}`)
  if (sevIdx > prevSevIdx) {
    logicIssues.push({ type: 'VERTICAL', visit: `TX${item.visitIndex}`, detail: `severity 反弹`, severity: 'WARNING' })
  }
  prevSevIdx = sevIdx
})

// --- 5.3 横向链: S → O → A ---
console.log('\n--- 5.3 横向链: S → O → A ---')
txSeries.forEach((item: TXSeriesTextItem) => {
  const s = item.state.soaChain.subjective
  const o = item.state.soaChain.objective
  const a = item.state.soaChain.assessment
  if (s.painChange === 'improved') {
    if (a.present.includes('exacerbate') || a.present.includes('no change')) {
      logicIssues.push({ type: 'HORIZONTAL', visit: `TX${item.visitIndex}`, detail: `S 好转但 A "${a.present}"`, severity: 'ERROR' })
    }
    if (a.patientChange === 'increased' || a.patientChange === 'remained the same') {
      logicIssues.push({ type: 'HORIZONTAL', visit: `TX${item.visitIndex}`, detail: `S 好转但 A.patientChange="${a.patientChange}"`, severity: 'ERROR' })
    }
  }
  // "slightly reduced last visit" 病句检查
  if (a.physicalChange.includes('reduced') && a.findingType === 'last visit') {
    logicIssues.push({ type: 'HORIZONTAL', visit: `TX${item.visitIndex}`, detail: `"${a.physicalChange} ${a.findingType}" 语法错误`, severity: 'ERROR' })
  }
  console.log(`  TX${item.visitIndex}: S(pain=${s.painChange}) → O(tight=${o.tightnessTrend}, tender=${o.tendernessTrend}, rom=${o.romTrend}) → A(present=${a.present.slice(0, 25)}, phys=${a.physicalChange} ${a.findingType})`)
})

// --- 5.4 双侧不对齐 ---
console.log('\n--- 5.4 双侧不对齐 ---')
let allSidesSame = true
txSeries.forEach((item: TXSeriesTextItem) => {
  if (item.state.sideProgress) {
    const diff = Math.abs(item.state.sideProgress.left - item.state.sideProgress.right)
    const marker = diff < 0.01 ? '⚠️ 同步' : '✅ 不同步'
    console.log(`  TX${item.visitIndex}: left=${(item.state.sideProgress.left * 100).toFixed(1)}%, right=${(item.state.sideProgress.right * 100).toFixed(1)}%, diff=${(diff * 100).toFixed(1)}% ${marker}`)
    if (diff >= 0.01) allSidesSame = false
  } else {
    logicIssues.push({ type: 'BILATERAL', visit: `TX${item.visitIndex}`, detail: '缺少 sideProgress', severity: 'ERROR' })
  }
})
if (allSidesSame) {
  logicIssues.push({ type: 'BILATERAL', visit: '全部TX', detail: '左右完全相同, 未实现不对齐', severity: 'ERROR' })
}

// --- 5.5 P 保持不变 ---
console.log('\n--- 5.5 Plan 跨访次不变 ---')
const planTexts = txSeries.map((item: TXSeriesTextItem) => {
  const planStart = item.text.indexOf('Plan\n')
  return planStart >= 0 ? item.text.slice(planStart) : ''
})
let planChanged = false
for (let i = 1; i < planTexts.length; i++) {
  if (planTexts[i] !== planTexts[0]) {
    planChanged = true
    logicIssues.push({ type: 'VERTICAL', visit: `TX${i + 1}`, detail: 'Plan 内容变化', severity: 'WARNING' })
  }
}
console.log(planChanged ? '  ⚠️ Plan 部分 TX 发生变化' : '  ✅ Plan 所有 TX 保持一致')

// --- 5.6 generalCondition 跨访次一致 ---
console.log('\n--- 5.6 generalCondition 一致性 (基础体质固定) ---')
const conditions = txSeries.map(i => i.state.generalCondition)
const allSameCondition = conditions.every(c => c === conditions[0])
console.log(`  基础体质: "${conditions[0]}" (Chronic + Kidney Yang Deficiency → poor)`)
if (allSameCondition) {
  console.log(`  ✅ 11 次 TX generalCondition 全部一致: "${conditions[0]}"`)
} else {
  const unique = [...new Set(conditions)]
  logicIssues.push({ type: 'VERTICAL', visit: '全部TX', detail: `generalCondition 不一致: ${unique.join(', ')}`, severity: 'ERROR' })
  console.log(`  ❌ generalCondition 不一致: ${conditions.join(', ')}`)
}

// --- 5.7 Tightness/Tenderness 纵向单调 ---
console.log('\n--- 5.7 Tightness/Tenderness grading 纵向趋势 ---')
const tightOrder = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
let prevTightIdx = -1
txSeries.forEach((item: TXSeriesTextItem) => {
  const idx = tightOrder.indexOf(item.state.tightnessGrading.toLowerCase())
  if (prevTightIdx >= 0 && idx > prevTightIdx) {
    logicIssues.push({ type: 'VERTICAL', visit: `TX${item.visitIndex}`, detail: `Tightness 回退: "${item.state.tightnessGrading}" > 上次`, severity: 'ERROR' })
  }
  console.log(`  TX${item.visitIndex}: tightness="${item.state.tightnessGrading}", tenderness="${item.state.tendernessGrading.slice(0, 40)}..."`)
  prevTightIdx = idx >= 0 ? idx : prevTightIdx
})

// 检查 tenderness 是否使用了正确的 KNEE 格式
txSeries.forEach((item: TXSeriesTextItem) => {
  const tg = item.state.tendernessGrading
  if (tg.includes('Patient complains') || tg.includes('Patient states')) {
    logicIssues.push({ type: 'HORIZONTAL', visit: `TX${item.visitIndex}`, detail: `Tenderness grading 使用了 SHOULDER 格式: "${tg.slice(0, 50)}"`, severity: 'ERROR' })
  }
})

// ===================== 6. 汇总报告 =====================

console.log('\n')
console.log('#'.repeat(100))
console.log('##  综合审计报告')
console.log('#'.repeat(100))

const templateErrors = issues.filter(i => i.severity === 'ERROR').length
const templateWarnings = issues.filter(i => i.severity === 'WARNING').length
const logicErrors = logicIssues.filter(i => i.severity === 'ERROR').length
const logicWarnings = logicIssues.filter(i => i.severity === 'WARNING').length

console.log(`\n模板合规性: ${templateErrors} 错误, ${templateWarnings} 警告`)
console.log(`逻辑一致性: ${logicErrors} 错误, ${logicWarnings} 警告`)
console.log(`总计: ${templateErrors + logicErrors} 错误, ${templateWarnings + logicWarnings} 警告`)

if (logicIssues.length > 0) {
  console.log('\n逻辑问题详情:')
  logicIssues.forEach(i => {
    const icon = i.severity === 'ERROR' ? '❌' : '⚠️'
    console.log(`  ${icon} [${i.type}] ${i.visit}: ${i.detail}`)
  })
}

if (issues.length > 0) {
  console.log('\n模板问题详情:')
  issues.forEach(i => {
    const icon = i.severity === 'ERROR' ? '❌' : '⚠️'
    console.log(`  ${icon} [${i.visit}] ${i.section}.${i.field}: ${i.issue}`)
  })
}

if (templateErrors + logicErrors === 0 && templateWarnings + logicWarnings === 0) {
  console.log('\n🎉 全部审计通过！双膝痛 1 IE + 11 TX 模板合规且逻辑一致。')
} else if (templateErrors + logicErrors === 0) {
  console.log('\n✅ 无错误，但有少量警告需关注。')
} else {
  console.log('\n⛔ 存在错误，需要修复。')
}
