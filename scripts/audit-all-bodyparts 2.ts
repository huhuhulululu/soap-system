/**
 * 全量审计脚本 — 生成 6 个部位 IE + TX，检查所有 38 个审计问题
 */
import { exportSOAPAsText, exportTXSeriesAsText } from '../src/generator/soap-generator';
import { patchSOAPText } from '../src/generator/objective-patch';
import { TEMPLATE_AGGRAVATING, TEMPLATE_TX_REASON, TEMPLATE_TX_WHAT_CHANGED, TEMPLATE_NEEDLE_POINTS, type BodyPartKey } from '../src/shared/template-options';

interface AuditResult {
  id: string;
  scope: string;
  status: 'PASS' | 'FAIL';
  detail?: string;
}

const results: AuditResult[] = [];

function check(id: string, scope: string, pass: boolean, detail?: string) {
  results.push({ id, scope, status: pass ? 'PASS' : 'FAIL', detail: pass ? undefined : detail });
}

const BODY_PARTS = [
  { bp: 'SHOULDER' as const, lat: 'bilateral' as const },
  { bp: 'KNEE' as const, lat: 'bilateral' as const },
  { bp: 'LBP' as const, lat: 'bilateral' as const },
  { bp: 'NECK' as const, lat: 'bilateral' as const },
  { bp: 'ELBOW' as const, lat: 'right' as const },
  { bp: 'HIP' as const, lat: 'left' as const },
] as const;

function makeCtx(bp: string, lat: string, noteType: 'IE' | 'TX' = 'IE') {
  return {
    noteType, insuranceType: 'NONE' as const, primaryBodyPart: bp,
    laterality: lat, localPattern: 'Qi Stagnation, Blood Stasis',
    systemicPattern: 'Blood Deficiency', chronicityLevel: 'Chronic' as const,
    severityLevel: 'moderate to severe' as const, painCurrent: 8, painWorst: 9, painBest: 5,
    age: 55, gender: 'Female' as const,
  };
}

// ========== IE CHECKS ==========
for (const { bp, lat } of BODY_PARTS) {
  const ctx = makeCtx(bp, lat);
  const text = patchSOAPText(exportSOAPAsText(ctx), ctx);

  // C-05/C-06/C-07: Aggravating factors from template
  if (['NECK', 'ELBOW', 'HIP'].includes(bp)) {
    const match = text.match(/exacerbated by (.+?)[\.\n]/);
    if (match) {
      const factors = match[1].split(', ').map(f => f.trim());
      const valid = TEMPLATE_AGGRAVATING[bp as BodyPartKey] || [];
      const invalid = factors.filter(f => !valid.includes(f));
      check(`C-05/06/07`, `${bp} IE aggravating`, invalid.length === 0, `Invalid: ${invalid.join(', ')}`);
    }
  }

  // C-08: ELBOW no Supination/Pronation
  if (bp === 'ELBOW') {
    check('C-08', 'ELBOW IE ROM', !text.includes('Supination') && !text.includes('Pronation'), 'Found Supination/Pronation');
  }

  // C-10: HIP no Adduction
  if (bp === 'HIP') {
    check('C-10', 'HIP IE ROM', !text.includes('Adduction'), 'Found Adduction');
  }

  // C-12: HIP tenderness uses KNEE-style
  if (bp === 'HIP') {
    const hasKneeStyle = text.includes('There is severe tenderness') || text.includes('There is mild tenderness');
    const hasShoulderStyle = text.includes('Patient complains of considerable');
    check('C-12', 'HIP IE tenderness', hasKneeStyle && !hasShoulderStyle, 'Wrong tenderness style');
  }

  // H-04: NECK Lateral Flexion
  if (bp === 'NECK') {
    check('H-04', 'NECK IE ROM', text.includes('Lateral Flexion'), 'Missing Lateral Flexion');
  }

  // H-08: HIP muscle singular
  if (bp === 'HIP') {
    check('H-08', 'HIP IE tenderness text', text.includes('Tenderness muscle noted along'), 'Wrong tenderness text');
  }

  // L-01: No trailing period on tenderness scale
  const tenderMatch = text.match(/Grading Scale: .+\.\n|Tenderness Scale: .+\.\n/);
  if (tenderMatch) {
    check('L-01', `${bp} IE tenderness period`, false, `Trailing period: ${tenderMatch[0].trim()}`);
  } else {
    check('L-01', `${bp} IE tenderness period`, true);
  }

  // L-03: No slippery
  check('L-03', `${bp} IE TCM pulse`, !text.includes('slippery'), 'Found slippery');

  // Needle checks for ELBOW/HIP
  if (['ELBOW', 'HIP'].includes(bp)) {
    const needleEntry = TEMPLATE_NEEDLE_POINTS[bp as BodyPartKey];
    const allValid = [...needleEntry.frontPool, ...needleEntry.backPool];
    const pointPattern = /[A-Z]{1,3}\s?\d+|A SHI POINTS?|JIAN QIAN|XI YAN|HE DING|YAO TONG XUE|YAO JIA JI|BAI LAO|JIN JIA JI|DU\d+|REN\d+|UB\d+/gi;
    const needleSection = text.split('Needle Size')[1] || '';
    const outputPoints = [...new Set((needleSection.match(pointPattern) || []).map(p => p.toUpperCase().trim()))];
    const invalid = outputPoints.filter(p => !allValid.some(v => v.toUpperCase() === p));
    check(`C-13~16`, `${bp} needle points`, invalid.length === 0, `Invalid points: ${invalid.join(', ')}`);
  }
}

