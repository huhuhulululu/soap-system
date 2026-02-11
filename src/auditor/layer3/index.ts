/**
 * Layer 3: 案例相似度分析
 * 与黄金案例对比
 */

export interface CaseMatch {
  caseId: string
  similarity: number
  type: 'excellent' | 'typical-error' | 'edge-case'
  strengths?: string[]
  differences?: string[]
  warning?: string
}

export interface Layer3Result {
  layer: 'case_similarity'
  result: 'PASS' | 'WARNING'
  qualityScore: number
  topMatches: CaseMatch[]
  recommendations: string[]
}

// 简化的黄金案例库
const goldenCases: Array<{
  id: string
  type: 'excellent' | 'typical-error' | 'edge-case'
  bodyPart: string
  noteType: string
  painLevel: number
  pattern: string
  strengths?: string[]
}> = [
  {
    id: 'GOLDEN_KNEE_IE_001',
    type: 'excellent',
    bodyPart: 'KNEE',
    noteType: 'IE',
    painLevel: 8,
    pattern: 'Cold-Damp',
    strengths: ['证型诊断准确', 'S-O-A 逻辑连贯']
  },
  {
    id: 'GOLDEN_LBP_TX_001',
    type: 'excellent',
    bodyPart: 'LBP',
    noteType: 'TX',
    painLevel: 6,
    pattern: 'Qi Stagnation',
    strengths: ['穴位配伍合理', '治疗原则明确']
  },
  {
    id: 'ERROR_PAIN_REBOUND_001',
    type: 'typical-error',
    bodyPart: 'KNEE',
    noteType: 'TX',
    painLevel: 7,
    pattern: 'Blood Stasis'
  }
]

export class CaseSimilarityAnalyzer {
  check(note: any): Layer3Result {
    const matches: CaseMatch[] = []
    
    for (const c of goldenCases) {
      const similarity = this.calculateSimilarity(note, c)
      if (similarity > 0.5) {
        matches.push({
          caseId: c.id,
          similarity,
          type: c.type,
          strengths: c.strengths,
          warning: c.type === 'typical-error' ? '与典型错误案例相似' : undefined
        })
      }
    }

    // 按相似度排序
    matches.sort((a, b) => b.similarity - a.similarity)
    const topMatches = matches.slice(0, 3)

    // 计算质量评分
    const qualityScore = this.calculateQualityScore(topMatches)

    // 生成建议
    const recommendations: string[] = []
    const bestExcellent = topMatches.find(m => m.type === 'excellent')
    if (bestExcellent) {
      recommendations.push(`参考案例 ${bestExcellent.caseId} 的最佳实践`)
    }

    const hasErrorMatch = topMatches.some(m => m.type === 'typical-error' && m.similarity > 0.7)

    return {
      layer: 'case_similarity',
      result: hasErrorMatch ? 'WARNING' : 'PASS',
      qualityScore,
      topMatches,
      recommendations
    }
  }

  private calculateSimilarity(note: any, goldenCase: any): number {
    let score = 0
    const weights = {
      bodyPart: 0.25,
      noteType: 0.15,
      painLevel: 0.20,
      pattern: 0.40
    }

    if (note.primaryBodyPart === goldenCase.bodyPart) {
      score += weights.bodyPart
    }

    if (note.noteType === goldenCase.noteType) {
      score += weights.noteType
    }

    const painDiff = Math.abs((note.painScaleCurrent || 8) - goldenCase.painLevel)
    score += (1 - painDiff / 10) * weights.painLevel

    const notePattern = (note.localPattern || '') + (note.systemicPattern || '')
    if (notePattern.includes(goldenCase.pattern)) {
      score += weights.pattern
    }

    return Math.round(score * 100) / 100
  }

  private calculateQualityScore(matches: CaseMatch[]): number {
    if (matches.length === 0) return 70

    let score = 70
    
    for (const m of matches) {
      if (m.type === 'excellent' && m.similarity > 0.7) {
        score += 15 * m.similarity
      } else if (m.type === 'typical-error' && m.similarity > 0.7) {
        score -= 10 * m.similarity
      }
    }

    return Math.max(0, Math.min(100, Math.round(score)))
  }
}
