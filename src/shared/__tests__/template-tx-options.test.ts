import {
  TEMPLATE_TX_REASON,
  TEMPLATE_TX_ADVERSE,
  TEMPLATE_TX_WHAT_CHANGED,
} from "../template-options";

describe("TX template option constants", () => {
  it("TEMPLATE_TX_REASON has exactly 24 options", () => {
    expect(TEMPLATE_TX_REASON).toHaveLength(24);
  });

  it("TEMPLATE_TX_REASON contains only template-verbatim strings", () => {
    // First 8 are positive
    expect(TEMPLATE_TX_REASON[0]).toBe("can move joint more freely and with less pain");
    expect(TEMPLATE_TX_REASON[7]).toBe("more energy level throughout the day");
    // Last is uncertain reason
    expect(TEMPLATE_TX_REASON[23]).toBe("uncertain reason");
  });

  it("TEMPLATE_TX_ADVERSE is the single fixed template string", () => {
    expect(TEMPLATE_TX_ADVERSE).toBe("No adverse side effect post treatment.");
  });

  it("TEMPLATE_TX_WHAT_CHANGED has exactly 10 options", () => {
    expect(TEMPLATE_TX_WHAT_CHANGED).toHaveLength(10);
  });

  it("TEMPLATE_TX_WHAT_CHANGED does NOT contain 'severity level'", () => {
    expect(TEMPLATE_TX_WHAT_CHANGED).not.toContain("severity level");
  });

  it("TEMPLATE_TX_WHAT_CHANGED does NOT contain 'dizziness', 'headache', 'migraine'", () => {
    expect(TEMPLATE_TX_WHAT_CHANGED).not.toContain("dizziness");
    expect(TEMPLATE_TX_WHAT_CHANGED).not.toContain("headache");
    expect(TEMPLATE_TX_WHAT_CHANGED).not.toContain("migraine");
  });

  it("TEMPLATE_TX_WHAT_CHANGED contains template values", () => {
    expect(TEMPLATE_TX_WHAT_CHANGED).toContain("muscles stiffness sensation");
    expect(TEMPLATE_TX_WHAT_CHANGED).toContain("muscles weakness");
    expect(TEMPLATE_TX_WHAT_CHANGED).toContain("numbness sensation");
  });
});

describe("TX reason pool uses only template values", () => {
  it("TEMPLATE_TX_REASON does NOT contain fabricated body-part-specific reasons", () => {
    const fabricated = [
      "can bend and lift with less discomfort",
      "sitting tolerance has improved",
      "can look over shoulder more easily",
      "overhead reaching is easier",
      "stair climbing is less painful",
      "neck rotation range has improved",
      "shoulder stiffness has decreased",
      "knee stability has improved",
      "grip strength has improved",
      "muscle tension has reduced noticeably",
      "overall well-being has improved",
      "stress level has decreased",
      "walking distance increased without pain",
    ];
    for (const f of fabricated) {
      expect(TEMPLATE_TX_REASON).not.toContain(f);
    }
  });

  it("TEMPLATE_TX_REASON does NOT contain fabricated neutral reasons", () => {
    const fabricated = [
      "body is adjusting to treatment",
      "consistent treatment schedule",
      "gradual recovery process",
      "treatment plan is on track",
      "patient compliance with treatment",
      "steady progress with current protocol",
      "body needs time to consolidate gains",
      "recovery plateau is expected at this stage",
      "maintaining current functional level",
    ];
    for (const f of fabricated) {
      expect(TEMPLATE_TX_REASON).not.toContain(f);
    }
  });

  it("TEMPLATE_TX_REASON does NOT contain fabricated came-back reasons", () => {
    const fabricated = [
      "did not follow home care instructions",
      "overexertion between visits",
      "irregular treatment schedule",
    ];
    for (const f of fabricated) {
      expect(TEMPLATE_TX_REASON).not.toContain(f);
    }
  });
});
