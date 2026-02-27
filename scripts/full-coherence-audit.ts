/**
 * Comprehensive SOAP coherence audit — cross-dimension consistency check
 * Covers S↔A↔O chains, longitudinal monotonicity, and semantic coherence.
 */
import { generateTXSequenceStates } from '../src/generator/tx-sequence-engine';
import { exportTXSeriesAsText } from '../src/generator/soap-generator';
import { patchSOAPText } from '../src/generator/objective-patch';
import { setWhitelist } from '../src/parser/template-rule-whitelist';
import whitelistData from '../frontend/src/data/whitelist.json';
import type { GenerationContext } from '../src/types';

setWhitelist(whitelistData as Record<string, string[]>);

const bodyParts = ['LBP', 'KNEE', 'SHOULDER', 'NECK', 'ELBOW'] as const;
const seeds = [42, 999, 2024, 7777, 12345, 54321, 11111, 22222, 33333, 44444];

interface Violation { code: string; detail: string; }
const violations: Violation[] = [];

function acceptableSeverities(pain: number): string[] {
  if (pain >= 9) return ['severe', 'moderate to severe'];
  if (pain >= 7) return ['moderate to severe', 'moderate'];
  if (pain >= 6) return ['moderate', 'mild to moderate'];
  if (pain >= 4) return ['mild to moderate', 'mild'];
  return ['mild'];
}

function parseGrading(g: string | undefined): number {
  const m = g?.match(/\+(\d)/);
  return m ? parseInt(m[1]) : -1;
}

const ADL_REASONS = [
  'less difficulty performing daily activities', 'can bend and lift with less discomfort',
  'sitting tolerance has improved', 'overhead reaching is easier',
  'can reach behind back more comfortably', 'stair climbing is less painful',
  'can lift objects with less elbow pain', 'physical activity no longer causes distress',
  'can look over shoulder more easily',
];
const PAIN_REASONS = [
  'reduced level of pain', 'can move joint more freely and with less pain',
  'walking distance increased without pain', 'can walk longer distances comfortably',
];
const OBJ_REASONS = [
  'muscle tension has reduced noticeably', 'shoulder stiffness has decreased',
  'forearm tension has decreased', 'knee stability has improved',
  'neck rotation range has improved', 'grip strength has improved',
  'less headache related to neck tension',
];

