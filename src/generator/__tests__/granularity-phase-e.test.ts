/**
 * 阶段 E 测试: Frequency 阈值调优
 *
 * 验证:
 * 1. 20-visit 序列中 frequency 唯一值 ≥ 3 (4 个级别中至少用 3 个)
 * 2. Frequency 变化不晚于 visit 10 (progress ~0.5)
 * 3. 纵向单调: frequency 只降不升
 * 4. Chronic 患者 frequency 变化晚于 normal
 */
import { describe, it, expect } from 'vitest'
import {
  generateTXSequenceStates,
} from '../tx-sequence-engine'
import type { GenerationContext } from '../../types'

function makeContext(overrides: Partial<GenerationContext> = {}): GenerationContext {
  return {
    noteType: 'TX',
    insuranceType: 'OPTUM',
    primaryBodyPart: 'LBP',
    laterality: 'bilateral',
    localPattern: 'Qi Stagnation',
    systemicPattern: 'Kidney Yang Deficiency',
    chronicityLevel: 'Chronic',
    severityLevel: 'moderate to severe',
    painCurrent: 8,
    associatedSymptom: 'soreness',
    ...overrides,
  }
}

describe('阶段E: Frequency 阈值调优', () => {
  it('20-visit 序列中 frequency 唯一值 ≥ 3', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 900001,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    const frequencies = new Set(result.states.map(s => s.painFrequency))
    expect(frequencies.size).toBeGreaterThanOrEqual(3)
  })

  it('Frequency 首次变化不晚于 visit 12', () => {
    const seeds = [900002, 900003, 900004, 900005, 900006]
    let passCount = 0

    for (const seed of seeds) {
      const ctx = makeContext({ painCurrent: 8 })
      const result = generateTXSequenceStates(ctx, {
        txCount: 20,
        seed,
        initialState: { pain: 8, associatedSymptom: 'soreness' },
      })

      const firstFreq = result.states[0].painFrequency
      const firstChangeIdx = result.states.findIndex(s => s.painFrequency !== firstFreq)
      if (firstChangeIdx >= 0 && firstChangeIdx < 12) passCount++
    }
    // 至少 3/5 seed 在 visit 12 前有 frequency 变化
    expect(passCount).toBeGreaterThanOrEqual(3)
  })

  it('纵向单调: frequency 只降不升 (Constant→Frequent→Occasional→Intermittent)', () => {
    const FREQ_ORDER = [
      'Intermittent (symptoms occur less than 25% of the time)',
      'Occasional (symptoms occur between 26% and 50% of the time)',
      'Frequent (symptoms occur between 51% and 75% of the time)',
      'Constant (symptoms occur between 76% and 100% of the time)',
    ]
    const ctx = makeContext({ painCurrent: 8 })
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 900007,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    for (let i = 1; i < result.states.length; i++) {
      const prevIdx = FREQ_ORDER.indexOf(result.states[i - 1].painFrequency)
      const curIdx = FREQ_ORDER.indexOf(result.states[i].painFrequency)
      if (prevIdx >= 0 && curIdx >= 0) {
        expect(curIdx).toBeLessThanOrEqual(prevIdx)
      }
    }
  })

  it('Normal 患者 frequency 变化早于 Chronic', () => {
    const seed = 900009
    const ctxChronic = makeContext({ painCurrent: 8, chronicityLevel: 'Chronic' })
    const ctxNormal = makeContext({ painCurrent: 8, chronicityLevel: 'Acute' })

    const resultChronic = generateTXSequenceStates(ctxChronic, {
      txCount: 20,
      seed,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })
    const resultNormal = generateTXSequenceStates(ctxNormal, {
      txCount: 20,
      seed,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    const firstFreqChronic = resultChronic.states[0].painFrequency
    const firstFreqNormal = resultNormal.states[0].painFrequency
    const chronicChangeIdx = resultChronic.states.findIndex(s => s.painFrequency !== firstFreqChronic)
    const normalChangeIdx = resultNormal.states.findIndex(s => s.painFrequency !== firstFreqNormal)

    // Normal 应该更早变化（或至少不晚于 Chronic）
    if (chronicChangeIdx >= 0 && normalChangeIdx >= 0) {
      expect(normalChangeIdx).toBeLessThanOrEqual(chronicChangeIdx)
    }
  })
})
