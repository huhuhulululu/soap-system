/**
 * Sequence Rules Unit Tests (V01-V09, T08)
 * 验证跨 visit 序列趋势规则
 */
import { describe, it, expect } from 'vitest'
import { generateDocument } from '../fixtures/generator'
import { checkDocument } from '../../../../parsers/optum-note/checker/note-checker'

function errorsFor(ruleId: string, config = {}) {
  const doc = generateDocument({ painStart: 8, bodyPart: 'LBP', ...config })
  const result = checkDocument({ document: doc })
  return result.errors.filter(e => e.ruleId === ruleId)
}

function injectedErrors(ruleId: string, config = {}) {
  const doc = generateDocument({ painStart: 8, bodyPart: 'LBP', ...config, injectErrors: [{ ruleId }] })
  const result = checkDocument({ document: doc })
  return result.errors.filter(e => e.ruleId === ruleId)
}

describe('Sequence Rules', () => {
  describe('V01: Pain should not increase', () => {
    it('perfect document has no V01 errors', () => {
      expect(errorsFor('V01')).toHaveLength(0)
    })
    it('triggers when pain increases between visits', () => {
      expect(injectedErrors('V01').length).toBeGreaterThan(0)
    })
  })

  describe('V02: Tenderness should not increase', () => {
    it('perfect document has no V02 errors', () => {
      expect(errorsFor('V02')).toHaveLength(0)
    })
    it('triggers when tenderness increases', () => {
      expect(injectedErrors('V02').length).toBeGreaterThan(0)
    })
  })

  describe('V03: Tightness should not increase', () => {
    it('perfect document has no V03 errors', () => {
      expect(errorsFor('V03')).toHaveLength(0)
    })
    it('triggers when tightness increases', () => {
      expect(injectedErrors('V03').length).toBeGreaterThan(0)
    })
  })

  describe('V04: Spasm should not increase', () => {
    it('perfect document has no V04 errors', () => {
      expect(errorsFor('V04')).toHaveLength(0)
    })
    it('triggers when spasm increases', () => {
      expect(injectedErrors('V04').length).toBeGreaterThan(0)
    })
  })

  describe('V05: ROM should not decrease', () => {
    it('perfect document has no V05 errors', () => {
      expect(errorsFor('V05')).toHaveLength(0)
    })
    it('triggers when ROM decreases', () => {
      expect(injectedErrors('V05').length).toBeGreaterThan(0)
    })
  })

  describe('V06: Strength should not decrease', () => {
    it('perfect document has no V06 errors', () => {
      expect(errorsFor('V06')).toHaveLength(0)
    })
    it('triggers when strength decreases', () => {
      expect(injectedErrors('V06').length).toBeGreaterThan(0)
    })
  })

  describe('V07: Pain frequency should not increase', () => {
    it('perfect document has no V07 errors', () => {
      expect(errorsFor('V07')).toHaveLength(0)
    })
    it('triggers when frequency increases', () => {
      expect(injectedErrors('V07').length).toBeGreaterThan(0)
    })
  })

  describe('V09: Acupoint overlap', () => {
    it('perfect document has no V09 errors', () => {
      expect(errorsFor('V09')).toHaveLength(0)
    })
    it('triggers when acupoint overlap < 40%', () => {
      expect(injectedErrors('V09').length).toBeGreaterThan(0)
    })
  })

  describe('T08: ADL severity should not increase', () => {
    it('perfect document has no T08 errors', () => {
      expect(errorsFor('T08')).toHaveLength(0)
    })
    it('triggers when ADL severity increases', () => {
      expect(injectedErrors('T08').length).toBeGreaterThan(0)
    })
  })
})

describe('Sequence monotonicity (perfect document)', () => {
  it('pain decreases monotonically across 12 visits', () => {
    const doc = generateDocument({ painStart: 9, visitCount: 12 })
    const pains = doc.visits.map(v => (v.subjective.painScale as any).current)
    for (let i = 1; i < pains.length; i++) {
      expect(pains[i]).toBeLessThanOrEqual(pains[i - 1])
    }
  })

  it('no sequence errors in perfect 12-visit document', () => {
    const doc = generateDocument({ painStart: 8 })
    const result = checkDocument({ document: doc })
    const seqErrors = result.errors.filter(e => e.ruleId.startsWith('V'))
    expect(seqErrors).toHaveLength(0)
  })
})
