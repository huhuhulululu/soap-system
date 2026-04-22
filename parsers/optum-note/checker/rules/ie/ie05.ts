import type { IERule } from "../../types";
import { err } from "../shared";
import {
  extractPainCurrent,
  parseGoalPainTarget,
} from "../../../../../src/shared/field-parsers";

export const ie05: IERule = {
  id: "IE05",
  kind: "IE",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const pain = extractPainCurrent(visit.subjective.painScale);
    const st = parseGoalPainTarget(visit.plan.shortTermGoal?.painScaleTarget);
    if (st === null || st < pain) return [];
    return [
      err({
        ruleId: "IE05",
        severity: "HIGH",
        visitDate: date,
        visitIndex,
        section: "P",
        field: "shortTermGoal.painScaleTarget",
        ruleName: "short term goal pain target < current pain",
        message: "短期目标疼痛值应低于当前疼痛",
        expected: `< ${pain}`,
        actual: String(st),
      }),
    ];
  },
};
