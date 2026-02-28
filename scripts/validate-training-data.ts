/**
 * Validate generated training data — check counts, format, diversity
 * Usage: npx tsx scripts/validate-training-data.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const RAW_DIR = path.resolve(__dirname, '..', 'training-data', 'raw');
const CHAT_DIR = path.resolve(__dirname, '..', 'training-data', 'chat');

const BPS = ['SHOULDER', 'KNEE', 'LBP', 'NECK', 'ELBOW', 'HIP'];
const stats: Record<string, { raw: number; chat: number; ieCount: number; txCount: number; avgOutputLen: number; errors: string[] }> = {};

for (const bp of BPS) {
  const entry = { raw: 0, chat: 0, ieCount: 0, txCount: 0, avgOutputLen: 0, errors: [] as string[] };
  let totalLen = 0;

  const rawFile = path.join(RAW_DIR, `${bp}-soap.jsonl`);
  if (fs.existsSync(rawFile)) {
    const lines = fs.readFileSync(rawFile, 'utf-8').trim().split('\n');
    entry.raw = lines.length;
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (!obj.id || !obj.input || !obj.output) entry.errors.push(`Missing fields in ${obj.id}`);
        if (obj.id.includes('-IE')) entry.ieCount++;
        else entry.txCount++;
        totalLen += obj.output.length;
        if (obj.output.length < 200) entry.errors.push(`Short output in ${obj.id}: ${obj.output.length} chars`);
      } catch { entry.errors.push(`Invalid JSON in raw`); }
    }
    entry.avgOutputLen = entry.raw > 0 ? Math.round(totalLen / entry.raw) : 0;
  } else {
    entry.errors.push('raw file not found');
  }

  const chatFile = path.join(CHAT_DIR, `${bp}-chat.jsonl`);
  if (fs.existsSync(chatFile)) {
    const lines = fs.readFileSync(chatFile, 'utf-8').trim().split('\n');
    entry.chat = lines.length;
  }

  if (entry.raw !== entry.chat) entry.errors.push(`raw/chat count mismatch: ${entry.raw} vs ${entry.chat}`);

  stats[bp] = entry;
}

console.log('\n' + '='.repeat(80));
console.log('TRAINING DATA VALIDATION REPORT');
console.log('='.repeat(80));

let totalRaw = 0, totalChat = 0, totalErrors = 0;
for (const bp of BPS) {
  const s = stats[bp];
  totalRaw += s.raw;
  totalChat += s.chat;
  totalErrors += s.errors.length;
  const status = s.errors.length === 0 ? '✅' : '⚠️';
  console.log(`${status} ${bp.padEnd(10)} raw=${String(s.raw).padStart(7)} chat=${String(s.chat).padStart(7)} (IE=${String(s.ieCount).padStart(5)} TX=${String(s.txCount).padStart(6)}) avg=${String(s.avgOutputLen).padStart(5)}ch errors=${s.errors.length}`);
  if (s.errors.length > 0 && s.errors.length <= 5) {
    s.errors.forEach(e => console.log(`   ❌ ${e}`));
  } else if (s.errors.length > 5) {
    s.errors.slice(0, 3).forEach(e => console.log(`   ❌ ${e}`));
    console.log(`   ... and ${s.errors.length - 3} more`);
  }
}

console.log('-'.repeat(80));
console.log(`TOTAL: raw=${totalRaw} chat=${totalChat} errors=${totalErrors}`);

const statsFile = path.resolve(__dirname, '..', 'training-data', 'stats.json');
fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
console.log(`\nStats saved to ${statsFile}`);
