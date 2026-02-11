/**
 * AC-8: AI 审核员测试
 * 三层架构集成测试
 */
import { AuditorAgent, RuleComplianceEngine, MedicalLogicChecker, CaseSimilarityAnalyzer } from '../../src/auditor'

describe('AC-8: AI 审核员', () => {
  describe('AC-8.1 Layer 1 规则引擎', () => {
    const engine = new RuleComplianceEngine()

    it('正常案例通过所有规则', () => {
      const note = {
        chronicityLevel: 'Chronic',
        severityLevel: 'moderate to severe',
        generalCondition: 'fair',
        painScaleCurrent: 7,
        hasPacemaker: false
      }
      const result = engine.check(note)
      expect(result.result).toBe('PASS')
      expect(result.violations.length).toBe(0)
    })

    it('非法 chronicityLevel 触发 CRITICAL', () => {
      const note = { chronicityLevel: 'Very Chronic' }
      const result = engine.check(note)
      expect(result.violations.some(v => v.ruleId === 'AC-2.1')).toBe(true)
    })

    it('Pacemaker + 电刺激触发 CRITICAL', () => {
      const note = { hasPacemaker: true, electricalStimulation: true }
      const result = engine.check(note)
      expect(result.violations.some(v => v.ruleId === 'AC-6.1')).toBe(true)
    })

    it('Pain 反弹触发 CRITICAL', () => {
      const note = { painScaleCurrent: 8 }
      const result = engine.check(note, { previousPain: 6 })
      expect(result.violations.some(v => v.ruleId === 'AC-3.1')).toBe(true)
    })

    it('输出格式正确', () => {
      const result = engine.check({})
      expect(result.layer).toBe('rule_compliance')
      expect(result.summary).toHaveProperty('total')
      expect(result.summary).toHaveProperty('passed')
      expect(result.summary).toHaveProperty('passRate')
    })
  })

  describe('AC-8.2 Layer 2 医学逻辑', () => {
    const checker = new MedicalLogicChecker()

    it('正常案例无疑点', () => {
      const note = {
        systemicPattern: 'Kidney Yang Deficiency',
        painScaleCurrent: 5
      }
      const result = checker.check(note)
      expect(result.concerns.length).toBe(0)
    })

    it('虚证 + 高 pain 触发 HS01', () => {
      const note = {
        systemicPattern: 'Qi Deficiency',
        painScaleCurrent: 8
      }
      const result = checker.check(note)
      expect(result.concerns.some(c => c.ruleId === 'HS01')).toBe(true)
    })

    it('输出包含置信度', () => {
      const note = {
        systemicPattern: 'Qi Deficiency',
        painScaleCurrent: 8
      }
      const result = checker.check(note)
      const concern = result.concerns.find(c => c.ruleId === 'HS01')
      expect(concern?.confidence).toBeGreaterThan(0)
      expect(concern?.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('AC-8.3 Layer 3 案例相似度', () => {
    const analyzer = new CaseSimilarityAnalyzer()

    it('KNEE IE 匹配黄金案例', () => {
      const note = {
        primaryBodyPart: 'KNEE',
        noteType: 'IE',
        painScaleCurrent: 8,
        localPattern: 'Cold-Damp'
      }
      const result = analyzer.check(note)
      expect(result.topMatches.length).toBeGreaterThan(0)
      expect(result.topMatches[0].caseId).toContain('KNEE')
    })

    it('输出包含质量评分', () => {
      const result = analyzer.check({})
      expect(result.qualityScore).toBeGreaterThanOrEqual(0)
      expect(result.qualityScore).toBeLessThanOrEqual(100)
    })
  })

  describe('AC-8.4 三层聚合', () => {
    const agent = new AuditorAgent()

    it('正常案例返回 PASS', () => {
      const note = {
        noteType: 'IE',
        primaryBodyPart: 'KNEE',
        chronicityLevel: 'Chronic',
        severityLevel: 'moderate to severe',
        generalCondition: 'fair',
        painScaleCurrent: 7,
        localPattern: 'Cold-Damp + Wind-Cold',
        systemicPattern: 'Kidney Yang Deficiency',
        hasPacemaker: false
      }
      const report = agent.audit(note)
      expect(report.overallResult).toBe('PASS')
      expect(report.qualityScore).toBeGreaterThanOrEqual(80)
    })

    it('CRITICAL 违规返回 FAIL', () => {
      const note = {
        chronicityLevel: 'Invalid',
        hasPacemaker: true,
        electricalStimulation: true
      }
      const report = agent.audit(note)
      expect(report.overallResult).toBe('FAIL')
    })

    it('报告包含三层结果', () => {
      const report = agent.audit({})
      expect(report.layer1).toBeDefined()
      expect(report.layer2).toBeDefined()
      expect(report.layer3).toBeDefined()
      expect(report.timestamp).toBeDefined()
    })

    it('formatReport 返回字符串', () => {
      const report = agent.audit({})
      const formatted = agent.formatReport(report)
      expect(typeof formatted).toBe('string')
      expect(formatted).toContain('SOAP 审核报告')
    })

    it('quickCheck 只返回 Layer 1', () => {
      const result = agent.quickCheck({})
      expect(result.layer).toBe('rule_compliance')
    })
  })
})
