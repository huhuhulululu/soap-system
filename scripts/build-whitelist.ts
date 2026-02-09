/**
 * 预构建 whitelist JSON — 供浏览器端 setWhitelist() 使用
 * 运行: npx tsx scripts/build-whitelist.ts
 */
import { getAllTemplateFieldPaths, getTemplateOptionsForField } from '../src/parser/template-rule-whitelist'
import * as fs from 'fs'
import * as path from 'path'

const data: Record<string, string[]> = {}
for (const field of getAllTemplateFieldPaths()) {
  data[field] = getTemplateOptionsForField(field)
}

const outDir = path.join(__dirname, '..', 'frontend', 'src', 'data')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'whitelist.json')
fs.writeFileSync(outPath, JSON.stringify(data, null, 2))

const fields = Object.keys(data).length
const options = Object.values(data).reduce((s, a) => s + a.length, 0)
console.log(`✅ ${outPath}`)
console.log(`   ${fields} fields, ${options} options, ${fs.statSync(outPath).size} bytes`)
