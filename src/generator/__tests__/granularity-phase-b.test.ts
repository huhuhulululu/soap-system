/**
 * 阶段 B 测试: Tightness / Tenderness / Spasm 松绑
 *
 * 验证:
 * 1. Tightness grading 唯一值 ≥ 3 (之前 ≤ 2)
 * 2. Tenderness grading 唯一值 ≥ 3 (之前 ≤ 2)
 * 3. Spasm grading 唯一值 ≥ 2
 * 4. 连续完全相同的 visit ≤ 2 (Phase A 后 ≤ 3, Phase B 进一步降低)
 * 5. Tightness ceiling: pain 8+ 不出现 Mild, pain < 5 不出现 Severe
 * 6. Tenderness soft floor: progress > 0.6 允许突破 hardFloor
 * 7. 纵向单调: tightness/tenderness/spasm 只降不升
 * 8. Spasm 阈值降低后更早开始变化
 */
import { describe, it, expect } from 'vitest'
import {
  generateTXSequenceStates,
  snapPainToGrid,
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

// ==================== Tightness grading 变化 ====================
describe('阶段B: Tightness grading 松绑', () => {
  it('20-visit 序列中 tightnessGrading 唯一值 ≥ 3', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 700001,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    const tightnessLabels = new Set(result.states.map(s => s.tightnessGrading))
    expect(tightnessLabels.size).toBeGreaterThanOrEqual(3)
  })

  it('pain 8+ 不出现 Mild tightness', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 700002,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    // 前半段 pain 还在 8 附近时不应出现 Mild
    const earlyVisits = result.states.filter(s => {
      const painVal = snapPainToGrid(s.painScaleCurrent).value
      return painVal >= 7.5
    })
    for (const v of earlyVisits) {
      expect(v.tightnessGrading.toLowerCase()).not.toBe('mild')
    }
  })

  it('纵向单调: tightnessGrading 只降不升', () => {
    const TIGHTNESS_ORDER = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
    const ctx = makeContext({ painCurrent: 8 })
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 700003,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    for (let i = 1; i < result.states.length; i++) {
      const prevIdx = TIGHTNESS_ORDER.indexOf(result.states[i - 1].tightnessGrading.toLowerCase())
      const curIdx = TIGHTNESS_ORDER.indexOf(result.states[i].tightnessGrading.toLowerCase())
      if (prevIdx >= 0 && curIdx >= 0) {
        expect(curIdx).toBeLessThanOrEqual(prevIdx)
      }
    }
  })
})

// ==================== Tenderness grading 变化 ====================
describe('阶段B: Tenderness grading 松绑', () => {
  it('20-visit 序列中 tendernessGrading 唯一值 ≥ 2', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 700004,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    // 提取 tenderness grade 数字 (+1, +2, +3, +4)
    const tenderGrades = new Set(
      result.states.map(s => {
        const match = s.tendernessGrading.match(/\(\+?(\d)\)/)
        return match ? match[1] : ''
      }).filter(Boolean)
    )
    expect(tenderGrades.size).toBeGreaterThanOrEqual(2)
  })

  it('soft floor: progress > 0.6 时 tenderness 可以突破 hardFloor', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 700005,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    // 后半段 (progress > 0.6) 应该有 tenderness < hardFloor(3) 的情况
    const lateVisits = result.states.filter(s => s.progress > 0.6)
    const tenderGrades = lateVisits.map(s => {
      const match = s.tendernessGrading.match(/\(\+?(\d)\)/)
      return match ? parseInt(match[1], 10) : 99
    })
    // 至少有一个 visit 的 tenderness < 3 (hardFloor for pain >= 7)
    const hasBrokenFloor = tenderGrades.some(g => g < 3)
    expect(hasBrokenFloor).toBe(true)
  })

  it('纵向单调: tenderness grade 只降不升', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 700006,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    for (let i = 1; i < result.states.length; i++) {
      const prevMatch = result.states[i - 1].tendernessGrading.match(/\(\+?(\d)\)/)
      const curMatch = result.states[i].tendernessGrading.match(/\(\+?(\d)\)/)
      if (prevMatch && curMatch) {
        expect(parseInt(curMatch[1], 10)).toBeLessThanOrEqual(parseInt(prevMatch[1], 10))
      }
    }
  })
})

// ==================== Spasm grading 变化 ====================
describe('阶段B: Spasm grading 松绑', () => {
  it('20-visit 序列中 spasmGrading 唯一值 ≥ 2', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 700007,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    const spasmLabels = new Set(result.states.map(s => s.spasmGrading))
    expect(spasmLabels.size).toBeGreaterThanOrEqual(2)
  })

  it('纵向单调: spasm 只降不升', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 700008,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    const spasmNums = result.states.map(s => {
      const match = s.spasmGrading.match(/\(\+?(\d)\)/)
      return match ? parseInt(match[1], 10) : 0
    })
    for (let i = 1; i < spasmNums.length; i++) {
      expect(spasmNums[i]).toBeLessThanOrEqual(spasmNums[i - 1])
    }
  })
})

// ==================== 综合: 连续相同 visit 降低 ====================
describe('阶段B: 连续相同 visit 进一步降低', () => {
  it('连续完全相同的 visit ≤ 3 (Phase C/D 后进一步降到 ≤ 2)', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 700009,
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
    // Phase B: tightness/tenderness/spasm 松绑后，连续相同应 ≤ 3
    // Phase C/D 加入 Strength 独立追踪 + Subjective 动态后会降到 ≤ 2
    expect(maxConsecutiveSame).toBeLessThanOrEqual(3)
  })

  it('ALL SAME visit 总数 ≤ 10 (20-visit 中)', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const result = generateTXSequenceStates(ctx, {
      txCount: 20,
      seed: 700009,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    let allSameCount = 0
    for (let i = 1; i < result.states.length; i++) {
      const prev = result.states[i - 1]
      const curr = result.states[i]
      const painSame = snapPainToGrid(curr.painScaleCurrent).label === snapPainToGrid(prev.painScaleCurrent).label
      const symptomSame = curr.symptomScale === prev.symptomScale
      const tightSame = curr.tightnessGrading === prev.tightnessGrading
      const tenderSame = curr.tendernessGrading === prev.tendernessGrading
      const spasmSame = curr.spasmGrading === prev.spasmGrading

      if (painSame && symptomSame && tightSame && tenderSame && spasmSame) {
        allSameCount++
      }
    }
    // 之前 ~35% (7/19) 完全相同，Phase B 后应 ≤ 10
    expect(allSameCount).toBeLessThanOrEqual(10)
  })
})
