import type { CodeRule } from "../../types";
import { err } from "../shared";

export const cpt01: CodeRule = {
  id: "CPT01",
  kind: "CODE",
  check: ({ visit, visitIndex, allMissingCpt }) => {
    if (visit.procedureCodes.length > 0 || allMissingCpt) return [];
    const date = visit.assessment.date || "";
    return [
      err({
        ruleId: "CPT01",
        severity: "HIGH",
        visitDate: date,
        visitIndex,
        section: "P",
        field: "procedureCodes",
        ruleName: "CPT 编码存在",
        message: "缺少 CPT 操作编码",
        expected: ">= 1",
        actual: "0",
      }),
    ];
  },
};
