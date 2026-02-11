/**
 * Goals 动态计算测试
 * 多部位、多阶段 SOAP 生成功能测试
 */

import { calculateDynamicGoals, parsePainFromSeverity, calculateIEPainScale } from '../goals-calculator'
import { generatePlanIE } from '../soap-generator'
import type { GenerationContext, SeverityLevel, BodyPart } from '../../types'

describe('goals-calculator', () => {
  describe('parsePainFromSeverity', () => {
    it('should map severity to pain correctly', () => {
      expect(parsePainFromSeverity('severe')).toBe(10)
      expect(parsePainFromSeverity('moderate to severe')).toBe(8)
      expect(parsePainFromSeverity('moderate')).toBe(7)
      expect(parsePainFromSeverity('mild to moderate')).toBe(5)
      expect(parsePainFromSeverity('mild')).toBe(4)
    })
  })

  describe('calculateIEPainScale', () => {
    it('should return correct pain scale for KNEE', () => {
      const scale = calculateIEPainScale('moderate to severe', 'KNEE')
      expect(scale.worst).toBe('8')
      expect(scale.best).toBe('6')
      expect(scale.current).toBe('8')
    })

    it('should return correct pain scale for SHOULDER', () => {
      const scale = calculateIEPainScale('moderate to severe', 'SHOULDER')
      expect(scale.worst).toBe('7')
      expect(scale.best).toBe('6')
      expect(scale.current).toBe('7-6')
    })
  })

  describe('calculateDynamicGoals - Pain', () => {
    it('moderate to severe (Pain 8) should have ST 5-6, LT 2-3', () => {
      const goals = calculateDynamicGoals('moderate to severe', 'KNEE')
      expect(goals.pain.st).toBe('5-6')
      expect(goals.pain.lt).toBe('2-3')
    })

    it('severe (Pain 10) should have ST 6, LT 3-4', () => {
      const goals = calculateDynamicGoals('severe', 'KNEE')
      expect(goals.pain.st).toBe('6')
      expect(goals.pain.lt).toBe('3-4')
    })

    it('moderate (Pain 7) should have ST 4, LT 2-3', () => {
      const goals = calculateDynamicGoals('moderate', 'KNEE')
      expect(goals.pain.st).toBe('4')
      expect(goals.pain.lt).toBe('2-3')
    })

    it('mild (Pain 4) should maintain current level', () => {
      const goals = calculateDynamicGoals('mild', 'KNEE')
      expect(goals.pain.st).toBe('4')
      expect(goals.pain.lt).toBe('2')
    })
  })

  describe('calculateDynamicGoals - Symptom Type', () => {
    it('should use default soreness when not specified', () => {
      const goals = calculateDynamicGoals('moderate to severe', 'KNEE')
      expect(goals.symptomType).toBe('soreness')
    })

    it('should use specified symptom type', () => {
      const goals = calculateDynamicGoals('moderate to severe', 'KNEE', 'weakness')
      expect(goals.symptomType).toBe('weakness')
    })

    it('should support all symptom types', () => {
      const types = ['soreness', 'weakness', 'stiffness', 'heaviness', 'numbness']
      types.forEach(type => {
        const goals = calculateDynamicGoals('moderate to severe', 'KNEE', type)
        expect(goals.symptomType).toBe(type)
      })
    })
  })

  describe('calculateDynamicGoals - Symptom Percentage', () => {
    it('moderate to severe should have ST (50%-60%), LT (20%-30%)', () => {
      const goals = calculateDynamicGoals('moderate to severe', 'KNEE')
      expect(goals.symptomPct.st).toBe('(50%-60%)')
      expect(goals.symptomPct.lt).toBe('(20%-30%)')
    })

    it('severe should have ST (60%-70%), LT (30%-40%)', () => {
      const goals = calculateDynamicGoals('severe', 'KNEE')
      expect(goals.symptomPct.st).toBe('(60%-70%)')
      expect(goals.symptomPct.lt).toBe('(30%-40%)')
    })
  })

  describe('calculateDynamicGoals - Tightness', () => {
    it('moderate to severe should have ST moderate, LT mild', () => {
      const goals = calculateDynamicGoals('moderate to severe', 'KNEE')
      expect(goals.tightness.st).toBe('moderate')
      expect(goals.tightness.lt).toBe('mild')
    })

    it('severe should have ST moderate to severe, LT mild to moderate', () => {
      const goals = calculateDynamicGoals('severe', 'KNEE')
      expect(goals.tightness.st).toBe('moderate to severe')
      expect(goals.tightness.lt).toBe('mild to moderate')
    })
  })

  describe('calculateDynamicGoals - Tenderness', () => {
    it('moderate to severe should have ST 3, LT 1', () => {
      const goals = calculateDynamicGoals('moderate to severe', 'KNEE')
      expect(goals.tenderness.st).toBe(3)
      expect(goals.tenderness.lt).toBe(1)
    })

    it('severe should have ST 3, LT 1', () => {
      const goals = calculateDynamicGoals('severe', 'KNEE')
      expect(goals.tenderness.st).toBe(3)
      expect(goals.tenderness.lt).toBe(1)
    })
  })

  describe('calculateDynamicGoals - Spasm', () => {
    it('should have ST 2, LT 0', () => {
      const goals = calculateDynamicGoals('moderate to severe', 'KNEE')
      expect(goals.spasm.st).toBe(2)
      expect(goals.spasm.lt).toBe(0)
    })
  })

  describe('calculateDynamicGoals - Strength', () => {
    it('should have ST 4, LT 4+', () => {
      const goals = calculateDynamicGoals('moderate to severe', 'KNEE')
      expect(goals.strength.st).toBe('4')
      expect(goals.strength.lt).toBe('4+')
    })
  })

  describe('calculateDynamicGoals - ROM', () => {
    it('moderate to severe should have ST 60%, LT 80%', () => {
      const goals = calculateDynamicGoals('moderate to severe', 'KNEE')
      expect(goals.rom.st).toBe('60%')
      expect(goals.rom.lt).toBe('80%')
    })

    it('severe should have ST 50%, LT 70%', () => {
      const goals = calculateDynamicGoals('severe', 'KNEE')
      expect(goals.rom.st).toBe('50%')
      expect(goals.rom.lt).toBe('70%')
    })
  })

  describe('calculateDynamicGoals - ADL', () => {
    it('should sync with Tightness', () => {
      const goals = calculateDynamicGoals('moderate to severe', 'KNEE')
      expect(goals.adl.st).toBe('moderate')
      expect(goals.adl.lt).toBe('mild')
    })
  })
})

