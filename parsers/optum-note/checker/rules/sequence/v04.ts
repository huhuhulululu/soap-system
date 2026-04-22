import type { SequenceRule } from "../../types";
import { err } from "../shared";

export const v04: SequenceRule = {
  id: "V04",
  kind: "SEQUENCE",
  check: ({ prev, cur, visitIndex }) => {
    const date = cur.assessment.date || "";
    if (
      cur.objective.spasmMuscles.frequencyScale <=
      prev.objective.spasmMuscles.frequencyScale + 1
    )
      return [];
    return [
      err({
        ruleId: "V04",
        severity: "HIGH",
        visitDate: date,
        visitIndex,
        section: "O",
        field: "spasm",
        ruleName: "spasm 不回升",
        message: "Spasm scale 回升",
        expected: `<= +${prev.objective.spasmMuscles.frequencyScale + 1}`,
        actual: `+${cur.objective.spasmMuscles.frequencyScale}`,
      }),
    ];
  },
};
