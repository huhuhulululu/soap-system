// AI Generator unit tests — buildPrompt + splitSOAP
import { buildPrompt, splitSOAP } from '../ai-generator'
import type { AIGenerateInput } from '../ai-generator'

describe('ai-generator', () => {
  describe('buildPrompt', () => {
    const baseInput: AIGenerateInput = {
      noteType: 'IE',
      bodyPart: 'SHOULDER',
      laterality: 'right',
      painCurrent: 7,
      painWorst: 9,
      painBest: 4,
      chronicityLevel: 'Chronic',
      severityLevel: 'moderate to severe',
      tcmLocal: 'Qi Stagnation, Blood Stasis',
      tcmSystemic: 'Blood Deficiency',
      associatedSymptoms: ['stiffness'],
      painTypes: ['Aching'],
      painFrequency: 'Frequent (symptoms occur between 51% and 75% of the time)',
      symptomScale: '60%-70%',
      duration: '5 year(s)',
      causativeFactors: ['repetitive strain from activities in the past'],
      aggravatingFactors: ['flexion', 'abduction', 'Overhead activities'],
      relievingFactors: ['rest'],
      age: 60,
      gender: 'Female',
    }

    it('should include all required fields in prompt', () => {
      const prompt = buildPrompt(baseInput)
      expect(prompt).toContain('Initial Evaluation')
      expect(prompt).toContain('SHOULDER')
      expect(prompt).toContain('right')
      expect(prompt).toContain('60F')
      expect(prompt).toContain('7/10')
      expect(prompt).toContain('worst 9')
      expect(prompt).toContain('best 4')
      expect(prompt).toContain('Chronic')
      expect(prompt).toContain('Qi Stagnation, Blood Stasis')
      expect(prompt).toContain('Blood Deficiency')
      expect(prompt).toContain('stiffness')
      expect(prompt).toContain('Aching')
      expect(prompt).toContain('60%-70%')
      expect(prompt).toContain('5 year(s)')
      expect(prompt).toContain('flexion, abduction, Overhead activities')
      expect(prompt).toContain('rest')
    })

    it('should use TX label for TX noteType', () => {
      const txInput = { ...baseInput, noteType: 'TX' as const }
      const prompt = buildPrompt(txInput)
      expect(prompt).toContain('Treatment')
      expect(prompt).not.toContain('Initial Evaluation')
    })

    it('should include tongue and pulse when provided', () => {
      const input = { ...baseInput, tongue: 'pale, thin white coat', pulse: 'thin, choppy' }
      const prompt = buildPrompt(input)
      expect(prompt).toContain('Tongue: pale, thin white coat')
      expect(prompt).toContain('Pulse: thin, choppy')
    })

    it('should omit tongue and pulse when not provided', () => {
      const prompt = buildPrompt(baseInput)
      expect(prompt).not.toContain('Tongue:')
      expect(prompt).not.toContain('Pulse:')
    })

    it('should handle Male gender', () => {
      const input = { ...baseInput, gender: 'Male' as const }
      const prompt = buildPrompt(input)
      expect(prompt).toContain('60M')
    })
  })

  describe('splitSOAP', () => {
    it('should split standard SOAP text into 4 sections', () => {
      const text = `Subjective
INITIAL EVALUATION

Patient c/o Chronic pain...

Pain Scale: Worst: 9 ; Best: 4 ; Current: 7

Objective
Inspection: weak muscles

Muscles Testing:
Tightness muscles noted along upper trapezius

Assessment
TCM Dx:
Right shoulder pain due to Qi Stagnation

Plan
Initial Evaluation - Personal one on one contact

Short Term Goal:
Decrease Pain Scale to 3-4.`

      const result = splitSOAP(text)
      expect(result.subjective).toContain('INITIAL EVALUATION')
      expect(result.subjective).toContain('Pain Scale')
      expect(result.objective).toContain('Inspection')
      expect(result.objective).toContain('Tightness')
      expect(result.assessment).toContain('TCM Dx')
      expect(result.plan).toContain('Short Term Goal')
    })

    it('should handle missing sections gracefully', () => {
      const text = 'Some random text without SOAP markers'
      const result = splitSOAP(text)
      expect(result.subjective).toBe('')
      expect(result.objective).toBe('')
      expect(result.assessment).toBe('')
      expect(result.plan).toBe('')
    })

    it('should handle partial sections', () => {
      const text = `Subjective
Patient has pain

Assessment
TCM diagnosis here`

      const result = splitSOAP(text)
      expect(result.subjective).toContain('Patient has pain')
      expect(result.assessment).toContain('TCM diagnosis')
      expect(result.objective).toBe('')
      expect(result.plan).toBe('')
    })
  })
})
