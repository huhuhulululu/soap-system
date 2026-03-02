import { generateTXSequenceStates } from '../tx-sequence-engine';

const ctx = {
  noteType: 'TX' as const,
  insuranceType: 'OPTUM' as const,
  primaryBodyPart: 'LBP' as const,
  laterality: 'bilateral' as const,
  localPattern: 'Qi Stagnation',
  systemicPattern: 'Kidney Yang Deficiency',
  chronicityLevel: 'Chronic' as const,
  severityLevel: 'moderate to severe' as const,
  painCurrent: 8,
  associatedSymptom: 'soreness' as const,
};

const r = generateTXSequenceStates(ctx, {
  txCount: 12, seed: 88888,
  initialState: { pain: 8, associatedSymptom: 'soreness', symptomScale: '70%-80%' },
});

for (let i = 0; i < 4; i++) {
  const s = r.states[i];
  const obj = s.soaChain.objective;
  console.log(`TX${i+1}:`);
  console.log(`  pain=${s.painScaleCurrent.toFixed(1)}, scale=${s.symptomScale}, sev=${s.severityLevel}`);
  console.log(`  freq=${s.painFrequency.split('(')[0].trim()}`);
  console.log(`  tightness=${obj.tightnessTrend}, tenderness=${obj.tendernessTrend}, spasm=${obj.spasmTrend}, ROM=${obj.romTrend}, strength=${obj.strengthTrend}`);
  console.log(`  SC="${s.symptomChange}"`);
  console.log(`  A.present="${s.soaChain.assessment.present}"`);
  console.log(`  A.what="${s.soaChain.assessment.whatChanged}"`);
}
