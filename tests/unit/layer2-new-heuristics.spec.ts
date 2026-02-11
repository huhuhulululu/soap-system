/**
 * Layer 2 新增启发式规则测试 (HS06-HS10)
 * 验证中医证型与舌脉象、ADL与疼痛的逻辑一致性
 */
import { MedicalLogicChecker } from '../../src/auditor'

describe('Layer 2: 新增启发式规则 (HS06-HS10)', () => {
  let checker: MedicalLogicChecker

  beforeEach(() => {
    checker = new MedicalLogicChecker()
  })

  describe('HS06: 气虚证-舌象矛盾', () => {
    it('Qi Deficiency + 红舌 触发 MEDIUM warning', () => {
      const note = {
        systemicPattern: 'Spleen Qi Deficiency',
        tongue: 'Red with yellow coating',
        pulse: 'Weak, thready'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(1)
      expect(result.concerns[0].ruleId).toBe('HS06')
      expect(result.concerns[0].severity).toBe('MEDIUM')
      expect(result.concerns[0].detail).toContain('Qi Deficiency')
      expect(result.concerns[0].detail).toContain('Red with yellow coating')
      expect(result.concerns[0].reasoning).toContain('气虚证典型舌象应为淡舌薄白苔')
      expect(result.concerns[0].suggestion).toContain('建议复核证型诊断或舌象描述')
      expect(result.concerns[0].confidence).toBe(0.78)
    })

    it('Qi Deficiency + 黄苔 触发 MEDIUM warning', () => {
      const note = {
        systemicPattern: 'Kidney Qi Deficiency',
        tongue: 'Pale with yellow thick coating',
        pulse: 'Deep, weak'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(1)
      expect(result.concerns[0].ruleId).toBe('HS06')
      expect(result.concerns[0].severity).toBe('MEDIUM')
      expect(result.concerns[0].confidence).toBe(0.78)
    })

    it('Qi Deficiency + 淡舌薄白苔 PASS', () => {
      const note = {
        systemicPattern: 'Spleen Qi Deficiency',
        tongue: 'Pale, thin white coating',
        pulse: 'Weak'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })

    it('非 Qi Deficiency 证型不触发', () => {
      const note = {
        systemicPattern: 'Liver Qi Stagnation',
        tongue: 'Red with yellow coating',
        pulse: 'Wiry'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })

    it('缺失 tongue 字段不触发', () => {
      const note = {
        systemicPattern: 'Qi Deficiency',
        pulse: 'Weak'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })
  })

  describe('HS07: 血瘀证-舌象矛盾', () => {
    it('Blood Stasis + 淡舌 触发 MEDIUM warning', () => {
      const note = {
        localPattern: 'Blood Stasis',
        tongue: 'Pale, thin coating',
        pulse: 'Choppy'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(1)
      expect(result.concerns[0].ruleId).toBe('HS07')
      expect(result.concerns[0].severity).toBe('MEDIUM')
      expect(result.concerns[0].detail).toContain('Blood Stasis')
      expect(result.concerns[0].detail).toContain('Pale')
      expect(result.concerns[0].reasoning).toContain('血瘀证典型舌象应为紫暗舌或舌有瘀点')
      expect(result.concerns[0].suggestion).toContain('建议复核证型诊断或舌象描述')
      expect(result.concerns[0].confidence).toBe(0.80)
    })

    it('Blood Stasis + light tongue 触发 MEDIUM warning', () => {
      const note = {
        localPattern: 'Qi-Blood Stasis',
        tongue: 'Light pink, no coating',
        pulse: 'Wiry, choppy'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(1)
      expect(result.concerns[0].ruleId).toBe('HS07')
      expect(result.concerns[0].severity).toBe('MEDIUM')
    })

    it('Blood Stasis + 紫暗舌 PASS', () => {
      const note = {
        localPattern: 'Blood Stasis',
        tongue: 'Purple, dark with petechiae',
        pulse: 'Choppy'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })

    it('非 Blood Stasis 证型不触发', () => {
      const note = {
        localPattern: 'Qi Deficiency',
        tongue: 'Pale, thin white coating',
        pulse: 'Weak'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })

    it('缺失 tongue 字段不触发', () => {
      const note = {
        localPattern: 'Blood Stasis',
        pulse: 'Choppy'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })
  })

  describe('HS08: 寒湿证-脉象矛盾', () => {
    it('Cold-Damp + 数脉(rapid) 触发 MEDIUM warning', () => {
      const note = {
        localPattern: 'Cold-Damp',
        tongue: 'Pale, thick white greasy coating',
        pulse: 'Slippery, rapid'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(1)
      expect(result.concerns[0].ruleId).toBe('HS08')
      expect(result.concerns[0].severity).toBe('MEDIUM')
      expect(result.concerns[0].detail).toContain('寒湿/风寒证型但脉象为 rapid (数脉)')
      expect(result.concerns[0].reasoning).toContain('寒湿证典型脉象应为迟脉或缓脉')
      expect(result.concerns[0].suggestion).toContain('建议复核证型诊断或脉象描述')
      expect(result.concerns[0].confidence).toBe(0.82)
    })

    it('Wind-Cold + 数脉 触发 MEDIUM warning', () => {
      const note = {
        localPattern: 'Wind-Cold Invasion',
        tongue: 'Thin white coating',
        pulse: 'Floating, rapid'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(1)
      expect(result.concerns[0].ruleId).toBe('HS08')
      expect(result.concerns[0].severity).toBe('MEDIUM')
      expect(result.concerns[0].confidence).toBe(0.82)
    })

    it('Cold-Damp + 迟脉(slow) PASS', () => {
      const note = {
        localPattern: 'Cold-Damp',
        tongue: 'Pale, thick white coating',
        pulse: 'Slow, deep'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })

    it('Cold-Damp + 缓脉 PASS', () => {
      const note = {
        localPattern: 'Cold-Damp Obstruction',
        tongue: 'Pale, greasy coating',
        pulse: 'Moderate, slippery'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })

    it('非寒湿证型不触发', () => {
      const note = {
        localPattern: 'Damp-Heat',
        pulse: 'Rapid, slippery'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })

    it('缺失 pulse 字段不触发', () => {
      const note = {
        localPattern: 'Cold-Damp',
        tongue: 'Pale, thick white coating'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })
  })

  describe('HS09: 湿热证-脉象矛盾', () => {
    it('Damp-Heat + 迟脉(slow) 触发 MEDIUM warning', () => {
      const note = {
        localPattern: 'Damp-Heat',
        tongue: 'Red, yellow greasy coating',
        pulse: 'Slow, slippery'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(1)
      expect(result.concerns[0].ruleId).toBe('HS09')
      expect(result.concerns[0].severity).toBe('MEDIUM')
      expect(result.concerns[0].detail).toContain('Damp-Heat 证型但脉象为 slow (迟脉)')
      expect(result.concerns[0].reasoning).toContain('湿热证典型脉象应为滑数脉或濡数脉')
      expect(result.concerns[0].suggestion).toContain('建议复核证型诊断或脉象描述')
      expect(result.concerns[0].confidence).toBe(0.79)
    })

    it('systemicPattern Damp-Heat + slow pulse 触发', () => {
      const note = {
        systemicPattern: 'Liver-Gallbladder Damp-Heat',
        tongue: 'Red, thick yellow coating',
        pulse: 'Deep, slow'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(1)
      expect(result.concerns[0].ruleId).toBe('HS09')
      expect(result.concerns[0].severity).toBe('MEDIUM')
    })

    it('Damp-Heat + 滑数脉 PASS', () => {
      const note = {
        localPattern: 'Damp-Heat',
        tongue: 'Red, yellow greasy coating',
        pulse: 'Slippery, rapid'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })

    it('Damp-Heat + 濡数脉 PASS', () => {
      const note = {
        localPattern: 'Damp-Heat Obstruction',
        tongue: 'Red body, thick yellow coating',
        pulse: 'Soft, rapid'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })

    it('非湿热证型不触发', () => {
      const note = {
        localPattern: 'Cold-Damp',
        pulse: 'Slow, deep'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })

    it('缺失 pulse 字段不触发', () => {
      const note = {
        localPattern: 'Damp-Heat',
        tongue: 'Red, yellow coating'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })
  })

  describe('HS10: ADL-疼痛不匹配', () => {
    it('ADL ≥7 但 Pain <3 触发 LOW warning', () => {
      const note = {
        adlDifficulty: 8,
        painScaleCurrent: 2,
        systemicPattern: 'Qi Deficiency'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(1)
      expect(result.concerns[0].ruleId).toBe('HS10')
      expect(result.concerns[0].severity).toBe('LOW')
      expect(result.concerns[0].detail).toContain('severe ADL difficulty (8/10)')
      expect(result.concerns[0].detail).toContain('mild pain (2/10)')
      expect(result.concerns[0].reasoning).toContain('日常生活活动严重受限通常伴随中度以上疼痛')
      expect(result.concerns[0].suggestion).toContain('建议复核 ADL 评估或疼痛评分是否准确')
      expect(result.concerns[0].confidence).toBe(0.72)
    })

    it('ADL=7 Pain=2 触发 LOW warning (边界情况)', () => {
      const note = {
        adlDifficulty: 7,
        painScaleCurrent: 2
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(1)
      expect(result.concerns[0].ruleId).toBe('HS10')
      expect(result.concerns[0].severity).toBe('LOW')
    })

    it('ADL=10 Pain=0 触发 (极端情况)', () => {
      const note = {
        adlDifficulty: 10,
        painScaleCurrent: 0
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(1)
      expect(result.concerns[0].ruleId).toBe('HS10')
    })

    it('ADL 高 Pain 高 PASS', () => {
      const note = {
        adlDifficulty: 8,
        painScaleCurrent: 7
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })

    it('ADL 低 Pain 低 PASS', () => {
      const note = {
        adlDifficulty: 3,
        painScaleCurrent: 2
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })

    it('ADL=6 Pain=2 不触发 (ADL 未达阈值)', () => {
      const note = {
        adlDifficulty: 6,
        painScaleCurrent: 2
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })

    it('ADL=8 Pain=3 不触发 (Pain 达到阈值)', () => {
      const note = {
        adlDifficulty: 8,
        painScaleCurrent: 3
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })

    it('缺失 adlDifficulty 字段不触发', () => {
      const note = {
        painScaleCurrent: 2
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })

    it('缺失 painScaleCurrent 字段不触发', () => {
      const note = {
        adlDifficulty: 8
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(0)
    })
  })

  describe('置信度验证', () => {
    it('所有触发的规则包含 confidence 分数', () => {
      const testCases = [
        {
          note: { systemicPattern: 'Qi Deficiency', tongue: 'red' },
          expectedRule: 'HS06'
        },
        {
          note: { localPattern: 'Blood Stasis', tongue: 'pale' },
          expectedRule: 'HS07'
        },
        {
          note: { localPattern: 'Cold-Damp', pulse: 'rapid' },
          expectedRule: 'HS08'
        },
        {
          note: { localPattern: 'Damp-Heat', pulse: 'slow' },
          expectedRule: 'HS09'
        },
        {
          note: { adlDifficulty: 8, painScaleCurrent: 2 },
          expectedRule: 'HS10'
        }
      ]

      testCases.forEach(({ note, expectedRule }) => {
        const result = checker.check(note)
        expect(result.concerns.length).toBeGreaterThan(0)
        expect(result.concerns[0].ruleId).toBe(expectedRule)
        expect(result.concerns[0].confidence).toBeDefined()
        expect(typeof result.concerns[0].confidence).toBe('number')
      })
    })

    it('HS06-HS10 的 confidence 在 0.70-0.85 范围', () => {
      const testCases = [
        { systemicPattern: 'Qi Deficiency', tongue: 'red' },
        { localPattern: 'Blood Stasis', tongue: 'pale' },
        { localPattern: 'Cold-Damp', pulse: 'rapid' },
        { localPattern: 'Damp-Heat', pulse: 'slow' },
        { adlDifficulty: 8, painScaleCurrent: 2 }
      ]

      testCases.forEach((note) => {
        const result = checker.check(note)
        expect(result.concerns.length).toBeGreaterThan(0)
        const confidence = result.concerns[0].confidence
        expect(confidence).toBeGreaterThanOrEqual(0.70)
        expect(confidence).toBeLessThanOrEqual(0.85)
      })
    })

    it('验证各规则的具体 confidence 值', () => {
      const confidenceMap: Record<string, number> = {
        HS06: 0.78,
        HS07: 0.80,
        HS08: 0.82,
        HS09: 0.79,
        HS10: 0.72
      }

      const testCases = [
        { note: { systemicPattern: 'Qi Deficiency', tongue: 'red' }, rule: 'HS06' },
        { note: { localPattern: 'Blood Stasis', tongue: 'pale' }, rule: 'HS07' },
        { note: { localPattern: 'Cold-Damp', pulse: 'rapid' }, rule: 'HS08' },
        { note: { localPattern: 'Damp-Heat', pulse: 'slow' }, rule: 'HS09' },
        { note: { adlDifficulty: 8, painScaleCurrent: 2 }, rule: 'HS10' }
      ]

      testCases.forEach(({ note, rule }) => {
        const result = checker.check(note)
        expect(result.concerns[0].confidence).toBe(confidenceMap[rule])
      })
    })
  })

  describe('Layer2Result 结构验证', () => {
    it('验证返回结构包含必需字段', () => {
      const note = {
        systemicPattern: 'Qi Deficiency',
        tongue: 'Red with yellow coating',
        painScaleCurrent: 5
      }
      const result = checker.check(note)

      expect(result).toHaveProperty('layer')
      expect(result).toHaveProperty('result')
      expect(result).toHaveProperty('concerns')
      expect(result).toHaveProperty('manualReviewRequired')
      expect(result.layer).toBe('medical_logic')
    })

    it('触发 MEDIUM 规则时 manualReviewRequired=true', () => {
      const note = {
        systemicPattern: 'Qi Deficiency',
        tongue: 'Red with yellow coating'
      }
      const result = checker.check(note)

      expect(result.manualReviewRequired).toBe(true)
      expect(result.result).toBe('WARNING')
    })

    it('触发 LOW 规则时 manualReviewRequired=false', () => {
      const note = {
        adlDifficulty: 8,
        painScaleCurrent: 2
      }
      const result = checker.check(note)

      expect(result.manualReviewRequired).toBe(false)
      expect(result.result).toBe('PASS')
    })

    it('无触发时返回 PASS', () => {
      const note = {
        systemicPattern: 'Qi Deficiency',
        tongue: 'Pale, thin white coating',
        painScaleCurrent: 5
      }
      const result = checker.check(note)

      expect(result.result).toBe('PASS')
      expect(result.concerns.length).toBe(0)
      expect(result.manualReviewRequired).toBe(false)
    })
  })

  describe('多规则组合触发', () => {
    it('同时触发 HS06 和 HS10', () => {
      const note = {
        systemicPattern: 'Qi Deficiency',
        tongue: 'Red with yellow coating',
        adlDifficulty: 8,
        painScaleCurrent: 2
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(2)
      const ruleIds = result.concerns.map(c => c.ruleId)
      expect(ruleIds).toContain('HS06')
      expect(ruleIds).toContain('HS10')
    })

    it('同时触发 HS08 和 HS07', () => {
      const note = {
        localPattern: 'Cold-Damp + Blood Stasis',
        tongue: 'Pale, thick white coating',
        pulse: 'Rapid, choppy'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(2)
      const ruleIds = result.concerns.map(c => c.ruleId)
      expect(ruleIds).toContain('HS07')
      expect(ruleIds).toContain('HS08')
    })

    it('多规则触发时 manualReviewRequired 基于最高 severity', () => {
      const note = {
        systemicPattern: 'Qi Deficiency',
        tongue: 'Red',
        adlDifficulty: 8,
        painScaleCurrent: 2
      }
      const result = checker.check(note)

      // HS06 is MEDIUM, HS10 is LOW
      expect(result.manualReviewRequired).toBe(true)
      expect(result.result).toBe('WARNING')
    })
  })

  describe('边界情况与健壮性', () => {
    it('空对象不触发任何规则', () => {
      const result = checker.check({})
      expect(result.concerns.length).toBe(0)
      expect(result.result).toBe('PASS')
    })

    it('null 值不触发规则', () => {
      const note = {
        systemicPattern: null,
        tongue: null,
        pulse: null,
        adlDifficulty: null,
        painScaleCurrent: null
      }
      const result = checker.check(note)
      expect(result.concerns.length).toBe(0)
    })

    it('undefined 值不触发规则', () => {
      const note = {
        systemicPattern: undefined,
        tongue: undefined,
        pulse: undefined
      }
      const result = checker.check(note)
      expect(result.concerns.length).toBe(0)
    })

    it('大小写敏感性: 小写不触发', () => {
      const note = {
        systemicPattern: 'qi deficiency',
        tongue: 'red'
      }
      const result = checker.check(note)
      expect(result.concerns.length).toBe(0)
    })

    it('部分匹配: 包含关键词即可触发', () => {
      const note = {
        systemicPattern: 'Spleen and Kidney Qi Deficiency with Damp',
        tongue: 'Red with yellow thick coating'
      }
      const result = checker.check(note)

      expect(result.concerns.length).toBe(1)
      expect(result.concerns[0].ruleId).toBe('HS06')
    })

    it('ADL=0 不触发 HS10', () => {
      const note = {
        adlDifficulty: 0,
        painScaleCurrent: 0
      }
      const result = checker.check(note)
      expect(result.concerns.length).toBe(0)
    })

    it('Pain=10 不触发 HS10', () => {
      const note = {
        adlDifficulty: 8,
        painScaleCurrent: 10
      }
      const result = checker.check(note)
      expect(result.concerns.length).toBe(0)
    })
  })
})
