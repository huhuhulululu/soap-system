import type { IERule } from "../../types";
import { err } from "../shared";
import { isTonguePatternConsistent } from "../../../../../src/shared/tcm-mappings";

export const ie04: IERule = {
  id: "IE04",
  kind: "IE",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const localPattern =
      visit.assessment.localPattern || visit.assessment.tcmDiagnosis?.pattern;
    const consistent = isTonguePatternConsistent(
      localPattern,
      visit.objective.tonguePulse.tongue,
      visit.objective.tonguePulse.pulse,
    );
    if (consistent) return [];
    return [
      err({
        ruleId: "IE04",
        severity: "MEDIUM",
        visitDate: date,
        visitIndex,
        section: "O",
        field: "tonguePulse",
        ruleName: "舌脉→证型一致",
        message: "舌脉与证型链不一致",
        expected: "tone consistent with pattern",
        actual: `${visit.objective.tonguePulse.tongue} / ${visit.objective.tonguePulse.pulse}`,
      }),
    ];
  },
};
