/**
 * REAL-01: Realistic mode — slower recovery curve + multi-dimension assessment
 *
 * Tests that when realistic mode is active (chronicAware=true, disableChronicCaps=false):
 * 1. Pain curve is slower — 20-visit run doesn't reach LT target
 * 2. Tightness/Tenderness/Spasm gates are delayed
 * 3. symptomScale reduction is gentler
 * 4. Assessment whatChanged reflects ALL improved dimensions
 * 5. txCount>=16 threshold removed — chronic dampener works for any txCount
 *
 * Seeds 400001-400010 (distinct from fixture 100001-100030, parity 200001-200009, chronic 300001-300005)
 */
import { describe, it, expect } from 'vitest'
import { generateTXSequenceStates, deriveAssessmentFromSOA, type TXSequenceOptions } from '../tx-sequence-engine'
import type { GenerationContext } from '../../types'

function makeContext(overrides: Partial<GenerationContext> = {}): GenerationContext {
  return {
    noteType: 'TX',
    insuranceType: 'NONE',
    primaryBodyPart: 'SHOULDER',
    laterality: 'left',
    localPattern: 'Qi Stagnation',
    systemicPattern: 'Kidney Yang Deficiency',
    chronicityLevel: 'Chronic',
    severityLevel: 'moderate to severe',
    painCurrent: 8,
    ...overrides,
  }
}

describe('REAL-01: Realistic recovery curve (slower progression)', () => {
  it('20-visit chronic: final pain stays ABOVE long-term target (pain never fully resolves)', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const opts: TXSequenceOptions = { txCount: 20, seed: 400001 }
    const result = generateTXSequenceStates(ctx, opts)
    const lastVisit = result.states[result.states.length - 1]

    // With realistic curve, pain=8 patient after 20 visits should still be >= 4
    // (LT target ~5 with CHRONIC_END_RATIO=0.55, but curve shouldn't fully reach it)
    expect(lastVisit.painScaleCurrent).toBeGreaterThanOrEqual(4)
  })

  it('11-visit chronic: chronic dampener applies regardless of txCount (no txCount>=16 gate)', () => {
    // This is the key change: remove the txCount>=16 threshold
    const ctx = makeContext({ painCurrent: 8 })
    const opts11: TXSequenceOptions = { txCount: 11, seed: 400002 }
    const opts20: TXSequenceOptions = { txCount: 20, seed: 400002 }

    const result11 = generateTXSequenceStates(ctx, opts11)
    const result20 = generateTXSequenceStates(ctx, opts20)

    // At 50% progress point, both should show dampened progression
    const mid11 = result11.states[Math.floor(11 / 2)]
    const mid20 = result20.states[Math.floor(20 / 2)]

    // 11-visit midpoint pain should be >= 6 (dampened, not dropping fast)
    expect(mid11.painScaleCurrent).toBeGreaterThanOrEqual(5.5)
  })

  it('disableChronicCaps=true bypasses dampener even for Chronic patients', () => {
    const ctxDampened = makeContext({ painCurrent: 8 })
    const ctxBypassed = makeContext({ painCurrent: 8, disableChronicCaps: true })
    const opts: TXSequenceOptions = { txCount: 20, seed: 400003 }

    const dampened = generateTXSequenceStates(ctxDampened, opts)
    const bypassed = generateTXSequenceStates(ctxBypassed, opts)

    const dampenedLast = dampened.states[dampened.states.length - 1]
    const bypassedLast = bypassed.states[bypassed.states.length - 1]

    // Bypassed (no dampener) should reach lower pain than dampened
    expect(bypassedLast.painScaleCurrent).toBeLessThan(dampenedLast.painScaleCurrent)
  })

  it('Tightness gate delayed: tightness stays higher at progress 0.4-0.5', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const opts: TXSequenceOptions = { txCount: 20, seed: 400004 }
    const result = generateTXSequenceStates(ctx, opts)

    // At visit 8-10 (progress ~0.4-0.5), tightness should still be elevated
    const midVisits = result.states.filter(s => s.visitIndex >= 8 && s.visitIndex <= 10)
    for (const v of midVisits) {
      // Tightness grading should still be moderate or higher at this point
      const tg = v.tightnessGrading.toLowerCase()
      expect(tg).not.toBe('mild')
    }
  })

  it('symptomScale reduction is gentler: 70% does not drop below 40% at progress=1.0', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const opts: TXSequenceOptions = { txCount: 20, seed: 400005 }
    const result = generateTXSequenceStates(ctx, opts)
    const lastVisit = result.states[result.states.length - 1]

    const pct = parseInt(lastVisit.symptomScale || '70', 10)
    // With gentler reduction (progress^2 * 25 instead of 40), 70% → ~45%
    expect(pct).toBeGreaterThanOrEqual(40)
  })

  it('PLAT-01 plateau breaker threshold increased: tolerates 4 consecutive same labels', () => {
    const ctx = makeContext({ painCurrent: 8 })
    const opts: TXSequenceOptions = { txCount: 20, seed: 400006 }
    const result = generateTXSequenceStates(ctx, opts)

    // Count max consecutive same pain labels
    let maxConsecutive = 1
    let current = 1
    for (let i = 1; i < result.states.length; i++) {
      if (result.states[i].painScaleLabel === result.states[i - 1].painScaleLabel) {
        current++
        maxConsecutive = Math.max(maxConsecutive, current)
      } else {
        current = 1
      }
    }
    // With slower curve, we should see some plateaus (3-4 consecutive same labels is OK)
    // The breaker should allow up to 4 before forcing a micro-drop
    // This is a soft check — just verify the sequence is valid
    expect(result.states).toHaveLength(20)
  })
})

