import type { BillList, BillRow } from './bill-list-parser'

export type MatchStatus = 'match' | 'diff' | 'missing_dos'

export interface MatchResult {
  dos: string
  status: MatchStatus
  billIcd: string[]
  billCpt: string[]
  noteIcd?: string[]
  noteCpt?: string[]
  icdMissing: string[]
  cptMissing: string[]
}

interface MinimalVisit {
  assessment?: { date?: string }
  diagnosisCodes?: Array<{ icd10?: string }>
  procedureCodes?: Array<{ cpt?: string }>
}

interface MinimalNote {
  visits?: MinimalVisit[]
}

function baseCpt(code: string): string {
  const m = (code || '').match(/^(\d{5})/)
  return m ? m[1] : code
}

export function matchBillToNote(bill: BillList, note: MinimalNote): MatchResult[] {
  const noteIndex = new Map<string, MinimalVisit>()
  for (const v of note.visits || []) {
    const key = (v.assessment?.date || '').trim()
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(key) && !noteIndex.has(key)) {
      noteIndex.set(key, v)
    }
  }

  return bill.rows.map((row: BillRow): MatchResult => {
    const visit = noteIndex.get(row.dos)
    if (!visit) {
      return {
        dos: row.dos,
        status: 'missing_dos',
        billIcd: row.icd,
        billCpt: row.cpt,
        icdMissing: row.icd,
        cptMissing: row.cpt,
      }
    }
    const noteIcd = (visit.diagnosisCodes || []).map(d => d.icd10 || '').filter(Boolean)
    const noteCpt = (visit.procedureCodes || []).map(p => p.cpt || '').filter(Boolean)
    const noteCptBase = new Set(noteCpt.map(baseCpt))
    const icdMissing = row.icd.filter(c => !noteIcd.includes(c))
    const cptMissing = row.cpt.filter(c => !noteCptBase.has(baseCpt(c)))
    const status: MatchStatus = icdMissing.length || cptMissing.length ? 'diff' : 'match'
    return {
      dos: row.dos,
      status,
      billIcd: row.icd,
      billCpt: row.cpt,
      noteIcd,
      noteCpt,
      icdMissing,
      cptMissing,
    }
  })
}
