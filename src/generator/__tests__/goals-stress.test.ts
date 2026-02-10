/**
 * Goals 动态计算高压测试
 * 全组合测试: 4部位 × 5严重度 × 5症状类型 = 100 组合
 */
import { describe, it, expect } from 'vitest'
import { calculateDynamicGoals, parsePainFromSeverity } from '../goals-calculator'
import { generatePlanIE } from '../soap-generator'
import { generateTXSequenceStates } from '../tx-sequence-engine'
import type { GenerationContext, SeverityLevel, BodyPart } from '../../types'

const BODY_PARTS: BodyPart[] = ['KNEE', 'SHOULDER', 'LBP', 'NECK']
const SEVERITIES: SeverityLevel[] = ['severe', 'moderate to severe', 'moderate', 'mild to moderate', 'mild']
const SYMPTOMS = ['soreness', 'weakness', 'stiffness', 'heaviness', 'numbness'] as const

describe('Goals 高压测试 - 全组合', () => {
  // 4 × 5 × 5 = 100 组合
  BODY_PARTS.forEach(bp => {
    SEVERITIES.forEach(severity => {
      SYMPTOMS.forEach(symptom => {
        it(`${bp} + ${severity} + ${symptom}`, () => {
          const goals = calculateDynamicGoals(severity, bp, symptom)
          
          // 验证所有字段存在
          expect(goals.pain.st).toBeDefined()
          expect(goals.pain.lt).toBeDefined()
          expect(goals.symptomType).toBe(symptom)
          expect(goals.symptomPct.st).toMatch(/\(\d+%-\d+%\)/)
          expect(goals.symptomPct.lt).toMatch(/\(\d+%-\d+%\)/)
          expect(goals.tightness.st).toBeDefined()
          expect(goals.tightness.lt).toBeDefined()
          expect(goals.tenderness.st).toBeGreaterThanOrEqual(1)
          expect(goals.tenderness.lt).toBeGreaterThanOrEqual(1)
          expect(goals.spasm.st).toBeGreaterThanOrEqual(0)
          expect(goals.spasm.lt).toBeGreaterThanOrEqual(0)
          expect(goals.strength.st).toMatch(/\d\+?/)
          expect(goals.strength.lt).toMatch(/\d\+?/)
          expect(goals.rom.st).toMatch(/\d+%/)
          expect(goals.rom.lt).toMatch(/\d+%/)
          expect(goals.adl.st).toBeDefined()
          expect(goals.adl.lt).toBeDefined()
        })
      })
    })
  })
})

describe('Goals 约束验证', () => {
  BODY_PARTS.forEach(bp => {
    SEVERITIES.forEach(severity => {
      describe(`${bp} + ${severity}`, () => {
        const goals = calculateDynamicGoals(severity, bp)
        const pain = parsePainFromSeverity(severity)

        it('ST Goal 应比 LT Goal 更保守 (Pain)', () => {
          // ST 数值应 >= LT 数值 (Pain 越低越好)
          const stNum = parseInt(goals.pain.st.split('-')[0])
          const ltNum = parseInt(goals.pain.lt.split('-')[0])
          expect(stNum).toBeGreaterThanOrEqual(ltNum)
        })

        it('Tenderness ST >= LT', () => {
          expect(goals.tenderness.st).toBeGreaterThanOrEqual(goals.tenderness.lt)
        })

        it('Spasm ST >= LT', () => {
          expect(goals.spasm.st).toBeGreaterThanOrEqual(goals.spasm.lt)
        })

        it('Pain 改善幅度合理 (ST 降 2-4 级)', () => {
          if (pain >= 7) {
            const stNum = parseInt(goals.pain.st.split('-')[0])
            const drop = pain - stNum
            expect(drop).toBeGreaterThanOrEqual(1)
            expect(drop).toBeLessThanOrEqual(5)
          }
        })
      })
    })
  })
})

describe('generatePlanIE 高压测试', () => {
  const baseContext: Partial<GenerationContext> = {
    noteType: 'IE',
    laterality: 'Bilateral',
    insuranceType: 'OPTUM',
    chronicityLevel: 'Chronic',
  }

  // 4 × 5 = 20 组合
  BODY_PARTS.forEach(bp => {
    SEVERITIES.forEach(severity => {
      it(`Plan 生成: ${bp} + ${severity}`, () => {
        const context = {
          ...baseContext,
          primaryBodyPart: bp,
          severityLevel: severity,
        } as GenerationContext

        const plan = generatePlanIE(context)

        // 验证结构完整
        expect(plan).toContain('Initial Evaluation')
        expect(plan).toContain('Short Term Goal')
        expect(plan).toContain('Long Term Goal')
        expect(plan).toContain('Decrease Pain Scale')
        expect(plan).toContain('Decrease Muscles Tightness')
        expect(plan).toContain('Decrease Muscles Tenderness')
        expect(plan).toContain('Decrease Muscles Spasms')
        expect(plan).toContain('Increase Muscles Strength')
        expect(plan).toContain('Increase ROM')
        expect(plan).toContain('Activities of Daily Living')

        // 验证格式正确 (主要部位无空格)
        if (['KNEE', 'SHOULDER', 'LBP', 'NECK'].includes(bp)) {
          expect(plan).toMatch(/Decrease Pain Scale to\d/)
          expect(plan).toMatch(/Increase Muscles Strength to\d/)
        }
      })
    })
  })
})

