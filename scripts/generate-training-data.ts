/**
 * Training data generator — Phase A (SOAP text)
 * Usage: npx tsx scripts/generate-training-data.ts --bp=SHOULDER --count=10000
 */
import * as fs from 'fs';
import * as path from 'path';
import { randomizePatientContext } from './lib/patient-randomizer';
import { exportSOAPAsText, exportTXSeriesAsText } from '../src/generator/soap-generator';
import { patchSOAPText } from '../src/generator/objective-patch';
import type { GenerationContext } from '../src/types';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace(/^--/, '').split('='))
);

const BP = args.bp || 'SHOULDER';
const COUNT = parseInt(args.count || '10000', 10);
const TX_SUPPORTED = new Set(['SHOULDER', 'KNEE', 'LBP', 'NECK', 'ELBOW']);
const HAS_TX = TX_SUPPORTED.has(BP);

const RAW_DIR = path.resolve(__dirname, '..', 'training-data', 'raw');
const CHAT_DIR = path.resolve(__dirname, '..', 'training-data', 'chat');
fs.mkdirSync(RAW_DIR, { recursive: true });
fs.mkdirSync(CHAT_DIR, { recursive: true });

const rawStream = fs.createWriteStream(path.join(RAW_DIR, `${BP}-soap.jsonl`));
const chatStream = fs.createWriteStream(path.join(CHAT_DIR, `${BP}-chat.jsonl`));

const SYSTEM_PROMPT = `You are an expert acupuncture SOAP note generator for MDLand EHR. Given patient information, generate a complete SOAP note following the exact MDLand template format.`;

function contextToUserPrompt(ctx: GenerationContext, noteType: 'IE' | 'TX', visitIndex?: number): string {
  const parts = [
    `Generate ${noteType === 'IE' ? 'Initial Evaluation' : `Treatment Note (Visit ${visitIndex})`} SOAP for:`,
    `Body Part: ${ctx.primaryBodyPart}, Laterality: ${ctx.laterality}`,
    `Patient: ${ctx.age}${ctx.gender === 'Female' ? 'F' : 'M'}, Pain: ${ctx.painCurrent}/10 (worst ${ctx.painWorst}, best ${ctx.painBest})`,
    `Chronicity: ${ctx.chronicityLevel}, Severity: ${ctx.severityLevel}`,
    `TCM: ${ctx.localPattern} (local), ${ctx.systemicPattern} (systemic)`,
    `Symptoms: ${(ctx.associatedSymptoms || []).join(', ')}`,
    `Pain Types: ${(ctx.painTypes || []).join(', ')}`,
    `Frequency: ${ctx.painFrequency || 'N/A'}`,
    `Symptom Scale: ${ctx.symptomScale || 'N/A'}`,
    `Duration: ${ctx.symptomDuration ? `${ctx.symptomDuration.value} ${ctx.symptomDuration.unit}` : 'N/A'}`,
  ];
  if (ctx.causativeFactors?.length) parts.push(`Causatives: ${ctx.causativeFactors.join(', ')}`);
  if (ctx.exacerbatingFactors?.length) parts.push(`Aggravating: ${ctx.exacerbatingFactors.join(', ')}`);
  if (ctx.relievingFactors?.length) parts.push(`Relieving: ${ctx.relievingFactors.join(', ')}`);
  return parts.join('\n');
}

function writeRaw(id: string, input: Record<string, unknown>, output: string) {
  rawStream.write(JSON.stringify({ id, input, output }) + '\n');
}

function writeChat(id: string, userPrompt: string, assistantOutput: string) {
  chatStream.write(JSON.stringify({
    id,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: assistantOutput },
    ],
  }) + '\n');
}

const startTime = Date.now();
let totalSamples = 0;
let errorCount = 0;

for (let seed = 1; seed <= COUNT; seed++) {
  const ctx = randomizePatientContext(BP, seed);

  // IE
  try {
    const ieText = patchSOAPText(exportSOAPAsText(ctx), ctx);
    const ieId = `${BP}-s${seed}-IE`;
    const { noteType: _nt, ...inputFields } = ctx;
    writeRaw(ieId, { ...inputFields, noteType: 'IE' }, ieText);
    writeChat(ieId, contextToUserPrompt(ctx, 'IE'), ieText);
    totalSamples++;
  } catch (e: any) {
    errorCount++;
    if (errorCount <= 10) process.stderr.write(`[WARN] ${BP} seed=${seed} IE: ${e.message}\n`);
  }

  // TX series
  if (HAS_TX) {
    try {
      const txCount = 12 + (seed % 9); // 12-20 visits
      const txItems = exportTXSeriesAsText(ctx, { txCount, seed });
      const txCtx: GenerationContext = { ...ctx, noteType: 'TX' };

      for (const item of txItems) {
        const txText = patchSOAPText(item.text, txCtx);
        const txId = `${BP}-s${seed}-TX${item.visitIndex}`;
        writeRaw(txId, { ...txCtx, visitIndex: item.visitIndex } as any, txText);
        writeChat(txId, contextToUserPrompt(txCtx, 'TX', item.visitIndex), txText);
        totalSamples++;
      }
    } catch (e: any) {
      errorCount++;
      if (errorCount <= 10) process.stderr.write(`[WARN] ${BP} seed=${seed} TX: ${e.message}\n`);
    }
  }

  if (seed % 1000 === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = (seed / parseFloat(elapsed)).toFixed(0);
    process.stderr.write(`[${BP}] ${seed}/${COUNT} (${elapsed}s, ${rate}/s, ${totalSamples} samples, ${errorCount} errors)\n`);
  }
}

rawStream.end();
chatStream.end();

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n✅ ${BP}: ${totalSamples} samples in ${elapsed}s (${errorCount} errors) → training-data/raw/${BP}-soap.jsonl`);
