import { exportSOAPAsText, exportTXSeriesAsText } from '../soap-generator';
import { setWhitelist } from '../../parser/template-rule-whitelist.browser';
import whitelistData from '../../../frontend/src/data/whitelist.json';
setWhitelist(whitelistData);

const ctx = {
  noteType: 'IE' as const,
  insuranceType: 'OPTUM' as const,
  primaryBodyPart: 'LBP' as const,
  laterality: 'bilateral' as const,
  localPattern: 'Qi Stagnation',
  systemicPattern: 'Kidney Yang Deficiency',
  chronicityLevel: 'Chronic' as const,
  severityLevel: 'moderate to severe' as const,
  painCurrent: 8,
  associatedSymptom: 'soreness' as const,
  causativeFactors: [] as string[],
  relievingFactors: [] as string[],
  symptomScale: '70%-80%',
};

// IE
console.log('='.repeat(80));
console.log('IE0 - INITIAL EVALUATION');
console.log('='.repeat(80));
const ieText = exportSOAPAsText(ctx);
console.log(ieText);

// TX series
const series = exportTXSeriesAsText(ctx, {
  txCount: 12,
  seed: 88888,
  initialState: { pain: 8, associatedSymptom: 'soreness', symptomScale: '70%-80%' },
});

for (const item of series) {
  console.log('\n' + '='.repeat(80));
  console.log(`TX${item.visitIndex} - TREATMENT NOTE`);
  console.log('='.repeat(80));
  console.log(item.text);
  
  // 自检: S/A 一致性
  const sc = item.state.symptomChange;
  const ap = item.state.soaChain.assessment.present;
  const wc = item.state.soaChain.assessment.whatChanged;
  const issues: string[] = [];
  
  if (sc.includes('improvement') && ap.includes('similar')) issues.push('S=improvement but A=similar');
  if (sc.includes('similar') && ap.includes('improvement')) issues.push('S=similar but A=improvement');
  if (ap.includes('similar') && item.state.soaChain.assessment.patientChange.includes('decreased')) issues.push('A.present=similar but patientChange=decreased');
  
  if (issues.length > 0) {
    console.log(`\n⚠️ ISSUES: ${issues.join(', ')}`);
  }
}

// 汇总
console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
let prevScale = '70%-80%';
let prevPain = 8;
for (const item of series) {
  const s = item.state;
  const scaleChanged = s.symptomScale !== prevScale ? `${prevScale}→${s.symptomScale}` : 'same';
  const painDelta = (prevPain - s.painScaleCurrent).toFixed(1);
  console.log(`TX${item.visitIndex}: pain=${s.painScaleCurrent.toFixed(1)}(Δ${painDelta}) scale=${s.symptomScale}(${scaleChanged}) sev=${s.severityLevel} freq=${s.painFrequency.split('(')[0].trim()} SC="${s.symptomChange}" A.present="${s.soaChain.assessment.present}" A.what="${s.soaChain.assessment.whatChanged}"`);
  prevScale = s.symptomScale;
  prevPain = s.painScaleCurrent;
}
