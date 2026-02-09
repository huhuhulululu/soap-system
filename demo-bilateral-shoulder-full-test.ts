/**
 * 双肩痛完整测试: 1 IE + 11 TX
 * 同时进行模板合规性审计 + 逻辑一致性审计
 */
import {
  exportSOAPAsText,
  exportTXSeriesAsText,
  generateTXSequenceStates
} from './src/index'
import type { GenerationContext, TXSeriesTextItem } from './src/index'
import type { TXVisitState } from './src/generator/tx-sequence-engine'

// ===================== 1. 上下文定义 =====================

const shoulderIEContext: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'WC',
  primaryBodyPart: 'SHOULDER',
  secondaryBodyParts: ['NECK'],
  laterality: 'bilateral',
  localPattern: 'Qi Stagnation, Blood Stasis',
  systemicPattern: 'Qi & Blood Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  hasPacemaker: false
}

const shoulderTXContext: GenerationContext = {
  noteType: 'TX',
  insuranceType: 'WC',
  primaryBodyPart: 'SHOULDER',
  laterality: 'bilateral',
  localPattern: 'Qi Stagnation, Blood Stasis',
  systemicPattern: 'Qi & Blood Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  hasPacemaker: false
}

// ===================== 2. 生成 IE =====================

console.log('='.repeat(100))
console.log('【IE】双侧肩痛初诊 (Initial Evaluation - Bilateral Shoulder Pain)')
console.log('='.repeat(100))
const ieText = exportSOAPAsText(shoulderIEContext)
console.log(ieText)
console.log('\n')

// ===================== 3. 生成 11 TX =====================

const txSeries = exportTXSeriesAsText(shoulderTXContext, { txCount: 11 })

txSeries.forEach((item: TXSeriesTextItem) => {
  console.log('='.repeat(100))
  console.log(`【TX ${item.visitIndex}/11】双侧肩痛第 ${item.visitIndex} 次复诊`)
  console.log(`  进度: ${(item.state.progress * 100).toFixed(1)}% | 疼痛: ${item.state.painScaleCurrent}/10 | 严重度: ${item.state.severityLevel}`)
  if (item.state.sideProgress) {
    console.log(`  左侧进度: ${(item.state.sideProgress.left * 100).toFixed(1)}% | 右侧进度: ${(item.state.sideProgress.right * 100).toFixed(1)}%`)
  }
  console.log(`  扰动因子: gap=${item.state.objectiveFactors.sessionGapDays}d, sleep=${item.state.objectiveFactors.sleepLoad}, work=${item.state.objectiveFactors.workloadLoad}`)
  console.log('='.repeat(100))
  console.log(item.text)
  console.log('\n')
})

// ===================== 4. 模板合规性审计 =====================

console.log('\n')
console.log('#'.repeat(100))
console.log('##  模板合规性审计 (Template Compliance Audit)')
console.log('#'.repeat(100))

interface AuditIssue {
  visit: string
  section: string
  field: string
  issue: string
  severity: 'ERROR' | 'WARNING'
}

const issues: AuditIssue[] = []

