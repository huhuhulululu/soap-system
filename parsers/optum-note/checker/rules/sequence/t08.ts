import type { SequenceRule } from "../../types";
import { err } from "../shared";
import {
  compareSeverity,
  parseAdlSeverity,
} from "../../../../../src/shared/field-parsers";

export const t08: SequenceRule = {
  id: "T08",
  kind: "SEQUENCE",
  check: ({ prev, cur, visitIndex }) => {
    const date = cur.assessment.date || "";
    const prevAdl = parseAdlSeverity(prev.subjective.adlImpairment);
    const curAdl = parseAdlSeverity(cur.subjective.adlImpairment);
    if (compareSeverity(curAdl, prevAdl) <= 1) return [];
    return [
      err({
        ruleId: "T08",
        severity: "HIGH",
        visitDate: date,
        visitIndex,
        section: "S",
        field: "adlImpairment",
        ruleName: "ADL severity 单调性",
        message: "ADL severity 不应恶化",
        expected: `<= 1 level above ${prevAdl}`,
        actual: curAdl,
      }),
    ];
  },
};
