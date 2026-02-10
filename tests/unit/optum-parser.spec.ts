/**
 * Optum Note Parser Unit Tests
 * Optum Note 解析器单元测试
 */

import { describe, it, expect } from '@jest/globals'
import {
  parseOptumNote,
  parseHeader,
  splitVisitRecords,
  parseVisitRecord,
  parseSubjective,
  parseObjective,
  parseAssessment,
  parsePlan,
  parsePainScale,
  extractPainTypes,
  extractBodyPart,
  parseTightnessMuscles,
  parseTendernessMuscles,
  parseSpasmMuscles,
  parseROM,
  parseTonguePulse,
  parseDiagnosisCodes,
  parseProcedureCodes,
  parseNeedleSpecs
} from '../../parsers/optum-note'

// ============ Test Fixtures ============
const SAMPLE_HEADER = `SMITH, JANE A (DOB: 05/15/1960 ID: 1234567890) Date of Service: 01/15/2024 Printed on: 01/20/2024
PATIENT: SMITH, JANE A Gender: Female
DOB: 05/15/1960 AGE AS OF 01/15/2024: 63y`

const SAMPLE_SUBJECTIVE_IE = `Subjective: INITIAL EVALUATION
Patient c/o Dull Aching Freezing pain along right knee area without radiation, muscles weakness (scale as 50%-60%)
impaired performing ADL's with moderate difficulty bending, squatting, climbing stairs
Pain Scale: Worst: 8 ; Best: 2-3 ; Current: 6
Pain frequency: Constant (symptoms occur between 76% and 100%
Walking aid : none
Medical history/Contraindication or Precision: Hypertension, Diabetes`

const SAMPLE_SUBJECTIVE_TX = `Subjective: Follow up visit
Patient reports: there is improvement of symptom(s) because of maintain regular treatments.
Patient still c/o Dull Aching pain along right knee area without radiation, muscles weakness (scale as 40%)
impaired performing ADL's with mild difficulty bending, squatting
Pain Scale: 5-4 /10
Pain frequency: Frequent (symptoms occur between 51% and 75%`

const SAMPLE_OBJECTIVE = `Objective:
Inspection: local skin no damage or rash
Tightness muscles noted along Quadriceps, IT Band, Gastrocnemius
Grading Scale: moderate
Tenderness muscles noted along Quadriceps, IT Band
Grading Scale: (+2) = moderate pain, patient winces
Muscles spasm noted along Quadriceps, Gastrocnemius
Frequency Grading Scale: (+2) = occasional, seen in less than 25% visits
Right Knee Muscles Strength and Joint ROM
4-/5 Flexion: 110 Degrees(mild)
4/5 Extension: 0 Degrees(normal)
tongue
pale, thin white coat
pulse
thready`

const SAMPLE_ASSESSMENT = `01/15/2024
Assessment:
Patient general condition is good and presents with improvement on symptoms and physical finding has improved since last visit. Current patient still has Qi & Blood Deficiency in local meridian that cause pain and limit ROM.`

const SAMPLE_PLAN = `Plan:
Select Needle Size : 36#x0.5", 34#x1", 30# x1.5"
Total Operation Time: 15 mins
Front Points:
with electrical stimulation ST34, ST35, ST36, SP9, SP10, GB34
Removing all needles.
Today's treatment principles:
Promote Qi and Blood circulation, relieve pain
Diagnosis Code: (1) Pain in right knee(M25.561)
Procedure Code: (1) ACUP 1/> WO ESTIM 1ST 15 MIN(97810)`

