import { generateTXSequenceStates } from '../src/generator/tx-sequence-engine';
import { setWhitelist } from '../src/parser/template-rule-whitelist';
import whitelistData from '../frontend/src/data/whitelist.json';
setWhitelist(whitelistData as Record<string, string[]>);

// All 3 violations are seed=2024, TX9
for (const bp of ['SHOULDER', 'NECK', 'ELBOW']) {
  const ctx = { noteType:'TX',insuranceType:'OPTUM',primaryBodyPart:bp,laterality:'right',localPattern:'Cold-Damp + Wind-Cold',systemicPattern:'Kidney Yang Deficiency',chronicityLevel:'Chronic',severityLevel:'moderate to severe',painCurrent:8,associatedSymptom:'soreness',hasPacemaker:false } as any;
  const { states } = generateTXSequenceStates(ctx, { txCount:20,seed:2024,initialState:{pain:8,tightness:3,tenderness:3,spasm:3,frequency:3,associatedSymptom:'soreness',painTypes:['Dull','Aching']} });

  for (let i = 7; i <= 10; i++) {
    const st = states[i];
    const prev = states[i - 1];
    console.log(`${bp} TX${st.visitIndex}: symptomScale=${st.symptomScale} prev=${prev.symptomScale} A.whatChanged="${st.soaChain?.assessment?.whatChanged}"`);
  }
  console.log('');
}
