import {
  createContext,
  getWeightedOptions,
  applyRules,
  aggregateWeights,
  RuleContext
} from '../rule-engine'

describe('Rule Engine (Template-only)', () => {
  describe('Option filtering', () => {
    it('returns weights only for available options', () => {
      const context = createContext({ localPattern: 'Blood Stasis' })
      const availableOptions = ['Stabbing', 'Dull', 'Aching']
      const weighted = getWeightedOptions('subjective.painTypes', availableOptions, context)

      weighted.forEach(w => {
        expect(availableOptions).toContain(w.option)
      })
    })

    it('does not inject unavailable options', () => {
      const context = createContext({ localPattern: 'Blood Stasis' })
      const weighted = getWeightedOptions('subjective.painTypes', ['Dull'], context)

      expect(weighted.length).toBe(1)
      expect(weighted[0].option).toBe('Dull')
    })
  })

  describe('Template rule application', () => {
    it('applies chronicity rule to symptom duration unit', () => {
      const context = createContext({ chronicityLevel: 'Chronic' })
      const effects = applyRules(context)
      const duration = effects.filter(e => e.targetField === 'subjective.symptomDuration.unit')

      expect(duration.some(e => e.option === 'month(s)' || e.option === 'year(s)')).toBe(true)
    })

    it('applies pain-score rule to ADL difficulty', () => {
      const context = createContext({ painScore: 8 })
      const effects = applyRules(context)
      const adl = effects.filter(e => e.targetField === 'subjective.adlDifficulty.level')

      expect(adl.some(e => e.option === 'severe')).toBe(true)
    })

    it('applies TX exacerbate reason chain for weather/untreated factors', () => {
      const context: RuleContext = {
        subjective: { symptomChange: 'exacerbate of symptom(s)' }
      }
      const effects = applyRules(context)
      const reasons = effects.filter(e => e.targetField === 'subjective.reason').map(e => e.option)

      expect(reasons).toContain('exposure to cold air')
      expect(reasons).toContain('stopped treatment for a while')
      expect(reasons).toContain('discontinuous treatment')
    })

    it('applies TX connector for exacerbate chain', () => {
      const context: RuleContext = {
        subjective: { symptomChange: 'exacerbate of symptom(s)' }
      }
      const effects = applyRules(context)
      const connectors = effects.filter(e => e.targetField === 'subjective.reasonConnector').map(e => e.option)

      expect(connectors).toEqual(expect.arrayContaining(['due to', 'because of']))
    })

    it('applies chronic duration value chain for long-standing condition', () => {
      const context = createContext({ chronicityLevel: 'Chronic' })
      const weighted = getWeightedOptions(
        'subjective.symptomDuration.value',
        ['1', '2', '3', 'many', 'more than 10'],
        context
      )

      expect(['many', 'more than 10']).toContain(weighted[0].option)
      expect(weighted[0].weight).toBeGreaterThan(50)
    })

  })

  describe('Weight aggregation', () => {
    it('aggregates multiple effects by field/option', () => {
      const context = createContext({
        localPattern: 'Blood Stasis',
        systemicPattern: 'Kidney Yang Deficiency',
        chronicityLevel: 'Chronic'
      })

      const effects = applyRules(context)
      const aggregated = aggregateWeights(effects)

      expect(aggregated['subjective.painTypes']).toBeDefined()
      const painTypes = aggregated['subjective.painTypes']
      if (painTypes['Stabbing']) {
        expect(painTypes['Stabbing'].totalWeight).toBeGreaterThan(0)
      }
    })
  })

  describe('Edge cases', () => {
    it('handles empty context gracefully', () => {
      const context: RuleContext = {}
      const effects = applyRules(context)
      expect(effects).toEqual([])
    })

    it('returns base weights when no rule matches', () => {
      const context = createContext({})
      const weighted = getWeightedOptions('subjective.painTypes', ['Dull', 'Aching'], context)

      expect(weighted.length).toBe(2)
      expect(weighted[0].weight).toBe(50)
      expect(weighted[1].weight).toBe(50)
    })

    it('handles non-existent field path', () => {
      const context = createContext({ localPattern: 'Blood Stasis' })
      const weighted = getWeightedOptions('nonexistent.field.path', ['option1', 'option2'], context)

      expect(weighted.length).toBe(2)
      weighted.forEach(w => {
        expect(w.weight).toBe(50)
        expect(w.reasons).toEqual([])
      })
    })
  })

  describe('Integration scenarios', () => {
    it('ranks Blood Stasis-compatible pain types first', () => {
      const context = createContext({
        localPattern: 'Blood Stasis',
        systemicPattern: 'Kidney Yang Deficiency',
        chronicityLevel: 'Chronic',
        painScore: 8
      })

      const weighted = getWeightedOptions(
        'subjective.painTypes',
        ['Dull', 'Aching', 'Stabbing', 'Shooting', 'Freezing', 'cold', 'pricking'],
        context
      )

      expect(weighted[0].weight).toBeGreaterThan(50)
      expect(['Stabbing', 'Freezing', 'cold', 'pricking', 'Aching', 'Dull']).toContain(weighted[0].option)
    })

    it('favors acute duration unit for acute context', () => {
      const context = createContext({ chronicityLevel: 'Acute' })
      const weighted = getWeightedOptions(
        'subjective.symptomDuration.unit',
        ['day(s)', 'week(s)', 'month(s)', 'year(s)'],
        context
      )

      expect(['day(s)', 'week(s)']).toContain(weighted[0].option)
      expect(weighted[0].weight).toBeGreaterThan(50)
    })
  })
})
