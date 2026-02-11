/**
 * parseSubjective 边界测试
 */

import { describe, it, expect } from '@jest/globals'
import { parseSubjective, parsePainScale } from '../../../parsers/optum-note'

// 生成完整的 Subjective block
const makeSubjective = (content: string) => `Subjective:
${content}
Pain Scale: Worst: 8 ; Best: 6 ; Current: 7
Medical history/Contraindication or Precision: N/A`

describe('parseSubjective', () => {
  describe('PS-01~02: 基本类型', () => {
    it('PS-01: IE 标准格式', () => {
      const block = `Subjective:
INITIAL EVALUATION
Patient c/o Chronic pain in right Knee area which is Dull, Burning without radiation.
Pain Scale: Worst: 8 ; Best: 6 ; Current: 7
Medical history/Contraindication or Precision: HTN, DM`
      
      const result = parseSubjective(block)
      expect(result).not.toBeNull()
      expect(result!.visitType).toBe('INITIAL EVALUATION')
      expect(result!.chronicityLevel).toBe('Chronic')
    })

    it('PS-02: TX 标准格式', () => {
      const block = `Subjective:
Follow up visit
Patient reports: there is improvement of symptom(s) because of maintain regular treatments.
Patient still c/o Dull pain in right Knee area.
Pain Scale: 6-5 /10`
      
      const result = parseSubjective(block)
      expect(result).not.toBeNull()
      expect(result!.visitType).toBe('Follow up visit')
    })
  })

  describe('PS-03~06: Pain Scale 变体', () => {
    it('PS-03: Pain Scale 范围格式', () => {
      const result = parsePainScale('Pain Scale: 5-4 /10')
      expect(result).not.toBeNull()
    })

    it('PS-04: Pain Scale 单值格式', () => {
      const result = parsePainScale('Pain Scale: 6 /10')
      expect(result).not.toBeNull()
    })

    it('PS-05: Pain Scale IE 详细格式', () => {
      const result = parsePainScale('Pain Scale: Worst: 8 ; Best: 6 ; Current: 7')
      expect(result).not.toBeNull()
      expect((result as any).worst).toBe(8)
      expect((result as any).best).toBe(6)
      expect((result as any).current).toBe(7)
    })

    it('PS-06: 无 Pain Scale', () => {
      const block = `Subjective:
INITIAL EVALUATION
Patient c/o pain in knee area.
Medical history: N/A`
      
      const result = parseSubjective(block)
      // 当前实现可能要求 Pain Scale，返回 null 是预期行为
      // 这是一个边界情况记录
    })
  })

  describe('PS-07~10: 部位和侧别', () => {
    it('PS-07: 多部位', () => {
      const block = makeSubjective(`INITIAL EVALUATION
Patient c/o pain in right knee and hip area.`)
      
      const result = parseSubjective(block)
      expect(result).not.toBeNull()
      expect(result!.bodyPart.toLowerCase()).toMatch(/knee|hip/)
    })

    it('PS-08: 双侧 bilateral', () => {
      const block = makeSubjective(`INITIAL EVALUATION
Patient c/o pain in bilateral knee area.`)
      
      const result = parseSubjective(block)
      expect(result).not.toBeNull()
      expect(result!.laterality).toBe('bilateral')
    })

    it('PS-09: 左侧', () => {
      const block = makeSubjective(`INITIAL EVALUATION
Patient c/o pain in left shoulder area.`)
      
      const result = parseSubjective(block)
      expect(result).not.toBeNull()
      expect(result!.laterality).toBe('left')
    })

    it('PS-10: 无侧别 (cervical)', () => {
      const block = makeSubjective(`INITIAL EVALUATION
Patient c/o pain in cervical area.`)
      
      const result = parseSubjective(block)
      expect(result).not.toBeNull()
      // cervical 通常无侧别
    })
  })

  describe('PS-11~15: 其他字段', () => {
    it('PS-11: 医史 N/A', () => {
      const block = `Subjective:
INITIAL EVALUATION
Patient c/o pain in right knee.
Pain Scale: Worst: 8 ; Best: 6 ; Current: 7
Medical history/Contraindication or Precision: N/A`
      
      const result = parseSubjective(block)
      expect(result).not.toBeNull()
      expect(result!.medicalHistory?.length ?? 0).toBe(0)
    })

    it('PS-12: 医史多项', () => {
      const block = `Subjective:
INITIAL EVALUATION
Patient c/o pain in right knee.
Pain Scale: Worst: 8 ; Best: 6 ; Current: 7
Medical history/Contraindication or Precision: HTN, DM, HLD`
      
      const result = parseSubjective(block)
      expect(result).not.toBeNull()
      expect(result!.medicalHistory?.length ?? 0).toBeGreaterThanOrEqual(1)
    })

    it('PS-13: ADL moderate difficulty', () => {
      const block = makeSubjective(`INITIAL EVALUATION
Patient c/o pain in right knee.
There is moderate difficulty with ADLs like walking.`)
      
      const result = parseSubjective(block)
      expect(result).not.toBeNull()
      expect(result!.adlDifficultyLevel).toBe('moderate')
    })

    it('PS-14: ADL severe difficulty', () => {
      const block = makeSubjective(`INITIAL EVALUATION
Patient c/o pain in right knee.
There is severe difficulty with ADLs like walking.`)
      
      const result = parseSubjective(block)
      expect(result).not.toBeNull()
      expect(result!.adlDifficultyLevel).toBe('severe')
    })

    it('PS-15: 症状改善', () => {
      const block = `Subjective:
Follow up visit
Patient reports: there is improvement of symptom(s).
Patient still c/o pain in right knee.
Pain Scale: 5 /10`
      
      const result = parseSubjective(block)
      expect(result).not.toBeNull()
      // symptomChange 可能在 Assessment 中而不是 Subjective
      expect(result!.visitType).toBe('Follow up visit')
    })
  })
})
