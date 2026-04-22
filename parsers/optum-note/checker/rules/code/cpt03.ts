import type { CodeRule } from "../../types";
import { err } from "../shared";
import { CPT_ESTIM, CPT_NO_ESTIM } from "./_tables";

export const cpt03: CodeRule = {
  id: "CPT03",
  kind: "CODE",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const time = visit.plan.treatmentTime;
    const acuCpts = visit.procedureCodes.filter((p) =>
      [...CPT_ESTIM, ...CPT_NO_ESTIM].includes(p.cpt),
    );
    if (!(time > 15 && acuCpts.length < 2)) return [];
    return [
      err({
        ruleId: "CPT03",
        severity: "CRITICAL",
        visitDate: date,
        visitIndex,
        section: "P",
        field: "procedureCodes",
        ruleName: "CPT↔时间 units 匹配",
        message: `操作时间 ${time}min 超过 15min 但缺少额外 unit CPT`,
        expected: ">= 2 acupuncture CPTs",
        actual: String(acuCpts.length),
      }),
    ];
  },
};
