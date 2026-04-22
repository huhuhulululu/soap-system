import type { GeneratorRule } from "../../types";
import { err } from "../shared";

export const x4: GeneratorRule = {
  id: "X4",
  kind: "GENERATOR",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const hasPacemaker =
      visit.subjective.medicalHistory?.some((h) =>
        h.toLowerCase().includes("pacemaker"),
      ) ||
      visit.subjective.chiefComplaint.toLowerCase().includes("pacemaker");
    if (!(hasPacemaker && visit.plan.electricalStimulation)) return [];
    return [
      err({
        ruleId: "X4",
        severity: "CRITICAL",
        visitDate: date,
        visitIndex,
        section: "P",
        field: "electricalStimulation",
        ruleName: "Pacemaker→Electrical Stimulation",
        message: "Electrical stimulation contraindicated with pacemaker",
        expected: "false",
        actual: "true",
      }),
    ];
  },
};
