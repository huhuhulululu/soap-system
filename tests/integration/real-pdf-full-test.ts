/**
 * 29 个真实 PDF 全面测试
 * 测试: 解析 → 纠错 → 续写 → 审核
 */
import { parseOptumNote } from '../../parsers/optum-note/parser.ts'
import { checkDocument } from '../../parsers/optum-note/checker/note-checker.ts'
import { generateContinuation } from '../../frontend/src/services/generator.js'
import { AuditorAgent } from '../../src/auditor'
import * as fs from 'fs'
import * as path from 'path'
// @ts-ignore
import * as pdfjs from '../../frontend/node_modules/pdfjs-dist/legacy/build/pdf.mjs'

const agent = new AuditorAgent()

async function extractText(filePath: string): Promise<string> {
  const data = new Uint8Array(fs.readFileSync(filePath))
  const doc = await pdfjs.getDocument({ data }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((item: any) => item.str).join(' ') + '\n'
  }
  return text
}

interface TestResult {
  file: string
  parse: { success: boolean; visits: number; ie: boolean }
  check: { score: number; errors: number; grade: string }
  continuation: { success: boolean; generated: number; error?: string }
  audit: { passed: number; failed: number }
  content: { bodyPartMatch: boolean; muscleMatch: boolean; painLogic: boolean }
}

async function testFile(filePath: string): Promise<TestResult> {
  const file = path.basename(filePath)
  const result: TestResult = {
    file,
    parse: { success: false, visits: 0, ie: false },
    check: { score: 0, errors: 0, grade: 'F' },
    continuation: { success: false, generated: 0 },
    audit: { passed: 0, failed: 0 },
    content: { bodyPartMatch: true, muscleMatch: true, painLogic: true }
  }

  // 1. 解析
  const text = await extractText(filePath)
  const parsed = parseOptumNote(text)
  
  if (!parsed.success || !parsed.document) {
    return result
  }
  
  const doc = parsed.document
  result.parse.success = true
  result.parse.visits = doc.visits?.length || 0
  result.parse.ie = doc.visits?.some(v => v.subjective?.visitType === 'INITIAL EVALUATION') || false

  // 2. 纠错检查
  try {
    const checkResult = checkDocument({ 
      document: doc, 
      insuranceType: 'OPTUM', 
      treatmentTime: 60 
    })
    result.check.score = checkResult.summary?.scoring?.totalScore || 0
    result.check.errors = checkResult.errors?.length || 0
    result.check.grade = checkResult.summary?.scoring?.grade || 'F'
  } catch (e) {
    result.check.score = -1
  }

  // 3. 续写测试 (只对有 IE 的文档)
  if (result.parse.ie) {
    try {
      const contResult = generateContinuation(text, {
        insuranceType: 'OPTUM',
        treatmentTime: 60,
        generateCount: 3
      })
      
      if (contResult.error) {
        result.continuation.error = contResult.error
      } else {
        result.continuation.success = true
        result.continuation.generated = contResult.visits?.length || 0
        
        // 4. 审核续写结果
        // previousPain 应该是最后一个 TX 的 pain，不是 IE 的 pain
        let prevPain = contResult.parseSummary?.lastTxPain || contResult.parseSummary?.iePain || 8
        const bodyPart = contResult.parseSummary?.bodyPart || 'KNEE'
        
        for (const tx of contResult.visits || []) {
          // 内容验证: 检查生成的文本是否包含正确的部位
          const txText = tx.text || ''
          const bodyPartInText = txText.toLowerCase().includes(bodyPart.toLowerCase()) ||
            (bodyPart === 'LBP' && /lumbar|lower back/i.test(txText)) ||
            (bodyPart === 'NECK' && /cervical|neck/i.test(txText)) ||
            (bodyPart === 'MIDDLE_BACK' && /middle back|midback|thoracic/i.test(txText))
          if (!bodyPartInText) {
            result.content.bodyPartMatch = false
          }
          
          // 检查 Pain 逻辑: 不应该上升
          if (tx.state.painScaleCurrent > prevPain + 0.5) {
            result.content.painLogic = false
          }
          
          const report = agent.audit({
            noteType: 'TX',
            primaryBodyPart: contResult.parseSummary?.bodyPart || 'KNEE',
            chronicityLevel: 'Chronic',
            severityLevel: tx.state.severityLevel || 'moderate',
            generalCondition: tx.state.generalCondition || 'poor',
            painScaleCurrent: tx.state.painScaleCurrent,
            localPattern: contResult.parseSummary?.localPattern || 'Qi & Blood Deficiency',
            systemicPattern: 'Kidney Yang Deficiency',
            hasPacemaker: false,
            symptomChange: tx.state.symptomChange || 'improvement of symptom(s)'
          }, { previousPain: prevPain })
          
          if (report.overallResult === 'PASS' || report.overallResult === 'WARNING') {
            result.audit.passed++
          } else {
            result.audit.failed++
          }
          prevPain = tx.state.painScaleCurrent
        }
      }
    } catch (e: any) {
      result.continuation.error = e.message?.slice(0, 50)
    }
  }

  return result
}

