import type { GenerationContext, SOAPNote } from '../../types'
import { exportSOAPAsText, exportTXSeriesAsText } from '../soap-generator'

function createPreviousIE(currentPain: number = 8, shortTermGoal: string = '5-6'): SOAPNote {
  return {
    header: {
      patientId: 'P001',
      visitDate: '2026-02-08',
      noteType: 'IE',
      insuranceType: 'WC',
      visitNumber: 1
    },
    subjective: {
      visitType: 'INITIAL EVALUATION',
      chronicityLevel: 'Chronic',
      primaryBodyPart: { bodyPart: 'SHOULDER', laterality: 'bilateral' },
      secondaryBodyParts: [],
      painTypes: ['Aching'],
      painRadiation: 'without radiation',
      symptomDuration: { value: 2, unit: 'year(s)' },
      associatedSymptoms: ['soreness'],
      symptomPercentage: '70%',
      causativeFactors: ['age related/degenerative changes'],
      exacerbatingFactors: ['any strenuous activities'],
      relievingFactors: ['resting'],
      adlDifficulty: { level: 'moderate', activities: ['performing household chores'] },
      activityChanges: [],
      painScale: { worst: currentPain, best: currentPain - 2, current: currentPain },
      painFrequency: 'Constant (symptoms occur between 76% and 100% of the time)'
    },
    objective: {
      muscleTesting: {
        tightness: { muscles: ['upper trapezius'], gradingScale: 'moderate' },
        tenderness: { muscles: ['upper trapezius'], gradingScale: '(+2) = Patient states that the area is moderately tender' },
        spasm: { muscles: ['upper trapezius'], gradingScale: '(+2)=>2 but < 5 spontaneous spasms per hour.' }
      },
      rom: [{ movement: 'Abduction', strength: '4-/5', degrees: '120 degree(moderate)' }],
      inspection: ['weak muscles and dry skin without luster'],
      tonguePulse: { tongue: 'thin white coat', pulse: 'string-taut' }
    },
    assessment: {
      tcmDiagnosis: { localPattern: 'Qi Stagnation', systemicPattern: 'Kidney Qi Deficiency', bodyPart: 'shoulder' },
      treatmentPrinciples: { focusOn: 'focus', harmonize: 'Liver and Kidney', purpose: 'promote good essence' },
      evaluationArea: 'shoulder'
    },
    plan: {
      evaluationType: 'Initial Evaluation',
      contactTime: '20-30 mins',
      steps: [],
      shortTermGoal: {
        treatmentFrequency: 12,
        weeksDuration: '5-6 weeks',
        painScaleTarget: shortTermGoal,
        symptomTargets: []
      },
      longTermGoal: {
        treatmentFrequency: 8,
        weeksDuration: '5-6 weeks',
        painScaleTarget: '3-4',
        symptomTargets: []
      },
      needleProtocol: {
        needleSizes: ['30#x1.5"'],
        totalTime: 60,
        sections: []
      }
    },
    diagnosisCodes: [],
    procedureCodes: []
  }
}

describe('soap-generator TX series integration (S/O/A linked, P unchanged)', () => {
  const context: GenerationContext = {
    noteType: 'TX',
    insuranceType: 'WC',
    primaryBodyPart: 'SHOULDER',
    laterality: 'bilateral',
    localPattern: 'Qi Stagnation',
    systemicPattern: 'Kidney Qi Deficiency',
    chronicityLevel: 'Chronic',
    severityLevel: 'moderate',
    previousIE: createPreviousIE()
  }

  it('renders TX series and injects state-driven S/O/A chain', () => {
    const items = exportTXSeriesAsText(context, { txCount: 3 })
    expect(items).toHaveLength(3)

    items.forEach(item => {
      const text = item.text
      const state = item.state
      expect(text).toContain('Subjective')
      // Pain Scale 使用模板下拉框标签 (整数或范围如 "8-7"), 非小数
      expect(text).toContain(`Pain Scale: ${state.painScaleLabel} /10`)
      expect(text).toContain(state.reason)
      expect(text).toContain(state.soaChain.assessment.present)
      expect(text).toContain(state.soaChain.assessment.patientChange)
      expect(text).toContain(state.soaChain.assessment.whatChanged)
      expect(text).toContain(state.soaChain.assessment.physicalChange)
      expect(text).toContain(state.soaChain.assessment.findingType)
    })
  })

  it('keeps P section identical across visits', () => {
    const items = exportTXSeriesAsText(context, { txCount: 3 })
    const getPlanAndNeedle = (t: string) => t.slice(t.indexOf('Plan\n'))

    const baseline = getPlanAndNeedle(items[0].text)
    for (let i = 1; i < items.length; i++) {
      expect(getPlanAndNeedle(items[i].text)).toBe(baseline)
    }
  })

  it('rejects unsupported body parts for TX series generation', () => {
    const unsupported: GenerationContext = {
      ...context,
      primaryBodyPart: 'HAND'
    }
    expect(() => exportTXSeriesAsText(unsupported, { txCount: 3 })).toThrow('Unsupported TX body part')
  })

  it('rejects unsupported body parts for IE text generation', () => {
    const unsupportedIE: GenerationContext = {
      ...context,
      noteType: 'IE',
      primaryBodyPart: 'FOREARM'
    }
    expect(() => exportSOAPAsText(unsupportedIE)).toThrow('Unsupported IE body part')
  })
})
