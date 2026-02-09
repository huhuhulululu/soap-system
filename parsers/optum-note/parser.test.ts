/**
 * Optum Note PDF Parser Tests
 * TDD: RED phase - tests written before verifying implementation
 */

import { describe, it, expect } from 'vitest'
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
  parseNeedleSpecs,
} from './parser'

// ============ Test Fixtures ============
const SAMPLE_HEADER = `SMITH, JANE A (DOB: 05/15/1960 ID: 1234567890) Date of Service: 01/15/2024 Printed on: 01/20/2024
PATIENT: SMITH, JANE A Gender: Female
DOB: 05/15/1960 AGE AS OF 01/15/2024: 63y`

const SAMPLE_SUBJECTIVE_FOLLOWUP = `Subjective: Follow up visit
Patient still c/o Dull Aching pain along right knee area without radiation, muscles weakness (scale as 40%)
impaired performing ADL's with bending, squatting,
Pain Scale: 5-4 /10
Pain frequency: Frequent (symptoms occur between 51% and 75%`

const SAMPLE_SUBJECTIVE_INITIAL = `Subjective: INITIAL EVALUATION
Patient c/o Dull Aching Freezing pain along right knee area without radiation, muscles weakness (scale as 50%-60%)
impaired performing ADL's with bending, squatting, climbing stairs
Pain Scale: Worst: 8 ; Best: 2-3 ; Current: 6
Pain frequency: Constant (symptoms occur between 76% and 100%
Walking aid : none
Medical history/Contraindication or Precision: Hypertension, Diabetes`

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

const SAMPLE_FULL_VISIT = `${SAMPLE_SUBJECTIVE_FOLLOWUP}
${SAMPLE_OBJECTIVE}
${SAMPLE_ASSESSMENT}
${SAMPLE_PLAN}`

const SAMPLE_FULL_DOCUMENT = `${SAMPLE_HEADER}
${SAMPLE_FULL_VISIT}`

// ============ Header Parser Tests ============
describe('parseHeader', () => {
  it('should parse patient name correctly', () => {
    const result = parseHeader(SAMPLE_HEADER)
    expect(result).not.toBeNull()
    expect(result?.patient.name).toBe('SMITH, JANE A')
  })

  it('should parse patient DOB correctly', () => {
    const result = parseHeader(SAMPLE_HEADER)
    expect(result?.patient.dob).toBe('05/15/1960')
  })

  it('should parse patient ID correctly', () => {
    const result = parseHeader(SAMPLE_HEADER)
    expect(result?.patient.patientId).toBe('1234567890')
  })

  it('should parse gender correctly', () => {
    const result = parseHeader(SAMPLE_HEADER)
    expect(result?.patient.gender).toBe('Female')
  })

  it('should parse age correctly', () => {
    const result = parseHeader(SAMPLE_HEADER)
    expect(result?.patient.age).toBe(63)
  })

  it('should parse date of service correctly', () => {
    const result = parseHeader(SAMPLE_HEADER)
    expect(result?.dateOfService).toBe('01/15/2024')
  })

  it('should parse printed on date correctly', () => {
    const result = parseHeader(SAMPLE_HEADER)
    expect(result?.printedOn).toBe('01/20/2024')
  })

  it('should return null for invalid header', () => {
    const result = parseHeader('invalid header text')
    expect(result).toBeNull()
  })
})

// ============ Visit Record Splitter Tests ============
describe('splitVisitRecords', () => {
  it('should split document into visit records', () => {
    const text = `Header info
Subjective: Follow up visit
content 1
Procedure Code: (1) test(12345)
Subjective: Follow up visit
content 2
Procedure Code: (1) test(12345)`
    const result = splitVisitRecords(text)
    expect(result.length).toBe(2)
  })

  it('should filter out blocks without Procedure Code', () => {
    const text = `Subjective: Follow up visit
content without procedure code
Subjective: Follow up visit
content 2
Procedure Code: (1) test(12345)`
    const result = splitVisitRecords(text)
    expect(result.length).toBe(1)
  })

  it('should return empty array for document without visits', () => {
    const result = splitVisitRecords('No visit records here')
    expect(result.length).toBe(0)
  })
})

