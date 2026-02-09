import type { GenerationContext, SOAPNote } from '../src/types'
import { exportSOAPAsText, exportTXSeriesAsText } from '../src/generator/soap-generator'

const previousIE: SOAPNote = {
  header: { patientId: 'SH-001', visitDate: '2026-02-08', noteType: 'IE', insuranceType: 'WC', visitNumber: 1 },
  subjective: {
    visitType: 'INITIAL EVALUATION',
    chronicityLevel: 'Sub Acute',
    primaryBodyPart: { bodyPart: 'SHOULDER', laterality: 'right' },
    secondaryBodyParts: [],
    painTypes: ['Aching', 'Sharp'],
    painRadiation: 'without radiation',
    symptomDuration: { value: 2, unit: 'month(s)' },
    associatedSymptoms: ['soreness', 'tightness'],
    symptomPercentage: '70%',
    causativeFactors: ['over used due to nature of work', 'intense excise'],
    exacerbatingFactors: ['any strenuous activities', 'lifting too much weight'],
    relievingFactors: ['resting'],
    adlDifficulty: { level: 'moderate', activities: ['reaching overhead', 'carrying heavy objects'] },
    activityChanges: [],
    painScale: { worst: 7, best: 5, current: 7 },
    painFrequency: 'Frequent (symptoms occur between 51% and 75% of the time)'
  },
  objective: {
    muscleTesting: {
      tightness: { muscles: ['upper trapezius', 'supraspinatus'], gradingScale: 'moderate' },
      tenderness: { muscles: ['supraspinatus', 'infraspinatus'], gradingScale: '(+3) = Patient complains of considerable tenderness and withdraws momentarily in response to the test pressure' },
      spasm: { muscles: ['upper trapezius'], gradingScale: '(+2)=Occasional spontaneous spasms and easily induced spasms.' }
    },
    rom: [
      { movement: 'Abduction', strength: '3+/5', degrees: '120 degree(moderate)' },
      { movement: 'Horizontal Adduction', strength: '4/5', degrees: '35 degree(mild)' },
      { movement: 'Flexion', strength: '3+/5', degrees: '130 degree(moderate)' },
      { movement: 'Extension', strength: '4/5', degrees: '45 degree(mild)' },
      { movement: 'External Rotation', strength: '4-/5', degrees: '60 degree(moderate)' },
      { movement: 'Internal Rotation', strength: '4-/5', degrees: '65 degree(moderate)' }
    ],
    inspection: ['weak muscles and dry skin without luster'],
    tonguePulse: { tongue: 'thin white coat', pulse: 'string-taut' }
  },
  assessment: {
    tcmDiagnosis: { localPattern: 'Qi Stagnation', systemicPattern: 'Qi Deficiency', bodyPart: 'shoulder' },
    treatmentPrinciples: { focusOn: 'focus', harmonize: 'healthy qi and to expel pathogen factor to promote', purpose: 'to reduce stagnation and improve circulation' },
    evaluationArea: 'shoulder'
  },
  plan: {
    evaluationType: 'Initial Evaluation',
    contactTime: '20-30 mins',
    steps: [],
    shortTermGoal: {
      treatmentFrequency: 12,
      weeksDuration: '5-6 weeks',
      painScaleTarget: '4-5',
      symptomTargets: []
    },
    longTermGoal: {
      treatmentFrequency: 8,
      weeksDuration: '5-6 weeks',
      painScaleTarget: '2-3',
      symptomTargets: []
    },
    needleProtocol: { needleSizes: ['36#x0.5"', '34#x1"', '30#x1.5"'], totalTime: 60, sections: [] }
  },
  diagnosisCodes: [{ icd10: 'M75.111', description: 'Rotator cuff tear, right shoulder', bodyPart: 'SHOULDER', laterality: 'right' }],
  procedureCodes: []
}

const ieContext: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'WC',
  primaryBodyPart: 'SHOULDER',
  laterality: 'right',
  localPattern: 'Qi Stagnation',
  systemicPattern: 'Qi Deficiency',
  chronicityLevel: 'Sub Acute',
  severityLevel: 'moderate',
  previousIE
}

console.log('='.repeat(80))
console.log('IE - Right SHOULDER')
console.log('='.repeat(80))
console.log(exportSOAPAsText(ieContext))

const txContext: GenerationContext = { ...ieContext, noteType: 'TX' }
const txSeries = exportTXSeriesAsText(txContext, { txCount: 5 })

for (const tx of txSeries) {
  console.log('='.repeat(80))
  console.log(`TX #${tx.visitIndex}  |  progress=${tx.state.progress.toFixed(2)}  pain=${tx.state.painScaleLabel}  severity=${tx.state.severityLevel}  spasm=${tx.state.spasmGrading.substring(0,4)}`)
  console.log('='.repeat(80))
  console.log(tx.text)
}
