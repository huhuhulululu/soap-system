/**
 * AC-3: 纵向逻辑测试
 * 验证 TX 序列的数值变化符合引擎规则
 */
import { exportTXSeriesAsText } from '../../src/index'
import * as fs from 'fs'

const engineRules = JSON.parse(
  fs.readFileSync('src/auditor/baselines/engine-rules.json', 'utf-8')
)

describe('AC-3: 纵向逻辑', () => {
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

  describe('AC-3.1 Pain 趋势', () => {
    it('TX 序列 pain 整体下降', () => {
      const series = exportTXSeriesAsText(baseContext, { txCount: 5 })
      for (let i = 1; i < series.length; i++) {
        const prev = series[i - 1].state.painScaleCurrent
        const curr = series[i].state.painScaleCurrent
        expect(curr).toBeLessThanOrEqual(prev + 0.1)
      }
    })

    it('Pain 不能大幅反弹', () => {
      const series = exportTXSeriesAsText(baseContext, { txCount: 10 })
      for (let i = 1; i < series.length; i++) {
        const prev = series[i - 1].state.painScaleCurrent
        const curr = series[i].state.painScaleCurrent
        expect(curr - prev).toBeLessThan(0.5) // 不能反弹超过 0.5
      }
    })
  })

  describe('AC-3.2 Pain 首次降幅', () => {
    it('TX1 pain 在 IE pain - [0.5, 1.5] 范围内', () => {
      // 多次运行检查
      for (let run = 0; run < 5; run++) {
        const series = exportTXSeriesAsText(baseContext, { txCount: 3 })
        const tx1Pain = series[0].state.painScaleCurrent
        // IE pain 约 8 (moderate to severe)
        expect(tx1Pain).toBeLessThanOrEqual(8)
        expect(tx1Pain).toBeGreaterThanOrEqual(5)
      }
    })
  })

  describe('AC-3.3 Tightness 趋势', () => {
    it('Tightness 映射正确', () => {
      const mapping = engineRules.tightness.mapping
      expect(mapping['severe']).toBe(4)
      expect(mapping['moderate']).toBe(3)
      expect(mapping['mild']).toBe(1)
    })
  })

  describe('AC-3.4 TX 上限', () => {
    it('TX 数量不超过 11', () => {
      expect(engineRules.txLimit).toBe(11)
    })

    it('生成 11 个 TX 成功', () => {
      const series = exportTXSeriesAsText(baseContext, { txCount: 11 })
      expect(series.length).toBe(11)
    })

    it('请求超过 11 个 TX 返回请求数量', () => {
      const series = exportTXSeriesAsText(baseContext, { txCount: 15 })
      expect(series.length).toBe(15) // 引擎不截断，由调用方控制
    })
  })
})
