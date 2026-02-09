import type { GenerationContext } from '../../types'
import {
  generatePlanHTML,
  generatePlanIE,
  generatePlanTX,
  generateNeedleProtocolHTML,
  generateCompletePlanSection
} from '../plan-generator'

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

describe('plan-generator (template boundary)', () => {
  it('generates IE/TX plan html', () => {
    const ie = generatePlanHTML(baseContext, 'IE')
    const tx = generatePlanHTML({ ...baseContext, noteType: 'TX' }, 'TX')

    expect(ie.length).toBeGreaterThan(0)
    expect(tx.length).toBeGreaterThan(0)
  })

  it('generates plan text blocks for IE/TX', () => {
    const ie = generatePlanIE(baseContext)
    const tx = generatePlanTX({ ...baseContext, noteType: 'TX' })

    expect(ie).toContain('Short Term Goal')
    expect(tx.length).toBeGreaterThan(0)
  })

  it('uses insurance boundary in needle protocol output', () => {
    const hf = generateNeedleProtocolHTML({ ...baseContext, insuranceType: 'HF' })
    const wc = generateNeedleProtocolHTML(baseContext)

    expect(hf).toContain('15')
    expect(wc).toContain('60')
  })

  it('generates complete plan section', () => {
    const complete = generateCompletePlanSection(baseContext)
    expect(complete.length).toBeGreaterThan(0)
  })
})

