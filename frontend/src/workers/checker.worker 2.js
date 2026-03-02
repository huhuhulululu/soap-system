/**
 * Web Worker — runs PDF parsing and document checking off the main thread.
 * Receives raw text + options, runs parseOptumNote + checkDocument, posts result back.
 */
import { parseOptumNote } from '../../../parsers/optum-note/parser.ts'
import { checkDocument } from '../../../parsers/optum-note/checker/note-checker.ts'

self.onmessage = (e) => {
  try {
    const { type, text, options } = e.data
    if (type !== 'check') return

    const parsed = parseOptumNote(text)
    if (!parsed.success || !parsed.document) {
      const reason =
        parsed.errors?.map((err) => `${err.field}: ${err.message}`).join(' | ') || 'Unknown parse failure'
      self.postMessage({ type: 'error', error: `解析失败: ${reason}` })
      return
    }

    const report = checkDocument({
      document: parsed.document,
      insuranceType: options?.insuranceType,
      treatmentTime: options?.treatmentTime,
    })
    const visitTexts = parsed.document.rawVisitBlocks || []

    self.postMessage({
      type: 'result',
      report,
      visitTexts,
      document: parsed.document,
    })
  } catch (err) {
    self.postMessage({
      type: 'error',
      error: err instanceof Error ? err.message : 'Unknown worker error',
    })
  }
}
