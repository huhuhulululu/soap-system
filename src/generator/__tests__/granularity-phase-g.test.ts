/**
 * Phase G: ROM/Strength visit-level variation
 *
 * 验证:
 * 1. 20-visit 中每对相邻 visit 至少有一个核心临床维度变化
 *    核心维度: Pain, Sym%, Tight, Tender, Spasm, Freq, ROM/ST
 * 2. ROM/Strength 在 20-visit 中唯一值 ≥ 5
 */
import { describe, it, expect } from 'vitest'
import { exportTXSeriesAsText } from '../soap-generator'
import { snapPainToGrid } from '../tx-sequence-engine'
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

/** 从文本中提取 ROM 行的 strength + degrees */
function extractRomStrength(text: string): string {
  const lines = text.split('\n')
  const romLines = lines.filter(l => l.match(/^\d[+-]?\/5\s/))
  return romLines.map(l => l.trim().substring(0, 50)).join(' | ')
}

describe('Phase G: ROM/Strength visit-level variation', () => {
  it('20-visit 中相邻 visit 核心维度完全相同的数量 = 0', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const results = exportTXSeriesAsText(ctx, {
      txCount: 20,
      seed: 42,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    let sameCount = 0
    for (let i = 1; i < results.length; i++) {
      const s = results[i].state
      const p = results[i - 1].state
      const changes: string[] = []

      // Pain
      if (snapPainToGrid(s.painScaleCurrent).label !== snapPainToGrid(p.painScaleCurrent).label) {
        changes.push('Pain')
      }
      // Sym%
      if (s.symptomScale !== p.symptomScale) changes.push('Sym%')
      // Tightness
      if (s.tightnessGrading !== p.tightnessGrading) changes.push('Tight')
      // Tenderness
      if (s.tendernessGrading !== p.tendernessGrading) changes.push('Tender')
      // Spasm
      if (s.spasmGrading !== p.spasmGrading) changes.push('Spasm')
      // Frequency
      if (s.painFrequency !== p.painFrequency) changes.push('Freq')
      // ROM/Strength (text-level comparison)
      const currRom = extractRomStrength(results[i].text)
      const prevRom = extractRomStrength(results[i - 1].text)
      if (currRom !== prevRom) changes.push('ROM/ST')

      if (changes.length === 0) sameCount++
    }

    expect(sameCount).toBe(0)
  })

  it('20-visit 中 ROM/Strength 文本唯一值 ≥ 5', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const results = exportTXSeriesAsText(ctx, {
      txCount: 20,
      seed: 42,
      initialState: { pain: 8, associatedSymptom: 'soreness' },
    })

    const romTexts = new Set(results.map(r => extractRomStrength(r.text)))
    expect(romTexts.size).toBeGreaterThanOrEqual(5)
  })

  it('不同 seed 也满足 0 SAME visits', () => {
    for (const seed of [100, 200, 300, 999]) {
      const ctx = makeContext({ painCurrent: 8 })
      const results = exportTXSeriesAsText(ctx, {
        txCount: 20,
        seed,
        initialState: { pain: 8, associatedSymptom: 'soreness' },
      })

      let sameCount = 0
      for (let i = 1; i < results.length; i++) {
        const s = results[i].state
        const p = results[i - 1].state
        const changes: string[] = []

        if (snapPainToGrid(s.painScaleCurrent).label !== snapPainToGrid(p.painScaleCurrent).label) changes.push('Pain')
        if (s.symptomScale !== p.symptomScale) changes.push('Sym%')
        if (s.tightnessGrading !== p.tightnessGrading) changes.push('Tight')
        if (s.tendernessGrading !== p.tendernessGrading) changes.push('Tender')
        if (s.spasmGrading !== p.spasmGrading) changes.push('Spasm')
        if (s.painFrequency !== p.painFrequency) changes.push('Freq')
        const currRom = extractRomStrength(results[i].text)
        const prevRom = extractRomStrength(results[i - 1].text)
        if (currRom !== prevRom) changes.push('ROM/ST')

        if (changes.length === 0) sameCount++
      }

      expect(sameCount).toBe(0)
    }
  })
})
