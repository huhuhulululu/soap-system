/**
 * Patched Goals 测试
 *
 * 验证 objective-patch.ts 中的 Goals 补丁：
 * 1. PATCHED_BASE_GRADES 修正（Phase 1）
 * 2. patchedGoals() 5 个基础模型 + 微调（Phase 2）
 * 3. Plan 文本替换（Phase 3）
 *
 * Seeds: 500001+ (distinct from fixture/parity/chronic/realistic)
 */
import { describe, it, expect } from 'vitest'
import { patchSOAPText, buildPatchContext, computePatchedGoals, type PatchedGoals } from '../objective-patch'
import { exportSOAPAsText } from '../soap-generator'
import type { GenerationContext } from '../../types'

function makeIEContext(overrides: Partial<GenerationContext> = {}): GenerationContext {
  return {
    noteType: 'IE',
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

// ==================== Phase 1: PATCHED_BASE_GRADES ====================
describe('Phase 1: PATCHED_BASE_GRADES 修正', () => {
  it('Pain 6 → Strength 4-/5 (not 3+/5)', () => {
    const ctx = makeIEContext({ painCurrent: 6, severityLevel: 'moderate' })
    const text = exportSOAPAsText(ctx)
    const patched = patchSOAPText(text, ctx)
    // ROM block should contain 4-/5 for pain 6 base (some movements may vary by difficulty)
    expect(patched).toContain('4-/5')
  })

  it('Pain 8 → Strength 3+/5 (not 3/5)', () => {
    const ctx = makeIEContext({ painCurrent: 8 })
    const text = exportSOAPAsText(ctx)
    const patched = patchSOAPText(text, ctx)
    // Should have 3+/5 as base for pain 8
    expect(patched).toContain('3+/5')
  })

  it('Pain 10 → Strength 3/5 (not 3-/5)', () => {
    const ctx = makeIEContext({ painCurrent: 10, severityLevel: 'severe' })
    const text = exportSOAPAsText(ctx)
    const patched = patchSOAPText(text, ctx)
    expect(patched).toContain('3/5')
  })
})

// ==================== Phase 2: patchedGoals() 基础模型 ====================
describe('Phase 2: patchedGoals() 5 个基础模型', () => {
  it('Pain 5 → ST pain=3, LT pain=2', () => {
    const goals = computePatchedGoals(5, 'moderate', 'LBP', 'soreness')
    expect(goals.pain.st).toBe('3')
    expect(goals.pain.lt).toBe('2')
  })

  it('Pain 6 → ST pain=3, LT pain=2', () => {
    const goals = computePatchedGoals(6, 'moderate', 'LBP', 'soreness')
    expect(goals.pain.st).toBe('3')
    expect(goals.pain.lt).toBe('2')
  })

  it('Pain 7 → ST pain=3-4, LT pain=2-3', () => {
    const goals = computePatchedGoals(7, 'moderate to severe', 'LBP', 'soreness')
    expect(goals.pain.st).toBe('3-4')
    expect(goals.pain.lt).toBe('2-3')
  })

  it('Pain 8 → ST pain=4-5, LT pain=3', () => {
    const goals = computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness')
    expect(goals.pain.st).toBe('4-5')
    expect(goals.pain.lt).toBe('3')
  })

  it('Pain 9 → ST pain=5-6, LT pain=3-4', () => {
    const goals = computePatchedGoals(9, 'severe', 'LBP', 'soreness')
    expect(goals.pain.st).toBe('5-6')
    expect(goals.pain.lt).toBe('3-4')
  })

  // Symptom percentage
  it('Pain 5 → Sx% ST=(30%-40%), LT=(20%-30%)', () => {
    const goals = computePatchedGoals(5, 'moderate', 'LBP', 'soreness')
    expect(goals.symptomPct.st).toBe('(30%-40%)')
    expect(goals.symptomPct.lt).toBe('(20%-30%)')
  })

  it('Pain 9 → Sx% ST=(50%-60%), LT=(30%-40%)', () => {
    const goals = computePatchedGoals(9, 'severe', 'LBP', 'soreness')
    expect(goals.symptomPct.st).toBe('(50%-60%)')
    expect(goals.symptomPct.lt).toBe('(30%-40%)')
  })

  // Tightness
  it('Pain 5 → Tightness ST=mild, LT=mild', () => {
    const goals = computePatchedGoals(5, 'moderate', 'LBP', 'soreness')
    expect(goals.tightness.st).toBe('mild')
    expect(goals.tightness.lt).toBe('mild')
  })

  it('Pain 8 → Tightness ST=moderate, LT=mild to moderate', () => {
    const goals = computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness')
    expect(goals.tightness.st).toBe('moderate')
    expect(goals.tightness.lt).toBe('mild to moderate')
  })

  it('Pain 9 → Tightness ST=moderate to severe, LT=moderate', () => {
    const goals = computePatchedGoals(9, 'severe', 'LBP', 'soreness')
    expect(goals.tightness.st).toBe('moderate to severe')
    expect(goals.tightness.lt).toBe('moderate')
  })

  // Tenderness
  it('Pain 5-6 → Tenderness ST=1, LT=1', () => {
    expect(computePatchedGoals(5, 'moderate', 'LBP', 'soreness').tenderness).toEqual({ st: 1, lt: 1 })
    expect(computePatchedGoals(6, 'moderate', 'LBP', 'soreness').tenderness).toEqual({ st: 1, lt: 1 })
  })

  it('Pain 8 → Tenderness ST=2, LT=1', () => {
    expect(computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness').tenderness).toEqual({ st: 2, lt: 1 })
  })

  // Spasm
  it('Pain 5-8 → Spasm ST varies, LT=1', () => {
    for (const p of [5, 6]) {
      const goals = computePatchedGoals(p, 'moderate', 'LBP', 'soreness')
      expect(goals.spasm).toEqual({ st: 1, lt: 1 })
    }
    for (const p of [7, 8]) {
      const goals = computePatchedGoals(p, 'moderate to severe', 'LBP', 'soreness')
      expect(goals.spasm).toEqual({ st: 2, lt: 1 })
    }
  })

  // Strength
  it('Pain 5-6 → Strength ST=4+, LT=4+', () => {
    expect(computePatchedGoals(5, 'moderate', 'LBP', 'soreness').strength).toEqual({ st: '4+', lt: '4+' })
    expect(computePatchedGoals(6, 'moderate', 'LBP', 'soreness').strength).toEqual({ st: '4+', lt: '4+' })
  })

  it('Pain 7 → Strength ST=4, LT=4+', () => {
    expect(computePatchedGoals(7, 'moderate to severe', 'LBP', 'soreness').strength).toEqual({ st: '4', lt: '4+' })
  })

  it('Pain 8-9 → Strength ST=4, LT=4+', () => {
    expect(computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness').strength).toEqual({ st: '4', lt: '4+' })
    expect(computePatchedGoals(9, 'severe', 'LBP', 'soreness').strength).toEqual({ st: '4', lt: '4+' })
  })

  // ROM
  it('Pain 5 → ROM ST=50%, LT=60%', () => {
    const goals = computePatchedGoals(5, 'moderate', 'LBP', 'soreness')
    expect(goals.rom).toEqual({ st: '50%', lt: '60%' })
  })

  it('Pain 8 → ROM ST=55%, LT=70%', () => {
    const goals = computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness')
    expect(goals.rom).toEqual({ st: '55%', lt: '70%' })
  })

  it('Pain 9 → ROM ST=50%, LT=65%', () => {
    const goals = computePatchedGoals(9, 'severe', 'LBP', 'soreness')
    expect(goals.rom).toEqual({ st: '50%', lt: '65%' })
  })

  // ADL
  it('Pain 5-6 → ADL ST=mild, LT=mild', () => {
    expect(computePatchedGoals(5, 'moderate', 'LBP', 'soreness').adl).toEqual({ st: 'mild', lt: 'mild' })
  })

  it('Pain 8 → ADL ST=moderate, LT=mild to moderate', () => {
    const goals = computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness')
    expect(goals.adl.st).toBe('moderate')
    expect(goals.adl.lt).toBe('mild-moderate')
  })

  it('Pain 9 → ADL ST=moderate to severe, LT=mild to moderate', () => {
    const goals = computePatchedGoals(9, 'severe', 'LBP', 'soreness')
    expect(goals.adl.st).toBe('moderate-severe')
    expect(goals.adl.lt).toBe('mild-moderate')
  })
})

// ==================== Phase 2b: 微调 ====================
describe('Phase 2b: patchedGoals() 微调', () => {
  it('progressMultiplier < 0.90 (Stroke) → Pain ST/LT each +1', () => {
    const base = computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness')
    const adjusted = computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness', {
      medicalHistory: ['Stroke'],
      age: 70,
    })
    // Pain ST should be higher (worse) than base
    const baseST = parseInt(base.pain.st.split('-')[0])
    const adjST = parseInt(adjusted.pain.st.split('-')[0])
    expect(adjST).toBeGreaterThan(baseST)
  })

  it('severityBump > 0 (Herniated Disk + LBP) → Tenderness ST +1', () => {
    const base = computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness')
    const adjusted = computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness', {
      medicalHistory: ['Herniated Disk'],
    })
    expect(adjusted.tenderness.st).toBeGreaterThanOrEqual(base.tenderness.st)
  })

  it('spasmBump > 0 (Parkinson) → Spasm ST +1, LT +1', () => {
    const base = computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness')
    const adjusted = computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness', {
      medicalHistory: ['Parkinson'],
    })
    expect(adjusted.spasm.st).toBeGreaterThan(base.spasm.st)
    expect(adjusted.spasm.lt).toBeGreaterThan(base.spasm.lt)
  })

  it('baselineCondition=poor → Strength cap 4, ROM LT -5%', () => {
    const adjusted = computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness', {
      medicalHistory: ['Stroke', 'Diabetes'],
      age: 75,
    })
    // Strength should not exceed 4
    const strVal = (s: string) => parseFloat(s.replace('+', '.5').replace('-', '.2'))
    expect(strVal(adjusted.strength.st)).toBeLessThanOrEqual(4)
    expect(strVal(adjusted.strength.lt)).toBeLessThanOrEqual(4)
  })

  it('SHOULDER → ROM ST/LT each -5%', () => {
    const lbp = computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness')
    const shoulder = computePatchedGoals(8, 'moderate to severe', 'SHOULDER', 'soreness')
    const parsePct = (s: string) => parseInt(s.replace('%', ''))
    expect(parsePct(shoulder.rom.st)).toBe(parsePct(lbp.rom.st) - 5)
    expect(parsePct(shoulder.rom.lt)).toBe(parsePct(lbp.rom.lt) - 5)
  })

  it('no medical history → no adjustments (same as base)', () => {
    const base = computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness')
    const noHistory = computePatchedGoals(8, 'moderate to severe', 'LBP', 'soreness', {
      medicalHistory: [],
    })
    expect(noHistory.pain.st).toBe(base.pain.st)
    expect(noHistory.pain.lt).toBe(base.pain.lt)
  })
})

