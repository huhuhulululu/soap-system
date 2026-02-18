import { buildPatientsFromRows } from '../services/excel-parser'
import type { ExcelRow } from '../types'

function makeRow(overrides: Partial<ExcelRow> = {}): ExcelRow {
  return {
    patient: 'CHEN,AIJIN(09/27/1956)',
    gender: 'F',
    insurance: 'HF',
    bodyPart: 'LBP',
    laterality: 'B',
    icd: 'M54.50,M54.41',
    cpt: '97810,97811x3',
    totalVisits: 3,
    painWorst: '8',
    painBest: '3',
    painCurrent: '6',
    symptomDuration: '3 year(s)',
    painRadiation: 'without radiation',
    painTypes: 'Dull,Aching',
    associatedSymptoms: 'soreness',
    causativeFactors: 'age related/degenerative changes',
    relievingFactors: 'Changing positions,Resting,Massage',
    symptomScale: '70%-80%',
    painFrequency: 'Constant',
    secondaryParts: '',
    history: '',
    ...overrides,
  }
}

describe('excel-parser - buildPatientsFromRows', () => {
  it('builds 1 IE + (N-1) TX visits from totalVisits', () => {
    const result = buildPatientsFromRows([makeRow({ totalVisits: 3 })])
    expect(result.patients).toHaveLength(1)
    expect(result.patients[0].visits).toHaveLength(3)
    expect(result.patients[0].visits[0].noteType).toBe('IE')
    expect(result.patients[0].visits[1].noteType).toBe('TX')
    expect(result.patients[0].visits[2].noteType).toBe('TX')
    expect(result.summary.totalVisits).toBe(3)
  })

  it('auto-numbers TX visits', () => {
    const result = buildPatientsFromRows([makeRow({ totalVisits: 4 })])
    const visits = result.patients[0].visits
    expect(visits[0].txNumber).toBeNull()
    expect(visits[1].txNumber).toBe(1)
    expect(visits[2].txNumber).toBe(2)
    expect(visits[3].txNumber).toBe(3)
  })

  it('parses ICD codes', () => {
    const result = buildPatientsFromRows([makeRow()])
    const codes = result.patients[0].visits[0].icdCodes
    expect(codes).toHaveLength(2)
    expect(codes[0].code).toBe('M54.50')
    expect(codes[1].code).toBe('M54.41')
  })

  it('auto-fills CPT for TX when no CPT specified', () => {
    const result = buildPatientsFromRows([makeRow({ cpt: '', totalVisits: 2 })])
    const txCpt = result.patients[0].visits[1].cptCodes
    expect(txCpt.length).toBeGreaterThan(0)
    expect(txCpt[0].code).toBe('97810')
  })

  it('parses user-specified CPT with units', () => {
    const result = buildPatientsFromRows([makeRow({ cpt: '97810,97811x3,97140' })])
    const cpt = result.patients[0].visits[0].cptCodes
    expect(cpt).toHaveLength(3)
    expect(cpt[0]).toEqual({ code: '97810', name: expect.any(String), units: 1 })
    expect(cpt[1]).toEqual({ code: '97811', name: expect.any(String), units: 3 })
    expect(cpt[2]).toEqual({ code: '97140', name: expect.any(String), units: 1 })
  })

  it('parses patient name and DOB', () => {
    const result = buildPatientsFromRows([makeRow()])
    expect(result.patients[0].name).toBe('CHEN,AIJIN')
    expect(result.patients[0].dob).toBe('09/27/1956')
    expect(result.patients[0].age).toBeGreaterThan(60)
  })

  it('sets gender correctly', () => {
    const male = buildPatientsFromRows([makeRow({ gender: 'M' })])
    const female = buildPatientsFromRows([makeRow({ gender: 'F' })])
    expect(male.patients[0].gender).toBe('Male')
    expect(female.patients[0].gender).toBe('Female')
  })

  it('handles multiple patients', () => {
    const rows = [
      makeRow({ patient: 'CHEN,AIJIN(09/27/1956)' }),
      makeRow({ patient: 'WANG,MEI(03/15/1960)', icd: 'M75.12' }),
    ]
    const result = buildPatientsFromRows(rows)
    expect(result.patients).toHaveLength(2)
    expect(result.summary.totalPatients).toBe(2)
  })

  it('parses laterality correctly', () => {
    const cases = [
      { input: 'B', expected: 'bilateral' },
      { input: 'L', expected: 'left' },
      { input: 'R', expected: 'right' },
    ] as const
    for (const { input, expected } of cases) {
      const result = buildPatientsFromRows([makeRow({ laterality: input })])
      expect(result.patients[0].visits[0].laterality).toBe(expected)
    }
  })

  it('parses secondary parts', () => {
    const result = buildPatientsFromRows([makeRow({ secondaryParts: 'NECK,SHOULDER' })])
    expect(result.patients[0].visits[0].secondaryParts).toEqual(['NECK', 'SHOULDER'])
  })

  it('parses history', () => {
    const result = buildPatientsFromRows([makeRow({ history: 'HTN,DM,Pacemaker' })])
    expect(result.patients[0].visits[0].history).toEqual(['HTN', 'DM', 'Pacemaker'])
  })

  it('counts by type in summary', () => {
    const result = buildPatientsFromRows([makeRow({ totalVisits: 3 })])
    expect(result.summary.byType).toEqual({ IE: 1, TX: 2 })
  })

  it('throws if ICD missing in full mode', () => {
    expect(() => buildPatientsFromRows([makeRow({ icd: '' })], 'full')).toThrow()
  })

  it('allows empty ICD in soap-only mode', () => {
    const result = buildPatientsFromRows([makeRow({ icd: '', cpt: '' })], 'soap-only')
    expect(result.patients).toHaveLength(1)
  })

  it('throws for invalid insurance', () => {
    expect(() => buildPatientsFromRows([makeRow({ insurance: 'INVALID' })])).toThrow('Invalid insurance')
  })

  it('throws for invalid gender', () => {
    expect(() => buildPatientsFromRows([makeRow({ gender: 'X' as 'M' })])).toThrow('Gender must be M or F')
  })

  it('ICD names are resolved from catalog', () => {
    const result = buildPatientsFromRows([makeRow({ icd: 'M54.50' })])
    expect(result.patients[0].visits[0].icdCodes[0].name).toBe('Low back pain, unspecified')
  })
})
