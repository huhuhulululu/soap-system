import { generateBatch, regenerateVisit, type BatchGenerationResult } from '../services/batch-generator'
import type { BatchData, BatchPatient, BatchPatientClinical, BatchVisit } from '../types'

function makeClinical(overrides: Partial<BatchPatientClinical> = {}): BatchPatientClinical {
  return {
    painWorst: 8,
    painBest: 3,
    painCurrent: 6,
    severityLevel: 'moderate',
    symptomDuration: { value: '3', unit: 'year(s)' },
    painRadiation: 'without radiation',
    painTypes: ['Dull', 'Aching'],
    associatedSymptoms: ['soreness'],
    causativeFactors: ['age related/degenerative changes'],
    relievingFactors: ['Changing positions', 'Resting', 'Massage'],
    symptomScale: '70%-80%',
    painFrequency: 'Constant (symptoms occur between 76% and 100% of the time)',
    ...overrides,
  }
}

function makeVisit(overrides: Partial<BatchVisit> = {}): BatchVisit {
  return {
    index: 0,
    dos: 1,
    noteType: 'IE',
    txNumber: null,
    bodyPart: 'LBP',
    laterality: 'bilateral',
    secondaryParts: [],
    history: [],
    icdCodes: [{ code: 'M54.50', name: 'Low back pain, unspecified' }],
    cptCodes: [{ code: '97810', name: 'ACUP 1/> WO ESTIM 1ST 15 MIN', units: 1 }],
    generated: null,
    status: 'pending',
    ...overrides,
  }
}

function makePatient(overrides: Partial<BatchPatient> = {}): BatchPatient {
  return {
    name: 'CHEN,AIJIN',
    dob: '09/27/1956',
    age: 69,
    gender: 'Female',
    insurance: 'HF',
    clinical: makeClinical(),
    visits: [makeVisit()],
    ...overrides,
  }
}

function makeBatch(patients: BatchPatient[]): BatchData {
  return {
    batchId: 'test_batch_gen',
    createdAt: new Date().toISOString(),
    confirmed: false,
    patients,
    summary: {
      totalPatients: patients.length,
      totalVisits: patients.reduce((sum, p) => sum + p.visits.length, 0),
      byType: {},
    },
  }
}

