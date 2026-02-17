import { groupAndNumberVisits } from '../services/excel-parser'
import type { ExcelRow } from '../types'

function makeRow(overrides: Partial<ExcelRow> = {}): ExcelRow {
  return {
    dos: 1,
    patient: 'CHEN,AIJIN(09/27/1956)',
    gender: 'F',
    insurance: 'HF',
    bodyPart: 'LBP',
    laterality: 'B',
    noteType: 'IE',
    icd: 'M54.50,M54.41',
    cpt: '97810,97811x3',
    secondaryParts: '',
    history: '',
    ...overrides,
  }
}

describe('excel-parser - groupAndNumberVisits', () => {
  it('groups visits by patient', () => {
    const rows: ExcelRow[] = [
      makeRow({ dos: 1, noteType: 'IE' }),
      makeRow({ dos: 2, noteType: 'TX', icd: '', cpt: '' }),
      makeRow({ dos: 3, noteType: 'TX', icd: '', cpt: '' }),
    ]
    const result = groupAndNumberVisits(rows)
    expect(result.patients).toHaveLength(1)
    expect(result.patients[0].visits).toHaveLength(3)
    expect(result.summary.totalPatients).toBe(1)
    expect(result.summary.totalVisits).toBe(3)
  })

  it('auto-numbers TX visits', () => {
    const rows: ExcelRow[] = [
      makeRow({ dos: 1, noteType: 'IE' }),
      makeRow({ dos: 2, noteType: 'TX', icd: '', cpt: '' }),
      makeRow({ dos: 3, noteType: 'TX', icd: '', cpt: '' }),
      makeRow({ dos: 4, noteType: 'RE', icd: '', cpt: '97161' }),
    ]
    const result = groupAndNumberVisits(rows)
    const visits = result.patients[0].visits

    expect(visits[0].txNumber).toBeNull()   // IE
    expect(visits[1].txNumber).toBe(1)      // TX#1
    expect(visits[2].txNumber).toBe(2)      // TX#2
    expect(visits[3].txNumber).toBeNull()   // RE
  })

  it('inherits ICD from previous row', () => {
    const rows: ExcelRow[] = [
      makeRow({ dos: 1, noteType: 'IE', icd: 'M54.50,M54.41' }),
      makeRow({ dos: 2, noteType: 'TX', icd: '', cpt: '' }),
    ]
    const result = groupAndNumberVisits(rows)
    const visits = result.patients[0].visits

    expect(visits[0].icdCodes).toHaveLength(2)
    expect(visits[1].icdCodes).toHaveLength(2)
    expect(visits[1].icdCodes[0].code).toBe('M54.50')
  })

  it('auto-fills CPT for TX based on insurance', () => {
    const rows: ExcelRow[] = [
      makeRow({ dos: 1, noteType: 'TX', insurance: 'HF', cpt: '' }),
    ]
    const result = groupAndNumberVisits(rows)
    const cpt = result.patients[0].visits[0].cptCodes

    expect(cpt).toHaveLength(1)
    expect(cpt[0].code).toBe('97810')
    expect(cpt[0].units).toBe(1)
  })

  it('auto-fills CPT for WC with 3 codes', () => {
    const rows: ExcelRow[] = [
      makeRow({ dos: 1, noteType: 'TX', insurance: 'WC', icd: 'M17.11', cpt: '' }),
    ]
    const result = groupAndNumberVisits(rows)
    const cpt = result.patients[0].visits[0].cptCodes

    expect(cpt).toHaveLength(3)
    expect(cpt[0].code).toBe('97813')
    expect(cpt[1]).toEqual({ code: '97814', name: expect.any(String), units: 2 })
    expect(cpt[2]).toEqual({ code: '97811', name: expect.any(String), units: 1 })
  })

  it('parses user-specified CPT with units', () => {
    const rows: ExcelRow[] = [
      makeRow({ dos: 1, noteType: 'IE', cpt: '97810,97811x3,97140' }),
    ]
    const result = groupAndNumberVisits(rows)
    const cpt = result.patients[0].visits[0].cptCodes

    expect(cpt).toHaveLength(3)
    expect(cpt[0]).toEqual({ code: '97810', name: expect.any(String), units: 1 })
    expect(cpt[1]).toEqual({ code: '97811', name: expect.any(String), units: 3 })
    expect(cpt[2]).toEqual({ code: '97140', name: expect.any(String), units: 1 })
  })

  it('parses patient name and DOB', () => {
    const rows: ExcelRow[] = [makeRow()]
    const result = groupAndNumberVisits(rows)

    expect(result.patients[0].name).toBe('CHEN,AIJIN')
    expect(result.patients[0].dob).toBe('09/27/1956')
    expect(result.patients[0].age).toBeGreaterThan(60)
  })

  it('sets gender correctly', () => {
    const maleRows: ExcelRow[] = [makeRow({ gender: 'M' })]
    const femaleRows: ExcelRow[] = [makeRow({ gender: 'F' })]

    expect(groupAndNumberVisits(maleRows).patients[0].gender).toBe('Male')
    expect(groupAndNumberVisits(femaleRows).patients[0].gender).toBe('Female')
  })

  it('handles multiple patients', () => {
    const rows: ExcelRow[] = [
      makeRow({ dos: 1, patient: 'CHEN,AIJIN(09/27/1956)' }),
      makeRow({ dos: 1, patient: 'WANG,MEI(03/15/1960)', icd: 'M75.12' }),
    ]
    const result = groupAndNumberVisits(rows)

    expect(result.patients).toHaveLength(2)
    expect(result.summary.totalPatients).toBe(2)
  })

  it('normalizes body part aliases', () => {
    const rows: ExcelRow[] = [makeRow({ bodyPart: 'SHLDR' })]
    const result = groupAndNumberVisits(rows)
    expect(result.patients[0].visits[0].bodyPart).toBe('SHOULDER')
  })

  it('parses laterality correctly', () => {
    const cases: Array<{ input: string; expected: string }> = [
      { input: 'B', expected: 'bilateral' },
      { input: 'L', expected: 'left' },
      { input: 'R', expected: 'right' },
    ]
    for (const { input, expected } of cases) {
      const rows: ExcelRow[] = [makeRow({ laterality: input })]
      const result = groupAndNumberVisits(rows)
      expect(result.patients[0].visits[0].laterality).toBe(expected)
    }
  })

  it('parses secondary parts', () => {
    const rows: ExcelRow[] = [makeRow({ secondaryParts: 'NECK,SHOULDER' })]
    const result = groupAndNumberVisits(rows)
    expect(result.patients[0].visits[0].secondaryParts).toEqual(['NECK', 'SHOULDER'])
  })

  it('parses history', () => {
    const rows: ExcelRow[] = [makeRow({ history: 'HTN,DM,Pacemaker' })]
    const result = groupAndNumberVisits(rows)
    expect(result.patients[0].visits[0].history).toEqual(['HTN', 'DM', 'Pacemaker'])
  })

  it('counts by type in summary', () => {
    const rows: ExcelRow[] = [
      makeRow({ dos: 1, noteType: 'IE' }),
      makeRow({ dos: 2, noteType: 'TX', icd: '', cpt: '' }),
      makeRow({ dos: 3, noteType: 'TX', icd: '', cpt: '' }),
    ]
    const result = groupAndNumberVisits(rows)
    expect(result.summary.byType).toEqual({ IE: 1, TX: 2 })
  })

  it('throws if first visit has no ICD', () => {
    const rows: ExcelRow[] = [makeRow({ icd: '' })]
    expect(() => groupAndNumberVisits(rows)).toThrow('first visit must have ICD')
  })

  it('throws for invalid insurance', () => {
    const rows: ExcelRow[] = [makeRow({ insurance: 'INVALID' })]
    expect(() => groupAndNumberVisits(rows)).toThrow('Invalid insurance')
  })

  it('throws for invalid note type', () => {
    const rows: ExcelRow[] = [makeRow({ noteType: 'XX' })]
    expect(() => groupAndNumberVisits(rows)).toThrow('Invalid note type')
  })

  it('throws for invalid gender', () => {
    const rows: ExcelRow[] = [makeRow({ gender: 'X' as 'M' })]
    expect(() => groupAndNumberVisits(rows)).toThrow('Gender must be M or F')
  })

  it('ICD names are resolved from catalog', () => {
    const rows: ExcelRow[] = [makeRow({ icd: 'M54.50' })]
    const result = groupAndNumberVisits(rows)
    expect(result.patients[0].visits[0].icdCodes[0].name).toBe('Low back pain, unspecified')
  })
})
