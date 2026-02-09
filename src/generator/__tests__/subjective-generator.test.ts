import type { GenerationContext } from '../../types'
import {
  generateSubjectiveHTML,
  createDropdown,
  generateSubjectiveContent
} from '../subjective-generator'

const baseContext: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'WC',
  primaryBodyPart: 'KNEE',
  laterality: 'bilateral',
  localPattern: 'Blood Stasis',
  systemicPattern: 'Kidney Yang Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe'
}

describe('subjective-generator (template boundary)', () => {
  it('generates IE subjective html with template dropdown markup', () => {
    const html = generateSubjectiveHTML(baseContext, 'IE')
    expect(html).toContain('ppnSelectComboSingle')
    expect(html).toContain('INITIAL EVALUATION')
    expect(html).toContain('Pain Scale')
  })

  it('generates TX subjective html with follow-up wording', () => {
    const html = generateSubjectiveHTML({ ...baseContext, noteType: 'TX' }, 'TX')
    expect(html.length).toBeGreaterThan(0)
    expect(html).toContain('Follow up visit')
  })

  it('createDropdown renders single and multi variants', () => {
    const single = createDropdown('single', ['A', 'B'], 'A')
    const multi = createDropdown('multi', ['A', 'B'], ['A', 'B'])

    expect(single).toContain('ppnSelectComboSingle')
    expect(multi).toContain('ppnSelectCombo')
  })

  it('generateSubjectiveContent returns content for IE and TX', () => {
    const ie = generateSubjectiveContent(baseContext, 'IE')
    const tx = generateSubjectiveContent({ ...baseContext, noteType: 'TX' }, 'TX')

    expect(ie.length).toBeGreaterThan(0)
    expect(tx.length).toBeGreaterThan(0)
  })
})

