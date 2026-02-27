import { generateTXSequenceStates } from '../src/generator/tx-sequence-engine';
import { setWhitelist } from '../src/parser/template-rule-whitelist';
import whitelistData from '../frontend/src/data/whitelist.json';
setWhitelist(whitelistData as Record<string, string[]>);

const ctx = { noteType:'TX',insuranceType:'OPTUM',primaryBodyPart:'LBP',laterality:'bilateral',localPattern:'Cold-Damp + Wind-Cold',systemicPattern:'Kidney Yang Deficiency',chronicityLevel:'Chronic',severityLevel:'moderate to severe',painCurrent:8,associatedSymptom:'soreness',hasPacemaker:false } as any;
const { states } = generateTXSequenceStates(ctx, { txCount:5,seed:42,initialState:{pain:8,tightness:3,tenderness:3,spasm:3,frequency:3,associatedSymptom:'soreness',painTypes:['Dull','Aching']} });

for (const st of states) {
  console.log(`TX${st.visitIndex}:`);
  console.log('  soaChain.subjective:', JSON.stringify(st.soaChain?.subjective));
  console.log('  painScaleCurrent:', st.painScaleCurrent);
  console.log('  painScaleLabel:', st.painScaleLabel);
  console.log('  adlItems:', st.adlItems);
  console.log('');
}
