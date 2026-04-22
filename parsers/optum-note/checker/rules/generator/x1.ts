import type { GeneratorRule } from "../../types";
import { err } from "../shared";
import { extractPainCurrent } from "../../../../../src/shared/field-parsers";
import { expectedTenderMinScaleByPain } from "../../../../../src/shared/severity";

export const x1: GeneratorRule = {
  id: "X1",
  kind: "GENERATOR",
  check: ({ visit, visitIndex }) => {
    const isIE = visit.subjective.visitType === "INITIAL EVALUATION";
    if (isIE) return [];
    const date = visit.assessment.date || "";
    const pain = extractPainCurrent(visit.subjective.painScale);
    const expectedTenderness = expectedTenderMinScaleByPain(pain);
    const actualTightness =
      visit.objective.tightnessMuscles.gradingScale.toLowerCase();
    const actualTenderness = visit.objective.tendernessMuscles.scale;

    if (
      (pain >= 8 &&
        !actualTightness.includes("moderate") &&
        !actualTightness.includes("severe") &&
        !actualTightness.includes("mild to moderate")) ||
      (pain <= 3 &&
        (actualTightness.includes("severe") || actualTenderness > 3))
    ) {
      return [
        err({
          ruleId: "X1",
          severity: "CRITICAL",
          visitDate: date,
          visitIndex,
          section: "O",
          field: "tightness/tenderness",
          ruleName: "Pain→Severity→Tightness→Tenderness chain",
          message: "Inconsistent pain-tightness-tenderness chain",
          expected: `pain ${pain} → tightness/+${expectedTenderness}`,
          actual: `${actualTightness}/+${actualTenderness}`,
        }),
      ];
    }
    return [];
  },
};
