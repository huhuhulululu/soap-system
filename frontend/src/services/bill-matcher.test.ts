import { describe, it, expect } from 'vitest'
import { matchBillToNote } from './bill-matcher'
import type { BillList } from './bill-list-parser'

const sampleBill: BillList = {
  patient: 'ZHENG, BIFANG',
  insurance: 'ELDERPLAN, INC',
  totalCharge: 690,
  rows: [{
    patientName: 'ZHENG, BIFANG',
    patientId: '1002305650',
    dos: '07/14/2025',
    icd: ['M54.6', 'M54.50'],
    cpt: ['9920325', '97813', '97811', '97814'],
    charge: 690,
  }],
}

function makeNote(date: string, icds: string[], cpts: string[]): any {
  return {
    visits: [{
      assessment: { date },
      diagnosisCodes: icds.map(c => ({ icd10: c, description: '' })),
      procedureCodes: cpts.map(c => ({ cpt: c, description: '' })),
    }],
  }
}

describe('matchBillToNote', () => {
  it('returns match when note CPTs cover all bill CPTs (base-5 modifier tolerance)', () => {
    const note = makeNote('07/14/2025', ['M54.6', 'M54.50'], ['99203', '97813', '97811', '97814'])
    const results = matchBillToNote(sampleBill, note)
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('match')
    expect(results[0].icdMissing).toEqual([])
    expect(results[0].cptMissing).toEqual([])
  })

  it('returns diff when note is missing a bill CPT', () => {
    const note = makeNote('07/14/2025', ['M54.6', 'M54.50'], ['99203', '97813', '97811']) // missing 97814
    const results = matchBillToNote(sampleBill, note)
    expect(results[0].status).toBe('diff')
    expect(results[0].cptMissing).toEqual(['97814'])
  })

  it('returns diff when note is missing a bill ICD', () => {
    const note = makeNote('07/14/2025', ['M54.6'], ['99203', '97813', '97811', '97814']) // missing M54.50
    const results = matchBillToNote(sampleBill, note)
    expect(results[0].status).toBe('diff')
    expect(results[0].icdMissing).toEqual(['M54.50'])
  })

  it('returns missing_dos when bill DOS not in note', () => {
    const note = makeNote('09/01/2025', ['M54.6'], ['99203'])
    const results = matchBillToNote(sampleBill, note)
    expect(results[0].status).toBe('missing_dos')
    expect(results[0].cptMissing).toEqual(['9920325', '97813', '97811', '97814'])
  })

  it('ignores note visits that have no corresponding bill row (Bill → Note 单向)', () => {
    const note = {
      visits: [
        { assessment: { date: '07/14/2025' }, diagnosisCodes: [{ icd10: 'M54.6' }, { icd10: 'M54.50' }], procedureCodes: [{ cpt: '99203' }, { cpt: '97813' }, { cpt: '97811' }, { cpt: '97814' }] },
        { assessment: { date: '12/31/2025' }, diagnosisCodes: [{ icd10: 'X99.9' }], procedureCodes: [{ cpt: '99999' }] },
      ],
    }
    const results = matchBillToNote(sampleBill, note)
    expect(results).toHaveLength(1)  // bill only has 07/14
    expect(results[0].status).toBe('match')
  })

  it('deduplicates note DOS index (keeps first visit on duplicate date)', () => {
    const note = {
      visits: [
        { assessment: { date: '07/14/2025' }, diagnosisCodes: [{ icd10: 'M54.6' }, { icd10: 'M54.50' }], procedureCodes: [{ cpt: '99203' }, { cpt: '97813' }, { cpt: '97811' }, { cpt: '97814' }] },
        { assessment: { date: '07/14/2025' }, diagnosisCodes: [], procedureCodes: [] }, // duplicate, should be ignored
      ],
    }
    const results = matchBillToNote(sampleBill, note)
    expect(results[0].status).toBe('match')
  })

  it('rejects malformed assessment.date (missing_dos instead of crash)', () => {
    const note = { visits: [{ assessment: { date: 'not-a-date' }, diagnosisCodes: [], procedureCodes: [] }] }
    const results = matchBillToNote(sampleBill, note)
    expect(results[0].status).toBe('missing_dos')
  })
})
