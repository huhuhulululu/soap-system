import type { SequenceRule } from "../../types";
import { err } from "../shared";
import { parseFrequencyLevel } from "../../../../../src/shared/field-parsers";

export const v07: SequenceRule = {
  id: "V07",
  kind: "SEQUENCE",
  check: ({ prev, cur, visitIndex }) => {
    const date = cur.assessment.date || "";
    if (
      parseFrequencyLevel(cur.subjective.painFrequency) <=
      parseFrequencyLevel(prev.subjective.painFrequency) + 1
    )
      return [];
    return [
      err({
        ruleId: "V07",
        severity: "MEDIUM",
        visitDate: date,
        visitIndex,
        section: "S",
        field: "painFrequency",
        ruleName: "frequency 不增加",
        message: "疼痛频率分级增加",
        expected: `<= 1 level above ${prev.subjective.painFrequency}`,
        actual: cur.subjective.painFrequency,
      }),
    ];
  },
};
