import type { TXRule } from "../../types";
import { err } from "../shared";

export const tx06: TXRule = {
  id: "TX06",
  kind: "TX",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    if (!(visit.plan.shortTermGoal || visit.plan.longTermGoal)) return [];
    return [
      err({
        ruleId: "TX06",
        severity: "CRITICAL",
        visitDate: date,
        visitIndex,
        section: "P",
        field: "goals",
        ruleName: "不应出现 short/long term goal",
        message: "TX 不应携带 IE goals",
        expected: "no short/long term goals",
        actual: "present",
      }),
    ];
  },
};
