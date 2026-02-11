/**
 * AI 审核员主接口
 * 三层审核架构聚合
 */
import { RuleComplianceEngine, Layer1Result } from './layer1'
import { MedicalLogicChecker, Layer2Result } from './layer2'
import { CaseSimilarityAnalyzer, Layer3Result } from './layer3'

export interface AuditReport {
  overallResult: 'PASS' | 'WARNING' | 'FAIL'
  qualityScore: number
  layer1: Layer1Result
  layer2: Layer2Result
  layer3: Layer3Result
  timestamp: string
}

export class AuditorAgent {
  private layer1: RuleComplianceEngine
  private layer2: MedicalLogicChecker
  private layer3: CaseSimilarityAnalyzer

  constructor() {
    this.layer1 = new RuleComplianceEngine()
    this.layer2 = new MedicalLogicChecker()
    this.layer3 = new CaseSimilarityAnalyzer()
  }

  audit(note: any, context?: any): AuditReport {
    const r1 = this.layer1.check(note, context)
    const r2 = this.layer2.check(note)
    const r3 = this.layer3.check(note)

    return {
      overallResult: this.aggregate(r1, r2, r3),
      qualityScore: this.calculateScore(r1, r2, r3),
      layer1: r1,
      layer2: r2,
      layer3: r3,
      timestamp: new Date().toISOString()
    }
  }

  quickCheck(note: any, context?: any): Layer1Result {
    return this.layer1.check(note, context)
  }

  private aggregate(r1: Layer1Result, r2: Layer2Result, r3: Layer3Result): 'PASS' | 'WARNING' | 'FAIL' {
    // CRITICAL 违规 → FAIL
    if (r1.violations.some(v => v.severity === 'CRITICAL')) {
      return 'FAIL'
    }

    // HIGH 违规 > 2 → FAIL
    if (r1.violations.filter(v => v.severity === 'HIGH').length > 2) {
      return 'FAIL'
    }

    // Layer 2 高置信度疑点 → WARNING
    if (r2.concerns.some(c => c.confidence > 0.8)) {
      return 'WARNING'
    }

    // Layer 3 与错误案例高度相似 → WARNING
    if (r3.topMatches.some(m => m.type === 'typical-error' && m.similarity > 0.7)) {
      return 'WARNING'
    }

    if (r1.result === 'FAIL' || r2.result === 'WARNING' || r3.result === 'WARNING') {
      return 'WARNING'
    }

    return 'PASS'
  }

  private calculateScore(r1: Layer1Result, r2: Layer2Result, r3: Layer3Result): number {
    let score = 100

    // Layer 1 扣分
    for (const v of r1.violations) {
      score -= { CRITICAL: 15, HIGH: 8, MEDIUM: 3, LOW: 1 }[v.severity]
    }

    // Layer 2 扣分
    for (const c of r2.concerns) {
      score -= c.confidence * 5
    }

    // Layer 3 调整
    const bestMatch = r3.topMatches.find(m => m.type === 'excellent')
    if (bestMatch && bestMatch.similarity > 0.8) {
      score += 5
    }

    return Math.max(0, Math.min(100, Math.round(score)))
  }

  // CLI 格式化输出
  formatReport(report: AuditReport): string {
    const lines: string[] = []
    
    lines.push('📊 SOAP 审核报告')
    lines.push('━'.repeat(50))
    lines.push(`综合结果: ${this.resultEmoji(report.overallResult)} ${report.overallResult}`)
    lines.push(`综合评分: ${report.qualityScore}/100`)
    lines.push('')
    
    // Layer 1
    lines.push(`第一层: 规则合规  ${report.layer1.result === 'PASS' ? '✅' : '❌'} ${report.layer1.summary.passRate}`)
    for (const v of report.layer1.violations) {
      lines.push(`  ❌ [${v.severity}] ${v.ruleId} ${v.violation?.issue}`)
    }
    
    // Layer 2
    lines.push('')
    lines.push(`第二层: 医学逻辑  ${report.layer2.result === 'PASS' ? '✅' : '⚠️'} ${report.layer2.concerns.length} 个疑点`)
    for (const c of report.layer2.concerns) {
      lines.push(`  ⚠️ [${c.ruleId}] ${c.detail} (置信度: ${(c.confidence * 100).toFixed(0)}%)`)
    }
    
    // Layer 3
    lines.push('')
    lines.push(`第三层: 案例相似  📊 评分: ${report.layer3.qualityScore}`)
    for (const m of report.layer3.topMatches.slice(0, 2)) {
      const icon = m.type === 'excellent' ? '🏆' : m.type === 'typical-error' ? '⚠️' : '📋'
      lines.push(`  ${icon} ${m.caseId} (${(m.similarity * 100).toFixed(0)}%)`)
    }
    
    lines.push('━'.repeat(50))
    
    return lines.join('\n')
  }

  private resultEmoji(result: string): string {
    return { PASS: '✅', WARNING: '⚠️', FAIL: '❌' }[result] || '❓'
  }
}

export { RuleComplianceEngine, MedicalLogicChecker, CaseSimilarityAnalyzer }
export type { Layer1Result, Layer2Result, Layer3Result }
