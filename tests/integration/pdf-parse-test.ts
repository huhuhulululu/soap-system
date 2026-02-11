/**
 * PDF 解析能力测试
 */
import { parseOptumNote } from '../../parsers/optum-note/parser.ts'
import * as fs from 'fs'
import * as path from 'path'
// @ts-ignore
import * as pdfjs from '../../frontend/node_modules/pdfjs-dist/legacy/build/pdf.mjs'

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

async function main() {
  const dir = '/Users/ping/Desktop/Processing/Optum note'
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'))

  console.log('🧪 PDF 解析能力测试')
  console.log('═'.repeat(70))
  console.log(`共 ${files.length} 个 PDF 文件`)
  console.log('')

  let passed = 0, failed = 0
  const failures: {file: string, err: string, sample?: string}[] = []

  for (const file of files) {
    const filePath = path.join(dir, file)
    const shortName = file.slice(0, 35).padEnd(35)
    
    try {
      const text = await extractText(filePath)
      const result = parseOptumNote(text)
      
      if (result.success && result.document) {
        const doc = result.document
        const visits = doc.visits?.length || 0
        const ie = doc.visits?.find(v => v.subjective?.visitType === 'INITIAL EVALUATION')
        const tx = visits - (ie ? 1 : 0)
        console.log(`✅ ${shortName} | ${visits.toString().padStart(2)} visits (IE:${ie?'Y':'N'} TX:${tx.toString().padStart(2)})`)
        passed++
      } else {
        const err = result.errors?.[0]?.message || 'Unknown'
        console.log(`❌ ${shortName} | ${err}`)
        // 保存文本样本用于调试
        const hasSubjective = text.includes('Subjective')
        const sample = text.slice(0, 200).replace(/\n/g, ' ')
        failures.push({file, err, sample: hasSubjective ? undefined : sample})
        failed++
      }
    } catch (e: any) {
      console.log(`❌ ${shortName} | Exception: ${e.message?.slice(0, 40)}`)
      failures.push({file, err: e.message?.slice(0, 50)})
      failed++
    }
  }

  console.log('')
  console.log('═'.repeat(70))
  console.log(`结果: ${passed}/${files.length} 通过 (${(passed/files.length*100).toFixed(1)}%)`)
  
  if (failures.length > 0 && failures.length <= 10) {
    console.log('')
    console.log('失败详情:')
    failures.forEach(f => {
      console.log(`  - ${f.file}: ${f.err}`)
      if (f.sample) console.log(`    Sample: ${f.sample.slice(0, 100)}...`)
    })
  }
}

main().catch(console.error)
