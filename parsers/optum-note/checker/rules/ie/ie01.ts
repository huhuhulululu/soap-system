import type { IERule } from "../../types";
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

export const ie01: IERule = {
  id: "IE01",
  kind: "IE",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const pain = extractPainCurrent(visit.subjective.painScale);
    const expectedSev = severityFromPain(pain);
    const actualSev = parseAdlSeverity(visit.subjective.adlImpairment);

    const expIdx = SEV_ORDER.indexOf(expectedSev);
    const actIdx = SEV_ORDER.indexOf(actualSev);
    if (expIdx < 0 || actIdx < 0) return [];
    if (Math.abs(expIdx - actIdx) < 4) return [];

    return [
      err({
        ruleId: "IE01",
        severity: "LOW",
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
