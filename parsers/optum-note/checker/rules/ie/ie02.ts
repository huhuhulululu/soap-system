import type { IERule } from "../../types";
import { err } from "../shared";
import { extractPainCurrent } from "../../../../../src/shared/field-parsers";
import { expectedTenderMinScaleByPain } from "../../../../../src/shared/severity";

export const ie02: IERule = {
  id: "IE02",
  kind: "IE",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const pain = extractPainCurrent(visit.subjective.painScale);
    const minTender = expectedTenderMinScaleByPain(pain);
    if (visit.objective.tendernessMuscles.scale >= minTender) return [];
    return [
      err({
        ruleId: "IE02",
        severity: "MEDIUM",
        visitDate: date,
        visitIndex,
        section: "O",
        field: "tenderness.scale",
        ruleName: "pain→tenderness 合理",
        message: "当前 tenderness 级别低于 pain 对应区间",
        expected: `>= +${minTender}`,
        actual: `+${visit.objective.tendernessMuscles.scale}`,
      }),
    ];
  },
};
