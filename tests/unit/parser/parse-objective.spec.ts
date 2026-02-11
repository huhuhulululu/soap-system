/**
 * parseObjective 边界测试
 */

import { describe, it, expect } from '@jest/globals'
import { 
  parseObjective, 
  parseTightnessMuscles, 
  parseTendernessMuscles, 
  parseSpasmMuscles,
  parseROM,
  parseTonguePulse
} from '../../../parsers/optum-note'

const FULL_OBJECTIVE = `Objective:
Inspection: local skin no damage or rash
Tightness muscles noted along Quadriceps, IT Band, Gastrocnemius
Grading Scale: moderate
Tenderness muscles noted along Quadriceps, IT Band
Tenderness Scale: (+2) = moderate pain, patient winces
Muscles spasm noted along Quadriceps, Gastrocnemius
Frequency Grading Scale: (+2) = occasional
Right Knee Muscles Strength and Joint ROM:
4/5 Flexion: 110 Degrees(mild)
5/5 Extension: 0 Degrees(normal)
tongue
pale, thin white coat
pulse
thready`

describe('parseObjective', () => {
  describe('PO-01~04: 完整和缺失字段', () => {
    it('PO-01: 完整 Objective', () => {
      const result = parseObjective(FULL_OBJECTIVE)
      expect(result).not.toBeNull()
      expect(result!.inspection).toBeDefined()
      expect(result!.tightnessMuscles).toBeDefined()
      expect(result!.tendernessMuscles).toBeDefined()
      expect(result!.spasmMuscles).toBeDefined()
      expect(result!.rom).toBeDefined()
      expect(result!.tonguePulse).toBeDefined()
    })

    it('PO-02: 无 Tightness 返回 null', () => {
      const block = `Objective:
Tenderness muscles noted along Quadriceps
Tenderness Scale: (+2)
Muscles spasm noted along Quadriceps
Frequency Grading Scale: (+2)
Right Knee Muscles Strength and Joint ROM:
4/5 Flexion: 110 Degrees(mild)
tongue
pale
pulse
thready`
      
      const result = parseObjective(block)
      expect(result).toBeNull()
    })

    it('PO-03: 无 Tenderness 返回 null', () => {
      const block = `Objective:
Tightness muscles noted along Quadriceps
Grading Scale: moderate
Muscles spasm noted along Quadriceps
Frequency Grading Scale: (+2)
Right Knee Muscles Strength and Joint ROM:
4/5 Flexion: 110 Degrees(mild)
tongue
pale
pulse
thready`
      
      const result = parseObjective(block)
      expect(result).toBeNull()
    })

    it('PO-04: 无 Spasm 返回 null', () => {
      const block = `Objective:
Tightness muscles noted along Quadriceps
Grading Scale: moderate
Tenderness muscles noted along Quadriceps
Tenderness Scale: (+2)
Right Knee Muscles Strength and Joint ROM:
4/5 Flexion: 110 Degrees(mild)
tongue
pale
pulse
thready`
      
      const result = parseObjective(block)
      expect(result).toBeNull()
    })
  })

  describe('PO-05~08: 子解析器', () => {
    it('PO-05: parseTightnessMuscles moderate to severe', () => {
      const block = `Tightness muscles noted along Hamstrings, Gluteus
Grading Scale: moderate to severe`
      
      const result = parseTightnessMuscles(block)
      expect(result).not.toBeNull()
      expect(result!.gradingScale).toBe('moderate to severe')
      expect(result!.muscles).toContain('Hamstrings')
    })

    it('PO-06: parseTendernessMuscles (+3)', () => {
      const block = `Tenderness muscles noted along Gastrocnemius
Tenderness Scale: (+3) = There is severe tenderness with withdrawal`
      
      const result = parseTendernessMuscles(block)
      expect(result).not.toBeNull()
      expect(result!.scale).toBe(3)
    })

    it('PO-07: parseSpasmMuscles (+1)', () => {
      const block = `Muscles spasm noted along Quadriceps
Frequency Grading Scale: (+1) = rare`
      
      const result = parseSpasmMuscles(block)
      expect(result).not.toBeNull()
      expect(result!.frequencyScale).toBe(1)
    })

    it('PO-08: parseROM 多项', () => {
      const block = `Right Knee Muscles Strength and Joint ROM:
4/5 Flexion: 80 Degrees(moderate)
5/5 Extension: 0 Degrees(normal)
4-/5 Internal Rotation: 20 Degrees(mild)`
      
      const result = parseROM(block)
      expect(result).not.toBeNull()
      expect(result!.items.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('PO-09~12: 格式变体', () => {
    it('PO-09: Tongue 变体 (带冒号)', () => {
      const block = `tongue: pale, thin white coat
pulse: thready, wiry`
      
      const result = parseTonguePulse(block)
      expect(result).not.toBeNull()
      expect(result!.tongue).toContain('pale')
    })

    it('PO-10: Inspection joint swelling', () => {
      const result = parseObjective(FULL_OBJECTIVE.replace('local skin no damage or rash', 'joint swelling'))
      expect(result).not.toBeNull()
      expect(result!.inspection).toBe('joint swelling')
    })

    it('PO-11: Grading Scale mild', () => {
      const block = `Tightness muscles noted along Quadriceps
Grading Scale: mild`
      
      const result = parseTightnessMuscles(block)
      expect(result).not.toBeNull()
      expect(result!.gradingScale).toBe('mild')
    })

    it('PO-12: ROM Flexion(fully bent) 格式', () => {
      const block = `Right Knee Muscles Strength and Joint ROM:
4/5 Flexion(fully bent): 80 Degrees(moderate)
5/5 Extension(fully straight): 0(normal)`
      
      const result = parseROM(block)
      expect(result).not.toBeNull()
      const flexion = result!.items.find(i => i.movement === 'Flexion')
      expect(flexion).toBeDefined()
      expect(flexion!.degrees).toBe(80)
    })
  })
})