describe('batch-generator', () => {
  describe('generateBatch', () => {
    it('generates SOAP for a single IE visit', () => {
      const batch = makeBatch([makePatient()])
      const result = generateBatch(batch)

      expect(result.totalGenerated).toBe(1)
      expect(result.totalFailed).toBe(0)
      expect(result.patients).toHaveLength(1)

      const visit = result.patients[0].visits[0]
      expect(visit.status).toBe('done')
      expect(visit.generated).not.toBeNull()
      expect(visit.generated!.fullText).toContain('Subjective')
      expect(visit.generated!.fullText).toContain('Objective')
      expect(visit.generated!.fullText).toContain('Assessment')
      expect(visit.generated!.fullText).toContain('Plan')
      expect(visit.generated!.soap.subjective).toBeTruthy()
      expect(visit.generated!.soap.objective).toBeTruthy()
      expect(visit.generated!.soap.assessment).toBeTruthy()
      expect(visit.generated!.soap.plan).toBeTruthy()
    })

    it('generates TX series with sequential progression', () => {
      const visits = [
        makeVisit({ index: 0, dos: 1, noteType: 'IE', txNumber: null }),
        makeVisit({ index: 1, dos: 2, noteType: 'TX', txNumber: 1 }),
        makeVisit({ index: 2, dos: 3, noteType: 'TX', txNumber: 2 }),
        makeVisit({ index: 3, dos: 4, noteType: 'TX', txNumber: 3 }),
      ]
      const batch = makeBatch([makePatient({ visits })])
      const result = generateBatch(batch)

      expect(result.totalGenerated).toBe(4)
      expect(result.totalFailed).toBe(0)

      // All visits should be generated
      for (const visit of result.patients[0].visits) {
        expect(visit.status).toBe('done')
        expect(visit.generated).not.toBeNull()
        expect(visit.generated!.fullText.length).toBeGreaterThan(100)
      }
    })

    it('generates with patient-specific clinical data', () => {
      const patient = makePatient({
        clinical: makeClinical({
          painCurrent: 9,
          severityLevel: 'severe',
          painTypes: ['Stabbing', 'Burning'],
          symptomScale: '90%',
        }),
      })
      const batch = makeBatch([patient])
      const result = generateBatch(batch)

      expect(result.totalGenerated).toBe(1)
      const text = result.patients[0].visits[0].generated!.fullText
      // Severe pain should influence the generated content
      expect(text).toContain('Subjective')
    })

    it('handles RE visits', () => {
      const visits = [
        makeVisit({ index: 0, dos: 1, noteType: 'IE', cptCodes: [{ code: '97161', name: 'PT EVAL LOW COMPLEX 20 MIN', units: 1 }] }),
        makeVisit({ index: 1, dos: 2, noteType: 'RE', cptCodes: [{ code: '97161', name: 'PT EVAL LOW COMPLEX 20 MIN', units: 1 }] }),
      ]
      const batch = makeBatch([makePatient({ visits })])
      const result = generateBatch(batch)

      // RE generates as IE (re-evaluation)
      expect(result.totalGenerated).toBe(2)
      const reVisit = result.patients[0].visits[1]
      expect(reVisit.status).toBe('done')
      expect(reVisit.generated).not.toBeNull()
    })

    it('handles multiple patients', () => {
      const patient1 = makePatient({
        name: 'CHEN,AIJIN',
        visits: [makeVisit({ index: 0, noteType: 'IE' })],
      })
      const patient2 = makePatient({
        name: 'WANG,MEI',
        insurance: 'WC',
        visits: [makeVisit({ index: 0, noteType: 'IE' })],
      })
      const batch = makeBatch([patient1, patient2])
      const result = generateBatch(batch)

      expect(result.totalGenerated).toBe(2)
      expect(result.patients).toHaveLength(2)
    })

    it('preserves batchId in result', () => {
      const batch = makeBatch([makePatient()])
      const result = generateBatch(batch)
      expect(result.batchId).toBe('test_batch_gen')
    })

    it('handles Pacemaker in medical history', () => {
      const patient = makePatient({
        visits: [makeVisit({ history: ['Pacemaker'] })],
      })
      const batch = makeBatch([patient])
      const result = generateBatch(batch)

      expect(result.totalGenerated).toBe(1)
      // Pacemaker should trigger no-estim precaution
      const text = result.patients[0].visits[0].generated!.fullText
      expect(text).toContain('Pacemaker')
    })

    it('preserves visit order after generation', () => {
      const visits = [
        makeVisit({ index: 0, dos: 1, noteType: 'IE' }),
        makeVisit({ index: 1, dos: 2, noteType: 'TX', txNumber: 1 }),
        makeVisit({ index: 2, dos: 3, noteType: 'RE', cptCodes: [{ code: '97161', name: 'PT EVAL LOW COMPLEX 20 MIN', units: 1 }] }),
        makeVisit({ index: 3, dos: 4, noteType: 'TX', txNumber: 2 }),
      ]
      const batch = makeBatch([makePatient({ visits })])
      const result = generateBatch(batch)

      const resultVisits = result.patients[0].visits
      expect(resultVisits[0].noteType).toBe('IE')
      expect(resultVisits[1].noteType).toBe('TX')
      expect(resultVisits[2].noteType).toBe('RE')
      expect(resultVisits[3].noteType).toBe('TX')
    })

    it('generates SOAP sections as split text', () => {
      const batch = makeBatch([makePatient()])
      const result = generateBatch(batch)
      const soap = result.patients[0].visits[0].generated!.soap

      // Each section should be non-empty text (not HTML)
      expect(soap.subjective).not.toContain('<p>')
      expect(soap.objective).not.toContain('<p>')
      expect(soap.assessment).not.toContain('<p>')
      expect(soap.plan).not.toContain('<p>')
    })
  })

  describe('regenerateVisit', () => {
    it('regenerates a single visit with new seed', () => {
      const patient = makePatient()
      const visit = makeVisit()

      const result = regenerateVisit(patient, visit, 42)

      expect(result.status).toBe('done')
      expect(result.generated).not.toBeNull()
      expect(result.generated!.seed).toBe(42)
      expect(result.generated!.fullText).toContain('Subjective')
    })

    it('generates different content with different body parts', () => {
      const patient = makePatient()
      const lbpVisit = makeVisit({ bodyPart: 'LBP' })
      const shoulderVisit = makeVisit({
        bodyPart: 'SHOULDER',
        icdCodes: [{ code: 'M25.511', name: 'Pain in right shoulder' }],
      })

      const lbpResult = regenerateVisit(patient, lbpVisit, 100)
      const shoulderResult = regenerateVisit(patient, shoulderVisit, 100)

      // Different body parts should produce different SOAP content
      expect(lbpResult.generated!.fullText).not.toBe(shoulderResult.generated!.fullText)
    })
  })
})