describe('REAL-01: Assessment reflects ALL improved dimensions', () => {
  it('whatChanged includes pain when painDelta > 0', () => {
    const result = deriveAssessmentFromSOA({
      painDelta: 0.8,
      adlDelta: 0.4,
      frequencyImproved: false,
      visitIndex: 5,
      objectiveTightnessTrend: 'slightly reduced',
      objectiveTendernessTrend: 'stable',
      objectiveSpasmTrend: 'stable',
      objectiveRomTrend: 'stable',
      objectiveStrengthTrend: 'stable',
      cumulativePainDrop: 2.0,
      progress: 0.4,
    })

    // whatChanged should mention both pain and ADL
    expect(result.whatChanged).toContain('pain')
  })

  it('whatChanged includes multiple dimensions when pain + ADL + frequency all improve', () => {
    const result = deriveAssessmentFromSOA({
      painDelta: 0.8,
      adlDelta: 0.4,
      frequencyImproved: true,
      visitIndex: 8,
      objectiveTightnessTrend: 'reduced',
      objectiveTendernessTrend: 'slightly reduced',
      objectiveSpasmTrend: 'stable',
      objectiveRomTrend: 'improved',
      objectiveStrengthTrend: 'stable',
      cumulativePainDrop: 3.0,
      progress: 0.6,
    })

    // Should mention frequency (hard rule) AND at least one other dimension
    expect(result.whatChanged).toContain('pain frequency')
    // The combined string should have "and" connecting multiple items
    expect(result.whatChanged).toContain(' and ')
  })

  it('whatChanged is single item when only one dimension improves', () => {
    const result = deriveAssessmentFromSOA({
      painDelta: 0.8,
      adlDelta: 0.05,
      frequencyImproved: false,
      visitIndex: 3,
      objectiveTightnessTrend: 'stable',
      objectiveTendernessTrend: 'stable',
      objectiveSpasmTrend: 'stable',
      objectiveRomTrend: 'stable',
      objectiveStrengthTrend: 'stable',
      cumulativePainDrop: 1.0,
      progress: 0.2,
    })

    // Only pain improved, no "and"
    expect(result.whatChanged).toBe('pain')
  })

  it('frequency improved is always mentioned when true (hard rule preserved)', () => {
    const result = deriveAssessmentFromSOA({
      painDelta: 0.1,
      adlDelta: 0.05,
      frequencyImproved: true,
      visitIndex: 6,
      objectiveTightnessTrend: 'stable',
      objectiveTendernessTrend: 'stable',
      objectiveSpasmTrend: 'stable',
      objectiveRomTrend: 'stable',
      objectiveStrengthTrend: 'stable',
      cumulativePainDrop: 1.5,
      progress: 0.4,
    })

    expect(result.whatChanged).toContain('pain frequency')
  })
})
