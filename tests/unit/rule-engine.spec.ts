/**
 * Rule Engine Unit Tests
 * 规则引擎单元测试
 */

import { describe, it, expect } from '@jest/globals'
import {
  applyRules,
  aggregateWeights,
  getWeightedOptions,
  selectTopOptions,
  generateRuleReport,
  generateFieldWeightDetail,
  createContext,
  type RuleContext,
  type WeightEffect
} from '../../src'

describe('Rule Engine', () => {
  describe('createContext', () => {
    it('should create context from params', () => {
      const ctx = createContext({
        noteType: 'IE',
        insuranceType: 'WC',
        bodyPart: 'SHOULDER',
        localPattern: 'Qi Stagnation',
        systemicPattern: 'Kidney Qi Deficiency',
        chronicityLevel: 'Chronic',
        painScore: 7
      })
      expect(ctx.subjective?.primaryBodyPart?.bodyPart).toBe('SHOULDER')
      expect(ctx.assessment?.tcmDiagnosis?.localPattern).toBe('Qi Stagnation')
    })
  })

  describe('applyRules', () => {
    it('should apply rules and return weight effects', () => {
      const ctx: RuleContext = {
        subjective: {
          primaryBodyPart: { bodyPart: 'SHOULDER', laterality: 'bilateral' },
          chronicityLevel: 'Chronic',
          painScale: { worst: 8, best: 5, current: 7 }
        },
        assessment: {
          localPattern: 'Qi Stagnation',
          systemicPattern: 'Kidney Qi Deficiency'
        },
        header: {
          noteType: 'IE',
          insuranceType: 'WC'
        }
      }
      const effects = applyRules(ctx)
      expect(effects).toBeInstanceOf(Array)
    })
  })

  describe('aggregateWeights', () => {
    it('should aggregate weight effects by field', () => {
      const effects: WeightEffect[] = [
        { targetField: 'painTypes', option: 'Aching', weightChange: 10, reason: 'test', ruleId: 'R1', ruleName: 'Rule 1' },
        { targetField: 'painTypes', option: 'Aching', weightChange: 5, reason: 'test', ruleId: 'R2', ruleName: 'Rule 2' },
        { targetField: 'painTypes', option: 'Dull', weightChange: 3, reason: 'test', ruleId: 'R1', ruleName: 'Rule 1' }
      ]
      const aggregated = aggregateWeights(effects)
      expect(aggregated['painTypes']).toBeDefined()
      expect(aggregated['painTypes']['Aching'].totalWeight).toBe(15)
      expect(aggregated['painTypes']['Dull'].totalWeight).toBe(3)
    })
  })

  describe('getWeightedOptions', () => {
    it('should return weighted options for field', () => {
      const ctx: RuleContext = {
        subjective: {
          primaryBodyPart: { bodyPart: 'KNEE', laterality: 'right' },
          chronicityLevel: 'Chronic',
          painScale: { worst: 7, best: 4, current: 6 }
        },
        assessment: {
          localPattern: 'Cold-Damp',
          systemicPattern: 'Kidney Yang Deficiency'
        },
        header: {
          noteType: 'IE',
          insuranceType: 'OPTUM'
        }
      }
      const options = getWeightedOptions('subjective.painTypes', ['Dull', 'Aching', 'Freezing'], ctx)
      expect(options).toBeInstanceOf(Array)
    })
  })

  describe('selectTopOptions', () => {
    it('should select top N options by weight', () => {
      const ctx: RuleContext = {
        subjective: {
          primaryBodyPart: { bodyPart: 'LBP', laterality: 'bilateral' },
          chronicityLevel: 'Chronic'
        },
        assessment: {
          localPattern: 'Blood Stasis'
        }
      }
      const top = selectTopOptions('subjective.painTypes', ['Dull', 'Aching', 'Stabbing'], ctx, 2)
      expect(top).toBeInstanceOf(Array)
    })
  })

  describe('generateRuleReport', () => {
    it('should generate human-readable rule report', () => {
      const ctx: RuleContext = {
        subjective: {
          primaryBodyPart: { bodyPart: 'LBP', laterality: 'bilateral' },
          chronicityLevel: 'Sub Acute',
          painScale: { worst: 6, best: 3, current: 5 }
        },
        assessment: {
          localPattern: 'Blood Stasis',
          systemicPattern: 'Liver Qi Stagnation'
        },
        header: {
          noteType: 'TX',
          insuranceType: 'HF'
        }
      }
      const report = generateRuleReport(ctx)
      expect(typeof report).toBe('string')
      expect(report.length).toBeGreaterThan(0)
    })
  })

  describe('generateFieldWeightDetail', () => {
    it('should generate field weight breakdown', () => {
      const ctx: RuleContext = {
        subjective: {
          primaryBodyPart: { bodyPart: 'NECK', laterality: 'bilateral' },
          chronicityLevel: 'Acute',
          painScale: { worst: 8, best: 5, current: 7 }
        },
        assessment: {
          localPattern: 'Wind-Cold'
        },
        header: {
          noteType: 'IE',
          insuranceType: 'WC'
        }
      }
      const detail = generateFieldWeightDetail('plan.acupoints', ['GB20', 'GB21', 'BL10'], ctx)
      expect(typeof detail).toBe('string')
    })
  })
})
