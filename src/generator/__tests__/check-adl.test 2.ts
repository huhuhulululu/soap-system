import { describe, it, expect } from "vitest";
import { generateTXSequenceStates } from "../tx-sequence-engine";

describe("ADL check", () => {
  const ctx = {
    primaryBodyPart: "SHOULDER",
    laterality: "bilateral",
    insuranceType: "OPTUM",
    age: 55,
    patientGender: "Female",
    recentWorse: "1 week(s)",
    secondaryBodyParts: [],
    medicalHistory: [],
  };

  it("ADL not mentioned in whatChanged when ADL count unchanged (TX2+)", () => {
    const { states } = generateTXSequenceStates(ctx as any, {
      txCount: 8,
      startVisitIndex: 1,
      seed: 42,
    });

    for (let i = 1; i < states.length; i++) {
      const s = states[i];
      const prev = states[i - 1];
      const adlCur = s.adlItems?.length ?? 0;
      const adlPrev = prev.adlItems?.length ?? 0;

      if (adlCur === adlPrev) {
        expect(
          s.soaChain.assessment.whatChanged,
          `TX${s.visitIndex}: ADL ${adlPrev}→${adlCur} unchanged but whatChanged mentions ADLs`,
        ).not.toContain("ADL");
      }
    }
  });

  it("TX1 compares ADL against IE baseline — no false ADL mention", () => {
    const { states } = generateTXSequenceStates(ctx as any, {
      txCount: 8,
      startVisitIndex: 1,
      seed: 42,
    });

    const tx1 = states[0];
    const chain = tx1.soaChain;

    // TX1 should compare against IE's ADL count (same severity → same count)
    // so no ADL improvement should be claimed
    if (chain.assessment.whatChanged.includes("ADL")) {
      expect.fail(
        `TX1: ADL count=${tx1.adlItems?.length} but whatChanged="${chain.assessment.whatChanged}" mentions ADLs without actual change from IE`,
      );
    }
  });

  it("ADL items are populated when primaryBodyPart is set correctly", () => {
    const { states } = generateTXSequenceStates(ctx as any, {
      txCount: 4,
      startVisitIndex: 1,
      seed: 42,
    });

    // With SHOULDER and moderate-to-severe severity, ADL items should be non-empty
    const tx1 = states[0];
    expect(
      tx1.adlItems?.length,
      "TX1 should have ADL items for SHOULDER",
    ).toBeGreaterThan(0);
  });
});