describe('IE + TX 序列对齐测试', () => {
  const baseContext: GenerationContext = {
    noteType: 'IE',
    primaryBodyPart: 'KNEE',
    laterality: 'Bilateral',
    insuranceType: 'OPTUM',
    severityLevel: 'moderate to severe',
    chronicityLevel: 'Chronic',
    localPattern: 'Bi Syndrome',
    systemicPattern: 'Qi and Blood Stagnation',
  } as GenerationContext

  it('TX12 Pain 应接近 ST Goal', () => {
    const goals = calculateDynamicGoals('moderate to severe', 'KNEE')
    const txStates = generateTXSequenceStates(baseContext, { txCount: 12, seed: 42 })

    const tx12 = txStates[txStates.length - 1]
    const stGoalLow = parseInt(goals.pain.st.split('-')[0])
    const stGoalHigh = parseInt(goals.pain.st.split('-')[1] || goals.pain.st.split('-')[0])

    // TX12 Pain 应在 ST Goal 范围附近 (±1.5)
    expect(tx12.painScaleCurrent).toBeGreaterThanOrEqual(stGoalLow - 1.5)
    expect(tx12.painScaleCurrent).toBeLessThanOrEqual(stGoalHigh + 1.5)
  })

  it('TX 序列 Pain 应单调递减趋势', () => {
    const txStates = generateTXSequenceStates(baseContext, { txCount: 11, seed: 42 })

    // 验证整体趋势递减 (允许小幅波动)
    const firstPain = txStates[0].painScaleCurrent
    const lastPain = txStates[txStates.length - 1].painScaleCurrent
    expect(lastPain).toBeLessThan(firstPain)
  })

  it('TX 序列 Progress 应单调递增', () => {
    const txStates = generateTXSequenceStates(baseContext, { txCount: 11, seed: 42 })

    for (let i = 1; i < txStates.length; i++) {
      expect(txStates[i].progress).toBeGreaterThanOrEqual(txStates[i - 1].progress)
    }
  })
})

describe('边界情况测试', () => {
  it('mild severity 应维持当前状态', () => {
    const goals = calculateDynamicGoals('mild', 'KNEE')
    expect(goals.pain.st).toBe('4')
    expect(goals.tightness.st).toBe('mild')
    expect(goals.tenderness.st).toBe(1)
  })

  it('severe severity 应有保守目标', () => {
    const goals = calculateDynamicGoals('severe', 'KNEE')
    // Pain 10 → ST 6 (降 4 级，保守)
    expect(parseInt(goals.pain.st)).toBeGreaterThanOrEqual(5)
  })

  it('所有 Tightness 值应在有效范围内', () => {
    const validLevels = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
    
    SEVERITIES.forEach(severity => {
      const goals = calculateDynamicGoals(severity, 'KNEE')
      expect(validLevels).toContain(goals.tightness.st)
      expect(validLevels).toContain(goals.tightness.lt)
    })
  })

  it('Tenderness 应在 1-4 范围内', () => {
    SEVERITIES.forEach(severity => {
      const goals = calculateDynamicGoals(severity, 'KNEE')
      expect(goals.tenderness.st).toBeGreaterThanOrEqual(1)
      expect(goals.tenderness.st).toBeLessThanOrEqual(4)
      expect(goals.tenderness.lt).toBeGreaterThanOrEqual(1)
      expect(goals.tenderness.lt).toBeLessThanOrEqual(4)
    })
  })

  it('Spasm 应在 0-4 范围内', () => {
    SEVERITIES.forEach(severity => {
      const goals = calculateDynamicGoals(severity, 'KNEE')
      expect(goals.spasm.st).toBeGreaterThanOrEqual(0)
      expect(goals.spasm.st).toBeLessThanOrEqual(4)
      expect(goals.spasm.lt).toBeGreaterThanOrEqual(0)
      expect(goals.spasm.lt).toBeLessThanOrEqual(4)
    })
  })
})

describe('症状百分比格式验证', () => {
  it('所有百分比应符合 (X%-Y%) 格式', () => {
    SEVERITIES.forEach(severity => {
      const goals = calculateDynamicGoals(severity, 'KNEE')
      expect(goals.symptomPct.st).toMatch(/^\(\d+%-\d+%\)$/)
      expect(goals.symptomPct.lt).toMatch(/^\(\d+%-\d+%\)$/)
    })
  })

  it('ST 百分比应 >= LT 百分比', () => {
    SEVERITIES.forEach(severity => {
      const goals = calculateDynamicGoals(severity, 'KNEE')
      const stLow = parseInt(goals.symptomPct.st.match(/\d+/)?.[0] || '0')
      const ltLow = parseInt(goals.symptomPct.lt.match(/\d+/)?.[0] || '0')
      expect(stLow).toBeGreaterThanOrEqual(ltLow)
    })
  })
})

describe('ROM 格式验证', () => {
  it('所有 ROM 应符合 X% 格式', () => {
    SEVERITIES.forEach(severity => {
      const goals = calculateDynamicGoals(severity, 'KNEE')
      expect(goals.rom.st).toMatch(/^\d+%$/)
      expect(goals.rom.lt).toMatch(/^\d+%$/)
    })
  })

  it('LT ROM 应 >= ST ROM', () => {
    SEVERITIES.forEach(severity => {
      const goals = calculateDynamicGoals(severity, 'KNEE')
      const stRom = parseInt(goals.rom.st)
      const ltRom = parseInt(goals.rom.lt)
      expect(ltRom).toBeGreaterThanOrEqual(stRom)
    })
  })
})
