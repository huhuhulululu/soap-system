/**
 * Parser 端到端集成测试
 * 测试完整文档解析流程
 */

import { describe, it, expect } from '@jest/globals'
import { parseOptumNote } from '../../../parsers/optum-note'

// 真实 IE 文档 (无冒号格式 - 用户实际输入)
const REAL_IE_NO_COLON = `DOE, JOHN (DOB: 01/01/1980 ID: 1234567890) Date of Service: 01/15/2025 Printed on: 01/15/2025
PATIENT: DOE, JOHN Gender: Male
DOB: 01/01/1980 AGE AS OF 01/15/2025: 45y

Subjective
INITIAL EVALUATION

Patient c/o Chronic pain in right Knee area which is Dull, Burning without radiation. The patient has been complaining of the pain for 3 month(s) which got worse in recent 1 week(s). The pain is associated with muscles soreness, heaviness (scale as 70%-80%) due to age related/degenerative changes.

The pain is aggravated by any strenuous activities . There is moderate to severe difficulty with ADLs like Going up and down stairs, Rising from a chair, bending knee to sit position.

Changing positions, Resting, Massage can temporarily relieve the pain. Due to this condition patient has decrease outside activity. The pain did not improved over-the-counter pain medication which promoted the patient to seek acupuncture and oriental medicine intervention.

Pain Scale: Worst: 8 ; Best: 6 ; Current: 8
Pain Frequency: Constant (symptoms occur between 76% and 100% of the time)
Walking aid :none

Medical history/Contraindication or Precision: N/A

Objective
Muscles Testing:
Tightness muscles noted along Hamstrings muscle group, Gluteus Maximus, Gluteus medius / minimus
Grading Scale: moderate to severe

Tenderness muscle noted along Gastronemius muscle, Hamstrings muscle group, Tibialis Post/ Anterior
Tenderness Scale: (+3) = There is severe tenderness with withdrawal.

Muscles spasm noted along Quadratus femoris, Adductor longus/ brev/ magnus, Iliotibial Band ITB, Rectus Femoris
Frequency Grading Scale:(+3)=>1 but < 10 spontaneous spasms per hour.

Right Knee Muscles Strength and Joint ROM:
4/5 Flexion(fully bent): 80 Degrees(moderate)
5/5 Extension(fully straight): 0(normal)

Inspection: joint swelling

tongue
pale, thin white coat
pulse
thready

Assessment
TCM Dx:
Right knee pain due to Qi & Blood Deficiency in local meridian, but patient also has Kidney Yang Deficiency in the general.
Today's TCM treatment principles:
focus on tonifying qi and blood and harmonize Liver and Kidney balance in order to promote healthy joint and lessen dysfunction in all aspects.
Acupuncture Eval was done today on right knee area.

Plan
Initial Evaluation - Personal one on one contact with the patient (total 20-30 mins)
1. Greeting patient.
2. Detail explanation from patient of past medical history and current symptom.
3. Initial evaluation examination of the patient current condition.
4. Explanation with patient for medical decision/treatment plan.

Short Term Goal (RELIEF TREATMENT FREQUENCY: 12 treatments in 5-6 weeks):
Decrease Pain Scale to5-6.
Decrease soreness sensation Scale to (50%-60%)
Decrease Muscles Tightness to moderate
Decrease Muscles Tenderness to Grade 3
Decrease Muscles Spasms to Grade 2
Increase Muscles Strength to4

Long Term Goal (ADDITIONAL MAINTENANCE & SUPPORTING TREATMENTS FREQUENCY: 8 treatments in 5-6 weeks):
Decrease Pain Scale to2-3
Decrease soreness sensation Scale to (20%-30%)
Decrease Muscles Tightness to mild
Decrease Muscles Tenderness to Grade 1
Decrease Muscles Spasms to Grade 0
Increase Muscles Strength to4+
Increase ROM 80%
Decrease impaired Activities of Daily Living to mild.`

// 标准格式 IE (带冒号)
const REAL_IE_WITH_COLON = `DOE, JOHN (DOB: 01/01/1980 ID: 1234567890) Date of Service: 01/15/2025 Printed on: 01/15/2025

Subjective:
INITIAL EVALUATION

Patient c/o Chronic pain in right Knee area which is Dull, Burning without radiation.
Pain Scale: Worst: 8 ; Best: 6 ; Current: 8
Pain Frequency: Constant (symptoms occur between 76% and 100% of the time)
Walking aid: none
Medical history/Contraindication or Precision: N/A

Objective:
Tightness muscles noted along Hamstrings muscle group
Grading Scale: moderate to severe
Tenderness Scale: (+3) = There is severe tenderness with withdrawal.

Right Knee Muscles Strength and Joint ROM:
4/5 Flexion(fully bent): 80 Degrees(moderate)
5/5 Extension(fully straight): 0(normal)

tongue
pale, thin white coat
pulse
thready

Assessment:
TCM Dx:
Right knee pain due to Qi & Blood Deficiency in local meridian, but patient also has Kidney Yang Deficiency in the general.

Plan:
Initial Evaluation
Short Term Goal (RELIEF TREATMENT FREQUENCY: 12 treatments in 5-6 weeks):
Decrease Pain Scale to 5-6.`

