import type { GeneratorRule } from "../../types";
import { err } from "../shared";

export const a5: GeneratorRule = {
  id: "A5",
  kind: "GENERATOR",
  check: ({ visits, visit, visitIndex }) => {
    const isIE = visit.subjective.visitType === "INITIAL EVALUATION";
    if (isIE || visitIndex === 0) return [];
    const date = visit.assessment.date || "";
    const ieVisit = visits.find(
      (v) => v.subjective.visitType === "INITIAL EVALUATION",
    );
    if (!ieVisit?.assessment.localPattern || !visit.assessment.localPattern)
      return [];
    const iePattern = ieVisit.assessment.localPattern.toLowerCase();
    const curPattern = visit.assessment.localPattern.toLowerCase();
    if (curPattern.includes(iePattern) || iePattern.includes(curPattern))
      return [];
    return [
      err({
        ruleId: "A5",
        severity: "CRITICAL",
        visitDate: date,
        visitIndex,
        section: "A",
        field: "localPattern",
        ruleName: "localPattern consistent across visits",
        message: "Local pattern inconsistent with IE",
        expected: iePattern,
        actual: curPattern,
      }),
    ];
  },
};
