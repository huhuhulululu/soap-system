/**
 * Corrected sentence-level audit — fixes false positives from v1.
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
const seeds = [42, 999, 2024, 7777, 12345];

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
      txCount: 20, seed,
      initialState: { pain: 8, tightness: 3, tenderness: 3, spasm: 3, frequency: 3, associatedSymptom: 'soreness', painTypes: ['Dull', 'Aching'] },
    };

    const { states } = generateTXSequenceStates(ctx, opts);
    const items = exportTXSeriesAsText(ctx, opts);
    const texts = items.map(item => patchSOAPText(item.text, ctx));

    for (let i = 0; i < states.length; i++) {
      const st = states[i];
      const text = texts[i] ?? '';
      const tag = `${bp} TX${st.visitIndex} seed=${seed}`;
      const prev = i > 0 ? states[i - 1] : null;
      const prevText = i > 0 ? texts[i - 1] : '';

      const sections = {
        s: text.split(/^Objective$/m)[0] ?? '',
        o: (text.split(/^Objective$/m)[1] ?? '').split(/^Assessment$/m)[0] ?? '',
        a: (text.split(/^Assessment$/m)[1] ?? '').split(/^Plan$/m)[0] ?? '',
        p: text.split(/^Plan$/m)[1] ?? '',
      };

      // ========== SUBJECTIVE ==========

      // S-PAIN: text pain should match painScaleLabel (not raw float)
      const painInText = sections.s.match(/Pain Scale:\s*(\S+)\s*\/10/);
      if (painInText && st.painScaleLabel) {
        const textLabel = painInText[1].trim();
        const stateLabel = String(st.painScaleLabel).trim();
        if (textLabel !== stateLabel) {
          violations.push({ code: 'S-PAIN-LABEL', detail: `${tag}: text pain="${textLabel}" label="${stateLabel}"` });
        }
      }

      // S-SEV: severity in text matches state
      const sevInText = sections.s.match(/with\s+(mild|mild to moderate|moderate|moderate to severe|severe)\s+difficulty/i);
      if (sevInText) {
        const textSev = sevInText[1].toLowerCase();
        if (textSev !== st.severityLevel) {
          violations.push({ code: 'S-SEV-MISMATCH', detail: `${tag}: text="${textSev}" state="${st.severityLevel}"` });
        }
      }

      // S-SC: symptomChange in text matches st.symptomChange
      const reasonLine = sections.s.split('\n').find(l => l.includes('Patient reports:'));
      if (reasonLine && st.symptomChange) {
        const textHasImprove = reasonLine.includes('improvement');
        const textHasSimilar = reasonLine.includes('similar');
        const textHasExacerbate = reasonLine.includes('exacerbate');
        const textHasCameBack = reasonLine.includes('came back');
        const stateHasImprove = st.symptomChange.includes('improvement');
        const stateHasSimilar = st.symptomChange.includes('similar');
        const stateHasExacerbate = st.symptomChange.includes('exacerbate');
        const stateHasCameBack = st.symptomChange.includes('came back');
        if (textHasImprove !== stateHasImprove || textHasSimilar !== stateHasSimilar) {
          violations.push({ code: 'S-SC-MISMATCH', detail: `${tag}: text="${reasonLine.slice(0,80)}" state="${st.symptomChange}"` });
        }
      }

      // S-SCALE: "scale as X%" matches symptomScale
      const scaleInText = sections.s.match(/scale as (\d+%(?:-\d+%)?)/);
      if (scaleInText && st.symptomScale) {
        if (scaleInText[1] !== st.symptomScale) {
          violations.push({ code: 'S-SCALE', detail: `${tag}: text="${scaleInText[1]}" state="${st.symptomScale}"` });
        }
      }

      // S-ADL: ADL items in text (case-insensitive)
      if (st.adlItems && st.adlItems.length > 0) {
        const sLower = sections.s.toLowerCase();
        for (const adl of st.adlItems) {
          if (!sLower.includes(adl.toLowerCase())) {
            violations.push({ code: 'S-ADL-MISSING', detail: `${tag}: ADL "${adl}" not in S text` });
          }
        }
      }

      // ========== ASSESSMENT ==========

      // A-ADL: mentions ADL but adlChange != improved
      if (sections.a.includes('ADL') && st.soaChain?.subjective?.adlChange !== 'improved') {
        violations.push({ code: 'A-ADL-PHANTOM', detail: `${tag}: A mentions ADL but adlChange=${st.soaChain?.subjective?.adlChange}` });
      }

      // A-ROM: "reduced ROM limitation" but romTrend=stable
      if (sections.a.includes('ROM limitation') && sections.a.includes('reduced')) {
        if (st.soaChain?.objective?.romTrend === 'stable') {
          violations.push({ code: 'A-ROM-PHANTOM', detail: `${tag}: A says reduced ROM but romTrend=stable` });
        }
      }

      // A-SORENESS: mentions soreness but symptomScale unchanged
      if (prev && (sections.a.includes('muscles soreness sensation') || sections.a.includes('soreness sensation'))) {
        if (st.symptomScale === prev.symptomScale) {
          violations.push({ code: 'A-SORENESS-PHANTOM', detail: `${tag}: A mentions soreness but scale=${st.symptomScale} unchanged` });
        }
      }

      // A-SC: Assessment present matches symptomChange
      const stSC = st.symptomChange ?? '';
      if (stSC.includes('improvement') && !stSC.includes('came back')) {
        if (sections.a.includes('similar symptom') && !sections.a.includes('improvement')) {
          violations.push({ code: 'A-SC-MISMATCH', detail: `${tag}: S=improvement but A=similar` });
        }
      }
      if (stSC.includes('similar')) {
        if (sections.a.includes('improvement') && !sections.a.includes('similar')) {
          violations.push({ code: 'A-SC-MISMATCH', detail: `${tag}: S=similar but A=improvement` });
        }
      }

      // A-PHYSICAL: "reduced physical finding" but all O stable
      const allOStable = st.soaChain?.objective &&
        st.soaChain.objective.tightnessTrend === 'stable' &&
        st.soaChain.objective.tendernessTrend === 'stable' &&
        st.soaChain.objective.spasmTrend === 'stable' &&
        st.soaChain.objective.romTrend === 'stable' &&
        st.soaChain.objective.strengthTrend === 'stable';
      if (allOStable && sections.a.includes('reduced') && sections.a.includes('physical finding')) {
        violations.push({ code: 'A-PHYS-PHANTOM', detail: `${tag}: A says reduced physical finding but all O stable` });
      }

      // ========== LONGITUDINAL ==========
      if (prev) {
        // L-PAIN: pain never increases
        if (st.painScaleCurrent > prev.painScaleCurrent + 0.01) {
          violations.push({ code: 'L-PAIN-UP', detail: `${tag}: ${prev.painScaleCurrent.toFixed(1)}→${st.painScaleCurrent.toFixed(1)}` });
        }
        // L-SEV: severity never increases
        const sevOrder = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe'];
        if (sevOrder.indexOf(st.severityLevel) > sevOrder.indexOf(prev.severityLevel)) {
          violations.push({ code: 'L-SEV-UP', detail: `${tag}: "${prev.severityLevel}"→"${st.severityLevel}"` });
        }
        // L-SYMSCALE: symptom scale never increases
        const prevPct = parseInt(prev.symptomScale ?? '');
        const curPct = parseInt(st.symptomScale ?? '');
        if (!isNaN(prevPct) && !isNaN(curPct) && curPct > prevPct) {
          violations.push({ code: 'L-SYMSCALE-UP', detail: `${tag}: "${prev.symptomScale}"→"${st.symptomScale}"` });
        }
        // L-ADL: ADL count never increases
        if ((st.adlItems?.length ?? 0) > (prev.adlItems?.length ?? 0)) {
          violations.push({ code: 'L-ADL-UP', detail: `${tag}: ${prev.adlItems?.length}→${st.adlItems?.length}` });
        }
        // L-FREQ: frequency never worsens
        const freqOrder = ['Intermittent', 'Occasional', 'Frequent', 'Constant'];
        const pF = freqOrder.findIndex(f => (prev.painFrequency ?? '').includes(f));
        const cF = freqOrder.findIndex(f => (st.painFrequency ?? '').includes(f));
        if (pF >= 0 && cF >= 0 && cF > pF) {
          violations.push({ code: 'L-FREQ-UP', detail: `${tag}: "${freqOrder[pF]}"→"${freqOrder[cF]}"` });
        }
        // L-TEND: tenderness never increases
        const pTend = prev.tendernessGrading?.match(/\+(\d)/)?.[1];
        const cTend = st.tendernessGrading?.match(/\+(\d)/)?.[1];
        if (pTend && cTend && parseInt(cTend) > parseInt(pTend)) {
          violations.push({ code: 'L-TEND-UP', detail: `${tag}: +${pTend}→+${cTend}` });
        }
        // L-SPASM: spasm never increases
        const pSpasm = prev.spasmGrading?.match(/[\+(](\d)/)?.[1];
        const cSpasm = st.spasmGrading?.match(/[\+(](\d)/)?.[1];
        if (pSpasm && cSpasm && parseInt(cSpasm) > parseInt(pSpasm)) {
          violations.push({ code: 'L-SPASM-UP', detail: `${tag}: +${pSpasm}→+${cSpasm}` });
        }
        // L-TIGHT: tightness never increases
        const pTight = prev.tightnessGrading?.match(/Grade\s*(\d)/i)?.[1] ?? prev.tightnessGrading?.match(/(Mild|Moderate|Severe)/i)?.[1];
        const cTight = st.tightnessGrading?.match(/Grade\s*(\d)/i)?.[1] ?? st.tightnessGrading?.match(/(Mild|Moderate|Severe)/i)?.[1];
        if (pTight && cTight) {
          const tightOrder = ['Mild', 'Moderate', 'Severe'];
          const pIdx = tightOrder.findIndex(t => pTight.toLowerCase().includes(t.toLowerCase()));
          const cIdx = tightOrder.findIndex(t => cTight.toLowerCase().includes(t.toLowerCase()));
          if (pIdx >= 0 && cIdx >= 0 && cIdx > pIdx) {
            violations.push({ code: 'L-TIGHT-UP', detail: `${tag}: "${pTight}"→"${cTight}"` });
          }
        }
      }
    }
  }
}

// Summary
const counts: Record<string, number> = {};
for (const v of violations) {
  counts[v.code] = (counts[v.code] ?? 0) + 1;
}

console.log('=== Sentence-Level Audit v2 (5bp × 5seeds × 20visits) ===');
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
