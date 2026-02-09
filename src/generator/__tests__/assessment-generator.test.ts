import type { GenerationContext } from '../../types'
import {
  generateAssessmentHTML,
  generateAssessmentTextIE,
  generateAssessmentTextTX
} from '../assessment-generator'

const baseContext: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'WC',
  primaryBodyPart: 'KNEE',
  laterality: 'bilateral',
  localPattern: 'Blood Stasis',
  systemicPattern: 'Kidney Yang Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate'
}

describe('assessment-generator (template boundary)', () => {
  it('generates IE assessment html with TCM diagnosis section', () => {
    const html = generateAssessmentHTML(baseContext, 'IE')
    expect(html.length).toBeGreaterThan(0)
    expect(html).toContain('TCM Dx')
  })

  it('generates TX assessment html', () => {
    const html = generateAssessmentHTML({ ...baseContext, noteType: 'TX' }, 'TX')
    expect(html.length).toBeGreaterThan(0)
  })

  it('generates text assessment for IE/TX', () => {
    const ie = generateAssessmentTextIE(baseContext)
    const tx = generateAssessmentTextTX({ ...baseContext, noteType: 'TX' })

    expect(ie).toContain('TCM Dx')
    expect(tx.length).toBeGreaterThan(0)
  })
})

