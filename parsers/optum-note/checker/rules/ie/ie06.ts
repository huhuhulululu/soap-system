import type { IERule } from "../../types";
import { err } from "../shared";
import { parseGoalPainTarget } from "../../../../../src/shared/field-parsers";

export const ie06: IERule = {
  id: "IE06",
  kind: "IE",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const st = parseGoalPainTarget(visit.plan.shortTermGoal?.painScaleTarget);
    const lt = parseGoalPainTarget(visit.plan.longTermGoal?.painScaleTarget);
    if (st === null || lt === null || lt < st) return [];
    return [
      err({
        ruleId: "IE06",
        severity: "HIGH",
        visitDate: date,
        visitIndex,
        section: "P",
        field: "longTermGoal.painScaleTarget",
        ruleName: "long term goal pain target < short term target",
        message: "长期目标应严于短期目标",
        expected: `< ${st}`,
        actual: String(lt),
      }),
    ];
  },
};
