/**
 * 黄金案例生成器
 * 使用 SOAP Generator 生成案例并通过 AuditorAgent 自我检查
 */
import { generateSOAPNote, exportSOAPAsText } from '../src/generator/soap-generator-wrapper'
import { AuditorAgent } from '../src/auditor'
import type { GenerationContext, SOAPNote } from '../src/types'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

interface GoldenCase {
  id: string
  type: 'excellent' | 'typical-error'
  bodyPart: string
  noteType: string
  tcmPattern: {
    local: string
    systemic: string
  }
  source: string
  qualityScore: number
  strengths?: string[]
  violations?: string[]
  keyFeatures: Record<string, any>
  auditResult: {
    overall: string
    qualityScore: number
    violations: string[]
  }
  soapText: string
}

// 输出目录
const OUTPUT_DIR = join(process.cwd(), 'golden-cases')

// 创建输出目录
try {
  mkdirSync(OUTPUT_DIR, { recursive: true })
} catch (err) {
  // 目录已存在
}

// 审核员实例
const auditor = new AuditorAgent()

// 生成案例并审核
function generateAndAudit(context: GenerationContext, caseId: string): GoldenCase | null {
  console.log(`\n🔄 正在生成案例: ${caseId}`)

  // 生成 SOAP 笔记
  const note = generateSOAPNote(context)
  const soapText = exportSOAPAsText(context)

  // 自我检查
  const auditReport = auditor.audit(note, context)

  console.log(`📊 审核结果: ${auditReport.overallResult} (评分: ${auditReport.qualityScore})`)

  // 提取关键特征
  const keyFeatures: Record<string, any> = {
    painLevel: note.subjective.painScale.current,
    painTypes: note.subjective.painTypes,
    tongue: note.objective.tonguePulse.tongue,
    pulse: note.objective.tonguePulse.pulse,
    severityLevel: context.severityLevel,
    laterality: context.laterality,
  }

  // 构建黄金案例
  const goldenCase: GoldenCase = {
    id: caseId,
    type: 'excellent',
    bodyPart: context.primaryBodyPart,
    noteType: context.noteType,
    tcmPattern: {
      local: context.localPattern,
      systemic: context.systemicPattern,
    },
    source: 'SOAP Generator v1.0',
    qualityScore: auditReport.qualityScore,
    keyFeatures,
    auditResult: {
      overall: auditReport.overallResult,
      qualityScore: auditReport.qualityScore,
      violations: auditReport.layer1.violations.map(v =>
        `[${v.severity}] ${v.ruleId}: ${v.violation?.issue || v.message}`
      ),
    },
    soapText,
  }

  // 提取优点（从审核报告推断）
  if (auditReport.qualityScore >= 80) {
    goldenCase.strengths = [
      '证型诊断依据充分',
      'S-O-A 逻辑连贯',
      '穴位配伍合理',
    ]
    if (auditReport.layer1.violations.length === 0) {
      goldenCase.strengths.push('零违规通过全部规则检查')
    }
  }

  return goldenCase
}

