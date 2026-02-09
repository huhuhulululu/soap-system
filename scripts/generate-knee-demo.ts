import type { GenerationContext, SOAPNote } from '../src/types'
import { exportSOAPAsText, exportTXSeriesAsText } from '../src/generator/soap-generator'

const previousIE: SOAPNote = {
  header: { patientId: 'KNEE-001', visitDate: '2026-02-08', noteType: 'IE', insuranceType: 'WC', visitNumber: 1 },
  subjective: {
    visitType: 'INITIAL EVALUATION',
    chronicityLevel: 'Chronic',
    primaryBodyPart: { bodyPart: 'KNEE', laterality: 'right' },
    secondaryBodyParts: [],
    painTypes: ['Aching', 'Stiffness'],
    painRadiation: 'without radiation',
    symptomDuration: { value: 6, unit: 'month(s)' },
    associatedSymptoms: ['soreness', 'weakness'],
    symptomPercentage: '80%',
    causativeFactors: ['age related/degenerative changes', 'prolong walking'],
    exacerbatingFactors: ['any strenuous activities', 'climb too much stairs'],
    relievingFactors: ['resting'],
    adlDifficulty: { level: 'moderate to severe', activities: ['walking up/down stairs', 'squatting'] },
    activityChanges: [],
    painScale: { worst: 8, best: 6, current: 8 },
    painFrequency: 'Constant (symptoms occur between 76% and 100% of the time)'
  },
  objective: {
    muscleTesting: {
      tightness: { muscles: ['quadriceps', 'hamstrings'], gradingScale: 'moderate to severe' },
      tenderness: { muscles: ['quadriceps', 'patellar tendon'], gradingScale: '(+3) = There is severe tenderness with withdrawal' },
      spasm: { muscles: ['quadriceps'], gradingScale: '(+2)=Occasional spontaneous spasms and easily induced spasms.' }
    },
    rom: [
      { movement: 'Flexion(fully bent)', strength: '3+/5', degrees: '90 degree(moderate)' },
      { movement: 'Extension(fully straight)', strength: '4/5', degrees: '10 degree(mild)' }
    ],
    inspection: ['joint swelling'],
    tonguePulse: { tongue: 'pale, thin white coat', pulse: 'deep and thready' }
  },
  assessment: {
    tcmDiagnosis: { localPattern: 'Qi Stagnation, Blood Stasis', systemicPattern: 'Kidney Qi Deficiency', bodyPart: 'knee' },
    treatmentPrinciples: { focusOn: 'focus', harmonize: 'Liver and Kidney', purpose: 'promote healthy joint and lessen dysfunction in all aspects' },
    evaluationArea: 'knee'
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
    needleProtocol: { needleSizes: ['34#x1"', '30#x1.5"', '30#x2"'], totalTime: 60, sections: [] }
  },
  diagnosisCodes: [{ icd10: 'M17.11', description: 'Primary osteoarthritis, right knee', bodyPart: 'KNEE', laterality: 'right' }],
  procedureCodes: []
}

const ieContext: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'WC',
  primaryBodyPart: 'KNEE',
  laterality: 'right',
  localPattern: 'Qi Stagnation, Blood Stasis',
  systemicPattern: 'Kidney Qi Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  previousIE
}

console.log('='.repeat(80))
console.log('IE (Initial Evaluation) - Right KNEE')
console.log('='.repeat(80))
console.log(exportSOAPAsText(ieContext))

const txContext: GenerationContext = { ...ieContext, noteType: 'TX' }
const txSeries = exportTXSeriesAsText(txContext, { txCount: 5 })

for (const tx of txSeries) {
  console.log('='.repeat(80))
  console.log(`TX #${tx.visitIndex}  |  progress=${tx.state.progress.toFixed(2)}  pain=${tx.state.painScaleLabel}  severity=${tx.state.severityLevel}  spasm=${tx.state.spasmGrading.substring(0,4)}  tender=${tx.state.tendernessGrading.substring(0,30)}`)
  console.log('='.repeat(80))
  console.log(tx.text)
}
