import type { GenerationContext, SOAPNote } from '../src/types'
import { exportSOAPAsText, exportTXSeriesAsText } from '../src/generator/soap-generator'

const previousIE: SOAPNote = {
  header: { patientId: 'NECK-001', visitDate: '2026-02-08', noteType: 'IE', insuranceType: 'WC', visitNumber: 1 },
  subjective: {
    visitType: 'INITIAL EVALUATION',
    chronicityLevel: 'Sub Acute',
    primaryBodyPart: { bodyPart: 'NECK', laterality: 'right' },
    secondaryBodyParts: [],
    painTypes: ['Aching', 'Sharp'],
    painRadiation: 'with radiation to right arm',
    symptomDuration: { value: 6, unit: 'week(s)' },
    associatedSymptoms: ['soreness', 'stiffness'],
    symptomPercentage: '70%',
    causativeFactors: ['overworking in computer', 'poor sleep'],
    exacerbatingFactors: ['prolong sitting', 'any strenuous activities'],
    relievingFactors: ['resting'],
    adlDifficulty: { level: 'moderate', activities: ['turning head while driving', 'looking up'] },
    activityChanges: [],
    painScale: { worst: 7, best: 5, current: 7 },
    painFrequency: 'Frequent (symptoms occur between 51% and 75% of the time)'
  },
  objective: {
    muscleTesting: {
      tightness: { muscles: ['upper trapezius', 'levator scapulae'], gradingScale: 'moderate' },
      tenderness: { muscles: ['upper trapezius', 'sternocleidomastoid'], gradingScale: '(+3) = Patient complains of considerable tenderness and withdraws momentarily in response to the test pressure' },
      spasm: { muscles: ['upper trapezius'], gradingScale: '(+2)=Occasional spontaneous spasms and easily induced spasms.' }
    },
    rom: [
      { movement: 'Extension (look up)', strength: '4-/5', degrees: '40 Degrees(moderate)' },
      { movement: 'Flexion (look down)', strength: '4/5', degrees: '35 Degrees(moderate)' },
      { movement: 'Rotation to Right', strength: '3+/5', degrees: '55 Degrees(moderate)' },
      { movement: 'Rotation to Left', strength: '4/5', degrees: '60 Degrees(mild)' },
      { movement: 'Flexion to the Right', strength: '4/5', degrees: '30 Degrees(moderate)' },
      { movement: 'Flexion to the Left', strength: '4/5', degrees: '35 Degrees(mild)' }
    ],
    inspection: ['weak muscles and dry skin without luster'],
    tonguePulse: { tongue: 'thin white coat', pulse: 'string-taut' }
  },
  assessment: {
    tcmDiagnosis: { localPattern: 'Qi Stagnation', systemicPattern: 'Liver Yang Rising', bodyPart: 'neck' },
    treatmentPrinciples: { focusOn: 'focus', harmonize: 'yin/yang', purpose: 'promote good essence' },
    evaluationArea: 'neck'
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
  diagnosisCodes: [{ icd10: 'M54.2', description: 'Cervicalgia', bodyPart: 'NECK' }],
  procedureCodes: []
}

const ieContext: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'WC',
  primaryBodyPart: 'NECK',
  laterality: 'right',
  localPattern: 'Qi Stagnation',
  systemicPattern: 'Liver Yang Rising',
  chronicityLevel: 'Sub Acute',
  severityLevel: 'moderate',
  previousIE
}

console.log('='.repeat(80))
console.log('IE (Initial Evaluation) - NECK')
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
