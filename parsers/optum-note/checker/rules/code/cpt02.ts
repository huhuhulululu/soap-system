import type { CodeRule } from "../../types";
import { err } from "../shared";
import { CPT_ESTIM, CPT_NO_ESTIM } from "./_tables";

export const cpt02: CodeRule = {
  id: "CPT02",
  kind: "CODE",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const px = visit.procedureCodes;
    const hasEstimCpt = px.some((p) => CPT_ESTIM.includes(p.cpt));
    const hasNoEstimCpt = px.some((p) => CPT_NO_ESTIM.includes(p.cpt));
    const planEstim = visit.plan.electricalStimulation;
    const out = [];

    if (planEstim && !hasEstimCpt && hasNoEstimCpt) {
      out.push(
        err({
          ruleId: "CPT02",
          severity: "CRITICAL",
          visitDate: date,
          visitIndex,
          section: "P",
          field: "procedureCodes",
          ruleName: "CPT↔电刺激匹配",
          message: "Plan 写 with electrical stimulation 但 CPT 无 97813/97814",
          expected: "97813/97814",
          actual: px.map((p) => p.cpt).join(","),
        }),
      );
    }
    if (!planEstim && hasEstimCpt && !hasNoEstimCpt) {
      out.push(
        err({
          ruleId: "CPT02",
          severity: "CRITICAL",
          visitDate: date,
          visitIndex,
          section: "P",
          field: "procedureCodes",
          ruleName: "CPT↔电刺激匹配",
          message:
            "Plan 写 without electrical stimulation 但 CPT 含 97813/97814",
          expected: "97810/97811",
          actual: px.map((p) => p.cpt).join(","),
        }),
      );
    }
    return out;
  },
};