describe('generatePlanIE - Multi Body Part', () => {
  const baseContext: Partial<GenerationContext> = {
    noteType: 'IE',
    laterality: 'bilateral',
    insuranceType: 'OPTUM',
    severityLevel: 'moderate to severe',
    chronicityLevel: 'Chronic',
  }

  const bodyParts: BodyPart[] = ['KNEE', 'SHOULDER', 'LBP', 'NECK']

  bodyParts.forEach(bp => {
    describe(`${bp}`, () => {
      it('should generate valid Plan with dynamic Goals', () => {
        const context = { ...baseContext, primaryBodyPart: bp } as GenerationContext
        const plan = generatePlanIE(context)

        // 验证 ST Goals
        expect(plan).toContain('Short Term Goal')
        expect(plan).toContain('Decrease Pain Scale to5-6.')
        expect(plan).toContain('Decrease soreness sensation Scale to (50%-60%)')
        expect(plan).toContain('Decrease Muscles Tightness to moderate')
        expect(plan).toContain('Decrease Muscles Tenderness to Grade 3')
        expect(plan).toContain('Decrease Muscles Spasms to Grade 2')
        expect(plan).toContain('Increase Muscles Strength to4')

        // 验证 LT Goals
        expect(plan).toContain('Long Term Goal')
        expect(plan).toContain('Decrease Pain Scale to2-3')
        expect(plan).toContain('Decrease soreness sensation Scale to (20%-30%)')
        expect(plan).toContain('Decrease Muscles Tightness to mild')
        expect(plan).toContain('Decrease Muscles Tenderness to Grade 1')
        expect(plan).toContain('Decrease Muscles Spasms to Grade 0')
        expect(plan).toContain('Increase Muscles Strength to4+')
        expect(plan).toContain('Increase ROM 80%')
        expect(plan).toContain('Decrease impaired Activities of Daily Living to mild.')
      })
    })
  })
})

describe('generatePlanIE - Multi Severity', () => {
  const severities: SeverityLevel[] = [
    'severe',
    'moderate to severe',
    'moderate',
    'mild to moderate',
    'mild'
  ]

  severities.forEach(severity => {
    it(`should generate valid Plan for ${severity}`, () => {
      const context: GenerationContext = {
        noteType: 'IE',
        primaryBodyPart: 'KNEE',
        laterality: 'bilateral',
        insuranceType: 'OPTUM',
        severityLevel: severity,
        chronicityLevel: 'Chronic',
      } as GenerationContext

      const plan = generatePlanIE(context)

      expect(plan).toContain('Short Term Goal')
      expect(plan).toContain('Long Term Goal')
      expect(plan).toContain('Decrease Pain Scale')
      expect(plan).toContain('Decrease Muscles Tightness')
    })
  })
})

describe('generatePlanIE - Symptom Types', () => {
  const symptomTypes = ['soreness', 'weakness', 'stiffness', 'heaviness', 'numbness']

  symptomTypes.forEach(symptom => {
    it(`should use ${symptom} in Plan`, () => {
      const context: GenerationContext = {
        noteType: 'IE',
        primaryBodyPart: 'KNEE',
        laterality: 'bilateral',
        insuranceType: 'OPTUM',
        severityLevel: 'moderate to severe',
        chronicityLevel: 'Chronic',
        associatedSymptom: symptom,
      } as GenerationContext

      const plan = generatePlanIE(context)

      expect(plan).toContain(`Decrease ${symptom} sensation Scale to`)
    })
  })
})

describe('Goals ST-LT Gap Validation', () => {
  it('Pain gap should be 3-4 levels for moderate to severe', () => {
    const goals = calculateDynamicGoals('moderate to severe', 'KNEE')
    // ST: 5-6 (avg 5.5), LT: 2-3 (avg 2.5), gap = 3
    expect(goals.pain.st).toBe('5-6')
    expect(goals.pain.lt).toBe('2-3')
  })

  it('Tenderness gap should be 2 grades', () => {
    const goals = calculateDynamicGoals('moderate to severe', 'KNEE')
    expect(goals.tenderness.st - goals.tenderness.lt).toBe(2)
  })

  it('Tightness gap should be 2 levels', () => {
    const goals = calculateDynamicGoals('moderate to severe', 'KNEE')
    expect(goals.tightness.st).toBe('moderate')
    expect(goals.tightness.lt).toBe('mild')
  })

  it('Spasm gap should be 2 grades', () => {
    const goals = calculateDynamicGoals('moderate to severe', 'KNEE')
    expect(goals.spasm.st - goals.spasm.lt).toBe(2)
  })
})