// ========== TX CHECKS ==========
for (const { bp, lat } of BODY_PARTS.slice(0, 3)) { // SHOULDER, KNEE, LBP
  const ieCtx = makeCtx(bp, lat);
  const txCtx = makeCtx(bp, lat, 'TX');
  const txItems = exportTXSeriesAsText(ieCtx, { txCount: 3, seed: 42 });

  for (const item of txItems) {
    const text = patchSOAPText(item.text, txCtx);
    const scope = `${bp} TX${item.visitIndex}`;

    // C-01: TX verb
    const verbMatch = text.match(/Treatment will (continue to emphasize|emphasize|consist of promoting|promote|focus|pay attention)/);
    check('C-01', scope, verbMatch !== null || !text.includes('Treatment will'), 'Invalid TX verb');

    // C-02: No fabricated reason
    const fabricated = ['stress level has decreased', 'shoulder stiffness has decreased', 'muscle tension has reduced noticeably', 'overall well-being has improved', 'walking distance increased without pain'];
    const hasFab = fabricated.some(f => text.includes(f));
    check('C-02', scope, !hasFab, `Fabricated reason found`);

    // C-03: Fixed adverse
    const hasOldAdverse = text.includes('No adverse reaction reported') || text.includes('Patient reported no adverse') || text.includes('No negative side effects');
    check('C-03', scope, !hasOldAdverse, 'Fabricated adverse variant');
    check('C-03b', scope, text.includes('No adverse side effect post treatment'), 'Missing template adverse');

    // C-04: No severity level in whatChanged
    check('C-04', scope, !text.includes('severity level'), 'Found severity level');

    // H-02: KNEE lowercase
    if (bp === 'KNEE') {
      check('H-02', scope, !text.includes('Knee area'), 'Found uppercase Knee');
    }
  }
}

// ========== REPORT ==========
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;

console.log(`\n${'='.repeat(60)}`);
console.log(`AUDIT REPORT: ${passed} PASS, ${failed} FAIL out of ${results.length} checks`);
console.log('='.repeat(60));

if (failed > 0) {
  console.log('\nFAILURES:');
  for (const r of results.filter(r => r.status === 'FAIL')) {
    console.log(`  ❌ ${r.id} [${r.scope}]: ${r.detail}`);
  }
}

console.log('\nPASSED:');
for (const r of results.filter(r => r.status === 'PASS')) {
  console.log(`  ✅ ${r.id} [${r.scope}]`);
}

process.exit(failed > 0 ? 1 : 0);
