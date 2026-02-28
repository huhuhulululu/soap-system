import { applyCorrection, applyCorrections, TEMPLATE_CORRECTIONS } from '../template-corrections';

describe('template-corrections', () => {
  test('corrects known typos', () => {
    expect(applyCorrection('RE-EVALUATIOIN')).toBe('RE-EVALUATION');
    expect(applyCorrection('Prolonge walking')).toBe('Prolonged walking');
    expect(applyCorrection('continue to be emphasize')).toBe('continue to emphasize');
  });

  test('corrects anatomy errors', () => {
    expect(applyCorrection('greater tubercle')).toBe('greater trochanter');
    expect(applyCorrection('lesser tubercle')).toBe('lesser trochanter');
  });

  test('passes through unknown values unchanged', () => {
    expect(applyCorrection('some normal text')).toBe('some normal text');
    expect(applyCorrection('Qi Stagnation')).toBe('Qi Stagnation');
  });

  test('applyCorrections works on arrays', () => {
    const input = ['RE-EVALUATIOIN', 'normal text', 'Prolonge walking'];
    const result = applyCorrections(input);
    expect(result).toEqual(['RE-EVALUATION', 'normal text', 'Prolonged walking']);
  });

  test('corrections map has no duplicate keys', () => {
    const keys = Object.keys(TEMPLATE_CORRECTIONS);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('no correction maps to itself', () => {
    for (const [original, entry] of Object.entries(TEMPLATE_CORRECTIONS)) {
      expect(entry.corrected).not.toBe(original);
    }
  });

  test('all corrections have non-empty reason', () => {
    for (const entry of Object.values(TEMPLATE_CORRECTIONS)) {
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });
});