describe('Parser 端到端集成测试', () => {
  describe('E2E-01~02: 完整文档解析', () => {
    it('E2E-01: 解析无冒号格式 IE (用户实际输入)', () => {
      const result = parseOptumNote(REAL_IE_NO_COLON)
      
      expect(result.success).toBe(true)
      const doc = (result as any).document
      expect(doc.visits.length).toBe(1)
      
      const visit = doc.visits[0]
      expect(visit.subjective).toBeDefined()
      expect(visit.subjective.visitType).toContain('INITIAL')
    })

    it('E2E-02: 解析标准格式 IE (带冒号)', () => {
      const result = parseOptumNote(REAL_IE_WITH_COLON)
      
      expect(result.success).toBe(true)
      const doc = (result as any).document
      expect(doc.visits.length).toBe(1)
    })
  })

  describe('E2E-03: 格式变体', () => {
    it('大小写混合 SUBJECTIVE', () => {
      const text = REAL_IE_NO_COLON.replace('Subjective', 'SUBJECTIVE')
      const result = parseOptumNote(text)
      
      expect(result.success).toBe(true)
    })

    it('小写 subjective', () => {
      const text = REAL_IE_NO_COLON.replace('Subjective', 'subjective')
      const result = parseOptumNote(text)
      
      expect(result.success).toBe(true)
    })
  })

  describe('E2E-04: 错误处理', () => {
    it('空文档返回错误', () => {
      const result = parseOptumNote('')
      expect(result.success).toBe(false)
    })

    it('无 Subjective 返回错误', () => {
      const text = 'Objective: some content\nAssessment: something'
      const result = parseOptumNote(text)
      expect(result.success).toBe(false)
    })

    it('短文本返回错误', () => {
      const text = 'Subjective: short'
      const result = parseOptumNote(text)
      expect(result.success).toBe(false)
    })
  })

  describe('E2E-05: Pain Scale 解析', () => {
    it('正确解析 IE Pain Scale', () => {
      const result = parseOptumNote(REAL_IE_NO_COLON)
      
      expect(result.success).toBe(true)
      const doc = (result as any).document
      const visit = doc.visits[0]
      const painScale = visit.subjective.painScale
      
      expect(painScale.worst).toBe(8)
      expect(painScale.best).toBe(6)
      expect(painScale.current).toBe(8)
    })
  })

  describe('E2E-06: 部位解析', () => {
    it('正确解析 Knee 部位', () => {
      const result = parseOptumNote(REAL_IE_NO_COLON)
      
      expect(result.success).toBe(true)
      const doc = (result as any).document
      const visit = doc.visits[0]
      
      expect(visit.subjective.bodyPart.toLowerCase()).toContain('knee')
    })

    it('正确解析侧别 right', () => {
      const result = parseOptumNote(REAL_IE_NO_COLON)
      
      expect(result.success).toBe(true)
      const doc = (result as any).document
      const visit = doc.visits[0]
      
      expect(visit.subjective.laterality).toBe('right')
    })
  })

  describe('E2E-07: Objective 解析', () => {
    it('正确解析 Tightness', () => {
      const result = parseOptumNote(REAL_IE_NO_COLON)
      
      expect(result.success).toBe(true)
      const doc = (result as any).document
      const visit = doc.visits[0]
      
      expect(visit.objective.tightnessMuscles.gradingScale).toContain('moderate')
    })

    it('正确解析 Tenderness Scale', () => {
      const result = parseOptumNote(REAL_IE_NO_COLON)
      
      expect(result.success).toBe(true)
      const doc = (result as any).document
      const visit = doc.visits[0]
      
      expect(visit.objective.tendernessMuscles.scale).toBe(3)
    })

    it('正确解析 ROM', () => {
      const result = parseOptumNote(REAL_IE_NO_COLON)
      
      expect(result.success).toBe(true)
      const doc = (result as any).document
      const visit = doc.visits[0]
      
      const flexion = visit.objective.rom.items.find((i: any) => i.movement === 'Flexion')
      expect(flexion?.degrees).toBe(80)
    })
  })

  describe('E2E-08: Assessment 解析', () => {
    it('正确解析 TCM 诊断', () => {
      const result = parseOptumNote(REAL_IE_NO_COLON)
      
      expect(result.success).toBe(true)
      const doc = (result as any).document
      const visit = doc.visits[0]
      
      expect(visit.assessment.currentPattern).toContain('Qi & Blood Deficiency')
    })
  })
})
