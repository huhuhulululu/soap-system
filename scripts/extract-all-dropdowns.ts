/**
 * 提取所有模板中的下拉框信息
 * 运行: npx ts-node scripts/extract-all-dropdowns.ts
 */

import * as fs from 'fs'
import * as path from 'path'

interface DropdownInfo {
  id: number
  file: string
  folder: string
  section: string
  type: 'single' | 'multi'
  options: string[]
  defaultValue: string
  context: string  // 前后文本
}

const TEMPLATE_ROOT = '/Users/ping/Desktop/Code/2_8/templete'

// 正则表达式
const SINGLE_REGEX = /class="ppnSelectComboSingle\s+([^"]+)"[^>]*>([^<]*)</g
const MULTI_REGEX = /class="ppnSelectCombo\s+([^"]+)"[^>]*>([^<]*)</g

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function extractContext(content: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - 80)
  const end = Math.min(content.length, matchIndex + matchLength + 80)
  return content.slice(start, end)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

function inferSection(content: string, matchIndex: number): string {
  const before = content.slice(0, matchIndex).toLowerCase()

  // 从后往前找最近的section标记
  const planIdx = before.lastIndexOf('plan')
  const assessmentIdx = before.lastIndexOf('assessment')
  const objectiveIdx = before.lastIndexOf('objective')
  const subjectiveIdx = Math.max(before.lastIndexOf('subjective'), before.lastIndexOf('subject'))

  const indices = [
    { section: 'P', idx: planIdx },
    { section: 'A', idx: assessmentIdx },
    { section: 'O', idx: objectiveIdx },
    { section: 'S', idx: subjectiveIdx }
  ].filter(x => x.idx >= 0)

  if (indices.length === 0) return 'Unknown'

  indices.sort((a, b) => b.idx - a.idx)
  return indices[0].section
}

function parseFile(filePath: string, folder: string): DropdownInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const fileName = path.basename(filePath)
  const dropdowns: DropdownInfo[] = []
  let globalId = 0

  // 提取单选
  let match: RegExpExecArray | null
  const singleRegex = new RegExp(SINGLE_REGEX.source, 'g')

  while ((match = singleRegex.exec(content)) !== null) {
    const optionStr = match[1]
    const defaultVal = match[2]
    const options = optionStr.split('|').map(o => decodeHtml(o))

    dropdowns.push({
      id: globalId++,
      file: fileName,
      folder,
      section: inferSection(content, match.index),
      type: 'single',
      options,
      defaultValue: decodeHtml(defaultVal),
      context: extractContext(content, match.index, match[0].length)
    })
  }

  // 提取复选
  const multiRegex = new RegExp(MULTI_REGEX.source, 'g')

  while ((match = multiRegex.exec(content)) !== null) {
    const optionStr = match[1]
    const defaultVal = match[2]
    const options = optionStr.split('|').map(o => decodeHtml(o))

    dropdowns.push({
      id: globalId++,
      file: fileName,
      folder,
      section: inferSection(content, match.index),
      type: 'multi',
      options,
      defaultValue: decodeHtml(defaultVal),
      context: extractContext(content, match.index, match[0].length)
    })
  }

  return dropdowns
}

function scanFolder(folderPath: string, folderName: string): DropdownInfo[] {
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'))
  const allDropdowns: DropdownInfo[] = []

  for (const file of files) {
    const filePath = path.join(folderPath, file)
    allDropdowns.push(...parseFile(filePath, folderName))
  }

  return allDropdowns
}

// 主程序
const folders = ['ie', 'tx', 'tone', 'needles']
const allDropdowns: DropdownInfo[] = []
let globalCounter = 1

for (const folder of folders) {
  const folderPath = path.join(TEMPLATE_ROOT, folder)
  if (fs.existsSync(folderPath)) {
    const dropdowns = scanFolder(folderPath, folder)
    // 重新编号
    for (const d of dropdowns) {
      d.id = globalCounter++
      allDropdowns.push(d)
    }
  }
}

// 输出统计
console.log('=== 下拉框完整统计 ===\n')

// 按文件夹统计
const byFolder: Record<string, { single: number, multi: number }> = {}
for (const d of allDropdowns) {
  if (!byFolder[d.folder]) byFolder[d.folder] = { single: 0, multi: 0 }
  byFolder[d.folder][d.type]++
}

console.log('| 文件夹 | 单选 | 复选 | 小计 |')
console.log('|--------|------|------|------|')
for (const [folder, counts] of Object.entries(byFolder)) {
  console.log(`| ${folder} | ${counts.single} | ${counts.multi} | ${counts.single + counts.multi} |`)
}

const totalSingle = allDropdowns.filter(d => d.type === 'single').length
const totalMulti = allDropdowns.filter(d => d.type === 'multi').length
console.log(`| **总计** | **${totalSingle}** | **${totalMulti}** | **${allDropdowns.length}** |`)

// 按section统计
console.log('\n=== 按SOAP分区统计 ===\n')
const bySection: Record<string, number> = {}
for (const d of allDropdowns) {
  bySection[d.section] = (bySection[d.section] || 0) + 1
}
console.log('| 分区 | 数量 |')
console.log('|------|------|')
for (const [section, count] of Object.entries(bySection).sort()) {
  console.log(`| ${section} | ${count} |`)
}

// 输出完整列表到JSON
const outputPath = path.join(TEMPLATE_ROOT, 'soap-system', 'data', 'all-dropdowns.json')
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, JSON.stringify(allDropdowns, null, 2))
console.log(`\n完整数据已保存到: ${outputPath}`)

// 输出去重后的唯一下拉框（按选项内容去重）
const uniqueByOptions = new Map<string, DropdownInfo>()
for (const d of allDropdowns) {
  const key = d.options.sort().join('|')
  if (!uniqueByOptions.has(key)) {
    uniqueByOptions.set(key, d)
  }
}
console.log(`\n去重后唯一下拉框类型: ${uniqueByOptions.size} 种`)

// 保存唯一类型
const uniquePath = path.join(TEMPLATE_ROOT, 'soap-system', 'data', 'unique-dropdowns.json')
fs.writeFileSync(uniquePath, JSON.stringify(Array.from(uniqueByOptions.values()), null, 2))
console.log(`唯一类型数据已保存到: ${uniquePath}`)
