import { generateTXSequenceStates } from "../tx-sequence-engine";
import { exportSOAPAsText } from "../soap-generator";
import { patchSOAPText } from "../objective-patch";
import type { GenerationContext } from "../../types";

/**
 * M-03: ROM severity should improve across TX visits (not stay identical)
 * M-04: Strength grades in ROM lines should reflect engine's strengthGrade
 * H-05: Generic path ROM format should have space before (severity)
 * C-17: HIP degree label should match template
 */

function makeCtx(
  bp: GenerationContext["primaryBodyPart"],
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    noteType: "TX" as const,
    insuranceType: "NONE" as const,
    primaryBodyPart: bp,
    laterality: "bilateral" as const,
    localPattern: "Qi Stagnation, Blood Stasis",
    systemicPattern: "Blood Deficiency",
    chronicityLevel: "Chronic" as const,
    severityLevel: "moderate to severe" as const,
    painCurrent: 8,
    painWorst: 9,
    painBest: 5,
    age: 55,
    gender: "Female" as const,
    ...overrides,
  };
}

function extractRomLines(text: string): string[] {
  return text
    .split("\n")
    .filter((l) => /\d+\s*degree/i.test(l) || /\d+\/5/.test(l));
}

function extractStrengthGrades(romLines: string[]): string[] {
  return romLines
    .map((l) => {
      const m = l.match(/(\d[+-]?\/5)/);
      return m ? m[1] : null;
    })
    .filter(Boolean) as string[];
}

function extractRomDegrees(text: string): number[] {
  return text
    .split("\n")
    .map((line) => {
      const m = line.match(/(\d+)\s*degree/i);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter((v): v is number => v != null);
}

function extractRomSeverities(text: string): string[] {
  return text
    .split("\n")
    .map((line) => {
      const m = line.match(/degrees?\s*\(([^)]+)\)/i);
      return m ? m[1].toLowerCase() : null;
    })
    .filter((v): v is string => v != null);
}

describe("M-03: ROM severity improves across TX visits", () => {
  it.each(["SHOULDER", "KNEE"] as const)(
    "%s — ROM lines should NOT be identical across all visits",
    (bp) => {
      const ctx = makeCtx(bp);
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 5,
        seed: 42,
      });

      const allRomSets: string[][] = [];
      for (const vs of states) {
        const text = patchSOAPText(exportSOAPAsText(ctx, vs), ctx, vs);
        const romLines = extractRomLines(text);
        allRomSets.push(romLines);
      }

      // At least one visit should have different ROM lines from visit 1
      const firstVisitJoined = allRomSets[0].join("|");
      const hasDifference = allRomSets
        .slice(1)
        .some((lines) => lines.join("|") !== firstVisitJoined);

      expect(hasDifference).toBe(true);
    },
  );
});

describe("Task 1.1: ROM render aligns with romTrend", () => {
  it("same pain/progress with different romTrend should render different ROM lines", () => {
    const ctx = makeCtx("LBP", { laterality: "right" });
    const { states } = generateTXSequenceStates(ctx, {
      txCount: 1,
      seed: 314159,
    });
    const base = states[0];
    const fixedState = {
      ...base,
      painScaleCurrent: 6,
      progress: 0.6,
      strengthGrade: "4/5",
    };
    const stableState = {
      ...fixedState,
      soaChain: {
        ...fixedState.soaChain,
        objective: {
          ...fixedState.soaChain.objective,
          romTrend: "stable" as const,
        },
      },
    };
    const improvedState = {
      ...fixedState,
      soaChain: {
        ...fixedState.soaChain,
        objective: {
          ...fixedState.soaChain.objective,
          romTrend: "improved" as const,
        },
      },
    };

    const stableText = patchSOAPText(exportSOAPAsText(ctx, stableState), ctx, stableState);
    const improvedText = patchSOAPText(
      exportSOAPAsText(ctx, improvedState),
      ctx,
      improvedState,
    );
    const stableRom = extractRomLines(stableText).join("|");
    const improvedRom = extractRomLines(improvedText).join("|");

    expect(improvedRom).not.toBe(stableRom);
  });
});

