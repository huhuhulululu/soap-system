import type { TXRule } from "../../types";
import { err } from "../shared";
import {
  extractPainCurrent,
  parseAdlSeverity,
} from "../../../../../src/shared/field-parsers";
import { severityFromPain } from "../../../../../src/shared/severity";

const SEV_ORDER = [
  "mild",
  "mild to moderate",
  "moderate",
  "moderate to severe",
  "severe",
];

export const tx01: TXRule = {
  id: "TX01",
  kind: "TX",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const pain = extractPainCurrent(visit.subjective.painScale);
    const expectedSev = severityFromPain(pain);
    const actualSev = parseAdlSeverity(visit.subjective.adlImpairment);

    const expIdx = SEV_ORDER.indexOf(expectedSev);
    const actIdx = SEV_ORDER.indexOf(actualSev);
    const withinTwoLevelsDown =
      expIdx >= 0 &&
      actIdx >= 0 &&
      expIdx - actIdx <= 2 &&
      expIdx - actIdx >= 0;

    if (
      actualSev === expectedSev ||
      (actualSev === "moderate to severe" && expectedSev === "moderate") ||
      withinTwoLevelsDown
    ) {
      return [];
    }

    return [
      err({
        ruleId: "TX01",
        severity: "MEDIUM",
        visitDate: date,
        visitIndex,
        section: "S",
        field: "adlDifficultyLevel",
        ruleName: "pain→severity 映射正确",
        message: `Pain=${pain} 与 ADL severity 不一致`,
        expected: expectedSev,
        actual: actualSev,
      }),
    ];
  },
};
