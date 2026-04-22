import type { GeneratorRule } from "../../types";
import { err } from "../shared";

export const p2: GeneratorRule = {
  id: "P2",
  kind: "GENERATOR",
  check: ({ visit, visitIndex }) => {
    const n = visit.plan.acupoints?.length || 0;
    if (n >= 1 && n <= 20) return [];
    const date = visit.assessment.date || "";
    return [
      err({
        ruleId: "P2",
        severity: "CRITICAL",
        visitDate: date,
        visitIndex,
        section: "P",
        field: "acupoints",
        ruleName: "Acupoints reasonable count",
        message: "Acupoints count unreasonable",
        expected: "2-20",
        actual: String(n),
      }),
    ];
  },
};
