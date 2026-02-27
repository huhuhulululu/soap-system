/**
 * Full 20-visit SOAP text generation — for manual longitudinal review.
 * Generates complete SOAP text for each body part × seed, outputs structured for review.
 */
import { exportTXSeriesAsText } from '../src/generator/soap-generator';
import { patchSOAPText } from '../src/generator/objective-patch';
import { setWhitelist } from '../src/parser/template-rule-whitelist';
import whitelistData from '../frontend/src/data/whitelist.json';
import type { GenerationContext } from '../src/types';
import type { TXSequenceOptions } from '../src/generator/tx-sequence-engine';

setWhitelist(whitelistData as Record<string, string[]>);

const bodyParts = ['LBP', 'KNEE', 'SHOULDER', 'NECK', 'ELBOW'] as const;
const seeds = [42, 999, 2024];

for (const bp of bodyParts) {
  for (const seed of seeds) {
    const ctx = {
      noteType: 'TX', insuranceType: 'OPTUM', primaryBodyPart: bp,
      laterality: bp === 'LBP' ? 'bilateral' : 'right',
      localPattern: 'Cold-Damp + Wind-Cold', systemicPattern: 'Kidney Yang Deficiency',
      chronicityLevel: 'Chronic', severityLevel: 'moderate to severe',
      painCurrent: 8, associatedSymptom: 'soreness', hasPacemaker: false,
    } as GenerationContext;

    const opts: TXSequenceOptions = {
      txCount: 20, seed,
      initialState: { pain: 8, tightness: 3, tenderness: 3, spasm: 3, frequency: 3, associatedSymptom: 'soreness', painTypes: ['Dull', 'Aching'] },
    };

    const items = exportTXSeriesAsText(ctx, opts);
    const texts = items.map(item => patchSOAPText(item.text, ctx));

    console.log(`\n${'='.repeat(80)}`);
    console.log(`  ${bp} | seed=${seed} | ${texts.length} visits`);
    console.log(`${'='.repeat(80)}`);

    for (let i = 0; i < texts.length; i++) {
      console.log(`\n--- TX${i + 1} ---`);
      console.log(texts[i]);
    }
  }
}
