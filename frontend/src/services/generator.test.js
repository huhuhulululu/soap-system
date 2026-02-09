import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateContinuation } from './generator.js'

describe('generateContinuation', () => {
  // Sample valid IE+TX text for testing
  const validIEText = `PATIENT: DOE, JOHN (DOB: 01/01/1980 ID: 1234567890) Date of Service: 01/15/2025

INITIAL EVALUATION

SUBJECTIVE:
Chief Complaint: Low back pain
Chronicity Level: Chronic
Symptom Duration: 6 month(s)
Pain Scale: Current: 8/10, Worst: 10/10, Best: 5/10
Pain Frequency: Constant
Pain Location: Lower back, bilateral
Exacerbating Factors: Sitting, bending
Alleviating Factors: Rest, heat
ADL Difficulty: Moderate difficulty with dressing, bathing

OBJECTIVE:
Tightness of Muscles: Moderate to severe bilateral paraspinal muscles
Tenderness of Muscles: (+3) bilateral L4-L5 paraspinal region
Spasm of Muscles: Frequency scale 3/4 bilateral lower lumbar
Range of Motion: Flexion 40° (limited), Extension 15° (limited)

ASSESSMENT:
Primary Body Part: Lower back
Laterality: Bilateral
Local Pattern: Muscle spasm pattern
Diagnosis Codes:
  (1) Low back pain (M54.5)
  (2) Muscle spasm (M62.83)

PLAN:
Treatment: Acupuncture with electrical stimulation
Frequency: 2x/week for 6 weeks
Goals: Reduce pain by 50%, improve ROM, reduce muscle spasm
`

  const validTXText = `PATIENT: DOE, JOHN (DOB: 01/01/1980 ID: 1234567890) Date of Service: 01/22/2025

TREATMENT NOTE #1

SUBJECTIVE:
Pain Scale: Current: 6/10
Pain Frequency: Frequent
Chief Complaint: Low back pain improving

OBJECTIVE:
Tightness of Muscles: Moderate bilateral paraspinal muscles
Tenderness of Muscles: (+2) bilateral L4-L5 paraspinal region
Spasm of Muscles: Frequency scale 2/4 bilateral lower lumbar
`

  describe('Basic Parsing', () => {
    it('should successfully parse valid IE note', () => {
      const result = generateContinuation(validIEText, {
        insuranceType: 'OPTUM',
        treatmentTime: 60,
        generateCount: 1
      })

      expect(result.error).toBeUndefined()
      expect(result.visits).toBeDefined()
      expect(result.context).toBeDefined()
      expect(result.ieVisit).toBeDefined()
    })

    it('should return error for invalid text', () => {
      const result = generateContinuation('random invalid text', {
        insuranceType: 'OPTUM',
        treatmentTime: 60,
        generateCount: 1
      })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('解析失败')
      expect(result.visits).toEqual([])
    })

    it('should return error when no IE found', () => {
      const noIEText = `PATIENT: DOE, JOHN (DOB: 01/01/1980 ID: 1234567890)
TREATMENT NOTE #1
SUBJECTIVE: Pain improved`

      const result = generateContinuation(noIEText, {
        insuranceType: 'OPTUM',
        treatmentTime: 60,
        generateCount: 1
      })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('未找到初诊记录')
      expect(result.visits).toEqual([])
    })

    it('should auto-inject header when missing', () => {
      const noHeaderText = `INITIAL EVALUATION
SUBJECTIVE:
Chief Complaint: Low back pain
Pain Scale: Current: 8/10`

      const result = generateContinuation(noHeaderText)

      // Should not crash and should have tried to parse
      expect(result).toBeDefined()
    })
  })

  describe('TX Count Management', () => {
    it('should calculate existing TX count correctly', () => {
      const result = generateContinuation(validIEText + validTXText, {
        generateCount: 1
      })

      expect(result.error).toBeUndefined()
      expect(result.existingTxCount).toBe(1)
    })

    it('should enforce 11 TX maximum', () => {
      // Create IE + 11 TX notes
      let text = validIEText
      for (let i = 1; i <= 11; i++) {
        text += `\n\nTREATMENT NOTE #${i}\nSUBJECTIVE:\nPain Scale: Current: 5/10\n`
      }

      const result = generateContinuation(text, {
        generateCount: 1
      })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('已达上限')
      expect(result.visits).toEqual([])
    })

    it('should respect generateCount parameter', () => {
      const result = generateContinuation(validIEText, {
        generateCount: 3
      })

      expect(result.error).toBeUndefined()
      expect(result.visits).toHaveLength(3)
    })

    it('should cap generateCount at remaining capacity', () => {
      const result = generateContinuation(validIEText + validTXText, {
        generateCount: 50 // Request more than possible
      })

      expect(result.error).toBeUndefined()
      expect(result.visits.length).toBeLessThanOrEqual(10) // Max 11 - 1 existing = 10
    })
  })

  describe('Bridge and Context Conversion', () => {
    it('should create valid context from parsed document', () => {
      const result = generateContinuation(validIEText, {
        generateCount: 1
      })

      expect(result.context).toBeDefined()
      expect(result.context.noteType).toBe('TX')
      expect(result.context.insuranceType).toBe('OPTUM')
      expect(result.context.previousIE).toBeDefined()
      expect(result.context.primaryBodyPart).toBeDefined()
    })

    it('should respect insuranceType parameter', () => {
      const result = generateContinuation(validIEText, {
        insuranceType: 'HF',
        generateCount: 1
      })

      expect(result.context.insuranceType).toBe('HF')
    })

    it('should extract body part from IE', () => {
      const result = generateContinuation(validIEText, {
        generateCount: 1
      })

      expect(result.parseSummary.bodyPart).toBeDefined()
    })
  })

  describe('Initial State Extraction', () => {
    it('should extract pain from last TX', () => {
      const result = generateContinuation(validIEText + validTXText, {
        generateCount: 1
      })

      expect(result.parseSummary.lastTxPain).toBeDefined()
      expect(result.parseSummary.lastTxPain).toBe(6) // From TX note
    })

    it('should use IE pain when no TX exists', () => {
      const result = generateContinuation(validIEText, {
        generateCount: 1
      })

      expect(result.parseSummary.iePain).toBe(8)
      expect(result.parseSummary.lastTxPain).toBeUndefined()
    })

    it('should extract tightness severity', () => {
      // This is tested indirectly through state generation
      const result = generateContinuation(validIEText + validTXText, {
        generateCount: 1
      })

      expect(result.visits[0].state).toBeDefined()
      expect(result.visits[0].state.tightness).toBeDefined()
    })

    it('should extract tenderness from scale description', () => {
      const result = generateContinuation(validIEText + validTXText, {
        generateCount: 1
      })

      expect(result.visits[0].state.tenderness).toBeDefined()
    })

    it('should extract spasm frequency', () => {
      const result = generateContinuation(validIEText + validTXText, {
        generateCount: 1
      })

      expect(result.visits[0].state.spasm).toBeDefined()
    })
  })

  describe('TX Sequence Generation', () => {
    it('should generate correct number of visits', () => {
      const result = generateContinuation(validIEText, {
        generateCount: 5
      })

      expect(result.visits).toHaveLength(5)
    })

    it('should have sequential visit indices', () => {
      const result = generateContinuation(validIEText, {
        generateCount: 3
      })

      expect(result.visits[0].visitIndex).toBe(1)
      expect(result.visits[1].visitIndex).toBe(2)
      expect(result.visits[2].visitIndex).toBe(3)
    })

    it('should continue from existing TX count', () => {
      const result = generateContinuation(validIEText + validTXText, {
        generateCount: 2
      })

      expect(result.visits[0].visitIndex).toBe(2) // Start after existing TX #1
      expect(result.visits[1].visitIndex).toBe(3)
    })

    it('should generate valid state for each visit', () => {
      const result = generateContinuation(validIEText, {
        generateCount: 2
      })

      result.visits.forEach(visit => {
        expect(visit.state).toBeDefined()
        expect(visit.state.pain).toBeDefined()
        expect(visit.state.tightness).toBeDefined()
        expect(visit.state.tenderness).toBeDefined()
        expect(visit.state.spasm).toBeDefined()
      })
    })
  })

  describe('SOAP Text Export', () => {
    it('should export valid SOAP text for each visit', () => {
      const result = generateContinuation(validIEText, {
        generateCount: 1
      })

      expect(result.visits[0].text).toBeDefined()
      expect(result.visits[0].text.length).toBeGreaterThan(0)
    })

    it('should include all SOAP sections', () => {
      const result = generateContinuation(validIEText, {
        generateCount: 1
      })

      const text = result.visits[0].text
      expect(text).toContain('SUBJECTIVE')
      expect(text).toContain('OBJECTIVE')
      expect(text).toContain('ASSESSMENT')
      expect(text).toContain('PLAN')
    })
  })

  describe('ICD/CPT Formatting', () => {
    it('should include ICD codes from IE', () => {
      const result = generateContinuation(validIEText, {
        generateCount: 1
      })

      const text = result.visits[0].text
      expect(text).toContain('Diagnosis Code:')
      expect(text).toContain('M54.5') // Low back pain
    })

    it('should use 97810/97811 for OPTUM insurance', () => {
      const result = generateContinuation(validIEText, {
        insuranceType: 'OPTUM',
        treatmentTime: 60,
        generateCount: 1
      })

      const text = result.visits[0].text
      expect(text).toContain('97810') // Base code without estim
      expect(text).toContain('ACUP 1/> WO ESTIM')
    })

    it('should use 97810/97811 for HF insurance', () => {
      const result = generateContinuation(validIEText, {
        insuranceType: 'HF',
        treatmentTime: 60,
        generateCount: 1
      })

      const text = result.visits[0].text
      expect(text).toContain('97810')
      expect(text).toContain('ACUP 1/> WO ESTIM')
    })

    it('should use 97813/97814 for other insurance', () => {
      const result = generateContinuation(validIEText, {
        insuranceType: 'OTHER',
        treatmentTime: 60,
        generateCount: 1
      })

      const text = result.visits[0].text
      expect(text).toContain('97813') // Base code with estim
      expect(text).toContain('ACUP W/ ESTIM')
    })

    it('should calculate correct CPT units based on treatment time', () => {
      const result60 = generateContinuation(validIEText, {
        treatmentTime: 60,
        generateCount: 1
      })

      const text60 = result60.visits[0].text
      const cptCount60 = (text60.match(/Procedure Code:/g) || []).length
      expect(cptCount60).toBe(4) // 60min = 4 units

      const result30 = generateContinuation(validIEText, {
        treatmentTime: 30,
        generateCount: 1
      })

      const text30 = result30.visits[0].text
      const cptCount30 = (text30.match(/Procedure Code:/g) || []).length
      expect(cptCount30).toBe(2) // 30min = 2 units
    })

    it('should force no-estim codes when pacemaker present', () => {
      const pacemakerIE = validIEText.replace(
        'PLAN:',
        'Pacemaker: Yes\n\nPLAN:'
      )

      const result = generateContinuation(pacemakerIE, {
        insuranceType: 'OTHER', // Would normally use estim
        treatmentTime: 60,
        generateCount: 1
      })

      const text = result.visits[0].text
      expect(text).toContain('97810') // Should use no-estim despite OTHER insurance
      expect(text).not.toContain('97813')
    })
  })

  describe('Whitelist Initialization', () => {
    it('should initialize whitelist only once', () => {
      // Call multiple times
      generateContinuation(validIEText, { generateCount: 1 })
      generateContinuation(validIEText, { generateCount: 1 })

      // Should not crash, whitelist should be set
      const result = generateContinuation(validIEText, { generateCount: 1 })
      expect(result.error).toBeUndefined()
    })
  })

  describe('Parse Summary', () => {
    it('should include comprehensive parse summary', () => {
      const result = generateContinuation(validIEText + validTXText, {
        generateCount: 2
      })

      expect(result.parseSummary).toBeDefined()
      expect(result.parseSummary.bodyPart).toBeDefined()
      expect(result.parseSummary.existingTxCount).toBe(1)
      expect(result.parseSummary.toGenerate).toBe(2)
    })
  })

  describe('Error Handling', () => {
    it('should handle empty input gracefully', () => {
      const result = generateContinuation('', {
        generateCount: 1
      })

      expect(result.error).toBeDefined()
      expect(result.visits).toEqual([])
    })

    it('should handle null input', () => {
      const result = generateContinuation(null, {
        generateCount: 1
      })

      expect(result.error).toBeDefined()
      expect(result.visits).toEqual([])
    })

    it('should provide meaningful error messages', () => {
      const result = generateContinuation('invalid', {
        generateCount: 1
      })

      expect(result.error).toBeDefined()
      expect(typeof result.error).toBe('string')
      expect(result.error.length).toBeGreaterThan(0)
    })
  })

  describe('Default Options', () => {
    it('should use default insurance type when not specified', () => {
      const result = generateContinuation(validIEText)

      expect(result.context.insuranceType).toBe('OPTUM')
    })

    it('should use default treatment time when not specified', () => {
      const result = generateContinuation(validIEText, {
        generateCount: 1
      })

      const text = result.visits[0].text
      const cptCount = (text.match(/Procedure Code:/g) || []).length
      expect(cptCount).toBe(4) // Default 60min = 4 units
    })

    it('should generate maximum possible visits when count not specified', () => {
      const result = generateContinuation(validIEText)

      expect(result.visits.length).toBeGreaterThan(0)
      expect(result.visits.length).toBeLessThanOrEqual(11)
    })
  })
})
