import {
  normalizeGenerationContext,
  type NormalizeInput,
} from '../normalize-generation-context'
import type { BodyPart } from '../../types'

const baseInput: NormalizeInput = {
  noteType: 'TX',
  insuranceType: 'OPTUM',
  primaryBodyPart: 'LBP',
  laterality: 'bilateral',
  painCurrent: 8,
  severityLevel: 'moderate to severe',
}

describe('normalizeGenerationContext', () => {
  describe('TCM inference path', () => {
    it('derives localPattern + systemicPattern when not provided', () => {
      const { context } = normalizeGenerationContext(baseInput)
      expect(context.localPattern).toBeDefined()
      expect(context.systemicPattern).toBeDefined()
      expect(typeof context.localPattern).toBe('string')
      expect(typeof context.systemicPattern).toBe('string')
    })

    it('falls back to Qi Stagnation / Kidney Yang Deficiency when inference returns empty', () => {
      const { context } = normalizeGenerationContext({
        ...baseInput,
        painTypes: [],
        associatedSymptoms: [],
      })
      expect(typeof context.localPattern).toBe('string')
      expect(typeof context.systemicPattern).toBe('string')
    })
  })

  describe('compose override priority', () => {
    it('user-selected localPattern wins over inference', () => {
      const { context } = normalizeGenerationContext({
        ...baseInput,
        localPattern: 'Blood Stasis',
      })
      expect(context.localPattern).toBe('Blood Stasis')
    })

    it('user-selected systemicPattern wins over inference', () => {
      const { context } = normalizeGenerationContext({
        ...baseInput,
        systemicPattern: 'Liver Qi Stagnation',
      })
      expect(context.systemicPattern).toBe('Liver Qi Stagnation')
    })
  })

  describe('initialState canonical formula (painCurrent >= 7 ? 3 : 2)', () => {
    it.each([
      [3, 2],
      [6, 2],
      [7, 3],
      [9, 3],
      [10, 3],
    ])('painCurrent=%i → level=%i', (pain, expected) => {
      const { initialState } = normalizeGenerationContext({
        ...baseInput,
        painCurrent: pain,
        severityLevel: pain >= 7 ? 'severe' : 'moderate',
      })
      expect(initialState.tightness).toBe(expected)
      expect(initialState.tenderness).toBe(expected)
      expect(initialState.spasm).toBe(expected)
    })

    it('explicit tightness/tenderness/spasm overrides the formula', () => {
      const { initialState } = normalizeGenerationContext({
        ...baseInput,
        painCurrent: 9,
        tightness: 1,
        tenderness: 2,
        spasm: 0,
      })
      expect(initialState.tightness).toBe(1)
      expect(initialState.tenderness).toBe(2)
      expect(initialState.spasm).toBe(0)
    })
  })

  describe('associatedSymptoms single vs array', () => {
    it('single associatedSymptom → output array with one element', () => {
      const { context } = normalizeGenerationContext({
        ...baseInput,
        associatedSymptom: 'weakness',
      })
      expect(context.associatedSymptoms).toEqual(['weakness'])
    })

    it('associatedSymptoms array is passed through (batch path)', () => {
      const { context } = normalizeGenerationContext({
        ...baseInput,
        associatedSymptoms: ['weakness', 'numbness'],
      })
      expect(context.associatedSymptoms).toEqual(['weakness', 'numbness'])
    })

    it('default to soreness when neither provided', () => {
      const { context, initialState } = normalizeGenerationContext(baseInput)
      expect(context.associatedSymptoms).toEqual(['soreness'])
      expect(initialState.associatedSymptom).toBe('soreness')
    })
  })

  describe('frequencyFromText branches', () => {
    it.each([
      ['Constant pain throughout the day', 3],
      ['Frequent episodes', 2],
      ['Occasional flare-ups', 1],
      ['Intermittent symptoms', 0],
      ['Unknown text', 3],
    ])('painFrequency=%p → frequency=%i', (freqText, expected) => {
      const { initialState } = normalizeGenerationContext({
        ...baseInput,
        painFrequency: freqText,
      })
      expect(initialState.frequency).toBe(expected)
    })

    it('undefined painFrequency → default 3', () => {
      const { initialState } = normalizeGenerationContext(baseInput)
      expect(initialState.frequency).toBe(3)
    })

    it('explicit frequency input wins over text', () => {
      const { initialState } = normalizeGenerationContext({
        ...baseInput,
        painFrequency: 'Constant',
        frequency: 1,
      })
      expect(initialState.frequency).toBe(1)
    })
  })

  describe('hasPacemaker derivation', () => {
    it('medicalHistory with Pacemaker → hasPacemaker=true', () => {
      const { context } = normalizeGenerationContext({
        ...baseInput,
        medicalHistory: ['Hypertension', 'Pacemaker'],
      })
      expect(context.hasPacemaker).toBe(true)
    })

    it('medicalHistory without Pacemaker → hasPacemaker=false', () => {
      const { context } = normalizeGenerationContext({
        ...baseInput,
        medicalHistory: ['Diabetes', 'Hypertension'],
      })
      expect(context.hasPacemaker).toBe(false)
    })

    it('no medicalHistory → hasPacemaker=false', () => {
      const { context } = normalizeGenerationContext(baseInput)
      expect(context.hasPacemaker).toBe(false)
    })
  })

  describe('hasMetalImplant derivation', () => {
    it('Metal Implant → hasMetalImplant=true', () => {
      const { context } = normalizeGenerationContext({
        ...baseInput,
        medicalHistory: ['Metal Implant'],
      })
      expect(context.hasMetalImplant).toBe(true)
    })

    it('Joint Replacement → hasMetalImplant=true', () => {
      const { context } = normalizeGenerationContext({
        ...baseInput,
        medicalHistory: ['Joint Replacement'],
      })
      expect(context.hasMetalImplant).toBe(true)
    })

    it('neither → hasMetalImplant=false', () => {
      const { context } = normalizeGenerationContext({
        ...baseInput,
        medicalHistory: ['Diabetes'],
      })
      expect(context.hasMetalImplant).toBe(false)
    })
  })

  describe('immutability (modifying input does not affect output)', () => {
    it('mutating input.medicalHistory after normalize does not affect output', () => {
      const history = ['Diabetes']
      const { context } = normalizeGenerationContext({
        ...baseInput,
        medicalHistory: history,
      })
      ;(history as string[]).push('Pacemaker')
      expect(context.medicalHistory).toEqual(['Diabetes'])
      expect(context.hasPacemaker).toBe(false)
    })

    it('mutating input.secondaryBodyParts after normalize does not affect output', () => {
      const bps: BodyPart[] = ['LBP']
      const { context } = normalizeGenerationContext({
        ...baseInput,
        secondaryBodyParts: bps,
      })
      bps.push('NECK')
      expect(context.secondaryBodyParts).toEqual(['LBP'])
    })

    it('mutating input.symptomDuration after normalize does not affect output', () => {
      const dur = { value: '3', unit: 'weeks' }
      const { context } = normalizeGenerationContext({
        ...baseInput,
        symptomDuration: dur,
      })
      dur.value = '99'
      expect(context.symptomDuration).toEqual({ value: '3', unit: 'weeks' })
    })

    it('mutating input.recentWorse after normalize does not affect output', () => {
      const rw = { value: '2', unit: 'days' }
      const { context } = normalizeGenerationContext({
        ...baseInput,
        recentWorse: rw,
      })
      rw.value = '99'
      expect(context.recentWorse).toEqual({ value: '2', unit: 'days' })
    })

    it('mutating input.causativeFactors/relievingFactors/exacerbatingFactors does not leak', () => {
      const causative = ['lifting']
      const relieving = ['rest']
      const exacerbating = ['bending']
      const { context } = normalizeGenerationContext({
        ...baseInput,
        causativeFactors: causative,
        relievingFactors: relieving,
        exacerbatingFactors: exacerbating,
      })
      causative.push('extra')
      relieving.push('extra')
      exacerbating.push('extra')
      expect(context.causativeFactors).toEqual(['lifting'])
      expect(context.relievingFactors).toEqual(['rest'])
      expect(context.exacerbatingFactors).toEqual(['bending'])
    })

    it('mutating input.painTypes does not affect output', () => {
      const pt = ['Dull']
      const { context, initialState } = normalizeGenerationContext({
        ...baseInput,
        painTypes: pt,
      })
      pt.push('Sharp')
      expect(context.painTypes).toEqual(['Dull'])
      expect(initialState.painTypes).toEqual(['Dull'])
    })
  })
})
