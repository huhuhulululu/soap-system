/**
 * TEMPLATE_TX_VERB — TX Plan verb options from template ppnSelectCombo
 * C-01: Verify verb list matches template exactly
 * H-01: Verify TEMPLATE_TX_VERB is exported and usable
 */
import { TEMPLATE_TX_VERB } from "../template-options";

describe("TEMPLATE_TX_VERB", () => {
  it("exports an array of 6 verb options", () => {
    expect(TEMPLATE_TX_VERB).toHaveLength(6);
  });

  it("first option is 'continue to be emphasize' (not 'continue to emphasize')", () => {
    expect(TEMPLATE_TX_VERB[0]).toBe("continue to be emphasize");
  });

  it("matches exact template ppnSelectCombo order", () => {
    expect([...TEMPLATE_TX_VERB]).toEqual([
      "continue to be emphasize",
      "emphasize",
      "consist of promoting",
      "promote",
      "focus",
      "pay attention",
    ]);
  });
});