describe("M-04: Strength grades reflect engine progression", () => {
  it.each(["SHOULDER", "KNEE"] as const)(
    "%s — strength in ROM lines should change across visits",
    (bp) => {
      const ctx = makeCtx(bp);
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 8,
        seed: 42,
      });

      const strengthPerVisit: string[][] = [];
      for (const vs of states) {
        const text = patchSOAPText(exportSOAPAsText(ctx, vs), ctx, vs);
        const romLines = extractRomLines(text);
        const grades = extractStrengthGrades(romLines);
        strengthPerVisit.push(grades);
      }

      // Engine's strengthGrade improves; ROM lines should reflect that
      const firstGrades = strengthPerVisit[0].join(",");
      const lastGrades =
        strengthPerVisit[strengthPerVisit.length - 1].join(",");
      expect(lastGrades).not.toBe(firstGrades);
    },
  );
});

describe("H-05: Generic path ROM format has space before (severity)", () => {
  it("ELBOW — format should be 'degree (severity)' not 'degree(severity)'", () => {
    const ctx = makeCtx("ELBOW" as GenerationContext["primaryBodyPart"], {
      laterality: "right",
    });
    // IE note (no visitState) to test generic path format
    const ieCtx = { ...ctx, noteType: "IE" as const };
    const text = exportSOAPAsText(ieCtx);
    const romLines = extractRomLines(text);

    // Every ROM line with degree(xxx) should have a space: degree (xxx)
    for (const line of romLines) {
      if (/degree\(/.test(line)) {
        expect(line).not.toMatch(/degree\(/);
      }
    }
  });
});

describe("IE ROM should respond to pain-level changes inside same severity band", () => {
  it("LBP pain 6 vs 7 should change smoothly (max delta <= 5 degrees)", () => {
    const ieCtx6 = makeCtx("LBP", {
      noteType: "IE",
      laterality: "right",
      seed: 12345,
      painCurrent: 6,
      painWorst: 8,
      painBest: 3,
      severityLevel: "moderate",
    });
    const ieCtx7 = { ...ieCtx6, painCurrent: 7 };

    const deg6 = extractRomDegrees(exportSOAPAsText(ieCtx6));
    const deg7 = extractRomDegrees(exportSOAPAsText(ieCtx7));

    expect(deg6.length).toBeGreaterThan(0);
    expect(deg7.length).toBeGreaterThan(0);
    expect(deg6.length).toBe(deg7.length);

    const maxDelta = deg6.reduce((acc, d, i) => Math.max(acc, Math.abs(d - deg7[i])), 0);
    expect(maxDelta).toBeLessThanOrEqual(5);
  });

  it("LBP pain 8-10 should stay in severe-range ROM profile", () => {
    const ieCtx8 = makeCtx("LBP", {
      noteType: "IE",
      laterality: "right",
      seed: 12345,
      painCurrent: 8,
      painWorst: 10,
      painBest: 3,
      severityLevel: "severe",
    });
    const ieCtx9 = { ...ieCtx8, painCurrent: 9 };
    const ieCtx10 = { ...ieCtx8, painCurrent: 10 };

    const text8 = exportSOAPAsText(ieCtx8);
    const text9 = exportSOAPAsText(ieCtx9);
    const text10 = exportSOAPAsText(ieCtx10);

    const deg8 = extractRomDegrees(text8);
    const deg9 = extractRomDegrees(text9);
    const deg10 = extractRomDegrees(text10);

    // Higher pain → equal or lower ROM (monotonic within severe band)
    for (let i = 0; i < deg8.length; i++) {
      expect(deg8[i]).toBeGreaterThanOrEqual(deg9[i]);
      expect(deg9[i]).toBeGreaterThanOrEqual(deg10[i]);
    }

    const severities8 = extractRomSeverities(text8);
    const severities9 = extractRomSeverities(text9);
    const severities10 = extractRomSeverities(text10);
    for (const labels of [severities8, severities9, severities10]) {
      expect(labels.some((s) => s.includes("severe"))).toBe(true);
      expect(labels.some((s) => s.includes("normal"))).toBe(false);
      expect(labels.some((s) => s.startsWith("mild"))).toBe(false);
    }
  });
});
