import type { SequenceRule } from "../../types";
import { err, jaccard } from "../shared";

export const v09: SequenceRule = {
  id: "V09",
  kind: "SEQUENCE",
  check: ({ prev, cur, visitIndex }) => {
    const date = cur.assessment.date || "";
    const overlap = jaccard(
      prev.plan.acupoints || [],
      cur.plan.acupoints || [],
    );
    if (overlap >= 0.4) return [];
    return [
      err({
        ruleId: "V09",
        severity: "HIGH",
        visitDate: date,
        visitIndex,
        section: "P",
        field: "acupoints",
        ruleName: "P 段跨 TX 穴位大变化",
        message: "连续 TX 穴位重叠度过低",
        expected: "overlap >= 0.4",
        actual: overlap.toFixed(2),
      }),
    ];
  },
};
