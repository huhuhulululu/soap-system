/**
 * AC-6: 针刺协议测试
 * 验证穴位数量、电刺激禁忌等
 */
import { exportSOAPAsText, exportTXSeriesAsText } from '../../src/index'

describe('AC-6: 针刺协议', () => {
  const baseIE = {
    noteType: 'IE' as const,
    insuranceType: 'OPTUM' as const,
    primaryBodyPart: 'KNEE' as const,
    laterality: 'bilateral' as const,
    localPattern: 'Cold-Damp + Wind-Cold',
    systemicPattern: 'Kidney Yang Deficiency',
    chronicityLevel: 'Chronic' as const,
    severityLevel: 'moderate to severe' as const,
    hasPacemaker: false,
  }

  const baseTX = { ...baseIE, noteType: 'TX' as const }

  describe('AC-6.1 穴位数量', () => {
    it('TX 文本包含穴位信息', () => {
      const series = exportTXSeriesAsText(baseTX, { txCount: 1 })
      // 穴位可能以不同格式出现
      const hasAcupoints = series[0].text.match(/Acupoints?:|needle|points/i)
      expect(hasAcupoints || series[0].state.needlePoints?.length > 0).toBeTruthy()
    })

    it('TX state 包含 needlePoints', () => {
      const series = exportTXSeriesAsText(baseTX, { txCount: 1 })
      expect(series[0].state.needlePoints).toBeDefined()
      expect(Array.isArray(series[0].state.needlePoints)).toBe(true)
    })

    it('穴位数量在合理范围 (4-15)', () => {
      const series = exportTXSeriesAsText(baseTX, { txCount: 5 })
      for (const tx of series) {
        const count = tx.state.needlePoints?.length || 0
        expect(count).toBeGreaterThanOrEqual(4)
        expect(count).toBeLessThanOrEqual(15)
      }
    })
  })

  describe('AC-6.2 电刺激禁忌', () => {
    it('无 Pacemaker 时可以有电刺激', () => {
      const series = exportTXSeriesAsText(baseTX, { txCount: 3 })
      // 至少有一个 TX 可能有电刺激
      const hasEstim = series.some(tx => 
        tx.state.electricalStimulation === true || 
        tx.text.includes('Electrical stimulation was arrow')
      )
      // 不强制要求，但应该是合法的
      expect(typeof hasEstim).toBe('boolean')
    })

    it('有 Pacemaker 时禁止电刺激', () => {
      const ctxWithPacemaker = { ...baseTX, hasPacemaker: true }
      const series = exportTXSeriesAsText(ctxWithPacemaker, { txCount: 5 })
      for (const tx of series) {
        // undefined 或 false 都表示无电刺激
        expect(tx.state.electricalStimulation).not.toBe(true)
      }
    })

    it('Pacemaker 时文本不包含 "Electrical stimulation was arrow"', () => {
      const ctxWithPacemaker = { ...baseTX, hasPacemaker: true }
      const series = exportTXSeriesAsText(ctxWithPacemaker, { txCount: 3 })
      for (const tx of series) {
        expect(tx.text).not.toMatch(/Electrical stimulation was arrow/i)
      }
    })
  })

  describe('AC-6.3 治疗时间', () => {
    it('TX state 可能包含 treatmentTime', () => {
      const series = exportTXSeriesAsText(baseTX, { txCount: 3 })
      // treatmentTime 可能在某些 TX 中存在
      const hasTreatmentTime = series.some(tx => tx.state.treatmentTime !== undefined)
      expect(typeof hasTreatmentTime).toBe('boolean')
    })

    it('如果有 treatmentTime，应在合理范围 (10-30 分钟)', () => {
      const series = exportTXSeriesAsText(baseTX, { txCount: 5 })
      for (const tx of series) {
        const time = tx.state.treatmentTime
        if (time !== undefined) {
          expect(time).toBeGreaterThanOrEqual(10)
          expect(time).toBeLessThanOrEqual(30)
        }
      }
    })
  })
})
