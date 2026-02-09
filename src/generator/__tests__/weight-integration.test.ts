import {
  toRuleContext,
  selectDurationUnit,
  selectADLDifficultyLevel,
  selectElectricalStimulation,
  selectOperationTime,
  type GeneratorContext
} from '../weight-integration'

const baseCtx: GeneratorContext = {
  noteType: 'IE',
  insuranceType: 'WC',
  bodyPart: 'KNEE',
  laterality: 'bilateral',
  chronicityLevel: 'Chronic',
  painScore: 8,
  severityLevel: 'moderate to severe',
  localPattern: 'Blood Stasis',
  systemicPattern: 'Kidney Yang Deficiency'
}

describe('weight-integration (template boundary)', () => {
  it('maps generator context into nested rule context', () => {
    const ruleCtx = toRuleContext(baseCtx)

    expect(ruleCtx.header?.noteType).toBe('IE')
    expect(ruleCtx.header?.insuranceType).toBe('WC')
    expect(ruleCtx.subjective?.chronicityLevel).toBe('Chronic')
    expect(ruleCtx.assessment?.tcmDiagnosis?.localPattern).toBe('Blood Stasis')
    expect(ruleCtx.assessment?.tcmDiagnosis?.systemicPattern).toBe('Kidney Yang Deficiency')
  })

  it('selects chronic duration unit from template options', () => {
    const unit = selectDurationUnit(['day(s)', 'week(s)', 'month(s)', 'year(s)'], baseCtx)
    expect(['month(s)', 'year(s)']).toContain(unit)
  })

  it('selects severe ADL level for high pain score', () => {
    const level = selectADLDifficultyLevel(
      ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe'],
      baseCtx
    )
    expect(['moderate to severe', 'severe']).toContain(level)
  })

  it('forces without electrical stimulation for pacemaker', () => {
    const choice = selectElectricalStimulation(['with', 'without'], {
      ...baseCtx,
      hasPacemaker: true
    })
    expect(choice).toBe('without')
  })

  it('forces 15 minutes for HF/OPTUM', () => {
    const time = selectOperationTime(['15', '30', '45', '60'], {
      ...baseCtx,
      insuranceType: 'HF'
    })
    expect(time).toBe('15')
  })
})

