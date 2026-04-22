import type { GeneratorRule } from "../../types";
import { err } from "../shared";
import { isPainTypeConsistentWithPattern } from "../../../../../src/shared/tcm-mappings";

export const s2: GeneratorRule = {
  id: "S2",
  kind: "GENERATOR",
  check: ({ visit, visitIndex }) => {
    if (!(visit.subjective.painTypes.length > 0 && visit.assessment.localPattern))
      return [];
    const date = visit.assessment.date || "";
    const { warning, expected } = isPainTypeConsistentWithPattern(
      visit.assessment.localPattern,
      visit.subjective.painTypes,
    );
    if (!warning) return [];
    return [
      err({
        ruleId: "S2",
        severity: "LOW",
        visitDate: date,
        visitIndex,
        section: "S",
        field: "painTypes",
        ruleName: "painTypes vs localPattern",
        message: warning,
        expected: expected.join("/"),
        actual: visit.subjective.painTypes.join(","),
      }),
    ];
  },
};
