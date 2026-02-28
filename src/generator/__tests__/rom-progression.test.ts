import { describe, it, expect } from "vitest";
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