// --- 4.1 IE 模板审计 ---
function auditIE(text: string) {
  const label = 'IE'

  // Subjective 必须字段
  if (!text.includes('INITIAL EVALUATION')) issues.push({ visit: label, section: 'S', field: 'noteType', issue: '缺少 "INITIAL EVALUATION" 标题', severity: 'ERROR' })
  if (!text.includes('Patient c/o')) issues.push({ visit: label, section: 'S', field: 'complaint', issue: '缺少 "Patient c/o" 开头', severity: 'ERROR' })
  if (!text.includes('bilateral')) issues.push({ visit: label, section: 'S', field: 'laterality', issue: '缺少 "bilateral" 侧别', severity: 'ERROR' })
  if (!text.includes('shoulder area') && !text.includes('shoulder')) issues.push({ visit: label, section: 'S', field: 'bodyPart', issue: '缺少 "shoulder" 部位', severity: 'ERROR' })
  if (!text.includes('without radiation')) issues.push({ visit: label, section: 'S', field: 'radiation', issue: '缺少 "without radiation"', severity: 'WARNING' })
  if (!text.includes('Pain Scale:')) issues.push({ visit: label, section: 'S', field: 'painScale', issue: '缺少 "Pain Scale:" 行', severity: 'ERROR' })
  if (!text.includes('Pain Frequency:') && !text.includes('Pain frequency:')) issues.push({ visit: label, section: 'S', field: 'painFrequency', issue: '缺少 "Pain Frequency:" 行', severity: 'ERROR' })
  if (!text.includes("impaired performing ADL's")) issues.push({ visit: label, section: 'S', field: 'ADL', issue: '缺少 ADL 困难描述', severity: 'ERROR' })
  if (!text.includes('Walking aid')) issues.push({ visit: label, section: 'S', field: 'walkingAid', issue: '缺少 "Walking aid" 行', severity: 'WARNING' })
  if (!text.includes('Medical history')) issues.push({ visit: label, section: 'S', field: 'medicalHistory', issue: '缺少 "Medical history" 行', severity: 'WARNING' })

  // Objective 必须字段
  if (!text.includes('Inspection:')) issues.push({ visit: label, section: 'O', field: 'inspection', issue: '缺少 "Inspection:" 行', severity: 'ERROR' })
  if (!text.includes('Muscles Testing:')) issues.push({ visit: label, section: 'O', field: 'musclesTesting', issue: '缺少 "Muscles Testing:" 行', severity: 'ERROR' })
  if (!text.includes('Tightness muscles')) issues.push({ visit: label, section: 'O', field: 'tightness', issue: '缺少 Tightness 肌肉', severity: 'ERROR' })
  if (!text.includes('Tenderness muscles') && !text.includes('Tenderness muscle')) issues.push({ visit: label, section: 'O', field: 'tenderness', issue: '缺少 Tenderness 肌肉', severity: 'ERROR' })
  if (!text.includes('Muscles spasm')) issues.push({ visit: label, section: 'O', field: 'spasm', issue: '缺少 Muscles spasm', severity: 'ERROR' })
  if (!text.includes('Right Shoulder Muscles Strength')) issues.push({ visit: label, section: 'O', field: 'romRight', issue: '缺少 Right Shoulder ROM', severity: 'ERROR' })
  if (!text.includes('Left Shoulder Muscles Strength')) issues.push({ visit: label, section: 'O', field: 'romLeft', issue: '缺少 Left Shoulder ROM', severity: 'ERROR' })
  if (!text.includes('tongue')) issues.push({ visit: label, section: 'O', field: 'tongue', issue: '缺少舌象', severity: 'ERROR' })
  if (!text.includes('pulse')) issues.push({ visit: label, section: 'O', field: 'pulse', issue: '缺少脉象', severity: 'ERROR' })

  // SHOULDER ROM 格式审计
  const romPatterns = [
    { name: 'Abduction', regex: /\d[+-]?\/5 Abduction:\d+ degree\((normal|mild|moderate|severe)\)/ },
    { name: 'Horizontal Adduction', regex: /\d[+-]?\/5 Horizontal Adduction: \d+ degree \((normal|mild|moderate|severe)\)/ },
    { name: 'Flexion', regex: /\d[+-]?\/5 Flexion :\d+ degree\((normal|mild|moderate|severe)\)/ },
    { name: 'Extension', regex: /\d[+-]?\/5 Extension : \d+ Degrees\((normal|mild|moderate|severe)\)/ },
    { name: 'External rotation', regex: /\d[+-]?\/5 External rotation : \d+ Degrees\((normal|mild|moderate|severe)\)/ },
    { name: 'Internal rotation', regex: /\d[+-]?\/5 Internal rotation : \d+ Degrees\((normal|mild|moderate|severe)\)/ },
  ]
  for (const p of romPatterns) {
    if (!p.regex.test(text)) {
      issues.push({ visit: label, section: 'O', field: `ROM.${p.name}`, issue: `ROM 格式不符模板: ${p.name}`, severity: 'ERROR' })
    }
  }

  // Assessment 必须字段
  if (!text.includes('TCM Dx:')) issues.push({ visit: label, section: 'A', field: 'tcmDx', issue: '缺少 "TCM Dx:" 行', severity: 'ERROR' })
  if (!text.includes('Qi Stagnation, Blood Stasis')) issues.push({ visit: label, section: 'A', field: 'localPattern', issue: '缺少局部证型', severity: 'ERROR' })
  if (!text.includes('Qi & Blood Deficiency')) issues.push({ visit: label, section: 'A', field: 'systemicPattern', issue: '缺少整体证型', severity: 'ERROR' })
  if (!text.includes("Today's TCM treatment principles:")) issues.push({ visit: label, section: 'A', field: 'treatmentPrinciples', issue: '缺少治则', severity: 'ERROR' })
  if (!text.includes('Acupuncture Eval was done today')) issues.push({ visit: label, section: 'A', field: 'evalArea', issue: '缺少评估位置', severity: 'ERROR' })

  // Plan 必须字段 (IE)
  if (!text.includes('Initial Evaluation')) issues.push({ visit: label, section: 'P', field: 'evaluationType', issue: '缺少 "Initial Evaluation" 类型', severity: 'ERROR' })
  if (!text.includes('Short Term Goal')) issues.push({ visit: label, section: 'P', field: 'shortTermGoal', issue: '缺少短期目标', severity: 'ERROR' })
  if (!text.includes('Long Term Goal')) issues.push({ visit: label, section: 'P', field: 'longTermGoal', issue: '缺少长期目标', severity: 'ERROR' })
  if (!text.includes('Select Needle Size')) issues.push({ visit: label, section: 'P', field: 'needleSize', issue: '缺少针号', severity: 'ERROR' })
  if (!text.includes('Front Points:')) issues.push({ visit: label, section: 'P', field: 'frontPoints', issue: '缺少前穴区', severity: 'ERROR' })
  if (!text.includes('Back Points')) issues.push({ visit: label, section: 'P', field: 'backPoints', issue: '缺少后穴区', severity: 'ERROR' })
  if (!text.includes('Documentation')) issues.push({ visit: label, section: 'P', field: 'documentation', issue: '缺少 "Documentation" 结尾', severity: 'ERROR' })

  // SHOULDER 特有格式
  if (!text.includes('Bilateral - shoulder area pain due to')) issues.push({ visit: label, section: 'A', field: 'shoulderFormat', issue: 'SHOULDER Assessment 格式不正确', severity: 'ERROR' })
}

