/**
 * 审计加权链完整性
 * 目标:
 * 1) 所有加权字段必须在模板动态字段白名单内
 * 2) 规则驱动字段必须至少被一条模板规则覆盖
 */

import * as fs from 'fs'
import * as path from 'path'
import { isTemplateField } from '../src/parser/template-rule-whitelist'
import { TEMPLATE_ONLY_RULES } from '../src/parser/template-logic-rules'

type CoverageMode = 'rule' | 'policy'

interface FieldCheck {
  fieldPath: string
  mode: CoverageMode
  inTemplate: boolean
  hasRuleCoverage: boolean
  status: 'OK' | 'MISSING_TEMPLATE_FIELD' | 'MISSING_RULE_COVERAGE'
}

const WEIGHT_CHAIN_FIELDS: Array<{ fieldPath: string; mode: CoverageMode }> = [
  { fieldPath: 'subjective.painTypes', mode: 'rule' },
  { fieldPath: 'subjective.causativeFactors', mode: 'rule' },
  { fieldPath: 'subjective.exacerbatingFactors', mode: 'rule' },
  { fieldPath: 'subjective.adlDifficulty.level', mode: 'rule' },
  { fieldPath: 'subjective.adlDifficulty.activities', mode: 'rule' },
  { fieldPath: 'subjective.painFrequency', mode: 'rule' },
  { fieldPath: 'subjective.symptomDuration.unit', mode: 'rule' },
  { fieldPath: 'objective.muscleTesting.muscles', mode: 'rule' },
  { fieldPath: 'objective.muscleTesting.tightness.gradingScale', mode: 'rule' },
  { fieldPath: 'objective.muscleTesting.tenderness.gradingScale', mode: 'rule' },
  { fieldPath: 'objective.tonguePulse.tongue', mode: 'rule' },
  { fieldPath: 'objective.tonguePulse.pulse', mode: 'rule' },
  { fieldPath: 'assessment.tcmDiagnosis.localPattern', mode: 'rule' },
  { fieldPath: 'assessment.tcmDiagnosis.systemicPattern', mode: 'rule' },
  { fieldPath: 'assessment.treatmentPrinciples.focusOn', mode: 'rule' },
  { fieldPath: 'assessment.generalCondition', mode: 'rule' },
  { fieldPath: 'plan.shortTermGoal.treatmentFrequency', mode: 'rule' },
  { fieldPath: 'plan.needleProtocol.points', mode: 'rule' },
  { fieldPath: 'plan.needleProtocol.electricalStimulation', mode: 'policy' },
  { fieldPath: 'plan.needleProtocol.totalTime', mode: 'policy' }
]

function checkFields(): FieldCheck[] {
  return WEIGHT_CHAIN_FIELDS.map(item => {
    const inTemplate = isTemplateField(item.fieldPath)
    const hasRuleCoverage = TEMPLATE_ONLY_RULES.some(rule =>
      rule.effects.some(effect => effect.targetField === item.fieldPath)
    )

    let status: FieldCheck['status'] = 'OK'
    if (!inTemplate) {
      status = 'MISSING_TEMPLATE_FIELD'
    } else if (item.mode === 'rule' && !hasRuleCoverage) {
      status = 'MISSING_RULE_COVERAGE'
    }

    return {
      fieldPath: item.fieldPath,
      mode: item.mode,
      inTemplate,
      hasRuleCoverage,
      status
    }
  })
}

function toMarkdown(rows: FieldCheck[]): string {
  const missingTemplate = rows.filter(r => r.status === 'MISSING_TEMPLATE_FIELD')
  const missingCoverage = rows.filter(r => r.status === 'MISSING_RULE_COVERAGE')

  let out = '# Weight Chain Completeness Audit\n\n'
  out += `- Total fields: ${rows.length}\n`
  out += `- Missing template field: ${missingTemplate.length}\n`
  out += `- Missing rule coverage (rule mode only): ${missingCoverage.length}\n\n`

  out += '## Field Status\n\n'
  out += '| Field | Mode | In Template | Rule Coverage | Status |\n'
  out += '|---|---|---|---|---|\n'
  for (const r of rows) {
    out += `| ${r.fieldPath} | ${r.mode} | ${r.inTemplate ? 'yes' : 'no'} | ${r.hasRuleCoverage ? 'yes' : 'no'} | ${r.status} |\n`
  }

  return out
}

function main(): void {
  const rows = checkFields()
  const md = toMarkdown(rows)

  const outDir = path.join(process.cwd(), 'data')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'weight-chain-completeness.md'), md, 'utf-8')
  fs.writeFileSync(path.join(outDir, 'weight-chain-completeness.json'), JSON.stringify(rows, null, 2), 'utf-8')

  console.log(md)
  console.log('\nSaved:')
  console.log(path.join(outDir, 'weight-chain-completeness.md'))
  console.log(path.join(outDir, 'weight-chain-completeness.json'))
}

main()
