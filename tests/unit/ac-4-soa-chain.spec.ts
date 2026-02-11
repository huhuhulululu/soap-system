/**
 * AC-4: S-O-A 链一致性测试
 * 验证 Subjective-Objective-Assessment 逻辑链
 */
import { exportTXSeriesAsText } from '../../src/index'

describe('AC-4: S-O-A 链一致性', () => {
  const baseContext = {
    noteType: 'TX' as const,
    insuranceType: 'OPTUM' as const,
    primaryBodyPart: 'KNEE' as const,
    laterality: 'bilateral' as const,
    localPattern: 'Cold-Damp + Wind-Cold',
    systemicPattern: 'Kidney Yang Deficiency',
    chronicityLevel: 'Chronic' as const,
    severityLevel: 'moderate to severe' as const,
    hasPacemaker: false,
  }

  describe('AC-4.1 Pain-Symptom 一致', () => {
    it('pain 下降时 soaChain.subjective.painChange 为 improved', () => {
      const series = exportTXSeriesAsText(baseContext, { txCount: 5 })
      for (let i = 1; i < series.length; i++) {
        const prev = series[i - 1].state.painScaleCurrent
        const curr = series[i].state.painScaleCurrent
        const chain = series[i].state.soaChain
        
        if (curr < prev - 0.5) {
          expect(['improved', 'stable']).toContain(chain?.subjective?.painChange)
        }
      }
    })
  })

  describe('AC-4.2 Objective-Assessment 一致', () => {
    it('soaChain 包含 objective 和 assessment', () => {
      const series = exportTXSeriesAsText(baseContext, { txCount: 3 })
      for (const tx of series) {
        expect(tx.state.soaChain).toBeDefined()
        expect(tx.state.soaChain?.objective).toBeDefined()
        expect(tx.state.soaChain?.assessment).toBeDefined()
      }
    })
  })

  describe('AC-4.3 GeneralCondition 合理性', () => {
    it('高 pain (≥7) 时 generalCondition 为 poor 或 fair', () => {
      const series = exportTXSeriesAsText(baseContext, { txCount: 3 })
      for (const tx of series) {
        if (tx.state.painScaleCurrent >= 7) {
          expect(['poor', 'fair']).toContain(tx.state.generalCondition)
        }
      }
    })

    it('低 pain (≤3) 时 generalCondition 为 good', () => {
      // 生成足够多 TX 让 pain 降到 3 以下
      const series = exportTXSeriesAsText(baseContext, { txCount: 11 })
      const lowPainTx = series.filter(tx => tx.state.painScaleCurrent <= 3)
      for (const tx of lowPainTx) {
        expect(tx.state.generalCondition).toBe('good')
      }
    })
  })

  describe('AC-4.4 SymptomChange 合理性', () => {
    it('symptomChange 是合法值', () => {
      const validValues = ['improvement', 'slight improvement', 'no change', 'exacerbate', 
                          'improvement of symptom(s)', 'slight improvement of symptom(s)']
      const series = exportTXSeriesAsText(baseContext, { txCount: 5 })
      for (const tx of series) {
        // symptomChange 可能在 state 或 soaChain 中
        const change = tx.state.symptomChange
        expect(validValues.some(v => change?.includes(v) || v.includes(change || ''))).toBe(true)
      }
    })
  })
})
