/**
 * 多部位 × 多阶段 × 多保险 高压测试
 * 
 * 用法: npx tsx scripts/stress-multi-bp-phase.ts
 */

import { generateTXSequenceStates, type TXSequenceOptions } from '../src/generator/tx-sequence-engine'
import { exportSOAPAsText } from '../src/generator/soap-generator'
import type { GenerationContext, BodyPart, SeverityLevel } from '../src/types'

// ── 测试矩阵 ──
const BODY_PARTS: BodyPart[] = ['KNEE', 'SHOULDER', 'LBP', 'NECK', 'ELBOW'] // HIP 不支持 TX 序列
const SEVERITIES: SeverityLevel[] = ['mild', 'moderate', 'moderate to severe', 'severe']
const INSURANCES = ['OPTUM', 'HF', 'WC', 'OTHER'] as const
const LATERALITIES = ['bilateral', 'left', 'right'] as const
const CHRONICITIES = ['Acute', 'Sub Acute', 'Chronic'] as const

// ── 验证函数 ──
interface ValidationResult {
  errors: string[]
  warnings: string[]
}

function validateSOAP(text: string, ctx: GenerationContext, phase: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // 基本结构检查
  if (!text.includes('Subjective')) errors.push(`${phase}: 缺少 Subjective`)
  if (!text.includes('Objective')) errors.push(`${phase}: 缺少 Objective`)
  if (!text.includes('Assessment')) errors.push(`${phase}: 缺少 Assessment`)
  if (!text.includes('Plan')) errors.push(`${phase}: 缺少 Plan`)
  
  // IE 特有检查
  if (ctx.noteType === 'IE') {
    if (!text.includes('INITIAL EVALUATION')) errors.push('IE: 缺少 INITIAL EVALUATION 标记')
    if (!text.includes('Short Term Goal')) errors.push('IE: 缺少 Short Term Goal')
    if (!text.includes('Long Term Goal')) errors.push('IE: 缺少 Long Term Goal')
    if (!text.includes('Medical history')) warnings.push('IE: 缺少 Medical history')
  }
  
  // TX 特有检查
  if (ctx.noteType === 'TX') {
    if (!text.includes('Follow up visit')) errors.push('TX: 缺少 Follow up visit 标记')
    if (text.includes('Short Term Goal')) warnings.push('TX: 不应包含 Short Term Goal')
  }
  
  // 保险相关检查
  if (ctx.insuranceType === 'OPTUM' || ctx.insuranceType === 'HF') {
    if (text.includes('97813') || text.includes('97814')) {
      warnings.push(`${ctx.insuranceType}: 不应使用 with-estim CPT codes`)
    }
  }
  
  // Pacemaker 检查
  if (ctx.hasPacemaker && text.includes('with electrical stimulation')) {
    errors.push('Pacemaker: 不应有电刺激')
  }
  
  return { errors, warnings }
}

// ── 主测试 ──
interface TestCase {
  bp: BodyPart
  sev: SeverityLevel
  ins: typeof INSURANCES[number]
  lat: typeof LATERALITIES[number]
  chr: typeof CHRONICITIES[number]
}

