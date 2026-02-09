import { exportSOAPAsText } from './src/index.ts'
import type { GenerationContext } from './src/types/index.ts'

const context: GenerationContext = {
  noteType: 'IE',
  insuranceType: 'WC',
  primaryBodyPart: 'SHOULDER',
  laterality: 'bilateral',
  secondaryBodyParts: ['NECK'],
  localPattern: 'Qi Stagnation',
  systemicPattern: 'Liver Qi Stagnation',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate',
  hasPacemaker: false
}

console.log(exportSOAPAsText(context));
