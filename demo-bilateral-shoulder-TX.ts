import { exportSOAPAsText } from './src/index'
import type { GenerationContext } from './src/types'

// TX: 双肩痛随访治疗 (Daily Note / Treatment Note)
const shoulderTXContext: GenerationContext = {
  noteType: 'TX',
  insuranceType: 'WC',
  primaryBodyPart: 'SHOULDER',
  laterality: 'bilateral',
  localPattern: 'Qi Stagnation, Blood Stasis',
  systemicPattern: 'Qi & Blood Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  hasPacemaker: false
}

console.log('='.repeat(80))
console.log('TX - 双侧肩痛随访 (Treatment Note - Bilateral Shoulder Pain)')
console.log('='.repeat(80))
console.log()
console.log(exportSOAPAsText(shoulderTXContext))
