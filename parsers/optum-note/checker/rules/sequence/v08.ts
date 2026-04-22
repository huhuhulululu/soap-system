import type { SequenceRule } from "../../types";
import { err } from "../shared";
import { extractPainCurrent } from "../../../../../src/shared/field-parsers";

export const v08: SequenceRule = {
  id: "V08",
  kind: "SEQUENCE",
  check: ({ prev, cur, visitIndex }) => {
    const date = cur.assessment.date || "";
    const saysImprove = /improvement/i.test(cur.assessment.symptomChange || "");
    const prevPain = extractPainCurrent(prev.subjective.painScale);
    const curPain = extractPainCurrent(cur.subjective.painScale);
    if (!(saysImprove && curPain > prevPain + 1)) return [];
    return [
      err({
        ruleId: "V08",
        severity: "MEDIUM",
        visitDate: date,
        visitIndex,
        section: "A",
        field: "symptomChange",
        ruleName: "S 说 improvement 但 pain 实际上升",
        message: "纵向矛盾：写改善但 pain 回升",
        expected: `pain <= ${prevPain + 1}`,
        actual: String(curPain),
      }),
    ];
  },
};
