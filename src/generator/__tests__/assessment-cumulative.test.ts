import { describe, it, expect, beforeAll } from 'vitest'
import { generateTXSequenceStates } from '../tx-sequence-engine'
import { setWhitelist } from '../../parser/template-rule-whitelist'
import whitelistData from '../../../frontend/src/data/whitelist.json'
import type { GenerationContext } from '../../types'

beforeAll(() => {
  setWhitelist(whitelistData as Record<string, string[]>)
})

function makeContext(overrides: Partial<GenerationContext> = {}): GenerationContext {
  return {
    noteType: 'TX',
    insuranceType: 'OPTUM',
    primaryBodyPart: 'KNEE',
    laterality: 'bilateral',
    localPattern: 'Cold-Damp + Wind-Cold',
    systemicPattern: 'Kidney Yang Deficiency',
    chronicityLevel: 'Chronic',
    severityLevel: 'moderate to severe',
    painCurrent: 8,
    associatedSymptom: 'soreness',
    hasPacemaker: false,
    ...overrides,
  } as GenerationContext
}

describe('Assessment cumulative tracking (ASS-02)', () => {
  it('later visits use stronger or equal assessment language compared to early visits', () => {
    const ctx = makeContext()
    const result = generateTXSequenceStates(ctx, {
      txCount: 12,
      seed: 300001,
      initialState: {
        pain: 8,
        tightness: 3,
        tenderness: 3,
        spasm: 3,
        frequency: 3,
        associatedSymptom: 'soreness',
        painTypes: ['Dull', 'Aching'],
      },
    })

    const earlyVisit = result.states[1]  // TX2
    const lateVisit = result.states[9]   // TX10

    expect(earlyVisit.soaChain.assessment).toBeDefined()
    expect(lateVisit.soaChain.assessment).toBeDefined()

    // Late visit with cumulative evidence should not use weaker language
    // If late visit says "improvement", early should not also say "improvement"
    // (unless early had a strong single-visit delta)
    const strengthMap: Record<string, number> = {
      'slight improvement of symptom(s).': 1,
      'improvement of symptom(s).': 2,
    }
    const earlyStrength = strengthMap[earlyVisit.soaChain.assessment.present] ?? 0
    const lateStrength = strengthMap[lateVisit.soaChain.assessment.present] ?? 0
    expect(lateStrength).toBeGreaterThanOrEqual(earlyStrength)
  })

  it('assessment whatChanged varies across visits (not all identical)', () => {
    const ctx = makeContext()
    const result = generateTXSequenceStates(ctx, {
      txCount: 8,
      seed: 300002,
      initialState: {
        pain: 8,
        tightness: 3,
        tenderness: 3,
        spasm: 3,
        frequency: 3,
        associatedSymptom: 'soreness',
        painTypes: ['Dull', 'Aching'],
      },
    })

    const whatChangedSet = new Set(
      result.states.map(v => v.soaChain.assessment.whatChanged)
    )
    // Should have at least 2 distinct whatChanged values across 8 visits
    expect(whatChangedSet.size).toBeGreaterThanOrEqual(2)
  })

  it('all assessment fields use valid template options', () => {
    const VALID_PRESENT = [
      'slight improvement of symptom(s).',
      'improvement of symptom(s).',
      'exacerbate of symptom(s).',
      'no change.'
    ]
    const VALID_PATIENT_CHANGE = [
      'decreased', 'slightly decreased', 'increased', 'slight increased', 'remained the same'
    ]
    const VALID_WHAT_CHANGED = [
      'pain', 'pain frequency', 'pain duration', 'numbness sensation',
      'muscles weakness', 'muscles soreness sensation', 'muscles stiffness sensation',
      'heaviness sensation', 'difficulty in performing ADLs', 'as last time visit'
    ]

    const ctx = makeContext()
    const result = generateTXSequenceStates(ctx, {
      txCount: 12,
      seed: 300003,
      initialState: {
        pain: 8,
        tightness: 3,
        tenderness: 3,
        spasm: 3,
        frequency: 3,
        associatedSymptom: 'soreness',
        painTypes: ['Dull', 'Aching'],
      },
    })

    for (const visit of result.states) {
      expect(VALID_PRESENT).toContain(visit.soaChain.assessment.present)
      expect(VALID_PATIENT_CHANGE).toContain(visit.soaChain.assessment.patientChange)
      expect(VALID_WHAT_CHANGED).toContain(visit.soaChain.assessment.whatChanged)
    }
  })
})
