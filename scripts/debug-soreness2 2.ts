import { generateTXSequenceStates } from '../src/generator/tx-sequence-engine';
import { setWhitelist } from '../src/parser/template-rule-whitelist';
import whitelistData from '../frontend/src/data/whitelist.json';
setWhitelist(whitelistData as Record<string, string[]>);

const ctx = { noteType:'TX',insuranceType:'OPTUM',primaryBodyPart:'SHOULDER',laterality:'right',localPattern:'Cold-Damp + Wind-Cold',systemicPattern:'Kidney Yang Deficiency',chronicityLevel:'Chronic',severityLevel:'moderate to severe',painCurrent:8,associatedSymptom:'soreness',hasPacemaker:false } as any;
const { states } = generateTXSequenceStates(ctx, { txCount:20,seed:2024,initialState:{pain:8,tightness:3,tenderness:3,spasm:3,frequency:3,associatedSymptom:'soreness',painTypes:['Dull','Aching']} });

for (let i = 7; i <= 10; i++) {
  const st = states[i];
  const prev = states[i - 1];
  const dimScore = (st as any).dimScore;
  console.log(`TX${st.visitIndex}:`);
  console.log(`  symptomScale: ${prev.symptomScale} → ${st.symptomScale}`);
  console.log(`  severityLevel: ${prev.severityLevel} → ${st.severityLevel}`);
  console.log(`  painDelta: ${(prev.painScaleCurrent - st.painScaleCurrent).toFixed(2)}`);
  console.log(`  A.whatChanged: ${st.soaChain?.assessment?.whatChanged}`);
  console.log(`  changedDims: ${JSON.stringify((st.soaChain?.assessment as any)?.changedDims)}`);
  console.log('');
}