// --- 4.2 TX 模板审计 ---
function auditTX(text: string, visitIdx: number, state: TXVisitState) {
  const label = `TX${visitIdx}`

  // Subjective
  if (!text.includes('Follow up visit')) issues.push({ visit: label, section: 'S', field: 'noteType', issue: '缺少 "Follow up visit"', severity: 'ERROR' })
  if (!text.includes('Patient reports:')) issues.push({ visit: label, section: 'S', field: 'patientReports', issue: '缺少 "Patient reports:"', severity: 'ERROR' })
  if (!text.includes('improvement of symptom(s)')) issues.push({ visit: label, section: 'S', field: 'symptomChange', issue: '非好转分支（应为 improvement）', severity: 'ERROR' })
  if (!text.includes('Patient still c/o')) issues.push({ visit: label, section: 'S', field: 'continuedSymptom', issue: '缺少 "Patient still c/o"', severity: 'ERROR' })
  if (!text.includes('Pain Scale:') || !text.includes('/10')) issues.push({ visit: label, section: 'S', field: 'painScale', issue: '缺少 "Pain Scale: X /10" 格式', severity: 'ERROR' })
  if (!text.includes('Pain frequency:')) issues.push({ visit: label, section: 'S', field: 'painFrequency', issue: '缺少 "Pain frequency:" (小写 f)', severity: 'ERROR' })

  // Objective
  if (!text.includes('Inspection:')) issues.push({ visit: label, section: 'O', field: 'inspection', issue: '缺少 "Inspection:"', severity: 'ERROR' })
  if (!text.includes('Muscles Testing:')) issues.push({ visit: label, section: 'O', field: 'musclesTesting', issue: '缺少 "Muscles Testing:"', severity: 'ERROR' })
  if (!text.includes('Right Shoulder')) issues.push({ visit: label, section: 'O', field: 'rightROM', issue: '缺少 Right Shoulder ROM', severity: 'ERROR' })
  if (!text.includes('Left Shoulder')) issues.push({ visit: label, section: 'O', field: 'leftROM', issue: '缺少 Left Shoulder ROM', severity: 'ERROR' })
  if (!text.includes('tongue')) issues.push({ visit: label, section: 'O', field: 'tongue', issue: '缺少舌象', severity: 'ERROR' })
  if (!text.includes('pulse')) issues.push({ visit: label, section: 'O', field: 'pulse', issue: '缺少脉象', severity: 'ERROR' })

  // Assessment (TX)
  if (!text.includes('continues treatment for') && !text.includes('continue treatment for')) {
    issues.push({ visit: label, section: 'A', field: 'continueTreatment', issue: '缺少 "continues treatment for" 开头', severity: 'ERROR' })
  }
  if (!text.includes("general condition is")) issues.push({ visit: label, section: 'A', field: 'generalCondition', issue: '缺少 "general condition is"', severity: 'ERROR' })
  if (!text.includes('compared with last treatment')) issues.push({ visit: label, section: 'A', field: 'comparison', issue: '缺少 "compared with last treatment"', severity: 'ERROR' })
  if (!text.includes('Patient tolerated')) issues.push({ visit: label, section: 'A', field: 'tolerated', issue: '缺少 "Patient tolerated"', severity: 'ERROR' })
  if (!text.includes('No adverse side effect')) issues.push({ visit: label, section: 'A', field: 'noAdverse', issue: '缺少 "No adverse side effect"', severity: 'ERROR' })
  if (!text.includes('Qi Stagnation, Blood Stasis')) issues.push({ visit: label, section: 'A', field: 'localPattern', issue: '缺少局部证型', severity: 'ERROR' })

  // Plan (TX)
  if (!text.includes("Today's treatment principles:")) issues.push({ visit: label, section: 'P', field: 'treatmentPrinciples', issue: '缺少治则行', severity: 'ERROR' })
  if (!text.includes('Select Needle Size')) issues.push({ visit: label, section: 'P', field: 'needleSize', issue: '缺少针号', severity: 'ERROR' })
  if (!text.includes('Front Points:')) issues.push({ visit: label, section: 'P', field: 'frontPoints', issue: '缺少前穴区', severity: 'ERROR' })
  if (!text.includes('Back Points')) issues.push({ visit: label, section: 'P', field: 'backPoints', issue: '缺少后穴区', severity: 'ERROR' })
  if (!text.includes('Documentation')) issues.push({ visit: label, section: 'P', field: 'documentation', issue: '缺少 "Documentation"', severity: 'ERROR' })
  if (!text.includes('right shoulder')) issues.push({ visit: label, section: 'P', field: 'needleRight', issue: '针刺协议缺少 "right shoulder"', severity: 'ERROR' })
  if (!text.includes('left shoulder')) issues.push({ visit: label, section: 'P', field: 'needleLeft', issue: '针刺协议缺少 "left shoulder"', severity: 'ERROR' })

  // Step 4 无电刺激
  const step4Match = text.match(/4\..+?left shoulder (with|without) electrical stimulation/)
  if (step4Match && step4Match[1] !== 'without') {
    issues.push({ visit: label, section: 'P', field: 'step4Estim', issue: 'Step 4 应为 "without electrical stimulation"', severity: 'ERROR' })
  }
}

