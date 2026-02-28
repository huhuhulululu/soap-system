/**
 * Validate generated training data — check counts, format, diversity
 * Uses streaming to handle large files (>500MB)
 * Usage: npx tsx scripts/validate-training-data.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const RAW_DIR = path.resolve(__dirname, '..', 'training-data', 'raw');
const CHAT_DIR = path.resolve(__dirname, '..', 'training-data', 'chat');

const BPS = ['SHOULDER', 'KNEE', 'LBP', 'NECK', 'ELBOW', 'HIP'];

interface BPStats {
  raw: number; chat: number; ieCount: number; txCount: number;
  avgOutputLen: number; minOutputLen: number; maxOutputLen: number;
  errors: number; errorSamples: string[];
}

async function countLines(filePath: string): Promise<number> {
  if (!fs.existsSync(filePath)) return -1;
  let count = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  for await (const _ of rl) count++;
  return count;
}

async function validateRaw(filePath: string): Promise<Omit<BPStats, 'chat'>> {
  const result = { raw: 0, ieCount: 0, txCount: 0, avgOutputLen: 0, minOutputLen: Infinity, maxOutputLen: 0, errors: 0, errorSamples: [] as string[] };
  if (!fs.existsSync(filePath)) { result.errors = 1; result.errorSamples.push('raw file not found'); return result; }

  let totalLen = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });

  for await (const line of rl) {
    result.raw++;
    try {
      const obj = JSON.parse(line);
      if (!obj.id || !obj.input || !obj.output) {
        result.errors++;
        if (result.errorSamples.length < 3) result.errorSamples.push(`Missing fields in ${obj.id}`);
        continue;
      }
      if (obj.id.includes('-IE')) result.ieCount++;
      else result.txCount++;
      const len = obj.output.length;
      totalLen += len;
      if (len < result.minOutputLen) result.minOutputLen = len;
      if (len > result.maxOutputLen) result.maxOutputLen = len;
      if (len < 200) {
        result.errors++;
        if (result.errorSamples.length < 3) result.errorSamples.push(`Short output in ${obj.id}: ${len} chars`);
      }
    } catch {
      result.errors++;
      if (result.errorSamples.length < 3) result.errorSamples.push('Invalid JSON');
    }
  }

  result.avgOutputLen = result.raw > 0 ? Math.round(totalLen / result.raw) : 0;
  if (result.minOutputLen === Infinity) result.minOutputLen = 0;
  return result;
}

async function main() {
  console.log('\n' + '='.repeat(90));
  console.log('TRAINING DATA VALIDATION REPORT');
  console.log('='.repeat(90));

  let totalRaw = 0, totalChat = 0, totalErrors = 0;

  for (const bp of BPS) {
    const rawFile = path.join(RAW_DIR, `${bp}-soap.jsonl`);
    const chatFile = path.join(CHAT_DIR, `${bp}-chat.jsonl`);

    const [rawStats, chatCount] = await Promise.all([
      validateRaw(rawFile),
      countLines(chatFile),
    ]);

    const chatOk = chatCount === rawStats.raw;
    const errors = rawStats.errors + (chatOk ? 0 : 1);
    totalRaw += rawStats.raw;
    totalChat += Math.max(0, chatCount);
    totalErrors += errors;

    const status = errors === 0 ? '✅' : '⚠️';
    console.log(
      `${status} ${bp.padEnd(10)} raw=${String(rawStats.raw).padStart(7)} chat=${String(chatCount).padStart(7)}` +
      ` (IE=${String(rawStats.ieCount).padStart(5)} TX=${String(rawStats.txCount).padStart(6)})` +
      ` avg=${String(rawStats.avgOutputLen).padStart(5)}ch` +
      ` [${rawStats.minOutputLen}-${rawStats.maxOutputLen}]` +
      ` errors=${errors}`
    );
    if (rawStats.errorSamples.length > 0) {
      rawStats.errorSamples.forEach(e => console.log(`   ❌ ${e}`));
    }
    if (!chatOk && chatCount >= 0) console.log(`   ❌ raw/chat mismatch: ${rawStats.raw} vs ${chatCount}`);
  }

  console.log('-'.repeat(90));
  console.log(`TOTAL: raw=${totalRaw} chat=${totalChat} errors=${totalErrors}`);

  // File sizes
  console.log('\nFile sizes:');
  for (const bp of BPS) {
    const rawFile = path.join(RAW_DIR, `${bp}-soap.jsonl`);
    const chatFile = path.join(CHAT_DIR, `${bp}-chat.jsonl`);
    const rawSize = fs.existsSync(rawFile) ? (fs.statSync(rawFile).size / 1024 / 1024).toFixed(1) : '0';
    const chatSize = fs.existsSync(chatFile) ? (fs.statSync(chatFile).size / 1024 / 1024).toFixed(1) : '0';
    console.log(`  ${bp.padEnd(10)} raw=${rawSize.padStart(7)}MB  chat=${chatSize.padStart(7)}MB`);
  }
}

main().catch(console.error);
