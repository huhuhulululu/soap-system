/**
 * Weight System Unit Tests
 * 权重系统单元测试
 */

import { describe, it, expect } from '@jest/globals'
import {
  calculateWeights,
  selectBestOption,
  selectBestOptions,
  weightPainTypes,
  weightSeverityLevel,
  weightTreatmentPrinciples,
  weightAcupoints,
  weightMuscles,
  weightAdl,
  weightElectricalStimulation,
  weightOperationTime,
  type WeightContext
} from '../../src'

describe('Weight System', () => {
  const baseContext: WeightContext = {
    bodyPart: 'SHOULDER',
    localPattern: 'Qi Stagnation',
    systemicPattern: 'Kidney Qi Deficiency',
    chronicityLevel: 'Chronic',
    severityLevel: 'moderate',
    painScale: 7,
    insuranceType: 'WC'
  }

  describe('weightPainTypes', () => {
    it('should weight pain types based on pattern', () => {
      const options = ['Dull', 'Aching', 'Freezing', 'Shooting']
      const weighted = weightPainTypes(options, baseContext)
      expect(weighted.length).toBe(options.length)
      expect(weighted.every(w => w.weight >= 0)).toBe(true)
    })

    it('should prefer Aching for Qi Stagnation', () => {
      const options = ['Dull', 'Aching', 'Freezing']
      const weighted = weightPainTypes(options, baseContext)
      const achingWeight = weighted.find(w => w.option === 'Aching')?.weight || 0
      const freezingWeight = weighted.find(w => w.option === 'Freezing')?.weight || 0
      expect(achingWeight).toBeGreaterThan(freezingWeight)
    })
  })

  describe('weightSeverityLevel', () => {
    it('should weight severity based on pain scale', () => {
      const options = ['mild', 'moderate', 'severe']
      const weighted = weightSeverityLevel(options, { ...baseContext, painScale: 8 })
      const severeWeight = weighted.find(w => w.option === 'severe')?.weight || 0
      const mildWeight = weighted.find(w => w.option === 'mild')?.weight || 0
      expect(severeWeight).toBeGreaterThan(mildWeight)
    })
  })

  describe('weightTreatmentPrinciples', () => {
    it('should weight principles based on pattern', () => {
      const options = [
        'Move Qi, Resolve Stagnation',
        'Warm Yang, Dispel Cold',
        'Nourish Blood, Tonify Kidney'
      ]
      const weighted = weightTreatmentPrinciples(options, baseContext)
      expect(weighted.length).toBe(options.length)
    })
  })

  describe('weightAcupoints', () => {
    it('should weight acupoints for body part', () => {
      const options = ['LI15', 'LI16', 'SI9', 'SI10', 'GB21']
      const weighted = weightAcupoints(options, baseContext)
      expect(weighted.length).toBe(options.length)
    })
  })

  describe('weightMuscles', () => {
    it('should weight muscles for body part', () => {
      const options = ['upper trapezius', 'deltoid', 'supraspinatus']
      const weighted = weightMuscles(options, baseContext)
      expect(weighted.length).toBe(options.length)
    })
  })

  describe('weightAdl', () => {
    it('should weight ADL activities', () => {
      const options = ['lifting', 'reaching', 'dressing']
      const weighted = weightAdl(options, baseContext)
      expect(weighted.length).toBe(options.length)
    })
  })

  describe('weightElectricalStimulation', () => {
    it('should prefer with estim for chronic pain', () => {
      const options = ['with', 'without']
      const weighted = weightElectricalStimulation(options, baseContext)
      const withWeight = weighted.find(w => w.option === 'with')?.weight || 0
      const withoutWeight = weighted.find(w => w.option === 'without')?.weight || 0
      expect(withWeight).toBeGreaterThan(withoutWeight)
    })

    it('should prefer without estim for pacemaker', () => {
      const options = ['with', 'without']
      const weighted = weightElectricalStimulation(options, {
        ...baseContext,
        hasPacemaker: true
      })
      const withWeight = weighted.find(w => w.option === 'with')?.weight || 0
      const withoutWeight = weighted.find(w => w.option === 'without')?.weight || 0
      expect(withoutWeight).toBeGreaterThan(withWeight)
    })
  })

  describe('weightOperationTime', () => {
    it('should weight operation time based on insurance', () => {
      const options = ['15 mins', '20 mins', '30 mins']
      const weighted = weightOperationTime(options, baseContext)
      expect(weighted.length).toBe(options.length)
    })
  })

  describe('selectBestOption', () => {
    it('should select highest weighted option', () => {
      const weighted = [
        { option: 'A', weight: 10, reasons: [] },
        { option: 'B', weight: 50, reasons: [] },
        { option: 'C', weight: 30, reasons: [] }
      ]
      const best = selectBestOption(weighted)
      expect(best).toBe('B')
    })
  })

  describe('selectBestOptions', () => {
    it('should select top N options', () => {
      const weighted = [
        { option: 'A', weight: 10, reasons: [] },
        { option: 'B', weight: 50, reasons: [] },
        { option: 'C', weight: 30, reasons: [] },
        { option: 'D', weight: 40, reasons: [] }
      ]
      const best = selectBestOptions(weighted, 2)
      expect(best).toContain('B')
      expect(best).toContain('D')
      expect(best.length).toBe(2)
    })
  })

  describe('calculateWeights', () => {
    it('should calculate weights for field', () => {
      const result = calculateWeights('painTypes', ['Dull', 'Aching'], baseContext)
      expect(result.length).toBe(2)
    })
  })
})
