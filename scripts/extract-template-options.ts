/**
 * 从 HTML 模板提取动态字段选项
 * 基准 2: Template 动态/静态字段
 */
import * as fs from 'fs'
import * as path from 'path'

const TEMPLATE_DIR = 'tests/alltest'

interface FieldOptions {
  [fieldName: string]: {
    type: 'single' | 'multi'
    options: string[]
    source: string
  }
}

function extractOptionsFromHtml(html: string, filename: string): FieldOptions {
  const result: FieldOptions = {}
  
  // ppnSelectComboSingle - 单选
  const singlePattern = /class="ppnSelectComboSingle ([^"]+)"/g
  let match
  while ((match = singlePattern.exec(html)) !== null) {
    const options = match[1].split('|').map(s => s.trim())
    const key = inferFieldName(options, filename)
    if (key && !result[key]) {
      result[key] = { type: 'single', options, source: filename }
    }
  }
  
  // ppnSelectCombo - 多选
  const multiPattern = /class="ppnSelectCombo ([^"]+)"/g
  while ((match = multiPattern.exec(html)) !== null) {
    const options = match[1].split('|').map(s => s.trim())
    const key = inferFieldName(options, filename)
    if (key && !result[key]) {
      result[key] = { type: 'multi', options, source: filename }
    }
  }
  
  return result
}

function inferFieldName(options: string[], filename: string): string | null {
  const first = options[0]?.toLowerCase() || ''
  const joined = options.join('|')
  
  if (options.includes('Acute') && options.includes('Chronic')) return 'chronicityLevel'
  if (options.includes('along right') || options.includes('in bilateral')) return 'laterality'
  if (options.includes('severe') && options.includes('mild') && options.length === 5) return 'severityLevel'
  if (options.includes('good') && options.includes('fair') && options.includes('poor')) return 'generalCondition'
  if (options.includes('improvement') && options.includes('exacerbate')) return 'symptomChange'
  if (options.includes('Dull') && options.includes('Burning')) return 'painTypes'
  if (options.includes('Qi Stagnation') || options.includes('Blood Stasis')) return 'localPattern'
  if (options.includes('Kidney Yang Deficiency')) return 'systemicPattern'
  if (joined.includes('10-9') && joined.includes('9-8')) return 'painScale'
  if (options.some(o => o.includes('(+4)') && o.includes('tenderness'))) return 'tendernessScale'
  if (options.some(o => o.includes('spasm'))) return 'spasmScale'
  
  return null
}

function main() {
  const allOptions: FieldOptions = {}
  
  const dirs = ['ie', 'tx', 'needles', 'tone']
  for (const dir of dirs) {
    const dirPath = path.join(TEMPLATE_DIR, dir)
    if (!fs.existsSync(dirPath)) continue
    
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'))
    for (const file of files) {
      const content = fs.readFileSync(path.join(dirPath, file), 'utf-8')
      const options = extractOptionsFromHtml(content, `${dir}/${file}`)
      Object.assign(allOptions, options)
    }
  }
  
  // 输出
  const outputDir = 'src/auditor/baselines'
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(
    path.join(outputDir, 'template-options.json'),
    JSON.stringify(allOptions, null, 2)
  )
  
  console.log('提取完成:', Object.keys(allOptions).length, '个字段')
  for (const [key, val] of Object.entries(allOptions)) {
    console.log(`  ${key}: ${val.options.length} 选项 (${val.type})`)
  }
}

main()
