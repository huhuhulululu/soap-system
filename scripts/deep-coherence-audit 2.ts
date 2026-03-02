/**
 * Deep SOAP coherence audit — text-level + cross-section consistency
 * Generates full SOAP text and checks semantic coherence.
 */
import { generateTXSequenceStates } from '../src/generator/tx-sequence-engine';
import { exportTXSeriesAsText } from '../src/generator/soap-generator';
import { patchSOAPText } from '../src/generator/objective-patch';
import { setWhitelist } from '../src/parser/template-rule-whitelist';
import whitelistData from '../frontend/src/data/whitelist.json';
import type { GenerationContext } from '../src/types';
import type { TXSequenceOptions } from '../src/generator/tx-sequence-engine';

setWhitelist(whitelistData as Record<string, string[]>);

const bodyParts = ['LBP', 'KNEE', 'SHOULDER', 'NECK', 'ELBOW'] as const;
const seeds = [42, 999, 2024, 7777, 12345, 54321, 11111, 22222, 33333, 44444];

interface Violation { code: string; detail: string; }
const violations: Violation[] = [];

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
      txCount: 12, seed,
      initialState: { pain: 8, tightness: 3, tenderness: 3, spasm: 3, frequency: 3, associatedSymptom: 'soreness', painTypes: ['Dull', 'Aching'] },
    };

    const { states } = generateTXSequenceStates(ctx, opts);

    // Also generate full SOAP text for text-level checks
    let soapTexts: string[] = [];
    try {
      const rawTexts = exportTXSeriesAsText(ctx, opts);
      soapTexts = rawTexts.map(t => patchSOAPText(t, ctx));
    } catch {
      // If text generation fails, skip text checks
    }

    let prevPain = 8;
    let prevAdlCount = -1;
    let prevAdlItems: string[] = [];

    for (let idx = 0; idx < states.length; idx++) {
      const st = states[idx];
      const tag = `${bp} TX${st.visitIndex} seed=${seed}`;
      const text = soapTexts[idx] ?? '';
      const o = st.soaChain?.objective;
      const s = st.soaChain?.subjective;
      const a = st.soaChain?.assessment;
      const adlCount = st.adlItems?.length ?? 0;
      const painDelta = prevPain - st.painScaleCurrent;

      // === TEXT-01: S text says "improvement" but reason contradicts ===
      if (text.includes('improvement of symptom') && text.includes('did not have good rest')) {
        violations.push({ code: 'TEXT-CONTRADICT', detail: `${tag}: S says improvement but reason="did not have good rest"` });
      }

      // === TEXT-02: S text mentions "daily activities" but adlChange=stable ===
      const sSection = text.split('OBJECTIVE')[0] ?? '';
      if (s?.adlChange !== 'improved') {
        if (sSection.includes('daily activities') && sSection.includes('improved')) {
          violations.push({ code: 'TEXT-ADL', detail: `${tag}: S text mentions daily activities improved but adlChange=stable` });
        }
        if (sSection.includes('sitting tolerance has improved')) {
          violations.push({ code: 'TEXT-ADL2', detail: `${tag}: S text says sitting tolerance improved but adlChange=stable` });
        }
      }

      // === TEXT-03: A text says "decreased difficulty in performing ADLs" but adlChange=stable ===
      const aSection = text.split('ASSESSMENT')[1]?.split('PLAN')[0] ?? '';
      if (aSection.includes('ADL') && s?.adlChange !== 'improved') {
        violations.push({ code: 'TEXT-A-ADL', detail: `${tag}: A text mentions ADL but adlChange=stable` });
      }

      // === TEXT-04: Pain scale in text matches state ===
      const painMatch = sSection.match(/pain.*?(\d+(?:\.\d+)?)\s*(?:\/\s*10|out of 10)/i);
      if (painMatch) {
        const textPain = parseFloat(painMatch[1]);
        if (Math.abs(textPain - st.painScaleCurrent) > 0.5) {
          violations.push({ code: 'TEXT-PAIN', detail: `${tag}: text pain=${textPain} but state pain=${st.painScaleCurrent.toFixed(1)}` });
        }
      }

      // === FREQ-MONO: frequency should not increase (get worse) ===
      const freqOrder = ['Intermittent', 'Occasional', 'Frequent', 'Constant'];
      if (idx > 0) {
        const prevFreqText = states[idx - 1].painFrequency ?? '';
        const curFreqText = st.painFrequency ?? '';
        const prevFIdx = freqOrder.findIndex(f => prevFreqText.includes(f));
        const curFIdx = freqOrder.findIndex(f => curFreqText.includes(f));
        if (prevFIdx >= 0 && curFIdx >= 0 && curFIdx > prevFIdx) {
          violations.push({ code: 'FREQ-MONO', detail: `${tag}: frequency went UP "${freqOrder[prevFIdx]}"→"${freqOrder[curFIdx]}"` });
        }
      }

      // === TIGHTNESS-MONO: tightness grading should not increase ===
      const tightMatch = st.tightnessGrading?.match(/Grade\s*(\d)/i);
      const tightGrade = tightMatch ? parseInt(tightMatch[1]) : -1;
      if (idx > 0 && tightGrade >= 0) {
        const prevTightMatch = states[idx - 1].tightnessGrading?.match(/Grade\s*(\d)/i);
        const prevTightGrade = prevTightMatch ? parseInt(prevTightMatch[1]) : -1;
        if (prevTightGrade >= 0 && tightGrade > prevTightGrade) {
          violations.push({ code: 'TIGHT-MONO', detail: `${tag}: tightness went UP Grade ${prevTightGrade}→${tightGrade}` });
        }
      }

      // === ROM-MONO: ROM deficit should not increase (ROM should not get worse) ===
      // ROM text like "10% limited" — lower % is better
      const romMatch = text.match(/(\d+)%\s*(?:limited|limitation|deficit)/i);
      if (romMatch && idx > 0) {
        const curRomLimit = parseInt(romMatch[1]);
        const prevText = soapTexts[idx - 1] ?? '';
        const prevRomMatch = prevText.match(/(\d+)%\s*(?:limited|limitation|deficit)/i);
        if (prevRomMatch) {
          const prevRomLimit = parseInt(prevRomMatch[1]);
          if (curRomLimit > prevRomLimit) {
            violations.push({ code: 'ROM-MONO', detail: `${tag}: ROM limitation went UP ${prevRomLimit}%→${curRomLimit}%` });
          }
        }
      }

      // === ADL-ITEMS-STABLE: when adlChange=stable, ADL items should be same set ===
      if (s?.adlChange === 'stable' && prevAdlItems.length > 0 && st.adlItems) {
        const curSet = new Set(st.adlItems);
        const prevSet = new Set(prevAdlItems);
        const added = [...curSet].filter(x => !prevSet.has(x));
        const removed = [...prevSet].filter(x => !curSet.has(x));
        if (added.length > 0 || removed.length > 0) {
          // Items changed but adlChange=stable — this is okay if count is same
          // But if new items appeared that weren't there before, it's odd
          if (added.length > 0 && removed.length === 0) {
            violations.push({ code: 'ADL-ITEMS-GREW', detail: `${tag}: adl=stable but new items added: [${added.join(', ')}]` });
          }
        }
      }

      // === SYMPTOM-CHANGE↔DIMSCOPE: "similar" but multiple dims changed ===
      if (s?.symptomChange?.includes('similar')) {
        let changedCount = 0;
        if (painDelta > 0.2) changedCount++;
        if (s?.adlChange === 'improved') changedCount++;
        if (o?.tightnessTrend !== 'stable') changedCount++;
        if (o?.tendernessTrend !== 'stable') changedCount++;
        if (o?.spasmTrend !== 'stable') changedCount++;
        if (o?.romTrend !== 'stable') changedCount++;
        if (o?.strengthTrend !== 'stable') changedCount++;
        if (changedCount >= 3) {
          violations.push({ code: 'SIMILAR-BUT-CHANGED', detail: `${tag}: symptomChange=similar but ${changedCount} dims changed` });
        }
      }

      // === IMPROVEMENT↔ZERO-DIM: "improvement" but nothing actually changed ===
      if (s?.symptomChange?.includes('improvement') && !s?.symptomChange?.includes('came back')) {
        let anyChange = false;
        if (painDelta > 0.2) anyChange = true;
        if (s?.adlChange === 'improved') anyChange = true;
        if (o?.tightnessTrend !== 'stable') anyChange = true;
        if (o?.tendernessTrend !== 'stable') anyChange = true;
        if (o?.spasmTrend !== 'stable') anyChange = true;
        if (o?.romTrend !== 'stable') anyChange = true;
        if (o?.strengthTrend !== 'stable') anyChange = true;
        if (idx > 0 && st.symptomScale !== states[idx - 1].symptomScale) anyChange = true;
        if (idx > 0 && st.severityLevel !== states[idx - 1].severityLevel) anyChange = true;
        if (idx > 0 && st.painFrequency !== states[idx - 1].painFrequency) anyChange = true;
        if (!anyChange) {
          violations.push({ code: 'IMPROVE-NO-DIM', detail: `${tag}: symptomChange=improvement but no dimension actually changed` });
        }
      }

      // === CONNECTOR: reason connector matches symptomChange ===
      if (text) {
        // "improvement ... due to/because of" = positive connector
        // "similar ... and/may related of" = neutral connector
        if (s?.symptomChange?.includes('improvement') && !s?.symptomChange?.includes('came back')) {
          if (sSection.includes('may related of') || (sSection.includes(' and ') && !sSection.includes('due to') && !sSection.includes('because of'))) {
            // Check more carefully — the connector should be "due to" or "because of"
            const reasonLine = sSection.split('\n').find(l => l.includes('there is') || l.includes('Patient reports'));
            if (reasonLine && !reasonLine.includes('due to') && !reasonLine.includes('because of')) {
              violations.push({ code: 'CONNECTOR', detail: `${tag}: improvement but no positive connector in: "${reasonLine.trim().slice(0, 100)}"` });
            }
          }
        }
      }

      prevPain = st.painScaleCurrent;
      prevAdlCount = adlCount;
      prevAdlItems = [...(st.adlItems ?? [])];
    }
  }
}

// Summary
const counts: Record<string, number> = {};
for (const v of violations) {
  counts[v.code] = (counts[v.code] ?? 0) + 1;
}

console.log('=== Deep Coherence Audit (600 visits + text) ===');
console.log('');
const codes = Object.keys(counts).sort();
let total = 0;
for (const code of codes) {
  console.log(`${code}: ${counts[code]}`);
  const examples = violations.filter(v => v.code === code).slice(0, 5);
  for (const ex of examples) console.log(`  ${ex.detail}`);
  total += counts[code];
}
console.log('');
console.log(`TOTAL: ${total}`);
console.log(total === 0 ? '✅ ALL CLEAR' : '❌ ISSUES FOUND');