// ============ Pain Scale Parser Tests ============
describe('parsePainScale', () => {
  it('should parse simple pain scale (single value)', () => {
    const result = parsePainScale('Pain Scale: 5 /10')
    expect(result).toEqual({ value: 5 })
  })

  it('should parse simple pain scale (range)', () => {
    const result = parsePainScale('Pain Scale: 5-4 /10')
    expect(result).toEqual({ value: 5, range: { min: 5, max: 4 } })
  })

  it('should parse detailed pain scale', () => {
    const result = parsePainScale('Pain Scale: Worst: 8 ; Best: 2 ; Current: 6')
    expect(result).toEqual({ worst: 8, best: 2, current: 6 })
  })

  it('should parse detailed pain scale with best range', () => {
    const result = parsePainScale('Pain Scale: Worst: 8 ; Best: 2-3 ; Current: 6')
    expect(result).toEqual({ worst: 8, best: { min: 2, max: 3 }, current: 6 })
  })

  it('should return null for invalid format', () => {
    const result = parsePainScale('no pain scale here')
    expect(result).toBeNull()
  })
})

// ============ Pain Type Extractor Tests ============
describe('extractPainTypes', () => {
  it('should extract single pain type', () => {
    const result = extractPainTypes('Dull pain along knee')
    expect(result).toContain('Dull')
  })

  it('should extract multiple pain types', () => {
    const result = extractPainTypes('Dull Aching Freezing pain')
    expect(result).toContain('Dull')
    expect(result).toContain('Aching')
    expect(result).toContain('Freezing')
  })

  it('should be case insensitive', () => {
    const result = extractPainTypes('dull ACHING pain')
    expect(result).toContain('Dull')
    expect(result).toContain('Aching')
  })

  it('should return empty array for no pain types', () => {
    const result = extractPainTypes('no pain description')
    expect(result.length).toBe(0)
  })
})

// ============ Body Part Extractor Tests ============
describe('extractBodyPart', () => {
  it('should extract right knee', () => {
    const result = extractBodyPart('pain along right knee area')
    expect(result).toBe('right knee')
  })

  it('should extract left shoulder', () => {
    const result = extractBodyPart('pain in left shoulder region')
    expect(result).toBe('left shoulder')
  })

  it('should extract cervical/neck', () => {
    const result = extractBodyPart('pain along cervical spine')
    expect(result).toBe('cervical')
  })

  it('should extract lower back', () => {
    const result = extractBodyPart('pain in lower back area')
    expect(result).toBe('lower back')
  })

  it('should return empty string for unknown body part', () => {
    const result = extractBodyPart('pain somewhere')
    expect(result).toBe('')
  })
})

// ============ Muscle Test Parsers Tests ============
describe('parseTightnessMuscles', () => {
  it('should parse tightness muscles and grading scale', () => {
    const text = `Tightness muscles noted along Quadriceps, IT Band, Gastrocnemius
Grading Scale: moderate`
    const result = parseTightnessMuscles(text)
    expect(result).not.toBeNull()
    expect(result?.muscles).toContain('Quadriceps')
    expect(result?.muscles).toContain('IT Band')
    expect(result?.gradingScale).toBe('moderate')
  })

  it('should return null for missing section', () => {
    const result = parseTightnessMuscles('no tightness info')
    expect(result).toBeNull()
  })
})

describe('parseTendernessMuscles', () => {
  it('should parse tenderness muscles and scale', () => {
    const text = `Tenderness muscles noted along Quadriceps, IT Band
Grading Scale: (+2) = moderate pain, patient winces`
    const result = parseTendernessMuscles(text)
    expect(result).not.toBeNull()
    expect(result?.muscles).toContain('Quadriceps')
    expect(result?.scale).toBe(2)
    expect(result?.scaleDescription).toContain('moderate pain')
  })
})

describe('parseSpasmMuscles', () => {
  it('should parse spasm muscles and frequency scale', () => {
    const text = `Muscles spasm noted along Quadriceps, Gastrocnemius
Frequency Grading Scale: (+2) = occasional, seen in less than 25% visits`
    const result = parseSpasmMuscles(text)
    expect(result).not.toBeNull()
    expect(result?.muscles).toContain('Quadriceps')
    expect(result?.frequencyScale).toBe(2)
  })
})

