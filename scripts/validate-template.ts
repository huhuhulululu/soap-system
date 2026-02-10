/**
 * 模板合规性验证
 * 检查生成的 SOAP 是否严格符合模板框架，无多余信息
 */

import { exportSOAPAsText } from '../src/generator/soap-generator'
import { generateTXSequenceStates } from '../src/generator/tx-sequence-engine'
import type { GenerationContext } from '../src/types'

// ── 模板期望的结构 ──

// IE 必须包含的段落
const IE_REQUIRED = [
  'INITIAL EVALUATION',
  'Patient c/o',
  'Pain Scale:',
  'Pain Frequency:',
  'Walking aid',
  'Medical history',
  'Objective',
  'Muscles Testing:',
  'Tightness muscles',
  'Grading Scale:',
  'Tenderness muscle',
  'Muscles spasm',
  'ROM',
  'Inspection:',
  'tongue',
  'pulse',
  'Assessment',
  'TCM Dx:',
  'Plan',
  'Initial Evaluation',
  'Short Term Goal',
  'Long Term Goal',
  'Select Needle Size',
]

// TX 必须包含的段落
const TX_REQUIRED = [
  'Follow up visit',
  'Patient reports:',
  'Patient still c/o',
  'Pain Scale:',
  'Pain frequency:',
  'Objective',
  'Muscles Testing:',
  'Tightness muscles',
  'Tenderness muscle',
  'Muscles spasm',
  'ROM',
  'tongue',
  'pulse',
  'Assessment',
  'Plan',
]

// 不应出现的内容 (多余信息) - 使用精确匹配
const FORBIDDEN_PATTERNS = [
  /\bundefined\b/i,
  /\bnull\b/i,
  /\bNaN\b/,  // 精确匹配 NaN (区分大小写)
  /\[object Object\]/,
  /\bTODO\b/,
  /\bFIXME\b/,
  /\{\{/,
  /\}\}/,
  /\bLorem\b/i,
]

// IE 中不应出现的 TX 特有内容
const IE_FORBIDDEN = [
  'Follow up visit',
  'Patient reports:',
]

// TX 中不应出现的 IE 特有内容
const TX_FORBIDDEN = [
  'INITIAL EVALUATION',
  'Short Term Goal',
  'Long Term Goal',
  'Initial Evaluation - Personal one on one',
  'Medical history',
]

interface ValidationResult {
  missing: string[]
  forbidden: string[]
  extraLines: string[]
}

function validateSOAP(text: string, type: 'IE' | 'TX'): ValidationResult {
  const missing: string[] = []
  const forbidden: string[] = []
  const extraLines: string[] = []
  
  const required = type === 'IE' ? IE_REQUIRED : TX_REQUIRED
  const typeForbidden = type === 'IE' ? IE_FORBIDDEN : TX_FORBIDDEN
  
  // 检查必须包含的内容
  for (const req of required) {
    if (!text.includes(req)) {
      missing.push(req)
    }
  }
  
  // 检查禁止的内容 (使用正则)
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      const match = text.match(pattern)
      forbidden.push(match ? match[0] : pattern.source)
    }
  }
  
  // 检查类型特有的禁止内容
  for (const f of typeForbidden) {
    if (text.includes(f)) {
      forbidden.push(`[${type}不应有] ${f}`)
    }
  }
  
  // 检查空行过多 (连续3个以上空行)
  if (text.includes('\n\n\n\n')) {
    extraLines.push('连续4+空行')
  }
  
  // 检查行尾多余空格
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].endsWith('  ')) {
      extraLines.push(`行${i+1}尾部多余空格`)
      break // 只报告一次
    }
  }
  
  return { missing, forbidden, extraLines }
}

// ── 测试 ──
console.log('\n🔍 模板合规性验证\n')

const testCases = [
  { bp: 'KNEE', ins: 'OPTUM', sev: 'moderate to severe' },
  { bp: 'SHOULDER', ins: 'HF', sev: 'severe' },
  { bp: 'LBP', ins: 'WC', sev: 'moderate' },
  { bp: 'NECK', ins: 'OTHER', sev: 'mild to moderate' },
] as const

let totalErrors = 0

for (const tc of testCases) {
  console.log(`\n── ${tc.bp}/${tc.ins}/${tc.sev} ──`)
  
  const ctx: GenerationContext = {
    noteType: 'IE',
    primaryBodyPart: tc.bp,
    laterality: 'bilateral',
    insuranceType: tc.ins,
    severityLevel: tc.sev,
    chronicityLevel: 'Chronic',
    localPattern: 'Qi Stagnation',
    systemicPattern: 'Qi Deficiency',
  }
  
  // 验证 IE
  const ieText = exportSOAPAsText(ctx)
  const ieResult = validateSOAP(ieText, 'IE')
  
  if (ieResult.missing.length || ieResult.forbidden.length || ieResult.extraLines.length) {
    console.log('  IE:')
    if (ieResult.missing.length) {
      console.log(`    ❌ 缺少: ${ieResult.missing.slice(0, 3).join(', ')}${ieResult.missing.length > 3 ? '...' : ''}`)
      totalErrors += ieResult.missing.length
    }
    if (ieResult.forbidden.length) {
      console.log(`    ❌ 多余: ${ieResult.forbidden.join(', ')}`)
      totalErrors += ieResult.forbidden.length
    }
    if (ieResult.extraLines.length) {
      console.log(`    ⚠️ 格式: ${ieResult.extraLines.join(', ')}`)
    }
  } else {
    console.log('  IE: ✅')
  }
  
  // 验证 TX1-TX3
  const txCtx = { ...ctx, noteType: 'TX' as const }
  const states = generateTXSequenceStates(txCtx, { txCount: 3, startVisitIndex: 1 })
  
  for (let i = 0; i < Math.min(3, states.length); i++) {
    const txText = exportSOAPAsText(txCtx, states[i])
    const txResult = validateSOAP(txText, 'TX')
    
    if (txResult.missing.length || txResult.forbidden.length || txResult.extraLines.length) {
      console.log(`  TX${i+1}:`)
      if (txResult.missing.length) {
        console.log(`    ❌ 缺少: ${txResult.missing.slice(0, 3).join(', ')}${txResult.missing.length > 3 ? '...' : ''}`)
        totalErrors += txResult.missing.length
      }
      if (txResult.forbidden.length) {
        console.log(`    ❌ 多余: ${txResult.forbidden.join(', ')}`)
        totalErrors += txResult.forbidden.length
      }
      if (txResult.extraLines.length) {
        console.log(`    ⚠️ 格式: ${txResult.extraLines.join(', ')}`)
      }
    } else {
      console.log(`  TX${i+1}: ✅`)
    }
  }
}

console.log('\n' + '='.repeat(50))
console.log(`📊 总错误数: ${totalErrors}`)
console.log(totalErrors === 0 ? '✅ 模板合规' : '❌ 存在不合规项')

process.exit(totalErrors > 0 ? 1 : 0)
