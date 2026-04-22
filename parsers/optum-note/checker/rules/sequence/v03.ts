import type { SequenceRule } from "../../types";
import { err } from "../shared";
import { compareSeverity } from "../../../../../src/shared/field-parsers";

export const v03: SequenceRule = {
  id: "V03",
  kind: "SEQUENCE",
  check: ({ prev, cur, visitIndex }) => {
    const date = cur.assessment.date || "";
    const sevDelta = compareSeverity(
      cur.objective.tightnessMuscles.gradingScale,
      prev.objective.tightnessMuscles.gradingScale,
    );
    if (sevDelta <= 1) return [];
    return [
      err({
        ruleId: "V03",
        severity: "HIGH",
        visitDate: date,
        visitIndex,
        section: "O",
        field: "tightness",
        ruleName: "tightness 不恶化",
        message: "Tightness grading 恶化",
        expected: `<= 1 level above ${prev.objective.tightnessMuscles.gradingScale}`,
        actual: cur.objective.tightnessMuscles.gradingScale,
      }),
    ];
  },
};
