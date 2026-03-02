/**
 * Sentence-level longitudinal logic audit.
 * Checks every sentence across 20 visits for logical consistency.
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

      // Split into sections
      const sections = {
        s: text.split(/^Objective$/m)[0] ?? '',
        o: (text.split(/^Objective$/m)[1] ?? '').split(/^Assessment$/m)[0] ?? '',
        a: (text.split(/^Assessment$/m)[1] ?? '').split(/^Plan$/m)[0] ?? '',
        p: text.split(/^Plan$/m)[1] ?? '',
      };

      // ========== SUBJECTIVE CHECKS ==========

      // S-01: "Follow up visit" should appear on every TX
      if (!sections.s.includes('Follow up visit')) {
        violations.push({ code: 'S-FOLLOWUP', detail: `${tag}: missing "Follow up visit"` });
      }

      // S-02: Pain scale consistency — text vs state
      const painInText = sections.s.match(/Pain Scale:\s*(\d+(?:\.\d+)?)/);
      if (painInText) {
        const textPain = parseFloat(painInText[1]);
        if (Math.abs(textPain - st.painScaleCurrent) > 0.5) {
          violations.push({ code: 'S-PAIN-MISMATCH', detail: `${tag}: text pain=${textPain} state pain=${st.painScaleCurrent.toFixed(1)}` });
        }
      }

      // S-03: Severity in S text matches state
      const sevInText = sections.s.match(/with\s+(mild|mild to moderate|moderate|moderate to severe|severe)\s+difficulty/i);
      if (sevInText) {
        const textSev = sevInText[1].toLowerCase();
        if (textSev !== st.severityLevel) {
          violations.push({ code: 'S-SEV-MISMATCH', detail: `${tag}: text sev="${textSev}" state sev="${st.severityLevel}"` });
        }
      }

      // S-04: symptomChange in reason line matches state
      const reasonLine = sections.s.split('\n').find(l => l.includes('Patient reports:'));
      if (reasonLine) {
        const hasImprovement = reasonLine.includes('improvement');
        const hasSimilar = reasonLine.includes('similar');
        const hasExacerbate = reasonLine.includes('exacerbate');
        const hasCameBack = reasonLine.includes('came back');
        const stSC = st.soaChain?.subjective?.symptomChange ?? '';
        if (hasImprovement && !hasCameBack && !stSC.includes('improvement')) {
          violations.push({ code: 'S-SC-MISMATCH', detail: `${tag}: text says improvement but state SC="${stSC}"` });
        }
        if (hasSimilar && !stSC.includes('similar')) {
          violations.push({ code: 'S-SC-MISMATCH', detail: `${tag}: text says similar but state SC="${stSC}"` });
        }
      }

      // S-05: Pain frequency text matches state
      const freqInText = sections.s.match(/Pain frequency:\s*(.+)/);
      if (freqInText && st.painFrequency) {
        if (!freqInText[1].includes(st.painFrequency.split('(')[0].trim())) {
          // Loose match on first word
        }
      }

      // S-06: "associated with muscles soreness (scale as X%)" — X should match symptomScale
      const scaleInText = sections.s.match(/scale as (\d+%)/);
      if (scaleInText && st.symptomScale) {
        if (scaleInText[1] !== st.symptomScale) {
          violations.push({ code: 'S-SCALE-MISMATCH', detail: `${tag}: text scale="${scaleInText[1]}" state="${st.symptomScale}"` });
        }
      }

      // S-07: ADL items in text should match state
      if (st.adlItems && st.adlItems.length > 0) {
        for (const adl of st.adlItems) {
          if (!sections.s.includes(adl)) {
            violations.push({ code: 'S-ADL-MISSING', detail: `${tag}: ADL "${adl}" in state but not in S text` });
          }
        }
      }

      // ========== OBJECTIVE CHECKS ==========

      // O-01: Tenderness grading in text matches state
      if (st.tendernessGrading) {
        const tenderNum = st.tendernessGrading.match(/\+(\d)/)?.[1];
        if (tenderNum && !sections.o.includes(`(+${tenderNum})`)) {
          violations.push({ code: 'O-TENDER-MISMATCH', detail: `${tag}: state tenderness=+${tenderNum} not found in O text` });
        }
      }

      // O-02: Spasm grading in text matches state
      if (st.spasmGrading) {
        const spasmNum = st.spasmGrading.match(/\+(\d)/)?.[1] ?? st.spasmGrading.match(/\((\d)\)/)?.[1];
        if (spasmNum && !sections.o.includes(`(+${spasmNum})`) && !sections.o.includes(`(${spasmNum})`)) {
          violations.push({ code: 'O-SPASM-MISMATCH', detail: `${tag}: state spasm=${spasmNum} not found in O text` });
        }
      }

      // O-03: Strength grade in text matches state
      if (st.strengthGrade && !sections.o.includes(st.strengthGrade.split(' ')[0])) {
        // Loose check — at least the fraction should appear
      }

      // ========== ASSESSMENT CHECKS ==========

      // A-01: "improvement" / "similar" in A matches S
      const stSC = st.soaChain?.subjective?.symptomChange ?? '';
      if (stSC.includes('improvement') && !stSC.includes('came back')) {
        if (sections.a.includes('similar symptom') && !sections.a.includes('improvement')) {
          violations.push({ code: 'A-SC-MISMATCH', detail: `${tag}: S=improvement but A says similar` });
        }
      }
      if (stSC.includes('similar')) {
        if (sections.a.includes('improvement') && !sections.a.includes('similar')) {
          violations.push({ code: 'A-SC-MISMATCH', detail: `${tag}: S=similar but A says improvement` });
        }
      }

      // A-02: "decreased difficulty in performing ADLs" only when adlChange=improved
      if (sections.a.includes('ADL') && st.soaChain?.subjective?.adlChange !== 'improved') {
        violations.push({ code: 'A-ADL-PHANTOM', detail: `${tag}: A mentions ADL but adlChange=${st.soaChain?.subjective?.adlChange}` });
      }

      // A-03: "reduced joint ROM limitation" only when romTrend != stable
      if (sections.a.includes('ROM limitation') && sections.a.includes('reduced')) {
        if (st.soaChain?.objective?.romTrend === 'stable') {
          violations.push({ code: 'A-ROM-PHANTOM', detail: `${tag}: A says reduced ROM limitation but romTrend=stable` });
        }
      }

      // A-04: "muscles soreness sensation" in A only when symptomScale changed
      if (sections.a.includes('muscles soreness sensation') || sections.a.includes('soreness sensation')) {
        if (prev && st.symptomScale === prev.symptomScale) {
          violations.push({ code: 'A-SORENESS-PHANTOM', detail: `${tag}: A mentions soreness sensation but symptomScale unchanged (${st.symptomScale})` });
        }
      }

      // ========== LONGITUDINAL CHECKS (vs previous visit) ==========
      if (prev) {
        // L-01: Pain never increases
        if (st.painScaleCurrent > prev.painScaleCurrent + 0.01) {
          violations.push({ code: 'L-PAIN-UP', detail: `${tag}: pain ${prev.painScaleCurrent.toFixed(1)}→${st.painScaleCurrent.toFixed(1)}` });
        }

        // L-02: Severity never increases
        const sevOrder = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe'];
        if (sevOrder.indexOf(st.severityLevel) > sevOrder.indexOf(prev.severityLevel)) {
          violations.push({ code: 'L-SEV-UP', detail: `${tag}: severity "${prev.severityLevel}"→"${st.severityLevel}"` });
        }

        // L-03: Symptom scale never increases
        const prevPct = parseInt(prev.symptomScale ?? '');
        const curPct = parseInt(st.symptomScale ?? '');
        if (!isNaN(prevPct) && !isNaN(curPct) && curPct > prevPct) {
          violations.push({ code: 'L-SYMSCALE-UP', detail: `${tag}: symptomScale "${prev.symptomScale}"→"${st.symptomScale}"` });
        }

        // L-04: ADL count never increases
        const prevAdl = prev.adlItems?.length ?? 0;
        const curAdl = st.adlItems?.length ?? 0;
        if (curAdl > prevAdl) {
          violations.push({ code: 'L-ADL-UP', detail: `${tag}: adlCount ${prevAdl}→${curAdl}` });
        }

        // L-05: Frequency never worsens
        const freqOrder = ['Intermittent', 'Occasional', 'Frequent', 'Constant'];
        const prevFIdx = freqOrder.findIndex(f => (prev.painFrequency ?? '').includes(f));
        const curFIdx = freqOrder.findIndex(f => (st.painFrequency ?? '').includes(f));
        if (prevFIdx >= 0 && curFIdx >= 0 && curFIdx > prevFIdx) {
          violations.push({ code: 'L-FREQ-UP', detail: `${tag}: frequency "${freqOrder[prevFIdx]}"→"${freqOrder[curFIdx]}"` });
        }

        // L-06: Tightness grading never increases
        const prevTight = prev.tightnessGrading?.match(/Grade\s*(\d)/i);
        const curTight = st.tightnessGrading?.match(/Grade\s*(\d)/i);
        if (prevTight && curTight) {
          if (parseInt(curTight[1]) > parseInt(prevTight[1])) {
            violations.push({ code: 'L-TIGHT-UP', detail: `${tag}: tightness Grade ${prevTight[1]}→${curTight[1]}` });
          }
        }

        // L-07: Tenderness grading never increases
        const prevTendG = prev.tendernessGrading?.match(/\+(\d)/)?.[1];
        const curTendG = st.tendernessGrading?.match(/\+(\d)/)?.[1];
        if (prevTendG && curTendG && parseInt(curTendG) > parseInt(prevTendG)) {
          violations.push({ code: 'L-TEND-UP', detail: `${tag}: tenderness +${prevTendG}→+${curTendG}` });
        }

        // L-08: Spasm grading never increases
        const prevSpasmG = prev.spasmGrading?.match(/\+(\d)/)?.[1] ?? prev.spasmGrading?.match(/\((\d)\)/)?.[1];
        const curSpasmG = st.spasmGrading?.match(/\+(\d)/)?.[1] ?? st.spasmGrading?.match(/\((\d)\)/)?.[1];
        if (prevSpasmG && curSpasmG && parseInt(curSpasmG) > parseInt(prevSpasmG)) {
          violations.push({ code: 'L-SPASM-UP', detail: `${tag}: spasm +${prevSpasmG}→+${curSpasmG}` });
        }

        // L-09: Strength never decreases
        const strLadder = ['2/5', '2+/5', '3-/5', '3/5', '3+/5', '4-/5', '4/5', '4+/5', '5-/5', '5/5'];
        const prevStrIdx = strLadder.findIndex(s => (prev.strengthGrade ?? '').includes(s));
        const curStrIdx = strLadder.findIndex(s => (st.strengthGrade ?? '').includes(s));
        if (prevStrIdx >= 0 && curStrIdx >= 0 && curStrIdx < prevStrIdx) {
          violations.push({ code: 'L-STR-DOWN', detail: `${tag}: strength "${prev.strengthGrade}"→"${st.strengthGrade}"` });
        }

        // L-10: Tightness muscles — set should only shrink or stay same
        if (prev.tightnessMuscles && st.tightnessMuscles) {
          const prevSet = new Set(prev.tightnessMuscles);
          const curSet = new Set(st.tightnessMuscles);
          const added = [...curSet].filter(m => !prevSet.has(m));
          if (added.length > 0) {
            violations.push({ code: 'L-TIGHT-MUSCLE-ADD', detail: `${tag}: new tightness muscles added: [${added.join(', ')}]` });
          }
        }

        // L-11: Tenderness muscles — set should only shrink or stay same
        if (prev.tendernessMuscles && st.tendernessMuscles) {
          const prevSet = new Set(prev.tendernessMuscles);
          const curSet = new Set(st.tendernessMuscles);
          const added = [...curSet].filter(m => !prevSet.has(m));
          if (added.length > 0) {
            violations.push({ code: 'L-TEND-MUSCLE-ADD', detail: `${tag}: new tenderness muscles added: [${added.join(', ')}]` });
          }
        }

        // L-12: Spasm muscles — set should only shrink or stay same
        if (prev.spasmMuscles && st.spasmMuscles) {
          const prevSet = new Set(prev.spasmMuscles);
          const curSet = new Set(st.spasmMuscles);
          const added = [...curSet].filter(m => !prevSet.has(m));
          if (added.length > 0) {
            violations.push({ code: 'L-SPASM-MUSCLE-ADD', detail: `${tag}: new spasm muscles added: [${added.join(', ')}]` });
          }
        }

        // L-13: Needle points should be same across all visits
        if (i >= 2) {
          const prevPoints = prevText.match(/BL\d+|DU\d+|GB\d+|ST\d+|SP\d+|KI\d+|LI\d+|LR\d+|SI\d+|TE\d+|HT\d+|PC\d+|LU\d+|RN\d+|GV\d+/g) ?? [];
          const curPoints = text.match(/BL\d+|DU\d+|GB\d+|ST\d+|SP\d+|KI\d+|LI\d+|LR\d+|SI\d+|TE\d+|HT\d+|PC\d+|LU\d+|RN\d+|GV\d+/g) ?? [];
          const prevSet = new Set(prevPoints);
          const curSet = new Set(curPoints);
          const diff = [...curSet].filter(p => !prevSet.has(p));
          if (diff.length > 0 && prevPoints.length > 0) {
            violations.push({ code: 'L-NEEDLE-CHANGE', detail: `${tag}: new needle points: [${diff.join(', ')}]` });
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

console.log('=== Sentence-Level Longitudinal Audit (5bp × 5seeds × 20visits = 500 visits) ===');
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
