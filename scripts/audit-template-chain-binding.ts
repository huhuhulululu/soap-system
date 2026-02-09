/**
 * 审计“模板动态字段 -> 规则链绑定”覆盖率
 *
 * 规则:
 * - 统计模板中可识别 fieldPath（排除 unknown）
 * - 字段若在规则 conditions 或 effects 出现，即视为已绑定
 * - 允许少量“既定事实/策略字段”通过白名单排除
 *
 * 运行:
 *   npx ts-node scripts/audit-template-chain-binding.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { parseTemplate, extractDropdowns } from '../src/parser/dropdown-parser'
import { TEMPLATE_ONLY_RULES } from '../src/parser/template-logic-rules'

const TEMPLATE_ROOT = '/Users/ping/Desktop/Code/2_8/templete'
const FOLDERS = ['ie', 'tx'] as const
const EXTRA_FOLDERS = ['tone', 'needles'] as const

type FieldCoverage = {
  fieldPath: string
  count: number
  inConditions: boolean
  inEffects: boolean
  excluded: boolean
  status: 'OK' | 'EXCLUDED' | 'MISSING'
}

// 用户确认可排除: 既定事实/基础病/策略固定
const EXCLUDED_FIELDS = new Set<string>([
  'subjective.primaryBodyPart.bodyPart',
  'subjective.primaryBodyPart.laterality',
  'subjective.medicalHistory',
  'subjective.painScale',
  'subjective.painScale.worst',
  'subjective.painScale.best',
  'subjective.painRadiation',
  'objective.rom.degrees',
  'objective.rom.strength',
  'plan.evaluationType',
  'plan.needleProtocol.electricalStimulation',
  'plan.needleProtocol.totalTime'
])

function collectTemplateFields(): Map<string, number> {
  const fieldCounts = new Map<string, number>()

  for (const folder of FOLDERS) {
    const folderPath = path.join(TEMPLATE_ROOT, folder)
    if (!fs.existsSync(folderPath)) continue

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'))
    for (const file of files) {
      const fullPath = path.join(folderPath, file)
      const content = fs.readFileSync(fullPath, 'utf-8')
      const parsed = parseTemplate(content, file, 'UNKNOWN')
      for (const dd of parsed.dropdowns) {
        if (dd.fieldPath === 'unknown') continue
        fieldCounts.set(dd.fieldPath, (fieldCounts.get(dd.fieldPath) || 0) + 1)
      }
    }
  }

  for (const folder of EXTRA_FOLDERS) {
    const folderPath = path.join(TEMPLATE_ROOT, folder)
    if (!fs.existsSync(folderPath)) continue

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'))
    for (const file of files) {
      const fullPath = path.join(folderPath, file)
      const content = fs.readFileSync(fullPath, 'utf-8')
      const section = folder === 'tone' ? 'O' : 'P'
      const dds = extractDropdowns(content, section, file)
      for (const dd of dds) {
        if (dd.fieldPath === 'unknown') continue
        fieldCounts.set(dd.fieldPath, (fieldCounts.get(dd.fieldPath) || 0) + 1)
      }
    }
  }

  return fieldCounts
}

function audit(): FieldCoverage[] {
  const fields = collectTemplateFields()
  const conditionFields = new Set<string>()
  const effectFields = new Set<string>()

  for (const rule of TEMPLATE_ONLY_RULES) {
    for (const c of rule.conditions) conditionFields.add(c.field)
    for (const e of rule.effects) effectFields.add(e.targetField)
  }

  const rows: FieldCoverage[] = []
  for (const [fieldPath, count] of Array.from(fields.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    const inConditions = conditionFields.has(fieldPath)
    const inEffects = effectFields.has(fieldPath)
    const excluded = EXCLUDED_FIELDS.has(fieldPath)
    const status: FieldCoverage['status'] = excluded
      ? 'EXCLUDED'
      : (inConditions || inEffects) ? 'OK' : 'MISSING'

    rows.push({ fieldPath, count, inConditions, inEffects, excluded, status })
  }

  return rows
}

function render(rows: FieldCoverage[]): string {
  const total = rows.length
  const ok = rows.filter(r => r.status === 'OK').length
  const excluded = rows.filter(r => r.status === 'EXCLUDED').length
  const missing = rows.filter(r => r.status === 'MISSING').length

  let out = '# Template Chain Binding Audit\n\n'
  out += `- Total recognized fields: ${total}\n`
  out += `- Bound by rule chain: ${ok}\n`
  out += `- Excluded fixed/policy fields: ${excluded}\n`
  out += `- Missing binding: ${missing}\n\n`

  out += '## Field Status\n\n'
  out += '| Field | Dropdown Count | In Conditions | In Effects | Status |\n'
  out += '|---|---:|---:|---:|---|\n'
  for (const r of rows) {
    out += `| ${r.fieldPath} | ${r.count} | ${r.inConditions ? 'yes' : 'no'} | ${r.inEffects ? 'yes' : 'no'} | ${r.status} |\n`
  }

  if (missing > 0) {
    out += '\n## Missing Fields\n\n'
    for (const m of rows.filter(r => r.status === 'MISSING')) {
      out += `- ${m.fieldPath}\n`
    }
  }

  return out
}

function main() {
  const rows = audit()
  const report = render(rows)
  const outDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  fs.writeFileSync(path.join(outDir, 'template-chain-binding-audit.md'), report, 'utf-8')
  fs.writeFileSync(path.join(outDir, 'template-chain-binding-audit.json'), JSON.stringify(rows, null, 2), 'utf-8')

  console.log(report)
  console.log('\nSaved:')
  console.log(path.join(outDir, 'template-chain-binding-audit.md'))
  console.log(path.join(outDir, 'template-chain-binding-audit.json'))
}

main()