function runTest(tc: TestCase): { pass: boolean; errors: string[]; warnings: string[] } {
  const allErrors: string[] = []
  const allWarnings: string[] = []
  
  try {
    // 1. 生成 IE
    const ieCtx: GenerationContext = {
      noteType: 'IE',
      primaryBodyPart: tc.bp,
      laterality: tc.lat,
      insuranceType: tc.ins,
      severityLevel: tc.sev,
      chronicityLevel: tc.chr,
      localPattern: 'Qi Stagnation',
      systemicPattern: 'Qi Deficiency',
    }
    
    const ieText = exportSOAPAsText(ieCtx)
    const ieResult = validateSOAP(ieText, ieCtx, 'IE')
    allErrors.push(...ieResult.errors)
    allWarnings.push(...ieResult.warnings)
    
    // 2. 生成 TX 序列 (TX1-TX5)
    const txOpts: TXSequenceOptions = {
      txCount: 5,
      startVisitIndex: 1,
      previousIE: {
        painScale: { worst: 8, best: 6, current: 8 }[tc.sev === 'severe' ? 'worst' : tc.sev === 'mild' ? 'best' : 'current'] || 7,
        tightness: tc.sev,
        tenderness: tc.sev === 'severe' ? 4 : tc.sev === 'moderate to severe' ? 3 : 2,
        spasm: 3,
        tonguePulse: { tongue: 'pale', pulse: 'thready' }
      }
    }
    
    const txStates = generateTXSequenceStates(ieCtx, txOpts)
    
    for (let i = 0; i < txStates.length; i++) {
      const txCtx: GenerationContext = { ...ieCtx, noteType: 'TX' }
      const txText = exportSOAPAsText(txCtx, txStates[i])
      const txResult = validateSOAP(txText, txCtx, `TX${i + 1}`)
      allErrors.push(...txResult.errors)
      allWarnings.push(...txResult.warnings)
    }
    
    return { pass: allErrors.length === 0, errors: allErrors, warnings: allWarnings }
  } catch (e: any) {
    return { pass: false, errors: [`CRASH: ${e.message}`], warnings: [] }
  }
}

// ── 执行测试 ──
console.log('\n🔥 多部位 × 多阶段 × 多保险 高压测试\n')

let totalTests = 0
let passedTests = 0
let totalErrors = 0
let totalWarnings = 0
const failedCases: { tc: TestCase; errors: string[] }[] = []

// 生成测试用例 (采样，避免组合爆炸)
const testCases: TestCase[] = []

for (const bp of BODY_PARTS) {
  for (const sev of SEVERITIES) {
    // 每个 bp+sev 组合测试 2 种保险
    const ins1 = INSURANCES[Math.floor(Math.random() * 2)] // OPTUM or HF
    const ins2 = INSURANCES[2 + Math.floor(Math.random() * 2)] // WC or OTHER
    
    testCases.push({ bp, sev, ins: ins1, lat: 'bilateral', chr: 'Chronic' })
    testCases.push({ bp, sev, ins: ins2, lat: 'left', chr: 'Sub Acute' })
  }
}

// 添加边界用例
testCases.push({ bp: 'KNEE', sev: 'severe', ins: 'OPTUM', lat: 'right', chr: 'Acute' })
testCases.push({ bp: 'SHOULDER', sev: 'mild', ins: 'HF', lat: 'bilateral', chr: 'Chronic' })

console.log(`测试用例: ${testCases.length}`)
console.log(`每个用例: IE + TX1~TX5 (6 个 SOAP)\n`)

for (const tc of testCases) {
  totalTests++
  const result = runTest(tc)
  
  if (result.pass) {
    passedTests++
    process.stdout.write('.')
  } else {
    process.stdout.write('F')
    failedCases.push({ tc, errors: result.errors })
  }
  
  totalErrors += result.errors.length
  totalWarnings += result.warnings.length
}

console.log('\n')

// ── 输出结果 ──
console.log('=' .repeat(60))
console.log('📊 测试结果汇总')
console.log('=' .repeat(60))
console.log(`  用例数: ${totalTests}`)
console.log(`  SOAP 数: ${totalTests * 6}`)
console.log(`  ✅ 通过: ${passedTests}`)
console.log(`  ❌ 失败: ${totalTests - passedTests}`)
console.log(`  总 ERROR: ${totalErrors}`)
console.log(`  总 WARN: ${totalWarnings}`)
console.log(`  通过率: ${(passedTests / totalTests * 100).toFixed(1)}%`)

if (failedCases.length > 0) {
  console.log('\n❌ 失败用例:')
  for (const { tc, errors } of failedCases.slice(0, 10)) {
    console.log(`  ${tc.bp}/${tc.sev}/${tc.ins}/${tc.lat}/${tc.chr}:`)
    errors.slice(0, 3).forEach(e => console.log(`    - ${e}`))
  }
  if (failedCases.length > 10) {
    console.log(`  ... 还有 ${failedCases.length - 10} 个失败用例`)
  }
}

process.exit(failedCases.length > 0 ? 1 : 0)
