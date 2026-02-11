#!/usr/bin/env npx tsx
/**
 * SOAP 审核 CLI
 * 用法: npx tsx scripts/audit.ts [选项]
 */
import { AuditorAgent } from '../src/auditor'
import { parseOptumNote } from '../parsers/optum-note/parser'
import { exportSOAPAsText, exportTXSeriesAsText } from '../src/index'
import * as fs from 'fs'

const agent = new AuditorAgent()

// 解析命令行参数
const args = process.argv.slice(2)
const mode = args[0] || 'demo'

if (mode === 'help' || mode === '-h' || mode === '--help') {
  console.log(`
SOAP 审核 CLI

用法:
  npx tsx scripts/audit.ts demo          # 运行演示
  npx tsx scripts/audit.ts generate      # 审核生成的 SOAP
  npx tsx scripts/audit.ts text <file>   # 审核文本文件
  npx tsx scripts/audit.ts json <file>   # 审核 JSON 数据

示例:
  npx tsx scripts/audit.ts demo
  npx tsx scripts/audit.ts generate --bodyPart KNEE --type IE
  npx tsx scripts/audit.ts text note.txt
`)
  process.exit(0)
}

if (mode === 'demo') {
  console.log('=== 演示 1: 正常案例 ===\n')
  
  const normalNote = {
    noteType: 'IE',
    primaryBodyPart: 'KNEE',
    chronicityLevel: 'Chronic',
    severityLevel: 'moderate to severe',
    generalCondition: 'fair',
    painScaleCurrent: 7,
    localPattern: 'Cold-Damp + Wind-Cold',
    systemicPattern: 'Kidney Yang Deficiency',
    hasPacemaker: false,
    electricalStimulation: false
  }
  
  const report1 = agent.audit(normalNote)
  console.log(agent.formatReport(report1))
  
  console.log('\n=== 演示 2: 违规案例 ===\n')
  
  const badNote = {
    noteType: 'TX',
    primaryBodyPart: 'KNEE',
    chronicityLevel: 'Very Chronic',
    severityLevel: 'moderate to severe',
    generalCondition: 'excellent',
    painScaleCurrent: 8,
    localPattern: 'Blood Stasis',
    systemicPattern: 'Qi Deficiency',
    hasPacemaker: true,
    electricalStimulation: true
  }
  
  const report2 = agent.audit(badNote, { previousPain: 6 })
  console.log(agent.formatReport(report2))
}

if (mode === 'generate') {
  const bodyPart = args.find(a => a.startsWith('--bodyPart='))?.split('=')[1] || 'KNEE'
  const noteType = args.find(a => a.startsWith('--type='))?.split('=')[1] || 'IE'
  
  console.log(`生成并审核 ${bodyPart} ${noteType}...\n`)
  
  const context = {
    noteType: noteType as 'IE' | 'TX',
    insuranceType: 'OPTUM' as const,
    primaryBodyPart: bodyPart as any,
    laterality: 'bilateral' as const,
    localPattern: bodyPart === 'KNEE' ? 'Cold-Damp + Wind-Cold' : 'Qi Stagnation, Blood Stasis',
    systemicPattern: bodyPart === 'KNEE' ? 'Kidney Yang Deficiency' : 'Qi & Blood Deficiency',
    chronicityLevel: 'Chronic' as const,
    severityLevel: 'moderate to severe' as const,
    hasPacemaker: false,
  }
  
  if (noteType === 'IE') {
    const text = exportSOAPAsText(context)
    console.log('生成的 SOAP:\n')
    console.log(text.slice(0, 500) + '...\n')
    
    const report = agent.audit(context)
    console.log(agent.formatReport(report))
  } else {
    const series = exportTXSeriesAsText({ ...context, noteType: 'TX' }, { txCount: 3 })
    console.log(`生成了 ${series.length} 个 TX\n`)
    
    for (let i = 0; i < series.length; i++) {
      const tx = series[i]
      const prevPain = i > 0 ? series[i-1].state.painScaleCurrent : 8
      const report = agent.audit(tx.state, { previousPain: prevPain })
      console.log(`--- TX${i+1} ---`)
      console.log(`Pain: ${tx.state.painScaleCurrent}, Result: ${report.overallResult}, Score: ${report.qualityScore}`)
    }
  }
}

if (mode === 'text' && args[1]) {
  const file = args[1]
  if (!fs.existsSync(file)) {
    console.error(`文件不存在: ${file}`)
    process.exit(1)
  }
  
  const text = fs.readFileSync(file, 'utf-8')
  console.log(`解析文件: ${file}\n`)
  
  const result = parseOptumNote(text)
  if (!result.success) {
    console.error('解析失败:', result.errors)
    process.exit(1)
  }
  
  console.log(`解析成功: ${result.document!.visits.length} 个访问记录\n`)
  
  for (const visit of result.document!.visits) {
    const note = {
      noteType: visit.subjective.visitType === 'INITIAL EVALUATION' ? 'IE' : 'TX',
      primaryBodyPart: visit.subjective.bodyPart,
      chronicityLevel: visit.subjective.chronicityLevel,
      severityLevel: visit.subjective.severityLevel,
      generalCondition: visit.assessment?.generalCondition,
      painScaleCurrent: visit.subjective.painScale?.current || visit.subjective.painScale?.value,
      hasPacemaker: visit.subjective.medicalHistory?.includes('Pacemaker'),
    }
    
    const report = agent.audit(note)
    console.log(`--- ${visit.subjective.visitType} ---`)
    console.log(agent.formatReport(report))
    console.log('')
  }
}

if (mode === 'json' && args[1]) {
  const file = args[1]
  if (!fs.existsSync(file)) {
    console.error(`文件不存在: ${file}`)
    process.exit(1)
  }
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
  const report = agent.audit(data)
  console.log(agent.formatReport(report))
}
