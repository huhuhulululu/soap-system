import { exportSOAPAsText } from './src/index'
import type { GenerationContext } from './src/types'

// TX: 双膝痛随访治疗 (Daily Note / Treatment Note)
const kneeTXContext: GenerationContext = {
  noteType: 'TX',
  insuranceType: 'WC',
  primaryBodyPart: 'KNEE',
  laterality: 'bilateral',
  localPattern: 'Cold-Damp + Wind-Cold',
  systemicPattern: 'Kidney Yang Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  hasPacemaker: false
}

console.log('='.repeat(80))
console.log('TX - 双侧膝盖痛随访 (Treatment Note - Bilateral Knee Pain)')
console.log('='.repeat(80))
console.log()
console.log(exportSOAPAsText(kneeTXContext))