async function main() {
  const dir = '/Users/ping/Desktop/Processing/Optum note'
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'))

  console.log('🧪 29 个真实 PDF 全面测试')
  console.log('═'.repeat(100))
  console.log('')

  const results: TestResult[] = []
  
  // 表头
  console.log('文件名'.padEnd(35) + ' | 解析 | 访问 | IE | 评分 | 错误 | 等级 | 续写 | 生成 | 审核  | 内容')
  console.log('─'.repeat(115))

  for (const file of files) {
    const filePath = path.join(dir, file)
    const r = await testFile(filePath)
    results.push(r)
    
    const shortName = file.slice(0, 33).padEnd(33)
    const parseOk = r.parse.success ? '✅' : '❌'
    const visits = r.parse.visits.toString().padStart(4)
    const ie = r.parse.ie ? 'Y' : 'N'
    const score = r.check.score >= 0 ? r.check.score.toString().padStart(4) : ' ERR'
    const errors = r.check.errors.toString().padStart(4)
    const grade = r.check.grade.padStart(4)
    const contOk = r.continuation.success ? '✅' : (r.continuation.error ? '❌' : '➖')
    const generated = r.continuation.generated.toString().padStart(4)
    const audit = r.audit.passed > 0 || r.audit.failed > 0 
      ? `${r.audit.passed}/${r.audit.passed + r.audit.failed}` 
      : '➖'
    const content = r.continuation.success 
      ? (r.content.bodyPartMatch && r.content.painLogic ? '✅' : '❌')
      : '➖'
    
    console.log(`${shortName} | ${parseOk}   | ${visits} | ${ie}  | ${score} | ${errors} | ${grade} | ${contOk}   | ${generated} | ${audit.padStart(5)} | ${content}`)
  }

  // 统计
  console.log('')
  console.log('═'.repeat(100))
  
  const parseSuccess = results.filter(r => r.parse.success).length
  const checkSuccess = results.filter(r => r.check.errors === 0).length
  const contSuccess = results.filter(r => r.continuation.success).length
  const contTotal = results.filter(r => r.parse.ie).length
  const auditPassed = results.reduce((sum, r) => sum + r.audit.passed, 0)
  const auditTotal = results.reduce((sum, r) => sum + r.audit.passed + r.audit.failed, 0)
  const totalVisits = results.reduce((sum, r) => sum + r.parse.visits, 0)
  const totalErrors = results.reduce((sum, r) => sum + r.check.errors, 0)
  const avgErrors = totalErrors / results.length

  console.log('')
  console.log('📊 统计汇总')
  console.log(`  解析成功: ${parseSuccess}/${results.length} (${(parseSuccess/results.length*100).toFixed(1)}%)`)
  console.log(`  总访问数: ${totalVisits}`)
  console.log(`  总错误数: ${totalErrors} (平均 ${avgErrors.toFixed(1)}/文档)`)
  console.log(`  无错误文档: ${checkSuccess}/${results.length}`)
  console.log(`  续写成功: ${contSuccess}/${contTotal} (${(contSuccess/contTotal*100).toFixed(1)}% 有IE的文档)`)
  console.log(`  审核通过: ${auditPassed}/${auditTotal} (${auditTotal > 0 ? (auditPassed/auditTotal*100).toFixed(1) : 0}%)`)

  // 失败详情
  const contFailed = results.filter(r => r.parse.ie && !r.continuation.success && r.continuation.error)
  if (contFailed.length > 0) {
    console.log('')
    console.log('❌ 续写失败详情:')
    contFailed.forEach(r => console.log(`  - ${r.file}: ${r.continuation.error}`))
  }

  const auditFailed = results.filter(r => r.audit.failed > 0)
  if (auditFailed.length > 0) {
    console.log('')
    console.log('⚠️ 审核有失败:')
    auditFailed.forEach(r => console.log(`  - ${r.file}: ${r.audit.failed}/${r.audit.passed + r.audit.failed} 失败`))
  }
}

main().catch(console.error)
