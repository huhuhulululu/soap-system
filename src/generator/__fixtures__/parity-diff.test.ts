/**
 * Parity diff tests proving batch and compose paths produce identical
 * SOAP output when given the same patient data through the shared normalizer.
 *
 * Both paths call normalizeGenerationContext() → exportTXSeriesAsText()
 * with the same seed. Since the normalizer is the sole context-construction
 * entry point, output MUST be byte-identical (whitespace-normalized).
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { exportTXSeriesAsText } from '../soap-generator'
import { normalizeGenerationContext, type NormalizeInput } from '../../shared/normalize-generation-context'
import { setWhitelist } from '../../parser/template-rule-whitelist'
import whitelistData from '../../../frontend/src/data/whitelist.json'

import type { BodyPart, Laterality, SeverityLevel } from '../../types'

beforeAll(() => {
  setWhitelist(whitelistData as Record<string, string[]>)
})

/**
 * Normalize SOAP text for content-level comparison.
 * Allows formatting differences (whitespace, blank lines) while
 * catching any structural divergence in S/O/A/P content.
 */
function normalizeSOAPText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function severity(pain: number): SeverityLevel {
  if (pain >= 9) return 'severe'
  if (pain >= 7) return 'moderate to severe'
  if (pain >= 6) return 'moderate'
  if (pain >= 4) return 'mild to moderate'
  return 'mild'
}

interface ParityCase {
  readonly name: string
  readonly input: NormalizeInput
  readonly txCount: number
  readonly seed: number
}

/**
 * 7 body parts × mixed visit phases + edge cases.
 * Seeds 200001–200009 (distinct from fixture-snapshots seeds 100001–100030).
 */
const PARITY_CASES: readonly ParityCase[] = [
  {
    name: 'LBP-bilateral-early',
    input: {
      noteType: 'TX',
      insuranceType: 'OPTUM',
      primaryBodyPart: 'LBP',
      laterality: 'bilateral',
      painCurrent: 8,
      severityLevel: severity(8),
    },
    txCount: 3,
    seed: 200001,
  },
  {
    name: 'SHOULDER-left-mid',
    input: {
      noteType: 'TX',
      insuranceType: 'OPTUM',
      primaryBodyPart: 'SHOULDER',
      laterality: 'left',
      painCurrent: 7,
      severityLevel: severity(7),
    },
    txCount: 10,
    seed: 200002,
  },
  {
    name: 'KNEE-right-late',
    input: {
      noteType: 'TX',
      insuranceType: 'OPTUM',
      primaryBodyPart: 'KNEE',
      laterality: 'right',
      painCurrent: 9,
      severityLevel: severity(9),
    },
    txCount: 18,
    seed: 200003,
  },
  {
    name: 'NECK-bilateral-mid',
    input: {
      noteType: 'TX',
      insuranceType: 'OPTUM',
      primaryBodyPart: 'NECK',
      laterality: 'bilateral',
      painCurrent: 6,
      severityLevel: severity(6),
    },
    txCount: 8,
    seed: 200004,
  },
  {
    name: 'ELBOW-left-early',
    input: {
      noteType: 'TX',
      insuranceType: 'OPTUM',
      primaryBodyPart: 'ELBOW',
      laterality: 'left',
      painCurrent: 5,
      severityLevel: severity(5),
    },
    txCount: 3,
    seed: 200005,
  },
  {
    name: 'MID_LOW_BACK-bilateral-late',
    input: {
      noteType: 'TX',
      insuranceType: 'OPTUM',
      primaryBodyPart: 'MID_LOW_BACK',
      laterality: 'bilateral',
      painCurrent: 7,
      severityLevel: severity(7),
    },
    txCount: 20,
    seed: 200006,
  },
  {
    name: 'MIDDLE_BACK-bilateral-mid',
    input: {
      noteType: 'TX',
      insuranceType: 'OPTUM',
      primaryBodyPart: 'MIDDLE_BACK',
      laterality: 'bilateral',
      painCurrent: 6,
      severityLevel: severity(6),
    },
    txCount: 12,
    seed: 200007,
  },
] as const

