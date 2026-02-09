const { exportSOAPAsText } = require('./src/generator/soap-generator')

// IE: 双肩痛初诊
const ieContext = {
  noteType: 'IE',
  insuranceType: 'WC',
  primaryBodyPart: 'SHOULDER',
  secondaryBodyParts: ['NECK'],
  laterality: 'bilateral',
  localPattern: 'Qi Stagnation',
  systemicPattern: 'Liver Qi Stagnation',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate',
  hasPacemaker: false
}

console.log('='.repeat(80))
console.log('IE - 双侧肩痛初诊 (Initial Evaluation)')
console.log('='.repeat(80))
console.log(exportSOAPAsText(ieContext))

// TX: 复诊
const txContext = {
  noteType: 'TX',
  insuranceType: 'WC',
  primaryBodyPart: 'SHOULDER',
  secondaryBodyParts: ['NECK'],
  laterality: 'bilateral',
  localPattern: 'Blood Stasis',
  systemicPattern: 'Liver Qi Stagnation',
  chronicityLevel: 'Chronic',
  severityLevel: 'mild to moderate',
  hasPacemaker: false
}

console.log('\n\n')
console.log('='.repeat(80))
console.log('TX - 双侧肩痛复诊 (Daily Note / Treatment)')
console.log('='.repeat(80))
console.log(exportSOAPAsText(txContext))
