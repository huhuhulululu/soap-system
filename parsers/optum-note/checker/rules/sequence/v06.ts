import type { SequenceRule } from "../../types";
import { avgStrength, err } from "../shared";

export const v06: SequenceRule = {
  id: "V06",
  kind: "SEQUENCE",
  check: ({ prev, cur, visitIndex }) => {
    const date = cur.assessment.date || "";
    const prevStr = avgStrength(prev);
    const curStr = avgStrength(cur);
    if (curStr >= prevStr - 0.3) return [];
    return [
      err({
        ruleId: "V06",
        severity: "MEDIUM",
        visitDate: date,
        visitIndex,
        section: "O",
        field: "strength",
        ruleName: "strength 不下降",
        message: "肌力平均值下降",
        expected: `>= ${(prevStr - 0.3).toFixed(2)}`,
        actual: curStr.toFixed(2),
      }),
    ];
  },
};