// ============ ROM Parser Tests ============
describe('parseROM', () => {
  it('should parse knee ROM', () => {
    const text = `Right Knee Muscles Strength and Joint ROM
4-/5 Flexion: 110 Degrees(mild)
4/5 Extension: 0 Degrees(normal)`
    const result = parseROM(text)
    expect(result).not.toBeNull()
    expect(result?.bodyPart).toBe('Right Knee')
    expect(result?.items.length).toBe(2)
    expect(result?.items[0].movement).toBe('Flexion')
    expect(result?.items[0].degrees).toBe(110)
  })

  it('should parse cervical ROM', () => {
    const text = `Cervical Muscles Strength and Spine ROM
4/5 Flexion: 40 Degrees(mild)
4/5 Extension: 50 Degrees(mild)
4/5 Left Rotation: 60 Degrees(moderate)`
    const result = parseROM(text)
    expect(result?.bodyPart).toBe('Cervical')
    expect(result?.items.length).toBe(3)
  })

  it('should return null for missing ROM', () => {
    const result = parseROM('no rom data')
    expect(result).toBeNull()
  })
})

// ============ Tongue Pulse Parser Tests ============
describe('parseTonguePulse', () => {
  it('should parse tongue and pulse', () => {
    const text = `tongue
pale, thin white coat
pulse
thready`
    const result = parseTonguePulse(text)
    expect(result).not.toBeNull()
    expect(result?.tongue).toBe('pale, thin white coat')
    expect(result?.pulse).toBe('thready')
  })

  it('should return null for missing data', () => {
    const result = parseTonguePulse('no tongue pulse')
    expect(result).toBeNull()
  })
})

// ============ Diagnosis Code Parser Tests ============
describe('parseDiagnosisCodes', () => {
  it('should parse single diagnosis code', () => {
    const text = 'Diagnosis Code: (1) Pain in right knee(M25.561)'
    const result = parseDiagnosisCodes(text)
    expect(result.length).toBe(1)
    expect(result[0].description).toBe('Pain in right knee')
    expect(result[0].icd10).toBe('M25.561')
  })

  it('should parse multiple diagnosis codes', () => {
    const text = `Diagnosis Code: (1) Pain in right knee(M25.561)
Diagnosis Code: (2) Sprain of knee(S83.9)`
    const result = parseDiagnosisCodes(text)
    expect(result.length).toBe(2)
  })
})

// ============ Procedure Code Parser Tests ============
describe('parseProcedureCodes', () => {
  it('should parse single procedure code', () => {
    const text = 'Procedure Code: (1) ACUP 1/> WO ESTIM 1ST 15 MIN(97810)'
    const result = parseProcedureCodes(text)
    expect(result.length).toBe(1)
    expect(result[0].cpt).toBe('97810')
  })

  it('should parse multiple procedure codes (initial visit)', () => {
    const text = `Procedure Code: (1) OFFICE O/P NEW LOW 30 MIN(99203-25)
(2) ACUP 1/> WO ESTIM 1ST 15 MIN(97810)`
    const result = parseProcedureCodes(text)
    expect(result.length).toBe(2)
    expect(result.some(c => c.cpt === '99203-25')).toBe(true)
    expect(result.some(c => c.cpt === '97810')).toBe(true)
  })
})

// ============ Needle Specs Parser Tests ============
describe('parseNeedleSpecs', () => {
  it('should parse needle specifications', () => {
    const text = '36#x0.5", 34#x1", 30# x1.5"'
    const result = parseNeedleSpecs(text)
    expect(result.length).toBe(3)
    expect(result[0]).toEqual({ gauge: '36#', length: '0.5"' })
    expect(result[1]).toEqual({ gauge: '34#', length: '1"' })
  })

  it('should return empty array for no specs', () => {
    const result = parseNeedleSpecs('no needle specs')
    expect(result.length).toBe(0)
  })
})

// ============ Subjective Parser Tests ============
describe('parseSubjective', () => {
  it('should parse follow-up visit type', () => {
    const result = parseSubjective(SAMPLE_SUBJECTIVE_FOLLOWUP)
    expect(result?.visitType).toBe('Follow up visit')
  })

  it('should parse initial evaluation visit type', () => {
    const result = parseSubjective(SAMPLE_SUBJECTIVE_INITIAL)
    expect(result?.visitType).toBe('INITIAL EVALUATION')
  })

  it('should parse pain frequency', () => {
    const result = parseSubjective(SAMPLE_SUBJECTIVE_FOLLOWUP)
    expect(result?.painFrequency).toBe('Frequent')
  })

  it('should parse walking aid for initial visit', () => {
    const result = parseSubjective(SAMPLE_SUBJECTIVE_INITIAL)
    expect(result?.walkingAid).toBe('none')
  })

  it('should parse medical history for initial visit', () => {
    const result = parseSubjective(SAMPLE_SUBJECTIVE_INITIAL)
    expect(result?.medicalHistory).toContain('Hypertension')
    expect(result?.medicalHistory).toContain('Diabetes')
  })
})

