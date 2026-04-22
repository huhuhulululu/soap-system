import type { TXRule } from "../../types";
import { err } from "../shared";
import { extractPainCurrent } from "../../../../../src/shared/field-parsers";
import { expectedTenderMinScaleByPain } from "../../../../../src/shared/severity";

export const tx02: TXRule = {
  id: "TX02",
  kind: "TX",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const pain = extractPainCurrent(visit.subjective.painScale);
    const minTender = expectedTenderMinScaleByPain(pain);
    if (visit.objective.tendernessMuscles.scale >= minTender) return [];
    return [
      err({
        ruleId: "TX02",
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
