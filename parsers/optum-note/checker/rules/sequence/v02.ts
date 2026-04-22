import type { SequenceRule } from "../../types";
import { err } from "../shared";

export const v02: SequenceRule = {
  id: "V02",
  kind: "SEQUENCE",
  check: ({ prev, cur, visitIndex }) => {
    const date = cur.assessment.date || "";
    if (
      cur.objective.tendernessMuscles.scale <=
      prev.objective.tendernessMuscles.scale + 1
    )
      return [];
    return [
      err({
        ruleId: "V02",
        severity: "HIGH",
        visitDate: date,
        visitIndex,
        section: "O",
        field: "tenderness",
        ruleName: "tenderness 不回升",
        message: "Tenderness scale 回升",
        expected: `<= +${prev.objective.tendernessMuscles.scale + 1}`,
        actual: `+${cur.objective.tendernessMuscles.scale}`,
      }),
    ];
  },
};