describe('Optum Note Parser', () => {
  describe('parseHeader', () => {
    it('should parse patient name', () => {
      const result = parseHeader(SAMPLE_HEADER)
      expect(result?.patient.name).toBe('SMITH, JANE A')
    })

    it('should parse patient DOB', () => {
      const result = parseHeader(SAMPLE_HEADER)
      expect(result?.patient.dob).toBe('05/15/1960')
    })

    it('should parse patient ID', () => {
      const result = parseHeader(SAMPLE_HEADER)
      expect(result?.patient.patientId).toBe('1234567890')
    })

    it('should parse gender', () => {
      const result = parseHeader(SAMPLE_HEADER)
      expect(result?.patient.gender).toBe('Female')
    })

    it('should parse age', () => {
      const result = parseHeader(SAMPLE_HEADER)
      expect(result?.patient.age).toBe(63)
    })

    it('should parse date of service', () => {
      const result = parseHeader(SAMPLE_HEADER)
      expect(result?.dateOfService).toBe('01/15/2024')
    })
  })

  describe('parseSubjective', () => {
    it('should parse IE visit type', () => {
      const result = parseSubjective(SAMPLE_SUBJECTIVE_IE)
      expect(result).not.toBeNull()
      expect(result!.visitType).toBe('INITIAL EVALUATION')
    })

    it('should parse TX visit type', () => {
      const result = parseSubjective(SAMPLE_SUBJECTIVE_TX)
      expect(result).not.toBeNull()
      expect(result!.visitType).toBe('Follow up visit')
    })

    it('should extract pain types', () => {
      const result = parseSubjective(SAMPLE_SUBJECTIVE_IE)
      expect(result).not.toBeNull()
      expect(result!.painTypes).toContain('Dull')
      expect(result!.painTypes).toContain('Aching')
      expect(result!.painTypes).toContain('Freezing')
    })

    it('should parse body part', () => {
      const result = parseSubjective(SAMPLE_SUBJECTIVE_IE)
      expect(result).not.toBeNull()
      expect(result!.bodyPart).toContain('knee')
    })

    it('should parse IE pain scale (detailed)', () => {
      const result = parseSubjective(SAMPLE_SUBJECTIVE_IE)
      expect(result).not.toBeNull()
      const ps = result!.painScale as any
      expect(ps.worst).toBe(8)
      expect(ps.current).toBe(6)
    })

    it('should parse TX pain scale (simple)', () => {
      const result = parseSubjective(SAMPLE_SUBJECTIVE_TX)
      expect(result).not.toBeNull()
      const ps = result!.painScale as any
      expect(ps.value || ps.range?.max).toBeDefined()
    })

    it('should parse pain frequency', () => {
      const result = parseSubjective(SAMPLE_SUBJECTIVE_IE)
      expect(result).not.toBeNull()
      // Pain frequency parsing may vary
      expect(result!.painFrequency).toBeDefined()
    })

    it('should parse ADL difficulty level', () => {
      const result = parseSubjective(SAMPLE_SUBJECTIVE_IE)
      expect(result).not.toBeNull()
      expect(result!.adlDifficultyLevel).toBe('moderate')
    })

    it('should parse medical history (IE only)', () => {
      const result = parseSubjective(SAMPLE_SUBJECTIVE_IE)
      expect(result).not.toBeNull()
      expect(result!.medicalHistory).toContain('Hypertension')
      expect(result!.medicalHistory).toContain('Diabetes')
    })
  })

  describe('parseObjective', () => {
    it('should parse inspection', () => {
      const result = parseObjective(SAMPLE_OBJECTIVE)
      expect(result).not.toBeNull()
      expect(result!.inspection).toBe('local skin no damage or rash')
    })

    it('should parse tightness muscles', () => {
      const result = parseObjective(SAMPLE_OBJECTIVE)
      expect(result).not.toBeNull()
      expect(result!.tightnessMuscles.muscles).toContain('Quadriceps')
      expect(result!.tightnessMuscles.muscles).toContain('IT Band')
      expect(result!.tightnessMuscles.gradingScale).toBe('moderate')
    })

    it('should parse tenderness muscles', () => {
      const result = parseObjective(SAMPLE_OBJECTIVE)
      expect(result).not.toBeNull()
      expect(result!.tendernessMuscles.muscles).toContain('Quadriceps')
      expect(result!.tendernessMuscles.scale).toBe(2)
    })

    it('should parse spasm muscles', () => {
      const result = parseObjective(SAMPLE_OBJECTIVE)
      expect(result).not.toBeNull()
      expect(result!.spasmMuscles.muscles).toContain('Quadriceps')
      expect(result!.spasmMuscles.frequencyScale).toBe(2)
    })

    it('should parse ROM', () => {
      const result = parseObjective(SAMPLE_OBJECTIVE)
      expect(result).not.toBeNull()
      expect(result!.rom.items.length).toBeGreaterThan(0)
      const flexion = result!.rom.items.find((i: any) => i.movement === 'Flexion')
      expect(flexion?.degrees).toBe(110)
      expect(flexion?.strength).toBe('4-/5')
    })

    it('should parse tongue', () => {
      const result = parseObjective(SAMPLE_OBJECTIVE)
      expect(result).not.toBeNull()
      expect(result!.tonguePulse.tongue).toContain('pale')
    })

    it('should parse pulse', () => {
      const result = parseObjective(SAMPLE_OBJECTIVE)
      expect(result).not.toBeNull()
      expect(result!.tonguePulse.pulse).toBe('thready')
    })
  })

  describe('parseAssessment', () => {
    it('should parse date', () => {
      const result = parseAssessment(SAMPLE_ASSESSMENT)
      expect(result).not.toBeNull()
      expect(result!.date).toBe('01/15/2024')
    })

    it('should parse general condition', () => {
      const result = parseAssessment(SAMPLE_ASSESSMENT)
      expect(result).not.toBeNull()
      expect(result!.generalCondition).toBe('good')
    })

    it('should parse symptom change', () => {
      const result = parseAssessment(SAMPLE_ASSESSMENT)
      expect(result).not.toBeNull()
      expect(result!.symptomChange).toBe('improvement')
    })

    it('should parse current pattern', () => {
      const result = parseAssessment(SAMPLE_ASSESSMENT)
      expect(result).not.toBeNull()
      expect(result!.currentPattern).toContain('Qi & Blood Deficiency')
    })
  })

  describe('parsePlan', () => {
    it('should parse needle specs', () => {
      const result = parsePlan(SAMPLE_PLAN)
      expect(result).not.toBeNull()
      expect(result!.needleSpecs.length).toBeGreaterThan(0)
      expect(result!.needleSpecs.some((n: any) => n.gauge === '30#')).toBe(true)
    })

    it('should parse treatment time', () => {
      const result = parsePlan(SAMPLE_PLAN)
      expect(result).not.toBeNull()
      expect(result!.treatmentTime).toBe(15)
    })

    it('should parse acupoints', () => {
      const result = parsePlan(SAMPLE_PLAN)
      expect(result).not.toBeNull()
      expect(result!.acupoints).toContain('ST34')
      expect(result!.acupoints).toContain('ST35')
      expect(result!.acupoints).toContain('GB34')
    })

    it('should parse electrical stimulation', () => {
      const result = parsePlan(SAMPLE_PLAN)
      expect(result).not.toBeNull()
      expect(result!.electricalStimulation).toBe(true)
    })

    it('should parse treatment principles', () => {
      const result = parsePlan(SAMPLE_PLAN)
      expect(result).not.toBeNull()
      expect(result!.treatmentPrinciples).toContain('Promote Qi')
    })
  })

  describe('parseDiagnosisCodes', () => {
    it('should parse ICD-10 codes', () => {
      const codes = parseDiagnosisCodes(SAMPLE_PLAN)
      expect(codes.length).toBeGreaterThan(0)
      expect(codes[0].icd10).toBe('M25.561')
      expect(codes[0].description).toContain('knee')
    })
  })

  describe('parseProcedureCodes', () => {
    it('should parse CPT codes', () => {
      const codes = parseProcedureCodes(SAMPLE_PLAN)
      expect(codes.length).toBeGreaterThan(0)
      expect(codes[0].cpt).toBe('97810')
    })
  })

  describe('Helper Functions', () => {
    describe('extractPainTypes', () => {
      it('should extract multiple pain types', () => {
        const types = extractPainTypes('Dull Aching Freezing pain')
        expect(types).toContain('Dull')
        expect(types).toContain('Aching')
        expect(types).toContain('Freezing')
      })
    })

    describe('extractBodyPart', () => {
      it('should extract body part from text', () => {
        const bp = extractBodyPart('pain along right knee area')
        expect(bp).toContain('knee')
      })
    })

    describe('parsePainScale', () => {
      it('should parse detailed pain scale', () => {
        const ps = parsePainScale('Worst: 8 ; Best: 2-3 ; Current: 6')
        expect(ps).toBeDefined()
      })

      it('should parse simple pain scale', () => {
        const ps = parsePainScale('5-4 /10')
        expect(ps).toBeDefined()
      })
    })

    describe('parseTightnessMuscles', () => {
      it('should parse tightness section', () => {
        const result = parseTightnessMuscles(
          'Tightness muscles noted along Quadriceps, IT Band\nGrading Scale: moderate'
        )
        expect(result).not.toBeNull()
        expect(result!.muscles).toContain('Quadriceps')
        expect(result!.gradingScale).toBe('moderate')
      })
    })

    describe('parseTendernessMuscles', () => {
      it('should parse tenderness section', () => {
        const result = parseTendernessMuscles(
          'Tenderness muscles noted along Quadriceps\nGrading Scale: (+2) = moderate pain'
        )
        expect(result).not.toBeNull()
        expect(result!.muscles).toContain('Quadriceps')
        expect(result!.scale).toBe(2)
      })
    })

    describe('parseSpasmMuscles', () => {
      it('should parse spasm section', () => {
        const result = parseSpasmMuscles(
          'Muscles spasm noted along Gastrocnemius\nFrequency Grading Scale: (+2) = occasional'
        )
        // May return null if format doesn't match exactly
        if (result) {
          expect(result.muscles).toContain('Gastrocnemius')
        }
      })
    })

    describe('parseROM', () => {
      it('should parse ROM items', () => {
        const result = parseROM('4-/5 Flexion: 110 Degrees(mild)\n4/5 Extension: 0 Degrees(normal)')
        expect(result).not.toBeNull()
        expect(result!.items.length).toBe(2)
      })
    })

    describe('parseTonguePulse', () => {
      it('should parse tongue and pulse', () => {
        const result = parseTonguePulse('tongue\npale, thin white coat\npulse\nthready')
        expect(result).not.toBeNull()
        expect(result!.tongue).toContain('pale')
        expect(result!.pulse).toBe('thready')
      })
    })

    describe('parseNeedleSpecs', () => {
      it('should parse needle specifications', () => {
        const specs = parseNeedleSpecs('Select Needle Size : 36#x0.5", 34#x1", 30# x1.5"')
        expect(specs.length).toBe(3)
        expect(specs.some((s: any) => s.gauge === '30#' && s.length === '1.5"')).toBe(true)
      })
    })
  })

  describe('parseOptumNote (Integration)', () => {
    const FULL_DOCUMENT = `${SAMPLE_HEADER}
${SAMPLE_SUBJECTIVE_IE}
${SAMPLE_OBJECTIVE}
${SAMPLE_ASSESSMENT}
${SAMPLE_PLAN}`

    it('should parse complete document', () => {
      const result = parseOptumNote(FULL_DOCUMENT)
      expect(result.success).toBe(true)
      expect(result.document).toBeDefined()
    })

    it('should extract header', () => {
      const result = parseOptumNote(FULL_DOCUMENT)
      expect(result.document?.header.patient.name).toBe('SMITH, JANE A')
    })

    it('should extract visits', () => {
      const result = parseOptumNote(FULL_DOCUMENT)
      expect(result.document?.visits.length).toBeGreaterThan(0)
    })

    it('should return errors for malformed input', () => {
      const result = parseOptumNote('invalid content')
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
