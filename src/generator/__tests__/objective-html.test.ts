import { describe, test, expect } from 'vitest';
import { generateObjective } from '../soap-generator';
import type { GenerationContext, TXVisitState } from '../../types';

describe('generateObjective HTML format', () => {
  const txContext: GenerationContext = {
    noteType: 'TX',
    primaryBodyPart: 'SHOULDER',
    laterality: 'right',
    insuranceType: 'HF',
    painCurrent: 7,
    severityLevel: 'moderate',
  };

  const txVisitState: TXVisitState = {
    tightMuscles: ['Anterior Deltoid', 'Biceps Brachii'],
    tenderMuscles: ['Supraspinatus'],
    spasmMuscles: [],
    romDeficit: 0.3,
    strengthGrade: '4/5',
    soaChain: {
      subjective: { adlChange: 'stable' },
      objective: { romTrend: 'stable' },
      assessment: { whatChanged: [] },
    },
  } as TXVisitState;

  const ieContext: GenerationContext = {
    noteType: 'IE',
    primaryBodyPart: 'SHOULDER',
    laterality: 'right',
    insuranceType: 'HF',
    painCurrent: 7,
    severityLevel: 'moderate',
  };

  test('TX Objective HTML contains ppnSelectCombo for muscles', () => {
    const html = generateObjective(txContext, txVisitState, undefined, 'html');
    expect(html).toContain('class="ppnSelectCombo');
    expect(html).toMatch(/Anterior Deltoid/);
  });

  test('TX Objective HTML wraps ROM degrees and strength grades', () => {
    const html = generateObjective(txContext, txVisitState, undefined, 'html');
    expect(html).toMatch(/class="ppnSelectComboSingle[^"]*">\d+°/);
    expect(html).toMatch(/class="ppnSelectComboSingle[^"]*">4\/5/);
  });

  test('IE Objective HTML has no ppnSelectCombo', () => {
    const html = generateObjective(ieContext, undefined, undefined, 'html');
    expect(html).not.toContain('ppnSelectCombo');
    expect(html).toContain('<br>');
  });

  test('Text mode unchanged for TX and IE', () => {
    const txText = generateObjective(txContext, txVisitState, undefined, 'text');
    const ieText = generateObjective(ieContext, undefined, undefined, 'text');
    expect(txText).not.toContain('<br>');
    expect(txText).not.toContain('<span');
    expect(ieText).not.toContain('<br>');
    expect(ieText).not.toContain('<span');
  });
});
