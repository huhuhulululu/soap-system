/**
 * Layer 2: 医学逻辑检查
 * 启发式规则检查
 */

export interface HeuristicResult {
  ruleId: string
  triggered: boolean
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  detail: string
  reasoning: string
  suggestion: string
  confidence: number
}

export interface Layer2Result {
  layer: 'medical_logic'
  result: 'PASS' | 'WARNING'
  concerns: HeuristicResult[]
  manualReviewRequired: boolean
}

// 证型-疼痛性质映射
const patternPainMapping: Record<string, string[]> = {
  'Qi Deficiency': ['dull', 'aching', 'mild'],
  'Blood Stasis': ['stabbing', 'fixed', 'sharp'],
  'Qi Stagnation': ['distending', 'moving'],
  'Cold-Damp': ['heavy', 'cold', 'freezing'],
  'Damp-Heat': ['burning', 'hot']
}

export class MedicalLogicChecker {
  private heuristics: Array<{
    id: string
    name: string
    check: (note: any) => HeuristicResult | null
  }> = []

  constructor() {
    this.initHeuristics()
  }

  private initHeuristics() {
    // HS01: 证型-疼痛性质
    this.heuristics.push({
      id: 'HS01',
      name: '证型-疼痛性质关联',
      check: (note) => {
        const pattern = note.systemicPattern || ''
        const pain = note.painScaleCurrent || 0
        
        if (pattern.includes('Deficiency') && pain > 7) {
          return {
            ruleId: 'HS01',
            triggered: true,
            severity: 'MEDIUM',
            detail: `${pattern} 患者出现 severe pain (${pain}/10)`,
            reasoning: '虚证通常表现为隐痛、乏力，剧烈疼痛更符合实证',
            suggestion: '建议复核证型诊断或疼痛性质描述',
            confidence: 0.75
          }
        }
        return null
      }
    })

    // HS02: 部位-治疗原则
    this.heuristics.push({
      id: 'HS02',
      name: '部位-治疗原则关联',
      check: (note) => {
        const bodyPart = note.primaryBodyPart || ''
        const pattern = note.localPattern || ''
        
        if (bodyPart === 'KNEE' && pattern.includes('Heart')) {
          return {
            ruleId: 'HS02',
            triggered: true,
            severity: 'MEDIUM',
            detail: `KNEE 治疗使用了 Heart 相关证型`,
            reasoning: '膝关节通常不涉及心经治疗',
            suggestion: '建议复核证型诊断',
            confidence: 0.80
          }
        }
        return null
      }
    })

    // HS03: 疼痛-ROM 关联
    this.heuristics.push({
      id: 'HS03',
      name: '疼痛-ROM 关联',
      check: (note) => {
        const pain = note.painScaleCurrent || 0
        const rom = note.romCurrent || 0
        
        if (pain > 7 && rom > 120) {
          return {
            ruleId: 'HS03',
            triggered: true,
            severity: 'LOW',
            detail: `severe pain (${pain}/10) 但 ROM 正常 (${rom}°)`,
            reasoning: '剧烈疼痛通常会限制关节活动度',
            suggestion: '建议复核疼痛评估或 ROM 测量',
            confidence: 0.70
          }
        }
        return null
      }
    })

    // HS04: 序列合理性
    this.heuristics.push({
      id: 'HS04',
      name: '序列合理性',
      check: (note) => {
        const painHistory = note.painHistory || []
        if (painHistory.length >= 3) {
          const [p1, p2, p3] = painHistory.slice(-3)
          if (p1 > p2 && p3 > p2 + 1) {
            return {
              ruleId: 'HS04',
              triggered: true,
              severity: 'HIGH',
              detail: `pain 序列 ${p1}→${p2}→${p3} 出现大幅反弹`,
              reasoning: '治疗过程中 pain 不应大幅反弹',
              suggestion: '建议复核治疗效果或记录准确性',
              confidence: 0.85
            }
          }
        }
        return null
      }
    })

    // HS05: 舌脉-证型一致
    this.heuristics.push({
      id: 'HS05',
      name: '舌脉-证型一致',
      check: (note) => {
        const pattern = note.localPattern || ''
        const tongue = note.tongue || ''

        if (pattern.includes('Damp') && tongue.includes('dry')) {
          return {
            ruleId: 'HS05',
            triggered: true,
            severity: 'MEDIUM',
            detail: `湿证 (${pattern}) 但舌象为 dry`,
            reasoning: '湿证通常舌苔腻，不应干燥',
            suggestion: '建议复核证型诊断或舌象描述',
            confidence: 0.75
          }
        }
        return null
      }
    })

    // HS06: 气虚证-红舌黄苔矛盾
    this.heuristics.push({
      id: 'HS06',
      name: '气虚证-舌象矛盾',
      check: (note) => {
        const systemicPattern = note.systemicPattern || ''
        const tongue = note.tongue || ''

        if (systemicPattern.includes('Qi Deficiency') &&
            (tongue.includes('red') || tongue.includes('yellow'))) {
          return {
            ruleId: 'HS06',
            triggered: true,
            severity: 'MEDIUM',
            detail: `Qi Deficiency 证型但舌象为 ${tongue}`,
            reasoning: '气虚证典型舌象应为淡舌薄白苔，红舌黄苔多见于热证或实证',
            suggestion: '建议复核证型诊断或舌象描述',
            confidence: 0.78
          }
        }
        return null
      }
    })

    // HS07: 血瘀证-淡舌矛盾
    this.heuristics.push({
      id: 'HS07',
      name: '血瘀证-舌象矛盾',
      check: (note) => {
        const localPattern = note.localPattern || ''
        const systemicPattern = note.systemicPattern || ''
        const tongue = note.tongue || ''

        if ((localPattern.includes('Blood Stasis') || systemicPattern.includes('Blood Stasis')) &&
            (tongue.includes('pale') || tongue.includes('light'))) {
          return {
            ruleId: 'HS07',
            triggered: true,
            severity: 'MEDIUM',
            detail: `Blood Stasis 证型但舌象为 ${tongue}`,
            reasoning: '血瘀证典型舌象应为紫暗舌或舌有瘀点，淡舌多见于血虚证',
            suggestion: '建议复核证型诊断或舌象描述',
            confidence: 0.80
          }
        }
        return null
      }
    })

    // HS08: 寒湿证-数脉矛盾
    this.heuristics.push({
      id: 'HS08',
      name: '寒湿证-脉象矛盾',
      check: (note) => {
        const localPattern = note.localPattern || ''
        const pulse = note.pulse || ''

        if ((localPattern.includes('Cold-Damp') ||
             localPattern.includes('Wind-Cold')) &&
            pulse.includes('rapid')) {
          return {
            ruleId: 'HS08',
            triggered: true,
            severity: 'MEDIUM',
            detail: `寒湿/风寒证型但脉象为 rapid (数脉)`,
            reasoning: '寒湿证典型脉象应为迟脉或缓脉，数脉多见于热证',
            suggestion: '建议复核证型诊断或脉象描述',
            confidence: 0.82
          }
        }
        return null
      }
    })

    // HS09: 湿热证-迟脉矛盾
    this.heuristics.push({
      id: 'HS09',
      name: '湿热证-脉象矛盾',
      check: (note) => {
        const pattern = note.localPattern || note.systemicPattern || ''
        const pulse = note.pulse || ''

        if (pattern.includes('Damp-Heat') && pulse.includes('slow')) {
          return {
            ruleId: 'HS09',
            triggered: true,
            severity: 'MEDIUM',
            detail: `Damp-Heat 证型但脉象为 slow (迟脉)`,
            reasoning: '湿热证典型脉象应为滑数脉或濡数脉，迟脉多见于寒证',
            suggestion: '建议复核证型诊断或脉象描述',
            confidence: 0.79
          }
        }
        return null
      }
    })

    // HS10: ADL-疼痛不匹配
    this.heuristics.push({
      id: 'HS10',
      name: 'ADL-疼痛不匹配',
      check: (note) => {
        const adl = note.adlDifficulty
        const pain = note.painScaleCurrent

        // 显式检查undefined,避免使用||0导致的误触发
        if (adl === undefined || pain === undefined) return null

        if (adl >= 7 && pain < 3) {
          return {
            ruleId: 'HS10',
            triggered: true,
            severity: 'LOW',
            detail: `severe ADL difficulty (${adl}/10) 但 mild pain (${pain}/10)`,
            reasoning: '日常生活活动严重受限通常伴随中度以上疼痛',
            suggestion: '建议复核 ADL 评估或疼痛评分是否准确',
            confidence: 0.72
          }
        }
        return null
      }
    })
  }

  check(note: any): Layer2Result {
    const concerns: HeuristicResult[] = []

    for (const h of this.heuristics) {
      const result = h.check(note)
      if (result) {
        concerns.push(result)
      }
    }

    // 只有 HIGH 或 MEDIUM severity 才返回 WARNING
    const hasHighOrMediumConcern = concerns.some(c =>
      c.severity === 'HIGH' || c.severity === 'MEDIUM'
    )

    return {
      layer: 'medical_logic',
      result: hasHighOrMediumConcern ? 'WARNING' : 'PASS',
      concerns,
      // 基于 severity 判定，而非 confidence
      manualReviewRequired: hasHighOrMediumConcern
    }
  }
}
