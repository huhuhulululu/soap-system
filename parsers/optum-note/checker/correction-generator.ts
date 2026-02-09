import type { OptumNoteDocument } from '../types'
import type { CheckError, CorrectionItem, FieldFix } from './types'
import { bridgeToContext } from './bridge'
import { exportSOAPAsText, generateSOAPNote } from '../../../src/generator/soap-generator'
import { generateTXSequenceStates } from '../../../src/generator/tx-sequence-engine'
import type { GenerationContext } from '../../../src/types'

function buildFieldFixes(errors: CheckError[]): FieldFix[] {
  return errors.map(e => ({
    field: e.field,
    original: e.actual,
    corrected: e.expected,
    reason: e.message,
    derivedFrom: [e.ruleId]
  }))
}

function dominantSection(errors: CheckError[]): 'S' | 'O' | 'A' | 'P' {
  if (errors.length === 0) return 'S'
  const counts: Record<'S' | 'O' | 'A' | 'P', number> = { S: 0, O: 0, A: 0, P: 0 }
  for (const e of errors) counts[e.section]++
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'S') as 'S' | 'O' | 'A' | 'P'
}

/**
 * 级联纠正（v1）
 * - IE：根据 bridge context 重生
 * - TX：基于纠正后的 IE 作为 previousIE，按序列状态重生
 */
export function generateCorrections(document: OptumNoteDocument, errors: CheckError[]): CorrectionItem[] {
  const items: CorrectionItem[] = []
  const byVisit = new Map<number, CheckError[]>()
  for (const e of errors) {
    const list = byVisit.get(e.visitIndex) || []
    list.push(e)
    byVisit.set(e.visitIndex, list)
  }

  const ieIndex = document.visits.findIndex(v => v.subjective.visitType === 'INITIAL EVALUATION')

  let correctedIENote: ReturnType<typeof generateSOAPNote> | undefined
  if (ieIndex >= 0) {
    const ieContext = bridgeToContext(document, ieIndex)
    const ieText = exportSOAPAsText(ieContext)
    correctedIENote = generateSOAPNote(ieContext)
    const errs = byVisit.get(ieIndex) || []
    items.push({
      visitDate: document.visits[ieIndex].assessment.date || '',
      visitIndex: ieIndex,
      section: dominantSection(errs),
      errors: errs,
      fieldFixes: buildFieldFixes(errs),
      correctedFullText: ieText
    })
  }

  const txIndexes = document.visits
    .map((v, i) => ({ v, i }))
    .filter(x => x.v.subjective.visitType !== 'INITIAL EVALUATION')
    .map(x => x.i)

  if (txIndexes.length > 0) {
    const firstTxIdx = txIndexes[0]
    const baseTxContext = bridgeToContext(document, firstTxIdx)
    const txContext: GenerationContext = {
      ...baseTxContext,
      noteType: 'TX',
      previousIE: correctedIENote || baseTxContext.previousIE
    }

    const states = generateTXSequenceStates(txContext, { txCount: txIndexes.length })

    txIndexes.forEach((docVisitIndex, idx) => {
      const errs = byVisit.get(docVisitIndex) || []
      const correctedText = exportSOAPAsText(txContext, states[idx])
      items.push({
        visitDate: document.visits[docVisitIndex].assessment.date || '',
        visitIndex: docVisitIndex,
        section: dominantSection(errs),
        errors: errs,
        fieldFixes: buildFieldFixes(errs),
        correctedFullText: correctedText
      })
    })
  }

  return items.sort((a, b) => a.visitIndex - b.visitIndex)
}