// 生成错误案例（人工注入违规）
function generateErrorCase(
  context: GenerationContext,
  caseId: string,
  violationType: 'pain-rebound' | 'so-contradiction' | 'pacemaker-stim'
): GoldenCase | null {
  console.log(`\n🔄 正在生成错误案例: ${caseId} (${violationType})`)

  const note = generateSOAPNote(context)
  let soapText = exportSOAPAsText(context)

  // 注入违规
  switch (violationType) {
    case 'pain-rebound':
      // AC-3.1: Pain 反弹
      soapText = soapText.replace(
        /Pain Scale: Worst: (\d+) ; Best: (\d+) ; Current: (\d+)/,
        'Pain Scale: Worst: 5 ; Best: 3 ; Current: 7'
      )
      note.subjective.painScale = { worst: 5, best: 3, current: 7 }
      break

    case 'so-contradiction':
      // AC-4.1: S-O-A 矛盾 (Subjective 说 severe，但 Assessment 说 mild)
      soapText = soapText.replace(
        /TCM Diagnosis:.*?(local pattern|Local pattern)/s,
        'TCM Diagnosis: Mild-Moderate local pattern'
      )
      break

    case 'pacemaker-stim':
      // AC-6.1: Pacemaker + 电刺激
      context.hasPacemaker = true
      soapText = soapText.replace(
        /(Needle Protocol:.*?)/s,
        '$1\nElectrical Stimulation: YES (applied to all points)'
      )
      break
  }

  // 自我检查
  const auditReport = auditor.audit(note, context)

  console.log(`📊 审核结果: ${auditReport.overallResult} (评分: ${auditReport.qualityScore})`)
  console.log(`❌ 检测到 ${auditReport.layer1.violations.length} 个违规`)

  // 验证是否真的检测到违规
  if (auditReport.overallResult === 'PASS') {
    console.log('⚠️ 警告: 错误案例未被检测到违规，跳过')
    return null
  }

  const keyFeatures: Record<string, any> = {
    violationType,
    injectedViolation: violationType,
  }

  const errorCase: GoldenCase = {
    id: caseId,
    type: 'typical-error',
    bodyPart: context.primaryBodyPart,
    noteType: context.noteType,
    tcmPattern: {
      local: context.localPattern,
      systemic: context.systemicPattern,
    },
    source: 'SOAP Generator v1.0 (Injected Violation)',
    qualityScore: auditReport.qualityScore,
    violations: auditReport.layer1.violations.map(v => v.ruleId),
    keyFeatures,
    auditResult: {
      overall: auditReport.overallResult,
      qualityScore: auditReport.qualityScore,
      violations: auditReport.layer1.violations.map(v =>
        `[${v.severity}] ${v.ruleId}: ${v.violation?.issue || v.message}`
      ),
    },
    soapText,
  }

  return errorCase
}

// 保存为 YAML 格式
function saveAsYAML(goldenCase: GoldenCase, filename: string) {
  const yaml: string[] = []

  yaml.push(`id: ${goldenCase.id}`)
  yaml.push(`type: ${goldenCase.type}`)
  yaml.push(`body_part: ${goldenCase.bodyPart}`)
  yaml.push(`note_type: ${goldenCase.noteType}`)
  yaml.push(`tcm_pattern:`)
  yaml.push(`  local: "${goldenCase.tcmPattern.local}"`)
  yaml.push(`  systemic: "${goldenCase.tcmPattern.systemic}"`)
  yaml.push(`source: "${goldenCase.source}"`)
  yaml.push(`quality_score: ${goldenCase.qualityScore}`)

  if (goldenCase.strengths && goldenCase.strengths.length > 0) {
    yaml.push(`strengths:`)
    goldenCase.strengths.forEach(s => yaml.push(`  - "${s}"`))
  }

  if (goldenCase.violations && goldenCase.violations.length > 0) {
    yaml.push(`violations:`)
    goldenCase.violations.forEach(v => yaml.push(`  - "${v}"`))
  }

  yaml.push(`key_features:`)
  Object.entries(goldenCase.keyFeatures).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      yaml.push(`  ${key}:`)
      value.forEach(v => yaml.push(`    - "${v}"`))
    } else {
      yaml.push(`  ${key}: ${JSON.stringify(value)}`)
    }
  })

  yaml.push(`audit_result:`)
  yaml.push(`  overall: ${goldenCase.auditResult.overall}`)
  yaml.push(`  quality_score: ${goldenCase.auditResult.qualityScore}`)
  yaml.push(`  violations:`)
  if (goldenCase.auditResult.violations.length === 0) {
    yaml.push(`    []`)
  } else {
    goldenCase.auditResult.violations.forEach(v => yaml.push(`    - "${v}"`))
  }

  yaml.push(`\nsoap_text: |`)
  goldenCase.soapText.split('\n').forEach(line => {
    yaml.push(`  ${line}`)
  })

  const filepath = join(OUTPUT_DIR, filename)
  writeFileSync(filepath, yaml.join('\n'), 'utf-8')
  console.log(`✅ 已保存: ${filepath}`)
}

// ===== 生成优秀案例 =====

console.log('═'.repeat(60))
console.log('📋 开始生成优秀案例 (5 个)')
console.log('═'.repeat(60))

// 案例 1: KNEE IE - moderate to severe
const case1Context: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'OPTUM',
  primaryBodyPart: 'KNEE',
  laterality: 'left',
  localPattern: 'Cold-Damp + Wind-Cold',
  systemicPattern: 'Kidney Yang Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
}
const case1 = generateAndAudit(case1Context, 'GOLDEN_KNEE_IE_001')
if (case1) saveAsYAML(case1, 'GOLDEN_KNEE_IE_001.yaml')