for (const bp of bodyParts) {
  for (const seed of seeds) {
    const ctx = {
      noteType: 'TX', insuranceType: 'OPTUM', primaryBodyPart: bp,
      laterality: bp === 'LBP' ? 'bilateral' : 'right',
      localPattern: 'Cold-Damp + Wind-Cold', systemicPattern: 'Kidney Yang Deficiency',
      chronicityLevel: 'Chronic', severityLevel: 'moderate to severe',
      painCurrent: 8, associatedSymptom: 'soreness', hasPacemaker: false,
    } as GenerationContext;
    const { states } = generateTXSequenceStates(ctx, {
      txCount: 12, seed,
      initialState: { pain: 8, tightness: 3, tenderness: 3, spasm: 3, frequency: 3, associatedSymptom: 'soreness', painTypes: ['Dull', 'Aching'] },
    });

    let prevPain = 8;
    let prevSev = 'moderate to severe';
    let prevTendGrade = 3;
    let prevSpasmGrade = 3;
    let prevTightGrade = -1;
    let lowestSpasm = 3;
    let lowestTend = 3;
    let lowestTight = 99;
    let prevAdlCount = -1;
    let prevSymptomScale = '';
    let prevStrength = '';
    let prevRom = '';
    let prevFreq = '';

    for (const st of states) {
      const tag = `${bp} TX${st.visitIndex} seed=${seed}`;
      const o = st.soaChain.objective;
      const s = st.soaChain.subjective;
      const a = st.soaChain.assessment;
      const parts = st.reason.split(/ and /).map((r: string) => r.trim());

      // === S1: reason↔dimension ===
      if (s?.adlChange !== 'improved') {
        for (const p of parts) { if (ADL_REASONS.includes(p)) violations.push({ code: 'S1-ADL', detail: `${tag}: adl=stable but reason="${p}"` }); }
      }
      const painDelta = prevPain - st.painScaleCurrent;
      if (painDelta <= 0.2) {
        for (const p of parts) { if (PAIN_REASONS.includes(p)) violations.push({ code: 'S1-PAIN', detail: `${tag}: painΔ=${painDelta.toFixed(1)} but reason="${p}"` }); }
      }
      const allOStable = o.tightnessTrend === 'stable' && o.tendernessTrend === 'stable' && o.spasmTrend === 'stable' && o.romTrend === 'stable' && o.strengthTrend === 'stable';
      if (allOStable) {
        for (const p of parts) { if (OBJ_REASONS.includes(p)) violations.push({ code: 'S1-OBJ', detail: `${tag}: all O stable but reason="${p}"` }); }
      }

      // === S6: severity↔pain ===
      if (!acceptableSeverities(st.painScaleCurrent).includes(st.severityLevel)) {
        violations.push({ code: 'S6', detail: `${tag}: pain=${st.painScaleCurrent.toFixed(1)} sev="${st.severityLevel}"` });
      }

      // === S7: ADL difficulty text↔severity ===
      // (placeholder — check if ADL items count matches severity band)

      // === O2: tenderness grade↓ trend=stable ===
      const tendGrade = parseGrading(st.tendernessGrading);
      if (tendGrade >= 0 && tendGrade < prevTendGrade && o.tendernessTrend === 'stable') {
        violations.push({ code: 'O2', detail: `${tag}: tenderness ${prevTendGrade}→${tendGrade} but trend=stable` });
      }

      // === O3: spasm grade↓ trend=stable ===
      const spasmGrade = parseGrading(st.spasmGrading);
      if (spasmGrade >= 0 && spasmGrade < prevSpasmGrade && o.spasmTrend === 'stable') {
        violations.push({ code: 'O3', detail: `${tag}: spasm ${prevSpasmGrade}→${spasmGrade} but trend=stable` });
      }

      // === V6: spasm longitudinal regression ===
      if (spasmGrade >= 0 && spasmGrade > lowestSpasm) {
        violations.push({ code: 'V6-SPASM', detail: `${tag}: spasm=${spasmGrade} but lowest=${lowestSpasm}` });
      }

      // === V6-TEND: tenderness longitudinal regression ===
      if (tendGrade >= 0 && tendGrade > lowestTend) {
        violations.push({ code: 'V6-TEND', detail: `${tag}: tenderness=${tendGrade} but lowest=${lowestTend}` });
      }

      // === SEVERITY-MONO: severity never increases ===
      const sevOrder = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe'];
      const curSevIdx = sevOrder.indexOf(st.severityLevel);
      const prevSevIdx = sevOrder.indexOf(prevSev);
      if (curSevIdx > prevSevIdx && prevSevIdx >= 0) {
        violations.push({ code: 'SEV-MONO', detail: `${tag}: severity went UP "${prevSev}"→"${st.severityLevel}"` });
      }

      // === PAIN-MONO: pain never increases (within tolerance) ===
      if (st.painScaleCurrent > prevPain + 0.01) {
        violations.push({ code: 'PAIN-MONO', detail: `${tag}: pain went UP ${prevPain.toFixed(1)}→${st.painScaleCurrent.toFixed(1)}` });
      }

      // === ADL-MONO: ADL count never increases ===
      const adlCount = st.adlItems?.length ?? 0;
      if (prevAdlCount >= 0 && adlCount > prevAdlCount) {
        violations.push({ code: 'ADL-MONO', detail: `${tag}: adlCount went UP ${prevAdlCount}→${adlCount}` });
      }

      // === S-A CHAIN: symptomChange↔assessment.present consistency ===
      const sc = s?.symptomChange ?? '';
      const present = a?.present ?? '';
      if (sc.includes('improvement') && !sc.includes('came back') && present.includes('similar')) {
        violations.push({ code: 'SA-CHAIN', detail: `${tag}: S=improvement but A=similar` });
      }
      if (sc.includes('similar') && present.includes('improvement')) {
        violations.push({ code: 'SA-CHAIN', detail: `${tag}: S=similar but A=improvement` });
      }

      // === A-ADL: Assessment mentions ADL but adlChange≠improved ===
      const whatChanged = a?.whatChanged ?? '';
      if (whatChanged.includes('ADL') && s?.adlChange !== 'improved') {
        violations.push({ code: 'A-ADL', detail: `${tag}: A mentions ADL but S.adlChange=${s?.adlChange}` });
      }

      // === ADL-IMPROVED-ACTUAL: adlChange=improved but count didn't change ===
      if (s?.adlChange === 'improved' && prevAdlCount >= 0 && adlCount >= prevAdlCount) {
        violations.push({ code: 'ADL-PHANTOM', detail: `${tag}: adlChange=improved but adlCount ${prevAdlCount}→${adlCount}` });
      }

      // === SYMPTOM-SCALE-MONO: symptom scale never increases ===
      if (prevSymptomScale && st.symptomScale) {
        const prevPct = parseInt(prevSymptomScale);
        const curPct = parseInt(st.symptomScale);
        if (!isNaN(prevPct) && !isNaN(curPct) && curPct > prevPct) {
          violations.push({ code: 'SYMSCALE-MONO', detail: `${tag}: symptomScale went UP "${prevSymptomScale}"→"${st.symptomScale}"` });
        }
      }

      // === STRENGTH-MONO: strength never decreases ===
      if (prevStrength && st.strengthGrade && st.strengthGrade !== prevStrength) {
        // Simple check: strength grade text should not go backwards
        const strengthOrder = ['1/5', '2/5', '3/5', '3+/5', '4-/5', '4/5', '4+/5', '5-/5', '5/5'];
        const prevIdx = strengthOrder.findIndex(s => prevStrength.includes(s));
        const curIdx = strengthOrder.findIndex(s => st.strengthGrade.includes(s));
        if (prevIdx >= 0 && curIdx >= 0 && curIdx < prevIdx) {
          violations.push({ code: 'STR-MONO', detail: `${tag}: strength went DOWN "${prevStrength}"→"${st.strengthGrade}"` });
        }
      }

      // === O-TREND↔A: if all O stable, A.physicalChange should not say "reduced" ===
      if (allOStable && a?.physicalChange?.includes('reduced')) {
        violations.push({ code: 'OA-PHYS', detail: `${tag}: all O stable but A.physicalChange="${a.physicalChange}"` });
      }

      // Update tracking
      prevPain = st.painScaleCurrent;
      prevSev = st.severityLevel;
      if (tendGrade >= 0) { prevTendGrade = tendGrade; if (tendGrade < lowestTend) lowestTend = tendGrade; }
      if (spasmGrade >= 0) { prevSpasmGrade = spasmGrade; if (spasmGrade < lowestSpasm) lowestSpasm = spasmGrade; }
      prevAdlCount = adlCount;
      prevSymptomScale = st.symptomScale ?? prevSymptomScale;
      prevStrength = st.strengthGrade ?? prevStrength;
    }
  }
}

// Summary
const counts: Record<string, number> = {};
for (const v of violations) {
  counts[v.code] = (counts[v.code] ?? 0) + 1;
}

console.log('=== Comprehensive Coherence Audit (600 visits) ===');
console.log('');
const codes = Object.keys(counts).sort();
let total = 0;
for (const code of codes) {
  console.log(`${code}: ${counts[code]}`);
  // Show first 3 examples
  const examples = violations.filter(v => v.code === code).slice(0, 3);
  for (const ex of examples) console.log(`  ${ex.detail}`);
  total += counts[code];
}
console.log('');
console.log(`TOTAL: ${total}`);
console.log(total === 0 ? '✅ ALL CLEAR' : '❌ ISSUES FOUND');
