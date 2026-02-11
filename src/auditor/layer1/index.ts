/**
 * Layer 1: 规则合规引擎
 * 执行确定性规则检查
 */
import * as fs from 'fs'

export interface RuleResult {
  ruleId: string
  passed: boolean
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  violation?: {
    location: string
    issue: string
    suggestion: string
  }
}

export interface Layer1Result {
  layer: 'rule_compliance'
  result: 'PASS' | 'FAIL'
  summary: {
    total: number
    passed: number
    failed: number
    passRate: string
  }
  violations: RuleResult[]
}

// 加载基准
const templateOptions = JSON.parse(
  fs.readFileSync('src/auditor/baselines/template-options.json', 'utf-8')
)
const engineRules = JSON.parse(
  fs.readFileSync('src/auditor/baselines/engine-rules.json', 'utf-8')
)

export class RuleComplianceEngine {
  private rules: Array<{
    id: string
    severity: RuleResult['severity']
    check: (note: any, context?: any) => RuleResult | null
  }> = []

  constructor() {
    this.initRules()
  }

  private initRules() {
    // AC-2: 选项合规
    this.rules.push({
      id: 'AC-2.1',
      severity: 'CRITICAL',
      check: (note) => {
        const valid = templateOptions.chronicityLevel?.options || []
        if (note.chronicityLevel && !valid.includes(note.chronicityLevel)) {
          return {
            ruleId: 'AC-2.1',
            passed: false,
            severity: 'CRITICAL',
            violation: {
              location: 'Subjective',
              issue: `chronicityLevel "${note.chronicityLevel}" 不在合法选项中`,
              suggestion: `使用: ${valid.join(', ')}`
            }
          }
        }
        return null
      }
    })

    this.rules.push({
      id: 'AC-2.2',
      severity: 'CRITICAL',
      check: (note) => {
        const valid = templateOptions.severityLevel?.options || []
        if (note.severityLevel && !valid.includes(note.severityLevel)) {
          return {
            ruleId: 'AC-2.2',
            passed: false,
            severity: 'CRITICAL',
            violation: {
              location: 'Subjective',
              issue: `severityLevel "${note.severityLevel}" 不在合法选项中`,
              suggestion: `使用: ${valid.join(', ')}`
            }
          }
        }
        return null
      }
    })

    this.rules.push({
      id: 'AC-2.3',
      severity: 'CRITICAL',
      check: (note) => {
        const valid = templateOptions.generalCondition?.options || []
        if (note.generalCondition && !valid.includes(note.generalCondition)) {
          return {
            ruleId: 'AC-2.3',
            passed: false,
            severity: 'CRITICAL',
            violation: {
              location: 'Assessment',
              issue: `generalCondition "${note.generalCondition}" 不在合法选项中`,
              suggestion: `使用: ${valid.join(', ')}`
            }
          }
        }
        return null
      }
    })

    // AC-3: 纵向逻辑
    this.rules.push({
      id: 'AC-3.1',
      severity: 'CRITICAL',
      check: (note, context) => {
        if (context?.previousPain !== undefined && note.painScaleCurrent !== undefined) {
          if (note.painScaleCurrent > context.previousPain + 0.1) {
            return {
              ruleId: 'AC-3.1',
              passed: false,
              severity: 'CRITICAL',
              violation: {
                location: 'Subjective',
                issue: `pain ${note.painScaleCurrent} > 前次 ${context.previousPain}`,
                suggestion: 'pain 应持续下降或保持'
              }
            }
          }
        }
        return null
      }
    })

    // AC-4: S-O-A 链
    this.rules.push({
      id: 'AC-4.1',
      severity: 'HIGH',
      check: (note, context) => {
        if (context?.previousPain !== undefined && note.painScaleCurrent !== undefined) {
          const painDelta = context.previousPain - note.painScaleCurrent
          const symptomChange = note.symptomChange || ''
          
          if (painDelta >= 1 && symptomChange.includes('exacerbate')) {
            return {
              ruleId: 'AC-4.1',
              passed: false,
              severity: 'HIGH',
              violation: {
                location: 'Assessment',
                issue: `pain 下降 ${painDelta.toFixed(1)} 但 symptomChange 为 "exacerbate"`,
                suggestion: '应改为 "improvement" 或 "slight improvement"'
              }
            }
          }
        }
        return null
      }
    })

    // AC-6: 针刺协议
    this.rules.push({
      id: 'AC-6.1',
      severity: 'CRITICAL',
      check: (note) => {
        if (note.hasPacemaker && note.electricalStimulation === true) {
          return {
            ruleId: 'AC-6.1',
            passed: false,
            severity: 'CRITICAL',
            violation: {
              location: 'Plan',
              issue: '有 Pacemaker 但使用了电刺激',
              suggestion: '禁止对 Pacemaker 患者使用电刺激'
            }
          }
        }
        return null
      }
    })
  }

  check(note: any, context?: any): Layer1Result {
    const violations: RuleResult[] = []
    
    for (const rule of this.rules) {
      const result = rule.check(note, context)
      if (result) {
        violations.push(result)
      }
    }

    const total = this.rules.length
    const failed = violations.length
    const passed = total - failed

    return {
      layer: 'rule_compliance',
      result: violations.some(v => v.severity === 'CRITICAL') ? 'FAIL' : 'PASS',
      summary: {
        total,
        passed,
        failed,
        passRate: `${((passed / total) * 100).toFixed(1)}%`
      },
      violations
    }
  }
}
