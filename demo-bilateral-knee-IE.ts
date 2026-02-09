import { exportSOAPAsText } from './src/index.ts'
import type { GenerationContext } from './src/types/index.ts'

// IE: 双膝痛初诊
const kneeIEContext: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'WC',
  primaryBodyPart: 'KNEE',
  secondaryBodyParts: ['LBP'],
  laterality: 'bilateral',
  localPattern: 'Cold-Damp + Wind-Cold',
  systemicPattern: 'Kidney Yang Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  hasPacemaker: false
}

console.log('='.repeat(80))
console.log('IE - 双侧膝盖痛初诊 (Initial Evaluation - Bilateral Knee Pain)')
console.log('='.repeat(80))
console.log()
console.log(exportSOAPAsText(kneeIEContext))
