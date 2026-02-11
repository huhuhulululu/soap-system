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
  }

  check(note: any): Layer2Result {
    const concerns: HeuristicResult[] = []
    
    for (const h of this.heuristics) {
      const result = h.check(note)
      if (result) {
        concerns.push(result)
      }
    }

    return {
      layer: 'medical_logic',
      result: concerns.length > 0 ? 'WARNING' : 'PASS',
      concerns,
      manualReviewRequired: concerns.some(c => c.confidence > 0.8)
    }
  }
}
