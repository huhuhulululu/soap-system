import type { TXRule } from "../../types";
import { err } from "../shared";

export const t07: TXRule = {
  id: "T07",
  kind: "TX",
  check: ({ visit, visitIndex, ieVisit }) => {
    const date = visit.assessment.date || "";
    const hasPacemaker =
      ieVisit?.subjective.medicalHistory?.some((h) =>
        h.toLowerCase().includes("pacemaker"),
      ) ||
      visit.subjective.medicalHistory?.some((h) =>
        h.toLowerCase().includes("pacemaker"),
      );
    if (!(hasPacemaker && visit.plan.electricalStimulation)) return [];
    return [
      err({
        ruleId: "T07",
        severity: "CRITICAL",
        visitDate: date,
        visitIndex,
        section: "P",
        field: "electricalStimulation",
        ruleName: "Pacemaker + 电刺激矛盾",
        message: "medicalHistory 包含 Pacemaker 但 electricalStimulation=true",
        expected: "electricalStimulation = false",
        actual: "electricalStimulation = true",
      }),
    ];
  },
};
