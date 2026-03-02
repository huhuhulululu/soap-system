/**
 * 阶段 A 测试: Pain + Symptom% 颗粒度细化
 *
 * 验证:
 * 1. snapPainToGrid 0.5 步进 — 7 档输出
 * 2. snapSymptomToGrid 同逻辑 — 范围格式
 * 3. 20-visit 序列中 pain label 唯一值 ≥ 5
 * 4. 20-visit 序列中 symptomScale 唯一值 ≥ 4
 */
import { describe, it, expect } from 'vitest'
import {
  generateTXSequenceStates,
  // 需要导出这两个函数用于单元测试
  snapPainToGrid,
  snapSymptomToGrid,
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

// ==================== snapPainToGrid 单元测试 ====================
describe('阶段A: snapPainToGrid 0.5 步进', () => {
  it('整数值 → 整数标签', () => {
    expect(snapPainToGrid(8.0).label).toBe('8')
    expect(snapPainToGrid(7.0).label).toBe('7')
    expect(snapPainToGrid(6.0).label).toBe('6')
    expect(snapPainToGrid(5.0).label).toBe('5')
  })

  it('X.5 附近 → 范围标签 "X-(X-1)"', () => {
    expect(snapPainToGrid(7.5).label).toBe('8-7')
    expect(snapPainToGrid(7.4).label).toBe('8-7')
    expect(snapPainToGrid(7.6).label).toBe('8-7')
    expect(snapPainToGrid(6.5).label).toBe('7-6')
    expect(snapPainToGrid(5.5).label).toBe('6-5')
  })

  it('从 8 到 5 有 7 个不同标签', () => {
    const labels = new Set<string>()
    // 模拟 0.5 步进下降
    for (let p = 8.0; p >= 5.0; p -= 0.5) {
      labels.add(snapPainToGrid(p).label)
    }
    // 8, 8-7, 7, 7-6, 6, 6-5, 5 = 7 个
    expect(labels.size).toBe(7)
  })

  it('value 保持精确值用于纵向比较', () => {
    const snap75 = snapPainToGrid(7.5)
    const snap70 = snapPainToGrid(7.0)
    expect(snap75.value).toBeGreaterThan(snap70.value)
  })

  it('边界: 0 和 10', () => {
    expect(snapPainToGrid(0).label).toBe('0')
    expect(snapPainToGrid(10).label).toBe('10')
    expect(snapPainToGrid(10.5).label).toBe('10')
    expect(snapPainToGrid(-1).label).toBe('0')
  })
})

// ==================== snapSymptomToGrid 单元测试 ====================
describe('阶段A: snapSymptomToGrid', () => {
  it('整数十位 → 整数标签', () => {
    expect(snapSymptomToGrid(70)).toBe('70%')
    expect(snapSymptomToGrid(60)).toBe('60%')
    expect(snapSymptomToGrid(50)).toBe('50%')
    expect(snapSymptomToGrid(40)).toBe('40%')
  })

  it('中间值 → 范围标签', () => {
    expect(snapSymptomToGrid(65)).toBe('60%-70%')
    expect(snapSymptomToGrid(55)).toBe('50%-60%')
    expect(snapSymptomToGrid(45)).toBe('40%-50%')
    expect(snapSymptomToGrid(35)).toBe('30%-40%')
  })

  it('从 70 到 30 有 9 个不同标签', () => {
    const labels = new Set<string>()
    for (let p = 70; p >= 30; p -= 5) {
      labels.add(snapSymptomToGrid(p))
    }
    // 70%, 60%-70%, 60%, 50%-60%, 50%, 40%-50%, 40%, 30%-40%, 30% = 9 个
    expect(labels.size).toBe(9)
  })

  it('边界: 10% 和 100%', () => {
    expect(snapSymptomToGrid(10)).toBe('10%')
    expect(snapSymptomToGrid(100)).toBe('100%')
  })
})

// ==================== 20-visit 序列颗粒度验证 ====================
describe('阶段A: 20-visit 序列颗粒度', () => {
  it('Pain label 唯一值 ≥ 5 (之前 ≤ 4)', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 600001,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    const painLabels = new Set(result.states.map(s => {
      const snap = snapPainToGrid(s.painScaleCurrent)
      return snap.label
    }))
    expect(painLabels.size).toBeGreaterThanOrEqual(5)
  })

  it('Symptom% 唯一值 ≥ 4 (之前 ≤ 3)', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 600002,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    const symptomLabels = new Set(
      result.states.map(s => s.symptomScale).filter(Boolean)
    )
    expect(symptomLabels.size).toBeGreaterThanOrEqual(4)
  })

  it('连续完全相同的 visit ≤ 3 (阶段B后进一步降低)', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 600003,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    let maxConsecutiveSame = 0
    let consecutiveSame = 0
    for (let i = 1; i < result.states.length; i++) {
      const prev = result.states[i - 1]
      const curr = result.states[i]
      const painSame = snapPainToGrid(curr.painScaleCurrent).label === snapPainToGrid(prev.painScaleCurrent).label
      const symptomSame = curr.symptomScale === prev.symptomScale
      const tightSame = curr.tightnessGrading === prev.tightnessGrading
      const tenderSame = curr.tendernessGrading === prev.tendernessGrading
      const spasmSame = curr.spasmGrading === prev.spasmGrading

      if (painSame && symptomSame && tightSame && tenderSame && spasmSame) {
        consecutiveSame++
        maxConsecutiveSame = Math.max(maxConsecutiveSame, consecutiveSame)
      } else {
        consecutiveSame = 0
      }
    }
    // 阶段A: Pain+Symptom 细化后，连续相同应 ≤ 3（之前可达 4+）
    // 阶段B 放松 Tightness/Tenderness/Spasm 后会进一步降到 ≤ 2
    expect(maxConsecutiveSame).toBeLessThanOrEqual(3)
  })
})