// ============ Objective Parser Tests ============
describe('parseObjective', () => {
  it('should parse inspection type', () => {
    const result = parseObjective(SAMPLE_OBJECTIVE)
    expect(result?.inspection).toBe('local skin no damage or rash')
  })

  it('should parse all muscle tests', () => {
    const result = parseObjective(SAMPLE_OBJECTIVE)
    expect(result?.tightnessMuscles).not.toBeNull()
    expect(result?.tendernessMuscles).not.toBeNull()
    expect(result?.spasmMuscles).not.toBeNull()
  })

  it('should parse ROM', () => {
    const result = parseObjective(SAMPLE_OBJECTIVE)
    expect(result?.rom.bodyPart).toBe('Right Knee')
  })

  it('should parse tongue and pulse', () => {
    const result = parseObjective(SAMPLE_OBJECTIVE)
    expect(result?.tonguePulse.tongue).toBe('pale, thin white coat')
    expect(result?.tonguePulse.pulse).toBe('thready')
  })
})

// ============ Assessment Parser Tests ============
describe('parseAssessment', () => {
  it('should parse general condition', () => {
    const result = parseAssessment(SAMPLE_ASSESSMENT)
    expect(result?.generalCondition).toBe('good')
  })

  it('should parse symptom change', () => {
    const result = parseAssessment(SAMPLE_ASSESSMENT)
    expect(result?.symptomChange).toBe('improvement')
  })
})

// ============ Plan Parser Tests ============
describe('parsePlan', () => {
  it('should parse needle specs', () => {
    const result = parsePlan(SAMPLE_PLAN)
    expect(result?.needleSpecs.length).toBe(3)
  })

  it('should parse treatment time', () => {
    const result = parsePlan(SAMPLE_PLAN)
    expect(result?.treatmentTime).toBe(15)
  })

  it('should parse electrical stimulation', () => {
    const result = parsePlan(SAMPLE_PLAN)
    expect(result?.electricalStimulation).toBe(true)
  })

  it('should parse treatment position', () => {
    const result = parsePlan(SAMPLE_PLAN)
    expect(result?.treatmentPosition).toBe('Front Points')
  })
})

// ============ Full Document Parser Tests ============
describe('parseOptumNote', () => {
  it('should return success for valid document', () => {
    const result = parseOptumNote(SAMPLE_FULL_DOCUMENT)
    expect(result.success).toBe(true)
  })

  it('should parse header correctly', () => {
    const result = parseOptumNote(SAMPLE_FULL_DOCUMENT)
    expect(result.document?.header.patient.name).toBe('SMITH, JANE A')
  })

  it('should parse visits correctly', () => {
    const result = parseOptumNote(SAMPLE_FULL_DOCUMENT)
    expect(result.document?.visits.length).toBeGreaterThan(0)
  })

  it('should return errors for invalid document', () => {
    const result = parseOptumNote('invalid document')
    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should collect warnings for missing optional fields', () => {
    // Document without diagnosis codes should produce warning
    const docWithoutDiagnosis = SAMPLE_FULL_DOCUMENT.replace(/Diagnosis Code:.+/g, '')
    const result = parseOptumNote(docWithoutDiagnosis)
    expect(result.warnings.some(w => w.field.includes('diagnosisCodes'))).toBe(true)
  })
})

// ============ Edge Cases ============
describe('Edge Cases', () => {
  it('should handle joint swelling inspection', () => {
    const text = SAMPLE_OBJECTIVE.replace('local skin no damage or rash', 'joint swelling')
    const result = parseObjective(text)
    expect(result?.inspection).toBe('joint swelling')
  })

  it('should handle weak muscles inspection', () => {
    const text = SAMPLE_OBJECTIVE.replace('local skin no damage or rash', 'weak muscles and dry skin without luster')
    const result = parseObjective(text)
    expect(result?.inspection).toBe('weak muscles and dry skin without luster')
  })

  it('should handle without radiation', () => {
    const result = parseSubjective(SAMPLE_SUBJECTIVE_FOLLOWUP)
    expect(result?.radiation).toBe(false)
  })

  it('should handle with radiation', () => {
    const text = SAMPLE_SUBJECTIVE_FOLLOWUP.replace('without radiation', 'with radiation')
    const result = parseSubjective(text)
    expect(result?.radiation).toBe(true)
  })
})
