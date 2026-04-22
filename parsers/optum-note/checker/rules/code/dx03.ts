import type { CodeRule } from "../../types";
import { err } from "../shared";

export const dx03: CodeRule = {
  id: "DX03",
  kind: "CODE",
  check: ({ visit, visitIndex, allMissingDx }) => {
    if (visit.diagnosisCodes.length > 0 || allMissingDx) return [];
    const date = visit.assessment.date || "";
    return [
      err({
        ruleId: "DX03",
        severity: "HIGH",
        visitDate: date,
        visitIndex,
        section: "A",
        field: "diagnosisCodes",
        ruleName: "ICD 编码存在",
        message: "缺少 ICD-10 诊断编码",
        expected: ">= 1",
        actual: "0",
      }),
    ];
  },
};
