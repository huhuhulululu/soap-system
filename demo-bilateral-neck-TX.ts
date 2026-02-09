import { exportSOAPAsText } from './src/index'
import type { GenerationContext } from './src/types'

// TX: 双侧颈痛随访
const neckTXContext: GenerationContext = {
  noteType: 'TX',
  insuranceType: 'WC',
  primaryBodyPart: 'NECK',
  secondaryBodyParts: [],
  laterality: 'bilateral',
  localPattern: 'Qi Stagnation, Blood Stasis',
  systemicPattern: 'Qi & Blood Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  hasPacemaker: false
}

console.log('='.repeat(80))
console.log('TX - 双侧颈痛随访 (Treatment Note - Bilateral Neck Pain)')
console.log('='.repeat(80))
console.log()
console.log(exportSOAPAsText(neckTXContext))