// 执行 IE 审计
auditIE(ieText)

// 执行 TX 审计
txSeries.forEach((item: TXSeriesTextItem) => {
  auditTX(item.text, item.visitIndex, item.state)
})

// 输出审计结果
const errorCount = issues.filter(i => i.severity === 'ERROR').length
const warningCount = issues.filter(i => i.severity === 'WARNING').length

console.log(`\n审计结果: ${errorCount} 错误, ${warningCount} 警告`)
if (issues.length === 0) {
  console.log('✅ 模板合规性审计全部通过！')
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

// --- 5.1 纵向趋势审计: 疼痛收敛 ---
console.log('\n--- 5.1 纵向趋势: 疼痛收敛 ---')
let prevPain = 8 // IE baseline
txSeries.forEach((item: TXSeriesTextItem, idx: number) => {
  const pain = item.state.painScaleCurrent
  console.log(`  TX${item.visitIndex}: pain=${pain.toFixed(1)}, severity=${item.state.severityLevel}, progress=${(item.state.progress * 100).toFixed(1)}%`)
  if (pain > prevPain + 0.01) {
    logicIssues.push({
      type: 'VERTICAL',
      visit: `TX${item.visitIndex}`,
      detail: `疼痛反弹: ${pain.toFixed(1)} > 上次 ${prevPain.toFixed(1)} (仅好转分支应单调递减)`,
      severity: 'ERROR'
    })
  }
  prevPain = pain
})

// 最终疼痛是否趋近目标
const finalPain = txSeries[txSeries.length - 1].state.painScaleCurrent
if (finalPain > 7) {
  logicIssues.push({
    type: 'VERTICAL',
    visit: 'TX11',
    detail: `最终疼痛 ${finalPain} 仍较高，未明显趋近 short-term goal (5-6)`,
    severity: 'WARNING'
  })
}

// --- 5.2 纵向趋势审计: severity 一致性 ---
console.log('\n--- 5.2 纵向趋势: severity 一致性 ---')
const severityOrder = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
let prevSevIdx = severityOrder.indexOf('moderate to severe')
txSeries.forEach((item: TXSeriesTextItem) => {
  const sevIdx = severityOrder.indexOf(item.state.severityLevel)
  console.log(`  TX${item.visitIndex}: severity=${item.state.severityLevel} (index=${sevIdx}), pain=${item.state.painScaleCurrent.toFixed(1)}`)
  if (sevIdx > prevSevIdx + 0) {
    logicIssues.push({
      type: 'VERTICAL',
      visit: `TX${item.visitIndex}`,
      detail: `severity 反弹: "${item.state.severityLevel}" > 上次 "${severityOrder[prevSevIdx]}"`,
      severity: 'WARNING'
    })
  }
  prevSevIdx = sevIdx
})

// --- 5.3 横向链审计: S → O → A 一致性 ---
console.log('\n--- 5.3 横向链: S → O → A 一致性 ---')
txSeries.forEach((item: TXSeriesTextItem) => {
  const s = item.state.soaChain.subjective
  const o = item.state.soaChain.objective
  const a = item.state.soaChain.assessment

  // S 声称好转 → A 应反映改善
  if (s.painChange === 'improved') {
    if (a.present.includes('exacerbate') || a.present.includes('no change')) {
      logicIssues.push({
        type: 'HORIZONTAL',
        visit: `TX${item.visitIndex}`,
        detail: `S 声称疼痛改善 但 A 表述为 "${a.present}" — 不一致`,
        severity: 'ERROR'
      })
    }
    if (a.patientChange === 'increased' || a.patientChange === 'remained the same') {
      logicIssues.push({
        type: 'HORIZONTAL',
        visit: `TX${item.visitIndex}`,
        detail: `S 声称疼痛改善 但 A.patientChange="${a.patientChange}" — 不一致`,
        severity: 'ERROR'
      })
    }
  }

  // O 客观趋势 → A 体征变化应一致
  const anyObjImproved = o.tightnessTrend !== 'stable' || o.tendernessTrend !== 'stable' ||
                          o.romTrend !== 'stable' || o.strengthTrend !== 'stable'
  if (anyObjImproved && a.physicalChange === 'remained the same') {
    logicIssues.push({
      type: 'HORIZONTAL',
      visit: `TX${item.visitIndex}`,
      detail: `O 客观有变化但 A.physicalChange="remained the same" — 不一致`,
      severity: 'WARNING'
    })
  }

  console.log(`  TX${item.visitIndex}: S(pain=${s.painChange}, adl=${s.adlChange}) → O(tight=${o.tightnessTrend}, tender=${o.tendernessTrend}, rom=${o.romTrend}) → A(present=${a.present.slice(0, 30)}, patChange=${a.patientChange}, physChange=${a.physicalChange})`)
})

// --- 5.4 双侧不对齐审计 ---
console.log('\n--- 5.4 双侧不对齐审计 ---')
let allSidesSame = true
txSeries.forEach((item: TXSeriesTextItem) => {
  if (item.state.sideProgress) {
    const leftP = item.state.sideProgress.left
    const rightP = item.state.sideProgress.right
    const diff = Math.abs(leftP - rightP)
    const marker = diff < 0.01 ? '⚠️ 同步' : '✅ 不同步'
    console.log(`  TX${item.visitIndex}: left=${(leftP * 100).toFixed(1)}%, right=${(rightP * 100).toFixed(1)}%, diff=${(diff * 100).toFixed(1)}% ${marker}`)
    if (diff >= 0.01) allSidesSame = false
  } else {
    logicIssues.push({
      type: 'BILATERAL',
      visit: `TX${item.visitIndex}`,
      detail: '双侧场景缺少 sideProgress',
      severity: 'ERROR'
    })
  }
})
if (allSidesSame) {
  logicIssues.push({
    type: 'BILATERAL',
    visit: '全部TX',
    detail: '所有 TX 左右侧进度完全相同 — 未实现不对齐',
    severity: 'ERROR'
  })
}

// --- 5.5 P 保持不变审计 ---
console.log('\n--- 5.5 Plan 跨访次不变审计 ---')
const planTexts = txSeries.map((item: TXSeriesTextItem) => {
  const planStart = item.text.indexOf('Plan\n')
  return planStart >= 0 ? item.text.slice(planStart) : ''
})
let planChanged = false
for (let i = 1; i < planTexts.length; i++) {
  if (planTexts[i] !== planTexts[0]) {
    planChanged = true
    logicIssues.push({
      type: 'VERTICAL',
      visit: `TX${i + 1}`,
      detail: `Plan 内容与 TX1 不一致 — P 应保持不变`,
      severity: 'WARNING'
    })
  }
}
if (!planChanged) {
  console.log('  ✅ Plan 在所有 11 次 TX 中保持一致')
} else {
  console.log('  ⚠️ Plan 在部分 TX 中发生了变化')
}

// --- 5.6 S 中的文本与 state 数据一致性 ---
console.log('\n--- 5.6 文本与 state 数据一致性 ---')
txSeries.forEach((item: TXSeriesTextItem) => {
  const text = item.text
  const painStr = item.state.painScaleCurrent.toFixed(1)
  // 检查 Pain Scale 数值是否出现在文本中
  if (!text.includes(`${painStr} /10`) && !text.includes(`${Math.round(item.state.painScaleCurrent)} /10`)) {
    logicIssues.push({
      type: 'HORIZONTAL',
      visit: `TX${item.visitIndex}`,
      detail: `文本中 Pain Scale 数值与 state (${painStr}) 不匹配`,
      severity: 'WARNING'
    })
  }
})
console.log('  检查完成')

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

if (templateErrors + logicErrors === 0 && templateWarnings + logicWarnings === 0) {
  console.log('\n🎉 全部审计通过！双肩痛 1 IE + 11 TX 模板合规且逻辑一致。')
} else if (templateErrors + logicErrors === 0) {
  console.log('\n✅ 无错误，但有少量警告需关注。')
} else {
  console.log('\n⛔ 存在错误，需要修复。')
}
