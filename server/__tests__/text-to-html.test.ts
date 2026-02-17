import { textToHTML, splitSOAPText, convertSOAPToHTML } from '../services/text-to-html'

describe('text-to-html', () => {
  describe('textToHTML', () => {
    it('converts single line to paragraph', () => {
      expect(textToHTML('Hello world')).toBe('<p>Hello world</p>')
    })

    it('converts multiple lines to paragraphs', () => {
      expect(textToHTML('Line 1\nLine 2\nLine 3')).toBe(
        '<p>Line 1</p><p>Line 2</p><p>Line 3</p>'
      )
    })

    it('filters empty lines', () => {
      expect(textToHTML('Line 1\n\n\nLine 2')).toBe(
        '<p>Line 1</p><p>Line 2</p>'
      )
    })

    it('escapes HTML special characters', () => {
      expect(textToHTML('ROM < 90° & > 60°')).toBe(
        '<p>ROM &lt; 90° &amp; &gt; 60°</p>'
      )
    })

    it('returns empty string for empty input', () => {
      expect(textToHTML('')).toBe('')
      expect(textToHTML('   ')).toBe('')
    })

    it('preserves degree symbols and special medical characters', () => {
      const input = 'Flexion: 60°/90°\nExtension: 20°/30°'
      const result = textToHTML(input)
      expect(result).toContain('60°/90°')
      expect(result).toContain('20°/30°')
    })
  })

  describe('splitSOAPText', () => {
    const sampleSOAP = [
      'Subjective',
      'Patient presents with lower back pain.',
      'Pain level 7/10.',
      '',
      'Objective',
      'ROM: Flexion 60°/90°',
      'Tightness: moderate',
      '',
      'Assessment',
      'TCM Diagnosis: Qi Stagnation',
      '',
      'Plan',
      'Acupuncture 2x/week for 4 weeks.',
      'Needle Protocol:',
      '30 gauge needles',
    ].join('\n')

    it('splits into four sections', () => {
      const result = splitSOAPText(sampleSOAP)
      expect(result.subjective).toContain('Patient presents with lower back pain')
      expect(result.objective).toContain('ROM: Flexion 60°/90°')
      expect(result.assessment).toContain('TCM Diagnosis: Qi Stagnation')
      expect(result.plan).toContain('Acupuncture 2x/week')
    })

    it('plan section includes needle protocol', () => {
      const result = splitSOAPText(sampleSOAP)
      expect(result.plan).toContain('Needle Protocol')
      expect(result.plan).toContain('30 gauge needles')
    })

    it('handles text without empty lines between sections', () => {
      const compact = 'Subjective\nPain.\nObjective\nROM ok.\nAssessment\nGood.\nPlan\nContinue.'
      const result = splitSOAPText(compact)
      expect(result.subjective).toBe('Pain.')
      expect(result.objective).toBe('ROM ok.')
      expect(result.assessment).toBe('Good.')
      expect(result.plan).toBe('Continue.')
    })

    it('returns empty strings for missing sections', () => {
      const partial = 'Subjective\nPain only.'
      const result = splitSOAPText(partial)
      expect(result.subjective).toBe('Pain only.')
      expect(result.objective).toBe('')
      expect(result.assessment).toBe('')
      expect(result.plan).toBe('')
    })

    it('handles empty input', () => {
      const result = splitSOAPText('')
      expect(result.subjective).toBe('')
      expect(result.objective).toBe('')
      expect(result.assessment).toBe('')
      expect(result.plan).toBe('')
    })
  })

  describe('convertSOAPToHTML', () => {
    it('splits and converts to HTML in one step', () => {
      const text = 'Subjective\nPain 7/10.\nObjective\nROM limited.\nAssessment\nQi Stagnation.\nPlan\nAcupuncture.'
      const result = convertSOAPToHTML(text)

      expect(result.subjective).toBe('<p>Pain 7/10.</p>')
      expect(result.objective).toBe('<p>ROM limited.</p>')
      expect(result.assessment).toBe('<p>Qi Stagnation.</p>')
      expect(result.plan).toBe('<p>Acupuncture.</p>')
    })

    it('produces valid HTML paragraphs for multi-line sections', () => {
      const text = 'Subjective\nLine 1\nLine 2\nObjective\nObj line\nAssessment\nAssess\nPlan\nPlan line'
      const result = convertSOAPToHTML(text)
      expect(result.subjective).toBe('<p>Line 1</p><p>Line 2</p>')
    })

    it('escapes HTML in converted output', () => {
      const text = 'Subjective\nROM < 90°\nObjective\nOK\nAssessment\nOK\nPlan\nOK'
      const result = convertSOAPToHTML(text)
      expect(result.subjective).toContain('&lt;')
    })
  })
})
