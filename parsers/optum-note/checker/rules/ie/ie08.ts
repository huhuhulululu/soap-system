import type { IERule } from "../../types";
import { err } from "../shared";

export const ie08: IERule = {
  id: "IE08",
  kind: "IE",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    if (visit.plan.acupoints && visit.plan.acupoints.length > 0) return [];
    return [
      err({
        ruleId: "IE08",
        severity: "HIGH",
        visitDate: date,
        visitIndex,
        section: "P",
        field: "acupoints",
        ruleName: "P 段 needle protocol 存在",
        message: "计划中缺少穴位信息",
        expected: "non-empty acupoints",
        actual: "empty",
      }),
    ];
  },
};
