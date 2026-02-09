import { exportSOAPAsText } from './src/index'
import type { GenerationContext } from './src/types'

// IE: 双肩痛初诊
const shoulderIEContext: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'WC',
  primaryBodyPart: 'SHOULDER',
  secondaryBodyParts: ['LBP', 'KNEE'],
  laterality: 'bilateral',
  localPattern: 'Qi Stagnation, Blood Stasis',
  systemicPattern: 'Qi & Blood Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  hasPacemaker: false
}

console.log('='.repeat(80))
console.log('IE - 双侧肩痛初诊 (Initial Evaluation - Bilateral Shoulder Pain)')
console.log('='.repeat(80))
console.log()
console.log(exportSOAPAsText(shoulderIEContext))
