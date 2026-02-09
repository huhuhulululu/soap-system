import { exportSOAPAsText } from './src/index'
import type { GenerationContext } from './src/types'

// IE: 双侧颈痛初诊
const neckIEContext: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'WC',
  primaryBodyPart: 'NECK',
  secondaryBodyParts: ['LBP', 'KNEE'],
  laterality: 'bilateral',
  localPattern: 'Qi Stagnation, Blood Stasis',
  systemicPattern: 'Qi & Blood Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  hasPacemaker: false
}

console.log('='.repeat(80))
console.log('IE - 双侧颈痛初诊 (Initial Evaluation - Bilateral Neck Pain)')
console.log('='.repeat(80))
console.log()
console.log(exportSOAPAsText(neckIEContext))