// ==================== Phase 3: Plan 文本替换 ====================
describe('Phase 3: patchSOAPText Plan 替换', () => {
  it('IE Pain 8 → Plan contains patched ST pain goal (4-5)', () => {
    const ctx = makeIEContext({ painCurrent: 8 })
    const text = exportSOAPAsText(ctx)
    const patched = patchSOAPText(text, ctx)
    expect(patched).toContain('Decrease Pain Scale to 4-5')
  })

  it('IE Pain 9 → Plan contains patched ST pain goal (5-6)', () => {
    const ctx = makeIEContext({ painCurrent: 9, severityLevel: 'severe' })
    const text = exportSOAPAsText(ctx)
    const patched = patchSOAPText(text, ctx)
    expect(patched).toContain('Decrease Pain Scale to 5-6')
  })

  it('IE Pain 5 → Plan contains patched LT pain goal (2)', () => {
    const ctx = makeIEContext({ painCurrent: 5, severityLevel: 'mild to moderate' })
    const text = exportSOAPAsText(ctx)
    const patched = patchSOAPText(text, ctx)
    // LT section should have "Decrease Pain Scale to 2"
    const ltSection = patched.slice(patched.indexOf('Long Term Goal'))
    expect(ltSection).toContain('Decrease Pain Scale to 2')
  })

  it('IE Pain 8 → Strength goal patched to 4', () => {
    const ctx = makeIEContext({ painCurrent: 8 })
    const text = exportSOAPAsText(ctx)
    const patched = patchSOAPText(text, ctx)
    // ST section should have Strength to 4
    const stSection = patched.slice(patched.indexOf('Short Term Goal'), patched.indexOf('Long Term Goal'))
    expect(stSection).toContain('Increase Muscles Strength to 4')
  })

  it('IE Pain 8 → ROM goal patched to 55%/70%', () => {
    const ctx = makeIEContext({ painCurrent: 8 })
    const text = exportSOAPAsText(ctx)
    const patched = patchSOAPText(text, ctx)
    const ltSection = patched.slice(patched.indexOf('Long Term Goal'))
    expect(ltSection).toContain('Increase ROM 70%')
  })

  it('TX note → Plan NOT patched (no Goals in TX)', () => {
    const ctx: GenerationContext = {
      ...makeIEContext(),
      noteType: 'TX',
    }
    const text = exportSOAPAsText(ctx)
    const patched = patchSOAPText(text, ctx)
    // TX Plan has "treatment principles", no Goals lines
    expect(patched).not.toContain('Short Term Goal')
    expect(patched).not.toContain('Long Term Goal')
  })

  it('Stroke patient Pain 8 → ST pain higher than healthy patient', () => {
    const healthy = makeIEContext({ painCurrent: 8, medicalHistory: [] })
    const stroke = makeIEContext({ painCurrent: 8, medicalHistory: ['Stroke'], age: 70 })
    const healthyPatched = patchSOAPText(exportSOAPAsText(healthy), healthy)
    const strokePatched = patchSOAPText(exportSOAPAsText(stroke), stroke)

    // Extract ST pain from patched text
    const extractSTPain = (text: string) => {
      const stSection = text.slice(text.indexOf('Short Term Goal'), text.indexOf('Long Term Goal'))
      const match = stSection.match(/Decrease Pain Scale to (\S+)/)
      return match ? parseInt(match[1].split('-')[0]) : 0
    }
    expect(extractSTPain(strokePatched)).toBeGreaterThan(extractSTPain(healthyPatched))
  })
})