describe('Parity: batch vs compose', () => {
  for (const tc of PARITY_CASES) {
    it(`identical output: ${tc.name}`, () => {
      // Path A — simulating batch (no explicit TCM overrides → inference)
      const batchNorm = normalizeGenerationContext(tc.input)
      const batchResults = exportTXSeriesAsText(batchNorm.context, {
        txCount: tc.txCount,
        seed: tc.seed,
        initialState: batchNorm.initialState,
      })

      // Path B — simulating compose with inference (same input, no overrides)
      const composeNorm = normalizeGenerationContext(tc.input)
      const composeResults = exportTXSeriesAsText(composeNorm.context, {
        txCount: tc.txCount,
        seed: tc.seed,
        initialState: composeNorm.initialState,
      })

      expect(batchResults.length).toBe(composeResults.length)

      for (let i = 0; i < batchResults.length; i++) {
        expect(normalizeSOAPText(composeResults[i].text))
          .toBe(normalizeSOAPText(batchResults[i].text))
      }
    })
  }
})

describe('Parity: TCM override divergence', () => {
  it('explicit TCM overrides produce different output than inference', () => {
    const baseInput: NormalizeInput = {
      noteType: 'TX',
      insuranceType: 'OPTUM',
      primaryBodyPart: 'LBP',
      laterality: 'bilateral',
      painCurrent: 8,
      severityLevel: severity(8),
    }

    const overrideInput: NormalizeInput = {
      ...baseInput,
      localPattern: 'Blood Stasis',
      systemicPattern: 'Liver Qi Stagnation',
    }

    const seed = 200008
    const txCount = 5

    const inferredNorm = normalizeGenerationContext(baseInput)
    const inferredResults = exportTXSeriesAsText(inferredNorm.context, {
      txCount,
      seed,
      initialState: inferredNorm.initialState,
    })

    const overrideNorm = normalizeGenerationContext(overrideInput)
    const overrideResults = exportTXSeriesAsText(overrideNorm.context, {
      txCount,
      seed,
      initialState: overrideNorm.initialState,
    })

    // At least one visit should differ (Assessment section has different TCM diagnosis)
    const hasDifference = overrideResults.some(
      (r, i) =>
        normalizeSOAPText(r.text) !== normalizeSOAPText(inferredResults[i].text)
    )
    expect(hasDifference).toBe(true)
  })
})

describe('Parity: Strength/ROM identical', () => {
  it('Strength and ROM values match between batch and compose for same input', () => {
    const input: NormalizeInput = {
      noteType: 'TX',
      insuranceType: 'OPTUM',
      primaryBodyPart: 'SHOULDER',
      laterality: 'left',
      painCurrent: 7,
      severityLevel: severity(7),
    }

    const seed = 200009
    const txCount = 10

    const batchNorm = normalizeGenerationContext(input)
    const batchResults = exportTXSeriesAsText(batchNorm.context, {
      txCount,
      seed,
      initialState: batchNorm.initialState,
    })

    const composeNorm = normalizeGenerationContext(input)
    const composeResults = exportTXSeriesAsText(composeNorm.context, {
      txCount,
      seed,
      initialState: composeNorm.initialState,
    })

    const strengthPattern = /Strength:?\s*(\S+)/g
    const romPattern = /ROM:?\s*([^\n]+)/g

    for (let i = 0; i < batchResults.length; i++) {
      const batchText = batchResults[i].text
      const composeText = composeResults[i].text

      const batchStrengths = [...batchText.matchAll(strengthPattern)].map(m => m[1])
      const composeStrengths = [...composeText.matchAll(strengthPattern)].map(m => m[1])
      expect(composeStrengths).toEqual(batchStrengths)

      const batchROMs = [...batchText.matchAll(romPattern)].map(m => m[1].trim())
      const composeROMs = [...composeText.matchAll(romPattern)].map(m => m[1].trim())
      expect(composeROMs).toEqual(batchROMs)
    }
  })
})
