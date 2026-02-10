/**
 * 极端边界高压测试
 * 
 * 测试: 极端 pain 值、Pacemaker、长序列、混合场景
 */

import { generateTXSequenceStates, type TXSequenceOptions } from '../src/generator/tx-sequence-engine'
import { exportSOAPAsText } from '../src/generator/soap-generator'
import type { GenerationContext, BodyPart } from '../src/types'

interface TestResult {
  name: string
  pass: boolean
  soapCount: number
  errors: string[]
}

const results: TestResult[] = []

// ── 测试 1: 极端 Pain 值 ──
function testExtremePain() {
  const errors: string[] = []
  const painLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  
  for (const pain of painLevels) {
    try {
      const ctx: GenerationContext = {
        noteType: 'IE',
        primaryBodyPart: 'KNEE',
        laterality: 'bilateral',
        insuranceType: 'OPTUM',
        severityLevel: pain >= 8 ? 'severe' : pain >= 6 ? 'moderate to severe' : pain >= 4 ? 'moderate' : 'mild',
        chronicityLevel: 'Chronic',
        localPattern: 'Qi Stagnation',
        systemicPattern: 'Qi Deficiency',
      }
      const text = exportSOAPAsText(ctx)
      if (!text.includes('Subjective')) errors.push(`Pain=${pain}: 缺少 Subjective`)
    } catch (e: any) {
      errors.push(`Pain=${pain}: CRASH - ${e.message}`)
    }
  }
  
  results.push({ name: '极端 Pain 值 (1-10)', pass: errors.length === 0, soapCount: 10, errors })
}

// ── 测试 2: Pacemaker 场景 ──
function testPacemaker() {
  const errors: string[] = []
  const insurances = ['OPTUM', 'HF', 'WC', 'OTHER'] as const
  
  for (const ins of insurances) {
    try {
      const ctx: GenerationContext = {
        noteType: 'IE',
        primaryBodyPart: 'LBP',
        laterality: 'bilateral',
        insuranceType: ins,
        severityLevel: 'moderate to severe',
        chronicityLevel: 'Chronic',
        localPattern: 'Qi Stagnation',
        systemicPattern: 'Qi Deficiency',
        hasPacemaker: true,
      }
      const text = exportSOAPAsText(ctx)
      
      // Pacemaker 患者不应有电刺激
      if (text.includes('with electrical stimulation')) {
        errors.push(`${ins}+Pacemaker: 不应有电刺激`)
      }
      // 应该用 without
      if (!text.includes('without electrical stimulation')) {
        errors.push(`${ins}+Pacemaker: 缺少 without electrical stimulation`)
      }
    } catch (e: any) {
      errors.push(`${ins}+Pacemaker: CRASH - ${e.message}`)
    }
  }
  
  results.push({ name: 'Pacemaker 场景', pass: errors.length === 0, soapCount: 4, errors })
}

// ── 测试 3: 长序列 TX1-TX11 ──
function testLongSequence() {
  const errors: string[] = []
  
  try {
    const ctx: GenerationContext = {
      noteType: 'TX',
      primaryBodyPart: 'SHOULDER',
      laterality: 'bilateral',
      insuranceType: 'OPTUM',
      severityLevel: 'severe',
      chronicityLevel: 'Chronic',
      localPattern: 'Qi Stagnation, Blood Stasis',
      systemicPattern: 'Qi & Blood Deficiency',
    }
    
    const opts: TXSequenceOptions = {
      txCount: 11,
      startVisitIndex: 1,
      previousIE: {
        painScale: 9,
        tightness: 'severe',
        tenderness: 4,
        spasm: 3,
        tonguePulse: { tongue: 'purple', pulse: 'choppy' }
      }
    }
    
    const states = generateTXSequenceStates(ctx, opts)
    
    if (states.length !== 11) {
      errors.push(`期望 11 个 TX，实际 ${states.length}`)
    }
    
    // 验证 pain 递减趋势
    let prevPain = 9
    for (let i = 0; i < states.length; i++) {
      const pain = states[i].painScaleCurrent
      if (pain > prevPain + 0.5) {
        errors.push(`TX${i + 1}: pain=${pain} 不应大于前一次 ${prevPain}`)
      }
      prevPain = pain
      
      // 生成文本验证
      const text = exportSOAPAsText(ctx, states[i])
      if (!text.includes('Follow up visit')) {
        errors.push(`TX${i + 1}: 缺少 Follow up visit`)
      }
    }
    
    // 最终 pain 应该明显下降 (从 9 降到 6 以下)
    const finalPain = states[states.length - 1].painScaleCurrent
    if (finalPain > 6) {
      errors.push(`TX11 pain=${finalPain} 应该 <= 6`)
    }
    
  } catch (e: any) {
    errors.push(`CRASH: ${e.message}`)
  }
  
  results.push({ name: '长序列 TX1-TX11', pass: errors.length === 0, soapCount: 11, errors })
}

