import { exportSOAPAsText } from './src/index'
import type { GenerationContext } from './src/types'

// TX: 双侧腰痛随访
const lbpTXContext: GenerationContext = {
  noteType: 'TX',
  insuranceType: 'WC',
  primaryBodyPart: 'LBP',
  secondaryBodyParts: [],
  laterality: 'bilateral',
  localPattern: 'Cold-Damp + Wind-Cold',
  systemicPattern: 'Kidney Yang Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  hasPacemaker: false
}

console.log('='.repeat(80))
console.log('TX - 双侧腰痛随访 (Treatment Note - Bilateral Lower Back Pain)')
console.log('='.repeat(80))
console.log()
console.log(exportSOAPAsText(lbpTXContext))
