/**
 * Generator Rules Unit Tests (S2, O8, O9, A5, P1, P2, X1, X3, X4)
 * 验证生成器相关规则（数据一致性、部位匹配等）
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

describe('Subjective Generator Rules', () => {
  describe('S2: painTypes vs localPattern', () => {
    it('perfect document has no S2 errors', () => {
      expect(errorsFor('S2')).toHaveLength(0)
    })
    it('triggers when painTypes mismatch pattern', () => {
      expect(injectedErrors('S2').length).toBeGreaterThan(0)
    })
  })

  describe('S3: ADL vs bodyPart', () => {
    it('perfect document has no S3 errors', () => {
      expect(errorsFor('S3')).toHaveLength(0)
    })
    const bodyParts = ['LBP', 'KNEE', 'SHOULDER', 'NECK'] as const
    for (const bp of bodyParts) {
      it(`${bp} ADL text contains relevant keywords`, () => {
        expect(errorsFor('S3', { bodyPart: bp })).toHaveLength(0)
      })
    }
  })
})

describe('Objective Generator Rules', () => {
  describe('O1: ROM degrees vs pain', () => {
    it('perfect document has no O1 errors', () => {
      expect(errorsFor('O1')).toHaveLength(0)
    })
  })

  describe('O2: ROM severity label vs degrees', () => {
    it('perfect document has no O2 errors', () => {
      expect(errorsFor('O2')).toHaveLength(0)
    })
  })

  describe('O8: Muscles belong to bodyPart', () => {
    it('perfect document has no O8 errors', () => {
      expect(errorsFor('O8')).toHaveLength(0)
    })
    it('triggers when wrong muscles for bodyPart', () => {
      expect(injectedErrors('O8').length).toBeGreaterThan(0)
    })
    const bodyParts = ['LBP', 'KNEE', 'SHOULDER', 'NECK'] as const
    for (const bp of bodyParts) {
      it(`${bp} muscles match checker keywords`, () => {
        expect(errorsFor('O8', { bodyPart: bp })).toHaveLength(0)
      })
    }
  })

  describe('O9: ROM movement belongs to bodyPart', () => {
    it('perfect document has no O9 errors', () => {
      expect(errorsFor('O9')).toHaveLength(0)
    })
    it('triggers when wrong ROM movement', () => {
      expect(injectedErrors('O9').length).toBeGreaterThan(0)
    })
  })
})

describe('Assessment Generator Rules', () => {
  describe('A5: localPattern consistent across visits', () => {
    it('perfect document has no A5 errors', () => {
      expect(errorsFor('A5')).toHaveLength(0)
    })
    it('triggers when pattern changes between visits', () => {
      expect(injectedErrors('A5').length).toBeGreaterThan(0)
    })
  })
})

describe('Plan Generator Rules', () => {
  describe('P1: Needle gauge vs bodyPart', () => {
    it('perfect document has no P1 errors', () => {
      expect(errorsFor('P1')).toHaveLength(0)
    })
    it('triggers when invalid gauge for bodyPart', () => {
      expect(injectedErrors('P1').length).toBeGreaterThan(0)
    })
    const bodyParts = ['LBP', 'KNEE', 'SHOULDER', 'NECK'] as const
    for (const bp of bodyParts) {
      it(`${bp} needle gauges are valid`, () => {
        expect(errorsFor('P1', { bodyPart: bp })).toHaveLength(0)
      })
    }
  })

  describe('P2: Acupoints count', () => {
    it('perfect document has no P2 errors', () => {
      expect(errorsFor('P2')).toHaveLength(0)
    })
    it('triggers when too many acupoints', () => {
      expect(injectedErrors('P2').length).toBeGreaterThan(0)
    })
  })
})

describe('Cross-check Rules (X)', () => {
  describe('X1: Pain→Tightness→Tenderness chain', () => {
    it('perfect document has no X1 errors', () => {
      expect(errorsFor('X1')).toHaveLength(0)
    })
    it('triggers when high pain but low tightness', () => {
      expect(injectedErrors('X1').length).toBeGreaterThan(0)
    })
  })

  describe('X3: Pattern→Tongue/Pulse consistency', () => {
    it('perfect document has no X3 errors', () => {
      expect(errorsFor('X3')).toHaveLength(0)
    })
    it('triggers when tongue/pulse mismatch pattern', () => {
      expect(injectedErrors('X3').length).toBeGreaterThan(0)
    })
  })

  describe('X4: Pacemaker + electrical stim', () => {
    it('perfect document has no X4 errors', () => {
      expect(errorsFor('X4')).toHaveLength(0)
    })
    it('triggers when pacemaker + estim', () => {
      expect(injectedErrors('X4').length).toBeGreaterThan(0)
    })
  })
})