// 案例 2: LBP TX - moderate
const case2Context: GenerationContext = {
  noteType: 'TX',
  insuranceType: 'HF',
  primaryBodyPart: 'LBP',
  laterality: 'bilateral',
  localPattern: 'Qi-Blood Stagnation',
  systemicPattern: 'Liver Qi Stagnation',
  chronicityLevel: 'Sub Acute',
  severityLevel: 'moderate',
}
const case2 = generateAndAudit(case2Context, 'GOLDEN_LBP_TX_001')
if (case2) saveAsYAML(case2, 'GOLDEN_LBP_TX_001.yaml')

// 案例 3: SHOULDER IE - severe
const case3Context: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'OPTUM',
  primaryBodyPart: 'SHOULDER',
  laterality: 'right',
  localPattern: 'Qi-Blood Stagnation',
  systemicPattern: 'Qi Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'severe',
}
const case3 = generateAndAudit(case3Context, 'GOLDEN_SHOULDER_IE_001')
if (case3) saveAsYAML(case3, 'GOLDEN_SHOULDER_IE_001.yaml')

// 案例 4: NECK TX - mild to moderate
const case4Context: GenerationContext = {
  noteType: 'TX',
  insuranceType: 'HF',
  primaryBodyPart: 'NECK',
  laterality: 'unspecified',
  localPattern: 'Cold-Damp',
  systemicPattern: 'Spleen Qi Deficiency',
  chronicityLevel: 'Acute',
  severityLevel: 'mild to moderate',
}
const case4 = generateAndAudit(case4Context, 'GOLDEN_NECK_TX_001')
if (case4) saveAsYAML(case4, 'GOLDEN_NECK_TX_001.yaml')

// 案例 5: ELBOW IE - moderate
const case5Context: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'OPTUM',
  primaryBodyPart: 'ELBOW',
  laterality: 'left',
  localPattern: 'Qi-Blood Stagnation',
  systemicPattern: 'Liver Qi Stagnation',
  chronicityLevel: 'Sub Acute',
  severityLevel: 'moderate',
}
const case5 = generateAndAudit(case5Context, 'GOLDEN_ELBOW_IE_001')
if (case5) saveAsYAML(case5, 'GOLDEN_ELBOW_IE_001.yaml')

// ===== 生成错误案例 =====

console.log('\n' + '═'.repeat(60))
console.log('❌ 开始生成错误案例 (3 个)')
console.log('═'.repeat(60))

// 错误案例 1: Pain 反弹
const error1Context: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'OPTUM',
  primaryBodyPart: 'KNEE',
  laterality: 'right',
  localPattern: 'Cold-Damp',
  systemicPattern: 'Kidney Yang Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate',
}
const error1 = generateErrorCase(error1Context, 'ERROR_PAIN_REBOUND_001', 'pain-rebound')
if (error1) saveAsYAML(error1, 'ERROR_PAIN_REBOUND_001.yaml')

// 错误案例 2: S-O-A 矛盾
const error2Context: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'OPTUM',
  primaryBodyPart: 'LBP',
  laterality: 'bilateral',
  localPattern: 'Qi-Blood Stagnation',
  systemicPattern: 'Liver Qi Stagnation',
  chronicityLevel: 'Chronic',
  severityLevel: 'severe',
}
const error2 = generateErrorCase(error2Context, 'ERROR_SOA_CONTRADICTION_001', 'so-contradiction')
if (error2) saveAsYAML(error2, 'ERROR_SOA_CONTRADICTION_001.yaml')

// 错误案例 3: Pacemaker + 电刺激
const error3Context: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'OPTUM',
  primaryBodyPart: 'SHOULDER',
  laterality: 'left',
  localPattern: 'Cold-Damp',
  systemicPattern: 'Heart Qi Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  hasPacemaker: true,
}
const error3 = generateErrorCase(error3Context, 'ERROR_PACEMAKER_STIM_001', 'pacemaker-stim')
if (error3) saveAsYAML(error3, 'ERROR_PACEMAKER_STIM_001.yaml')

console.log('\n' + '═'.repeat(60))
console.log('✅ 案例生成完成')
console.log(`📁 输出目录: ${OUTPUT_DIR}`)
console.log('═'.repeat(60))
