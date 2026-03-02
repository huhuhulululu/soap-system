import { describe, it, expect, beforeAll } from 'vitest'
import { exportTXSeriesAsText } from './src/generator/soap-generator'
import { setWhitelist } from './src/parser/template-rule-whitelist'
import whitelistData from './frontend/src/data/whitelist.json'
import type { GenerationContext } from './src/types'

beforeAll(() => { setWhitelist(whitelistData as Record<string, string[]>) })

describe('GATE-01', () => {
  it('annotates visit 12 for ELDERPLAN with NCD 30.3.3', () => {
    const ctx = {
      noteType: 'TX', insuranceType: 'ELDERPLAN', primaryBodyPart: 'KNEE',
      laterality: 'bilateral', localPattern: 'Cold-Damp + Wind-Cold',
      systemicPattern: 'Kidney Yang Deficiency', chronicityLevel: 'Chronic',
      severityLevel: 'moderate to severe', painCurrent: 8, hasPacemaker: false,
    } as GenerationContext
    const results = exportTXSeriesAsText(ctx, { txCount: 13, seed: 400001, initialState: { pain: 8, tightness: 3, tenderness: 3, spasm: 3, frequency: 3, associatedSymptom: 'soreness', painTypes: ['Dull','Aching'] } })
    const v12 = results.find(r => r.visitIndex === 12)
    expect(v12).toBeDefined()
    expect(v12!.text).toContain('NCD 30.3.3')
    expect(v12!.text).toContain('Baseline Pain')
    expect(v12!.text).toContain('Cumulative Improvement')
  })

  it('does NOT annotate non-ELDERPLAN patients', () => {
    const ctx = {
      noteType: 'TX', insuranceType: 'OPTUM', primaryBodyPart: 'KNEE',
      laterality: 'bilateral', localPattern: 'Cold-Damp + Wind-Cold',
      systemicPattern: 'Kidney Yang Deficiency', chronicityLevel: 'Chronic',
      severityLevel: 'moderate to severe', painCurrent: 8, hasPacemaker: false,
    } as GenerationContext
    const results = exportTXSeriesAsText(ctx, { txCount: 13, seed: 400002, initialState: { pain: 8, tightness: 3, tenderness: 3, spasm: 3, frequency: 3, associatedSymptom: 'soreness', painTypes: ['Dull','Aching'] } })
    const v12 = results.find(r => r.visitIndex === 12)
    expect(v12).toBeDefined()
    expect(v12!.text).not.toContain('NCD 30.3.3')
  })
})
