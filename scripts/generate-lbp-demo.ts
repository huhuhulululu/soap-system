import type { GenerationContext, SOAPNote } from '../src/types'
import { exportSOAPAsText, exportTXSeriesAsText } from '../src/generator/soap-generator'

const previousIE: SOAPNote = {
  header: { patientId: 'LBP-001', visitDate: '2026-02-08', noteType: 'IE', insuranceType: 'WC', visitNumber: 1 },
  subjective: {
    visitType: 'INITIAL EVALUATION',
    chronicityLevel: 'Chronic',
    primaryBodyPart: { bodyPart: 'LBP', laterality: 'bilateral' },
    secondaryBodyParts: [],
    painTypes: ['Aching', 'Stiffness'],
    painRadiation: 'without radiation',
    symptomDuration: { value: 3, unit: 'month(s)' },
    associatedSymptoms: ['soreness', 'tightness'],
    symptomPercentage: '80%',
    causativeFactors: ['age related/degenerative changes', 'prolong sitting'],
    exacerbatingFactors: ['any strenuous activities', 'prolong sitting'],
    relievingFactors: ['resting'],
    adlDifficulty: { level: 'moderate to severe', activities: ['performing household chores', 'bending down'] },
    activityChanges: [],
    painScale: { worst: 8, best: 6, current: 8 },
    painFrequency: 'Constant (symptoms occur between 76% and 100% of the time)'
  },
  objective: {
    muscleTesting: {
      tightness: { muscles: ['erector spinae', 'quadratus lumborum'], gradingScale: 'moderate to severe' },
      tenderness: { muscles: ['erector spinae', 'quadratus lumborum'], gradingScale: '(+3) = Patient complains of considerable tenderness and withdraws momentarily in response to the test pressure' },
      spasm: { muscles: ['erector spinae'], gradingScale: '(+2)=>2 but < 5 spontaneous spasms per hour.' }
    },
    rom: [
      { movement: 'Flexion', strength: '3+/5', degrees: '60 Degrees(moderate)' },
      { movement: 'Extension', strength: '3/5', degrees: '15 Degrees(moderate)' },
      { movement: 'Rotation to Right', strength: '3+/5', degrees: '30 Degrees(moderate)' },
      { movement: 'Rotation to Left', strength: '3+/5', degrees: '30 Degrees(moderate)' },
      { movement: 'Flexion to the Right', strength: '3+/5', degrees: '20 Degrees(moderate)' },
      { movement: 'Flexion to the Left', strength: '3+/5', degrees: '20 Degrees(moderate)' }
    ],
    inspection: ['weak muscles and dry skin without luster'],
    tonguePulse: { tongue: 'pale with thin white coat', pulse: 'deep and thready' }
  },
  assessment: {
    tcmDiagnosis: { localPattern: 'Qi Stagnation, Blood Stasis', systemicPattern: 'Kidney Qi Deficiency', bodyPart: 'lower back' },
    treatmentPrinciples: { focusOn: 'focus', harmonize: 'Liver and Kidney', purpose: 'promote good essence' },
    evaluationArea: 'lower back'
  },
  plan: {
    evaluationType: 'Initial Evaluation',
    contactTime: '20-30 mins',
    steps: [],
    shortTermGoal: {
      treatmentFrequency: 12,
      weeksDuration: '5-6 weeks',
      painScaleTarget: '5-6',
      symptomTargets: []
    },
    longTermGoal: {
      treatmentFrequency: 8,
      weeksDuration: '5-6 weeks',
      painScaleTarget: '3-4',
      symptomTargets: []
    },
    needleProtocol: { needleSizes: ['30#x1.5"'], totalTime: 60, sections: [] }
  },
  diagnosisCodes: [{ icd10: 'M54.5', description: 'Low back pain', bodyPart: 'LBP' }],
  procedureCodes: []
}

// === IE ===
const ieContext: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'WC',
  primaryBodyPart: 'LBP',
  laterality: 'bilateral',
  localPattern: 'Qi Stagnation, Blood Stasis',
  systemicPattern: 'Kidney Qi Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  previousIE
}

console.log('='.repeat(80))
console.log('IE (Initial Evaluation) - LBP')
console.log('='.repeat(80))
console.log(exportSOAPAsText(ieContext))

// === 5 TX ===
const txContext: GenerationContext = { ...ieContext, noteType: 'TX' }
const txSeries = exportTXSeriesAsText(txContext, { txCount: 5 })

for (const tx of txSeries) {
  console.log('='.repeat(80))
  console.log(`TX #${tx.visitIndex}  |  progress=${tx.state.progress.toFixed(2)}  pain=${tx.state.painScaleLabel}  severity=${tx.state.severityLevel}`)
  console.log('='.repeat(80))
  console.log(tx.text)
}
