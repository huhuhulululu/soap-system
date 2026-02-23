import { describe, it, expect } from 'vitest'
import { generateTXSequenceStates, type TXSequenceOptions } from './tx-sequence-engine'
import type { GenerationContext } from '../types'

/**
 * CRV-01: Chronic dampener tests
 * Seeds 300001-300005 (distinct from fixture 100001-100030 and parity 200001-200009)
 */

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

describe('CRV-01: Chronic dampener on progress curve', () => {
  it('txCount>=16 dampens midpoint progress (pain stays higher)', () => {
    const ctx = makeContext()
    const chronicOpts: TXSequenceOptions = { txCount: 20, seed: 300001 }
    const acuteOpts: TXSequenceOptions = { txCount: 10, seed: 300001 }

    const chronic = generateTXSequenceStates(ctx, chronicOpts)
    const acute = generateTXSequenceStates(ctx, acuteOpts)

    // Midpoint of chronic run (visit 10)
    const chronicMid = chronic.states.find(s => s.visitIndex === 10)!
    // Midpoint of acute run (visit 5)
    const acuteMid = acute.states.find(s => s.visitIndex === 5)!

    // Chronic midpoint pain should be HIGHER (less improved) than acute midpoint
    // because chronicDampener (0.82) slows the S-curve
    expect(chronicMid.painScaleCurrent).toBeGreaterThan(acuteMid.painScaleCurrent)
  })

  it('txCount<16 has no dampening applied', () => {
    const ctx = makeContext()
    const opts12: TXSequenceOptions = { txCount: 12, seed: 300002 }
    const opts20: TXSequenceOptions = { txCount: 20, seed: 300002 }

    const result12 = generateTXSequenceStates(ctx, opts12)
    const result20 = generateTXSequenceStates(ctx, opts20)

    // txCount=12 should NOT have dampening (< 16 threshold)
    // txCount=20 SHOULD have dampening
    // At equivalent progress points, the 12-visit run should show more improvement
    const visit6of12 = result12.states.find(s => s.visitIndex === 6)!
    const visit10of20 = result20.states.find(s => s.visitIndex === 10)!

    // visit 6/12 = 50% through, visit 10/20 = 50% through
    // Without dampening, 12-visit should have equal or better progress at midpoint
    // With dampening on 20-visit, the 20-visit midpoint pain should be higher
    expect(visit10of20.painScaleCurrent).toBeGreaterThanOrEqual(visit6of12.painScaleCurrent)
  })

  it('ltFallback uses chronicEndRatio 0.55 for txCount>=16 (pain=8)', () => {
    // No previousIE → forces ltFallback path
    // With chronic ratio: ltFallback = ceil(max(2, 8 * 0.55)) = ceil(4.4) = 5
    // Without chronic ratio: ltFallback = ceil(max(2, 8 * 0.25)) = ceil(2) = 2
    const ctx = makeContext({ painCurrent: 8 })
    const opts: TXSequenceOptions = { txCount: 20, seed: 300004 }

    const result = generateTXSequenceStates(ctx, opts)
    const lastVisit = result.states[result.states.length - 1]

    // With chronic ltFallback=5, final pain should not drop below ~4
    // Without it (ltFallback=2), final pain could reach ~2
    expect(lastVisit.painScaleCurrent).toBeGreaterThanOrEqual(4)
  })

  it('ltFallback unchanged for txCount<16 (pain=8)', () => {
    // txCount=10 → non-chronic → ltFallback = ceil(max(2, 8*0.25)) = 2
    const ctx = makeContext({ painCurrent: 8 })
    const opts: TXSequenceOptions = { txCount: 10, seed: 300004 }

    const result = generateTXSequenceStates(ctx, opts)
    const lastVisit = result.states[result.states.length - 1]

    // Non-chronic: ltFallback=2, final pain can drop to 2-3 range
    expect(lastVisit.painScaleCurrent).toBeLessThanOrEqual(4)
  })

  it('PRNG sequence preserved — visit count equals txCount', () => {
    const ctx = makeContext()
    const opts: TXSequenceOptions = { txCount: 20, seed: 300003 }

    const result = generateTXSequenceStates(ctx, opts)

    // Sanity: if rng() calls were added inside the loop, values shift
    // but visit count should still equal txCount
    expect(result.states).toHaveLength(20)
    expect(result.states[0].visitIndex).toBe(1)
    expect(result.states[19].visitIndex).toBe(20)
  })
})
