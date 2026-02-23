import { describe, it, expect } from 'vitest'
import { calculateDynamicGoals } from './goals-calculator'

/**
 * Chronic-aware goals caps tests
 * CRV-02: Chronic patients get realistic LT targets
 * - Pain: 30-50% improvement (CHRONIC_END_RATIO = 0.55), not 75%
 * - Strength: capped at 4/5
 * - ROM: capped at 80% (varies by severity)
 */

describe('calculateDynamicGoals — chronic-aware caps', () => {
  // ===== Pain Goals =====

  it('chronic pain=8: LT pain reflects ~50% improvement (4-5), not 75% (2-3)', () => {
    const goals = calculateDynamicGoals('moderate to severe', 'LBP', 'soreness', 8, true)
    const ltNum = parseInt(goals.pain.lt, 10)
    // CHRONIC_END_RATIO = 0.55 → ceil(8 * 0.55) = ceil(4.4) = 5
    expect(ltNum).toBeGreaterThanOrEqual(4)
    expect(ltNum).toBeLessThanOrEqual(6)
  })

  it('chronic pain=10: LT pain ~5-6, not 2-3', () => {
    const goals = calculateDynamicGoals('severe', 'KNEE', 'soreness', 10, true)
    const ltNum = parseInt(goals.pain.lt, 10)
    // ceil(10 * 0.55) = ceil(5.5) = 6
    expect(ltNum).toBeGreaterThanOrEqual(5)
    expect(ltNum).toBeLessThanOrEqual(7)
  })

  it('non-chronic pain=8: LT pain ~2-3 (existing behavior unchanged)', () => {
    const goals = calculateDynamicGoals('moderate to severe', 'LBP', 'soreness', 8, false)
    const ltNum = parseInt(goals.pain.lt, 10)
    // OPTIMAL_END_RATIO = 0.25 → ceil(8 * 0.25) = 2
    expect(ltNum).toBeGreaterThanOrEqual(2)
    expect(ltNum).toBeLessThanOrEqual(3)
  })

  // ===== Strength Goals =====

  it('chronic: LT strength never exceeds 4', () => {
    const goals = calculateDynamicGoals('moderate to severe', 'LBP', 'soreness', 8, true)
    // Should be '4' or lower, never '4+'
    expect(goals.strength.lt).not.toContain('+')
    const ltNum = parseInt(goals.strength.lt, 10)
    expect(ltNum).toBeLessThanOrEqual(4)
  })

  it('non-chronic: LT strength can reach 4+', () => {
    const goals = calculateDynamicGoals('moderate to severe', 'LBP', 'soreness', 8, false)
    // Existing behavior: moderate to severe → initial '4-/5' → LT '4+'
    expect(goals.strength.lt).toBe('4+')
  })

  // ===== ROM Goals =====

  it('chronic severe: LT ROM ≤ 70%', () => {
    const goals = calculateDynamicGoals('severe', 'KNEE', 'soreness', 10, true)
    const ltPct = parseInt(goals.rom.lt, 10)
    expect(ltPct).toBeLessThanOrEqual(70)
  })

  it('chronic moderate to severe: LT ROM ≤ 80%', () => {
    const goals = calculateDynamicGoals('moderate to severe', 'LBP', 'soreness', 8, true)
    const ltPct = parseInt(goals.rom.lt, 10)
    expect(ltPct).toBeLessThanOrEqual(80)
  })

  it('non-chronic: ROM values unchanged from existing behavior', () => {
    const goals = calculateDynamicGoals('moderate to severe', 'LBP', 'soreness', 8, false)
    // Existing: moderate to severe → { st: '60%', lt: '80%' }
    expect(goals.rom.st).toBe('60%')
    expect(goals.rom.lt).toBe('80%')
  })

  // ===== Backward Compatibility =====

  it('omitting 5th arg behaves same as chronicAware=false', () => {
    const withoutArg = calculateDynamicGoals('moderate to severe', 'LBP', 'soreness', 8)
    const withFalse = calculateDynamicGoals('moderate to severe', 'LBP', 'soreness', 8, false)
    expect(withoutArg).toEqual(withFalse)
  })
})
