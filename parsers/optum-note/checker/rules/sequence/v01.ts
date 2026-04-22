import type { SequenceRule } from "../../types";
import { err } from "../shared";
import { extractPainCurrent } from "../../../../../src/shared/field-parsers";

export const v01: SequenceRule = {
  id: "V01",
  kind: "SEQUENCE",
  check: ({ prev, cur, visitIndex }) => {
    const date = cur.assessment.date || "";
    const prevPain = extractPainCurrent(prev.subjective.painScale);
    const curPain = extractPainCurrent(cur.subjective.painScale);
    if (curPain <= prevPain + 1) return [];
    return [
      err({
        ruleId: "V01",
        severity: "HIGH",
        visitDate: date,
        visitIndex,
        section: "S",
        field: "painScale",
        ruleName: "pain 不回升",
        message: "疼痛分值不应回升",
        expected: `<= ${prevPain + 1}`,
        actual: `${curPain}`,
      }),
    ];
  },
};
