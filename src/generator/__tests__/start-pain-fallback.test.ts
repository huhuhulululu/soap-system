import { generateTXSequenceStates } from "../tx-sequence-engine";
import type { GenerationContext } from "../../types";

function makeContext(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    primaryBodyPart: "LBP",
    laterality: "right",
    chronicityLevel: "Chronic",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    medicalHistory: [],
    painCurrent: 7,
    painFrequency:
      "Constant (symptoms occur between 76% and 100% of the time)",
    ...overrides,
  } as GenerationContext;
}

describe("startPain fallback order", () => {
  it("uses context.painCurrent when previousIE and initialState are missing", () => {
    const ctx = makeContext({ painCurrent: 7, previousIE: undefined });
    const seed = 42;

    const noInitial = generateTXSequenceStates(ctx, {
      txCount: 1,
      seed,
    }).states[0].painScaleCurrent;

    const withInitialPain = generateTXSequenceStates(ctx, {
      txCount: 1,
      seed,
      initialState: { pain: 7 },
    }).states[0].painScaleCurrent;

    expect(noInitial).toBeCloseTo(withInitialPain, 10);
  });

  it("prefers previousIE pain over context.painCurrent when initialState is missing", () => {
    const ctx = makeContext({
      painCurrent: 7,
      previousIE: {
        subjective: {
          painScale: { current: 9 },
        },
      } as any,
    });
    const seed = 42;

    const noInitial = generateTXSequenceStates(ctx, {
      txCount: 1,
      seed,
    }).states[0].painScaleCurrent;

    const withInitialFromIe = generateTXSequenceStates(ctx, {
      txCount: 1,
      seed,
      initialState: { pain: 9 },
    }).states[0].painScaleCurrent;

    const withInitialFromContext = generateTXSequenceStates(ctx, {
      txCount: 1,
      seed,
      initialState: { pain: 7 },
    }).states[0].painScaleCurrent;

    expect(noInitial).toBeCloseTo(withInitialFromIe, 10);
    expect(Math.abs(noInitial - withInitialFromContext)).toBeGreaterThan(0.5);
  });
});