// ── 测试 4: 所有 BodyPart ──
function testAllBodyParts() {
  const errors: string[] = []
  const bodyParts: BodyPart[] = ['KNEE', 'SHOULDER', 'LBP', 'NECK', 'ELBOW', 'HIP']
  
  for (const bp of bodyParts) {
    try {
      const ctx: GenerationContext = {
        noteType: 'IE',
        primaryBodyPart: bp,
        laterality: 'bilateral',
        insuranceType: 'OPTUM',
        severityLevel: 'moderate to severe',
        chronicityLevel: 'Chronic',
        localPattern: 'Qi Stagnation',
        systemicPattern: 'Qi Deficiency',
      }
      
      const text = exportSOAPAsText(ctx)
      
      // 检查 bodyPart 相关内容
      const bpNames: Record<BodyPart, string> = {
        'KNEE': 'knee',
        'SHOULDER': 'shoulder',
        'LBP': 'lower back',
        'NECK': 'neck',
        'ELBOW': 'elbow',
        'HIP': 'hip'
      }
      
      if (!text.toLowerCase().includes(bpNames[bp])) {
        errors.push(`${bp}: 文本中缺少 ${bpNames[bp]}`)
      }
      
    } catch (e: any) {
      errors.push(`${bp}: CRASH - ${e.message}`)
    }
  }
  
  results.push({ name: '所有 BodyPart', pass: errors.length === 0, soapCount: 6, errors })
}

// ── 测试 5: 续写场景 (从 TX3 续写) ──
function testContinuation() {
  const errors: string[] = []
  
  try {
    const ctx: GenerationContext = {
      noteType: 'TX',
      primaryBodyPart: 'NECK',
      laterality: 'bilateral',
      insuranceType: 'HF',
      severityLevel: 'moderate',
      chronicityLevel: 'Chronic',
      localPattern: 'Qi Stagnation',
      systemicPattern: 'Liver Qi Stagnation',
    }
    
    // 模拟已有 TX1-TX2，从 TX3 续写
    const opts: TXSequenceOptions = {
      txCount: 7, // 总共 7 个 TX
      startVisitIndex: 3, // 从 TX3 开始
      previousIE: {
        painScale: 7,
        tightness: 'moderate',
        tenderness: 3,
        spasm: 2,
        tonguePulse: { tongue: 'red edges', pulse: 'wiry' }
      },
      initialState: {
        pain: 6, // TX2 的 pain
      }
    }
    
    const states = generateTXSequenceStates(ctx, opts)
    
    if (states.length !== 5) {
      errors.push(`期望 5 个 TX (TX3-TX7)，实际 ${states.length}`)
    }
    
    // 第一个应该是 TX3
    if (states.length > 0 && states[0].visitIndex !== 3) {
      errors.push(`第一个 TX 应该是 TX3，实际是 TX${states[0].visitIndex}`)
    }
    
    // 验证每个 TX 生成
    for (const state of states) {
      const text = exportSOAPAsText(ctx, state)
      if (!text.includes('Subjective')) {
        errors.push(`TX${state.visitIndex}: 缺少 Subjective`)
      }
    }
    
  } catch (e: any) {
    errors.push(`CRASH: ${e.message}`)
  }
  
  results.push({ name: '续写场景 (TX3-TX7)', pass: errors.length === 0, soapCount: 5, errors })
}

// ── 执行所有测试 ──
console.log('\n🔥 极端边界高压测试\n')

testExtremePain()
testPacemaker()
testLongSequence()
testAllBodyParts()
testContinuation()

// ── 输出结果 ──
let totalSOAP = 0
let totalErrors = 0

console.log('测试结果:')
for (const r of results) {
  const status = r.pass ? '✅' : '❌'
  console.log(`  ${status} ${r.name} (${r.soapCount} SOAP)`)
  if (!r.pass) {
    r.errors.slice(0, 3).forEach(e => console.log(`      - ${e}`))
    if (r.errors.length > 3) console.log(`      ... 还有 ${r.errors.length - 3} 个错误`)
  }
  totalSOAP += r.soapCount
  totalErrors += r.errors.length
}

console.log('\n' + '='.repeat(50))
console.log(`📊 汇总: ${results.filter(r => r.pass).length}/${results.length} 通过`)
console.log(`   SOAP 总数: ${totalSOAP}`)
console.log(`   ERROR 总数: ${totalErrors}`)

process.exit(totalErrors > 0 ? 1 : 0)
