/**
 * 前端续写流程集成测试
 * 使用 tsx 运行，不通过 Jest
 */

import { generateContinuation } from '../../frontend/src/services/generator.js'
import { AuditorAgent } from '../../src/auditor'

const agent = new AuditorAgent()

// 测试用例
const tests: Array<{
  name: string
  input: string
  options: any
  check: (result: any) => boolean
}> = []

// FE-01: 用户粘贴 IE (无冒号)
tests.push({
  name: 'FE-01: 无冒号格式 IE',
  input: `Subjective
INITIAL EVALUATION
Patient c/o Chronic pain in right Knee area which is Dull, Burning.
Pain Scale: Worst: 8 ; Best: 6 ; Current: 8
Medical history/Contraindication or Precision: N/A

Objective
Tightness muscles noted along Hamstrings
Grading Scale: moderate to severe
Tenderness Scale: (+3) = severe
Muscles spasm noted along Quadriceps
Frequency Grading Scale:(+3)
Right Knee Muscles Strength and Joint ROM:
4/5 Flexion: 80 Degrees(moderate)
5/5 Extension: 0(normal)
tongue
pale
pulse
thready

Assessment
TCM Dx: Right knee pain due to Qi & Blood Deficiency in local meridian.

Plan
Initial Evaluation`,
  options: { insuranceType: 'OPTUM', generateCount: 3 },
  check: (r) => !r.error && r.parseSummary?.bodyPart === 'KNEE' && r.visits?.length > 0
})

// FE-02: 标准格式 IE (带冒号)
tests.push({
  name: 'FE-02: 标准格式 IE',
  input: `Subjective:
INITIAL EVALUATION
Patient c/o Chronic pain in right Knee area which is Dull.
Pain Scale: Worst: 8 ; Best: 6 ; Current: 8
Medical history/Contraindication or Precision: N/A

Objective:
Tightness muscles noted along Hamstrings
Grading Scale: moderate
Tenderness Scale: (+2)
Muscles spasm noted along Quadriceps
Frequency Grading Scale:(+2)
Right Knee Muscles Strength and Joint ROM:
4/5 Flexion: 100 Degrees(mild)
5/5 Extension: 0(normal)
tongue
pale
pulse
thready

Assessment:
TCM Dx: Right knee pain due to Qi & Blood Deficiency.

Plan:
Initial Evaluation`,
  options: { insuranceType: 'OPTUM', generateCount: 3 },
  check: (r) => !r.error && r.visits?.length > 0
})

// FE-03: 续写生成 TX
tests.push({
  name: 'FE-03: 续写生成 TX',
  input: tests[0].input,
  options: { insuranceType: 'OPTUM', generateCount: 5 },
  check: (r) => {
    if (r.error || !r.visits?.length) return false
    // 检查 pain 纵向下降
    let prevPain = r.parseSummary?.iePain || 8
    for (const tx of r.visits) {
      if (tx.state.painScaleCurrent > prevPain) return false
      prevPain = tx.state.painScaleCurrent
    }
    return true
  }
})

// FE-04: 错误提示 - 空输入
tests.push({
  name: 'FE-04: 空输入错误',
  input: '',
  options: { insuranceType: 'OPTUM', generateCount: 1 },
  check: (r) => !!r.error
})

// FE-05: 各部位识别 (只测试支持的部位)
const bodyParts = ['Knee', 'Shoulder', 'Elbow']
for (const part of bodyParts) {
  tests.push({
    name: `FE-05: ${part} 部位识别`,
    input: `Subjective:
INITIAL EVALUATION
Patient c/o pain in right ${part} area.
Pain Scale: Worst: 8 ; Best: 6 ; Current: 8
Medical history: N/A

Objective:
Tightness muscles noted along muscles
Grading Scale: moderate
Tenderness Scale: (+2)
Muscles spasm noted along muscles
Frequency Grading Scale:(+2)
Right ${part} Muscles Strength and Joint ROM:
4/5 Flexion: 80 Degrees(moderate)
5/5 Extension: 0(normal)
tongue
pale
pulse
thready

Assessment:
TCM Dx: pain due to Qi & Blood Deficiency.

Plan:
Initial Evaluation`,
    options: { insuranceType: 'OPTUM', generateCount: 1 },
    check: (r) => !r.error && r.parseSummary?.bodyPart?.toUpperCase() === part.toUpperCase()
  })
}

// FE-06: 审核集成
tests.push({
  name: 'FE-06: 审核集成',
  input: tests[0].input,
  options: { insuranceType: 'OPTUM', generateCount: 3 },
  check: (r) => {
    if (r.error || !r.visits?.length) return false
    let prevPain = r.parseSummary?.iePain || 8
    for (const tx of r.visits) {
      const report = agent.audit({
        noteType: 'TX',
        primaryBodyPart: r.parseSummary?.bodyPart || 'KNEE',
        chronicityLevel: 'Chronic',
        severityLevel: 'moderate',
        generalCondition: tx.state.generalCondition,
        painScaleCurrent: tx.state.painScaleCurrent,
        localPattern: 'Qi & Blood Deficiency',
        systemicPattern: 'Kidney Yang Deficiency',
        hasPacemaker: false,
      }, { previousPain: prevPain })
      if (report.overallResult !== 'PASS') return false
      prevPain = tx.state.painScaleCurrent
    }
    return true
  }
})

// 运行测试
console.log('🧪 前端续写集成测试')
console.log('═'.repeat(50))

let passed = 0
let failed = 0

for (const test of tests) {
  try {
    const result = generateContinuation(test.input, test.options)
    const ok = test.check(result)
    if (ok) {
      console.log(`✅ ${test.name}`)
      passed++
    } else {
      console.log(`❌ ${test.name}`)
      if (result.error) console.log(`   Error: ${result.error}`)
      failed++
    }
  } catch (e: any) {
    console.log(`❌ ${test.name}`)
    console.log(`   Exception: ${e.message}`)
    failed++
  }
}

console.log('')
console.log('═'.repeat(50))
console.log(`结果: ${passed} 通过, ${failed} 失败`)

process.exit(failed > 0 ? 1 : 0)
