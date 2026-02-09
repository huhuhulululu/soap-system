import { exportSOAPAsText } from './src/index'
import type { GenerationContext } from './src/types'

// IE: 双侧腰痛初诊
const lbpIEContext: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'WC',
  primaryBodyPart: 'LBP',
  secondaryBodyParts: ['NECK', 'KNEE'],
  laterality: 'bilateral',
  localPattern: 'Cold-Damp + Wind-Cold',
  systemicPattern: 'Kidney Yang Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  hasPacemaker: false
}

console.log('='.repeat(80))
console.log('IE - 双侧腰痛初诊 (Initial Evaluation - Bilateral Lower Back Pain)')
console.log('='.repeat(80))
console.log()
console.log(exportSOAPAsText(lbpIEContext))
