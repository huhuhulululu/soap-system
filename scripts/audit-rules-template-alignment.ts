/**
 * 审计 logic-rules 与模板动态信息的一致性。
 *
 * 规则:
 * 1) condition.field 必须来自模板可解析字段
 * 2) effect.targetField 必须来自模板可解析字段
 * 3) effect.options 必须来自对应 targetField 的模板候选（若 targetField 无映射，则回退到全模板候选）
 *
 * 运行:
 *   npx ts-node scripts/audit-rules-template-alignment.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { ALL_LOGIC_RULES } from '../src/parser/logic-rules.ts'
import {
  isTemplateField,
  getTemplateOptionsForField,
  getAllTemplateFieldPaths,
  getAllTemplateOptionsNormalized
} from '../src/parser/template-rule-whitelist'

interface Issue {
  ruleId: string
  ruleName: string
  kind: 'condition-field' | 'target-field' | 'option'
  field?: string
  option?: string
  reason: string
}

function normalize(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function auditRules(allOptions: Set<string>): Issue[] {
  const issues: Issue[] = []

  for (const rule of ALL_LOGIC_RULES) {
    for (const cond of rule.conditions) {
      if (!isTemplateField(cond.field)) {
        issues.push({
          ruleId: rule.id,
          ruleName: rule.name,
          kind: 'condition-field',
          field: cond.field,
          reason: '条件字段不在模板可解析字段集合中'
        })
      }
    }

    for (const effect of rule.effects) {
      const targetField = effect.targetField
      if (!isTemplateField(targetField)) {
        issues.push({
          ruleId: rule.id,
          ruleName: rule.name,
          kind: 'target-field',
          field: targetField,
          reason: '目标字段不在模板可解析字段集合中'
        })
      }

      const targetOptions = new Set(getTemplateOptionsForField(targetField).map(normalize))
      for (const rawOption of effect.options) {
        const option = normalize(rawOption)
        const inField = targetOptions.has(option)
        const inAll = allOptions.has(option)
        if (!inField && !inAll) {
          issues.push({
            ruleId: rule.id,
            ruleName: rule.name,
            kind: 'option',
            field: targetField,
            option: rawOption,
            reason: '选项不在模板下拉候选集合中'
          })
        }
      }
    }
  }

  return issues
}

function buildReport(issues: Issue[], knownFieldCount: number): string {
  const byKind = {
    conditionField: issues.filter(i => i.kind === 'condition-field').length,
    targetField: issues.filter(i => i.kind === 'target-field').length,
    option: issues.filter(i => i.kind === 'option').length
  }

  let out = ''
  out += '# Rule vs Template Alignment Audit\n\n'
  out += `- Rules: ${ALL_LOGIC_RULES.length}\n`
  out += `- Parsed known fields: ${knownFieldCount}\n`
  out += `- Issues: ${issues.length}\n`
  out += `  - condition-field: ${byKind.conditionField}\n`
  out += `  - target-field: ${byKind.targetField}\n`
  out += `  - option: ${byKind.option}\n\n`

  if (issues.length === 0) {
    out += 'No issues found.\n'
    return out
  }

  const top = issues.slice(0, 120)
  out += '## First 120 Issues\n\n'
  for (const issue of top) {
    out += `- [${issue.kind}] ${issue.ruleId} (${issue.ruleName})`
    if (issue.field) out += ` field=${issue.field}`
    if (issue.option) out += ` option=${issue.option}`
    out += ` :: ${issue.reason}\n`
  }

  if (issues.length > top.length) {
    out += `\n... truncated ${issues.length - top.length} more issues\n`
  }

  return out
}

function main(): void {
  const allOptions = getAllTemplateOptionsNormalized()
  const knownFields = getAllTemplateFieldPaths()
  const issues = auditRules(allOptions)
  const report = buildReport(issues, knownFields.length)

  const outDir = path.join(process.cwd(), 'data')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'rule-template-audit.md'), report, 'utf-8')
  fs.writeFileSync(path.join(outDir, 'rule-template-audit.json'), JSON.stringify(issues, null, 2), 'utf-8')

  console.log(report)
  console.log('\nSaved:')
  console.log(path.join(outDir, 'rule-template-audit.md'))
  console.log(path.join(outDir, 'rule-template-audit.json'))
}

main()
