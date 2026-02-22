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
        const valid = templateOptions.chronicityLevel?.options ?? []
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
        const valid = templateOptions.severityLevel?.options ?? []
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
        const valid = templateOptions.generalCondition?.options ?? []
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

    // V01: Pain 纵向逻辑 - Pain 不应反弹
    this.rules.push({
      id: 'V01',
      severity: 'CRITICAL',
      check: (note, context) => {
        if (context?.visitType === 'initial') return null
        if (context?.previousPain === undefined || note.painScaleCurrent === undefined) return null

        if (note.painScaleCurrent > context.previousPain + 0.1) {
          return {
            ruleId: 'V01',
            passed: false,
            severity: 'CRITICAL',
            violation: {
              location: 'Subjective - Pain Scale',
              issue: `Pain 上升: ${context.previousPain} → ${note.painScaleCurrent}（上升 ${(note.painScaleCurrent - context.previousPain).toFixed(1)}）`,
              suggestion: 'Pain 应逐次下降或保持，如上升需在 SOAP 中解释原因'
            }
          }
        }
        return null
      }
    })

    // V02: Tightness 纵向逻辑
    this.rules.push({
      id: 'V02',
      severity: 'CRITICAL',
      check: (note, context) => {
        if (context?.visitType === 'initial') return null
        if (!context?.previousTightness || !note.tightnessCurrent) return null

        const tightnessMap: Record<string, number> = {
          'mild': 1,
          'mild to moderate': 2,
          'moderate': 3,
          'moderate to severe': 3.5,
          'severe': 4
        }

        const prevScore = tightnessMap[context.previousTightness]
        const currScore = tightnessMap[note.tightnessCurrent]

        if (prevScore === undefined || currScore === undefined) return null

        if (currScore > prevScore) {
          return {
            ruleId: 'V02',
            passed: false,
            severity: 'CRITICAL',
            violation: {
              location: 'Objective - Tightness',
              issue: `Tightness 恶化: ${context.previousTightness} → ${note.tightnessCurrent}`,
              suggestion: 'Tightness 应逐次改善或保持'
            }
          }
        }
        return null
      }
    })

    // V03: ROM 纵向逻辑
    this.rules.push({
      id: 'V03',
      severity: 'CRITICAL',
      check: (note, context) => {
        if (context?.visitType === 'initial') return null
        if (context?.previousROM === undefined || note.romCurrent === undefined) return null

        const romDelta = note.romCurrent - context.previousROM

        if (romDelta < -5) {
          return {
            ruleId: 'V03',
            passed: false,
            severity: 'CRITICAL',
            violation: {
              location: 'Objective - ROM',
              issue: `ROM 下降: ${context.previousROM}° → ${note.romCurrent}°（下降 ${Math.abs(romDelta)}°）`,
              suggestion: 'ROM 应逐次改善或保持，如下降需在 Assessment 中解释'
            }
          }
        }
        return null
      }
    })

    // AC-3.2: Pain Scale 内部一致性
    this.rules.push({
      id: 'AC-3.2',
      severity: 'CRITICAL',
      check: (note) => {
        const painScale = note.painScale || note.subjective?.painScale
        if (!painScale) return null

        const { worst, best, current } = painScale
        if (worst === undefined || best === undefined || current === undefined) return null

        if (current > worst) {
          return {
            ruleId: 'AC-3.2',
            passed: false,
            severity: 'CRITICAL',
            violation: {
              location: 'Subjective - Pain Scale',
              issue: `Current pain (${current}) 超过 Worst pain (${worst})`,
              suggestion: 'Current 必须 ≤ Worst'
            }
          }
        }

        if (current < best) {
          return {
            ruleId: 'AC-3.2',
            passed: false,
            severity: 'CRITICAL',
            violation: {
              location: 'Subjective - Pain Scale',
              issue: `Current pain (${current}) 低于 Best pain (${best})`,
              suggestion: 'Current 必须 ≥ Best'
            }
          }
        }

        return null
      }
    })

    // IE01: 初诊 Pain Scale 必须 6-8
    this.rules.push({
      id: 'IE01',
      severity: 'CRITICAL',
      check: (note) => {
        if (note.noteType !== 'IE') return null

        const pain = note.painScaleCurrent || note.subjective?.painScale?.current
        if (pain === undefined) return null

        if (pain < 6 || pain > 8) {
          return {
            ruleId: 'IE01',
            passed: false,
            severity: 'CRITICAL',
            violation: {
              location: 'Subjective - Pain Scale',
              issue: `IE 笔记 pain (${pain}) 不在标准区间 [6, 8]`,
              suggestion: 'IE 笔记的 pain 应为 6-8 之间'
            }
          }
        }
        return null
      }
    })

    // IE02: 初诊 Severity 必须为 moderate to severe
    this.rules.push({
      id: 'IE02',
      severity: 'CRITICAL',
      check: (note) => {
        if (note.noteType !== 'IE') return null
        if (!note.severityLevel) return null

        if (note.severityLevel !== 'moderate to severe') {
          return {
            ruleId: 'IE02',
            passed: false,
            severity: 'CRITICAL',
            violation: {
              location: 'Subjective - Severity',
              issue: `IE 笔记 severity 为 "${note.severityLevel}"，不符合标准`,
              suggestion: 'IE 笔记必须使用 "moderate to severe"'
            }
          }
        }
        return null
      }
    })

    // IE03: 初诊 Chronicity 必须为 Chronic
    this.rules.push({
      id: 'IE03',
      severity: 'CRITICAL',
      check: (note) => {
        if (note.noteType !== 'IE') return null
        if (!note.chronicityLevel) return null

        if (note.chronicityLevel !== 'Chronic') {
          return {
            ruleId: 'IE03',
            passed: false,
            severity: 'CRITICAL',
            violation: {
              location: 'Subjective - Chronicity',
              issue: `IE 笔记 chronicity 为 "${note.chronicityLevel}"，不符合标准`,
              suggestion: 'IE 笔记必须使用 "Chronic"'
            }
          }
        }
        return null
      }
    })

    // IE04: 初诊 General Condition 必须为 fair
    this.rules.push({
      id: 'IE04',
      severity: 'CRITICAL',
      check: (note) => {
        if (note.noteType !== 'IE') return null
        if (!note.generalCondition) return null

        if (note.generalCondition !== 'fair') {
          return {
            ruleId: 'IE04',
            passed: false,
            severity: 'CRITICAL',
            violation: {
              location: 'Assessment - General Condition',
              issue: `IE 笔记 general condition 为 "${note.generalCondition}"，不符合标准`,
              suggestion: 'IE 笔记必须使用 "fair"'
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
