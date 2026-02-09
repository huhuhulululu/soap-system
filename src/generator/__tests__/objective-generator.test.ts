import type { GenerationContext } from '../../types'
import {
  generateObjectiveHTML,
  getMuscleOptions,
  getROMConfig,
  hasCustomObjectiveFormat,
  getTightnessGradingOptions,
  getTendernessGradingOptions,
  getSpasmGradingOptions,
  getInspectionOptions,
  getMuscleStrengthOptions
} from '../objective-generator'

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

describe('objective-generator (template boundary)', () => {
  it('generates IE objective html', () => {
    const html = generateObjectiveHTML(baseContext, 'KNEE')
    expect(html.length).toBeGreaterThan(0)
    expect(html).toContain('Muscles Testing')
  })

  it('returns empty objective html for TX template', () => {
    const html = generateObjectiveHTML({ ...baseContext, noteType: 'TX' }, 'KNEE')
    expect(html).toBe('')
  })

  it('exposes template option helpers', () => {
    expect(getMuscleOptions('KNEE').length).toBeGreaterThan(0)
    expect(getROMConfig('LBP')).toBeDefined()
    expect(typeof hasCustomObjectiveFormat('SHOULDER')).toBe('boolean')
    expect(getTightnessGradingOptions().length).toBeGreaterThan(0)
    expect(getTendernessGradingOptions().length).toBeGreaterThan(0)
    expect(getSpasmGradingOptions().length).toBeGreaterThan(0)
    expect(getInspectionOptions().length).toBeGreaterThan(0)
    expect(getMuscleStrengthOptions().length).toBeGreaterThan(0)
  })
})
