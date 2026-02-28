/**
 * TX fixes verification tests
 * C-01: TEMPLATE_TX_VERB matches template ppnSelectCombo exactly
 * H-01: Laterality prefix verification (shared constant check)
 * H-03: LBP ADL group count (structural check)
 *
 * NOTE: Direct generator function tests blocked by pre-existing TS errors
 * in tx-sequence-engine.ts. These tests verify the shared constants and
 * the soap-generator source code structure via grep-style assertions.
 */
import { TEMPLATE_TX_VERB } from "../../shared/template-options";
import * as fs from "fs";
import * as path from "path";

const GENERATOR_PATH = path.resolve(
  __dirname,
  "../soap-generator.ts",
);
const generatorSource = fs.readFileSync(GENERATOR_PATH, "utf-8");

describe("C-01: TX Plan verb uses TEMPLATE_TX_VERB", () => {
  it("TEMPLATE_TX_VERB has 6 options matching template", () => {
    expect([...TEMPLATE_TX_VERB]).toEqual([
      "continue to be emphasize",
      "emphasize",
      "consist of promoting",
      "promote",
      "focus",
      "pay attention",
    ]);
  });

  it("soap-generator no longer defines local TX_VERB_OPTIONS", () => {
    // Should not have a const TX_VERB_OPTIONS = [ declaration
    expect(generatorSource).not.toMatch(/const TX_VERB_OPTIONS\s*=\s*\[/);
  });

  it("soap-generator uses TEMPLATE_TX_VERB for plan verb weights", () => {
    expect(generatorSource).toContain("TEMPLATE_TX_VERB");
  });
});

describe("H-01: TX Assessment laterality uses 'in' prefix", () => {
  it("SHOULDER/KNEE branch uses 'for in ${laterality}'", () => {
    // The template literal should contain "for in ${laterality}" not "for ${laterality}"
    expect(generatorSource).toMatch(
      /treatment for in \$\{laterality\}.*area today/,
    );
  });

  it("does NOT have 'for ${laterality}' without 'in' for SHOULDER/KNEE", () => {
    // After the fix, the SHOULDER/KNEE branch should not have bare "for ${laterality}"
    // Extract just the SHOULDER/KNEE branch line
    const lines = generatorSource.split("\n");
    const shoulderKneeBranch = lines.filter(
      (l) =>
        l.includes("treatment for") &&
        l.includes("laterality") &&
        l.includes("area today"),
    );
    for (const line of shoulderKneeBranch) {
      // Each line with laterality should have "for in"
      expect(line).toContain("for in");
    }
  });
});

describe("H-03: LBP TX ADL — single group", () => {
  it("LBP else branch uses 'difficulty with ADLs like' (single group)", () => {
    expect(generatorSource).toContain("difficulty with ADLs like");
  });

  it("LBP branch uses allAdl.slice(0, 3) — not two groups", () => {
    // The LBP path should use allAdl.slice, not adlGroup1 + adlGroup2
    const lbpSection = generatorSource.match(
      /difficulty with ADLs like \$\{allAdl\.slice/,
    );
    expect(lbpSection).not.toBeNull();
  });
});
