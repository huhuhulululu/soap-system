/**
 * Debug: dump all errors from a "perfect" document
 */
import { describe, it } from 'vitest'
import { generateDocument } from './generator'
import { checkDocument } from '../../../../parsers/optum-note/checker/note-checker'

describe('Debug', () => {
  it('dump errors', () => {
    const doc = generateDocument({ painStart: 8, bodyPart: 'LBP' })
    const result = checkDocument({ document: doc })
    const grouped: Record<string, number> = {}
    for (const e of result.errors) {
      const key = `${e.ruleId}[${e.severity}] ${e.message}`
      grouped[key] = (grouped[key] || 0) + 1
    }
    console.log('Total errors:', result.errors.length)
    console.log('Score:', result.summary.scoring.totalScore, result.summary.scoring.grade)
    for (const [k, v] of Object.entries(grouped).sort()) {
      console.log(`  ${v}x ${k}`)
    }
  })
})
