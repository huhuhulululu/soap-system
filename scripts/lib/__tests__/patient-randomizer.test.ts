import { describe, it, expect } from 'vitest';
import { randomizePatientContext } from '../patient-randomizer';

describe('randomizePatientContext', () => {
  it('returns valid GenerationContext for SHOULDER', () => {
    const ctx = randomizePatientContext('SHOULDER', 42);
    expect(ctx.primaryBodyPart).toBe('SHOULDER');
    expect(ctx.noteType).toBe('IE');
    expect(ctx.age).toBeGreaterThanOrEqual(50);
    expect(ctx.age).toBeLessThanOrEqual(85);
    expect(['Female', 'Male']).toContain(ctx.gender);
    expect(ctx.painCurrent).toBeGreaterThanOrEqual(4);
    expect(ctx.painCurrent).toBeLessThanOrEqual(9);
    expect(['Acute', 'Sub Acute', 'Chronic']).toContain(ctx.chronicityLevel);
  });

  it('is deterministic for same seed', () => {
    const a = randomizePatientContext('KNEE', 123);
    const b = randomizePatientContext('KNEE', 123);
    expect(a).toEqual(b);
  });

  it('produces different results for different seeds', () => {
    const a = randomizePatientContext('LBP', 1);
    const b = randomizePatientContext('LBP', 2);
    expect(a.painCurrent !== b.painCurrent || a.age !== b.age).toBe(true);
  });

  it('age is always 50+', () => {
    for (let seed = 0; seed < 100; seed++) {
      const ctx = randomizePatientContext('NECK', seed);
      expect(ctx.age).toBeGreaterThanOrEqual(50);
    }
  });

  it('laterality matches body part conventions', () => {
    for (let seed = 0; seed < 50; seed++) {
      const lbp = randomizePatientContext('LBP', seed);
      expect(['bilateral', 'unspecified']).toContain(lbp.laterality);
      const elbow = randomizePatientContext('ELBOW', seed);
      expect(['left', 'right']).toContain(elbow.laterality);
    }
  });

  it('painTypes come from valid options', () => {
    const ctx = randomizePatientContext('SHOULDER', 42);
    expect(ctx.painTypes!.length).toBeGreaterThanOrEqual(1);
    expect(ctx.painTypes!.length).toBeLessThanOrEqual(3);
  });

  it('severity matches pain level', () => {
    for (let seed = 0; seed < 100; seed++) {
      const ctx = randomizePatientContext('KNEE', seed);
      const pain = ctx.painCurrent!;
      if (pain <= 3) expect(ctx.severityLevel).toBe('mild');
      else if (pain <= 5) expect(ctx.severityLevel).toBe('mild to moderate');
      else if (pain <= 6) expect(ctx.severityLevel).toBe('moderate');
      else if (pain <= 7) expect(ctx.severityLevel).toBe('moderate to severe');
      else expect(ctx.severityLevel).toBe('severe');
    }
  });

  it('painWorst >= painCurrent >= painBest', () => {
    for (let seed = 0; seed < 100; seed++) {
      const ctx = randomizePatientContext('SHOULDER', seed);
      expect(ctx.painWorst).toBeGreaterThanOrEqual(ctx.painCurrent!);
      expect(ctx.painCurrent).toBeGreaterThanOrEqual(ctx.painBest!);
    }
  });

  it('covers all 6 body parts without error', () => {
    for (const bp of ['SHOULDER', 'KNEE', 'LBP', 'NECK', 'ELBOW', 'HIP']) {
      expect(() => randomizePatientContext(bp, 42)).not.toThrow();
    }
  });
});
