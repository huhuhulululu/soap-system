import type { IERule } from "../../types";
import { err } from "../shared";

export const ie07: IERule = {
  id: "IE07",
  kind: "IE",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const hasDx =
      !!visit.assessment.tcmDiagnosis?.diagnosis &&
      !!visit.assessment.tcmDiagnosis?.pattern;
    if (hasDx) return [];
    return [
      err({
        ruleId: "IE07",
        severity: "HIGH",
        visitDate: date,
        visitIndex,
        section: "A",
        field: "tcmDiagnosis",
        ruleName: "TCM diagnosis 完整",
        message: "初诊应包含 local + systemic 证型",
        expected: "完整 TCM diagnosis",
        actual: "missing",
      }),
    ];
  },
};
