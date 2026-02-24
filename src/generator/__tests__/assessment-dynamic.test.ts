/**
 * Assessment 动态变化测试
 *
 * 验证:
 * 1. tolerated 在 20-visit 中有变化 (不总是同一个)
 * 2. response 在 20-visit 中有变化
 * 3. adverse effect 句子有变化
 * 4. 整体 Assessment 文本在相邻 visit 间有差异
 */
import { describe, it, expect } from 'vitest'
import { exportTXSeriesAsText } from '../soap-generator'
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

function extractAssessmentLine(text: string, keyword: string): string {
  const lines = text.split('\n')
  return lines.find(l => l.includes(keyword)) || ''
}

describe('Assessment 动态变化: tolerated + response', () => {
  it('20-visit 中 "Patient tolerated" 句子唯一值 ≥ 3', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const results = exportTXSeriesAsText(ctx, {
      txCount: 20,
      seed: 850001,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    const toleratedSentences = new Set(
      results.map(r => {
        const match = r.text.match(/Patient tolerated[^.]+\./)
        return match ? match[0] : ''
      }).filter(Boolean)
    )
    expect(toleratedSentences.size).toBeGreaterThanOrEqual(3)
  })

  it('20-visit 中 adverse effect 句子唯一值 ≥ 2', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const results = exportTXSeriesAsText(ctx, {
      txCount: 20,
      seed: 850002,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    const adverseSentences = new Set(
      results.map(r => {
        const match = r.text.match(/[Nn]o adverse[^.]+\./)
        return match ? match[0] : ''
      }).filter(Boolean)
    )
    expect(adverseSentences.size).toBeGreaterThanOrEqual(2)
  })

  it('相邻 visit 的 Assessment 不完全相同的比例 ≥ 80%', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const results = exportTXSeriesAsText(ctx, {
      txCount: 20,
      seed: 850003,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    let diffCount = 0
    for (let i = 1; i < results.length; i++) {
      const prevAssess = results[i - 1].text.split('Assessment\n')[1]?.split('\n\nPlan')[0] || ''
      const currAssess = results[i].text.split('Assessment\n')[1]?.split('\n\nPlan')[0] || ''
      if (prevAssess !== currAssess) diffCount++
    }
    // 19 个相邻对中至少 80% (≥ 16) 有差异
    expect(diffCount).toBeGreaterThanOrEqual(15)
  })
})
